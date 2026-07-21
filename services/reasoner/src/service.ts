import { randomUUID } from "node:crypto";
import type { ModelRunRepo, ModelRunStatus, ModelRunTask } from "../../model-runs";
import { ModelCapacityError } from "./model-concurrency";
// WP-D10 (Fix 3): Fehlerklasse eines gescheiterten Modellaufrufs (timeout|http|network|parse) für die
// ehrliche Fallback-Ursache und das PII-freie Diagnose-Log.
import { classifyModelFailure } from "./model-errors";
import {
  type AssistPreset,
  type AssistPresetInput,
  type AssistPresetRepo,
  InMemoryAssistPresetRepo,
  normalizeAssistPresets,
} from "./presets";
import {
  DeterministicProvider,
  type ReasonerProvider,
  deterministicCandidateGroups,
  honestExtractModelFailed,
} from "./provider";
import { ModelProvider } from "./provider-model";
import { InMemoryReasonerPolicyRepo, type ReasonerPolicyRepo } from "./reasoner-policy";

import type {
  AnswerResult,
  AssistResult,
  ConflictJudgeResult,
  DescribeImageResult,
  DuplicateJudgeResult,
  EnrichResult,
  ExtractResult,
  GroupCandidateInput,
  GroupCandidatesResult,
  ImportCriteriaResult,
  InterviewResult,
  KnowledgeRef,
  ReasonerConfigStatus,
  ReasonerLocale,
  ReasonerPolicySource,
  ReasonerProbeResult,
  ReasonerStatus,
  ReasonerTaskChoice,
  ReasonerTaskConfig,
  StructureResult,
} from "./types";

// SCRUM-525 P.5 (WP-C): Befund 3(a) — eine per Deploy-ENV gesetzte Policy (KLARWERK_REASONER_POLICY)
// ist eine bewusste, deklarative Vorgabe des Deploys; sie darf NICHT still von einem Admin-Schreibpfad
// zur Laufzeit überschrieben werden (sonst wäre die Deploy-Garantie „läuft mit global=X" aushebelbar,
// ohne dass das Deploy selbst geändert wurde). Eigener Fehlertyp (statt genericher Error), damit die
// Route ihn gezielt auf 409 abbilden kann — mit einer ehrlichen Begründung statt eines stillen No-ops
// oder der generischen 400-Validierungsantwort.
export class ReasonerPolicyLockedError extends Error {
  constructor() {
    super(
      "Die KI-Zuordnung ist per Deploy-Konfiguration (KLARWERK_REASONER_POLICY) festgelegt und kann " +
        "hier nicht geändert werden. Änderungen sind nur über die Deploy-ENV möglich.",
    );
    this.name = "ReasonerPolicyLockedError";
  }
}

// SCRUM-525 P.5 (WP6): der DEFINIERTE Default der KI-Zuordnung, wenn nichts persistiert ist. Exportiert,
// damit Aufrufer/Tests den Default benennen können (kein magisches, verstecktes "auto").
export const DEFAULT_REASONER_POLICY: ReasonerTaskConfig = { global: "auto", perTask: {} };

// SCRUM-525 P.5 (WP3-Batch3): FAIL-CLOSED-Default, wenn die persistierte Policy beim Start NICHT gelesen
// werden kann (DB-Fehler). Bewusst "deterministic" (kein externer Modell-Egress, antwortet immer) statt
// still "auto": lieber KI-Features degradieren als unter UNBEKANNTER Policy ungewollt an die Cloud gehen.
// Der Ladefehler wird zusätzlich LAUT geloggt; sobald die DB wieder erreichbar ist, greift die Admin-Wahl.
export const LOAD_FAILURE_FALLBACK_POLICY: ReasonerTaskConfig = {
  global: "deterministic",
  perTask: {},
};

const VALID_CHOICES: readonly ReasonerTaskChoice[] = [
  "auto",
  "model",
  "cloud",
  "local",
  "deterministic",
];

