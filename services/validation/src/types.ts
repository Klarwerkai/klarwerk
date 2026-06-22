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

export type ValidationErrorCode = "NOT_FOUND";

export class ValidationError extends Error {
  readonly code: ValidationErrorCode;

  constructor(code: ValidationErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ValidationError";
  }
}
