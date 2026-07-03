// FR-VAL-01: Peer-Bewertung ✅ / ⚠️ / ❌.
export type Verdict = "up" | "warn" | "down";

export interface Rating {
  koId: string;
  userId: string;
  verdict: Verdict;
  createdAt: string;
}

export interface Assignment {
  koId: string;
  userId: string;
  status: "open" | "done";
}

// SCRUM-395: INVALID_DEFAULT = ungültige Standard-Prüferanzahl (Admin-Einstellung).
export type ValidationErrorCode = "NOT_FOUND" | "INVALID_DEFAULT";

export class ValidationError extends Error {
  readonly code: ValidationErrorCode;

  constructor(code: ValidationErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ValidationError";
  }
}
