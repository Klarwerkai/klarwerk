// FR-CON-01: klassifizierte Konfliktarten.
export type ConflictType = "truth" | "experience" | "context" | "temporal" | "role";

export type ConflictStatus = "offen" | "eskaliert" | "zweitmeinung" | "geloest";

export interface Conflict {
  id: string;
  koA: string;
  koB: string;
  type: ConflictType;
  description: string;
  status: ConflictStatus;
  secondOpinion: string | null;
  decidedBy: string | null;
  decision: string | null;
  createdAt: string;
}

export interface ConflictInput {
  koA: string;
  koB: string;
  type: ConflictType;
  description: string;
}

export type ConflictErrorCode = "NOT_FOUND" | "NOT_ESCALATABLE" | "ALREADY_RESOLVED";

export class ConflictError extends Error {
  readonly code: ConflictErrorCode;

  constructor(code: ConflictErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ConflictError";
  }
}
