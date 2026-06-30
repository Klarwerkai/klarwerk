// SCRUM-346: DOM-freie Beschreibung der Live-Vorschau / Apply-Review-Fläche im Knowledge Input Studio.
// Trennt „Bearbeiten" und „Vorschau / Review" als stabile View-IDs mit i18n-Label-Keys und leitet aus
// dem aktuellen Entwurf einen ehrlichen Vorschau-Zustand ab (Body vorhanden? redaktionelle Blöcke?).
// Reine Ableitung über den bestehenden bodyReadMode-Helfer — KEIN DOM, kein Parser, kein Datenmodell,
// kein Auto-Save, keine Validierung. Die Vorschau ist ein Entwurf, kein validiertes Wissen.

import { bodyReadMode } from "./bodyReadMode";

export type StudioEditorView = "edit" | "preview";

// Reihenfolge = Umschalt-Reihenfolge: erst Bearbeiten, dann Vorschau/Review.
export const STUDIO_EDITOR_VIEWS: readonly StudioEditorView[] = ["edit", "preview"] as const;

export function studioEditorViewLabelKey(view: StudioEditorView): string {
  return `studio.view.${view}`;
}

export interface StudioPreviewState {
  hasBody: boolean;
  hasBlocks: boolean;
  // Wenn kein Body vorhanden ist, statt leerer Vorschau ein ehrlicher Hinweis-Key; sonst null.
  emptyHintKey: string | null;
}

export function studioPreviewState(draft: string | null | undefined): StudioPreviewState {
  const { hasBody, hasBlocks } = bodyReadMode(draft);
  return { hasBody, hasBlocks, emptyHintKey: hasBody ? null : "studio.preview.empty" };
}
