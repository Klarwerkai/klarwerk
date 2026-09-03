// Öffentliche API des Moduls knowledge-object.
export {
  KoService,
  // G27: Deckel des Altbestands-Backfills je Suchanfrage (die Suche wird nie zum Bestandslauf).
  SEARCH_PROJECTION_BACKFILL_PER_QUERY,
  normalizeEvidenceLimit,
  DEFAULT_EVIDENCE_LIMIT,
  MAX_EVIDENCE_LIMIT,
  TRUTH_CONFLICT_TRUST_PENALTY,
  // G27 R1: das Ergebnis der fünf Gate-Prüfungen vor der atomaren Freigabe.
  type SearchProjectionReadiness,
  // SCRUM-422: Papierkorb-Aufbewahrungsfrist (Tage bis zur automatischen Endlöschung).
  TRASH_RETENTION_DAYS,
} from "./src/service";
export type {
  KoServiceDeps,
  CreateKoInput,
  ReviseKoInput,
  WithTx,
  // AUFTRAG-mega18 Block A-1: der Vertrag der Verbund-Operation „Dokumentinhalt übernehmen".
  DocumentAppendInput,
  DocumentAppendAnchorInput,
  DocumentAppendSourceInput,
  DocumentAppendCommit,
  // AUFTRAG-mega19 Block B: der Vertrag der Erstanlage AUS Dokumenten (createWithDocuments).
  DocumentBundleInput,
  // AUFTRAG-mega21 Block A: wer den Vorgang fährt und mit welchem Inhalt (Eigentümer + Abdruck).
  CreateOperationRequester,
} from "./src/service";
// AUFTRAG-mega18 Block A-2: die INTERNE BELEGPFLICHT als eigene, stufenunabhängige Regel — und der
// Vorgangsschlüssel der Idempotenz. Getrennt von der externen Stufenregel
// (services/external-search/src/attach-policy.ts); die Begründung der Trennung steht in der Datei.
export {
  DOCUMENT_APPEND_OP_MEMORY,
  normalizeAppendOperationId,
  rememberAppendOp,
  requireDocumentEvidence,
} from "./src/document-append";
export type { DocumentEvidenceFacts } from "./src/document-append";
// AUFTRAG-mega20 Block A: der Vorgangsschlüssel der ERSTANLAGE (DB-weit eindeutig, Adopt-Semantik).
// AUFTRAG-mega21 Block A: dazu der kanonische Inhaltsabdruck des Vorgangs (Regeln K1–K7 in der Datei).
// AUFTRAG-mega22 Block A: dazu K8 — die SCHREIBLADUNG als eigener, semantiktreuer Baustein.
export {
  normalizeCreateOperationId,
  createOperationFingerprint,
  alsMenge,
  alsSchreibpatch,
  CREATE_OPERATION_FINGERPRINT_VERSION,
  CREATE_OPERATION_WRITE_PATCH_VERSION,
} from "./src/document-create";
export {
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
  // JOB 2706 D1: der Schreibstand eines Bestands — im Speicher geteilt zwischen seinen Ablagen.
  Schreibstand,
  type EvidenceRepo,
  type KoRepo,
  type KoVersionRepo,
  type KoFilter,
  // AUFTRAG-BASIC-380: der injizierte Sicherheitstrim (Papierkorb + Sichtbarkeit) fuer den Suchweg.
  type KoSichtbarkeitstrim,
  type KoCandidateQuery,
  koCandidateText,
  koCandidateScore,
} from "./src/repo";
export {
  PgEvidenceRepo,
  PgKoRepo,
  PgKoVersionRepo,
  KO_EVIDENCE_SCHEMA,
  KO_SCHEMA,
  // WP-SHIP8-CLOSE-4 (bens ROT-1B): additive Anker-Migration (nach KO_SCHEMA ausfuehren).
  KO_IMPORT_ANCHOR_SCHEMA,
  // AUFTRAG-mega20 Block A: additive Anker-Migration der ERSTANLAGE (nach KO_SCHEMA ausfuehren).
  KO_CREATE_OPERATION_SCHEMA,
  // AUFTRAG-BASIC-380: additive ALTER-only-Stufe der drei Sichtbarkeits-Schluesselspalten
  // (nach KO_SCHEMA ausfuehren). Der generische Migrationswaechter faengt sie NICHT — sie haengt
  // an einem eigens benannten Pin (T-M-3, services/app/src/db.migrate.test.ts).
  KO_SICHTBARKEIT_SCHEMA,
  KO_VERSIONS_SCHEMA,
} from "./src/repo-pg";
// ================================================================================================
// G27 — DER GEMEINSAME SUCHVERTRAG (revisionsgebundene Search Projection)
// ================================================================================================
//
// Bibliothek (library-analytics) und produktives Klara (ask) lesen GENAU diese Bausteine — es gibt
// keinen zweiten Feldsatz und keinen zweiten Weg an den durchsuchbaren Text. Die Begründung jeder
// Einzelentscheidung steht in src/search-projection.ts.
export {
  SEARCH_PROJECTION_VERSION,
  SEARCH_PROJECTION_LANGUAGE,
  SEARCH_PROJECTION_FIELDS,
  SEARCH_PROJECTION_MATCH_FIELDS,
  MAX_SEARCH_TEXT_LENGTH,
  CLASSIFICATION_SOURCE,
  buildSearchProjection,
  searchProjectionContentHash,
  normalizeSearchFragment,
  normalizeSearchTerms,
  // JOB 1531 / JOB 3021 (N2): die DEKLARIERTE Wortzuordnung. Sie stand bis hierher nur den beiden
  // Suchadaptern desselben Moduls zur Verfuegung; der Fragepfad (services/ask) konnte sie hinter
  // der per dependency-cruiser erzwungenen Modulgrenze nicht erreichen und suchte deshalb nur nach
  // dem woertlich Getippten — dieselbe Frage, zwei Ergebnisse. Die Tabelle und die Grenzzusage
  // gehoeren mit heraus: wer erweitert, muss die belegten Paare LESEN koennen (der Fragepfad
  // rechnet sie in seine Termform um) und seine Zusicherung pruefen koennen.
  SUCH_ZUORDNUNGEN,
  S2_ERWEITERUNG_GRENZE,
  expandSearchTerms,
  type SuchZuordnung,
  visibleTextFromBodyHtml,
  classificationValueOf,
  classificationAtVersion,
  classificationFromVersionSnapshot,
  reconstructedClassification,
  isReconstructedClassification,
  resolveCapturedAt,
  serializeClassificationSnapshot,
  parseClassificationSnapshot,
  type KoSearchProjection,
  type KoSearchHit,
  type KoSearchQuery,
  type SearchProjectionStatus,
  type ClassificationSnapshot,
  type ClassificationValue,
  type ClassificationProvenance,
  type ClassificationConfidence,
  type CapturedAtSource,
} from "./src/search-projection";
export {
  InMemoryKoSearchProjectionRepo,
  type KoSearchProjectionRepo,
  // G27 R1 — der persistente Projection Control State (KW-ARCH-G27-PROJECTION-CONTROL-STATE-04).
  // DIE autoritative Quelle für aktive Projektionsfassung und Readiness; ohne Export wäre weder
  // die Kompositionswurzel noch eine Gegenprobe an den Zustand zu verdrahten.
  PROJECTION_STATES,
  UNINITIALIZED_CONTROL_STATE,
  controlStateLifecycleGueltig,
  freigegebeneProjektionsfassung,
  neuerProjektionsSpeicher,
  type InMemoryProjektionsSpeicher,
  type ProjectionAudit,
  type ProjectionControlState,
  type ProjectionState,
  // G27 R1 — Generation, atomare Freigabe und Integrität (KW-ARCH-G27-GENERATION-UND-INTEGRITAET-09).
  // Die vier konstanten Suchprüfungen und der generationsgebundene Marker sind exportiert, weil die
  // Startorchestrierung in `services/app/src/build-app.ts` einen vorgefundenen `V2_ACTIVE`-Zustand
  // validieren muss, OHNE ihn nachzubauen — und weil eine Gegenprobe sonst nur behaupten könnte,
  // was sie prüfen soll.
  freigegebeneProjektion,
  integritaetsMarkerFuer,
  integritaetsMarkerGueltig,
  type ProjectionControlSitzung,
} from "./src/search-projection-repo";
export {
  PgKoSearchProjectionRepo,
  // Additive DDL der Projektionstabelle — MUSS in services/app/src/db.ts migriert werden
  // (db.migrate.test.ts erzwingt genau das für jede exportierte DDL-Konstante).
  KO_SEARCH_PROJECTION_SCHEMA,
  // G27 R1: additive DDL der instanzweiten Steuertabelle — ebenfalls migrationspflichtig.
  KO_PROJECTION_CONTROL_SCHEMA,
} from "./src/search-projection-repo-pg";
// G27 Welle 1 / S2 — die VERÄNDERLICHE Metadatenprojektion (Schlüssel `ko_id`, eigene
// `metadata_revision`). Sie ist die zweite Hälfte des Suchvertrags, nicht sein Ersatz.
export {
  METADATA_PROJECTION_FIELDS,
  METADATA_PROJECTION_MATCH_FIELDS,
  METADATA_REVISION_NONE,
  metadataTextsOf,
  metadataTextsEqual,
  type KoMetadataProjection,
} from "./src/metadata-projection";
export {
  InMemoryKoMetadataProjectionRepo,
  type KoMetadataProjectionRepo,
  type KoMetadataProjectionResult,
  type KoMetadataProjectionUpsert,
} from "./src/metadata-projection-repo";
export {
  PgKoMetadataProjectionRepo,
  KO_METADATA_PROJECTION_SCHEMA,
} from "./src/metadata-projection-repo-pg";
// G27 Welle 1 — die Zusammensetzung beider Projektionsarten zu DER Sicht des Suchkonsumenten.
export {
  EFFECTIVE_SEARCH_DOCUMENT_FIELDS,
  composeEffectiveSearchDocument,
  matchEffectiveSearchDocument,
  type EffectiveSearchDocument,
} from "./src/effective-search-document";
export { KoError, KNOWLEDGE_TYPES, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from "./src/types";
// SCRUM-421: einstellbare Upload-Grenzen (persistiert).
export {
  type UploadLimits,
  type UploadLimitsRepo,
  DEFAULT_UPLOAD_LIMITS,
  UPLOAD_LIMITS_BOUNDS,
  normalizeUploadLimits,
  InMemoryUploadLimitsRepo,
  PgUploadLimitsRepo,
  UPLOAD_LIMITS_SCHEMA,
} from "./src/upload-limits";
export { displayStatus, type DisplayStatus } from "./src/display-status";
// JOB 557 (Pedi 13.08.2026): das kanonische Eigentümer-Aggregat. OHNE diesen Export bliebe es
// unerreichbar — und damit genau die unverdrahtete Empfangsstelle, die D5 gerügt hat. Der
// Validierungsdienst liest `responsibleOf`/`responsibleKindOf` über DIESE Fassade; eine Kante in
// die Modulinnereien gäbe es nicht.
export {
  normalizeOwnership,
  ownershipOf,
  responsibleKindOf,
  responsibleOf,
  sameOwnership,
  withRole,
} from "./src/ownership";
// SCRUM-527 (WP2): zentrale Quell-URL-Allowlist (nur absolute http/https) an der Persistenzgrenze.
export { safeSourceUrl, sanitizeSources } from "./src/source-url";
// SCRUM-415: Vertraulichkeitsstufen (Helfer + Konstante) — auch von anderen Modulen (Output) nutzbar.
export {
  CONFIDENTIALITY_LEVELS,
  // SCRUM-502: geteilter Egress-Filter für alle externen Kontexte (Modell/Embedder/Add-in).
  dropConfidential,
  isConfidential,
  normalizeConfidentiality,
  // SCRUM-509: strikte Validierung + Downgrade-Erkennung der Vertraulichkeitsstufe.
  isValidConfidentiality,
  confidentialityRank,
  isConfidentialityDowngrade,
  // JOB 3009: die Stufe als ausdrückliche AUSKUNFT (gültiger Wert oder `null` + Beleglage). Die
  // EINE Stelle für die Regel, die vorher an drei Lesewegen einzeln hingeschrieben stand; sie ist
  // ein Lesevertrag und kein Tor (die Begründung steht ausgeschrieben in src/confidentiality.ts).
  discloseConfidentiality,
} from "./src/confidentiality";
export type {
  ConfidentialityDisclosure,
  ConfidentialityProvenance,
} from "./src/confidentiality";
export type {
  EvidenceKind,
  EvidenceRecord,
  KnowledgeObject,
  // JOB 557: die Form des Eigentümer-Aggregats.
  KnowledgeOwnership,
  KnowledgeType,
  Confidentiality,
  KoStatus,
  HistoryEntry,
  KoComment,
  KoAttachment,
  // AUFTRAG-mega18 Block A-1: das Vorgangsgedächtnis der Verbund-Operation (am Objekt persistiert).
  KoAppendOp,
  // AUFTRAG-mega20 Block A: der Reparaturvermerk einer gescheiterten Rücknahme.
  KoRepairNote,
  // AUFTRAG-mega21 Block A: der Vorgangs-Datensatz (Eigentümer, Inhaltsabdruck, Zustand).
  KoCreateOperation,
  KoCreateOperationState,
  KoSource,
  KoSourceKind,
  KoVersionSnapshot,
  KoErrorCode,
  // SCRUM-422: Papierkorb-Zeile (Admin-Ansicht).
  TrashedKo,
  // WP-SUBMIT-ASYNC: Status der Hintergrund-KI-Prüfung (Job-Vermerk am KO).
  AiCheck,
  AiCheckStatus,
  // AUFTRAG-mega28 A2: Abdeckung des Prüf-Laufs (gedeckelt/übersprungen/abgebrochen).
  AiCheckCoverage,
  // AUFTRAG-mega29 C2: schmale Bestands-Zusammenfassung für die LEEREN Konflikt-/Duplikat-Boards.
  AiCheckCoverageSummary,
} from "./src/types";
