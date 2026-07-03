import { randomUUID } from "node:crypto";
import type { ModelRunRepo, ModelRunStatus, ModelRunTask } from "../../model-runs";
import {
  type AssistPreset,
  type AssistPresetInput,
  type AssistPresetRepo,
  InMemoryAssistPresetRepo,
  normalizeAssistPresets,
} from "./presets";
import { DeterministicProvider, type ReasonerProvider, honestExtractModelFailed } from "./provider";

import type {
  AnswerResult,
  AssistResult,
  ExtractResult,
  InterviewResult,
  KnowledgeRef,
  ReasonerConfigStatus,
  ReasonerLocale,
  ReasonerProbeResult,
  ReasonerStatus,
  ReasonerTaskChoice,
  ReasonerTaskConfig,
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
  // SCRUM-386: kundeneigene Assist-Presets — echtes Repo (Pg/Dev-Journal); ohne Repo In-Memory.
  private readonly presetRepo: AssistPresetRepo;

  constructor(
    primary?: ReasonerProvider,
    fallback: ReasonerProvider = new DeterministicProvider(),
    modelRuns?: ModelRunRepo,
    assistPresets?: AssistPresetRepo,
  ) {
    this.primary = primary ?? fallback;
    this.fallback = fallback;
    this.modelRuns = modelRuns;
    this.presetRepo = assistPresets ?? new InMemoryAssistPresetRepo();
  }

  // ---- SCRUM-386: kundeneigene KI-Assist-Funktionen (Presets) ----
  // Lesen darf jede Rolle (die Palette zeigt sie an); Schreiben guarded die Route (Admin).
  // Replace-Semantik: die Admin-UI pflegt die komplette Liste; ids bleiben stabil, neue
  // Einträge bekommen hier ihre UUID (das Repo erhält fertige ids — Journal-Replay exakt).
  async getAssistPresets(): Promise<AssistPreset[]> {
    return this.presetRepo.list();
  }

  async setAssistPresets(input: readonly AssistPresetInput[]): Promise<AssistPreset[]> {
    const next = normalizeAssistPresets(input, () => randomUUID());
    await this.presetRepo.replaceAll(next);
    return this.presetRepo.list();
  }

  private usingPrimary(): boolean {
    return this.primary.isAvailable() && this.primary !== this.fallback;
  }

  // Key-Test (Pedi 02.07.): ehrlicher Echtaufruf statt Anzeige-Vermutung. Ohne Modell
  // klarer Befund; Fehler werden benannt (z. B. 401 = Schlüssel ungültig), nie geraten.
  // Kein Fallback-Umweg: der Test prüft GENAU den konfigurierten Modellzugang.
  async probe(): Promise<ReasonerProbeResult> {
    const at = new Date().toISOString();
    if (!this.usingPrimary() || typeof this.primary.probe !== "function") {
      return {
        ok: false,
        provider: this.fallback.name,
        mode: "deterministic",
        detail: "Kein Modell konfiguriert — es läuft der deterministische Ersatzmodus.",
        at,
      };
    }
    try {
      await this.primary.probe();
      return {
        ok: true,
        provider: this.primary.name,
        mode: "model",
        detail: "Modell hat geantwortet.",
        at,
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.primary.name,
        mode: "model",
        detail: error instanceof Error ? error.message : String(error),
        at,
      };
    }
  }

  // ---- KI-Verwaltung v1 (Teil-Slice, 02.07.2026): Zuordnung global + je Aufgabe ----
  // Bewusst OHNE Persistenz (gilt bis Neustart): kein neuer Speicherpfad kurz vor dem
  // Beta-RC; der Voll-Ausbau (PMO-Eintrag "KI-Management-Seite") bringt Repo+Persistenz.
  private taskConfig: ReasonerTaskConfig = { global: "auto", perTask: {} };

  getTaskConfig(): ReasonerTaskConfig {
    return { global: this.taskConfig.global, perTask: { ...this.taskConfig.perTask } };
  }

  setTaskConfig(next: ReasonerTaskConfig): ReasonerTaskConfig {
    const valid: ReasonerTaskChoice[] = ["auto", "model", "deterministic"];
    const tasks = ["structure", "assist", "interview", "answer", "select", "extract"] as const;
    if (!valid.includes(next.global)) {
      throw new Error("Ungültige globale KI-Zuordnung.");
    }
    const perTask: ReasonerTaskConfig["perTask"] = {};
    for (const task of tasks) {
      const c = next.perTask?.[task];
      if (c === undefined) continue;
      if (!valid.includes(c)) {
        throw new Error(`Ungültige KI-Zuordnung für Aufgabe '${task}'.`);
      }
      perTask[task] = c;
    }
    this.taskConfig = { global: next.global, perTask };
    return this.getTaskConfig();
  }

  private choiceFor(task: ModelRunTask): ReasonerTaskChoice {
    return this.taskConfig.perTask[task] ?? this.taskConfig.global;
  }

  // Effektiver Modus je Aufgabe — ehrlich: "model" nur, wenn gewollt UND verfügbar.
  private effectiveFor(task: ModelRunTask): "model" | "deterministic" {
    const choice = this.choiceFor(task);
    if (choice === "deterministic") return "deterministic";
    return this.usingPrimary() ? "model" : "deterministic";
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
    // KI-Verwaltung v1: bewusste Zuordnung je Aufgabe schlägt die Automatik.
    const usePrimary = this.effectiveFor(task) === "model";
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
    locale: ReasonerLocale | undefined,
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
      ...(locale ? { locale } : {}),
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
      tasks: ["structure", "assist", "interview", "answer", "select", "extract"],
      taskConfig: this.getTaskConfig(),
      effective: Object.fromEntries(
        (["structure", "assist", "interview", "answer", "select", "extract"] as const).map(
          (task) => [task, this.effectiveFor(task)],
        ),
      ),
      persisted: false,
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

  // SCRUM-167: Ask-/Antwortpfad ebenfalls über runTask protokolliert (nur Metadaten).
  async answer(
    question: string,
    context: readonly KnowledgeRef[],
    locale: ReasonerLocale = "de",
  ): Promise<AnswerResult> {
    return this.runTask(
      "answer",
      locale,
      () => this.primary.answer(question, context, locale),
      () => this.fallback.answer(question, context, locale),
    );
  }

  // FR-RSN-03: Text präzisieren; Modellfehler → deterministischer Fallback.
  async assistText(
    text: string,
    locale: ReasonerLocale = "de",
    instruction?: string,
  ): Promise<AssistResult> {
    return this.runTask(
      "assist",
      locale,
      () => this.primary.assistText(text, locale, instruction),
      () => this.fallback.assistText(text, locale, instruction),
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

  // PMO-FEA-0006: Wissenspunkte aus Dokumenttext extrahieren (optional mit Suchauftrag).
  // Ohne Modell/bei Modellfehler → ehrlicher Fallback (keine Punkte + note), G-2/FR-RSN-04.
  async extract(
    documentText: string,
    locale: ReasonerLocale = "de",
    query?: string,
  ): Promise<ExtractResult> {
    // SCRUM-411 (Pedi-Test 03.07.): Scheitert der Modell-Aufruf, obwohl ein Modell gewollt
    // UND konfiguriert ist, bekommt der Nutzer den ECHTEN Grund — nicht die falsche
    // „kein KI-Modell"-Meldung des deterministischen Fallbacks. G-2 bleibt: keine Pseudo-Punkte.
    let modelError: string | null = null;
    const wantedModel = this.effectiveFor("extract") === "model";
    return this.runTask(
      "extract",
      locale,
      async () => {
        try {
          return await this.primary.extract(documentText, locale, query);
        } catch (error) {
          modelError = error instanceof Error ? error.message : String(error);
          throw error;
        }
      },
      async () => {
        const honest = await this.fallback.extract(documentText, locale, query);
        return wantedModel && modelError !== null
          ? honestExtractModelFailed(modelError, locale)
          : honest;
      },
    );
  }

  // SCRUM-167: select bleibt synchron (reines Keyword-Ranking, kein Modell-/Netzaufruf).
  // ModelRun wird fire-and-forget protokolliert; demo=true, kein Fallback-Pfad. Nur Metadaten.
  select(question: string, candidates: readonly KnowledgeRef[]): KnowledgeRef[] {
    const usePrimary = this.usingPrimary();
    const provider = usePrimary ? this.primary : this.fallback;
    const startedAt = new Date().toISOString();
    try {
      const result = provider.select(question, candidates);
      this.logSelect(startedAt, provider.name, "success");
      return result;
    } catch (err) {
      this.logSelect(
        startedAt,
        provider.name,
        "error",
        err instanceof Error ? err.message : "unknown",
      );
      throw err;
    }
  }

  // Fire-and-forget-Protokollierung für das synchrone select (kein await im sync-Pfad).
  private logSelect(
    startedAt: string,
    provider: string,
    status: ModelRunStatus,
    error?: string,
  ): void {
    void this.recordRun("select", undefined, startedAt, status, {
      fallback: false,
      demo: true, // deterministisches Keyword-Ranking, kein echtes Modell
      provider,
      ...(error ? { error } : {}),
    }).catch(() => undefined);
  }
}
