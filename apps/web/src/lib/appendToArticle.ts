// SCRUM-435: „Erkenntnis an bestehenden Artikel anhängen" — DOM-freie Auswahl-Logik für den
// Artikel-Picker. Filtert die vorhandenen Wissensobjekte nach Titel (Teilstring, groß-/klein-
// unabhängig); leere Suche zeigt alle. Die eigentliche Übernahme (Body anhängen via revise +
// Quelle via add-source) orchestriert die Komponente über bestehende Endpunkte — kein neuer Server.
import type { KnowledgeObject } from "../api/types";

export function filterArticlesByTitle(
  kos: readonly KnowledgeObject[],
  query: string,
): KnowledgeObject[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return [...kos];
  }
  return kos.filter((k) => k.title.toLowerCase().includes(q));
}
