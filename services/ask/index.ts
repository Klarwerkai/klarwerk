// Öffentliche API des Moduls ask.
export { AskService } from "./src/service";
export type { AskServiceDeps, AskResult } from "./src/service";
export { InMemoryGapRepo, type GapRepo } from "./src/repo";
export { PgGapRepo, ASK_SCHEMA } from "./src/repo-pg";
export { AskError, GAP_PRIORITIES, isGapPriority } from "./src/types";
export type { Gap, GapPriority, AskErrorCode } from "./src/types";
