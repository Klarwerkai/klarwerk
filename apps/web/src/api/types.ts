import type { Role } from "../app/navigation";

export type { Role };

export type KnowledgeType =
  | "bauchgefuehl"
  | "best_practice"
  | "lernkurve"
  | "technik"
  | "negativwissen";

export type KoStatus = "offen" | "validiert";

// SCRUM-415: Vertraulichkeitsstufe je Wissensobjekt. „intern" = Standard (keine Einschränkung);
// „vertraulich"/„streng_vertraulich" gehen nie in externe Kontexte (Output Factory/Export).
export type Confidentiality = "intern" | "vertraulich" | "streng_vertraulich";

export interface HistoryEntry {
  version: number;
  at: string;
  author: string;
  note: string;
}

export interface KoComment {
  id: string;
  author: string;
  text: string;
  at: string;
}

// SCRUM-129 / FR-KO-07: echte externe Quelle am Objekt (Stufe 2, nie peer-validiert).
export interface KoSource {
  id: string;
  label: string;
  url: string | null;
  excerpt: string | null;
  kind: "external";
  peerValidated: boolean;
  provider?: string | null; // SCRUM-118: optionaler Anbieter externer Quellen
  author: string;
  at: string;
}

// SCRUM-118 / FR-EXT-02: Treffer aus dem externen Such-Proxy (z. B. Wikipedia).
export interface ExternalResult {
  title: string;
  url: string;
  snippet: string;
  provider: string;
}

// SCRUM-414: Admin-Regler „externe Wissensabfrage" (4 Stufen).
export type ExternalKnowledgeStage = "blocked" | "search_on_click" | "search_attach" | "open";

// SCRUM-121: Anhang rückwärtskompatibel — Alt: dataUrl (Inline); Neu: objectId + thumbnail.
export interface KoAttachment {
  id: string;
  name: string;
  mime: string;
  dataUrl?: string;
  objectId?: string;
  thumbnail?: string;
  size?: number;
  author: string;
  at: string;
}

// SCRUM-121: Objekt-Referenz (nur Metadaten) aus dem Object-Store.
// SCRUM-382: Ergebnis der Video-/Audio-Analyse (Transkript) — ehrlicher Engine-Status.
// SCRUM-527: Ergebnis des Live-Checks (POST /api/knowledge/check). status ist ehrlich: „pending" =
// die Widerspruchsprüfung konnte (mangels Modell) nicht laufen; similar bleibt dennoch gefüllt.
export interface KnowledgeCheckResult {
  status: "done" | "pending" | "failed";
  similar: { id: string; title: string; score: number }[];
  conflicts: { id: string; title: string; reason: string }[];
}

export interface MediaAnalysis {
  objectId: string;
  transcript: string | null;
  engineActive: boolean;
  engine: string | null;
  note: string;
}

export interface ObjectRef {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: "image" | "document" | "video" | "binary";
  createdAt: string;
}

export interface ObjectContent {
  ref: ObjectRef;
  data: string;
}

export interface KoVersionSnapshot {
  koId: string;
  version: number;
  snapshot: KnowledgeObject;
  at: string;
  author: string;
  note: string;
}

// SCRUM-164/165: technisches ModelRun-Protokoll (nur Metadaten, keine Prompt-/Antworttexte).
export type ModelRunTask = "structure" | "assist" | "interview" | "answer" | "select";
export type ModelRunStatus = "success" | "error";

export interface ModelRunRecord {
  id: string;
  task: ModelRunTask;
  provider: string;
  demo: boolean;
  fallback: boolean;
  locale?: string;
  startedAt: string;
  finishedAt: string;
  status: ModelRunStatus;
  error?: string;
  model?: string;
}

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

