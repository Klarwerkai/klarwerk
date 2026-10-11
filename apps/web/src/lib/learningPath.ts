// Reine, DOM-freie Lernpfad-Logik (SCRUM-145). Rechnet nur über echte API-Daten.
import type { LearningPath } from "../api/types";

export function isStepDone(done: readonly string[], stepId: string): boolean {
  return done.includes(stepId);
}

export function progressPercent(path: LearningPath, done: readonly string[]): number {
  if (path.steps.length === 0) {
    return 0;
  }
  const completed = path.steps.filter((s) => done.includes(s.id)).length;
  return Math.round((completed / path.steps.length) * 100);
}

export function completedCount(path: LearningPath, done: readonly string[]): number {
  return path.steps.filter((s) => done.includes(s.id)).length;
}

// R-1349 (Aufnahme gesamt-aufruferwaechter): Hier stand `nextOpenStep` (erster offener Lernschritt).
// Der Start zeigt die offenen Schritte über `learningOpenSteps` (`pages/Start.tsx`, R-0991 Nr. 39);
// die Funktion rief niemand und ist entfernt.
