// R-0348: der Gesprächsfaden der Fragen-Seite — DOM-freie Regeln. Eine Nachfrage fängt nicht bei
// null an: die vorangegangenen Fragen derselben Fragestrecke reisen mit (`thread` an POST /api/ask).
// R-0345 bleibt: kein offener Chatbot — der Server nutzt den Faden nur, um Quellen zu finden; die
// Antwort bleibt quellengebunden. Derselbe Deckel wie am Server (`GESPRAECHSFADEN_MAX_FRAGEN`).
export const FADEN_MAX_FRAGEN = 3;

// Was zu einer Frage mitgeschickt wird: der Faden OHNE diese Frage selbst — dieselbe Frage erneut
// zu stellen ist eine Auffrischung, keine Nachfrage auf sich selbst.
export function fadenFuerAnfrage(faden: readonly string[], frage: string): string[] {
  return faden.filter((f) => f !== frage).slice(-FADEN_MAX_FRAGEN);
}

// Nach einer angekommenen Antwort (auch einer Wissenslücke) gehört die Frage zum Faden — als
// jüngste, ohne Doppelung.
export function fadenNachAntwort(faden: readonly string[], frage: string): string[] {
  return [...faden.filter((f) => f !== frage), frage].slice(-FADEN_MAX_FRAGEN);
}
