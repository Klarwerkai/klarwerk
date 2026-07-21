// Öffentliche API des Moduls library-analytics.
export { LibraryService } from "./src/service";
export type { LibraryServiceDeps } from "./src/service";
export { InMemoryCandidateRepo, type CandidateRepo } from "./src/repo";
export { PgCandidateRepo, IMPORT_CANDIDATES_SCHEMA } from "./src/repo-pg";
export type {
  ImportItem,
  ImportResult,
  ImportCandidate,
  SourceAdapter,
  ReviewStatus,
  ReviewAction,
  BusFactorEntry,
  ExpertiseEntry,
  ExpertiseContributor,
  Graph,
  GraphNode,
  GraphEdge,
  Analytics,
} from "./src/types";
export { LibraryError } from "./src/types";
// IC-1 (Import-Cockpit): READ-ONLY Erkundungs-Aggregat (pure, deterministisch).
export {
  summarizeImportItems,
  NO_AUTHOR_LABEL,
  NO_THEME_LABEL,
} from "./src/explore";
export type {
  ImportExploreSummary,
  CountEntry,
  ThemeEntry,
  SummarizeOptions,
} from "./src/explore";
// IC-3 (Import-Cockpit): PURE Auswahl-/Filterlogik (deterministisch; KI-Ableitung über injizierte Fn).
export {
  filterImportItems,
  sanitizeCriteria,
  toPreviewEntry,
  deriveCriteriaFromPrompt,
} from "./src/select";
export type {
  SelectCriteria,
  SelectResult,
  ImportPreviewEntry,
  ImportedStatus,
  CriteriaInference,
} from "./src/select";
// WP-IC-PAKET-1 (Teil 2): deterministische Themen-Ableitung aus Seitentiteln (Fallback ohne Labels).
export { deriveTitleThemes, titleThemeTokens, MIN_THEME_GROUP_SIZE } from "./src/themes";
// WP-IC-PAKET-1e: DIE geteilte Pro-Item-Kanonisierung (Erkundung UND Selektion — Chips selektierbar).
export { canonicalImportText } from "./src/text-codec";
