// Öffentliche API des Moduls validation.
export { ValidationService } from "./src/service";
export type { ValidationServiceDeps, BoardFilter, AssignmentSummary } from "./src/service";
export { computeOutcome } from "./src/trust";
export type { ValidationOutcome } from "./src/trust";
export {
  InMemoryRatingRepo,
  InMemoryAssignmentRepo,
  type RatingRepo,
  type AssignmentRepo,
} from "./src/repo";
export { ValidationError } from "./src/types";
export type { Verdict, Rating, Assignment, ValidationErrorCode } from "./src/types";
