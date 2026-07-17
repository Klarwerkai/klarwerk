import type { Confidentiality, KnowledgeType } from "../../knowledge-object";

export interface ImportItem {
  title: string;
  statement: string;
  type: KnowledgeType;
  category: string;
  author?: string;
  tags?: string[];
  // SCRUM-509 R3: optionale Vertraulichkeit aus einem Quell-Governance-Signal (SCRUM-511). FEHLT sie,
  // stuft der Import-Pfad KONSERVATIV auf „vertraulich" ein (kein stiller intern-Default auf Bulk-Pfaden).
  confidentiality?: Confidentiality;
  // SCRUM-470 (Confluence-Import): Herkunfts-Anker. pageId = Idempotenz-Schlüssel (Re-Sync per Seite).
  // Generisch gehalten (library-analytics kennt Confluence nicht) — die Import-Route füllt sie.
  pageId?: string;
  spaceKey?: string;
  sourceVersion?: number;
  url?: string;
  provider?: string;
  bodyHtml?: string;
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

// SCRUM-116: Import-/Source-Review-Kandidaten (JSON-Re-Import mit Review-Queue).
export type ReviewStatus = "neu" | "angenommen" | "abgelehnt" | "info-angefragt";
export type ReviewAction = "accept" | "reject" | "info";

export interface ImportCandidate {
  id: string;
  item: ImportItem;
  status: ReviewStatus;
  // Gleiche title|statement existiert bereits → wird beim Annehmen NICHT überschrieben.
  duplicate: boolean;
  note: string | null;
  // Bei „angenommen" und nicht-Dublette: das erzeugte Wissensobjekt.
  koId: string | null;
  createdAt: string;
}

export type LibraryErrorCode = "NOT_FOUND" | "ALREADY_REVIEWED" | "BAD_REQUEST";

export class LibraryError extends Error {
  readonly code: LibraryErrorCode;

  constructor(code: LibraryErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "LibraryError";
  }
}

// FR-LIB-03: Bus-Faktor — Domänen/Kategorien mit Einzelquelle.
export interface BusFactorEntry {
  category: string;
  authorCount: number;
  koCount: number;
  singleSource: boolean;
}

// Consultant-System (Experten-Matching): Thema → beitragende Personen — als Hilfe „wen könnte man zu
// diesem Thema einbeziehen". BEWUSST nur Thema→Person (kein Personen-Profil), ohne Score/Trust/
// Rangfolge/Zeitreihe (anti-Gamification). `koCount` ist reiner Kontext, KEINE Sortier-/Ranggröße.
export interface ExpertiseContributor {
  authorId: string;
  koCount: number;
}

export interface ExpertiseEntry {
  category: string;
  contributors: ExpertiseContributor[];
}

// FR-LIB-04: Wissensgraph.
export interface GraphNode {
  id: string;
  title: string;
}

export interface GraphEdge {
  a: string;
  b: string;
  via: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// FR-ANA-01: Kennzahlen.
export interface Analytics {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
}
