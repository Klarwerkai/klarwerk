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

// AUFTRAG-mega5 Block A (bens Verlustpfade 1+2): der Interviewfortschritt reist als reine
// Textstruktur im Entwurf mit — gegebene Antworten, die gerade getippte (noch nicht gesendete)
// Antwort und die aktuelle Frage samt Abschluss-/Quellen-Flag. KEINE Modell-Nutzlast, kein
// Anbietername; nur das, was der Nutzer sieht bzw. eingegeben hat.
export interface DraftInterviewState {
  started: boolean;
  answers: string[];
  answer?: string;
  question?: string;
  done?: boolean;
  demo?: boolean;
}

// AUFTRAG-mega6 Block B (bens ROT 2, Weg zwei): der ausdrückliche LÖSCHMARKER für einen zuvor
// gesicherten Interviewfortschritt. Beim Aktualisieren eines bestehenden Entwurfs reicht es NICHT,
// das Feld wegzulassen — der Server merged dann den Altwert zurück. Diese substanzlose Hülle
// überlebt normalizeInterview() bewusst nicht und entfernt den Altwert damit wirklich.
export const CLEARED_DRAFT_INTERVIEW: DraftInterviewState = { started: false, answers: [] };

// Beim Speichern: aus dem Laufzeitzustand die Entwurfs-Struktur bilden. null = kein Interview
// begonnen → das Feld bleibt komplett aus der Payload (exactOptionalPropertyTypes-freundlich).
export function interviewForDraft(input: {
  started: boolean;
  answers: readonly string[];
  answer: string;
  result: InterviewResult | null;
}): DraftInterviewState | null {
  const { started, answers, answer, result } = input;
  if (!started && answers.length === 0 && answer.trim().length === 0 && !result) {
    return null;
  }
  return {
    started: true,
    answers: [...answers],
    ...(answer.trim().length > 0 ? { answer } : {}),
    ...(result?.question ? { question: result.question } : {}),
    ...(result ? { done: isInterviewDone(result), demo: result.demo } : {}),
  };
}

// Beim Fortsetzen: Entwurfs-Struktur → Laufzeitzustand. WICHTIG: hier wird NIE ein Modelllauf
// ausgelöst — liegt keine Frage vor (Speichern passierte, bevor die erste/nächste Frage ankam),
// bleibt result null; die Oberfläche bietet dann einen bewussten „Frage laden"-Klick an.
export function interviewFromDraft(
  state: DraftInterviewState,
  emptyDraft: InterviewResult["draft"],
): {
  started: boolean;
  answers: string[];
  answer: string;
  result: InterviewResult | null;
} {
  const answers = (state.answers ?? []).filter((a) => typeof a === "string");
  const hasResult = typeof state.question === "string" || state.done === true;
  return {
    started: true,
    answers,
    answer: typeof state.answer === "string" ? state.answer : "",
    result: hasResult
      ? {
          question: typeof state.question === "string" ? state.question : null,
          done: state.done ?? false,
          // Quelle der Fragen ehrlich wiederherstellen; fehlt das Flag (Alt-/fremde Payload),
          // lieber „Fallback" behaupten als fälschlich „echtes Modell".
          demo: state.demo ?? true,
          draft: emptyDraft,
        }
      : null,
  };
}
