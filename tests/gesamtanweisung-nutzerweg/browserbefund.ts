// ================================================================================================
// JOB 4323 R2 · FEHLENDES CHROMIUM IST EIN BENANNTER BEFUND — UND NICHT DASSELBE WIE EIN KAPUTTER
// AUFBAU.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESE DATEI STEHT (BEN, Runde 1, Korrekturpflicht 2): Die Rückgabe von Runde 1
// versprach „Ohne PostgreSQL ODER ohne Chromium: Grund sichtbar auf stderr, dann Skip". Für
// PostgreSQL stimmte das; für Chromium stand im Prüfstand nur `browser = await starteChromium()` —
// ein Wurf dort riss den ganzen Aufbau mit, ohne Befundsatz und ohne ausgewiesenen Übersprung. Eine
// zugesagte Fehlerbehandlung, die es nicht gibt, ist die Fehlerklasse „gebaut, richtig, wirkungslos"
// in ihrer schlimmsten Form: sie steht nur in der Rückgabe.
//
// ZWEI FEHLERKLASSEN, UND SIE DÜRFEN SICH NICHT VERMISCHEN:
//   · KEIN BROWSER — auf dieser Maschine gibt es kein Chromium (Paket fehlt, Binärdatei fehlt,
//     `launch()` scheitert). Das ist eine Eigenschaft der Maschine, kein Befund über das Produkt.
//     Ergebnis: ein Laufzustand mit Grund, sichtbar auf stderr, Fachstrecke übersprungen, und der
//     Zeuge sagt ausdrücklich, dass nichts belegt ist.
//   · KEINE GEBAUTE FLÄCHE — `apps/web/dist` fehlt. Das ist ein AUFBAUFEHLER des Prüfstands und
//     wird WEITERGEWORFEN. Würde er als „kein Chromium" durchgehen, verschwände ein echter Mangel
//     hinter einem harmlosen Übersprung; genau davor warnt der Hinweis der Steuerung zu Runde 2.
//     `starteChromium` wirft für BEIDE Lagen (`browserweg.ts:407-412`) — die Unterscheidung muss
//     deshalb hier fallen und nicht am Wortlaut einer Fehlermeldung.
//
// WARUM DIESE DATEI NICHTS AUS `browserweg.ts` IMPORTIERT, obwohl sie von Browsern handelt: die
// Browser-Gruppe des Tors wird aus dem Importgraphen berechnet (`tests/tor-inventar/browser-gruppe.ts`).
// Ein Zeugentest, der diese Regel messen will und dabei Playwright in seine Hülle zöge, wanderte in
// die serielle Browser-Gruppe — und wäre genau dann nicht messbar, wenn es keinen Browser gibt.
// Der Browsertyp ist deshalb ein Typparameter, und beide Vorbedingungen kommen als Funktionen
// herein. Dieselbe Bauform und derselbe Grund wie `../wiki-gesamtanweisung-abnahme/laufzustand.ts`.
import type { Laufzustand } from "../wiki-gesamtanweisung-abnahme/laufzustand";

/** Entweder ein Browser — oder ein benannter Befund, warum es keinen gibt. */
export type Browserstart<B> = { readonly browser: B } | { readonly zustand: Laufzustand };

/** Schmalspur-Typwächter: hat dieser Start einen Browser? */
export function hatBrowser<B>(start: Browserstart<B>): start is { readonly browser: B } {
  return "browser" in start;
}

/** Der Grund beginnt IMMER so — daran erkennt ihn jede Meldung und jeder Zeuge wieder. */
export const KEIN_BROWSER = "kein Chromium";

/**
 * Chromium starten — oder einen benannten Befund liefern.
 *
 * `flaecheDa` ist die Unterscheidung und nicht ein Zusatz: scheitert der Start, während die gebaute
 * Fläche FEHLT, dann ist der Aufbau schuld und der Fehler geht weiter nach oben. Nur wenn die Fläche
 * WIRKLICH da ist, bleibt als Ursache der Browser übrig — und erst dann entsteht ein Übersprung.
 *
 * Der Grund trägt den Wortlaut des Fehlers mit (gekürzt): ein Befundsatz, der nur „kein Chromium"
 * sagt, lässt den Betreiber raten, ob das Paket fehlt oder die Binärdatei.
 */
export async function starteBrowserOderBefund<B>(
  starten: () => Promise<B>,
  flaecheDa: () => boolean,
): Promise<Browserstart<B>> {
  try {
    return { browser: await starten() };
  } catch (fehler) {
    if (!flaecheDa()) {
      throw fehler;
    }
    return {
      zustand: {
        gelaufen: false,
        grund: `${KEIN_BROWSER} — ${String(fehler).replace(/\s+/g, " ").slice(0, 300)}`,
      },
    };
  }
}
