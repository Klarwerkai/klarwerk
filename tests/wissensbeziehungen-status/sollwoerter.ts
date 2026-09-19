// ================================================================================================
// JOB 4353 · DIE SOLLWERTTABELLE DER ZWEI STATUSWÖRTER — ausgeschrieben, an EINER Stelle.
// ================================================================================================
//
// WARUM SIE ÜBERHAUPT EXISTIERT. Die zwei Wörter wohnen seit Runde 2 dieses Auftrags in der
// Komponente selbst (`WissensbeziehungenBereich.tsx`, `STATUS_WORT`) und nicht im Sprachkatalog:
// `i18n.ts` gehört nicht zum Umfang dieses Auftrags (HINWEIS JOB 4353, Runde 2, Punkt 1–2). Ein
// Nachweis, der seinen Sollwert NUR aus derselben Abbildung holt, prüfte damit nur noch, ob eine
// Zeichenkette durchgereicht wird — jedes still geänderte Wort bliebe grün. Das ist genau die
// Lehre aus JOB 4141 R1: „Ein Feld zählt erst als Nachweis, wenn seine Werte tatsächlich
// verglichen werden."
//
// WARUM SIE HIER STEHT UND NICHT ZWEIMAL. Zwei Nachweise brauchen sie: der jsdom-Fall
// (`statuswort.test.tsx`) und die Chromium-Strecke (`strecke.ts`). Zweimal getippt liefen sie
// auseinander, und dann hiesse dieselbe Beziehung in der jsdom-Abnahme so und im Browser anders.
//
// WER SIE GEGEN DAS PRODUKT HÄLT: `statuswort.test.tsx`, Fall S5 — Sprache für Sprache, Wert für
// Wert gegen `beziehungsstatusText`. Diese Datei behauptet also nichts über das Produkt; sie ist
// die unabhängige SEITE des Vergleichs. Die Strecke im Browser importiert bewusst NUR sie und
// nicht das Bauteil: ein React-Bauteil in einen Node-Lauf zu ziehen brächte dessen ganze
// Importhülle mit, ohne dem Nachweis etwas hinzuzufügen.
//
// DIE WÖRTER SELBST: keines von ihnen heisst „geprüft". Der Status sagt, ob die BEZIEHUNG gilt —
// über den Inhalt der Endpunkte sagt er nichts (dafür steht der Fassungsvermerk daneben).

/** Die zwei gespeicherten Werte des Vertrags (`KantenStatus`, `kanten-types.ts:60`). */
export type Statuswert = "aktiv" | "widerrufen";

/** Die drei Sprachen, die die Anwendung kann (`ERLAUBTE_SPRACHEN`, `lib/htmlLang.ts:63`). */
export const SPRACHEN: readonly string[] = ["de", "en", "nl"];

export const SOLL_WORT: Record<string, Record<Statuswert, string>> = {
  de: { aktiv: "Status: gilt", widerrufen: "Status: widerrufen" },
  en: { aktiv: "Status: in effect", widerrufen: "Status: withdrawn" },
  nl: { aktiv: "Status: geldt", widerrufen: "Status: ingetrokken" },
};

/**
 * Das zugesagte Wort — oder ein FEHLER.
 *
 * Kein Ersatzwert und kein leerer Rückfall: ein Nachweis, der bei einer unbekannten Sprache oder
 * einem unbekannten Status still etwas zurückgibt, könnte auch Unsinn bestätigen.
 */
export function sollWort(sprache: string, status: string): string {
  const zeile = SOLL_WORT[sprache];
  if (!zeile) {
    throw new Error(`JOB 4353: für die Sprache „${sprache}" gibt es keine Sollwertzeile.`);
  }
  if (status !== "aktiv" && status !== "widerrufen") {
    throw new Error(
      `JOB 4353: der Status „${status}" steht nicht im Vertrag (aktiv|widerrufen) — der Sollwert ist damit ungültig.`,
    );
  }
  return zeile[status];
}
