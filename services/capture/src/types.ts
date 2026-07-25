import type { Confidentiality, KnowledgeType } from "../../knowledge-object";

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
  // SCRUM-509 R2: die im Erfassen gewählte Vertraulichkeit übersteht Entwurf/Resume/Promote —
  // sonst ginge die Stufe beim Promote verloren (fail-open). toKoInput reicht sie ans KO durch.
  confidentiality?: Confidentiality;
  // UI-Herkunft fuer Resume-Routing; keine Persistenzlogik, nur Payload-Metadatum.
  origin?: "tell" | "studio" | "expert" | "frontdoor";
  // AUFTRAG-mega4/mega5 Block A (bens Auflage A): der Entwurf traegt AUCH die uebrigen inhaltlichen,
  // textuell sicherbaren Dirty-Felder, damit „Entwurf speichern" nichts still verliert und
  // „Fortsetzen" sie wiederherstellt: Prueferauswahl, offene/teilweise Quelle, externe Suchanfrage
  // und Interviewfortschritt. `sourceProvider` = Such-/Herkunftsquelle des Treffers (bens Vorschlag),
  // NICHT ein KI-Anbieter. Der volle Treffer-Cache (extResults) wird nach Pedis Datenminimierungs-
  // Entscheid (mega5 Block C) bewusst NICHT persistiert; normalizeDraftPayload streift ihn ab.
  // Alle diese Strukturen werden an der Persistenz-Grenze typ-, mengen- und laengenbegrenzt
  // normalisiert (mega5 Block B, s. service.ts).
  reviewerIds?: string[];
  pendingSources?: { label: string; url?: string; excerpt?: string; sourceProvider?: string }[];
  sourceForm?: { label: string; url: string; excerpt: string };
  extQuery?: string;
  interview?: {
    started: boolean;
    answers: string[];
    answer?: string;
    question?: string;
    done?: boolean;
    demo?: boolean;
  };
}

export interface Draft {
  id: string;
  payload: DraftPayload;
  originalAuthor: string;
  lastEditor: string;
  createdAt: string;
  updatedAt: string;
}

export type CaptureErrorCode = "NOT_FOUND" | "INVALID_NEEDED" | "INCOMPLETE" | "EMPTY_DRAFT";

export class CaptureError extends Error {
  readonly code: CaptureErrorCode;

  constructor(code: CaptureErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "CaptureError";
  }
}
