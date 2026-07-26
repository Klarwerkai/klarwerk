// Öffentliche API des Moduls capture.
export { CaptureService } from "./src/service";
export type { CaptureServiceDeps } from "./src/service";
export { InMemoryDraftRepo, type DraftRepo } from "./src/repo";
export { PgDraftRepo, CAPTURE_SCHEMA } from "./src/repo-pg";
export { InterviewSession } from "./src/interview";
export { CaptureError } from "./src/types";
// AUFTRAG-mega22 Block D: die Gestaltprüfung der Entwurfsladung gehört zum öffentlichen
// Modulvertrag — sie ist der RAND, an dem Formfehler abgewiesen werden, statt in der Tiefe zu
// entstehen und dort als Störung getarnt zu werden.
export {
  validateDraftPayloadShape,
  type DraftPayloadShapeResult,
} from "./src/draft-payload-schema";
// AUFTRAG-mega6 Block D: die gemeinsamen Persistenzgrenzen sind Teil des öffentlichen Modulvertrags.
export { DRAFT_LIMITS } from "./src/draft-limits";
export type { Draft, DraftPayload, CaptureErrorCode } from "./src/types";
