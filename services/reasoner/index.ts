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
} from "./src/model-client";
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
  ExtractResult,
  ExtractedPoint,
  InterviewResult,
  ReasonerStatus,
  ReasonerConfigStatus,
  ReasonerConfigMode,
  ReasonerTask,
} from "./src/types";
