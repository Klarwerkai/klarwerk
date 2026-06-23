// Öffentliche API des Moduls lifecycle.
export { LifecycleService } from "./src/service";
export type { LifecycleServiceDeps } from "./src/service";
export { InMemoryLifecycleRepo, type LifecycleRepo } from "./src/repo";
export { PgLifecycleRepo, LIFECYCLE_SCHEMA } from "./src/repo-pg";
export { LifecycleError } from "./src/types";
export type { LearningPath, LearningStep, LifecycleErrorCode } from "./src/types";
