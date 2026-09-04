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
  // JOB 3044: Laufzeit über die GELADENEN Läufe. `dauerGezaehlt` ist die Grundmenge der Summe —
  // ohne sie wäre `dauerSummeMs` eine Zahl ohne Bezug, denn Läufe mit unbrauchbaren Zeitstempeln
  // tragen bewusst nichts bei. Beide Werte werden immer zusammen angezeigt.
  dauerSummeMs: number;
  dauerGezaehlt: number;
}

// JOB 3044: DIE EINZIGE STELLE, DIE AUS DEN ZWEI ZEITSTEMPELN EINE DAUER MACHT.
//
// `null` heißt „aus diesem Paar lässt sich keine Dauer ableiten" und ist streng von `0`
// unterschieden: `0` ist der echte Messwert eines Laufs, dessen Start und Ende auf dieselbe
// Millisekunde fallen. Ein Ende VOR dem Start wird NICHT über den Betrag geglättet — ein solches
// Paar ist kaputt, und eine geglättete Zahl wäre eine erfundene Auskunft. Die Fläche schreibt bei
// `null` nichts hin.
export function modelRunDauerMs(
  record: Pick<ModelRunRecord, "startedAt" | "finishedAt">,
): number | null {
  const start = Date.parse(record.startedAt);
  const ende = Date.parse(record.finishedAt);
  if (Number.isNaN(start) || Number.isNaN(ende) || ende < start) {
    return null;
  }
  return ende - start;
}

// JOB 3044: DIE EINZIGE DARSTELLUNG DER DAUER — bewusst OHNE `toLocaleString`.
// Die Zahl darf nicht an der Sprache der Umgebung hängen: sie steht in drei Sprachen in derselben
// Form in einem übersetzten Satz, und ein Test darf sie wörtlich erwarten können.
export function formatiereDauer(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function summarizeModelRuns(records: readonly ModelRunRecord[]): ModelRunSummary {
  const byTask: Record<ModelRunTask, number> = {
    structure: 0,
    assist: 0,
    interview: 0,
    answer: 0,
    select: 0,
  };
  let dauerSummeMs = 0;
  let dauerGezaehlt = 0;
  for (const r of records) {
    byTask[r.task] += 1;
    const ms = modelRunDauerMs(r);
    if (ms !== null) {
      dauerSummeMs += ms;
      dauerGezaehlt += 1;
    }
  }
  return {
    total: records.length,
    success: records.filter((r) => r.status === "success").length,
    errors: records.filter((r) => r.status === "error").length,
    fallbacks: records.filter((r) => r.fallback).length,
    demo: records.filter((r) => r.demo).length,
    byTask,
    dauerSummeMs,
    dauerGezaehlt,
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
