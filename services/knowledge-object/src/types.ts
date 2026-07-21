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

// SCRUM-415: Vertraulichkeitsstufe je Wissensobjekt. „intern" = Öffentlich-intern (Standard, keine
// Einschränkung); „vertraulich"/„streng_vertraulich" = vertraulich → gehen NIE in externe Kontexte
// (Output Factory/Export). Fehlt das Feld (Alt-KOs), gilt „intern".
// WP-SUBMIT-ASYNC: Zustand des Hintergrund-Prüf-Jobs. pending = eingereiht/laufend; done = die
// Erkennung lief (Ergebnis-Signale liegen in conflicts/overlaps); failed = EHRLICH gescheitert
// (fallbackReason: no-model/model-error) — nie stiller Verlust, nie erfundenes Ergebnis.
export type AiCheckStatus = "pending" | "done" | "failed";
export interface AiCheck {
  status: AiCheckStatus;
  requestedAt: string;
  finishedAt?: string;
  fallbackReason?: string;
}

export type Confidentiality = "intern" | "vertraulich" | "streng_vertraulich";

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
// WP-D2: konsistent zur Werksvorgabe DEFAULT_UPLOAD_LIMITS (upload-limits.ts) — dokumententauglich.
export const MAX_ATTACHMENT_BYTES = 20_000_000; // ~20 MB Daten-URL
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
  // SCRUM-470 (Confluence-Import): strukturierte Herkunfts-Anker für Rückverfolgbarkeit UND
  // idempotenten Re-Sync. externalId = Confluence pageId (Idempotenz-Schlüssel). Additiv,
  // JSON-persistiert → keine Migration; Altquellen ohne diese Felder bleiben gültig.
  externalId?: string;
  spaceKey?: string;
  sourceVersion?: number;
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
  // WP-BILD-1g (bens sammel14-ROT): ABGELEITETES Suchfeld — die Bild-Fußnoten (figcaption-Texte)
  // des bodyHtml, beim SCHREIBEN mit dem body-sparenden Scanner extrahiert (create/revise). Die
  // Bibliotheks-Suche liest NUR dieses kleine Feld; bodyHtml wird für die Suche nicht mehr geladen.
  // Optional/additiv im JSONB-Dokument (keine Migration): FEHLT das Feld, ist es ein Legacy-KO von
  // vor dieser Regel → einmaliger Backfill beim ersten Such-Kandidaten (danach immer gesetzt, auch
  // als [] für „keine Fußnoten").
  captionTexts?: string[];
  conditions: string[];
  measures: string[];
  type: KnowledgeType;
  category: string;
  tags: string[];
  confidence: number;
  trust: number;
  status: KoStatus;
  version: number;
  // SCRUM-509 R3: monoton wachsender Nebenläufigkeits-Token für optimistische Concurrency auf DB-Ebene.
  // Jeder Write vergleicht ihn (Compare-and-Set): ein veralteter Voll-Objekt-Write scheitert (StaleWrite)
  // statt eine zwischenzeitliche Änderung (z. B. Vertraulichkeits-Upgrade) zu überschreiben. Fehlt das
  // Feld (Alt-Daten), gilt 0.
  rowVersion?: number;
  originalAuthor: string;
  author: string;
  neededValidations: number;
  assignments: string[];
  // SCRUM-415: Vertraulichkeitsstufe (fehlt = „intern"). Vertrauliche KOs gehen nie in externe Kontexte.
  confidentiality?: Confidentiality;
  // Pedi 05.07.: read-only Board-Anreicherung — Peer-Stimmen-Zähler (grün/gelb/rot) für die Anzeige
  // „X von Y grün" auf der Validierungsseite. Nur die Board-Sicht setzt es; sonst undefined.
  reviewVotes?: { up: number; warn: number; down: number };
  asset: string | null;
  createdAt: string;
  history: HistoryEntry[];
  comments: KoComment[];
  attachments: KoAttachment[];
  sources: KoSource[];
  // Demodaten-Merker (Pedi 02.07.): vom Seed gesetzt, überlebt Bearbeitungen/Versionen —
  // damit Demo-Bestand sichtbar bleibt und komplett entfernt werden kann.
  demoSeed?: boolean;
  // WP-SUBMIT-ASYNC (Pedis R3 21.07.): Status der HINTERGRUND-KI-Prüfung nach dem Einreichen —
  // additiv im JSONB, keine Migration; Altbestand ohne Feld = kein Prüf-Job. Die Ergebnis-Signale
  // (Konflikte/Überschneidungen) entstehen unverändert in ihren Services — aiCheck trägt nur den
  // ehrlichen Job-Status für die Validierungs-Anzeige.
  aiCheck?: AiCheck;
  // SCRUM-422 (Papierkorb): gesetzt beim Soft-Delete. Getrashte KOs sind aus ALLEN
  // Lese-/Mutations-Pfaden ausgeblendet (wirken gelöscht) und werden nach Ablauf der
  // Frist automatisch endgültig entfernt. Demo-Daten landen NIE hier (immer hart).
  deletedAt?: string;
  deletedBy?: string;
}

// SCRUM-422: Papierkorb-Zeile für den Admin — nur Metadaten, keine Inhalte.
export interface TrashedKo {
  id: string;
  title: string;
  category: string;
  deletedAt: string;
  deletedBy: string;
  // Wann die automatische Endlöschung greift (deletedAt + TRASH_RETENTION_DAYS).
  expiresAt: string;
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

export type KoErrorCode =
  | "NOT_FOUND"
  | "INVALID_TYPE"
  | "INVALID_NEEDED"
  | "INVALID_SOURCE"
  // SCRUM-421: ungültige Upload-Grenzen (Admin-Einstellung).
  | "INVALID_UPLOAD_LIMITS"
  // SCRUM-509: ungültige Vertraulichkeitsstufe (kein stilles Normalisieren auf „intern").
  | "INVALID_CONFIDENTIALITY"
  // SCRUM-509 R2: Herabstufung ohne Prüfer-/Admin-Rolle (atomar an der Datenschicht geprüft).
  | "DOWNGRADE_FORBIDDEN"
  // SCRUM-509 R3: optimistische Concurrency — der Voll-Objekt-Write war veraltet (rowVersion-Konflikt).
  | "STALE_WRITE";

export class KoError extends Error {
  readonly code: KoErrorCode;

  constructor(code: KoErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "KoError";
  }
}
