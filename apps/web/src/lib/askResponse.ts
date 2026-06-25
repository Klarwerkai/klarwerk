// Reine, DOM-freie Selektoren für den Ask-Response-Wrapper (SCRUM-138).
// Backend `POST /api/ask` liefert `{ result: AnswerResult, gap: Gap | null }`.
import type { AnswerResult, AskResponse, Gap } from "../api/types";

export function selectAnswer(response: AskResponse): AnswerResult {
  return response.result;
}

export function selectGap(response: AskResponse): Gap | null {
  return response.gap;
}
