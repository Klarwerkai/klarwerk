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
} from "./src/provider";
export { ModelProvider, type ModelClient } from "./src/provider-model";
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
  InterviewResult,
  ReasonerStatus,
  ReasonerConfigStatus,
  ReasonerConfigMode,
  ReasonerTask,
} from "./src/types";
