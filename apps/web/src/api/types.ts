import type { Role } from "../app/navigation";

export type { Role };

export type KnowledgeType =
  | "bauchgefuehl"
  | "best_practice"
  | "lernkurve"
  | "technik"
  | "negativwissen";

export type KoStatus = "offen" | "validiert";

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
  createdAt: string;
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
}

export interface ReasonerStatus {
  active: boolean;
  provider: string;
  mode: "model" | "deterministic";
}

// SCRUM-166: read-only Provider-/Model-Konfiguration (nur Metadaten, keine Secrets).
export type ReasonerConfigMode = "model" | "fallback" | "demo";
export type ReasonerTask = "structure" | "assist" | "interview" | "answer" | "select" | "extract";

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

export type NotificationKind = "conflict" | "gap" | "assignment" | "impact";

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
