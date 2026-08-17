// Öffentliche API des Moduls audit.
export { AuditService } from "./src/service";
export type { AuditServiceDeps } from "./src/service";
export { InMemoryAuditRepo, type AuditRepo } from "./src/repo";
export {
  PgAuditRepo,
  AUDIT_SCHEMA,
  AUDIT_EVENT_ID_SCHEMA,
  AUDIT_HASH_VERSION_SCHEMA,
} from "./src/repo-pg";
export {
  verifyChain,
  hashEntry,
  inspectChain,
  GENESIS,
  MAX_PAYLOAD_ORDERINGS,
  // JOB 498 D8: die Hashversion nach außen. `hashEntry` bleibt der öffentliche V1-Name — kein
  // bestehender Import bricht.
  hashEntryV1,
  hashEntryV2,
  hashEntryFuerVersion,
  canonicalJson,
  AUDIT_HASH_VERSION_V1,
  AUDIT_HASH_VERSION_V2,
  AUDIT_HASH_DOMAIN_V2,
} from "./src/chain";
export type { ChainInspection, ChainDeviation, ChainDeviationKind } from "./src/chain";
export type { AuditEntry, AuditInput, AuditFilter } from "./src/types";
