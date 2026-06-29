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
