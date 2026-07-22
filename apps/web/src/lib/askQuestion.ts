// SCRUM-272: DOM-freier Query-Parameter-Helfer für die Ask-Startfrage. Erlaubt ehrliche Deep-Links
// aus Library/KO-Detail/Hilfe nach /fragen?q=… : die Frage wird nur VORBEFÜLLT, nicht automatisch
// ausgeführt. Kein Backend, keine Suche — derselbe Konvention wie captureFromGap.ts (?gap=…).

const Q_PARAM = "q";

// Deep-Link zur Ask-Seite mit vorbefüllter Frage (URL-encodiert).
export function askQuestionHref(question: string): string {
  return `/fragen?${Q_PARAM}=${encodeURIComponent(question.trim())}`;
}

// Startfrage aus den Query-Parametern lesen (null bei leer/fehlend → kein Effekt).
export function readAskQuestion(params: URLSearchParams): string | null {
  const value = params.get(Q_PARAM)?.trim();
  return value && value.length > 0 ? value : null;
}

// SCRUM-295: true, wenn Ask mit einer vorbefüllten Startfrage (?q=…) erreicht wurde — z. B. über die
// „Wissen nutzen"-CTA aus KO-Detail/Library. Reine, DOM-freie Logik (kein Auto-Submit) — nur, um im
// Demo-/Use-Kontext einen ehrlichen Hinweis zu zeigen (Frage ist Startpunkt; Antwort bleibt quellengebunden).
export function isPrefilledAskQuestion(params: URLSearchParams): boolean {
  return readAskQuestion(params) !== null;
}

// SCRUM-460: Ausdrücklicher „aus der Suche antworten"-Marker. Die Bibliothek-Suche verlinkt hierher,
// damit die Frage nicht nur vorbefüllt, sondern EINMAL automatisch beantwortet wird — so bietet die
// Suche eine echte Antwort mit Quellen statt nur Artikel-Treffer. Für den normalen /fragen?q=…-Deep-Link
// (SCRUM-272) bleibt es beim reinen Vorbefüllen.
const ASK_PARAM = "ask";

// Deep-Link zur Ask-Seite mit vorbefüllter Frage UND ausdrücklichem Auto-Antwort-Wunsch (aus der Suche).
export function askAnswerHref(question: string): string {
  return `${askQuestionHref(question)}&${ASK_PARAM}=1`;
}

// true, wenn Ask aus der Suche mit ausdrücklichem Antwort-Wunsch erreicht wurde (?ask=1 UND eine Frage
// vorhanden). Nur dann wird EINMAL automatisch beantwortet. Reine, DOM-freie Logik.
export function shouldAutoAskFromSearch(params: URLSearchParams): boolean {
  return params.get(ASK_PARAM) === "1" && readAskQuestion(params) !== null;
}

// WP-POLISH-CLOSE (bens Punkt 1): Deep-Link für Fragen zu VERTRAULICHEN KOs — die Frage wird nur
// VORBEFÜLLT (bewusst OHNE ?ask=1: kein Auto-Send), und der Marker lässt die Ask-Seite den
// nüchternen Hinweis zeigen („Vertraulicher Inhalt — prüfe die Frage vor dem Senden"). Der Nutzer
// sendet selbst; die Frage-Fähigkeit bleibt erhalten (ehrlichere Variante als ein toter Knopf).
const CONFIDENTIAL_PARAM = "vertraulich";

export function askConfidentialQuestionHref(question: string): string {
  return `${askQuestionHref(question)}&${CONFIDENTIAL_PARAM}=1`;
}

// true, wenn Ask mit einer vorbefüllten Frage zu einem vertraulichen KO erreicht wurde.
export function isConfidentialAskPrefill(params: URLSearchParams): boolean {
  return params.get(CONFIDENTIAL_PARAM) === "1" && readAskQuestion(params) !== null;
}
