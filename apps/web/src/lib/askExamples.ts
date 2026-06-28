// SCRUM-265: DOM-freie, produktnahe Beispiel-Fragen als Startimpuls für die Ask-Seite. Sie zeigen
// die zwei ehrlichen Stage-1-Ausgänge: quellengebundene Antwort (answerable, auf vorhandenes
// validiertes Wissen) ODER ehrliche Wissenslücke mit Capture-Folge (gap). Ein Klick setzt nur das
// Eingabefeld — KEINE automatische Anfrage, kein Backend, kein Reasoner-/RAG-Umbau.

export type AskExampleKind = "answerable" | "gap";

export interface AskExample {
  id: string;
  questionKey: string; // i18n-Key für den Beispieltext (DE/EN)
  kind: AskExampleKind;
  // SCRUM-269: technische Seed-Begriffe, die in JEDER Sprache wörtlich erhalten bleiben müssen.
  // Der Demo-Seed ist deutschsprachig; ohne diese Tokens würde die EN-Übersetzung die Treffer
  // verlieren und ein „answerable"-Beispiel fälschlich zur Lücke machen. Konvention, getestet.
  seedTokens: readonly string[];
}

export const ASK_EXAMPLES: readonly AskExample[] = [
  // Treffer auf validiertes Demo-Wissen (Ventil X / Überdruck) → quellengebundene Antwort.
  {
    id: "valve",
    questionKey: "ask.example.valve",
    kind: "answerable",
    seedTokens: ["Ventil X", "Überdruck"],
  },
  // Treffer auf validiertes Demo-Wissen (Filter F3) → quellengebundene Antwort.
  {
    id: "filter",
    questionKey: "ask.example.filter",
    kind: "answerable",
    seedTokens: ["Filter F3"],
  },
  // Bewusst offen (Linie L4 / Dosierwert / Schichtwechsel) → ehrliche Wissenslücke → Capture.
  {
    id: "dosing",
    questionKey: "ask.example.dosing",
    kind: "gap",
    seedTokens: ["Dosierwert", "Linie L4", "Schichtwechsel"],
  },
];

// SCRUM-266: DOM-freier View-Mapper — knappe Ergebnis-Erwartung je Beispiel-Art. Macht die zwei
// ehrlichen Ausgänge sichtbar (quellengebundene Antwort vs. Wissenslücke) und liefert eine dezente
// Tönung. Reine Ableitung aus `kind` — keine Frage-Ausführung, kein Backend.
export type AskExpectationTone = "answer" | "gap";

export interface AskExpectation {
  labelKey: string; // i18n-Key für die kurze Erwartung
  tone: AskExpectationTone;
}

const EXPECTATION: Record<AskExampleKind, AskExpectation> = {
  answerable: { labelKey: "ask.expect.answer", tone: "answer" },
  gap: { labelKey: "ask.expect.gap", tone: "gap" },
};

export function askExpectation(kind: AskExampleKind): AskExpectation {
  return EXPECTATION[kind];
}
