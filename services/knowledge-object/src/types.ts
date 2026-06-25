// FR-KO-02: fünf Wissensarten (Pflichtenheft §3.5).
export type KnowledgeType =
  | "bauchgefuehl"
  | "best_practice"
  | "lernkurve"
  | "technik"
  | "negativwissen";

export const KNOWLEDGE_TYPES: readonly KnowledgeType[] = [
  "bauchgefuehl",
  "best_practice",
  "lernkurve",
  "technik",
  "negativwissen",
];

export type KoStatus = "offen" | "validiert";

export interface HistoryEntry {
  version: number;
  at: string;
  author: string;
  note: string;
}

// FR-KO-06: Diskussion/Kommentare am Objekt (Peer-Austausch, Revisions-Schleife).
export interface KoComment {
  id: string;
  author: string;
  text: string;
  at: string;
}

// FR-CAP-05: Anhang/Foto am Objekt. Pilot: client-seitig verkleinertes Thumbnail
// als Daten-URL (keine Objektspeicher-Infrastruktur nötig, größenbegrenzt).
export interface KoAttachment {
  id: string;
  name: string;
  mime: string;
  dataUrl: string;
  author: string;
  at: string;
}

// Obergrenzen für den Pilot (kleine Thumbnails, JSONB bleibt handhabbar).
export const MAX_ATTACHMENT_BYTES = 700_000; // ~700 KB Daten-URL
export const MAX_ATTACHMENTS = 8;

// SCRUM-129 / FR-KO-07: echte Quelle am Objekt. Externe Quellen sind NIE peer-validiert
// (klare Stufe-2-Markierung); kein automatisches Peer-Validation-Verfahren.
export type KoSourceKind = "external";

export interface KoSource {
  id: string;
  label: string;
  url: string | null;
  excerpt: string | null;
  kind: KoSourceKind;
  peerValidated: boolean;
  author: string;
  at: string;
}

// FR-KO-01: Datenmodell inkl. version/history/originalAuthor/needed/assignments/asset
// (Pflichtenheft §3.5, Technischer Anhang §1).
export interface KnowledgeObject {
  id: string;
  title: string; // Titel als Aussage
  statement: string;
  conditions: string[];
  measures: string[];
  type: KnowledgeType;
  category: string;
  tags: string[];
  confidence: number;
  trust: number;
  status: KoStatus;
  version: number;
  originalAuthor: string;
  author: string;
  neededValidations: number;
  assignments: string[];
  asset: string | null;
  createdAt: string;
  history: HistoryEntry[];
  comments: KoComment[];
  attachments: KoAttachment[];
  sources: KoSource[];
}

export type KoErrorCode = "NOT_FOUND" | "INVALID_TYPE" | "INVALID_NEEDED" | "INVALID_SOURCE";

export class KoError extends Error {
  readonly code: KoErrorCode;

  constructor(code: KoErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "KoError";
  }
}
