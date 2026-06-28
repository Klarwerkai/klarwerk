// SCRUM-263: DOM-freier Übergang Wissenslücke → Erfassung. Baut den Link von einer offenen
// Wissenslücke (/risiko) nach /erfassen und übergibt die Gap-Frage als Query-Parameter; Capture
// liest sie als Startkontext für die Rohnotiz. KEIN automatisches KO, keine Lücken-Schließung,
// kein Backend — der Mensch ergänzt die Erfahrung, die KI strukturiert nur. Reine, testbare Logik.

const GAP_PARAM = "gap";

// Link von einer Gap-Frage zur Erfassung (Frage URL-encodiert als Kontext).
export function captureGapHref(question: string): string {
  return `/erfassen?${GAP_PARAM}=${encodeURIComponent(question.trim())}`;
}

// Startkontext aus den Query-Parametern lesen (null, wenn kein/leerer Parameter → kein Banner).
export function readGapContext(params: URLSearchParams): string | null {
  const value = params.get(GAP_PARAM)?.trim();
  return value && value.length > 0 ? value : null;
}