export interface KnowledgeObject {
  id: string;
  title: string;
  statement: string;
  // KW-STR / SCRUM-45/46/48: optionaler WYSIWYG-Body als sanitisiertes HTML.
  bodyHtml?: string | null;
  // WP-BILD-1f (bens P4): die Suchroute liefert die Bild-Fußnoten als KLEINES additives Feld und
  // lässt das bodyHtml (mit eingebetteten Bilddaten) weg — die Trefferliste transportiert nie
  // megabyte-große base64-Blöcke. Fehlt das Feld (andere Endpunkte/Altbestand), fällt die
  // Client-Suche auf den sparenden bodyHtml-Scan zurück.
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
  originalAuthor: string;
  author: string;
  neededValidations: number;
  assignments: string[];
  // SCRUM-415: Vertraulichkeitsstufe (fehlt = „intern"). Vertrauliche KOs gehen nie in externe Kontexte.
  confidentiality?: Confidentiality;
  // Pedi 05.07.: read-only Board-Anreicherung — Peer-Stimmen-Zähler (grün/gelb/rot) für „X von Y grün".
  reviewVotes?: { up: number; warn: number; down: number };
  // SCRUM-507 R2: Anzahl Bewertungen aus einer FRÜHEREN Revision — veraltet, zählen nicht mehr.
  staleVotes?: number;
  asset: string | null;
  createdAt: string;
  history: HistoryEntry[];
  comments?: KoComment[];
  attachments?: KoAttachment[];
  sources?: KoSource[];
  // Demodaten-Merker (Seed) — für DEMO-Badge und Komplett-Entfernung.
  demoSeed?: boolean;
}

export type Verdict = "up" | "warn" | "down";

export interface AssignmentSummary {
  userId: string;
  open: number;
  done: number;
}

// SCRUM-395: Validierungs-Einstellungen (Standard-Prüferanzahl für neue Einreichungen).
export interface ValidationSettings {
  defaultNeededValidations: number;
}

// SCRUM-421: einstellbare Upload-Grenzen (Admin) — Anzahl + Größe je Anhang.
export interface UploadLimits {
  maxAttachments: number;
  maxAttachmentBytes: number;
}

// SCRUM-422: Papierkorb-Zeile (Admin) — nur Metadaten.
export interface TrashedKo {
  id: string;
  title: string;
  category: string;
  deletedAt: string;
  deletedBy: string;
  expiresAt: string;
}

export type ConflictType = "truth" | "experience" | "context" | "temporal" | "role";
export type ConflictStatus = "offen" | "eskaliert" | "zweitmeinung" | "geloest";

// Berater-Konzept 04.07. (Stufe 4): Herkunft + Erkennungs-Metadaten eines automatisch erkannten
// Konflikts — macht den Fund am Board erklärbar (Sicherheit, Begründung, wörtliche Zitate).
export type ConflictOrigin = "manual" | "auto";
// SCRUM-492: strukturierte Kollisionsfelder (Board-Kacheln). streitwertWoertlich = der Streitwert
// kommt wörtlich aus dem zugehörigen Belegzitat → die UI darf ihn als belegt kennzeichnen.
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

export interface ConflictDetector {
  trigger: "validation" | "ask" | "background";
  method: "model" | "deterministic";
  modelLabel?: string;
  promptVersion?: string;
  confidence?: number;
  rationale?: string;
  quotes?: { a: string; b: string };
  // SCRUM-492: optionale strukturierte Gegenüberstellung für die Kollisions-Kacheln.
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
  origin?: ConflictOrigin;
  detector?: ConflictDetector;
  createdAt: string;
}

// Berater-Konzept Duplikate 04.07. (Stufe D4): Überschneidungs-/Duplikat-Eintrag fürs Board.
// Spiegelt die öffentliche Form des conflicts-Moduls (OverlapEntry) — schlanker Lebenszyklus als
// Konflikte: es geht um Redaktion (Zusammenführen), nicht um Wahrheit.
export type OverlapRelation =
  | "identisch"
  | "a_enthaelt_b"
  | "b_enthaelt_a"
  | "teilweise"
  | "verwandt";
export type OverlapRecommendation =
  | "zusammenfuehren"
  | "zusammenfuehren_pruefen"
  | "getrennt_lassen"
  | "verwandt_verlinken";
export type OverlapStatus = "offen" | "in_bearbeitung" | "geschlossen";
export type OverlapOrigin = "auto" | "manual";
export type OverlapResolutionReason =
  | "merged"
  | "kept_separate"
  | "linked_related"
  | "dismissed"
  | "participant_deleted"
  | "superseded";

export interface OverlapAspect {
  beschreibung: string;
  zitatA: string;
  zitatB: string;
}

