// Öffentliche API des Moduls conflicts.
export { ConflictService } from "./src/service";
export type { ConflictServiceDeps } from "./src/service";
export { InMemoryConflictRepo, type ConflictRepo } from "./src/repo";
export { PgConflictRepo, CONFLICTS_SCHEMA } from "./src/repo-pg";
export { ConflictError } from "./src/types";
export type {
  Conflict,
  ConflictType,
  ConflictStatus,
  ConflictInput,
  ConflictErrorCode,
} from "./src/types";
