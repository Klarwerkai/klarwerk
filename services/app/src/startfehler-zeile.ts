// ================================================================================================
// R-0623 (Ben, Nacharbeit 5) — DIE STARTFEHLERZEILE NUR AUS FREIGEGEBENEN ANGABEN.
// ================================================================================================
//
// Scheitert `start()` in `server.ts`, gibt es noch keine App und keinen Logger mit Positivliste. Bis
// hierher schrieb der Fänger deshalb `String(error)` direkt auf stderr — Meldung samt allem, was ein
// Treiber- oder Migrationsfehler mitträgt (etwa `Key (email)=(…)`), an allen Listen vorbei in die
// Betriebsausgabe.
//
// Jetzt besteht die Zeile ausschliesslich aus:
//   · dem festen Ereignistext `Serverstart fehlgeschlagen:`,
//   · dem Fehlertyp aus `ERLAUBTE_FEHLERTYPEN` (sonst `UNBEKANNT`),
//   · dem Fehlercode aus `ERLAUBTE_FEHLERCODES` (sonst `UNBEKANNT`/`OHNE_CODE`),
//   · der Quelltextstelle des obersten Stackrahmens (`datei:zeile:spalte`),
// und nie aus Meldung oder Stack. Einzige Ausnahme ist der Startvertrag: sein Satz ist fest und
// nennt nur Namen von Umgebungsvariablen — die Zusage an den Betreiber, ALLE fehlenden Werte in
// einer Zeile zu sehen (`tests/demo-zugang-start/echter-serverstart.test.ts`). Er wird aus den
// Namen NEU gebaut, nicht aus der Meldung übernommen, und nur Namen in Variablenform kommen hinein.
import { ERR_TEXT_UNTERDRUECKT, erlaubterCode, erlaubterTyp, herkunftAusStack } from "./build-app";
import { StartvertragError } from "./start-vertrag";

/** Der feste Ereignistext — daran erkennen Betreiber und Prüfungen die Zeile. */
export const STARTFEHLER_EREIGNIS = "Serverstart fehlgeschlagen:";

/** Die Form eines Umgebungsvariablennamens — mehr darf aus dem Startvertrag nicht hinein. */
const VARIABLENNAME = /^[A-Z][A-Z0-9_]{0,80}$/;

export function startfehlerZeile(fehler: unknown): string {
  if (fehler instanceof StartvertragError) {
    const namen = fehler.fehlend.filter((name) => VARIABLENNAME.test(name));
    return `${STARTFEHLER_EREIGNIS} ${erlaubterTyp(fehler.name)}: ${new StartvertragError(namen).message}`;
  }
  return `${STARTFEHLER_EREIGNIS} ${inhaltsfreieAbbruchkennung(fehler)}`;
}

/**
 * Die Kennung eines Abbruchs für jede Ausgabe AUSSERHALB des App-Loggers (Startfehler, Werkzeuge
 * unter `tools/`): Fehlertyp und -code nur aus den Erlaubnislisten, dazu die Quelltextstelle —
 * nie Meldung, Name ausserhalb der Liste, Stacktext oder `String(fehler)`. Immer einzeilig.
 */
export function inhaltsfreieAbbruchkennung(fehler: unknown): string {
  const typ = erlaubterTyp(fehler instanceof Error ? fehler.name : undefined);
  const code = erlaubterCode(
    fehler !== null && typeof fehler === "object" ? (fehler as { code?: unknown }).code : undefined,
  );
  const herkunft = herkunftAusStack(fehler instanceof Error ? fehler.stack : undefined);
  return `${typ} (code ${code}, herkunft ${herkunft}) — ${ERR_TEXT_UNTERDRUECKT}`;
}
