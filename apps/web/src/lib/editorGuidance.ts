// SCRUM-317: DOM-freie Orientierung am ausführlichen Inhalt (RichTextEditor). Erklärt Beta-Nutzern
// kompakt, was die Editor-Werkzeuge bewirken — Struktur (H2/H3), Handlungswissen (Listen/Links),
// Body-Blöcke (Info/Hinweis/Warnung/Erfolg) und KI-Hilfe (Vorschlag, bewusst übernehmen). Reine
// Daten/i18n-Beschreibung, keine DOM-Abhängigkeit, keine neue Editor-/Toolbar-Logik.

import { EDITOR_BLOCKS, type EditorBlock } from "./editorBlocks";

export type EditorGuidanceId = "structure" | "action" | "blocks" | "ai";

export interface EditorGuidanceItem {
  id: EditorGuidanceId;
  labelKey: string;
  // SCRUM-317: der Blöcke-Punkt verweist auf die real existierenden Blocktypen (SCRUM-314/316).
  blocks?: readonly EditorBlock[];
}

// Reihenfolge = Anzeigereihenfolge.
export const EDITOR_GUIDANCE: readonly EditorGuidanceItem[] = [
  { id: "structure", labelKey: "editor.guidance.structure" },
  { id: "action", labelKey: "editor.guidance.action" },
  { id: "blocks", labelKey: "editor.guidance.blocks", blocks: EDITOR_BLOCKS },
  { id: "ai", labelKey: "editor.guidance.ai" },
];

export function editorGuidance(): readonly EditorGuidanceItem[] {
  return EDITOR_GUIDANCE;
}
