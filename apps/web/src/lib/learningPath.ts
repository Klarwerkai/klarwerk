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

export function nextOpenStep(
  path: LearningPath,
  done: readonly string[],
): LearningPath["steps"][number] | null {
  return path.steps.find((s) => !done.includes(s.id)) ?? null;
}
