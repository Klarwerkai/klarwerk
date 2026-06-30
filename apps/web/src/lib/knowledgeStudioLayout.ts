// SCRUM-341: DOM-freie Layout-Beschreibung für den Knowledge Input Studio. Liefert die drei stabilen
// Arbeitsbereiche des Studio-Arbeitsraums (Kontext/Struktur · Inhalt bearbeiten · KI-Hilfe) als IDs +
// i18n-Label-Keys, damit Komponente UND Tests dieselbe Quelle nutzen. Reine Konstanten/Funktionen —
// kein DOM, kein Datenmodell, keine neue Editor-Library, keine Mutation.

export type KnowledgeStudioSectionId = "context" | "editor" | "assist";

export interface KnowledgeStudioSection {
  id: KnowledgeStudioSectionId;
  labelKey: string;
}

export function knowledgeStudioSectionLabelKey(id: KnowledgeStudioSectionId): string {
  return `studio.section.${id}`;
}

// Feste Reihenfolge: erst Kontext/Struktur, dann die zentrale Editorfläche, dann die KI-Hilfe.
export const KNOWLEDGE_STUDIO_SECTIONS: readonly KnowledgeStudioSection[] = (
  ["context", "editor", "assist"] as const
).map((id) => ({ id, labelKey: knowledgeStudioSectionLabelKey(id) }));

export function knowledgeStudioSections(): readonly KnowledgeStudioSection[] {
  return KNOWLEDGE_STUDIO_SECTIONS;
}
