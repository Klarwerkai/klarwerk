// Öffentliche API des Moduls knowledge-object.
export { KoService } from "./src/service";
export type { KoServiceDeps, CreateKoInput, ReviseKoInput } from "./src/service";
export { InMemoryKoRepo, type KoRepo, type KoFilter } from "./src/repo";
export { KoError, KNOWLEDGE_TYPES } from "./src/types";
export type {
  KnowledgeObject,
  KnowledgeType,
  KoStatus,
  HistoryEntry,
  KoErrorCode,
} from "./src/types";
