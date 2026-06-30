// SCRUM-345: DOM-freie Bedien-/Formatierungs-Hilfe für den Knowledge Input Studio. Macht den großen
// Arbeitsraum editor-näher, indem die vorhandenen Werkzeuge als kurze Arbeitsschritte erklärt werden:
// markieren → formatieren, Struktur über H2/H3, KI-Vorschlag prüfen und bewusst übernehmen, Templates/
// Blöcke gezielt einsetzen. Reine Daten/i18n-Beschreibung — KEIN echtes Shortcut-System (die `shortcut`-
// Angabe ist nur ein Anzeige-Hinweis auf native Browser-Tasten in contentEditable), kein DOM, kein
// Backend, keine neue Editor-/Toolbar-Logik, kein Auto-Save.

export type KnowledgeStudioTipId = "select" | "structure" | "ai" | "blocks";

export interface KnowledgeStudioTip {
  id: KnowledgeStudioTipId;
  labelKey: string;
  hintKey: string;
  // Reiner Anzeige-Hinweis (z. B. native ⌘B/⌘I in contentEditable). KEINE eigene Tastatur-Logik.
  shortcut?: string;
}

// Feste Reihenfolge = Anzeigereihenfolge: erst markieren/formatieren, dann strukturieren, dann KI,
// dann Templates/Blöcke. labelKey/hintKey folgen dem stabilen Schema studio.tips.<id>.{label,hint}.
export const KNOWLEDGE_STUDIO_TIPS: readonly KnowledgeStudioTip[] = [
  {
    id: "select",
    labelKey: "studio.tips.select.label",
    hintKey: "studio.tips.select.hint",
    shortcut: "⌘B · ⌘I",
  },
  {
    id: "structure",
    labelKey: "studio.tips.structure.label",
    hintKey: "studio.tips.structure.hint",
  },
  { id: "ai", labelKey: "studio.tips.ai.label", hintKey: "studio.tips.ai.hint" },
  { id: "blocks", labelKey: "studio.tips.blocks.label", hintKey: "studio.tips.blocks.hint" },
];

export function knowledgeStudioTips(): readonly KnowledgeStudioTip[] {
  return KNOWLEDGE_STUDIO_TIPS;
}
