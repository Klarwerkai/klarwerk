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
// SCRUM-121: Anhang rückwärtskompatibel. Alt-Anhänge tragen `dataUrl` (Inline-Original);
// neue Anhänge tragen `objectId` (Referenz auf den Object-Store) + kleine `thumbnail`-Vorschau.
export interface KoAttachment {
  id: string;
  name: string;
  mime: string;
  dataUrl?: string; // Alt-Anhänge (Inline)
  objectId?: string; // neue Anhänge: Referenz ins object-store
  thumbnail?: string; // kleine Vorschau (Daten-URL)
  size?: number; // Originalgröße im Object-Store
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
  // SCRUM-118: optionaler Anbieter externer Quellen (z. B. "Wikipedia"). Additiv,
  // JSON-persistiert → keine Migration; Altquellen ohne provider bleiben gültig.
  provider?: string | null;
  author: string;
  at: string;
}

// FR-KO-01: Datenmodell inkl. version/history/originalAuthor/needed/assignments/asset
// (Pflichtenheft §3.5, Technischer Anhang §1).
export interface KnowledgeObject {
  id: string;
  title: string; // Titel als Aussage
  statement: string; // bleibt Plaintext-Kurzfassung (Output/Ask/Suche)
  // KW-STR / SCRUM-45/46/48: optionaler WYSIWYG-Body als sanitisiertes HTML (additiv).
  bodyHtml?: string | null;
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
  // Demodaten-Merker (Pedi 02.07.): vom Seed gesetzt, überlebt Bearbeitungen/Versionen —
  // damit Demo-Bestand sichtbar bleibt und komplett entfernt werden kann.
  demoSeed?: boolean;
}

// SCRUM-159 (Knowledge-OS-Foundation): unveränderlicher Voll-Snapshot eines KO je Version.
// Hält den kompletten Stand bei Versions-Erstellung (create/revise) fest. Aktuelles KO bleibt
// canonical current state; Snapshots sind reine Foundation-Infrastruktur (kein UI-Feature).
export interface KoVersionSnapshot {
  koId: string;
  version: number;
  snapshot: KnowledgeObject; // vollständiger Stand dieser Version
  at: string;
  author: string;
  note: string;
}

// SCRUM-160 (Knowledge-OS-Foundation): separate Evidence-Records für externe Quellen
// und Objekt-Anhänge. Additiv zur bestehenden KO-Struktur; keine UI-/API-Änderung.
export type EvidenceKind = "source" | "attachment";

export interface EvidenceRecord {
  id: string;
  koId: string;
  koVersion: number;
  kind: EvidenceKind;
  sourceId?: string;
  attachmentId?: string;
  objectId?: string;
  label: string;
  mime?: string;
  url?: string | null;
  provider?: string | null;
  createdBy: string;
  createdAt: string;
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
