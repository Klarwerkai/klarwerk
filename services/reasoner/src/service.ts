import { randomUUID } from "node:crypto";
import type { ModelRunRepo, ModelRunStatus, ModelRunTask } from "../../model-runs";
import { ModelCapacityError } from "./model-concurrency";
import {
  type AssistPreset,
  type AssistPresetInput,
  type AssistPresetRepo,
  InMemoryAssistPresetRepo,
  normalizeAssistPresets,
} from "./presets";
import { DeterministicProvider, type ReasonerProvider, honestExtractModelFailed } from "./provider";
import { InMemoryReasonerPolicyRepo, type ReasonerPolicyRepo } from "./reasoner-policy";

import type {
  AnswerResult,
  AssistResult,
  ConflictJudgeResult,
  DuplicateJudgeResult,
  EnrichResult,
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

// SCRUM-525 P.5 (WP6): der DEFINIERTE Default der KI-Zuordnung, wenn nichts persistiert ist. Exportiert,
// damit Aufrufer/Tests den Default benennen können (kein magisches, verstecktes "auto").
export const DEFAULT_REASONER_POLICY: ReasonerTaskConfig = { global: "auto", perTask: {} };

function clone(config: ReasonerTaskConfig): ReasonerTaskConfig {
  return { global: config.global, perTask: { ...config.perTask } };
}

// FR-RSN-01: gebündelte Aufgaben über die Reasoner-Schicht.
// FR-RSN-06: der KI-Schlüssel lebt ausschließlich im Provider (serverseitig),
// der Reasoner reicht ihn nie nach außen — Status/Ergebnisse enthalten keinen Schlüssel.
export class Reasoner {
  private readonly primary: ReasonerProvider;
  // SCRUM-424: der eigene lokale LLM als zweites echtes Backend (Cloud + lokal). Ohne
  // Angabe = deterministischer Fallback (dann gibt es effektiv nur Cloud + Ersatzmodus).
  private readonly secondary: ReasonerProvider;
  private readonly fallback: ReasonerProvider;
  // SCRUM-164: optionales ModelRun-Protokoll. Ohne Repo → No-op (rückwärtskompatibel).
  private readonly modelRuns: ModelRunRepo | undefined;
  // SCRUM-386: kundeneigene Assist-Presets — echtes Repo (Pg/Dev-Journal); ohne Repo In-Memory.
  private readonly presetRepo: AssistPresetRepo;
  // SCRUM-525 P.5 (WP6): persistente KI-Zuordnung (Policy). Ohne Repo In-Memory (Tests/Dev).
  private readonly policyRepo: ReasonerPolicyRepo;

  constructor(
    primary?: ReasonerProvider,
    fallback: ReasonerProvider = new DeterministicProvider(),
    modelRuns?: ModelRunRepo,
    assistPresets?: AssistPresetRepo,
    // SCRUM-424: optionaler zweiter Provider (eigener lokaler LLM). Als LETZTER Parameter,
    // damit bestehende (positionale) Aufrufe unverändert bleiben.
    secondary?: ReasonerProvider,
    // SCRUM-525 P.5 (WP6): optionales Policy-Repo. Als LETZTER Parameter — bestehende positionale
    // Aufrufe bleiben unverändert. Ohne Repo → In-Memory (Policy lebt nur für die Prozesslaufzeit).
    policyRepo?: ReasonerPolicyRepo,
  ) {
    this.primary = primary ?? fallback;
    this.secondary = secondary ?? fallback;
    this.fallback = fallback;
    this.modelRuns = modelRuns;
    this.presetRepo = assistPresets ?? new InMemoryAssistPresetRepo();
    this.policyRepo = policyRepo ?? new InMemoryReasonerPolicyRepo();
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

  // SCRUM-424: ist der eigene lokale LLM verdrahtet & verfügbar (kein Alias auf den Fallback)?
  private usingSecondary(): boolean {
    return this.secondary.isAvailable() && this.secondary !== this.fallback;
  }

  // SCRUM-424: geordnete Provider-Kette je Aufgabe aus der bewussten Zuordnung.
  //  - "auto"                Cloud → lokal → deterministisch (verfügbare in dieser Reihenfolge)
  //  - "cloud"/"model"       Cloud (dann deterministisch)
  //  - "local"               lokaler LLM (dann deterministisch)
  //  - "deterministic"       nur deterministisch
  // Der deterministische Fallback ist IMMER das letzte Glied (FR-RSN-04, antwortet stets).
  // SCRUM-502 Schicht 2: `confidential` = der Eingabetext (KO/Draft) ist vertraulich → die Cloud
  // (this.primary) wird aus der Kette GENOMMEN. Vertraulicher Text verlässt den Server nie extern;
  // es bleibt der lokale LLM (falls verdrahtet) und/oder der deterministische Fallback. Die
  // Durchsetzung liegt hier zentral am Routing, damit kein Aufrufer sie vergessen kann.
  private providerChain(task: ModelRunTask, confidential = false): ReasonerProvider[] {
    const choice = this.choiceFor(task);
    const chain: ReasonerProvider[] = [];
    if (choice !== "deterministic") {
      if (
        !confidential &&
        (choice === "auto" || choice === "cloud" || choice === "model") &&
        this.usingPrimary()
      ) {
        chain.push(this.primary);
      }
      // SCRUM-502 Round 4 (P1): vertraulich schließt die Cloud aus, ABER der lokale LLM (on-prem, kein
      // externer Egress) darf einspringen — auch bei expliziter cloud/model-Wahl. So degradiert
      // vertraulicher Text nicht unnötig auf „deterministisch", wenn ein lokales Modell verdrahtet ist.
      if ((choice === "auto" || choice === "local" || confidential) && this.usingSecondary()) {
        chain.push(this.secondary);
      }
    }
    chain.push(this.fallback);
    return chain;
  }

  // Welche KI läuft je Aufgabe EFFEKTIV zuerst (für die ehrliche Anzeige).
  private providerLabelFor(task: ModelRunTask): "cloud" | "local" | "deterministic" {
    const first = this.providerChain(task)[0];
    if (first === this.primary && this.usingPrimary()) {
      return "cloud";
    }
    if (first === this.secondary && this.usingSecondary()) {
      return "local";
    }
    return "deterministic";
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

  // SCRUM-428: Key-Test für den EIGENEN lokalen LLM (secondary) — echter Mini-Aufruf über den
  // Tunnel/OpenAI-kompatiblen Endpoint. Ehrlich: nicht verdrahtet → klarer Befund; erreichbar
  // → „geantwortet"; Tunnel/Server aus → der echte Fehler (nie geraten).
  async probeLocal(): Promise<ReasonerProbeResult> {
    const at = new Date().toISOString();
    if (!this.usingSecondary() || typeof this.secondary.probe !== "function") {
      return {
        ok: false,
        provider: this.secondary.name,
        mode: "deterministic",
        detail: "Kein lokaler LLM verdrahtet (KLARWERK_LOCAL_LLM_URL/_MODEL setzen).",
        at,
      };
    }
    try {
      await this.secondary.probe();
      return {
        ok: true,
        provider: this.secondary.name,
        mode: "model",
        detail: "Lokaler LLM hat geantwortet.",
        at,
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.secondary.name,
        mode: "model",
        detail: error instanceof Error ? error.message : String(error),
        at,
      };
    }
  }

  // ---- KI-Verwaltung v1 (Teil-Slice, 02.07.2026): Zuordnung global + je Aufgabe ----
  // Bewusst OHNE Persistenz (gilt bis Neustart): kein neuer Speicherpfad kurz vor dem
  // Beta-RC; der Voll-Ausbau (PMO-Eintrag "KI-Management-Seite") bringt Repo+Persistenz.
  // SCRUM-525 P.5 (WP6): der DEFINIERTE Default, wenn NICHTS persistiert ist. "auto" bleibt die
  // fachlich gewollte Standard-Kette (Cloud → lokal → deterministisch) — aber beim Start wird bewusst
  // GELOGGT, dass er greift, weil keine Policy konfiguriert ist (kein STILLER Auto-Fallback).
  private taskConfig: ReasonerTaskConfig = clone(DEFAULT_REASONER_POLICY);

  getTaskConfig(): ReasonerTaskConfig {
    return { global: this.taskConfig.global, perTask: { ...this.taskConfig.perTask } };
  }

  // Validiert eine Policy und normalisiert sie (nur bekannte Tasks/Choices). Wirft bei Ungültigem.
  private normalizeTaskConfig(next: ReasonerTaskConfig): ReasonerTaskConfig {
    const valid: ReasonerTaskChoice[] = ["auto", "model", "cloud", "local", "deterministic"];
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
    return { global: next.global, perTask };
  }

  // SCRUM-525 P.5 (WP6): setzt die Policy UND PERSISTIERT sie — sie überlebt jetzt Neustart/Deploy.
  async setTaskConfig(next: ReasonerTaskConfig): Promise<ReasonerTaskConfig> {
    this.taskConfig = this.normalizeTaskConfig(next);
    await this.policyRepo.set(this.taskConfig);
    return this.getTaskConfig();
  }

  // SCRUM-525 P.5 (WP6): beim Start die persistierte Policy laden. Ist eine gespeichert → sie greift
  // (die Admin-Entscheidung überlebt den Deploy). Ist KEINE gespeichert → der DEFINIERTE Default greift
  // und der Aufrufer bekommt `source: "default"` gemeldet, um es EHRLICH zu loggen (kein stiller Auto-
  // Fallback). Persistiert dabei NICHTS (ein Boot schreibt nicht; erst eine echte Admin-Setzung tut das).
  async loadPersistedPolicy(): Promise<{
    source: "persisted" | "default";
    config: ReasonerTaskConfig;
  }> {
    const stored = await this.policyRepo.get();
    if (stored) {
      // Defensive Normalisierung: auch ein (theoretisch) fremd-manipulierter Datensatz wird geprüft.
      this.taskConfig = this.normalizeTaskConfig(stored);
      return { source: "persisted", config: this.getTaskConfig() };
    }
    this.taskConfig = clone(DEFAULT_REASONER_POLICY);
    return { source: "default", config: this.getTaskConfig() };
  }

  private choiceFor(task: ModelRunTask): ReasonerTaskChoice {
    return this.taskConfig.perTask[task] ?? this.taskConfig.global;
  }

  // Effektiver Modus je Aufgabe — ehrlich: "model" nur, wenn ein echtes Modell (Cloud ODER
  // lokal) zuerst arbeitet. SCRUM-424: leitet sich aus der Provider-Kette ab.
  private effectiveFor(task: ModelRunTask): "model" | "deterministic" {
    return this.providerChain(task)[0] !== this.fallback ? "model" : "deterministic";
  }

  // SCRUM-164/424: führt eine Reasoner-Task entlang der Provider-Kette aus (Cloud → lokal →
  // deterministisch, je nach Zuordnung) und protokolliert sie als ModelRunRecord (nur
  // Metadaten, kein Prompt-/Antworttext). Der erste Provider, der OHNE Fehler antwortet,
  // gewinnt; jeder Fehler fällt still zum nächsten Glied. Das letzte Glied (deterministisch)
  // antwortet immer, daher ist der Erfolg garantiert.
  private async runTask<T extends { demo: boolean }>(
    task: ModelRunTask,
    locale: ReasonerLocale,
    run: (provider: ReasonerProvider) => Promise<T>,
    // SCRUM-502 Schicht 2: vertraulicher Eingabetext → Cloud aus der Kette (siehe providerChain).
    confidential = false,
  ): Promise<T> {
    const startedAt = new Date().toISOString();
    const chain = this.providerChain(task, confidential);
    let lastError: unknown;
    for (let i = 0; i < chain.length; i++) {
      const provider = chain[i];
      if (!provider) {
        continue;
      }
      try {
        const result = await run(provider);
        const fromModel = provider !== this.fallback;
        await this.recordRun(task, locale, startedAt, "success", {
          fallback: i > 0,
          demo: result.demo,
          provider: provider.name,
          ...(fromModel ? { model: provider.name } : {}),
        });
        return result;
      } catch (err) {
        // SCRUM-498 B2: Backpressure ist KEIN Provider-Fehler — nicht auf den deterministischen
        // Fallback ausweichen, sondern durchreichen (die HTTP-Schicht macht daraus 503 + Retry-After).
        if (err instanceof ModelCapacityError) {
          throw err;
        }
        lastError = err;
      }
    }
    await this.recordRun(task, locale, startedAt, "error", {
      fallback: chain.length > 1,
      demo: true,
      provider: this.fallback.name,
      error: lastError instanceof Error ? lastError.message : "unknown",
    });
    throw lastError ?? new Error("Kein Provider verfügbar.");
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

  // SCRUM-424: ein echtes Modell ist verfügbar, wenn Cloud ODER lokal verdrahtet ist.
  // Das aktive Anzeige-Modell bevorzugt die Cloud (Rückwärtskompatibilität), sonst lokal.
  private usingAnyModel(): boolean {
    return this.usingPrimary() || this.usingSecondary();
  }

  private activeModelProvider(): ReasonerProvider {
    if (this.usingPrimary()) {
      return this.primary;
    }
    if (this.usingSecondary()) {
      return this.secondary;
    }
    return this.fallback;
  }

  // FR-RSN-05: server-echte Statusanzeige (aktiv, wenn IRGENDEIN Modell verfügbar ist).
  status(): ReasonerStatus {
    const active = this.usingAnyModel();
    return {
      active,
      provider: this.activeModelProvider().name,
      mode: active ? "model" : "deterministic",
    };
  }

  // SCRUM-166: read-only Provider-/Model-Konfiguration. Nur Metadaten — keine Secrets,
  // keine Prompt-/Antwortinhalte. Ohne konfiguriertes Modell ehrlich Demo-Modus.
  configStatus(): ReasonerConfigStatus {
    const configured = this.usingAnyModel();
    const activeModel = this.activeModelProvider();
    return {
      provider: configured ? activeModel.name : this.fallback.name,
      ...(configured ? { model: activeModel.name } : {}),
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
      // SCRUM-424: der eigene lokale LLM + welche KI je Aufgabe zuerst arbeitet.
      cloudConfigured: this.usingPrimary(),
      localConfigured: this.usingSecondary(),
      ...(this.usingSecondary() ? { localProvider: this.secondary.name } : {}),
      effectiveProvider: Object.fromEntries(
        (["structure", "assist", "interview", "answer", "select", "extract"] as const).map(
          (task) => [task, this.providerLabelFor(task)],
        ),
      ),
      persisted: false,
    };
  }

  // FR-RSN-04/FR-I18N-01: Modellfehler dürfen den Betrieb nicht stoppen → deterministischer
  // Fallback. locale wird an primary UND fallback identisch durchgereicht (Default "de").
  // SCRUM-502 Schicht 2: `confidential` route vertrauliche Drafts/KOs an der Cloud vorbei
  // (lokal/deterministisch). Default false = unverändertes Verhalten für nicht-vertraulichen Text.
  async structure(
    rawText: string,
    locale: ReasonerLocale = "de",
    confidential = false,
  ): Promise<StructureResult> {
    return this.runTask(
      "structure",
      locale,
      (p) => p.structure(rawText, locale, confidential),
      confidential,
    );
  }

  // SCRUM-167: Ask-/Antwortpfad ebenfalls über runTask protokolliert (nur Metadaten).
  async answer(
    question: string,
    context: readonly KnowledgeRef[],
    locale: ReasonerLocale = "de",
  ): Promise<AnswerResult> {
    return this.runTask("answer", locale, (p) => p.answer(question, context, locale));
  }

  // SCRUM-490 R2 (B1): RETRIEVAL-ONLY-Antwort für den Add-on-Pfad (Klara). Der Eingabetext ist der
  // (vertrauliche) Dokumenttext → er darf NIE synthetisiert/egress werden. Deshalb NICHT über die
  // Provider-Kette (Cloud/Local könnten den Text ans Modell geben), sondern AUSSCHLIESSLICH über den
  // deterministischen (lexikalischen) Fallback gegen den bereits gefilterten (validiert, nicht-
  // vertraulich) Kontext. Es findet KEIN Modell-/Embedder-Call statt (kein Egress). Kein Treffer →
  // answered:false, sources:[] (ehrlich leer, koppelt A2). Die Quelle ist immer die genutzte KO-ID.
  async answerRetrievalOnly(
    question: string,
    context: readonly KnowledgeRef[],
    locale: ReasonerLocale = "de",
  ): Promise<AnswerResult> {
    return this.fallback.answer(question, context, locale);
  }

  // FR-RSN-03: Text präzisieren; Modellfehler → deterministischer Fallback.
  async assistText(
    text: string,
    locale: ReasonerLocale = "de",
    instruction?: string,
    // SCRUM-502 Schicht 2: vertraulicher Draft/KO → Cloud aus der Kette.
    confidential = false,
  ): Promise<AssistResult> {
    return this.runTask(
      "assist",
      locale,
      (p) => p.assistText(text, locale, instruction, confidential),
      confidential,
    );
  }

  // SCRUM-132: reasoner-getriebenes Interview; Modellfehler → deterministischer Fallback.
  async interview(
    answers: readonly string[],
    locale: ReasonerLocale = "de",
    // SCRUM-502 Schicht 2: vertraulicher Draft → Cloud aus der Kette.
    confidential = false,
  ): Promise<InterviewResult> {
    return this.runTask(
      "interview",
      locale,
      (p) => p.interview(answers, locale, confidential),
      confidential,
    );
  }

  // PMO-FEA-0006: Wissenspunkte aus Dokumenttext extrahieren (optional mit Suchauftrag).
  // Ohne Modell/bei Modellfehler → ehrlicher Fallback (keine Punkte + note), G-2/FR-RSN-04.
  async extract(
    documentText: string,
    locale: ReasonerLocale = "de",
    query?: string,
    // SCRUM-451: true = Ergebnis in der Sprache des Dokuments lassen (nichts übersetzen).
    keepSourceLanguage = false,
    // SCRUM-502 Schicht 2: vertraulicher Dokumenttext/KO → Cloud aus der Kette.
    confidential = false,
  ): Promise<ExtractResult> {
    // SCRUM-411 (Pedi-Test 03.07.): Scheitert der Modell-Aufruf, obwohl ein Modell gewollt
    // UND konfiguriert ist, bekommt der Nutzer den ECHTEN Grund — nicht die falsche
    // „kein KI-Modell"-Meldung des deterministischen Fallbacks. G-2 bleibt: keine Pseudo-Punkte.
    // SCRUM-424: der letzte Modellfehler der Kette (Cloud und/oder lokal) wird gemerkt, damit
    // der deterministische Abschluss den ECHTEN Grund melden kann statt „kein KI-Modell".
    let modelError: string | null = null;
    const wantedModel = this.effectiveFor("extract") === "model";
    return this.runTask(
      "extract",
      locale,
      async (provider) => {
        if (provider === this.fallback) {
          const honest = await this.fallback.extract(
            documentText,
            locale,
            query,
            keepSourceLanguage,
          );
          return wantedModel && modelError !== null
            ? honestExtractModelFailed(modelError, locale)
            : honest;
        }
        try {
          return await provider.extract(
            documentText,
            locale,
            query,
            keepSourceLanguage,
            confidential,
          );
        } catch (error) {
          modelError = error instanceof Error ? error.message : String(error);
          throw error;
        }
      },
      confidential,
    );
  }

  // Klara Stufe 2 (Pedi 05.07.): generierende Hilfe-Antwort aus der Hilfe-Wissensdatenbank.
  // Laeuft ueber die answer-Task-Zuordnung (Admin steuert intern/extern/deterministisch mit).
  // Kann der aktive Provider nicht generieren (deterministischer Fallback), greift ehrlich
  // dessen strikte answer()-Zitierlogik — nie stilles Raten.
  async helpAnswer(
    question: string,
    context: readonly KnowledgeRef[],
    locale: ReasonerLocale = "de",
  ): Promise<AnswerResult> {
    return this.runTask("answer", locale, (p) =>
      p.helpAnswer ? p.helpAnswer(question, context, locale) : p.answer(question, context, locale),
    );
  }

  // SCRUM-426: Public-KI-Anreicherung — externer Modell-Beitrag (Weltwissen). Nur echte
  // Modelle (Cloud → lokal) können das; ohne Modell ehrlich leer (demo=true, kein Erfinden).
  // Das Ergebnis ist IMMER extern/ungeprüft; die Freigabe (Stufe „offen") prüft die Route.
  async enrichPublic(query: string, locale: ReasonerLocale = "de"): Promise<EnrichResult> {
    for (const provider of [this.primary, this.secondary]) {
      if (provider === this.fallback || !provider.isAvailable() || !provider.enrichPublic) {
        continue;
      }
      try {
        const result = await provider.enrichPublic(query, locale);
        if (result.text.trim().length > 0) {
          return result;
        }
      } catch {
        // nächstes Modell versuchen
      }
    }
    return {
      text: "",
      provider: this.fallback.name,
      demo: true,
    };
  }

  // Berater-Konzept 04.07. (Stufe 2, kon-v1): „Konfliktprüfung" — urteilt inhaltlich, ob zwei
  // Kerntexte einander widersprechen/doppeln/überholen (Cloud → lokal). Ohne echtes Modell ehrlich
  // null (kein regelbasierter Pseudo-Detektor). Kaputte Antworten liefert schon der Provider als null.
  async judgeConflict(
    coreA: string,
    coreB: string,
    locale: ReasonerLocale = "de",
  ): Promise<ConflictJudgeResult | null> {
    for (const provider of [this.primary, this.secondary]) {
      if (provider === this.fallback || !provider.isAvailable() || !provider.judgeConflict) {
        continue;
      }
      try {
        const result = await provider.judgeConflict(coreA, coreB, locale);
        if (result) {
          return result;
        }
      } catch (err) {
        if (err instanceof ModelCapacityError) {
          throw err; // Backpressure durchreichen (→ 503), nicht als Modellfehler still schlucken.
        }
        // nächstes Modell versuchen
      }
    }
    return null;
  }

  // Berater-Konzept Duplikate 04.07. (Stufe D2, dup-v1): „Duplikatprüfung" — Überschneidungs-Profil
  // zweier Kerntexte (Cloud → lokal). Ohne echtes Modell ehrlich null. Kaputte Antworten liefert
  // schon der Provider als null.
  async judgeDuplicate(
    coreA: string,
    coreB: string,
    locale: ReasonerLocale = "de",
  ): Promise<DuplicateJudgeResult | null> {
    for (const provider of [this.primary, this.secondary]) {
      if (provider === this.fallback || !provider.isAvailable() || !provider.judgeDuplicate) {
        continue;
      }
      try {
        const result = await provider.judgeDuplicate(coreA, coreB, locale);
        if (result) {
          return result;
        }
      } catch (err) {
        if (err instanceof ModelCapacityError) {
          throw err; // Backpressure durchreichen (→ 503), nicht als Modellfehler still schlucken.
        }
        // nächstes Modell versuchen
      }
    }
    return null;
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
