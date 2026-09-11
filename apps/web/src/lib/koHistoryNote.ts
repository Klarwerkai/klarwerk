// ================================================================================================
// JOB 3627 — DER VERMERK EINER VERSION: DER EINE ORT, AN DEM ER ANZEIGBAR WIRD.
// ================================================================================================
//
// DER BEFUND, gemessen und nicht vermutet (F20 am Chromium, JOB 3602 · Lieferung 1): wer die
// Bibliothek auf Englisch liest und unter „Mehr" die Abschnitte History und Snapshots aufklappt,
// las dort mitten im englischen Text das deutsche Wort „erstellt" —
//     History › v1 · 9/11/2026 erstellt
//     Snapshots › … Initial version — no previous diff. erstellt Open version · 298 characters …
//
// WARUM DAS KEIN KATALOGFEHLER WAR und deshalb so lange lag: der Vermerk ist KEIN
// Übersetzungsschlüssel. Der Dienst schreibt ein deutsches WORT in den Datensatz, und die Fläche
// zeigte es wörtlich. In `apps/web/src/i18n.ts` war daran nichts zu beheben — es gab dort gar
// keinen Eintrag, auf den etwas zurückgefallen wäre.
//
// WARUM HIER UND NICHT IM DIENST: die Live-Datenbank trägt bereits Datensätze mit dem Wort
// `erstellt` (veröffentlicht, 1.0.0-beta.1.301). Ein Umbau des Dienstes auf Schlüssel behöbe für
// diese Datensätze NICHTS und verlangte zusätzlich eine Datenwanderung. Die Abbildung braucht die
// Anzeige also ohnehin — und nur hier ist die Sprache des Lesers überhaupt bekannt.
//
// DIE TRAGENDE ZUSAGE, und sie ist die Grenze dieser Datei: ÜBERSETZT WIRD NUR, WAS DER DIENST
// SELBST FEST SCHREIBT. Jeder andere Wert kommt WÖRTLICH zurück. Ein von einem Menschen
// geschriebener Vermerk ist INHALT, keine Beschriftung — ihn zu übersetzen wäre der Fehler, und
// zwar derselbe, den `h4-funktionsinventar.test.ts:729-737` für `Pedi` und `Konstruktion` schon
// benannt hat.
//
// VERGLEICHSREGEL: ZEICHENGENAUE GLEICHHEIT über den ganzen Wert (`Map.get`), ohne Trimmen, ohne
// Kleinschreibung, ohne Präfixvergleich. Der Dienst schreibt genau diese Literale; alles, was
// davon abweicht — `"Erstellt"`, `" erstellt "`, `"erstellt am Montag"` —, stammt nicht von ihm
// und wird nicht angefasst. Ein lockerer Vergleich wäre keine bessere Abdeckung, sondern die
// Gefahr, fremden Text umzuschreiben.
//
// OFFENE GRENZE, ausdrücklich benannt statt wegargumentiert: schreibt ein Mensch eines Tages
// zufällig GENAU `erstellt` als eigenen Vermerk, bekommt er ihn übersetzt. Mit dieser Bauform ist
// das nicht ausschliessbar, solange der Dienst deutsche Wörter statt Schlüssel speichert. Heute
// gibt es keinen Schreibweg für einen menschlichen Vermerk (gemessen, s. u.) — der Fall ist also
// nicht erreichbar, aber er ist auch nicht verboten.

/**
 * Die i18next-`t`, so weit diese Datei sie braucht.
 *
 * Als Überladung ohne `undefined`-Fall — dieselbe Bauform und derselbe Grund wie in
 * `auditAction.ts:22-25`: ein OPTIONALER zweiter Parameter macht die echte `TFunction` unter
 * `exactOptionalPropertyTypes` nicht zuweisbar.
 */
interface Translate {
  (key: string): string;
  (key: string, opts: Record<string, unknown>): string;
}

/**
 * DIE EINE ZUORDNUNGSTABELLE — Vermerk des Dienstes → Katalogschlüssel.
 *
 * Vollständig aus `services/knowledge-object/src/service.ts` gemessen (Lieferung 1): das sind ALLE
 * Stellen, an denen ein FEST IM CODE stehender Vermerk in `history[].note` oder in einen
 * Schnappschuss geht. Ausserhalb dieser Datei schreibt kein Modul einen solchen Vermerk.
 *
 * Wer im Dienst einen neuen festen Vermerk einführt, trägt ihn hier und im Katalog nach —
 * `tests/bibliothek-historie-vermerk/vermerk-uebersetzung.test.ts` liest die Fundstellen aus dem
 * Quelltext des Dienstes und wird sonst rot.
 */
const VERMERK_SCHLUESSEL: ReadonlyMap<string, string> = new Map([
  // service.ts:1816 `history: [{ version: 1, …, note: "erstellt" }]` (Erstanlage)
  // service.ts:1935 `await this.snapshot(ko, author, "erstellt")` (Schnappschuss der Erstanlage)
  ["erstellt", "ko.historyNote.created"],
  // service.ts:2157 `await this.snapshot(ko, input.author, "erstellt (Dokumentinhalt übernommen)")`
  ["erstellt (Dokumentinhalt übernommen)", "ko.historyNote.createdFromDocument"],
  // service.ts:2585 `note: "erstellt (nachgezogen)"` (ensureCreatedSideEffects, v1-Nachzug)
  ["erstellt (nachgezogen)", "ko.historyNote.createdBackfilled"],
  // service.ts:3595 `history: [...ko.history, { …, note: "überarbeitet" }]` (Revision)
  // service.ts:3624 `snapshot: { author, note: "überarbeitet" }` (Schnappschuss der Revision)
  ["überarbeitet", "ko.historyNote.revised"],
  // service.ts:3831 `{ …, note: "überarbeitet (Dokumentinhalt übernommen)" }` (Historie)
  // service.ts:3849 `await this.snapshot(committed, author, "überarbeitet (Dokumentinhalt …)")`
  ["überarbeitet (Dokumentinhalt übernommen)", "ko.historyNote.revisedFromDocument"],
]);

/**
 * Der anzuzeigende Text eines Versionsvermerks.
 *
 * Rein: kein React, kein Hook, keine Abfrage — der Aufrufer reicht die `t` herein.
 *
 * LEER UND FEHLEND KOMMEN UNVERÄNDERT ZURÜCK. Was dann dasteht, entscheidet der Aufrufer und nicht
 * diese Datei: `MehrAbschnitte.tsx:1238` hat dafür seit jeher `|| nameOf(h.author)`, und dieses
 * Verhalten bleibt Zeichen für Zeichen erhalten. Ein hier erfundener Ersatztext wäre eine zweite
 * Entscheidung über dieselbe Anzeige.
 */
export function koHistoryNote(
  vermerk: string | null | undefined,
  t: Translate,
): string | null | undefined {
  if (vermerk === null || vermerk === undefined) {
    return vermerk;
  }
  const schluessel = VERMERK_SCHLUESSEL.get(vermerk);
  return schluessel === undefined ? vermerk : t(schluessel);
}
