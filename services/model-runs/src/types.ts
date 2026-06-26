// SCRUM-164 (Knowledge-OS-Foundation): technisches ModelRun-Protokoll v1. Macht KI-/Reasoner-
// Aufrufe nachvollziehbar, OHNE Prompt-/Antworttexte oder KO-Inhalte zu speichern. Nur Metadaten.
export type ModelRunTask = "structure" | "assist" | "interview";
export type ModelRunStatus = "success" | "error";

export interface ModelRunRecord {
  id: string;
  task: ModelRunTask;
  provider: string; // Name des tatsächlich genutzten Providers (kein Schlüssel)
  demo: boolean; // Ergebnis vom deterministischen Provider (kein echtes Modell)
  fallback: boolean; // primärer Provider war verfügbar, schlug fehl → deterministisch genutzt
  locale?: string;
  startedAt: string;
  finishedAt: string;
  status: ModelRunStatus;
  error?: string; // generische Fehlermeldung (NIE Prompt-/Antwortinhalt)
  model?: string; // Modellname, falls ein echtes Modell genutzt wurde
}
