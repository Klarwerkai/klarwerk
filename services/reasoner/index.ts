// Öffentliche API des Moduls reasoner.
export { Reasoner } from "./src/service";
export {
  DeterministicProvider,
  keywordSelect,
  type ReasonerProvider,
  // SCRUM-360 / AG-03: begrenzte, status-/trust-bewusste Top-K-Kandidatenauswahl.
  DEFAULT_TOP_K,
  selectCandidates,
  rankCandidates,
  statusTrustBoost,
  type RankedCandidate,
  // SCRUM-361 / AG-03: Tokenisierung der Frage für den Repo-Prefilter (konsistent zum Ranking).
  queryTokens,
  // PMO-FEA-0006: ehrlicher Extract-Fallback (keine Fake-Punkte ohne Modell).
  honestExtractUnavailable,
} from "./src/provider";
export {
  ModelProvider,
  type ModelClient,
  // Berater-Konzept 04.07. (Stufe 2, kon-v1): DOM-freies, testbares Parsen des Konflikturteils.
  parseConflictResponse,
  // Berater-Konzept Duplikate 04.07. (Stufe D2, dup-v1): testbares Parsen des Überschneidungs-Urteils.
  parseDuplicateResponse,
  // PMO-FEA-0006: DOM-freies Extract-Parsing inkl. G-2-Belegstellen-Gate (testbar).
  parseExtractResponse,
  excerptFoundInDocument,
  MAX_EXTRACT_POINTS,
  MAX_EXCERPT_LENGTH,
  MAX_EXTRACT_DOCUMENT_LENGTH,
} from "./src/provider-model";
export {
  anthropicClient,
  createModelClientFromEnv,
  type HttpModelConfig,
  // SCRUM-424: eigener lokaler LLM (OpenAI-kompatibel, z. B. vLLM/Qwen).
  openAiCompatibleClient,
  createLocalClientFromEnv,
  type LocalHttpModelConfig,
} from "./src/model-client";
// SCRUM-498 B2: prozess-globaler In-Flight-Cap für Modellaufrufe.
export {
  ModelCapacityError,
  ModelSemaphore,
  type ModelCapConfig,
  modelCapConfigFromEnv,
  cappedModelClient,
  withModelSlot,
  resetModelSemaphoreForTests,
} from "./src/model-concurrency";
// SCRUM-386: kundeneigene KI-Assist-Presets (Admin verwaltet; Palette zeigt sie allen Rollen).
export {
  ASSIST_PRESETS_SCHEMA,
  ASSIST_PRESET_INSTRUCTION_MAX,
  ASSIST_PRESET_NAME_MAX,
  type AssistPreset,
  type AssistPresetInput,
  type AssistPresetRepo,
  InMemoryAssistPresetRepo,
  MAX_ASSIST_PRESETS,
  normalizeAssistPresets,
  PgAssistPresetRepo,
} from "./src/presets";
export type {
  KnowledgeRef,
  KnowledgeClass,
  ReasonerTaskChoice,
  ReasonerTaskConfig,
  ReasonerLocale,
  AnswerResult,
  AnswerStep,
  StructureResult,
  AssistResult,
  ConflictJudgeResult,
  DuplicateJudgeResult,
  DuplicateAspect,
  ExtractResult,
  ExtractedPoint,
  EnrichResult,
  InterviewResult,
  ReasonerStatus,
  ReasonerConfigStatus,
  ReasonerConfigMode,
  ReasonerProbeResult,
  ReasonerTask,
} from "./src/types";
