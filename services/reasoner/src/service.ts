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
  ConflictJudgeOutcome,
  ConflictJudgeResult,
  DescribeImageResult,
  DuplicateJudgeOutcome,
  DuplicateJudgeResult,
  EnrichResult,
  ExtractResult,
  GroupCandidateInput,
  GroupCandidatesResult,
  ImportCriteriaResult,
  InterviewResult,
  JudgeFailure,
  KnowledgeRef,
  ReasonerConfigStatus,
  ReasonerLocale,
  ReasonerPolicySource,
  ReasonerProbeResult,
  ReasonerReachability,
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

  // PAKET 2 (D-AISTATE, Pedi 23.07.): LEICHTER, GECACHTER Erreichbarkeits-Zustand für die Top-Badges.
  // Bewusst KEIN Ping pro Request (Kosten/Rate): der Cache lebt REACHABILITY_TTL_MS; publicStatus()
  // liest NUR den Cache (synchron), und refreshReachabilityIfStale() stößt höchstens einmal je Frist
  // einen echten Hintergrund-Probe an (feuern-und-vergessen). recordReachability() lässt zusätzlich
  // echte Task-Ausgänge den Cache auffrischen (schonendste Variante — kein Extra-Netz).
  // D-AISTATE PAKET 3 (bens V4, aistate-fix3): der Cache ist PRO PROVIDERKANTE (cloud/local) —
  // vorher galt global „irgendein Modell erreichbar", wodurch eine cloud-gestellte Task bei
  // unerreichbarer Cloud + erreichbarem Local fälschlich als nutzbar erschien. Die per-Task-Karte
  // (publicStatus.tasks) wertet jetzt GENAU die Kette der Task gegen die Kanten-Zustände aus.
  private static readonly REACHABILITY_TTL_MS = 60_000;
  private readonly reachabilityCache: {
    cloud: { at: number; reachable: boolean } | null;
    local: { at: number; reachable: boolean } | null;
  } = { cloud: null, local: null };
  private reachabilityProbeInFlight = false;

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
      // aistate-fix3 (bens V1): „lokal" nur, wenn der Secondary vertraulichkeits-tauglich ist
      // (bestätigte On-Prem-Origin, rejectsConfidential()!==true) — ein fremd verdrahteter Endpunkt
      // fällt bei vertraulichem Text aus der Kette (kein Egress, deterministischer Fallback trägt).
      if (
        (choice === "auto" || choice === "local" || confidential) &&
        this.usingSecondary() &&
        !(confidential && this.secondary.rejectsConfidential?.() === true)
      ) {
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

  // D-AISTATE PAKET 3 (bens V4): Kanten-Zustand aus dem per-Provider-Cache (frisch → letzter echter
  // Befund; sonst "unverified" — kein Fake-Grau beim Start).
  private providerReachability(kind: "cloud" | "local"): "unverified" | "active" | "unreachable" {
    const cache = this.reachabilityCache[kind];
    if (!cache || Date.now() - cache.at > Reasoner.REACHABILITY_TTL_MS) {
      return "unverified";
    }
    return cache.reachable ? "active" : "unreachable";
  }

  // PAKET 2 (D-AISTATE): synchroner GLOBALER Erreichbarkeits-Zustand für die Badges — NUR aus dem
  // Cache, nie ein Ping pro Aufruf. Ohne Modell "none"; irgendeine Kante frisch erreichbar →
  // "active"; alles Konfigurierte frisch unerreichbar → "unreachable"; sonst "unverified".
  // (Die per-Task-Nutzbarkeit läuft NICHT hierüber, sondern über taskModelUsable — bens V4.)
  reachabilityState(): ReasonerReachability {
    if (!this.usingAnyModel()) {
      return "none";
    }
    const states: ("unverified" | "active" | "unreachable")[] = [];
    if (this.usingPrimary()) {
      states.push(this.providerReachability("cloud"));
    }
    if (this.usingSecondary()) {
      states.push(this.providerReachability("local"));
    }
    if (states.includes("active")) {
      return "active";
    }
    if (states.includes("unverified")) {
      return "unverified";
    }
    return "unreachable";
  }

  // Feuern-und-vergessen: probt HÖCHSTENS einmal je Frist echt (keine Kosten pro Request; kein Sturm
  // bei parallelen Anfragen dank In-Flight-Flag). Der Aufrufer (Status-Route) wartet NICHT — die
  // Antwort trägt den aktuellen Cache; der frische Befund greift ab dem nächsten Abruf.
  refreshReachabilityIfStale(): void {
    if (!this.usingAnyModel() || this.reachabilityProbeInFlight) {
      return;
    }
    const isFresh = (kind: "cloud" | "local"): boolean => {
      const cache = this.reachabilityCache[kind];
      return cache !== null && Date.now() - cache.at <= Reasoner.REACHABILITY_TTL_MS;
    };
    const cloudStale = this.usingPrimary() && !isFresh("cloud");
    const localStale = this.usingSecondary() && !isFresh("local");
    if (!cloudStale && !localStale) {
      return;
    }
    this.reachabilityProbeInFlight = true;
    void this.runReachabilityProbe().finally(() => {
      this.reachabilityProbeInFlight = false;
    });
  }

  // Echte Mini-Aufrufe (probe/probeLocal) — D-AISTATE PAKET 3 (bens V4): JEDE konfigurierte Kante
  // wird einzeln geprobt und einzeln gecacht (vorher: „irgendein Modell erreichbar" global).
  private async runReachabilityProbe(): Promise<void> {
    if (this.usingPrimary()) {
      try {
        this.recordReachability((await this.probe()).ok, "cloud");
      } catch {
        this.recordReachability(false, "cloud");
      }
    }
    if (this.usingSecondary()) {
      try {
        this.recordReachability((await this.probeLocal()).ok, "local");
      } catch {
        this.recordReachability(false, "local");
      }
    }
  }

  // Auffrischen aus einem beliebigen echten Erreichbarkeits-Befund (Probe ODER realer Task-Ausgang).
  // Ohne Kanten-Angabe (Bestands-Aufrufer) wird der Befund auf ALLE konfigurierten Kanten gelegt —
  // das alte globale Verhalten bleibt für diese Aufrufer erhalten.
  recordReachability(reachable: boolean, provider?: "cloud" | "local"): void {
    const stamp = { at: Date.now(), reachable };
    if (provider) {
      this.reachabilityCache[provider] = stamp;
      return;
    }
    if (this.usingPrimary()) {
      this.reachabilityCache.cloud = stamp;
    }
    if (this.usingSecondary()) {
      this.reachabilityCache.local = stamp;
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

  // WP-SHIP9-S1 (bens W2-Auflage aus BERICHT-w2check): taskbezogene Ursachenbestimmung — wertet
  // GENAU die Routing-Entscheidung aus, mit der providerChain(task, confidential) die Cloud-Kante
  // setzt (choiceFor(task) cloud-geeignet UND Cloud-Primary verdrahtet). Ein globales
  // usingAnyModel() reicht bewusst NICHT: eine deterministische Task-Policy, eine local-Policy
  // ohne lokales Modell und der fail-closed Policy-Ladefehler (LOAD_FAILURE_FALLBACK_POLICY →
  // deterministic) dürfen NIE als Vertraulichkeitsblockade erscheinen.
  private cloudExcludedByConfidentiality(task: ModelRunTask, confidential: boolean): boolean {
    if (!confidential || !this.usingPrimary()) {
      return false;
    }
    const choice = this.choiceFor(task);
    return choice === "auto" || choice === "cloud" || choice === "model";
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

  // WP-VIP2-GATE (bens P1): ABSTRAHIERTE, oeffentliche Status-Sicht — NUR {active, mode}.
  // Der Provider-/Modellname (status().provider, z. B. der konkrete Anthropic-Modellstring) ist
  // Infrastruktur-Detail und gehoert ausschliesslich in die ECHTE Admin-Sicht (/api/reasoner/
  // config, users.manage — WP-VIP2-GATE-2 Fix 3/4). mode nennt die STUFE (cloud/local/deterministic),
  // nie das Produkt.
  // PAKET 2 (D-AISTATE, Pedi 23.07.): zusätzlich der ehrliche ERREICHBARKEITS-Zustand (reachable) —
  // „active" nur, wenn ein Modell zuletzt WIRKLICH geantwortet hat. `active`/`mode` bleiben die
  // Konfigurations-Wahrheit (rückwärtskompatibel); die Badges nutzen `reachable` für die Farbe.
  // D-AISTATE PAKET 3 (bens V4, aistate-fix3): Nutzbarkeit EINER Aufgabe nach ihrer TATSÄCHLICH
  // gewählten Providerkette UND deren Kanten-Erreichbarkeit — nicht mehr „Policy-Slot da" + global
  // „irgendein Modell erreichbar". true nur, wenn IRGENDEIN Modell-Glied der Task-Kette nicht zuletzt
  // unerreichbar war ("unverified" zählt als nutzbar — kein Fake-Grau beim Start; die Kette fällt zur
  // Laufzeit ohnehin durch erreichbare Glieder). Cloud-unerreichbar + Local-erreichbar + Task=cloud ⇒
  // false (die Kette dieser Task enthält NUR die Cloud). Bewusst nur ein Boolean — kein Provider-/
  // Modellname (Sicherheitsvertrag vip2-gate).
  private taskModelUsable(task: ModelRunTask): boolean {
    const chainModels = this.providerChain(task).filter((p) => p !== this.fallback);
    if (chainModels.length === 0) {
      return false; // Aufgabe bewusst deterministisch gestellt bzw. kein Modell verdrahtet
    }
    return chainModels.some(
      (p) => this.providerReachability(p === this.primary ? "cloud" : "local") !== "unreachable",
    );
  }

  // D-AISTATE PAKET 3 (bens V4, 23.07.): zusätzlich eine ABSTRAKTE per-Task-Nutzbarkeitskarte
  // `tasks: { [task]: boolean }` — NUR true/false je Aufgabe, KEIN Provider-/Modellname (die bleiben
  // der Admin-Sicht vorbehalten, vip2-gate). true = für die Aufgabe ist ein echtes Modell (cloud|local)
  // in der Kette UND dessen Kante ist nicht zuletzt unerreichbar (bens V4: Erreichbarkeit PRO TASK
  // nach der echten Providerkette, s. taskModelUsable); false = deterministisch bzw. die für die
  // Aufgabe zulässigen Provider sind unerreichbar. So kann der öffentliche Hook die LLM-Knöpfe je
  // Aufgabe ehrlich ausgrauen, ohne die admin-only Config zu ziehen.
  publicStatus(): {
    active: boolean;
    mode: "cloud" | "local" | "deterministic";
    reachable: ReasonerReachability;
    tasks: Record<string, boolean>;
  } {
    const active = this.usingAnyModel();
    return {
      active,
      mode: this.usingPrimary() ? "cloud" : this.usingSecondary() ? "local" : "deterministic",
      reachable: this.reachabilityState(),
      tasks: Object.fromEntries(REASONER_TASKS.map((task) => [task, this.taskModelUsable(task)])),
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
    // WP-SHIP9-S1 (bens W2-Auflage): war KEIN Modell in der (vertraulichkeitsgefilterten) Kette,
    // wird unterschieden, WARUM — fiel die Cloud-Kante genau durch die Vertraulichkeit weg, ist
    // die ehrliche Ursache "confidential" statt des irreführenden "no-model". War ein (lokales)
    // Modell in der Kette und scheiterte, bleiben model-timeout/model-error unangetastet.
    const fallbackReason = !hadModelInChain
      ? this.cloudExcludedByConfidentiality("group", confidential)
        ? ("confidential" as const)
        : ("no-model" as const)
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
    // WP-BILD-1f (Pedi 22.07.): optionaler umgebender Dokument-Kontext (Klartext). Reist NUR mit,
    // wenn der Beitrag ohnehin den Cloud-Weg nehmen darf — durch DIESELBE providerChain-/Egress-Stelle
    // wie das Bild selbst. Vertraulich → Cloud aus der Kette → weder Bild noch Kontext egress.
    context?: string,
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
          return await p.describeImage(dataUrl, locale, confidential, context);
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
    // WP-SHIP9-S2 (bens Folgeschnitt B4): dieselbe Ursachen-Harmonisierung wie groupCandidates —
    // fiel die Cloud-Kante genau durch die Vertraulichkeit weg (kein lokales Modell sprang ein), ist
    // die ehrliche Ursache "confidential" statt des irreführenden "no-model". Ein versuchtes, aber
    // gescheitertes (lokales) Modell behält model-timeout/model-error.
    const fallbackReason = !hadModelInChain
      ? this.cloudExcludedByConfidentiality("describe", confidential)
        ? ("confidential" as const)
        : ("no-model" as const)
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
    // WP-SHIP9-S2 (bens Folgeschnitt B4): Ursachen-Harmonisierung wie groupCandidates — die Cloud-
    // Kante fiel genau durch die Vertraulichkeit weg (kein lokales Modell sprang ein) → ehrliche
    // Ursache "confidential" statt "no-model"; ein versuchtes, aber gescheitertes Modell behält seine Klasse.
    const fallbackReason = !hadModelInChain
      ? this.cloudExcludedByConfidentiality("structure", confidential)
        ? ("confidential" as const)
        : ("no-model" as const)
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
  // WP-VIP2-GATE (bens P0-1, endgueltig): `confidential` ist PFLICHT — kein Default mehr. Der
  // Freitext-Prompt ist Nutzereingabe ÜBER potenziell vertrauliches Wissen; jeder Aufrufer dieses
  // completeRaw-nahen Pfads muss die Provenienz EXPLIZIT entscheiden (der Compiler erzwingt es).
  // `locale` verliert seinen Default mit (TS erlaubt keinen Pflicht-Parameter nach einem optionalen).
  async deriveImportCriteria(
    prompt: string,
    locale: ReasonerLocale,
    confidential: boolean,
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
      // WP-SHIP9-S2 (bens Folgeschnitt B4): war ein Cloud-Modell konfiguriert und die select-Policy
      // cloud-geeignet, aber die Cloud-Kante fiel wegen vertraulicher Kandidaten weg (kein lokales
      // Modell sprang ein), ist die ehrliche Ursache "confidential" statt des irreführenden "no-model".
      return {
        criteria: null,
        fallbackReason: this.cloudExcludedByConfidentiality("select", confidential)
          ? "confidential"
          : "no-model",
      };
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

  // WP-SHIP8-CLOSE (bens F1): Fehlerklasse eines Judge-Versuchs — timeout wird eigenständig
  // ausgewiesen, alles andere (HTTP/Netz/Parse) ist model-error. ModelCapacityError bleibt der
  // EINZIGE durchgereichte Fehler (Backpressure-Vertrag → 503, unverändert).
  private static judgeFailureOf(err: unknown): JudgeFailure {
    return classifyModelFailure(err).failureClass === "timeout" ? "model-timeout" : "model-error";
  }

  // D-AISTATE PAKET 1 (bens V1, 23.07.): vertraulichkeitsbewusste Provider-Auswahl der Judge-Kette.
  // Ersetzt die frühere direkte, GATE-LOSE Schleife über [primary, secondary] (bens Befund 3.3). Die
  // Regel ist EXAKT die des zentralen `providerChain`-Chokepoints (SCRUM-502): vertraulich ⇒ die Cloud
  // (primary, externer Egress) fällt aus der Kette. aistate-fix3 (bens V1, Sicherheitsblocker):
  // auch der Secondary ist bei vertraulichen Paaren nur zulässig, wenn er vertraulichkeits-tauglich
  // ist (rejectsConfidential()!==true ⇔ bestätigte On-Prem-Origin, s. createCappedLocalClientFromEnv)
  // — ein fremd verdrahteter „lokaler" Endpunkt fällt VOR jedem Aufruf/Fetch aus der Kette.
  // `confidentialExcluded` hält fest, ob ein vorhandenes Modell GENAU an der Vertraulichkeit
  // scheiterte — dann ist der ehrliche Ausgang "confidential", nicht "no-model". Der deterministische
  // Fallback ist KEIN Judge (er urteilt nicht inhaltlich), daher taucht er hier nicht auf.
  // `confidential` ist die restriktivste Stufe des PAARES — vom Aufrufer gesetzt, hier nicht absenkbar.
  private judgeProviders(confidential: boolean): {
    providers: ReasonerProvider[];
    confidentialExcluded: boolean;
  } {
    const providers: ReasonerProvider[] = [];
    let confidentialExcluded = false;
    if (this.usingPrimary()) {
      if (confidential) {
        confidentialExcluded = true;
      } else {
        providers.push(this.primary);
      }
    }
    if (this.usingSecondary()) {
      if (confidential && this.secondary.rejectsConfidential?.() === true) {
        confidentialExcluded = true;
      } else {
        providers.push(this.secondary);
      }
    }
    return { providers, confidentialExcluded };
  }

  // Ehrlicher Ausgang, wenn KEIN Judge-Provider befragt werden konnte: existiert ein Modell und
  // wurde es NUR wegen der Vertraulichkeit ausgeschlossen (Cloud ODER nicht-bestätigter Secondary),
  // ist das "confidential" — NICHT "no-model" (das Modell existiert, es darf den Text nur nicht sehen).
  private static noJudgeFailure(
    confidential: boolean,
    confidentialExcluded: boolean,
  ): JudgeFailure {
    return confidential && confidentialExcluded ? "confidential" : "no-model";
  }

  // Berater-Konzept 04.07. (Stufe 2, kon-v1): „Konfliktprüfung" — urteilt inhaltlich, ob zwei
  // Kerntexte einander widersprechen/doppeln/überholen (Cloud → lokal).
  // WP-SHIP8-CLOSE (bens F1): Ergebnis-Vertrag mit unterscheidbarem AUSGANG. Vorher wurden
  // normale Provider-/HTTP-/Netz-/Parsefehler hier still zu null — für den aiCheck-Runner
  // ununterscheidbar von „kein Modell". Jetzt: verdict (das Urteil) ODER failure (Ursache):
  //  - kein befragbares Modell → no-model,
  //  - Modellaufruf warf (HTTP/Netz) → model-error, Zeitlimit → model-timeout,
  //  - Modell antwortete, aber unverwertbar (Provider parst zu null) → model-error
  //    (ein echtes „kein_konflikt" ist ein NICHT-null-verdict — nie eine Verwechslung).
  // Der erste Fehler der Kette benennt die Ursache; ein späterer Provider-ERFOLG gewinnt weiter.
  // D-AISTATE PAKET 1 (bens V1): `confidential` = restriktivste Stufe des Paares. Vertraulich ⇒ die
  // Cloud fällt über judgeProviders aus der Kette (kein Egress); nur ein lokales Modell darf urteilen.
  async judgeConflictOutcome(
    coreA: string,
    coreB: string,
    locale: ReasonerLocale = "de",
    confidential = false,
  ): Promise<ConflictJudgeOutcome> {
    let failure: JudgeFailure | undefined;
    let attempted = false;
    const { providers, confidentialExcluded } = this.judgeProviders(confidential);
    for (const provider of providers) {
      if (!provider.judgeConflict) {
        continue;
      }
      attempted = true;
      try {
        // aistate-fix3 (bens V1): das ECHTE Paar-Bit reist bis zum ModelClient.complete-Wächter.
        const result = await provider.judgeConflict(coreA, coreB, locale, confidential);
        if (result) {
          return { verdict: result };
        }
        failure = failure ?? "model-error"; // Antwort kam, war aber unverwertbar (Parse → null)
      } catch (err) {
        if (err instanceof ModelCapacityError) {
          throw err; // Backpressure durchreichen (→ 503), nicht als Modellfehler still schlucken.
        }
        // aistate-fix3 (bens V1, Fail-safe): der zentrale Egress-Wächter hat vertraulich+nicht-lokal
        // VOR dem Fetch abgelehnt — das ist KEIN Modellfehler, sondern der ehrliche Ausgang
        // "confidential" (kein Egress, kein done).
        if (err instanceof Error && err.name === "ConfidentialEgressError") {
          failure = failure ?? "confidential";
          continue;
        }
        failure = failure ?? Reasoner.judgeFailureOf(err);
        // nächstes Modell versuchen
      }
    }
    if (!attempted) {
      return {
        verdict: null,
        failure: Reasoner.noJudgeFailure(confidential, confidentialExcluded),
      };
    }
    return { verdict: null, failure: failure ?? "model-error" };
  }

  // Bestandsfassade (Konsole/check-text/knowledge-check binden hierüber — geprüft, unverändert):
  // exakt das alte Verhalten, null in allen Nicht-Urteil-Fällen. `confidential` optional (Default
  // false = Bestandsverhalten); die Detection reicht die Paar-Vertraulichkeit durch.
  async judgeConflict(
    coreA: string,
    coreB: string,
    locale: ReasonerLocale = "de",
    confidential = false,
  ): Promise<ConflictJudgeResult | null> {
    return (await this.judgeConflictOutcome(coreA, coreB, locale, confidential)).verdict;
  }

  // Berater-Konzept Duplikate 04.07. (Stufe D2, dup-v1): „Duplikatprüfung" — Überschneidungs-Profil
  // zweier Kerntexte (Cloud → lokal). WP-SHIP8-CLOSE (bens F1): derselbe Ergebnis-Vertrag wie bei
  // judgeConflictOutcome — der Ausgang (Urteil vs. Fehlerursache vs. kein Modell) ist unterscheidbar.
  // D-AISTATE PAKET 1 (bens V1): vertraulichkeitsbewusst wie judgeConflictOutcome.
  async judgeDuplicateOutcome(
    coreA: string,
    coreB: string,
    locale: ReasonerLocale = "de",
    confidential = false,
  ): Promise<DuplicateJudgeOutcome> {
    let failure: JudgeFailure | undefined;
    let attempted = false;
    const { providers, confidentialExcluded } = this.judgeProviders(confidential);
    for (const provider of providers) {
      if (!provider.judgeDuplicate) {
        continue;
      }
      attempted = true;
      try {
        // aistate-fix3 (bens V1): das ECHTE Paar-Bit reist bis zum ModelClient.complete-Wächter.
        const result = await provider.judgeDuplicate(coreA, coreB, locale, confidential);
        if (result) {
          return { verdict: result };
        }
        failure = failure ?? "model-error"; // Antwort kam, war aber unverwertbar (Parse → null)
      } catch (err) {
        if (err instanceof ModelCapacityError) {
          throw err; // Backpressure durchreichen (→ 503), nicht als Modellfehler still schlucken.
        }
        // aistate-fix3 (bens V1, Fail-safe): Egress-Wächter-Ablehnung ⇒ ehrlich "confidential".
        if (err instanceof Error && err.name === "ConfidentialEgressError") {
          failure = failure ?? "confidential";
          continue;
        }
        failure = failure ?? Reasoner.judgeFailureOf(err);
        // nächstes Modell versuchen
      }
    }
    if (!attempted) {
      return {
        verdict: null,
        failure: Reasoner.noJudgeFailure(confidential, confidentialExcluded),
      };
    }
    return { verdict: null, failure: failure ?? "model-error" };
  }

  // Bestandsfassade — exakt das alte Verhalten, null in allen Nicht-Urteil-Fällen.
  async judgeDuplicate(
    coreA: string,
    coreB: string,
    locale: ReasonerLocale = "de",
    confidential = false,
  ): Promise<DuplicateJudgeResult | null> {
    return (await this.judgeDuplicateOutcome(coreA, coreB, locale, confidential)).verdict;
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
