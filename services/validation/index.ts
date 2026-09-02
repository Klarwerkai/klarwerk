// Öffentliche API des Moduls validation.
export { ValidationService } from "./src/service";
export type {
  ValidationServiceDeps,
  BoardFilter,
  AssignmentSummary,
  AssignmentNotice,
} from "./src/service";
export { computeOutcome, TRUST_WEIGHTS, TRUST_MAX } from "./src/trust";
export type { ValidationOutcome } from "./src/trust";
export {
  InMemoryRatingRepo,
  InMemoryAssignmentRepo,
  type RatingRepo,
  type AssignmentRepo,
} from "./src/repo";
export { PgRatingRepo, PgAssignmentRepo, VALIDATION_SCHEMA } from "./src/repo-pg";
// SCRUM-395: Standard-Prüferanzahl als persistierte Admin-Einstellung.
export {
  FALLBACK_NEEDED_VALIDATIONS,
  MIN_NEEDED_VALIDATIONS,
  MAX_NEEDED_VALIDATIONS,
  normalizeDefaultNeeded,
  InMemoryValidationSettingsRepo,
  PgValidationSettingsRepo,
  VALIDATION_SETTINGS_SCHEMA,
  type ValidationSettingsRepo,
} from "./src/settings";
// JOB 3003: Stufe und Herkunft als Board-Auskunft (reine Lese-Sicht). Die Route wendet sie NACH
// dem Sichtbarkeitsfilter an — die Begruendung steht ausgeschrieben in board-herkunft.ts.
// JOB 3009: die STUFENhaelfte wohnt seit dieser Runde in `knowledge-object`
// (`discloseConfidentiality`), damit Board und Detailabruf dieselbe Regel rufen. Dieser Vertrag
// bleibt fuer bestehende Aufrufer unveraendert benutzbar — `ConfidentialityProvenance` reist
// weiter durch diese Fassade.
export { mitHerkunft } from "./src/board-herkunft";
export type {
  BoardHerkunft,
  BoardQuellenhinweis,
  ConfidentialityProvenance,
  HerkunftsFakten,
} from "./src/board-herkunft";
export { ValidationError } from "./src/types";
export type { Verdict, Rating, Assignment, ValidationErrorCode } from "./src/types";
