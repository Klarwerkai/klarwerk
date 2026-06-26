import { DeterministicProvider, type ReasonerProvider } from "./provider";
import type {
  AnswerResult,
  AssistResult,
  InterviewResult,
  KnowledgeRef,
  ReasonerLocale,
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

  // FR-RSN-04/FR-I18N-01: Modellfehler dürfen den Betrieb nicht stoppen → deterministischer
  // Fallback. locale wird an primary UND fallback identisch durchgereicht (Default "de").
  async structure(rawText: string, locale: ReasonerLocale = "de"): Promise<StructureResult> {
    if (this.usingPrimary()) {
      try {
        return await this.primary.structure(rawText, locale);
      } catch {
        // Fällt auf den deterministischen Provider zurück.
      }
    }
    return this.fallback.structure(rawText, locale);
  }

  async answer(
    question: string,
    context: readonly KnowledgeRef[],
    locale: ReasonerLocale = "de",
  ): Promise<AnswerResult> {
    if (this.usingPrimary()) {
      try {
        return await this.primary.answer(question, context, locale);
      } catch {
        // Fällt auf den deterministischen Provider zurück.
      }
    }
    return this.fallback.answer(question, context, locale);
  }

  // FR-RSN-03: Text präzisieren; Modellfehler → deterministischer Fallback.
  async assistText(text: string, locale: ReasonerLocale = "de"): Promise<AssistResult> {
    if (this.usingPrimary()) {
      try {
        return await this.primary.assistText(text, locale);
      } catch {
        // Fällt auf den deterministischen Provider zurück.
      }
    }
    return this.fallback.assistText(text, locale);
  }

  // SCRUM-132: reasoner-getriebenes Interview; Modellfehler → deterministischer Fallback.
  async interview(
    answers: readonly string[],
    locale: ReasonerLocale = "de",
  ): Promise<InterviewResult> {
    if (this.usingPrimary()) {
      try {
        return await this.primary.interview(answers, locale);
      } catch {
        // Fällt auf den deterministischen Provider zurück.
      }
    }
    return this.fallback.interview(answers, locale);
  }

  select(question: string, candidates: readonly KnowledgeRef[]): KnowledgeRef[] {
    const provider = this.usingPrimary() ? this.primary : this.fallback;
    return provider.select(question, candidates);
  }
}
