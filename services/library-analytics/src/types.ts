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
  // SCRUM-510 R2b: QUELLNEUTRALE Provenienz/Herkunfts-Anker. externalId = Idempotenz-/Re-Sync-Schlüssel
  // je Quell-Objekt (Confluence-pageId, Jira-Issue-Key, …); sourceScope = Quell-Container (Confluence-
  // Space, Jira-Projekt, …). Der Import-Kern kennt keine quell-spezifischen Begriffe — ein Adapter #2
  // (Jira) füllt dieselben Felder ohne Confluence-Symbole.
  externalId?: string;
  sourceScope?: string;
  sourceVersion?: number;
  url?: string;
  provider?: string;
  bodyHtml?: string;
  // IC-1 (Import-Cockpit): OPTIONALER ISO-Zeitstempel der letzten Quell-Änderung (z. B. Confluence
  // version.when). Rein additiv — nur für die Read-only-Erkundung (Zeitraum); kein Adapter MUSS es
  // füllen, kein Import-Pfad hängt davon ab.
  updatedAt?: string;
  // WP-IC-PAKET-1c/1d (bens ROT-2 + sammel9): DECODE-MARKER. "decoded" = die textuellen Felder sind
  // KANONISCH — die Anzeige darf NICHT erneut dekodieren (sonst wird ein echtes Literal &uuml;
  // faelschlich zu ü). ZENTRALE ERZEUGUNGSREGEL (1d): createImportCandidates stempelt JEDES neue Item
  // autoritativ an der einen Ingest-Grenze (deckt Confluence-Import, JSON-Re-Import-Route und
  // Demo-Korpus ab); der Confluence-Mapper setzt den Marker zusaetzlich bereits bei der Erzeugung
  // (Explore/Select laufen ohne Kandidaten-Erzeugung direkt auf Mapper-Items). FEHLT der Marker, ist
  // es ECHTER Altbestand (gespeichert vor dieser Regel) → defensiver Anzeige-Decode. JSON-persistiert.
  textCodec?: "decoded";
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

// SCRUM-510: quell-agnostischer Import-Vertrag. Ein Adapter (Confluence = #1, Jira-TEST später = #2)
// liest seine Quelle und liefert NORMALISIERTE ImportItems; der Import-Kern (createImportCandidates →
// acceptToKo) kennt die Quelle nicht. Neue Quelle = neuer Adapter, KEIN Umbau des Import-Kerns.
export interface SourceAdapter {
  // Menschlicher Quell-Name (z. B. "Confluence") — Provenienz/Diagnose.
  readonly source: string;
  collect(): Promise<ImportItem[]>;
}

// SCRUM-116: Import-/Source-Review-Kandidaten (JSON-Re-Import mit Review-Queue).
// WP-SHIP8-CLOSE-2 (bens F1): "in_bearbeitung" ist der TRANSIENTE Claim-Status einer laufenden
// Review-Aktion (Status-CAS 'neu' → 'in_bearbeitung' am Aktions-BEGINN). Er schützt den
// Kandidaten vor dem bedingten Cleanup-Delete, solange der Accept noch im KO-Schritt hängt;
// die Aktion persistiert am Ende den echten Endstatus (bzw. gibt den Claim bei Fehlern zurück).
export type ReviewStatus = "neu" | "in_bearbeitung" | "angenommen" | "abgelehnt" | "info-angefragt";
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
  // WP-SHIP8-CLOSE-3 (bens ROT-1): Lease-Protokoll des Claims — beide Felder existieren NUR bei
  // status "in_bearbeitung" (resolveClaim räumt sie beim Abschluss immer aus).
  // opId = eindeutige Operations-Id GENAU DIESER Review-Aktion; der Accept stempelt sie ans neu
  // erzeugte KO (importOpId), BEVOR der Endstatus geschrieben wird — die Crash-Recovery erkennt
  // daran, ob die Operation vollendet werden muss (KO existiert) oder sicher neu startbar ist.
  opId?: string | undefined;
  // Lease-Beginn (ISO): erst nach Ablauf von REVIEW_CLAIM_LEASE_MS greift die Recovery — ein
  // LAUFENDER Claim wird nie angefasst.
  claimedAt?: string | undefined;
  // WP-SHIP8-CLOSE-6 (bens ROT-3a): WER/WANN der Review-Entscheidung — IM SELBEN Statuswrite
  // persistiert (resolveClaim) und damit unverlierbar im Produktbestand, unabhängig vom
  // Aktionsaudit. Die Aktion selbst ist aus dem Status ableitbar (angenommen/abgelehnt/
  // info-angefragt); für den Beleg-Nachzug trägt auditPending sie explizit.
  reviewedBy?: string | undefined;
  reviewedAt?: string | undefined;
  // WP-SHIP8-CLOSE-6 (bens ROT-3b/3c): SCHWEBENDER Aktionsbeleg — gesetzt, wenn der
  // import.candidate-<action>-Audit NACH dem persistierten Statuswechsel fehlschlug. Trägt alles
  // für den exactly-once-Nachzug (recordOnce mit dieser eventId) beim nächsten Queue-Load; die
  // API-Antwort weist den Schwebezustand über die PRÄSENZ des Felds aus (Muster Cleanup
  // auditFailed). Nach gelungenem Nachzug wird die Markierung gelöscht.
  auditPending?: { eventId: string; action: ReviewAction; actor: string } | undefined;
}

// WP-SHIP8-FIX (bens F2): CLEANUP_DRIFT = die bestätigte Aufräum-Zielmenge (Vorschau-Digest)
// stimmt nicht mehr mit dem Bestand überein — die Route antwortet 409, nichts wird verändert.
// WP-SHIP8-CLOSE-2 (bens F1): CONFLICT = ein Persistenz-Write traf 0 Zeilen (der Kandidat ist
// zwischenzeitlich verschwunden) — ehrlicher Abbruch statt stillem Ok.
export type LibraryErrorCode =
  | "NOT_FOUND"
  | "ALREADY_REVIEWED"
  | "BAD_REQUEST"
  | "CLEANUP_DRIFT"
  | "CONFLICT";

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
