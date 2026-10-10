// AUFNAHME 20260922 (R-0305, R-1099) · ein Attrappen-Modell für die Zweitmeinungstests.
//
// Es antwortet mit festem Text (oder scheitert), zitiert die erste übergebene Quelle und zeichnet
// auf, wie oft und mit welchen Kandidaten es gefragt wurde. Alles Übrige erbt es vom
// deterministischen Provider — es ist ein Modell nur an der einen Stelle, die hier gemessen wird.
import {
  type AnswerResult,
  DeterministicProvider,
  type KnowledgeRef,
  type ReasonerProvider,
} from "../../services/reasoner";

export interface Attrappe {
  provider: ReasonerProvider;
  rufe: () => number;
  /** Die Kandidaten-Kennungen je Aufruf, in Aufrufreihenfolge. */
  kandidaten: () => string[][];
}

/**
 * `demo: true` (Ben, Nacharbeit 17): das Glied meldet sich wie der deterministische Rückfall —
 * dann darf an seiner Antwort keine KI-Marke stehen (R-0604).
 */
export function attrappe(name: string, text: string | Error, demo = false): Attrappe {
  const gesehen: string[][] = [];
  const basis = new DeterministicProvider();
  const provider = Object.assign(Object.create(basis) as ReasonerProvider, {
    name,
    isAvailable: () => true,
    answer: async (frage: string, kontext: readonly KnowledgeRef[]): Promise<AnswerResult> => {
      const ids = kontext.map((ref) => ref.id);
      gesehen.push(ids);
      if (text instanceof Error) {
        throw text;
      }
      const grund = await basis.answer(frage, kontext);
      return {
        ...grund,
        answered: true,
        answer: text,
        sources: ids,
        citedSources: ids.slice(0, 1),
        demo,
      };
    },
  });
  return { provider, rufe: () => gesehen.length, kandidaten: () => gesehen };
}
