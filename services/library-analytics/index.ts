// Öffentliche API des Moduls library-analytics.
export {
  LibraryService,
  SEARCH_BACKFILL_LIMIT_PER_QUERY,
  IMPORT_CLEANUP_PROVIDERS,
  // WP-SHIP8-FIX (bens F2): stateless Digest der bestätigten Aufräum-Zielmenge.
  cleanupDigest,
} from "./src/service";
export type { LibraryServiceDeps } from "./src/service";
// WP-SHIP8-FIX (bens F3): kanonischer Provider-Schlüsselteil aller Import-Schlüssel.
// WP-NIGHT-FIX (bens F3-Rest): + der zentrale zusammengesetzte Quell-Schlüssel (Status-Maps)
// und die zentrale Kandidaten-Wire-Id (Gruppierung/Auswahl/Apply/React-Keys).
export {
  InMemoryCandidateRepo,
  candidateSourceId,
  importProviderKey,
  importSourceKey,
  type CandidateRepo,
} from "./src/repo";
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
  // WP-SAMMEL20-FIX (bens Fix 6b): serverseitiger Wire-Deckel + Gesamtzähler der Erkundung.
  TOP_AUTHORS,
  TOP_TOPICS,
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
  // WP-SAMMEL20-FIX (bens Fix 2): ehrlicher Ausfall-Vertrag der Prompt→Kriterien-Ableitung.
  CriteriaInferenceOutcome,
  DerivedCriteria,
} from "./src/select";
// WP-IC-PAKET-1 (Teil 2): deterministische Themen-Ableitung aus Seitentiteln (Fallback ohne Labels).
export { deriveTitleThemes, titleThemeTokens, MIN_THEME_GROUP_SIZE } from "./src/themes";
// WP-IC-PAKET-1e: DIE geteilte Pro-Item-Kanonisierung (Erkundung UND Selektion — Chips selektierbar).
export { canonicalImportText } from "./src/text-codec";
// WP-IC-4: pure Zulieferung der KI-Gruppierung (sparsame Eingaben, deterministische Hinweise).
// WP-SHIP7-FIX: + fail-safe Vertraulichkeits-Klassifikation des Batches und Prompt-Deckel.
export {
  candidateIdOf,
  candidateHints,
  dedupeSelectedItems,
  groupingCandidates,
  groupingRequiresConfidential,
  // WP-VIP2-GATE (bens P0-1): fail-closed Prompt-Provenienz (leerer Snapshot → vertraulich).
  promptRequiresConfidential,
  groupPromptUtf8Bytes,
  GROUP_TEXT_MAX_CHARS,
  GROUP_TITLE_MAX_INPUT_CHARS,
  GROUP_PROMPT_MAX_UTF8_BYTES,
  STALE_AFTER_DAYS,
  MIN_CONTENT_CHARS,
  type CandidateHint,
  type GroupingCandidate,
} from "./src/grouping";
// WP-BILD-1e: Bild-Fußnoten (figcaption) in der Bibliotheks-Suche — pure Extraktion + Match.
export {
  imageCaptionTexts,
  captionsMatchQuery,
  LEGACY_IMAGE_CAPTION_PLACEHOLDERS,
} from "./src/search-captions";
