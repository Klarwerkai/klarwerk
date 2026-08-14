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
  // mega26 Block B: der Grund der Verknüpfung (Belegstelle). Nur bei kind:"source" und nur,
  // wenn die Quelle eine Belegstelle trug — sonst weggelassen.
  excerpt?: string;
  createdBy: string;
  createdAt: string;
}

// AUFTRAG-mega28 A2 (Pedi 26.07.): Abdeckung EINES Prüf-Laufs — Spiegel von
// services/knowledge-object AiCheckCoverage (die Oberfläche importiert keine Services).
// AUFTRAG-mega29 B1 (bens M28-2): getrennte Begriffe statt EINER Zahl, die vier Fragen zugleich
// beantworten musste. Nicht alle erscheinen in der Oberfläche — aber ohne sie kann kein Text der
// Wahrheit entsprechen.
export interface AiCheckCoverage {
  // Wie viele Kandidaten standen im Bestand zur Wahl?
  available: number;
  // Wie viele Ränge hat der Lauf angesehen (Vorauswahl + Deckel)?
  selected: number;
  // Davon übersprungen, weil zu dem Paar bereits ein offener Befund steht.
  alreadyOpen: number;
  // Davon dem Vergleich tatsächlich vorgelegt (nur DIESE Zahl deckelt der Betriebswert).
  attempted: number;
  // Davon fehlerfrei zu Ende verglichen — die Zahl, die ein Mensch als „geprüft" lesen darf.
  completed: number;
  // Versuchte Vergleiche, die wegen eines Urteilsfehlers ausgelassen wurden.
  skipped: number;
  // selected < available ⇒ KEIN vollständiger Abgleich.
  capped: boolean;
  // Der Lauf brach vorzeitig ab (Modell-Rückstau).
  aborted: boolean;
}

// AUFTRAG-mega29 C2 (bens M28-3): die Zahlen, die ein LEERES Konflikt-/Duplikat-Board braucht,
// um nicht als „geprüft und frei" gelesen zu werden. Spiegel von services/knowledge-object.
// AUFTRAG-mega31 A4: `noCoverage` ist von `unchecked` getrennt — ein Objekt mit Laufstatus, aber
// ohne Abdeckungsprotokoll, ist NICHT „gar kein Lauf". Bedeutung/Rangfolge s. knowledge-object.
export interface AiCheckCoverageSummary {
  total: number;
  incomplete: number;
  unchecked: number;
  noCoverage: number;
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
  // JOB 679 / D2 (K1.2, Weg A): der Erfassungsweg, aus dem dieses Objekt entstanden ist — Spiegel
  // von `services/knowledge-object/src/types.ts`. Bis JOB 679 endete die Herkunft am Entwurf; seit
  // Weg A reicht `toKoInput` sie durch, und die Oberfläche kann sie ehrlich anzeigen.
  // FEHLT das Feld, ist die Herkunft UNBEKANNT (Altbestand) — das heißt ausdrücklich nicht
  // „über die Vordertür erfasst". Der Herkunfts-Chip erscheint deshalb nur beim gesetzten Wert.
  origin?: "tell" | "studio" | "expert" | "frontdoor" | "word_addin";
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
  // WP-SUBMIT-ASYNC (Pedis R3): Status der Hintergrund-KI-Prüfung nach dem Einreichen (additiv;
  // Altbestand ohne Feld = kein Prüf-Job, nichts anzuzeigen).
  aiCheck?: {
    status: "pending" | "done" | "failed";
    requestedAt: string;
    finishedAt?: string;
    fallbackReason?: string;
    // AUFTRAG-mega28 A2 (Pedi 26.07.): wie weit der Prüf-Lauf REICHTE. Seit mega28 deckeln beide
    // Erkennungswege ihre Kandidatenmenge — ohne diese Zahlen wäre „geprüft" eine Behauptung, die
    // der Lauf nicht deckt, und ein leeres Ergebnis läse sich als „konfliktfrei". Additiv:
    // Altbestand ohne Feld sagt nichts über die Abdeckung, und die Anzeige behauptet dann nichts.
    coverage?: AiCheckCoverage;
  };
}

