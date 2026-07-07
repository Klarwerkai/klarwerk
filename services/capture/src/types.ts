import type { KnowledgeType } from "../../knowledge-object";

// Roh-Inhalt eines Entwurfs (wird später zu einem KO strukturiert/eingereicht).
export interface DraftPayload {
  title?: string;
  statement?: string;
  type?: KnowledgeType;
  category?: string;
  tags?: string[];
  conditions?: string[];
  measures?: string[];
  neededValidations?: number;
  asset?: string | null;
  bodyHtml?: string | null; // KW-STR: WYSIWYG-Body übersteht Entwurf/Resume/Promote
  // UI-Herkunft fuer Resume-Routing; keine Persistenzlogik, nur Payload-Metadatum.
  origin?: "tell" | "studio" | "expert" | "frontdoor";
}

export interface Draft {
  id: string;
  payload: DraftPayload;
  originalAuthor: string;
  lastEditor: string;
  createdAt: string;
  updatedAt: string;
}

export type CaptureErrorCode = "NOT_FOUND" | "INVALID_NEEDED" | "INCOMPLETE";

export class CaptureError extends Error {
  readonly code: CaptureErrorCode;

  constructor(code: CaptureErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "CaptureError";
  }
}
