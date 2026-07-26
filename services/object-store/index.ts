// Öffentliche API des Moduls object-store (SCRUM-121).
export { ObjectStore, inferKind, decodeDataUrl } from "./src/service";
// AUFTRAG-mega20 Block C: die beiden Urteile über ein Objekt, die ein späterer Aufräumlauf braucht
// — und die BEIDE konservativ ausfallen, wenn die Zuordnung fehlt oder unlesbar ist.
export { isTransientMedia, isWithinRetention } from "./src/service";
export type { ObjectStoreDeps, PutObjectInput } from "./src/service";
export { InMemoryObjectRepo, type ObjectRepo } from "./src/repo";
export { PgObjectRepo, OBJECTSTORE_SCHEMA } from "./src/repo-pg";
export { ObjectError, MAX_OBJECT_BYTES, OBJECT_RETENTION_DAYS } from "./src/types";
export type {
  ObjectKind,
  ObjectRef,
  StoredObject,
  ObjectErrorCode,
  // AUFTRAG-mega20 Block C: der Lebenszyklus-Vertrag am Objekt.
  ObjectLifecycle,
  ObjectPurpose,
} from "./src/types";