export interface OverlapDetector {
  trigger: "validation" | "background" | "capture_hint" | "manual";
  method: "model" | "deterministic";
  modelLabel?: string;
  promptVersion?: string;
  lexicalScore: number; // 0..1 deterministische Textdeckung (immer gesetzt)
  // Modell-Sicherheit (nur method="model"). SCRUM-486 E: optional — fehlt sie, ist es KEIN „KI-Fund";
  // die Anzeige führt dann konsistent über die Textdeckung (siehe overlapDetectorInfo.isModelFinding).
  confidence?: number;
  rationale?: string;
}

export interface OverlapResolution {
  reason: OverlapResolutionReason;
  by: string | null;
  note: string | null;
  at: string;
}

export interface OverlapEntry {
  id: string;
  koA: string;
  koB: string;
  relation: OverlapRelation;
  aspects: OverlapAspect[];
  eigenanteilA: string;
  eigenanteilB: string;
  recommendation: OverlapRecommendation;
  status: OverlapStatus;
  pairKey: string;
  origin: OverlapOrigin;
  detector?: OverlapDetector;
  resolution?: OverlapResolution;
  createdAt: string;
  closedAt?: string;
}

// Pedi 04.07.: einstellbare Anzeige-Schwelle der Duplikat-Erkennung (Admin). minConfidence 0..1 —
// ab welcher KI-Wahrscheinlichkeit ein vermutliches Duplikat angezeigt wird.
export interface OverlapSettings {
  minConfidence: number;
}

export type GapPriority = "hoch" | "mittel" | "niedrig";

export interface Gap {
  id: string;
  question: string;
  status: "offen" | "geschlossen";
  assignee: string | null;
  priority: GapPriority;
  createdAt: string;
}

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
  bodyHtml?: string | null; // KW-STR: WYSIWYG-Body
  // SCRUM-415: Vertraulichkeitsstufe ab Erfassen (Standard „intern").
  confidentiality?: Confidentiality;
  // SCRUM-457 (Pedi 06.07.): wo der Entwurf gespeichert wurde, damit „Fortsetzen" GENAU dort
  // wieder öffnet — statt den Ort aus dem Inhalt zu raten. Alt-Entwürfe ohne Marker: Heuristik.
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

export interface BusFactorEntry {
  category: string;
  authorCount: number;
  koCount: number;
  singleSource: boolean;
}

// Consultant-System (Experten-Matching): Thema → beitragende Personen. koCount ist reiner Kontext,
// KEINE Sortier-/Ranggröße (anti-Gamification) — die Reihenfolge kommt alphabetisch vom Backend.
export interface ExpertiseContributor {
  authorId: string;
  koCount: number;
}

export interface ExpertiseEntry {
  category: string;
  contributors: ExpertiseContributor[];
}

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

export interface Analytics {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
}

export interface AuditEntry {
  seq: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  payload: Record<string, unknown>;
  prevHash: string;
  hash: string;
}

export interface AuditFilter {
  actor?: string;
  action?: string;
  target?: string;
}

// FR-LIF-03: Rollenbasierte Lernpfade (Shape spiegelt services/lifecycle).
export interface LearningStep {
  id: string;
  title: string;
}

export interface LearningPath {
  id: string;
  role: string;
  steps: LearningStep[];
}

// FR-ANA-02: Wirkungs-/Impact-Report (Shape spiegelt services/app/src/impact.ts).
export interface ImpactReport {
  validatedTotal: number;
  validatedByWeek: Record<string, number>;
  askTotal: number;
  answeredWithoutGap: number;
  answerRate: number;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  approved: boolean;
  createdAt: string;
}

// SCRUM-116/108: Import-/Source-Review-Kandidaten (JSON-Re-Import).
export interface ImportItemInput {
  title: string;
  statement: string;
  type: KnowledgeType;
  category: string;
  author?: string;
  tags?: string[];
  // WP-IC-PAKET-1c (ROT-2): Decode-Marker des Server-Kandidaten — "decoded" heisst: Textfelder sind
  // kanonisch dekodiert, die Queue-Karte dekodiert NICHT erneut; fehlt er (Altbestand), defensiv nach.
  textCodec?: "decoded";
}

export type ReviewStatus = "neu" | "angenommen" | "abgelehnt" | "info-angefragt";
export type ReviewAction = "accept" | "reject" | "info";

export interface ImportCandidate {
  id: string;
  item: ImportItemInput;
  status: ReviewStatus;
  duplicate: boolean;
  note: string | null;
  koId: string | null;
  createdAt: string;
}

