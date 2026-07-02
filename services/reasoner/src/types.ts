// SCRUM-88 / FR-I18N-01: sprachbewusste Reasoner-Steuerung. Nur DE/EN; Default "de".
// Steuert Prompting, Interview-Fragen und Step-Labels — NICHT den Quelleninhalt.
export type ReasonerLocale = "de" | "en";

// Minimaler Wissens-Bezug (entkoppelt: reasoner kennt knowledge-object nicht direkt).
export interface KnowledgeRef {
  id: string;
  title: string;
  statement: string;
  status: "offen" | "validiert";
  trust: number;
}

// FR-RSN-03: Trennung gesichert / ungeprüft / Meinung / extern / Annahme / unbekannt.
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
  snippet: string | null; // FR-ASK-06: konkrete Belegstelle/Textstelle der Quelle.
}

export interface AnswerResult {
  answered: boolean;
  answer: string | null;
  knowledgeClass: KnowledgeClass;
  trust: number;
  sources: string[];
  steps: AnswerStep[];
  demo: boolean; // FR-RSN-04: ohne Modell als Demo erkennbar.
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

// FR-RSN-03: sprachliche Präzisierung/Glättung eines Textes (ohne Inhalt zu erfinden).
export interface AssistResult {
  text: string;
  demo: boolean;
}

// SCRUM-132: reasoner-getriebenes Interview. Stateless: Antworten rein, nächste Frage +
// aus den Antworten verdichteter Entwurf raus. Eine Frage pro Turn. demo=true → Fallback.
export interface InterviewResult {
  question: string | null; // nächste Frage; null, wenn ausreichend Inhalt
  done: boolean; // Abschluss erreicht
  draft: StructureResult; // nachvollziehbar aus den Antworten verdichtet
  demo: boolean; // deterministischer Fallback klar markiert
}

export interface ReasonerStatus {
  active: boolean; // FR-RSN-05: spiegelt tatsächliche Modell-Verfügbarkeit.
  provider: string;
  mode: "model" | "deterministic";
}

// SCRUM-166: read-only Provider-/Model-Konfigurationssicht. Nur technische Metadaten —
// KEINE Secrets/API-Keys, keine Prompt-/Antwortinhalte. provider/model sind Anzeige-Labels.
export type ReasonerConfigMode = "model" | "fallback" | "demo";
export type ReasonerTask = "structure" | "assist" | "interview" | "answer" | "select";

// KI-Verwaltung v1 (Pedi 02.07., Teil-Slice des PMO-Eintrags „KI-Management-Seite"):
// je Aufgabe bewusst wählen — "auto" (Modell wenn verfügbar), "model" (Modell verlangen,
// ehrlicher Fallback wenn nicht verfügbar) oder "deterministic" (bewusst ohne Modell).
export type ReasonerTaskChoice = "auto" | "model" | "deterministic";
export interface ReasonerTaskConfig {
  global: ReasonerTaskChoice;
  perTask: Partial<
    Record<"structure" | "assist" | "interview" | "answer" | "select", ReasonerTaskChoice>
  >;
}

export interface ReasonerConfigStatus {
  provider: string; // Label des aktiven Providers (kein Schlüssel)
  model?: string; // Modell-Label, falls ein echtes Modell konfiguriert ist
  configured: boolean; // ist ein echtes Modell verdrahtet & verfügbar?
  mode: ReasonerConfigMode; // "model" konfiguriert · sonst "demo" (deterministisch)
  fallbackAvailable: boolean; // deterministischer Fallback immer verfügbar (FR-RSN-04)
  supportsLocales: ReasonerLocale[];
  tasks: ReasonerTask[];
  // KI-Verwaltung v1: gewünschte Zuordnung + was je Aufgabe EFFEKTIV läuft (ehrlich).
  taskConfig: ReasonerTaskConfig;
  effective: Record<string, "model" | "deterministic">;
  // v1 bewusst ohne Persistenz (gilt bis Neustart) — UI zeigt das ehrlich an.
  persisted: boolean;
}
