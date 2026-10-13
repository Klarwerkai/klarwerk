// R-0664 · DIE AKTIVE DOCKER-PROTOKOLLDATEI ALTERT NICHT ÜBER DIE FRIST (Ben, Nacharbeit 16).
//
// Die aktive Datei `<id>-json.log` gehört Docker und darf von aussen nicht gekürzt werden (echte
// Docker-Probe, Nacharbeit 15: danach liest `docker logs` neue Zeilen nicht mehr). Docker selbst
// rotiert sie aber zuverlässig — sobald eine Ausgabe sie über `max-size` brächte, benennt der Dienst
// sie in `….log.1` um und beginnt eine neue. Diese Rotation ist Dockers eigener, lesesicherer Weg.
//
// Bei wenig oder ausbleibender Ausgabe erreicht die Datei `max-size` nie, und ihr Inhalt bliebe
// beliebig lange stehen. DESHALB schreibt die App EINMAL TÄGLICH einen inhaltsfreien Füllblock von
// mindestens `max-size` Bytes auf ihre Standardausgabe. Damit überschreitet die aktive Datei die
// Grenze, und Docker rotiert sie selbst — unabhängig vom übrigen Ausgabevolumen. Die alte Datei ist
// danach eine Rotation, und die löscht der Hostlauf (protokoll-frist-docker.ts), sobald ihre älteste
// Zeile 14 Tage alt ist. Ergebnis: Keine Zeile ist länger als 14 Tage plus ein Pflegetakt vorhanden,
// die aktive Datei hält höchstens einen Tag.
//
// Der Füllblock trägt keinen Inhalt (eine feste Kennung und Füllzeichen), läuft an Logger und
// Positivliste vorbei direkt auf die Standardausgabe und kostet höchstens `max-size` (+ Zuschlag)
// Bytes am Tag. Er wirkt nur, wenn Docker mit genau dieser `max-size` rotiert — `KLARWERK_DOCKER_LOG_MAX_SIZE`
// muss deshalb zum `--log-opt max-size` passen (Dockerfile, docker-compose.prod.yml, Coolify-Optionen).
// Ohne die Variable (Insel, Entwicklung) geschieht nichts.
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startTrashSweepScheduler } from "./trash-sweep-scheduler";

/** Die Umgebungsvariable mit Dockers `max-size` für diesen Container (Docker-Schreibweise). */
export const DOCKER_LOG_MAX_SIZE_ENV = "KLARWERK_DOCKER_LOG_MAX_SIZE";

/** Einmal am Tag — die aktive Datei hält damit höchstens einen Tag Inhalt. */
export const ROTATIONSIMPULS_INTERVALL_MS = 24 * 60 * 60 * 1000;

/**
 * Länge einer Füllzeile. Docker teilt Zeilen über 16 KiB in Teilnachrichten; darunter bleibt jede
 * Füllzeile eine Zeile.
 */
const FUELLZEILE_ZEICHEN = 8 * 1024;

/** Die feste Kennung jeder Füllzeile — so ist sie in `docker logs` als Füllung erkennbar. */
export const FUELLKENNUNG = "klarwerk-protokollrotation";

/** Dockers `max-size`-Schreibweise (`1048576`, `100k`, `1m`, `1g`) → Bytes; Ungültiges → `null`. */
export function leseMaxSize(roh: string | undefined): number | null {
  const treffer = /^\s*(\d+)\s*([kmg]?)b?\s*$/i.exec(roh ?? "");
  if (!treffer?.[1]) {
    return null;
  }
  const faktor = { "": 1, k: 1024, m: 1024 ** 2, g: 1024 ** 3 }[
    (treffer[2] ?? "").toLowerCase() as "" | "k" | "m" | "g"
  ];
  const bytes = Number(treffer[1]) * faktor;
  return bytes > 0 ? bytes : null;
}

/**
 * Der Füllblock: Zeilen mit fester Kennung, zusammen MEHR als `maxSize` Bytes (ein Zeilenzuschlag),
 * damit die aktive Datei die Grenze sicher überschreitet. Docker umhüllt jede Zeile zusätzlich mit
 * JSON — die Datei wächst also um mehr als die geschriebenen Bytes.
 */
