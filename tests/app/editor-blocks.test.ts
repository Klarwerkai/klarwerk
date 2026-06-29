import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  EDITOR_BLOCKS,
  type EditorBlock,
  editorBlockClass,
  editorBlockHtml,
  editorBlockLabelKey,
} from "../../apps/web/src/lib/editorBlocks";

// SCRUM-314: vier sichtbare Body-Blocktypen als reine DOM-freie Daten (Reihenfolge, i18n-Keys,
// sichere statische Klassen, Insert-HTML). Muss exakt zur Sanitizer-Allowlist (FE + Server) passen.
describe("SCRUM-314: editorBlocks", () => {
  it("liefert genau vier Blocktypen in fester Reihenfolge", () => {
    expect(EDITOR_BLOCKS).toEqual<EditorBlock[]>(["info", "note", "warning", "success"]);
  });

  it("Label-Keys sind stabil und in DE+EN vorhanden", () => {
    for (const block of EDITOR_BLOCKS) {
      expect(editorBlockLabelKey(block)).toBe(`editor.block.${block}`);
      for (const lng of ["de", "en"]) {
        const v = String(i18n.getResource(lng, "translation", editorBlockLabelKey(block)) ?? "");
        expect(v.length).toBeGreaterThan(0);
      }
    }
  });

  it("CSS-Klassen sind sicher/statisch: panel + panel-<typ>", () => {
    expect(editorBlockClass("info")).toBe("panel panel-info");
    expect(editorBlockClass("note")).toBe("panel panel-note");
    expect(editorBlockClass("warning")).toBe("panel panel-warning");
    expect(editorBlockClass("success")).toBe("panel panel-success");
  });

  it("Insert-HTML nutzt genau die erlaubten Block-Klassen (sanitizer-konform)", () => {
    for (const block of EDITOR_BLOCKS) {
      expect(editorBlockHtml(block)).toBe(`<div class="panel panel-${block}"><p>…</p></div>`);
    }
  });
});
