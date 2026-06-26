// Reine, DOM-freie Helfer für das reasoner-getriebene Interview (SCRUM-132).
// Die eigentliche Fragenerzeugung/Verdichtung liegt im Reasoner-Service; hier nur
// FE-seitige Akkumulation, Abschluss- und Statuslogik.
import type { InterviewResult } from "../api/types";

// Antwort an die bisherige Antwortliste anhängen (getrimmt).
export function appendAnswer(answers: readonly string[], text: string): string[] {
  return [...answers, text.trim()];
}

// Interview abgeschlossen, wenn der Server done meldet oder keine Frage mehr liefert.
export function isInterviewDone(result: Pick<InterviewResult, "done" | "question">): boolean {
  return result.done || result.question === null;
}

// i18n-Key für die Quelle der Fragen: deterministischer Fallback vs. echtes Modell.
export function interviewSourceKey(result: Pick<InterviewResult, "demo">): string {
  return result.demo ? "capture.ivFallback" : "capture.ivModel";
}

// Anzahl bisher beantworteter Turns (für Fortschrittsanzeige).
export function answeredTurns(answers: readonly string[]): number {
  return answers.length;
}
