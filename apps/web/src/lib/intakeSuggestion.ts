// SCRUM-527 (WP3-Design): der Struktur-Vorschlag. Bevorzugt kommt der Titel vom Reasoner (POST /reasoner
// task=structure). Fehlt ein KI-Modell, leitet diese reine, DOM-freie Heuristik einen PLATZHALTER aus dem
// Text ab — klar editierbar, kein erzwungenes Formular, kein Fake. Kategorie bleibt leer (Nutzer tippt an);
// die vermutete Quelle ist die erfassende Person (Experten-Name aus der Session).
export interface IntakeSuggestion {
  title: string;
  category: string;
  source: string;
}

const MAX_TITLE = 60;

export function deriveIntakeSuggestion(text: string, authorName: string): IntakeSuggestion {
  const clean = text.trim().replace(/\s+/g, " ");
  const firstSentence = (clean.split(/[.!?\n]/)[0] ?? clean).trim();
  const title =
    firstSentence.length > MAX_TITLE
      ? `${firstSentence.slice(0, MAX_TITLE - 1).trimEnd()}…`
      : firstSentence;
  return { title, category: "", source: authorName };
}
