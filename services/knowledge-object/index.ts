// Öffentliche API des Moduls knowledge-object.
export {
  KoService,
  normalizeEvidenceLimit,
  DEFAULT_EVIDENCE_LIMIT,
  MAX_EVIDENCE_LIMIT,
  TRUTH_CONFLICT_TRUST_PENALTY,
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
  type EvidenceRepo,
  type KoRepo,
  type KoVersionRepo,
  type KoFilter,
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
  KO_VERSIONS_SCHEMA,
} from "./src/repo-pg";
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
} from "./src/confidentiality";
export type {
  EvidenceKind,
  EvidenceRecord,
  KnowledgeObject,
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