// FUNKE F1 (nacht24 Paket 6): „Meine Wirkung" — persönliche Zähler (Spiegel von
// services/app/src/impact.ts, nur Zahlen über EIGENE Beiträge; cited zählt ehrlich nur die
// FÜHRENDE Antwort-Quelle, weil das ask.query-Audit nur sie trägt).
export interface MyImpact {
  contributions: number;
  validated: number;
  cited: number;
  helpfulReceived: number;
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

// AUFTRAG-mega14 Block A: Bericht der Integritätsprüfung (GET /api/audit/verify). Spiegelt
// `ChainInspection` aus services/audit/src/chain.ts — die Oberfläche muss die URSACHE einer
// Abweichung kennen, sonst kann sie nur raten. Siehe lib/auditVerifyState.ts.
export type ChainDeviationKind = "linkage" | "serialisation" | "unresolved" | "unchecked";

export interface AuditVerifyReport {
  ok: boolean;
  count: number;
  linkageBreaks: number;
  payloadDeviations: number;
  serialisationDeviations: number;
  unresolvedDeviations: number;
  uncheckedDeviations: number;
  firstDeviation?: { seq: number; at: string; action: string; kind: ChainDeviationKind };
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
  // mega26 Block B: wer den Konflikt behauptet hat. Nur im manuellen Zweig gesetzt — der
  // automatische weist sich über origin/detector aus. Altbestand ohne das Feld bleibt gültig.
  createdBy?: string;
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
  // FUNKE-FIX2 P0 (bens Blocker Gap-Freitext): true → der Server hat den Fragetext für DIESEN
  // Betrachter zurückgehalten (question ist dann ""); die UI zeigt eine Neutralbezeichnung statt
  // Freitext. Volltext bekommen nur Ersteller/Assignee/Detail-Rolle.
  redacted?: boolean;
}

// FUNKE-FIX2 P0 (bens Erforderlich 1): rein aggregierte Zähler der offenen Wissenslücken — KEIN
// Fragetext. Die Startseite nutzt AUSSCHLIESSLICH diese Zahlen (GET /api/gaps/summary).
export interface GapSummary {
  open: number;
  byPriority: Record<GapPriority, number>;
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
  // JOB 679 / D2 (K1.2, Weg A): `word_addin` ergänzt — der Wert existiert serverseitig seit
  // JOB 510 R10 (`services/capture/src/types.ts`), fehlte hier aber. Damit war die Herkunft aus
  // Word für den Client nicht einmal benennbar. Jetzt sind beide Seiten zeichengleich.
  origin?: "tell" | "studio" | "expert" | "frontdoor" | "word_addin";
  // ==========================================================================================
  // JOB 512 (R5) — DIE QUELLBILDZAHL MUSS DEN ENTWURF ÜBERLEBEN.
  // ==========================================================================================
  //
  // Die Zahl der Bilder in der QUELLDATEI, erhoben beim Import VOR jedem Budget-/Formatabzug
  // (PPTX: `a:blip`, pptx.ts:565/1103; DOCX: `totalImages`). Ohne sie kann die Entwurfsgalerie
  // einen Bildverlust prinzipiell nicht erkennen: „0 von 0" sieht aus wie ein Dokument, das nie
  // Bilder hatte.
  //
  // WARUM SIE IN DER NUTZLAST STEHT UND NICHT IM ZUSTAND: Der Ganzdokument-Import setzt kein
  // `bodyHtml` im Editor. Er legt den Entwurf an, räumt danach den gesamten Dateizustand
  // (Capture.tsx:1041-1049) und verlinkt auf die Vordertür (`?draft=<id>`). Die Galerie rendert
  // also IMMER an einem geladenen Entwurf — ein Wert im flüchtigen Importzustand käme dort nie an.
  //
  // Fehlt das Feld (getippter Entwurf, Klara, Altbestand), bleibt die Aussage `unbekannt`; es wird
  // dann KEIN Verlust behauptet (lib/bildverlust.ts).
  sourceImageCount?: number;
  // AUFTRAG-mega4/mega5 Block A (bens Auflage A): „Entwurf speichern" sicherte bisher nur Text + drei
  // Skalar-Metadaten. Der Entwurf trägt jetzt ALLE inhaltlichen, textuell sicherbaren Dirty-Felder —
  // Prüferauswahl, offene/teilweise Quelle, externe Suchanfrage und den Interviewfortschritt — und der
  // Resume stellt sie wieder her. `sourceProvider` benennt die SUCHquelle des Treffers (bens Vorschlag;
  // kein KI-Anbieter). extResults (voller Treffer-Cache) werden nach Pedis Datenminimierungs-Entscheid
  // (mega5 Block C) bewusst NICHT persistiert: die Suchanfrage bleibt, die Treffer lädt der Nutzer nach
  // dem Fortsetzen mit einem Klick neu — kein Retention-Risiko, kleinere Angriffsfläche.
  reviewerIds?: string[];
  // AUFTRAG-mega20 Block D: die wartende Belegstelle trägt jetzt AUCH ihre Bindung an das
  // Originaldokument — den lokalen Schlüssel (`anchorKey`) und die serverseitig vergebene Kennung
  // des gesicherten Originals (`objectId`). Bis mega19 wurden beide beim Speichern abgestreift; der
  // übernommene Text überlebte das Fortsetzen, sein Beleg nicht. Die ausgeschriebene Begründung
  // steht in lib/captureSources.ts.
  pendingSources?: {
    label: string;
    url?: string;
    excerpt?: string;
    sourceProvider?: string;
    anchorKey?: string;
    objectId?: string;
  }[];
  // AUFTRAG-mega20 Block D: die GESICHERTEN ORIGINALE des Entwurfs. Getrennt von den Belegstellen,
  // weil mehrere Belegstellen dasselbe Dokument teilen — Name und Typ gehören genau einmal
  // gespeichert. `key` ist die Brücke zu `pendingSources[].anchorKey`; geprüft wird serverseitig
  // ausschliesslich `objectId`.
  anchorDocuments?: { key: string; objectId: string; name: string; mime: string }[];
  sourceForm?: { label: string; url: string; excerpt: string };
  extQuery?: string;
  // AUFTRAG-mega5 Block A: Interviewfortschritt als reine Textstruktur (keine Modell-Nutzlast) —
  // gegebene Antworten, gerade getippte Antwort, aktuelle Frage, Abschluss-/Quellen-Flag.
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
  // AUFTRAG-mega20 Block D: der Server nennt beim Fortsetzen (Einzelabruf UND Liste) ausdrücklich
  // die gesicherten Originale, die er nicht mehr findet. Steht dieses Feld, fehlt der übernommene
  // Body — bewusst und benannt, nicht versehentlich. Es gehört an den ENTWURFS-Umschlag und nicht
  // in die Nutzlast: es beschreibt einen Befund über den Entwurf, nichts, was jemand eingegeben hat.
  anchorsMissing?: string[];
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

// AUFTRAG-mega68: Nachbarschaft EINES Wissensobjekts (GET /api/kos/:id/neighbors) — begrenzt,
// mit dem WARUM je Kante (`via` = geteilte, nicht-ubiquitäre Schlagwörter). `total`/`truncated`
// zählen serverseitig NACH dem Vertraulichkeits-Filter; `excludedTags` weist ehrlich aus, welche
// Schlagwörter des Zentrums wegen Ubiquität (z. B. pilot-demo) keine Kante erzeugen.
export interface NeighborKo {
  id: string;
  title: string;
  status: KoStatus;
  via: string[];
}

export interface Neighborhood {
  center: { id: string; title: string; status: KoStatus };
  neighbors: NeighborKo[];
  total: number;
  truncated: boolean;
  excludedTags: string[];
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

// WP-SHIP8-CLOSE-2 (bens F1): "in_bearbeitung" = transienter Claim einer LAUFENDEN Review-Aktion
// (Server-CAS) — in Listen nur für Augenblicke (bzw. nach einem Absturz) sichtbar.
export type ReviewStatus = "neu" | "in_bearbeitung" | "angenommen" | "abgelehnt" | "info-angefragt";
export type ReviewAction = "accept" | "reject" | "info";

export interface ImportCandidate {
  id: string;
  item: ImportItemInput;
  status: ReviewStatus;
  duplicate: boolean;
  note: string | null;
  koId: string | null;
  createdAt: string;
  // WP-SHIP8-CLOSE-6 (bens ROT-3a): Wer/Wann der Review-Entscheidung — im Statuswrite persistiert.
  reviewedBy?: string;
  reviewedAt?: string;
  // WP-SHIP8-CLOSE-7 (bens GELB): die Aktion wirklich persistiert (nicht aus dem Status abgeleitet).
  reviewedAction?: ReviewAction;
  // WP-SHIP8-CLOSE-6 (bens ROT-3c): PRÄSENZ = der Aktionsbeleg schwebt noch (wird beim nächsten
  // Queue-Load exactly-once nachgezogen) — Muster Cleanup auditFailed.
  // WP-SHIP8-CLOSE-8 (bens GELB-2): nur noch als BOOLEAN auf dem Draht — die Interna (eventId,
  // actor, Payload) bleiben serverseitig (Response-DTO der Kandidaten-Ausgabe).
  auditPending?: boolean;
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
  // WP-IC-PAKET-1 (Teil 4, IC-6a): wie viele der gesehenen Seiten bereits importiert sind.
  // WP-SHIP9-S1b (bens GELB): NUR noch lebende KO-Herkunftsanker — offene Kandidaten zählen
  // getrennt als alreadyQueued („bereits zur Prüfung vorgemerkt").
  alreadyImported?: number;
  alreadyQueued?: number;
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
  // WP-SHIP9-S2c (F3): stabile Kandidaten-Id der Auswahl (deckungsgleich mit der Gruppierungs-/
  // Übernahme-Id, candidateIdOf). Trägt die in der Vorschau getroffene Auswahl in die nächsten
  // Schritte. Optional für Altbestand/andere Aufrufer, die keine Id setzen.
  id?: string;
  title: string;
  author?: string;
  updatedAt?: string;
  hasImage: boolean;
  themes: string[];
  // AUFTRAG-mega27 A3: die QUELL-STRUKTUR. sourceScope = Quell-Container (Wurzel des Ordnerbaums),
  // sourcePath = Elternkette darin (Wurzel zuerst, ohne den Eintrag selbst). Fehlt die Elternkette
  // in der Quelle, fehlt das Feld — kein leeres Array, kein erfundener Ordner. Beide Werte sind
  // wie Titel/Autor an der Quelle kanonisch dekodiert (textCodec gilt mit).
  sourceScope?: string;
  sourcePath?: string[];
  // WP-IC-PAKET-1 (Teil 4, IC-6a): Import-Status aus dem Quell-Referenz-Abgleich (reine Anzeige).
  // WP-SHIP9-S1b: alreadyImported = lebender KO-Anker; alreadyQueued = offener Kandidat
  // („bereits zur Prüfung vorgemerkt") — zwei getrennte, ehrliche Kennzeichen.
  alreadyImported?: boolean;
  alreadyQueued?: boolean;
  sourceNewer?: boolean;
  // WP-IC-PAKET-1c (ROT-2): "decoded" = kanonisch dekodiert — Anzeige dekodiert NICHT erneut.
  textCodec?: "decoded";
  // AUFTRAG-mega59 BLOCK F2: dieser Kandidat nimmt die Cloud-KI aus der Gruppierung heraus (Spiegel
  // von services/library-analytics/src/select.ts). Damit kann die Vorwarnung die Vertraulichkeit des
  // GEWÄHLTEN Stapels einrechnen, statt nur den globalen Reasoner-Status zu kennen. Additiv; ein
  // älterer Server ohne das Feld führt in genau den bisherigen Zustand zurück (keine Vorwarnung aus
  // diesem Grund), nie in eine falsche Entwarnung.
  confidentialForAi?: boolean;
}
export interface ImportSelectResponse {
  matched: number;
  limited: boolean;
  truncated: boolean;
  criteria: ImportSelectCriteria; // die EFFEKTIV benutzten Kriterien (Transparenz)
  preview: ImportPreviewEntry[];
  // WP-IC-PAKET-1 (Teil 4): Anzahl bereits importierter Einträge INNERHALB der Vorschau-Liste.
  // WP-SHIP9-S1b: dazu getrennt die Anzahl der bereits zur Prüfung vorgemerkten Einträge.
  alreadyImported?: number;
  alreadyQueued?: number;
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
  // Die HERANGEZOGENEN Quellen — was das Ranking dem Antwortweg vorgelegt hat.
  sources: string[];
  steps: AnswerStep[];
  demo: boolean;
  // WP-RETEST7 R5: Quellen, deren Treffer NUR über die Bild-Fußnoten kam (Badge „Bildbeschreibung").
  captionSources?: string[];
  // AUFTRAG-mega52 A3: die Quellen, die die Antwort WIRKLICH getragen haben (Fußnotenmarken des
  // Modells, zurückgelesen und geprüft). Optional wie `captionSources` — ein älterer Server, der
  // das Feld nicht sendet, lässt die Oberfläche in denselben ehrlichen Zustand fallen wie eine
  // Antwort ohne verwertbare Marken (A5): „Zuordnung nicht möglich", nie ein stiller Rückfall auf
  // alle. `undefined` und `[]` bedeuten hier dasselbe — UNBEKANNT, nicht „keine".
  citedSources?: string[];
}

// Realer Backend-Shape von POST /api/ask: Antwort + ggf. erzeugte Wissenslücke + Answer-Receipt.
export interface AskResponse {
  result: AnswerResult;
  gap: Gap | null;
  // FUNKE-FIX P0 (bens ROT-1): opaker Beleg über die ausgelieferten Quell-KOs. Beim „Danke"
  // (/api/ask/helpful) zurückgereicht — der Server verifiziert die Quellen-Bindung serverseitig.
  receipt: string;
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
  // "model-timeout" = Modell versucht, aber Zeitlimit überschritten. WP-SHIP9-S2: "confidential" =
  // Cloud-KI wegen vertraulichem Text ausgeschlossen (kein lokales Modell sprang ein). Die UI erklärt das Badge.
  fallbackReason?: "no-model" | "model-timeout" | "model-error" | "confidential";
}

// WP-D11: Ergebnis der Server-Konvertierung PPTX-Folien → PNG-data-URLs (Reihenfolge = Folien).
// WP-IC-4 (Schritt 4): KI-Gruppierung der eingegrenzten Import-Kandidaten. demo:true = ehrliche
// deterministische Themen-Gruppierung (Kennzeichnung „Ohne KI gruppiert" im UI).
export interface ImportGroupCandidate {
  id: string;
  title: string;
  textCodec?: "decoded";
  alreadyImported: boolean;
  // WP-SHIP9-S1b (bens GELB): offener Kandidat = „bereits zur Prüfung vorgemerkt" — eigener,
  // vom Import-Kennzeichen getrennter Zustand (Vorab-Abwahl wie bisher, ehrlich benannt).
  alreadyQueued: boolean;
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
  // WP-SHIP9-S1 (bens W2-Auflage): "confidential" = Cloud-KI konfiguriert und Policy cloud-geeignet,
  // aber wegen vertraulicher Kandidaten ausgeschlossen (kein lokales Modell sprang ein) — die UI
  // zeigt dafür einen spezifischen Grund am „Ohne KI gruppiert"-Badge. Additive Union.
  fallbackReason?: "no-model" | "model-timeout" | "model-error" | "confidential";
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
  // WP-SHIP8-CLOSE-4 (bens ROT-1C): KOs einer LAUFENDEN Review-Aktion — nie Teil der Zielmenge.
  claimedKos: number;
  // WP-SHIP8-CLOSE-8 (bens ROT-1): Kandidaten mit schwebendem Aktionsbeleg — das Löschen lässt
  // sie fail-closed stehen (einziger Träger des Belegs).
  auditPendingCandidates: number;
}

export interface ImportCleanupResult {
  preview: false;
  removedCandidates: number;
  trashedKos: number;
  skipped: { id: string; reason: string }[];
  // WP-SHIP8-FIX (bens F1): die Mutationen sind passiert, nur der Abschluss-Audit schlug fehl.
  auditFailed: boolean;
  // WP-NIGHT-FIX (bens F2-TOCTOU): seit der Vorschau neu eingereihte Kandidaten — nicht angefasst.
  newCandidates: number;
  // WP-SHIP8-CLOSE-4 (bens ROT-1C): KOs einer LAUFENDEN Review-Aktion — nie getrasht, ehrlich beziffert.
  claimedKos: number;
  // WP-SHIP8-CLOSE-8 (bens ROT-1): Kandidaten mit schwebendem Aktionsbeleg — nicht entfernt,
  // ehrlich beziffert; ein späterer Lauf räumt sie nach gelungenem Beleg-Nachzug ab.
  auditPendingCandidates: number;
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
  // WP-SHIP9-S2: "confidential" additiv — Cloud-Vision wegen vertraulichem Bild ausgeschlossen.
  fallbackReason?: "no-model" | "model-timeout" | "model-error" | "confidential";
  // WP-BILD-1f (Pedi 22.07.): true, wenn der Vorschlag mit umgebendem Dokument-Kontext erzeugt wurde
  // (die UI kennzeichnet ihn dann als „mit Dokument-Kontext erzeugt").
  withContext?: boolean;
}

// WP-VIP2-GATE (bens P1): /api/reasoner/status ist abstrahiert — nur Verfügbarkeit + STUFE
// (cloud/local/deterministic), kein Provider-/Modellname mehr (der lebt in der ECHTEN Admin-Sicht
// ReasonerConfigStatus hinter users.manage — WP-VIP2-GATE-2 Fix 3). Die KI-Pille braucht genau diese zwei Felder.
export interface ReasonerStatus {
  active: boolean;
  mode: "cloud" | "local" | "deterministic";
  // PAKET 2 (D-AISTATE, Pedi 23.07.): ehrlicher Erreichbarkeits-Zustand — „active" nur, wenn ein
  // Modell zuletzt WIRKLICH geantwortet hat (nicht nur konfiguriert). Optional für Rückwärtskompat
  // mit älteren Fixtures/Antworten; fehlt es, behandeln die Badges es wie „unverified".
  reachable?: "none" | "unverified" | "active" | "unreachable";
  // PAKET 3 (D-AISTATE, bens V4): abstrakte per-Task-Nutzbarkeit (nur true/false je Aufgabe, KEIN
  // Provider-/Modellname). Fehlt sie (alte Antwort), fällt der Hook auf den globalen Status zurück.
  tasks?: Record<string, boolean>;
  // AUFTRAG-mega67 BLOCK G (Pedi 30.07.), Wortlaut geschärft in mega71 Block D (bens B2-Ehrlichkeit):
  // die Cloud KANN für DIESE Aufgabe kostenpflichtig verwendet werden — ein Cloud-Modell liegt in
  // ihrer Kette. Eine MÖGLICHKEIT, keine Abrechnungstatsache: bei `reachable: "unverified"`, für
  // vertrauliche Eingaben (Egress-Wächter) und bei Laufzeit-Rückfällen entstehen trotz true ggf.
  // keine Kosten (Serverseite: build-app.ts an den Status-Routen). Bewusst getrennt von `tasks`:
  // das ist NUTZBARKEIT und wird auch vom kostenlosen lokalen Modell erfüllt. Weiterhin nur ein
  // Boolean, kein Provider-/Modellname (vip2-gate). Fehlt es (alte Antwort), behauptet die
  // Oberfläche nichts.
  billable?: Record<string, boolean>;
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
  // mega52 D1: Niederländisch ist eine eigene Reasoner-Sprache.
  supportsLocales: ("de" | "en" | "nl")[];
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
  // AUFTRAG-mega64 Block A: die Einmalkennwörter der in DIESEM Ladevorgang neu angelegten
  // Demo-Konten. Sie kommen genau einmal, in dieser Antwort — der Server hat sie danach nur noch
  // als Prüfwert. Die Oberfläche zeigt sie deshalb SOFORT und sagt, dass es das einzige Mal ist.
  // Optional, weil ein übersprungener Ladevorgang keine anlegt und weil Bestandsserver das Feld
  // nicht kennen.
  einmalkennwoerter?: Array<{ email: string; kennwort: string }>;
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
  // FUNKE-FIX3 P0 (bens Blocker B): true → Gap-Fragetext serverseitig zurückgehalten; die Glocke
  // zeigt dann NUR die neutrale Bezeichnung (topbar.notifGapRedacted), nie den Fragetext.
  redacted?: boolean;
}

// AUFTRAG-mega46 Block F: die Betriebsschalter, die die Oberfläche erfahren darf — AUSSCHLIESSLICH
// Ja/Nein. Die Namen sind Fachnamen, keine Umgebungsvariablen (der Server übersetzt; siehe
// services/app/src/feature-flags.ts). BEWUSST hier eigenständig getippt und nicht aus services
// importiert: apps/web darf die Modulgrenze nach services nicht überschreiten.
// AUFTRAG-mega69 Block H: `confluenceImport` steht hier NICHT mehr. Erhoben (mega69, kalibriert an
// den echten Lesern `FeatureGate feature="demodaten"` und `useFeatures().data?.features?.…`): kein
// einziger Frontend-Leser — die Zugangs-Fläche (ImportAccessPanel) liest den aussagekräftigeren
// `enabled` der Zugangsroute, der auch bei NICHT registrierten Import-Routen antwortet. Ein
// typisierter Schlüssel ohne Leser ist eine Vertragsbehauptung ohne Fläche. Serverseitig bleibt der
// Schalter die notwendige Wahrheit (feature-flags.ts, Routen-Registrierung) und wird in
// /api/features weiter gemeldet — ein zusätzlicher, hier untypisierter Payload-Schlüssel ist im
// Partial-Vertrag zulässig und wird von niemandem gelesen.
export type FeatureName =
  | "herkunft"
  | "expertMatching"
  // AUFTRAG-mega61: die zwei Notausschalter. Ihre Vorgabe ist AN (Server: feature-flags.ts) — sie
  // sperren nichts, sie erlauben nur das Abschalten einer Pflichtfläche, wenn sie im Betrieb stört.
  // AUFTRAG-mega62 Block A: `hinweisbanner` deckt BEIDE Flächen des Hinweises — den Banner in der
  // Anwendungshülle UND denselben Text auf der Anmeldemaske. Vorher nur die erste; ein
  // Notausschalter für die Hälfte ist eine unwahre Auskunft.
  | "rechtsseiten"
  | "hinweisbanner"
  // AUFTRAG-mega64 Block A: das Demodaten-Laden. Vorgabe AUS, fail-closed — ein Werkzeug, das
  // Konten anlegt, ist keine Grundausstattung. Ohne diesen Schalter existiert die Route nicht
  // (services/app/src/routes/admin-routes.ts), und der Knopf erscheint deshalb auch nicht.
  | "demodaten";

// AUFTRAG-mega61: `Partial`, weil ein UNANGEMELDETER Aufrufer nur die Teilmenge bekommt, deren
// Fläche vor der Anmeldung erreichbar ist (rechtsseiten, hinweisbanner). Ein fehlender Schlüssel
// wird vom einzigen Leser (`FeatureGate`) wie „aus“ gewertet — dieselbe fail-closed Regel wie
// „noch nicht geladen“ und „Server hat nicht geantwortet“.
export type FeatureFlags = Partial<Record<FeatureName, boolean>>;

// ================================================================================================
// AUFTRAG-mega67 BLOCK C/D — der Zugangs-Zustand EINES Import-Systems.
// ================================================================================================
// Was hier NICHT steht, ist der eigentliche Punkt: kein Wert, kein Maskenfeld, keine Länge. Der Typ
// trägt gar keinen Platz, in den ein Geheimnis passen würde (s. services/confluence/src/
// credential-state.ts). Und `lastConnectedAt` ist heute IMMER null — es gibt im Bestand keinen Ort,
// der einen erfolgreichen Kontakt festhält, und eine erfundene Zahl wäre schlimmer als keine.
export interface ImportAccessStatus {
  system: string;
  /** Ist der Import eingeschaltet? Schalter aus ⇒ die Import-Routen existieren gar nicht. */
  enabled: boolean;
  /** Je Variable: benannt, und ob sie steht. Niemals ihr Wert. */
  credentials: { name: string; present: boolean }[];
  /** Kämen damit Zugangsdaten zustande? (Nicht: sind sie gültig — das wüsste nur ein Aufruf.) */
  credentialsUsable: boolean;
  blocker: "missing" | "insecure-base-url" | null;
  lastConnectedAt: string | null;
}
