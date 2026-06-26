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
export type { ModelRunRecord, ModelRunTask, ModelRunStatus } from "./src/types";
