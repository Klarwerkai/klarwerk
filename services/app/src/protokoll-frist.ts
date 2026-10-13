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
//      Inhalt gelesen (das älteste `time`-Feld aller Zeilen), nicht allein aus dem Dateidatum: Eine
//      heute angelegte Kopie eines alten Protokolls ist nicht heute entstanden. Steht keine Zeit im
//      Inhalt, gilt das ältere von Änderungs- und Anlagedatum.
//
// WAS SIE AUSDRÜCKLICH NICHT ANFASST: das Audit-Protokoll (Hash-Kette in der Datenhaltung) und jede
// Datei ausserhalb des Protokollordners. Sicherheits-/Auditnachweise erhalten laut Entscheidung eine
// EIGENE Regel; diese Pflege ist sie nicht.
import {
  copyFileSync,
  existsSync,
  readFileSync,
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

/**
 * Die ÄLTESTE gültige Zeitangabe der GANZEN Datei, sonst `null` (Ben, Nacharbeit 24).
 *
 * Bis hierher las eine Regex den ERSTEN Treffer aus höchstens 64 KiB und kannte keine Leerzeichen
 * nach dem Doppelpunkt: Eine gültige Zeile `{"time": 1700000000000}` blieb unerkannt, und eine
 * gemischte Rotation mit junger erster und alter späterer Zeile galt als jung — beides verhinderte
 * die Löschung. Jetzt wird jede Zeile als JSON gelesen (jede zulässige Schreibweise) und das MINIMUM
 * genommen. Zwei Formen: pino schreibt `time` als Millisekunden, Dockers `json-file` als ISO-8601.
 * Unlesbare Zeilen tragen keine Zeit bei; ihr Alter fällt auf das Dateidatum (`aeltesterInhalt`).
 */
export function aeltesteZeitImInhalt(pfad: string): number | null {
  let inhalt: string;
  try {
    inhalt = readFileSync(pfad, "utf8");
  } catch {
    return null;
  }
  let aeltestes: number | null = null;
  for (const zeile of inhalt.split("\n")) {
    if (zeile.trim().length === 0) {
      continue;
    }
    let wert: unknown;
    try {
      wert = JSON.parse(zeile);
    } catch {
      continue;
    }
    if (wert === null || typeof wert !== "object" || Array.isArray(wert)) {
      continue;
    }
    const zeitWert = (wert as Record<string, unknown>).time;
    const zeit =
      typeof zeitWert === "number"
        ? zeitWert
        : typeof zeitWert === "string"
          ? Date.parse(zeitWert)
          : Number.NaN;
    if (Number.isFinite(zeit)) {
      aeltestes = aeltestes === null ? zeit : Math.min(aeltestes, zeit);
    }
  }
  return aeltestes;
}

/**
 * Wann der älteste Inhalt einer Datei höchstens entstand: das Minimum aus ältester Inhaltszeit und
 * Dateidatum. Eine erkannte alte Inhaltszeit wird so nie durch ein jüngeres Dateidatum verdeckt.
 */
export function aeltesterInhalt(pfad: string): number {
  const stand = statSync(pfad);
  const datum = Math.min(
    stand.mtimeMs,
    stand.birthtimeMs > 0 ? stand.birthtimeMs : Number.POSITIVE_INFINITY,
  );
  const imInhalt = aeltesteZeitImInhalt(pfad);
  return imInhalt === null ? datum : Math.min(imInhalt, datum);
}

/**
 * Der Unterordner des Protokollordners, in den Diagnosekopien gehören. Er wird mit derselben Frist
 * gepflegt — eine Kopie, die dort liegt, fällt automatisch (Entscheidung 2: „einschließlich
 * Diagnosekopien").
 */
export const DIAGNOSE_UNTERORDNER = "diagnose";

/** Welche Dateien neben der aktiven als Protokoll gelten. Vorgabe: jede `.log`-Datei. */
function istLogdatei(name: string): boolean {
  return name.endsWith(".log");
}

/**
 * EIN Pflegelauf: rotieren, dann löschen. Rein in Bezug auf die Zeit (`jetzt` einspritzbar).
 *
 * ERSTER LAUF OHNE BEGINN-MARKIERUNG (Ben, Nacharbeit 10): Der Beginn wird aus dem INHALT der
 * aktiven Datei abgeleitet — ihrer ältesten Zeile —, nicht auf „jetzt" gesetzt. Ist der Bestand
 * mindestens einen Tag alt, wird sofort rotiert; ist er die Frist alt, fällt das Archiv im selben
 * Lauf. Die aktive Datei bleibt an ihrem Pfad und wird nur gekürzt — der Schreiber hängt weiter an.
 *
 * `istKandidat` wählt, welche Nachbardateien als Protokoll gelten (Vorgabe: `.log`); der Docker-
 * Hostlauf (`protokoll-frist-docker.ts`) zählt dort auch Dockers eigene Rotationen `….log.1` usw.
 */
export function pflegeProtokolle(opts: {
  datei: string;
  jetzt?: number;
  fristTage?: number;
  istKandidat?: (name: string) => boolean;
}): ProtokollPflegeErgebnis {
  const jetzt = opts.jetzt ?? Date.now();
  const fristMs = (opts.fristTage ?? PROTOKOLL_FRIST_TAGE) * TAG_MS;
  const istKandidat = opts.istKandidat ?? istLogdatei;
  const ordner = dirname(opts.datei);
  const name = basename(opts.datei);
  const ergebnis: ProtokollPflegeErgebnis = { rotiertNach: null, geloescht: [] };
  if (!existsSync(ordner)) {
    return ergebnis;
  }

  // 1. ROTIEREN
  if (existsSync(opts.datei)) {
    let beginn = leseBeginn(opts.datei);
    if (beginn === null) {
      const leer = statSync(opts.datei).size === 0;
      beginn = leer ? jetzt : Math.min(jetzt, aeltesterInhalt(opts.datei));
      writeFileSync(beginnDatei(opts.datei), `${beginn}\n`, "utf8");
    }
    if (jetzt - beginn >= PROTOKOLL_ROTATION_MS) {
      if (statSync(opts.datei).size === 0) {
        // Nichts zu archivieren — nur der Beginn rückt nach.
        writeFileSync(beginnDatei(opts.datei), `${jetzt}\n`, "utf8");
      } else {
        const stamm = name.replace(/\.log$/, "");
        const archiv = `${stamm}.${zeitstempel(beginn)}.log`;
        copyFileSync(opts.datei, join(ordner, archiv));
        truncateSync(opts.datei, 0);
        writeFileSync(beginnDatei(opts.datei), `${jetzt}\n`, "utf8");
        ergebnis.rotiertNach = archiv;
      }
    }
  }

  // 2. LÖSCHEN — jede andere Protokolldatei im Ordner, deren älteste Zeile die Frist erreicht hat.
  loescheAbgelaufene(ordner, name, istKandidat, jetzt, fristMs, ergebnis);
  // … und jede Datei im Diagnose-Unterordner, gleich welcher Endung: dort liegen nur Kopien.
  ergebnis.geloescht.push(
    ...pflegeDiagnoseordner({ ordner: join(ordner, DIAGNOSE_UNTERORDNER), jetzt, fristMs }).map(
      (eintrag) => `${DIAGNOSE_UNTERORDNER}/${eintrag}`,
    ),
  );
  return ergebnis;
}

/**
 * Ein Ordner, in dem nur Diagnosekopien liegen: jede Datei, gleich welcher Endung, fällt, sobald
 * ihre älteste Zeile die Frist erreicht hat. Gibt die Namen der gelöschten Dateien zurück.
 */
export function pflegeDiagnoseordner(opts: {
  ordner: string;
  jetzt?: number;
  fristMs?: number;
}): string[] {
  const ergebnis: ProtokollPflegeErgebnis = { rotiertNach: null, geloescht: [] };
  if (existsSync(opts.ordner) && statSync(opts.ordner).isDirectory()) {
    loescheAbgelaufene(
      opts.ordner,
      "",
      () => true,
      opts.jetzt ?? Date.now(),
      opts.fristMs ?? PROTOKOLL_FRIST_TAGE * TAG_MS,
      ergebnis,
    );
  }
  return ergebnis.geloescht;
}

function loescheAbgelaufene(
  ordner: string,
  aktiv: string,
  istKandidat: (name: string) => boolean,
  jetzt: number,
  fristMs: number,
  ergebnis: ProtokollPflegeErgebnis,
): void {
  for (const eintrag of readdirSync(ordner)) {
    if (eintrag === aktiv || eintrag.endsWith(".beginn") || !istKandidat(eintrag)) {
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
    // `exactOptionalPropertyTypes`: ein fehlender Wert wird weggelassen, nicht als `undefined` gesetzt.
    const ergebnis = pflegeProtokolle(deps.jetzt ? { datei, jetzt: deps.jetzt() } : { datei });
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
    ...(deps.setIntervalFn ? { setIntervalFn: deps.setIntervalFn } : {}),
    ...(deps.clearIntervalFn ? { clearIntervalFn: deps.clearIntervalFn } : {}),
    ...(deps.onError ? { onError: deps.onError } : {}),
  });
}
