// Öffentliche API des Moduls object-store (SCRUM-121).
export { ObjectStore, inferKind, decodeDataUrl } from "./src/service";
export type { ObjectStoreDeps, PutObjectInput } from "./src/service";
export { InMemoryObjectRepo, type ObjectRepo } from "./src/repo";
export { ObjectError, MAX_OBJECT_BYTES } from "./src/types";
export type { ObjectKind, ObjectRef, StoredObject, ObjectErrorCode } from "./src/types";
