// SCRUM-265: DOM-freie, produktnahe Beispiel-Fragen als Startimpuls für die Ask-Seite. Sie zeigen
// die zwei ehrlichen Stage-1-Ausgänge: quellengebundene Antwort (answerable, auf vorhandenes
// validiertes Wissen) ODER ehrliche Wissenslücke mit Capture-Folge (gap). Ein Klick setzt nur das
// Eingabefeld — KEINE automatische Anfrage, kein Backend, kein Reasoner-/RAG-Umbau.

export type AskExampleKind = "answerable" | "gap";

export interface AskExample {
  id: string;
  questionKey: string; // i18n-Key für den Beispieltext (DE/EN)
  kind: AskExampleKind;
}

export const ASK_EXAMPLES: readonly AskExample[] = [
  // Treffer auf validiertes Demo-Wissen (Ventil X / Überdruck) → quellengebundene Antwort.
  { id: "valve", questionKey: "ask.example.valve", kind: "answerable" },
  // Treffer auf validiertes Demo-Wissen (Filter F3) → quellengebundene Antwort.
  { id: "filter", questionKey: "ask.example.filter", kind: "answerable" },
  // Bewusst offen (Linie L4 / Dosierwert / Schichtwechsel) → ehrliche Wissenslücke → Capture.
  { id: "dosing", questionKey: "ask.example.dosing", kind: "gap" },
];