// IC-1/IC-2 (Import-Cockpit): READ-ONLY Erkundungs-Zusammenfassung „was ist da" (spiegelt
// services/library-analytics ImportExploreSummary). Reine Anzeige — nichts wird importiert.
export interface ExploreCountEntry {
  name: string;
  count: number;
}
export interface ExploreThemeEntry {
  label: string;
  count: number;
  // WP-IC-PAKET-1 (Teil 2): "derived" = deterministisch aus Seitentiteln abgeleitet (Fallback ohne
  // Labels); fehlt das Feld, stammt das Thema aus echten Quell-Labels.
  origin?: "derived";
}
export interface ImportExploreSummary {
  totalCount: number;
  distinctSources: number;
  // WP-SAMMEL20-FIX (bens Fix 6b): Gesamtzahlen VOR dem serverseitigen Top-N-Deckel (optional —
  // ältere/gecachte Antworten tragen sie nicht; der Client fällt dann auf die Listenlänge zurück).
  authorsTotal?: number;
  topicsTotal?: number;
  authors: ExploreCountEntry[];
  themes: ExploreThemeEntry[];
  dateRange: { earliest: string; latest: string } | null;
  withImagesHint: number;
  // WP-IC-PAKET-1 (Teil 3): Quell-Container namentlich (Space-Filter, wenn mehrere).
  sourceNames?: ExploreCountEntry[];
  // WP-IC-PAKET-1c (ROT-2): "decoded" = ALLE aggregierten Items kanonisch dekodiert — Chips-Anzeige
  // dekodiert dann NICHT erneut.
  textCodec?: "decoded";
}
// Antwort der Explore-Route: Summary + truncated (Space am Seiten-Cap abgeschnitten).
export interface ImportExploreResponse {
  summary: ImportExploreSummary;
  truncated: boolean;
  // WP-IC-PAKET-1 (Teil 4, IC-6a): wie viele der gesehenen Seiten bereits importiert sind
  // (KO-Herkunftsanker oder offener Kandidat mit derselben Quell-ID).
  alreadyImported?: number;
  // WP-SAMMEL20-FIX (bens Fix 6a): partielle Mappingfehler werden nicht mehr verschwiegen —
  // gelesene/nicht lesbare Seiten als ehrliche Zähler, dazu PII-freie Fehlerklassen.
  mappedPages?: number;
  failedPages?: number;
  failedClasses?: string[];
}

// IC-3 (Import-Cockpit): Auswahl-Kriterien (Klick/KI) + READ-ONLY Vorschau. Nichts wird importiert.
export interface ImportSelectCriteria {
  themes?: string[];
  authors?: string[];
  keywords?: string[];
  yearFrom?: number;
  yearTo?: number;
  // WP-IC-PAKET-1 (Teil 3): Quell-Container-Filter (Space).
  spaces?: string[];
  limit?: number;
}
export interface ImportPreviewEntry {
  title: string;
  author?: string;
  updatedAt?: string;
  hasImage: boolean;
  themes: string[];
  // WP-IC-PAKET-1 (Teil 4, IC-6a): Import-Status aus dem Quell-Referenz-Abgleich (reine Anzeige).
  alreadyImported?: boolean;
  sourceNewer?: boolean;
  // WP-IC-PAKET-1c (ROT-2): "decoded" = kanonisch dekodiert — Anzeige dekodiert NICHT erneut.
  textCodec?: "decoded";
}
export interface ImportSelectResponse {
  matched: number;
  limited: boolean;
  truncated: boolean;
  criteria: ImportSelectCriteria; // die EFFEKTIV benutzten Kriterien (Transparenz)
  preview: ImportPreviewEntry[];
  // WP-IC-PAKET-1 (Teil 4): Anzahl bereits importierter Einträge INNERHALB der Vorschau-Liste.
  alreadyImported?: number;
  // WP-SAMMEL20-FIX (bens Fix 2): ehrlicher KI-Status der Satz-Auswertung — nur gesetzt, wenn ein
  // Freitext-Satz gestellt war. "unavailable" = die KI-Auswahl fiel aus (fallbackReason nennt die
  // Ursache); es gelten dann sichtbar NUR die Klick-Filter.
  inferenceStatus?: "ok" | "unavailable";
  fallbackReason?: string;
}

export type KnowledgeClass =
  | "gesichert"
  | "ungeprueft"
  | "meinung"
  | "extern"
  | "annahme"
  | "unbekannt";

