// Öffentliche API des Moduls knowledge-object.
export { KoService } from "./src/service";
export type { KoServiceDeps, CreateKoInput, ReviseKoInput } from "./src/service";
export { InMemoryKoRepo, type KoRepo, type KoFilter } from "./src/repo";
export { PgKoRepo, KO_SCHEMA } from "./src/repo-pg";
export { KoError, KNOWLEDGE_TYPES, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from "./src/types";
export { displayStatus, type DisplayStatus } from "./src/display-status";
export type {
  KnowledgeObject,
  KnowledgeType,
  KoStatus,
  HistoryEntry,
  KoComment,
  KoAttachment,
  KoSource,
  KoSourceKind,
  KoErrorCode,
} from "./src/types";
