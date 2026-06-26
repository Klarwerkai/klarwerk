// FR-ASK-05 / SCRUM-115: Priorität einer Wissenslücke. Default "mittel".
export type GapPriority = "hoch" | "mittel" | "niedrig";

export const GAP_PRIORITIES: readonly GapPriority[] = ["hoch", "mittel", "niedrig"];

export function isGapPriority(value: unknown): value is GapPriority {
  return value === "hoch" || value === "mittel" || value === "niedrig";
}

export interface Gap {
  id: string;
  question: string;
  status: "offen" | "geschlossen";
  assignee: string | null;
  priority: GapPriority;
  createdAt: string;
}

export type AskErrorCode = "NOT_FOUND" | "CONFIRM_REQUIRED" | "BAD_REQUEST";

export class AskError extends Error {
  readonly code: AskErrorCode;

  constructor(code: AskErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "AskError";
  }
}