export interface AnswerStep {
  description: string;
  sourceId: string | null;
  snippet: string | null;
}

export interface AnswerResult {
  answered: boolean;
  answer: string | null;
  knowledgeClass: KnowledgeClass;
  trust: number;
  sources: string[];
  steps: AnswerStep[];
  demo: boolean;
  // WP-RETEST7 R5: Quellen, deren Treffer NUR über die Bild-Fußnoten kam (Badge „Bildbeschreibung").
  captionSources?: string[];
}

// Realer Backend-Shape von POST /api/ask: Antwort + ggf. erzeugte Wissenslücke.
export interface AskResponse {
  result: AnswerResult;
  gap: Gap | null;
}

// FR-EXT-03 / FE-OUT: Output Factory (SCRUM-117/109).
export type OutputKind =
  | "instruction"
  | "checklist"
  | "troubleshooting"
  | "training"
  | "management_summary";

export interface OutputSource {
  id: string;
  title: string;
  status: string;
  trust: number;
  version: number;
  category: string;
  type: string;
}

export interface OutputProvenance {
  koId: string;
  title: string;
  status: string;
  trust: number;
  version: number;
  author: string;
  originalAuthor: string;
  category: string;
  type: string;
  validity: string;
  uncertain: boolean;
}

export interface OutputDocument {
  kind: OutputKind;
  title: string;
  audienceRole: string | null;
  generatedAt: string;
  markdown: string;
  provenance: OutputProvenance[];
}

// SCRUM-120 / FE-MGMT: Management-/Wissenskapital-Snapshot (Spiegel des Backend-Modells).
export type MgmtBand = "gut" | "mittel" | "kritisch";

export interface MgmtScorePart {
  key: string;
  value: number;
  weight: number;
}

export interface ManagementSnapshot {
  generatedAt: string;
  overview: {
    totalKos: number;
    validated: number;
    open: number;
    openGaps: number;
    openConflicts: number;
    avgTrust: number;
    healthScore: number;
    healthBand: MgmtBand;
  };
  capital: { score: number; band: MgmtBand; parts: MgmtScorePart[] };
  valuationFacts: { validatedKos: number; totalKos: number; avgTrust: number };
  statement: {
    assets: number;
    riskItems: number;
    riskBreakdown: {
      singleSourceCategories: number;
      stale: number;
      openGaps: number;
      openConflicts: number;
    };
    net: number;
  };
  maturity: { stage: number; stageKey: string; progressPct: number };
  priorities: { category: string; score: number; factors: { key: string; value: number }[] }[];
  recommendations: { key: string; severity: "hoch" | "mittel"; count: number }[];
  house: { category: string; koCount: number; validatedRatio: number; fragile: boolean }[];
  pilot: { days: number; created: number; validated: number }[];
}

export interface StructureResult {
  title: string;
  statement: string;
  conditions: string[];
  measures: string[];
  tags: string[];
  confidence: number;
  demo: boolean;
  // WP-D8: ehrliche Fallback-Ursache (nur bei demo:true) — "no-model" = kein Modell konfiguriert/aktiv,
  // "model-error" = Modell versucht, aber gescheitert (HTTP/Quota/Netz/Parse). WP-D10 (Fix 3):
  // "model-timeout" = Modell versucht, aber Zeitlimit überschritten. Die UI erklärt das Badge.
  fallbackReason?: "no-model" | "model-timeout" | "model-error";
}

// WP-D11: Ergebnis der Server-Konvertierung PPTX-Folien → PNG-data-URLs (Reihenfolge = Folien).
// WP-IC-4 (Schritt 4): KI-Gruppierung der eingegrenzten Import-Kandidaten. demo:true = ehrliche
// deterministische Themen-Gruppierung (Kennzeichnung „Ohne KI gruppiert" im UI).
export interface ImportGroupCandidate {
  id: string;
  title: string;
  textCodec?: "decoded";
  alreadyImported: boolean;
  // WP-IC-6b: Quelle aktualisiert seit Import — wählbar als Aktualisierung (neue KO-Version im Review).
  sourceNewer: boolean;
  hints: string[]; // "already-imported" | "stale" | "short" (deterministische Qualitätshinweise)
}

export interface ImportGroupEntry {
  title: string;
  ids: string[];
  kind?: "catchall" | "no-theme";
}

