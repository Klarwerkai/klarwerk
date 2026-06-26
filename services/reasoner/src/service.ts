import { randomUUID } from "node:crypto";
import type { ModelRunRepo, ModelRunStatus, ModelRunTask } from "../../model-runs";
import { DeterministicProvider, type ReasonerProvider } from "./provider";
import type {
  AnswerResult,
  AssistResult,
  InterviewResult,
  KnowledgeRef,
  ReasonerConfigStatus,
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
  // SCRUM-164: optionales ModelRun-Protokoll. Ohne Repo → No-op (rückwärtskompatibel).
  private readonly modelRuns: ModelRunRepo | undefined;

  constructor(
    primary?: ReasonerProvider,
    fallback: ReasonerProvider = new DeterministicProvider(),
    modelRuns?: ModelRunRepo,
  ) {
    this.primary = primary ?? fallback;
    this.fallback = fallback;
    this.modelRuns = modelRuns;
  }

  private usingPrimary(): boolean {
    return this.primary.isAvailable() && this.primary !== this.fallback;
  }

  // SCRUM-164: führt eine Reasoner-Task aus (primary → bei Fehler deterministischer Fallback)
  // und protokolliert sie als ModelRunRecord (nur Metadaten, kein Prompt-/Antworttext).
  // Verhalten gegenüber den bisherigen Methoden ist unverändert (gleiche Ergebnisse/Fehler).
  private async runTask<T extends { demo: boolean }>(
    task: ModelRunTask,
    locale: ReasonerLocale,
    primaryFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
  ): Promise<T> {
    const startedAt = new Date().toISOString();
    const usePrimary = this.usingPrimary();
    let fallback = false;
    let result: T;
    try {
      if (usePrimary) {
        try {
          result = await primaryFn();
        } catch {
          fallback = true;
          result = await fallbackFn();
        }
      } else {
        result = await fallbackFn();
      }
    } catch (err) {
      await this.recordRun(task, locale, startedAt, "error", {
        fallback,
        demo: true,
        provider: this.fallback.name,
        error: err instanceof Error ? err.message : "unknown",
      });
      throw err;
    }
    const fromPrimary = usePrimary && !fallback;
    await this.recordRun(task, locale, startedAt, "success", {
      fallback,
      demo: result.demo,
      provider: fromPrimary ? this.primary.name : this.fallback.name,
      ...(fromPrimary ? { model: this.primary.name } : {}),
    });
    return result;
  }

  private async recordRun(
    task: ModelRunTask,
    locale: ReasonerLocale,
    startedAt: string,
    status: ModelRunStatus,
    extra: { fallback: boolean; demo: boolean; provider: string; model?: string; error?: string },
  ): Promise<void> {
    if (!this.modelRuns) {
      return;
    }
    await this.modelRuns.append({
      id: randomUUID(),
      task,
      provider: extra.provider,
      demo: extra.demo,
      fallback: extra.fallback,
      locale,
      startedAt,
      finishedAt: new Date().toISOString(),
      status,
      ...(extra.error ? { error: extra.error } : {}),
      ...(extra.model ? { model: extra.model } : {}),
    });
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

  // SCRUM-166: read-only Provider-/Model-Konfiguration. Nur Metadaten — keine Secrets,
  // keine Prompt-/Antwortinhalte. Ohne konfiguriertes Modell ehrlich Demo-Modus.
  configStatus(): ReasonerConfigStatus {
    const configured = this.usingPrimary();
    return {
      provider: configured ? this.primary.name : this.fallback.name,
      ...(configured ? { model: this.primary.name } : {}),
      configured,
      mode: configured ? "model" : "demo",
      fallbackAvailable: true,
      supportsLocales: ["de", "en"],
      tasks: ["structure", "assist", "interview", "answer", "select"],
    };
  }

  // FR-RSN-04/FR-I18N-01: Modellfehler dürfen den Betrieb nicht stoppen → deterministischer
  // Fallback. locale wird an primary UND fallback identisch durchgereicht (Default "de").
  async structure(rawText: string, locale: ReasonerLocale = "de"): Promise<StructureResult> {
    return this.runTask(
      "structure",
      locale,
      () => this.primary.structure(rawText, locale),
      () => this.fallback.structure(rawText, locale),
    );
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
    return this.runTask(
      "assist",
      locale,
      () => this.primary.assistText(text, locale),
      () => this.fallback.assistText(text, locale),
    );
  }

  // SCRUM-132: reasoner-getriebenes Interview; Modellfehler → deterministischer Fallback.
  async interview(
    answers: readonly string[],
    locale: ReasonerLocale = "de",
  ): Promise<InterviewResult> {
    return this.runTask(
      "interview",
      locale,
      () => this.primary.interview(answers, locale),
      () => this.fallback.interview(answers, locale),
    );
  }

  select(question: string, candidates: readonly KnowledgeRef[]): KnowledgeRef[] {
    const provider = this.usingPrimary() ? this.primary : this.fallback;
    return provider.select(question, candidates);
  }
}