export function fuellblock(maxSize: number): string[] {
  const zeile = `${JSON.stringify({ [FUELLKENNUNG]: true, fueller: "-".repeat(FUELLZEILE_ZEICHEN) })}\n`;
  const anzahl = Math.ceil(maxSize / zeile.length) + 1;
  return Array.from({ length: anzahl }, () => zeile);
}

/**
 * Wo der Zeitpunkt des letzten Impulses steht (Ben, Nacharbeit 18).
 *
 * Ein Takt von 24 Stunden allein begänne mit jedem Prozessstart neu — ein Container, der öfter als
 * täglich neu startet, käme nie zum Impuls. Die Markierung liegt im beschreibbaren Bereich des
 * Containers: sie übersteht `docker restart` desselben Containers (dessen Protokolldatei ebenfalls
 * bleibt), und ein neu erstellter Container beginnt mit leerer Markierung UND neuer Protokolldatei.
 */
export const IMPULS_MARKIERUNG = join(tmpdir(), "klarwerk-rotationsimpuls.zeit");

/** So oft wird geprüft, ob der Impuls fällig ist. */
export const IMPULS_PRUEFTAKT_MS = 60 * 60 * 1000;

function leseLetztenImpuls(datei: string): number | null {
  try {
    const wert = Number(readFileSync(datei, "utf8").trim());
    return Number.isFinite(wert) && wert > 0 ? wert : null;
  } catch {
    return null;
  }
}

/**
 * Startet den Impuls. Ohne gültige `maxSize` geschieht nichts (`null`).
 *
 * BEIM START UND DANN STÜNDLICH wird geprüft: Fehlt die Markierung oder ist der letzte Impuls einen
 * Tag her, wird JETZT impulsiert und die Zeit festgehalten. So zählt die Frist über Neustarts hinweg
 * und beginnt nicht mit jedem Start neu. Lässt sich die Markierung nicht schreiben, impulsiert jeder
 * Start — die Abweichung geht zur früheren Löschung, nie zur späteren.
 */
export function starteRotationsimpuls(deps: {
  maxSize: number | null;
  schreibe?: (zeile: string) => void;
  markierung?: string;
  jetzt?: () => number;
  intervalMs?: number;
  prueftaktMs?: number;
  setIntervalFn?: (callback: () => void, ms: number) => ReturnType<typeof setInterval>;
  clearIntervalFn?: (handle: ReturnType<typeof setInterval>) => void;
  onError?: (fehler: unknown) => void;
}): { stop: () => void } | null {
  const maxSize = deps.maxSize;
  if (maxSize === null) {
    return null;
  }
  const schreibe = deps.schreibe ?? ((zeile: string) => void process.stdout.write(zeile));
  const markierung = deps.markierung ?? IMPULS_MARKIERUNG;
  const uhr = deps.jetzt ?? Date.now;
  const intervall = deps.intervalMs ?? ROTATIONSIMPULS_INTERVALL_MS;
  const pruefe = async (): Promise<number> => {
    const jetzt = uhr();
    const letzter = leseLetztenImpuls(markierung);
    if (letzter !== null && jetzt - letzter < intervall) {
      return 0;
    }
    const zeilen = fuellblock(maxSize);
    for (const zeile of zeilen) {
      schreibe(zeile);
    }
    try {
      writeFileSync(markierung, `${jetzt}\n`, "utf8");
    } catch (fehler) {
      deps.onError?.(fehler);
    }
    return zeilen.length;
  };
  pruefe().catch((fehler) => deps.onError?.(fehler));
  return startTrashSweepScheduler({
    intervalMs: deps.prueftaktMs ?? IMPULS_PRUEFTAKT_MS,
    runSweep: pruefe,
    ...(deps.setIntervalFn ? { setIntervalFn: deps.setIntervalFn } : {}),
    ...(deps.clearIntervalFn ? { clearIntervalFn: deps.clearIntervalFn } : {}),
    ...(deps.onError ? { onError: deps.onError } : {}),
  });
}
