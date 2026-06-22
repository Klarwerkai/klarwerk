import { DeterministicProvider, type ReasonerProvider } from "./provider";
import type { AnswerResult, KnowledgeRef, ReasonerStatus, StructureResult } from "./types";

// FR-RSN-01: gebündelte Aufgaben über die Reasoner-Schicht.
// FR-RSN-06: der KI-Schlüssel lebt ausschließlich im Provider (serverseitig),
// der Reasoner reicht ihn nie nach außen — Status/Ergebnisse enthalten keinen Schlüssel.
export class Reasoner {
  private readonly primary: ReasonerProvider;
  private readonly fallback: ReasonerProvider;

  constructor(
    primary?: ReasonerProvider,
    fallback: ReasonerProvider = new DeterministicProvider(),
  ) {
    this.primary = primary ?? fallback;
    this.fallback = fallback;
  }

  private active(): ReasonerProvider {
    return this.primary.isAvailable() ? this.primary : this.fallback;
  }

  // FR-RSN-05: server-echte Statusanzeige.
  status(): ReasonerStatus {
    const usingPrimary = this.primary.isAvailable() && this.primary !== this.fallback;
    return {
      active: usingPrimary,
      provider: usingPrimary ? this.primary.name : this.fallback.name,
      mode: usingPrimary ? "model" : "deterministic",
    };
  }

  structure(rawText: string): StructureResult {
    return this.active().structure(rawText);
  }

  answer(question: string, context: readonly KnowledgeRef[]): AnswerResult {
    return this.active().answer(question, context);
  }

  select(question: string, candidates: readonly KnowledgeRef[]): KnowledgeRef[] {
    return this.active().select(question, candidates);
  }
}
