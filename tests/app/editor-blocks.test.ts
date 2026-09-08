import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  EDITOR_BLOCKS,
  type EditorBlock,
  editorBlockClass,
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

  // JOB 3282 (EDITOR-R26): Der Fall „Insert-HTML" ist HIER ERSATZLOS ENTFERNT, weil sein Prüfling
  // entfernt ist. `editorBlockHtml` war das Snippet für `exec("insertHTML", …)` — der Weg, auf dem
  // Codex am 08.09. drei der vier Blocktypen verlor. Der Block entsteht jetzt als echter Knoten
  // (`lib/editorBlockInsert.ts`); gemessen wird er dort, wo er wirkt: am montierten Editor in
  // `tests/editor-r26/link-und-bloecke-mounted.test.tsx` (B1–B3) und am Einfügeort selbst in
  // `tests/editor-r26/blockeinfuegung.test.tsx`. Ein Test auf eine Zeichenkette, die niemand mehr
  // einfügt, wäre genau die Attrappe, gegen die Auftrag §8.2 steht.
});
