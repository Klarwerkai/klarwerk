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
  author: string;
  at: string;
}

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
export interface ObjectRef {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: "image" | "document" | "binary";
  createdAt: string;
}

export interface ObjectContent {
  ref: ObjectRef;
  data: string;
}

export interface KnowledgeObject {
  id: string;
  title: string;
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
  comments?: KoComment[];
  attachments?: KoAttachment[];
  sources?: KoSource[];
}

export type Verdict = "up" | "warn" | "down";

export interface AssignmentSummary {
  userId: string;
  open: number;
  done: number;
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

export interface Gap {
  id: string;
  question: string;
  status: "offen" | "geschlossen";
  assignee: string | null;
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

export interface AssistResult {
  text: string;
  demo: boolean;
}

// SCRUM-132: reasoner-getriebenes Interview (stateless: Antworten rein, nächste Frage raus).
export interface InterviewResult {
  question: string | null;
  done: boolean;
  draft: StructureResult;
  demo: boolean;
}

export type NotificationKind = "conflict" | "gap";

export interface Notification {
  id: string;
  kind: NotificationKind;
  title: string;
  at: string;
}
