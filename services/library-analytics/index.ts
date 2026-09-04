// Öffentliche API des Moduls library-analytics.
export {
  LibraryService,
  SEARCH_BACKFILL_LIMIT_PER_QUERY,
  IMPORT_CLEANUP_PROVIDERS,
  // WP-SHIP8-FIX (bens F2): stateless Digest der bestätigten Aufräum-Zielmenge.
  cleanupDigest,
  // WP-SHIP8-CLOSE-3 (bens ROT-1): Lease-Vertrag der Review-Claims (Recovery-Frist + Prüfung).
  REVIEW_CLAIM_LEASE_MS,
  reviewClaimLeaseExpired,
  // AUFTRAG-mega29 C3: der Ehrlichkeits-Satz der menschlichen Ausgaben (Markdown/MediaWiki/HTML).
  EXPORT_NO_CHECK_NOTE,
  // AUFTRAG-mega68: Verträge der Nachbarschafts-Auskunft (Deckel + Ubiquitäts-Schwelle).
  NEIGHBOR_LIMIT,
  UBIQUITY_MAX_SHARE,
  UBIQUITY_MIN_COUNT,
} from "./src/service";
export type { LibraryServiceDeps } from "./src/service";
// WP-SHIP8-FIX (bens F3): kanonischer Provider-Schlüsselteil aller Import-Schlüssel.
// WP-NIGHT-FIX (bens F3-Rest): + der zentrale zusammengesetzte Quell-Schlüssel (Status-Maps)
// und die zentrale Kandidaten-Wire-Id (Gruppierung/Auswahl/Apply/React-Keys).
// WP-SHIP8-CLOSE-3 (bens ROT-2): + der zentrale OFFENE Review-Statusraum ('neu'/'in_bearbeitung')
// für alle Pending-/Idempotenz-Abgleiche.
export {
  InMemoryCandidateRepo,
  candidateSourceId,
  importProviderKey,
  importSourceKey,
  isOpenReviewStatus,
  OPEN_REVIEW_STATUSES,
  openCandidateKey,
  type CandidateRepo,
  type ClaimResolution,
} from "./src/repo";
// W2-A (KW-W2-17): die Quellrevisions-DDL gehoert in die Fassade, weil `services/app/src/db.ts`
// ausschliesslich hierueber importieren darf (dependency-cruiser). Ohne diese Ausleitung war die
// in `repo-pg.ts` exportierte Konstante fuer die App unerreichbar — der Migrationswaechter meldete
// sie zu Recht als nicht migriert (Preflight 39 F1, Preflight 52 §2).
export { PgCandidateRepo, IMPORT_CANDIDATES_SCHEMA, EXTERNAL_SOURCE_SCHEMA } from "./src/repo-pg";
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
  KoSichtbar,
  Neighborhood,
  NeighborKo,
  // JOB 3023: der Port der Dublettenregel. Er MUSS hier heraus, sonst kann die Kompositionswurzel
  // die Pruefung nicht typisiert uebergeben — und dieses Modul muesste die Regel selbst auslegen.
  DublettenPruefung,
  DublettenBefund,
  UebersprungenGrund,
  UebersprungenerImport,
  // JOB 3050: der Befund derselben Frage am REVIEW-KANDIDATEN. Er MUSS heraus, weil das
  // Antwort-DTO der Route (`services/app/src/routes/library-routes.ts`) ihn ausweist — ohne die
  // Ausleitung könnte die Kompositionswurzel die Auskunft nicht typisiert weitergeben.
  KandidatDublettenbefund,
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
// ================================================================================================
// AUFTRAG-144 (KW-S4-28 F1) — DIE W2-A-LAUFDOMAENE AN DER MODULGRENZE
// ================================================================================================
//
// L2 AUS BASIC-PREFLIGHT 141, HIER GESCHLOSSEN: die Quellrevisions-DDL war ausgeleitet, `Repo` und
// `Typ` aber nicht — „die Tabelle wird angelegt und bleibt leer, weil der Repo hinter der
// Modulgrenze eingeschlossen ist". Ohne diese Ausleitung kann die Kompositionswurzel gar keine
// Instanz halten, und jede weitere Zeile waere unmoeglich.
//
// ENG UND ADDITIV (Auftragsvertrag §1): ausgeleitet werden ausschliesslich die oeffentlichen Typ-
// und Repovertraege sowie die Schemakonstante, die `services/app/src/db.ts` importieren MUSS.
// KEINE internen Tabellen- oder Hilfsdetails: `importRunSnapshot`, `ImportRunRow`, die
// Schluesselbildung und die Zeilenformen bleiben drinnen.
export {
  InMemoryExternalSourceRepo,
  InMemoryImportRunRepo,
  pruefeImportRun,
  pruefeImportRunItemRef,
  type ExternalSourceRepo,
  type ImportRunFortschritt,
  type ImportRunRepo,
} from "./src/repo";
export { IMPORT_RUN_SCHEMA, PgExternalSourceRepo, PgImportRunRepo } from "./src/repo-pg";
export {
  IMPORT_ITEM_OUTCOMES,
  IMPORT_RUN_STATUSES,
  IMPORT_FAILURE_REASON_MAX_CHARS,
  istImportItemOutcome,
  istImportRunStatus,
  pruefeGapBindung,
  pruefeInhaltsreferenzBindung,
  sanitizeImportFailureReason,
} from "./src/types";
export type {
  ContentReferenceBinding,
  ContentReferenceState,
  ExternalSourceRecord,
  ImportItemOutcome,
  ImportRun,
  ImportRunCounters,
  ImportRunItemRef,
  ImportRunStatus,
  KnowledgeGapBinding,
  KnowledgeGapRelationState,
} from "./src/types";
