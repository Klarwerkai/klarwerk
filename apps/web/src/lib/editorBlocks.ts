// SCRUM-314: DOM-freie Modellierung der vier sichtbaren Body-Blocktypen (Info/Hinweis/Warnung/Erfolg)
// für den RichTextEditor. Liefert stabile Reihenfolge, i18n-Label-Keys, SICHERE CSS-Klassen und das
// Insert-HTML-Snippet. Bewusst statische, nicht dynamische Klassen — der Sanitizer (FE + Server)
// erlaubt exakt diese Klassen. Kein WYSIWYG-Neubau, keine neue Editor-Library.

export type EditorBlock = "info" | "note" | "warning" | "success";

// Reihenfolge = Anzeigereihenfolge der Toolbar-Buttons.
export const EDITOR_BLOCKS: readonly EditorBlock[] = ["info", "note", "warning", "success"];

// Sichtbares Button-Label je Blocktyp (i18n-Key).
export function editorBlockLabelKey(block: EditorBlock): string {
  return `editor.block.${block}`;
}

// Sichere, statische CSS-Klasse(n) je Blocktyp — `panel` (Basis) + Typvariante. Muss exakt zur
// Sanitizer-Allowlist (FE + Server) und zum CSS in index.css passen.
export function editorBlockClass(block: EditorBlock): string {
  return `panel panel-${block}`;
}

// HTML-Snippet zum Einfügen über exec("insertHTML", …). Leerer Absatz als Platzhalter (wie zuvor).
export function editorBlockHtml(block: EditorBlock): string {
  return `<div class="${editorBlockClass(block)}"><p>…</p></div>`;
}