export interface ImportGroupResponse {
  groups: ImportGroupEntry[];
  candidates: ImportGroupCandidate[];
  demo: boolean;
  // WP-SHIP7-FIX: Snapshot-Pin — jeder Apply-Batch desselben Laufs nutzt GENAU diese Datenbasis.
  snapshotToken: number;
  fallbackReason?: "no-model" | "model-timeout" | "model-error";
}

// WP-IC-4 (Schritt 5): Teil-Bilanz eines Übernahme-Batches (der Client aggregiert ehrlich).
// WP-SHIP7-FIX (Fix 3): alreadyQueued = idempotenter No-op (Kandidat war schon eingereiht) —
// zählt EHRLICH getrennt vom Import.
export interface ImportApplyResponse {
  imported: number;
  // WP-IC-6b: davon Aktualisierungen (Quelle war neuer als der Import — wird im Review als neue
  // Version des bestehenden KOs angenommen). Teilmenge von imported.
  updates: number;
  alreadyQueued: number;
  failed: { id: string; reason: string }[];
  notFound: string[];
}

// WP-D-CLEAN: zweistufiges Testdaten-Aufräumen — Vorschau (Zähler, nichts passiert) bzw. Bilanz.
export interface ImportCleanupPreview {
  preview: true;
  candidates: number;
  importedKos: number;
  // WP-SHIP8-FIX (bens F2): bindet die Bestätigung an GENAU diese Zielmenge (stateless, SHA-256).
  digest: string;
}

export interface ImportCleanupResult {
  preview: false;
  removedCandidates: number;
  trashedKos: number;
  skipped: { id: string; reason: string }[];
  // WP-SHIP8-FIX (bens F1): die Mutationen sind passiert, nur der Abschluss-Audit schlug fehl.
  auditFailed: boolean;
}

// WP-B6: Bilanz eines geladenen Beispielpakets (idempotent — übersprungen = schon vorhanden).
export interface ExampleLoadResponse {
  package: "konflikte" | "bilder" | "qualitaet";
  created: number;
  skipped: number;
  // WP-SAMMEL21-FIX (bens Fix 1): ehrliche Teilbilanz der Konflikt-Anlage (konflikte-Paket).
  conflicts?: { created: number; skipped: number; failed: number };
}

export interface SlideConvertResponse {
  slides: string[];
  slideCount: number;
  // WP-D11b (Blocker 2): ehrliche Zähler der serverseitigen Ausgabe-Deckelung.
  converted: number; // = slideCount (übernommene Folien)
  droppedOversize: number; // Einzel-PNG über dem Deckel — serverseitig verworfen, nie geladen
  droppedByBudget: number; // Gesamtgrenze aller PNGs erreicht — restliche Folien verworfen
  truncated: boolean; // Präsentation hatte mehr als maxSlides Folien (harte Kappung, ehrlich)
  truncatedByBudget: boolean; // = droppedByBudget > 0
  maxSlides: number;
}

// WP-BILD-1c: KI-Bildbeschreibung als VORSCHLAG für die Bild-Fußnote. Ohne funktionierendes
// Vision-Modell ehrlich text null + fallbackReason (gleiche Ursachen wie StructureResult) —
// es gibt NIE eine Pseudo-Beschreibung, nichts wird automatisch gespeichert.
export interface DescribeImageResult {
  text: string | null;
  demo: boolean;
  fallbackReason?: "no-model" | "model-timeout" | "model-error";
}

export interface ReasonerStatus {
  active: boolean;
  provider: string;
  mode: "model" | "deterministic";
}

// SCRUM-166: read-only Provider-/Model-Konfiguration (nur Metadaten, keine Secrets).
export type ReasonerConfigMode = "model" | "fallback" | "demo";
// WP-BILD-1c: describe (KI-Bildbeschreibungs-Vorschlag) als weitere KI-Aufgabe.
export type ReasonerTask =
  | "structure"
  | "assist"
  | "interview"
  | "answer"
  | "select"
  | "extract"
  | "describe";

