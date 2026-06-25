import { DeterministicProvider, type ReasonerProvider } from "./provider";
import type {
  AnswerResult,
  AssistResult,
  KnowledgeRef,
  ReasonerStatus,
  StructureResult,
} from "./types";

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

  private usingPrimary(): boolean {
    return this.primary.isAvailable() && this.primary !== this.fallback;
  }

  // FR-RSN-05: server-echte Statusanzeige.
  status(): ReasonerStatus {
    const usingPrimary = this.usingPrimary();
    return {
      active: usingPrimary,
      provider: usingPrimary ? this.primary.name : this.fallback.name,
      mode: usingPrimary ? "model" : "deterministic",
    };
  }

  // FR-RSN-04: Modellfehler dürfen den Betrieb nicht stoppen → deterministischer Fallback.
  async structure(rawText: string): Promise<StructureResult> {
    if (this.usingPrimary()) {
      try {
        return await this.primary.structure(rawText);
      } catch {
        // Fällt auf den deterministischen Provider zurück.
      }
    }
    return this.fallback.structure(rawText);
  }

  async answer(question: string, context: readonly KnowledgeRef[]): Promise<AnswerResult> {
    if (this.usingPrimary()) {
      try {
        return await this.primary.answer(question, context);
      } catch {
        // Fällt auf den deterministischen Provider zurück.
      }
    }
    return this.fallback.answer(question, context);
  }

  // FR-RSN-03: Text präzisieren; Modellfehler → deterministischer Fallback.
  async assistText(text: string): Promise<AssistResult> {
    if (this.usingPrimary()) {
      try {
        return await this.primary.assistText(text);
      } catch {
        // Fällt auf den deterministischen Provider zurück.
      }
    }
    return this.fallback.assistText(text);
  }

  select(question: string, candidates: readonly KnowledgeRef[]): KnowledgeRef[] {
    const provider = this.usingPrimary() ? this.primary : this.fallback;
    return provider.select(question, candidates);
  }
}
