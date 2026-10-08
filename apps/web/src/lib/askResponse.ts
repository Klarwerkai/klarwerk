// Reine, DOM-freie Selektoren für den Ask-Response-Wrapper (SCRUM-138).
// Backend `POST /api/ask` liefert `{ result: AnswerResult, gap: Gap | null }`.
import type { AnswerResult, AskResponse } from "../api/types";

export function selectAnswer(response: AskResponse): AnswerResult {
  return response.result;
}

// R-1349: Hier stand `selectGap`. Ask liest `r.gap` unmittelbar (R-0991 Nr. 5); der Selektor hatte
// keinen Produktleser und ist entfernt.
