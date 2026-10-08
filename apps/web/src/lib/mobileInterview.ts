// FR-MOB-02 / R-0092 — DAS INTERVIEW AM HANDY: reine, DOM-freie Logik.
//
// Am Handy stehen zwei Erfassungsarten bereit: Notiz (ein Textfeld) und Interview (eine Frage nach
// der anderen). Die Fragen sind DIESELBE feste Folge wie im deterministischen Interviewweg des
// Servers (`INTERVIEW_QUESTIONS`, services/reasoner/src/provider.ts), und die Antworten landen in
// denselben Feldern (`condenseInterview`): Kernaussage, Bedingung, Maßnahme, Stichworte.
//
// WARUM LOKAL UND OHNE MODELL: Erfasst wird an der Anlage, oft ohne Netz. Ein Interview, das für
// jede Frage den Server braucht, ginge dort nicht — und ein KI-Aufruf wäre ein neuer Egress, den
// dieser Auftrag nicht bestellt. Die Antworten gehen als gewöhnlicher Entwurf über den einen
// Speicherweg (`formToPayload`), offline über die Warteschlange; strukturiert wird später.
import type { DraftFormState } from "./draftForm";

/** Die Fragen als Textschlüssel — Wortlaut je Sprache im Wörterbuch (`mob.iv.frage1` …). */
export const MOBIL_INTERVIEW_FRAGEN = [
  "mob.iv.frage1",
  "mob.iv.frage2",
  "mob.iv.frage3",
  "mob.iv.frage4",
] as const;

export const LEERE_INTERVIEW_ANTWORTEN: readonly string[] = MOBIL_INTERVIEW_FRAGEN.map(() => "");

/**
 * Die Antworten → Formular. Antwort 1 ist die Kernaussage (das Feld, das die Entwurfsliste und
 * der Desktop zeigen), 2–4 füllen Bedingung, Maßnahme und Stichworte (kommagetrennt). Titel bleibt
 * leer wie an jeder Notiz ohne Titel; Fotos und alles Übrige des Formulars reisen unverändert mit.
 */
export function interviewZuForm(
  antworten: readonly string[],
  form: DraftFormState,
): DraftFormState {
  const [kern = "", bedingung = "", massnahme = "", stichworte = ""] = antworten;
  return {
    ...form,
    title: "",
    statement: kern,
    struktur: {
      conditions: [bedingung],
      measures: [massnahme],
      tags: stichworte.split(","),
    },
  };
}

/** Ist in irgendeiner Antwort schon etwas eingetragen? */
export function interviewBegonnen(antworten: readonly string[]): boolean {
  return antworten.some((a) => a.trim().length > 0);
}
