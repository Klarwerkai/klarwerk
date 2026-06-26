// Öffentliche API des Moduls library-analytics.
export { LibraryService } from "./src/service";
export type { LibraryServiceDeps } from "./src/service";
export { InMemoryCandidateRepo, type CandidateRepo } from "./src/repo";
export { PgCandidateRepo, IMPORT_CANDIDATES_SCHEMA } from "./src/repo-pg";
export type {
  ImportItem,
  ImportResult,
  ImportCandidate,
  ReviewStatus,
  ReviewAction,
  BusFactorEntry,
  Graph,
  GraphNode,
  GraphEdge,
  Analytics,
} from "./src/types";
export { LibraryError } from "./src/types";
