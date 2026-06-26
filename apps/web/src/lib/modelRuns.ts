import type { ModelRunRecord, ModelRunTask } from "../api/types";

// SCRUM-165: DOM-freie Auswertung der ModelRun-Records (nur Metadaten). Keine Prompt-/
// Antworttexte; rein abgeleitete Zähler/Tones für die kompakte Stufe-2-Sicht.
export interface ModelRunSummary {
  total: number;
  success: number;
  errors: number;
  fallbacks: number;
  demo: number;
  byTask: Record<ModelRunTask, number>;
}

export function summarizeModelRuns(records: readonly ModelRunRecord[]): ModelRunSummary {
  const byTask: Record<ModelRunTask, number> = {
    structure: 0,
    assist: 0,
    interview: 0,
    answer: 0,
    select: 0,
  };
  for (const r of records) {
    byTask[r.task] += 1;
  }
  return {
    total: records.length,
    success: records.filter((r) => r.status === "success").length,
    errors: records.filter((r) => r.status === "error").length,
    fallbacks: records.filter((r) => r.fallback).length,
    demo: records.filter((r) => r.demo).length,
    byTask,
  };
}

export type ModelRunTone = "pos" | "crit";

// Status bestimmt den Ton: Fehler kritisch, Erfolg positiv (Fallback/Demo werden separat
// als eigene Marker angezeigt, nicht als Fehler).
export function modelRunStatusTone(record: Pick<ModelRunRecord, "status">): ModelRunTone {
  return record.status === "error" ? "crit" : "pos";
}

// Defensive Anzeige-Begrenzung (Server begrenzt bereits; FE kappt zusätzlich für die Card).
export function limitModelRuns(
  records: readonly ModelRunRecord[],
  limit: number,
): ModelRunRecord[] {
  return records.slice(0, Math.max(0, Math.floor(limit)));
}