// WP-BILD-1c: die EINE Task-Liste für Policy-Validierung und KI-Verwaltungs-Anzeige (vorher drei
// Inline-Kopien). "describe" = KI-Bildbeschreibungs-Vorschlag (nur mit Vision-fähigem Cloud-Client).
export const REASONER_TASKS = [
  "structure",
  "assist",
  "interview",
  "answer",
  "select",
  "extract",
  "describe",
  "group",
] as const;

// WP-IC-4: harte Server-Kappung der KI-Gruppierung — mehr Kandidaten je Aufruf lehnt die Route
// mit einer ehrlichen Meldung ab (weiter eingrenzen), statt still zu kappen.
export const MAX_GROUP_CANDIDATES = 200;

// WP-BILD-1c/1f: schneller String-Vorab-Deckel für die describe-Bild-Daten (data:image-URL-Länge in
// Zeichen). AUTORITATIV ist die DEKODIERTE Bytegrenze MAX_DESCRIBE_IMAGE_BYTES (5 MB, bens P3 —
// s. image-validation.ts); dieser Vorab-Deckel liegt deshalb bewusst darüber (~5,25 MB dekodiert)
// und fängt nur grob Überdimensioniertes ab, bevor überhaupt geparst wird.
export const MAX_DESCRIBE_IMAGE_DATAURL_CHARS = 7_000_000;

export function isValidReasonerChoice(value: string): value is ReasonerTaskChoice {
  return (VALID_CHOICES as readonly string[]).includes(value);
}

function clone(config: ReasonerTaskConfig): ReasonerTaskConfig {
  return { global: config.global, perTask: { ...config.perTask } };
}

// IC-3: eng geschnittener, JSON-liefernder System-Prompt für die Import-Auswahl. Das Modell soll aus
// dem Freitext NUR die belegbaren Filter ableiten und AUSSCHLIESSLICH JSON zurückgeben — nichts erfinden.
function importSelectSystem(locale: ReasonerLocale): string {
  const contract =
    '{"themes": string[], "keywords": string[], "authors": string[], ' +
    '"yearFrom": number|null, "yearTo": number|null}';
  return locale === "en"
    ? `You turn a user's free-text import request into selection filters. Respond ONLY with JSON: ${contract}. themes = topic labels, keywords = words to match in title/text, authors = person names, yearFrom/yearTo = time range. Use only what the text clearly states; leave a field empty if unsure. Invent nothing.`
    : `Du wandelst einen Freitext-Importwunsch in Auswahl-Filter um. Antworte AUSSCHLIESSLICH mit JSON: ${contract}. themes = Themen-Labels, keywords = Wörter für Titel/Text-Treffer, authors = Personennamen, yearFrom/yearTo = Zeitraum. Nutze nur, was der Text klar hergibt; lass ein Feld leer, wenn unsicher. Erfinde nichts.`;
}