export interface ReasonerConfigStatus {
  provider: string;
  model?: string;
  configured: boolean;
  mode: ReasonerConfigMode;
  fallbackAvailable: boolean;
  supportsLocales: ("de" | "en")[];
  tasks: ReasonerTask[];
  // KI-Verwaltung v1 (02.07.2026): Zuordnung + effektiver Modus je Aufgabe.
  taskConfig: { global: string; perTask: Record<string, string> };
  effective: Record<string, "model" | "deterministic">;
  // SCRUM-424: eigener lokaler LLM + welche KI je Aufgabe zuerst arbeitet.
  cloudConfigured: boolean;
  localConfigured: boolean;
  localProvider?: string;
  effectiveProvider: Record<string, "cloud" | "local" | "deterministic">;
  persisted: boolean;
}

// Key-Test (Pedi 02.07.): Ergebnis des echten Mini-Modellaufrufs (ehrlich, kein Secret).
export interface ReasonerProbeResult {
  ok: boolean;
  provider: string;
  mode: "model" | "deterministic";
  detail: string;
  at: string;
}

// SCRUM-493: End-to-End-Selbsttest der Konflikterkennung (Modell antwortet + liefert kollision).
export interface ConflictSelfTestResult {
  ok: boolean;
  code: "ok" | "no_model" | "no_conflict" | "conflict_without_kollision";
  provider: string;
  mode: "model" | "deterministic";
  conflictCreated: boolean;
  hasKollision: boolean;
  streitwertAWoertlich: boolean | null;
  streitwertBWoertlich: boolean | null;
  streitpunkt: string | null;
  messageKey: string;
}

// SCRUM-494: Ergebnis des Duplikat-Selbsttests (analog Konflikt-Selbsttest).
export interface DuplicateSelfTestResult {
  ok: boolean;
  code: "ok" | "no_model" | "no_duplicate";
  provider: string;
  mode: "model" | "deterministic";
  duplicateCreated: boolean;
  relation: string | null;
  messageKey: string;
}

export interface AssistResult {
  text: string;
  demo: boolean;
}

// SCRUM-386: kundeneigene KI-Assist-Funktion (Preset) — Name in der Palette, Anweisung
// an den vorhandenen assist-Task. Vom Admin gepflegt; die Anweisung ist am ?-HelpTip
// transparent sichtbar (G-3: keine versteckten Prompts).
export interface AssistPreset {
  id: string;
  name: string;
  instruction: string;
}

// PMO-FEA-0006: Wissenspunkt aus einem Dokument — mit wörtlicher Belegstelle (G-2).
export interface ExtractedPoint {
  title: string;
  summary: string;
  sourceExcerpt: string;
}

// PMO-FEA-0006: Extraktions-Ergebnis. Ohne Modell: points leer + ehrliche note (keine Fake-Punkte).
export interface ExtractResult {
  points: ExtractedPoint[];
  note: string | null;
  demo: boolean;
}

// SCRUM-426: Public-KI-Anreicherung (Modellwissen) — extern/ungeprüft; leer + demo=true ohne Modell.
export interface EnrichResult {
  text: string;
  provider: string;
  demo: boolean;
}

// SCRUM-132: reasoner-getriebenes Interview (stateless: Antworten rein, nächste Frage raus).
export interface InterviewResult {
  question: string | null;
  done: boolean;
  draft: StructureResult;
  demo: boolean;
}

// SCRUM-181: Rückgabe des admin-getriebenen Demo-Seeds (ehrlich: seeded vs. skipped).
export interface DemoSeedResult {
  skipped: boolean;
  users: number;
  kos: number;
  validated: number;
  gaps: number;
  conflicts: number;
  // SCRUM-487: erkannte Duplikate (reifen-Paar) — >0 nur mit online-Reasoner, offline ehrlich 0.
  duplicates: number;
  pendingRevalidation: number;
  attachments: number;
}

// Audit-P4 (SCRUM-398): Live-Wall — „frisch gesichert / hat heute geholfen" (read-only).
export interface LiveWall {
  saved: Array<{
    koId: string;
    title: string;
    author: string;
    at: string;
    status: "offen" | "validiert";
  }>;
  helped: Array<{ koId: string; title: string; at: string }>;
  helpedToday: number;
}

export type NotificationKind = "conflict" | "duplicate" | "gap" | "assignment" | "impact";

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  at: string;
  // SCRUM-363: bei „assignment" das Quell-KO (sonst nicht gesetzt).
  koId?: string;
  // Audit-P3 (SCRUM-397): serverseitiger Gelesen-Status (pro Nutzer, überlebt Neustart).
  seen?: boolean;
}
