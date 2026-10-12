// R-0664 (DS20) · DIE LÖSCHFRIST DER SERVER-PROTOKOLLE AM TATSÄCHLICHEN SPEICHERORT.
//
// ENTSCHEIDUNG (Peter, 12.10.2026, Entscheidung 2): „14 Tage als PoC-Standard, anschließend
// automatische Löschung am tatsächlichen Speicherort einschließlich Diagnosekopien. […]
// Sicherheits-/Auditnachweise erhalten eine eigene begründete Regel." Die 14 Tage sind ein
// Vorschlag, keine gesetzliche Frist.
//
// WO DIE PROTOKOLLE WIRKLICH LIEGEN. Die App schreibt nur auf die Standardausgabe. Auf der Insel
// leitet sie `insel_server_starten` (scripts/insel/insel-betrieb.sh, `>>`) bzw. der launchd-Agent
// (`StandardOutPath`) in `$SHARED_ROOT/logs/server-<port>.log` — EINE Datei, die ohne diese Pflege
// unbegrenzt wächst. `start.command` nennt sie der App über `KLARWERK_LOG_DATEI`. Im Docker-/Coolify-
// Betrieb ist die Variable nicht gesetzt; dort liegt die Ausgabe beim Docker-Dienst, und diese Pflege
// tut nichts (docs/operations/monitoring-logging.md §8).
//
// WAS SIE TUT — zweimal, beim Start und dann stündlich (der vorhandene Papierkorb-Taktgeber):
//   1. ROTIEREN: Ist die aktive Datei seit einem Tag in Benutzung, wird ihr Inhalt in eine Archivdatei
//      daneben kopiert und die aktive Datei auf 0 gekürzt („copytruncate"). Der Server schreibt mit
//      O_APPEND weiter — die nächste Zeile landet am neuen Anfang, ohne Neustart. Ein Server, der
//      wochenlang läuft, hält damit nie mehr als einen Tag in der aktiven Datei.
//   2. LÖSCHEN: Jede ANDERE `.log`-Datei im Protokollordner — Archive UND Diagnosekopien, die dort
//      abgelegt wurden — fällt, sobald ihre ÄLTESTE Zeile 14 Tage alt ist. Das Alter wird aus dem
//      Inhalt gelesen (das `time`-Feld der ersten pino-Zeile), nicht allein aus dem Dateidatum: Eine
//      heute angelegte Kopie eines alten Protokolls ist nicht heute entstanden. Steht keine Zeit im
//      Inhalt, gilt das ältere von Änderungs- und Anlagedatum.
//
// WAS SIE AUSDRÜCKLICH NICHT ANFASST: das Audit-Protokoll (Hash-Kette in der Datenhaltung) und jede
// Datei ausserhalb des Protokollordners. Sicherheits-/Auditnachweise erhalten laut Entscheidung eine
// EIGENE Regel; diese Pflege ist sie nicht.
import {
  closeSync,
  copyFileSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  statSync,
  truncateSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { startTrashSweepScheduler } from "./trash-sweep-scheduler";

/** Die Umgebungsvariable mit dem Pfad der Datei, in die die Standardausgabe dieses Servers geht. */
export const LOG_DATEI_ENV = "KLARWERK_LOG_DATEI";

/** Peters Entscheidung 2 vom 12.10.2026: 14 Tage als PoC-Standard. */
export const PROTOKOLL_FRIST_TAGE = 14;

const TAG_MS = 24 * 60 * 60 * 1000;

/** Nach dieser Nutzungsdauer wird die aktive Datei rotiert. */
export const PROTOKOLL_ROTATION_MS = TAG_MS;

/** So oft läuft die Pflege im laufenden Betrieb. */
export const PROTOKOLL_PFLEGE_INTERVALL_MS = 60 * 60 * 1000;

/** So viel vom Dateianfang wird nach der ersten Zeitangabe durchsucht. */
const KOPF_BYTES = 64 * 1024;

export interface ProtokollPflegeErgebnis {
  /** Der Name der Archivdatei, wenn rotiert wurde. */
  rotiertNach: string | null;
  /** Die Namen der gelöschten Dateien. */
  geloescht: string[];
}

/** Die Markierung, seit wann die aktive Datei in Benutzung ist. */
function beginnDatei(datei: string): string {
  return `${datei}.beginn`;
}

function leseBeginn(datei: string): number | null {
  try {
    const wert = Number(readFileSync(beginnDatei(datei), "utf8").trim());
    return Number.isFinite(wert) && wert > 0 ? wert : null;
  } catch {
    return null;
  }
}

function zeitstempel(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

/** Die älteste pino-Zeitangabe am Dateianfang, sonst `null`. */
function ersteZeitImInhalt(pfad: string): number | null {
  let fd: number | null = null;
  try {
    fd = openSync(pfad, "r");
    const puffer = Buffer.alloc(KOPF_BYTES);
    const gelesen = readSync(fd, puffer, 0, KOPF_BYTES, 0);
    for (const zeile of puffer.subarray(0, gelesen).toString("utf8").split("\n")) {
      const treffer = /^\{.*"time":(\d{10,})/.exec(zeile.trim());
      if (treffer?.[1]) {
        return Number(treffer[1]);
      }
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      closeSync(fd);
    }
  }
}

/** Wie alt der älteste Inhalt einer Datei mindestens ist. */
function aeltesterInhalt(pfad: string): number {
  const stand = statSync(pfad);
  const datum = Math.min(
    stand.mtimeMs,
    stand.birthtimeMs > 0 ? stand.birthtimeMs : Number.POSITIVE_INFINITY,
  );
  const imInhalt = ersteZeitImInhalt(pfad);
  return imInhalt === null ? datum : Math.min(imInhalt, datum);
}

/**
 * EIN Pflegelauf: rotieren, dann löschen. Rein in Bezug auf die Zeit (`jetzt` einspritzbar).
 *
 * Fehlt die Beginn-Markierung (erster Lauf nach dem Einspielen), wird sie gesetzt und NICHT sofort
 * rotiert — der Bestand unbekannten Alters wird nach einem Tag rotiert und fällt dann mit seiner
 * ältesten Zeile.
 */
export function pflegeProtokolle(opts: {
  datei: string;
  jetzt?: number;
  fristTage?: number;
}): ProtokollPflegeErgebnis {
  const jetzt = opts.jetzt ?? Date.now();
  const fristMs = (opts.fristTage ?? PROTOKOLL_FRIST_TAGE) * TAG_MS;
  const ordner = dirname(opts.datei);
  const name = basename(opts.datei);
  const ergebnis: ProtokollPflegeErgebnis = { rotiertNach: null, geloescht: [] };
  if (!existsSync(ordner)) {
    return ergebnis;
  }

  // 1. ROTIEREN
  if (existsSync(opts.datei)) {
    const beginn = leseBeginn(opts.datei);
    if (beginn === null) {
      writeFileSync(beginnDatei(opts.datei), `${jetzt}\n`, "utf8");
    } else if (jetzt - beginn >= PROTOKOLL_ROTATION_MS && statSync(opts.datei).size === 0) {
      // Nichts zu archivieren — nur der Beginn rückt nach.
      writeFileSync(beginnDatei(opts.datei), `${jetzt}\n`, "utf8");
    } else if (jetzt - beginn >= PROTOKOLL_ROTATION_MS) {
      const stamm = name.replace(/\.log$/, "");
      const archiv = `${stamm}.${zeitstempel(beginn)}.log`;
      copyFileSync(opts.datei, join(ordner, archiv));
      truncateSync(opts.datei, 0);
      writeFileSync(beginnDatei(opts.datei), `${jetzt}\n`, "utf8");
      ergebnis.rotiertNach = archiv;
    }
  }

  // 2. LÖSCHEN — jede andere `.log`-Datei im Ordner, deren älteste Zeile die Frist erreicht hat.
  for (const eintrag of readdirSync(ordner)) {
    if (eintrag === name || !eintrag.endsWith(".log")) {
      continue;
    }
    const pfad = join(ordner, eintrag);
    if (!statSync(pfad).isFile()) {
      continue;
    }
    if (jetzt - aeltesterInhalt(pfad) >= fristMs) {
      unlinkSync(pfad);
      ergebnis.geloescht.push(eintrag);
    }
  }
  return ergebnis;
}

/**
 * Startet die Pflege: einmal sofort, dann im Takt. Ohne `datei` geschieht nichts (Docker/Coolify).
 * Fehler eines Laufs gehen an `onError` und halten den Server nie an.
 */
export function starteProtokollPflege(deps: {
  datei: string | undefined;
  intervalMs?: number;
  jetzt?: () => number;
  setIntervalFn?: Parameters<typeof startTrashSweepScheduler>[0]["setIntervalFn"];
  clearIntervalFn?: Parameters<typeof startTrashSweepScheduler>[0]["clearIntervalFn"];
  onGepflegt?: (ergebnis: ProtokollPflegeErgebnis) => void;
  onError?: (fehler: unknown) => void;
}): { stop: () => void } | null {
  const datei = deps.datei?.trim();
  if (!datei) {
    return null;
  }
  const lauf = async (): Promise<number> => {
    const ergebnis = pflegeProtokolle({ datei, jetzt: deps.jetzt?.() });
    const anzahl = ergebnis.geloescht.length + (ergebnis.rotiertNach ? 1 : 0);
    if (anzahl > 0) {
      deps.onGepflegt?.(ergebnis);
    }
    return anzahl;
  };
  lauf().catch((fehler) => deps.onError?.(fehler));
  return startTrashSweepScheduler({
    intervalMs: deps.intervalMs ?? PROTOKOLL_PFLEGE_INTERVALL_MS,
    runSweep: lauf,
    setIntervalFn: deps.setIntervalFn,
    clearIntervalFn: deps.clearIntervalFn,
    onError: deps.onError,
  });
}
