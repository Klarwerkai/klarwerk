import type { DraftPayload } from "./types";

// FR-CAP-02: KI-Interview als „Redakteur" — eine Frage pro Schritt, Abschluss bei
// ausreichendem Inhalt. Deterministische Variante (ohne Modell); der Reasoner kann
// die Fragenfolge später ersetzen, ohne die Schnittstelle zu ändern.
const QUESTIONS: readonly string[] = [
  "Worum geht es? Formuliere die Kernaussage in einem Satz.",
  "Unter welchen Bedingungen gilt das?",
  "Welche Maßnahme oder Konsequenz folgt daraus?",
  "Welche Kategorie/Domäne trifft zu?",
];

export class InterviewSession {
  private readonly answers: string[] = [];

  currentQuestion(): string | undefined {
    return QUESTIONS[this.answers.length];
  }

  isComplete(): boolean {
    return this.answers.length >= QUESTIONS.length;
  }

  answer(text: string): void {
    if (this.isComplete()) {
      return;
    }
    this.answers.push(text.trim());
  }

  // Baut aus den Antworten einen Entwurfs-Inhalt.
  result(): DraftPayload {
    return {
      title: this.answers[0] ?? "",
      statement: this.answers[0] ?? "",
      conditions: this.answers[1] ? [this.answers[1]] : [],
      measures: this.answers[2] ? [this.answers[2]] : [],
      category: this.answers[3] ?? "",
    };
  }
}
