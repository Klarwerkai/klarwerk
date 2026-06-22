export interface Gap {
  id: string;
  question: string;
  status: "offen" | "geschlossen";
  assignee: string | null;
  createdAt: string;
}

export type AskErrorCode = "NOT_FOUND" | "CONFIRM_REQUIRED";

export class AskError extends Error {
  readonly code: AskErrorCode;

  constructor(code: AskErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AskError";
  }
}
