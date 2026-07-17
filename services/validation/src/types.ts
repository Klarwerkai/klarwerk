// FR-VAL-01: Peer-Bewertung ✅ / ⚠️ / ❌.
export type Verdict = "up" | "warn" | "down";

export interface Rating {
  koId: string;
  userId: string;
  verdict: Verdict;
  createdAt: string;
  // SCRUM-507 R2: die KO-Version, die DIESE Bewertung bewertet hat. Wird beim Bewerten gestempelt.
  // Nur Bewertungen der AKTUELLEN KO-Version zählen für Trust/Status; frühere sind „stale" (bleiben
  // aber als Historie erhalten). Additiv in der JSONB-Ablage — keine DDL-Migration nötig. Alt-
  // Bewertungen ohne Feld gelten als Version 1 (häufigster Fall; auf revidierten KOs damit stale).
  koVersion?: number;
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
