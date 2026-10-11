// SCRUM-341: DOM-freie Layout-Beschreibung für den Knowledge Input Studio. Liefert die drei stabilen
// Arbeitsbereiche des Studio-Arbeitsraums (Kontext/Struktur · Inhalt bearbeiten · KI-Hilfe) als IDs +
// i18n-Label-Keys, damit Komponente UND Tests dieselbe Quelle nutzen. Reine Konstanten/Funktionen —
// kein DOM, kein Datenmodell, keine neue Editor-Library, keine Mutation.
//
// R-1349 (Aufnahme gesamt-aufruferwaechter): Hier standen zusätzlich die Tabelle
// `KNOWLEDGE_STUDIO_SECTIONS` (samt Typ) und ihr Zugriff `knowledgeStudioSections()`. Kein Produktweg
// las sie — das Studio rendert seine Abschnitte direkt mit `knowledgeStudioSectionLabelKey`
// (`components/KnowledgeInputStudio.tsx`, R-0991 Nr. 36). Beide sind entfernt.

export type KnowledgeStudioSectionId = "context" | "editor" | "assist";

export function knowledgeStudioSectionLabelKey(id: KnowledgeStudioSectionId): string {
  return `studio.section.${id}`;
}