// IC-3: erstes JSON-Objekt aus einer Modell-Antwort robust herausschneiden (geschwätzige Prosa/Code-
// Fences toleriert). Kein Treffer/kein gültiges JSON → null (der Aufrufer nutzt dann leere Kriterien).
function parseFirstJsonObject(raw: string): unknown | null {
  const start = raw.indexOf("{");
  if (start < 0) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
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
  // SCRUM-525 P.5 (WP-C): Herkunft der AKTUELL wirksamen Policy — merkt sich insbesondere, ob ein
  // ENV-Override aktiv ist (dann lehnt setTaskConfig Schreibversuche ab, s. ReasonerPolicyLockedError).
  // Startwert "default", bis loadPersistedPolicy() (Boot) oder ein erfolgreiches setTaskConfig sie setzt.
  private policySource: ReasonerPolicySource = "default";

  getTaskConfig(): ReasonerTaskConfig {
    return { global: this.taskConfig.global, perTask: { ...this.taskConfig.perTask } };
  }

  // Validiert eine Policy und normalisiert sie (nur bekannte Tasks/Choices). Wirft bei Ungültigem.
  private normalizeTaskConfig(next: ReasonerTaskConfig): ReasonerTaskConfig {
    const valid: ReasonerTaskChoice[] = ["auto", "model", "cloud", "local", "deterministic"];
    const tasks = REASONER_TASKS;
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

  // SCRUM-525 P.5 (WP6 + WP3-Batch3): setzt die Policy UND PERSISTIERT sie. WRITE-THEN-RUNTIME: erst
  // validieren, dann in die DB schreiben, und NUR bei Erfolg den Laufzeitwert aktualisieren. Schlägt der
  // DB-Write fehl, bleibt die Laufzeit-Policy unverändert (kein Drift „Laufzeit gesetzt, DB nicht") und der
  // Fehler wird ehrlich geworfen — der Aufrufer meldet ihn, die alte Zuordnung gilt weiter.
  // SCRUM-525 P.5 (WP-C): Befund 3(a) — solange die aktive Policy aus der Deploy-ENV stammt, lehnt dieser
  // Schreibpfad ab (ReasonerPolicyLockedError, von der Route auf 409 gemappt), STATT sie sofort im
  // laufenden Prozess UND in der DB zu überschreiben. Kein stilles Aushebeln der ENV-Deploy-Garantie.
  async setTaskConfig(next: ReasonerTaskConfig): Promise<ReasonerTaskConfig> {
    if (this.policySource === "env") {
      throw new ReasonerPolicyLockedError();
    }
    const normalized = this.normalizeTaskConfig(next); // wirft bei Ungültigem, bevor irgendetwas passiert
    await this.policyRepo.set(normalized); // ZUERST persistieren …
    this.taskConfig = normalized; // … Laufzeit erst nach erfolgreichem Write
    this.policySource = "db"; // die Laufzeit-Policy ist jetzt die gerade persistierte Admin-Wahl.
    return this.getTaskConfig();
  }

  // SCRUM-525 P.5 (WP6 + WP3-Batch3): beim Start die wirksame Policy bestimmen. PRÄZEDENZ (dokumentiert):
  //   1. ENV-Override KLARWERK_REASONER_POLICY (deklarativ pro Deploy) — TRANSIENT, wird NICHT persistiert;
  //      die persistierte Admin-Wahl bleibt erhalten und greift wieder, sobald die ENV entfernt wird.
  //   2. persistierte Admin-Wahl (überlebt Deploy).
  //   3. definierter Default (auto).
  // Kann die persistierte Wahl NICHT gelesen werden (DB-Fehler), wird NICHT still auf auto gefallen,
  // sondern fail-closed auf LOAD_FAILURE_FALLBACK_POLICY (deterministic) — der Aufrufer meldet
  // `source: "load-error"` und loggt LAUT. Boot schreibt nie in die DB (nur eine echte Admin-Setzung tut das).
  async loadPersistedPolicy(opts?: { envGlobal?: string | undefined }): Promise<{
    source: "env" | "persisted" | "default" | "load-error";
    config: ReasonerTaskConfig;
    detail?: string;
  }> {
    // 1) ENV-Override — deterministisch pro Deploy. Gültig → greift; ungültig → ignorieren + melden.
    const envRaw = opts?.envGlobal?.trim();
    if (envRaw) {
      if (isValidReasonerChoice(envRaw)) {
        this.taskConfig = { global: envRaw, perTask: {} };
        // SCRUM-525 P.5 (WP-C): merkt sich den ENV-Ursprung fürs restliche Prozessleben — setTaskConfig
        // lehnt Admin-Schreibversuche ab, solange dieser Zustand gilt (bis zum nächsten Neustart ohne ENV).
        this.policySource = "env";
        return { source: "env", config: this.getTaskConfig() };
      }
      // Ungültiger ENV-Wert: nicht anwenden, aber ehrlich weiterreichen (Fall-through zu 2/3).
      const detail = `Ungültige KLARWERK_REASONER_POLICY='${envRaw}' — ignoriert.`;
      const fallthrough = await this.loadFromRepoOrFailClosed();
      return { ...fallthrough, detail };
    }
    // 2)/3) persistierte Wahl bzw. Default — inkl. fail-closed bei Lesefehler.
    return this.loadFromRepoOrFailClosed();
  }

  // Liest die persistierte Policy; setzt sie als Laufzeitwert. Fehlt sie → Default (auto). Ein LESEFEHLER
  // (DB) fällt NICHT still auf auto, sondern fail-closed auf deterministic (source "load-error").
  private async loadFromRepoOrFailClosed(): Promise<{
    source: "persisted" | "default" | "load-error";
    config: ReasonerTaskConfig;
    detail?: string;
  }> {
    let stored: ReasonerTaskConfig | null;
    try {
      stored = await this.policyRepo.get();
    } catch (err) {
      this.taskConfig = clone(LOAD_FAILURE_FALLBACK_POLICY);
      // SCRUM-525 P.5 (WP-C): ein Ladefehler ist KEIN ENV-Override — der Schreibpfad bleibt offen, damit
      // ein Admin die Zuordnung setzen kann, sobald die DB wieder erreichbar ist (s. auch server.ts-Log,
      // das hier bewusst KEINE automatische Wiederherstellung mehr verspricht).
      this.policySource = "default";
      return {
        source: "load-error",
        config: this.getTaskConfig(),
        detail: err instanceof Error ? err.message : String(err),
      };
    }
    if (stored) {
      // Defensive Normalisierung: auch ein (theoretisch) fremd-manipulierter Datensatz wird geprüft.
      this.taskConfig = this.normalizeTaskConfig(stored);
      this.policySource = "db";
      return { source: "persisted", config: this.getTaskConfig() };
    }
    this.taskConfig = clone(DEFAULT_REASONER_POLICY);
    this.policySource = "default";
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
      tasks: [...REASONER_TASKS],
      taskConfig: this.getTaskConfig(),
      effective: Object.fromEntries(REASONER_TASKS.map((task) => [task, this.effectiveFor(task)])),
      // SCRUM-424: der eigene lokale LLM + welche KI je Aufgabe zuerst arbeitet.
      cloudConfigured: this.usingPrimary(),
      localConfigured: this.usingSecondary(),
      ...(this.usingSecondary() ? { localProvider: this.secondary.name } : {}),
      effectiveProvider: Object.fromEntries(
        REASONER_TASKS.map((task) => [task, this.providerLabelFor(task)]),
      ),
      persisted: false,
      // SCRUM-525 P.5 (WP-C): additive Eigenschaft — zeigt der Admin-UI, ob die Zuordnung per Deploy-ENV
      // gesperrt ist ("env", PUT liefert 409), aus der DB stammt ("db") oder (noch) Default ist.
      policySource: this.policySource,
    };
  }

  // WP-IC-4: KI-Gruppierung der eingegrenzten Import-Kandidaten (Schritt 4 des Cockpit-Flows).
  // Dieselbe ehrliche Fallback-Mechanik wie structure/describe: das letzte Kettenglied ist die
  // DETERMINISTISCHE Themen-Gruppierung (demo:true) — der Flow bleibt IMMER benutzbar, und
  // fallbackReason unterscheidet no-model / model-timeout / model-error für die ehrliche
  // „Ohne KI gruppiert"-Kennzeichnung. Vertraulichkeits-Routing wie gehabt (vertraulich → nie Cloud).
  async groupCandidates(
    candidates: readonly GroupCandidateInput[],
    locale: ReasonerLocale = "de",
    confidential = false,
  ): Promise<GroupCandidatesResult> {
    const hadModelInChain = this.providerChain("group", confidential).some(
      (p) => p !== this.fallback,
    );
    const failureBox: { current: { err: unknown; provider: string; elapsedMs: number } | null } = {
      current: null,
    };
    const result = await this.runTask<GroupCandidatesResult>(
      "group",
      locale,
      async (p) => {
        if (p === this.fallback || typeof p.groupCandidates !== "function") {
          return { groups: deterministicCandidateGroups(candidates, locale), demo: true };
        }
        const startedMs = Date.now();
        try {
          return await p.groupCandidates(candidates, locale, confidential);
        } catch (err) {
          failureBox.current = { err, provider: p.name, elapsedMs: Date.now() - startedMs };
          throw err;
        }
      },
      confidential,
    );
    if (!result.demo) {
      return result;
    }
    const modelFailure = failureBox.current;
    const failure = modelFailure === null ? null : classifyModelFailure(modelFailure.err);
    const fallbackReason = !hadModelInChain
      ? ("no-model" as const)
      : failure?.failureClass === "timeout"
        ? ("model-timeout" as const)
        : ("model-error" as const);
    return { ...result, fallbackReason };
  }

  // WP-BILD-1c (löst den WP-BILD-1b-TODO ein): KI-Bildbeschreibung als VORSCHLAG. Der ModelClient hat
  // jetzt einen OPTIONALEN Vision-Pfad (completeVision, content als image/text-Block-Array — nur der
  // Anthropic-Cloud-Client implementiert ihn); Provider ohne Bild-Eingang scheitern EHRLICH. Ohne
  // funktionierendes Modell: text null + fallbackReason (dieselbe Ursachen-Unterscheidung wie beim
  // structure-Task) — es entsteht NIE eine Pseudo-Beschreibung, nichts wird automatisch gespeichert.
  async describeImage(
    dataUrl: string,
    locale: ReasonerLocale = "de",
    confidential = false,
  ): Promise<DescribeImageResult> {
    const hadModelInChain = this.providerChain("describe", confidential).some(
      (p) => p !== this.fallback,
    );
    // Box statt let (siehe structure): TS-Narrowing über Closure-Zuweisungen bleibt korrekt.
    const failureBox: { current: { err: unknown; provider: string; elapsedMs: number } | null } = {
      current: null,
    };
    const result = await this.runTask<DescribeImageResult>(
      "describe",
      locale,
      async (p) => {
        if (p === this.fallback || typeof p.describeImage !== "function") {
          // Deterministisch gibt es KEINE Bildbeschreibung — ehrlich leer (demo), nie erfinden.
          return { text: null, demo: true };
        }
        const startedMs = Date.now();
        try {
          return await p.describeImage(dataUrl, locale, confidential);
        } catch (err) {
          failureBox.current = { err, provider: p.name, elapsedMs: Date.now() - startedMs };
          throw err;
        }
      },
      confidential,
    );
    if (!result.demo) {
      return result;
    }
    const modelFailure = failureBox.current;
    const failure = modelFailure === null ? null : classifyModelFailure(modelFailure.err);
    const fallbackReason = !hadModelInChain
      ? ("no-model" as const)
      : failure?.failureClass === "timeout"
        ? ("model-timeout" as const)
        : ("model-error" as const);
    return { ...result, fallbackReason };
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
    // WP-D8 (Pedis Live-ROT B): VOR dem Lauf festhalten, ob überhaupt ein Modell in der Kette steht —
    // damit ein demo-Ergebnis hinterher EHRLICH begründet werden kann (kein Modell konfiguriert/aktiv
    // vs. Modell versucht, aber gescheitert). Die UI zeigt die Ursache statt nur eines FALLBACK-Badges.
    const hadModelInChain = this.providerChain("structure", confidential).some(
      (p) => p !== this.fallback,
    );
    // WP-D10 (Fix 3): den LETZTEN Modellfehler der Kette samt Dauer festhalten (gleiches Muster wie
    // extract) — runTask fällt still zum nächsten Glied, aber die Diagnose braucht Klasse/Status/elapsed.
    // Zum Timeout selbst: das Zeitlimit ist DEFAULT_MODEL_TIMEOUT_MS = 30 000 ms (Override nur bewusst
    // per REASONER_TIMEOUT_MS) — nicht unter 30 s, wird hier NICHT blind erhöht; elapsedMs im Log zeigt
    // den Ist-Wert je Vorfall.
    // Box statt let-Variable: TS invalidiert die Narrowing-Analyse von Closure-Zuweisungen an lokale
    // let-Variablen nicht — über die Objekteigenschaft bleibt der Typ nach dem await korrekt.
    const failureBox: { current: { err: unknown; provider: string; elapsedMs: number } | null } = {
      current: null,
    };
    const result = await this.runTask(
      "structure",
      locale,
      async (p) => {
        if (p === this.fallback) {
          return p.structure(rawText, locale, confidential);
        }
        const startedMs = Date.now();
        try {
          return await p.structure(rawText, locale, confidential);
        } catch (err) {
          failureBox.current = { err, provider: p.name, elapsedMs: Date.now() - startedMs };
          throw err;
        }
      },
      confidential,
    );
    if (!result.demo) {
      return result;
    }
    // WP-D10 (Fix 3): Timeout als EIGENE Ursache — die UI unterscheidet Zeitüberschreitung von Fehler.
    const modelFailure = failureBox.current;
    const failure = modelFailure === null ? null : classifyModelFailure(modelFailure.err);
    const fallbackReason = !hadModelInChain
      ? ("no-model" as const)
      : failure?.failureClass === "timeout"
        ? ("model-timeout" as const)
        : ("model-error" as const);
    // PII-freies Diagnose-Log (nur Ursache/Klasse/Status/Dauer/Modell-ID + Prompt-LÄNGE als Zahl,
    // NIE der Eingabetext) — damit „FALLBACK trotz Kappung" serverseitig zuordenbar ist.
    const promptLength = rawText.length;
    const detail =
      modelFailure === null || failure === null
        ? ""
        : ` class=${failure.failureClass} status=${failure.status ?? "-"} elapsedMs=${modelFailure.elapsedMs} model=${modelFailure.provider}`;
    process.stderr.write(
      `[KLARWERK] Reasoner-Fallback (structure): reason=${fallbackReason}${detail} promptLength=${promptLength}\n`,
    );
    return { ...result, fallbackReason };
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

  // IC-3 (Import-Cockpit): leitet aus einem FREITEXT-Prompt strukturierte Auswahl-Kriterien ab
  // (JSON: themes/keywords/authors/yearFrom/yearTo). NUR über ein echtes Modell — der Auswahl-Task
  // folgt der bestehenden „select"-Zuordnung. NIE raten, NIE erfinden; das Sanitisieren macht der
  // library-analytics-Kern.
  //
  // WP-SAMMEL20-FIX (bens Fix 1, P0): `confidential` läuft durch DASSELBE zentrale Provider-Routing
  // wie alle anderen Tasks (providerChain nimmt die Cloud aus der Kette; ein lokaler LLM darf
  // weiter ableiten) — der Aufrufer klassifiziert den Batch fail-safe (groupingRequiresConfidential).
  // WP-SAMMEL20-FIX (bens Fix 2, EHRLICHER AUSFALL): statt still null → strukturiertes Ergebnis mit
  // fallbackReason (no-model / model-timeout / model-error, dasselbe Muster wie groupCandidates).
  // criteria bleibt bei jedem Ausfall null — der Aufrufer meldet den Ausfall SICHTBAR, statt die
  // ungefilterte Vollmenge als KI-Ergebnis auszugeben.
  async deriveImportCriteria(
    prompt: string,
    locale: ReasonerLocale = "de",
    confidential = false,
  ): Promise<ImportCriteriaResult> {
    if (prompt.trim().length === 0) {
      return { criteria: null, fallbackReason: null }; // nichts gefragt — kein Ausfall
    }
    // Der Auswahl-Task nutzt die „select"-Zuordnung; nur ein echtes Modell darf ableiten.
    const model = this.providerChain("select", confidential).find(
      (p): p is ModelProvider =>
        p !== this.fallback && p instanceof ModelProvider && p.isAvailable(),
    );
    if (!model) {
      return { criteria: null, fallbackReason: "no-model" };
    }
    try {
      const raw = await model.completeRaw(importSelectSystem(locale), prompt.trim());
      const parsed = parseFirstJsonObject(raw);
      // Modell hat geantwortet, aber ohne verwertbares JSON → ehrlich als Modellfehler ausweisen.
      return parsed === null
        ? { criteria: null, fallbackReason: "model-error" }
        : { criteria: parsed, fallbackReason: null };
    } catch (err) {
      const failure = classifyModelFailure(err);
      return {
        criteria: null,
        fallbackReason: failure.failureClass === "timeout" ? "model-timeout" : "model-error",
      };
    }
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
