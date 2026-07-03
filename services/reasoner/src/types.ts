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

// PMO-FEA-0006: ein aus einem Dokument extrahierter Wissenspunkt. sourceExcerpt ist die
// wörtliche Belegstelle aus dem Dokument (G-2: nur was im Text steht, nichts erfinden).
export interface ExtractedPoint {
  title: string; // die Aussage in einem Satz
  summary: string; // Kurzfassung des Wissenspunkts
  sourceExcerpt: string; // wörtlicher Auszug aus dem Dokument als Beleg
}

// PMO-FEA-0006: Ergebnis der Wissens-Extraktion aus Dokumenttext. Ohne Modell gibt es
// KEINE Fake-Punkte — points bleibt leer und note erklärt ehrlich warum (FR-RSN-04/G-2).
// SCRUM-426: Public-KI-Anreicherung — bewusst NICHT quellengebundener Modell-Beitrag
// (Weltwissen), klar als extern/ungeprüft zu behandeln. Ohne Modell: leer + demo=true.
export interface EnrichResult {
  text: string;
  provider: string;
  demo: boolean;
}

export interface ExtractResult {
  points: ExtractedPoint[];
  note: string | null; // ehrliche Erklärung, wenn keine Punkte geliefert werden können
  demo: boolean; // true = deterministischer Fallback (kein Modell)
}

export interface ReasonerStatus {
  active: boolean; // FR-RSN-05: spiegelt tatsächliche Modell-Verfügbarkeit.
  provider: string;
  mode: "model" | "deterministic";
}

// SCRUM-166: read-only Provider-/Model-Konfigurationssicht. Nur technische Metadaten —
// KEINE Secrets/API-Keys, keine Prompt-/Antwortinhalte. provider/model sind Anzeige-Labels.
export type ReasonerConfigMode = "model" | "fallback" | "demo";
export type ReasonerTask = "structure" | "assist" | "interview" | "answer" | "select" | "extract";

// KI-Verwaltung (Pedi 02./03.07.): je Aufgabe bewusst wählen.
//  - "auto"          Cloud → lokal → deterministisch (was verfügbar ist, in dieser Reihenfolge)
//  - "cloud"         das Cloud-Modell verlangen (ehrlicher Fallback, wenn nicht verfügbar)
//  - "local"         den EIGENEN lokalen LLM verlangen (SCRUM-424; ehrlicher Fallback)
//  - "model"         Alias für "cloud" (Rückwärtskompatibilität)
//  - "deterministic" bewusst ohne Modell
export type ReasonerTaskChoice = "auto" | "model" | "cloud" | "local" | "deterministic";
export interface ReasonerTaskConfig {
  global: ReasonerTaskChoice;
  perTask: Partial<
    Record<
      "structure" | "assist" | "interview" | "answer" | "select" | "extract",
      ReasonerTaskChoice
    >
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
  // SCRUM-424: der eigene lokale LLM (verdrahtet & auswählbar?) + sein Anzeige-Label.
  localConfigured: boolean;
  localProvider?: string;
  // SCRUM-424: welche KI je Aufgabe EFFEKTIV zuerst arbeitet (cloud/lokal/deterministisch).
  effectiveProvider: Record<string, "cloud" | "local" | "deterministic">;
  // v1 bewusst ohne Persistenz (gilt bis Neustart) — UI zeigt das ehrlich an.
  persisted: boolean;
}

// Key-Test (Pedi 02.07.): Ergebnis eines echten Mini-Aufrufs — ehrlich, keine Vermutung.
export interface ReasonerProbeResult {
  ok: boolean;
  provider: string; // Label (kein Schlüssel)
  mode: "model" | "deterministic";
  detail: string; // ehrliche Begründung (z. B. "Modell-API antwortete mit 401")
  at: string; // Zeitstempel des Tests (ISO)
}
