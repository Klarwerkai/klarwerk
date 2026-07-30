// Öffentliche API des Moduls model-runs (SCRUM-164/165).
export { InMemoryModelRunRepo, type ModelRunRepo } from "./src/repo";
export { PgModelRunRepo, MODEL_RUNS_SCHEMA } from "./src/repo-pg";
export {
  ModelRunService,
  type ModelRunServiceDeps,
  normalizeModelRunLimit,
  DEFAULT_MODEL_RUN_LIMIT,
  MAX_MODEL_RUN_LIMIT,
} from "./src/service";
export type {
  ModelRunRecord,
  ModelRunTask,
  ModelRunStatus,
  // mega26 Block A: Laufkontext (wer/woran) — additiv, alle Felder optional.
  ModelRunContext,
  ModelRunSubject,
  ModelRunSubjectKind,
  // mega61 Block F: die maschinenlesbare Kennzeichnung erzeugter Ausgaben (KI-VO Art. 50 Abs. 2).
  AiGeneratedMark,
  AiOutputMode,
} from "./src/types";
export { sanitizeModelRunContext, MAX_MODEL_RUN_CONTEXT_ID_LENGTH } from "./src/types";
export { aiGeneratedMark, KI_ERZEUGENDE_AUFGABEN } from "./src/types";
