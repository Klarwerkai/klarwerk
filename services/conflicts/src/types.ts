// FR-CON-01: klassifizierte Konfliktarten.
export type ConflictType = "truth" | "experience" | "context" | "temporal" | "role";

export type ConflictStatus = "offen" | "eskaliert" | "zweitmeinung" | "geloest";

// Konzept 04.07. (Stufe 1): warum ein Konflikt endete. Additiv/optional — Alt-Daten haben das
// Feld nicht (JSON-persistiert, keine DB-Migration). "participant_deleted" = ein Beteiligter
// wurde gelöscht (systemische Beendigung, kein menschlicher Entscheider).
export type ConflictResolutionReason =
  | "decided"
  | "dismissed"
  | "participant_deleted"
  | "edited_no_conflict"
  | "withdrawn";

// Berater-Konzept 04.07. (Stufe 4): Herkunft eines Konflikts. Additiv/optional — Alt-Daten ohne das
// Feld gelten als „manuell" (Anzeige-Fallback). „auto" = von der Erkennung angelegt (mit detector).
export type ConflictOrigin = "manual" | "auto";

// SCRUM-492: strukturierte Kollisionsfelder eines Widerspruchs — je Seite knappe Kernaussage +
// konkret kollidierender „streitwert" (z. B. „blau"/„rot"). streitwertWoertlich = der Streitwert
// kommt wörtlich aus dem zugehörigen Belegzitat (Parser-geprüft). Additiv/optional, JSON-persistiert.
export interface KollisionSeite {
  kernaussage: string;
  streitwert: string;
  streitwertWoertlich: boolean;
}
export interface Kollision {
  streitpunkt: string;
  seiteA: KollisionSeite;
  seiteB: KollisionSeite;
}

// Metadaten der automatischen Erkennung (nur bei origin="auto") — macht den Fund erklärbar und
// reproduzierbar: Begründung + wörtliche Belegzitate + Sicherheit + promptVersion. Keine Secrets.
export interface ConflictDetector {
  trigger: "validation" | "ask" | "background";
  method: "model" | "deterministic";
  modelLabel?: string;
  promptVersion?: string;
  confidence?: number;
  rationale?: string;
  quotes?: { a: string; b: string };
  // SCRUM-492: strukturierte Gegenüberstellung für die Board-Kacheln (optional, additiv).
  kollision?: Kollision;
}

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
  resolutionReason?: ConflictResolutionReason;
  // Berater-Konzept 04.07. (Stufe 4): Herkunft + Erkennungs-Metadaten (additiv, JSON-persistiert).
  origin?: ConflictOrigin;
  detector?: ConflictDetector;
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
