// Öffentliche API des Moduls audit.
export { AuditService } from "./src/service";
export type { AuditServiceDeps } from "./src/service";
export { InMemoryAuditRepo, type AuditRepo } from "./src/repo";
export { PgAuditRepo, AUDIT_SCHEMA } from "./src/repo-pg";
export { verifyChain, hashEntry, GENESIS } from "./src/chain";
export type { AuditEntry, AuditInput, AuditFilter } from "./src/types";
