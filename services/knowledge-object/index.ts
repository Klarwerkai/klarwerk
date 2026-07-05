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
export type { KoServiceDeps, CreateKoInput, ReviseKoInput } from "./src/service";
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
// SCRUM-415: Vertraulichkeitsstufen (Helfer + Konstante) — auch von anderen Modulen (Output) nutzbar.
export {
  CONFIDENTIALITY_LEVELS,
  isConfidential,
  normalizeConfidentiality,
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
  KoSource,
  KoSourceKind,
  KoVersionSnapshot,
  KoErrorCode,
  // SCRUM-422: Papierkorb-Zeile (Admin-Ansicht).
  TrashedKo,
} from "./src/types";
