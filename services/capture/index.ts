// Öffentliche API des Moduls capture.
export { CaptureService } from "./src/service";
export type { CaptureServiceDeps } from "./src/service";
export { InMemoryDraftRepo, type DraftRepo } from "./src/repo";
// JOB 2697: `CAPTURE_CREATE_OPERATION_SCHEMA` gehört zur öffentlichen Fläche, weil `db.ts` die
// Migrationsliste aus den Modul-Exporten zieht (`services/app/src/db.ts:5`). Ohne diesen Export
// wäre die Stufe gebaut und würde nie laufen — der Index entstünde nie, und die ganze Zusage hinge
// an einer DDL, die niemand absetzt. Genau davor warnt `tests/capture/aufrufer-waechter.test.ts`.
export { PgDraftRepo, CAPTURE_SCHEMA, CAPTURE_CREATE_OPERATION_SCHEMA } from "./src/repo-pg";
// R-1349: `InterviewSession` (deterministisches Interview, FR-CAP-02) ist entfernt — das Interview
// läuft über den Reasoner (`reasoner-routes.ts`, Aufgabe `interview`); die Klasse rief niemand.
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
// BILDSCHIRMABLÄUFE: Grenzen und Gestalt des übernommenen Ablaufs am Entwurf.
export {
  ABLAUF_GRENZEN,
  type DraftAblauf,
  type DraftAblaufQuelle,
  type DraftAblaufSchritt,
} from "./src/ablauf";
export type { Draft, DraftPayload, CaptureErrorCode } from "./src/types";
