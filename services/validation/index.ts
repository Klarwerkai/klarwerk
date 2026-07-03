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
export { ValidationError } from "./src/types";
export type { Verdict, Rating, Assignment, ValidationErrorCode } from "./src/types";
