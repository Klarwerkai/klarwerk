import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { EDITOR_BLOCKS } from "../../apps/web/src/lib/editorBlocks";
import {
  EDITOR_GUIDANCE,
  type EditorGuidanceId,
  editorGuidance,
} from "../../apps/web/src/lib/editorGuidance";

// SCRUM-317: DOM-freie Orientierung am ausführlichen Inhalt (Struktur/Handlung/Blöcke/KI).
describe("SCRUM-317: editorGuidance", () => {
  it("liefert genau vier Items in fester Reihenfolge mit stabilen IDs", () => {
    expect(editorGuidance()).toBe(EDITOR_GUIDANCE);
    expect(EDITOR_GUIDANCE.map((i) => i.id)).toEqual<EditorGuidanceId[]>([
      "structure",
      "action",
      "blocks",
      "ai",
    ]);
  });

  it("Titel + alle Item-Labels sind DE und EN vorhanden (keine leeren Keys)", () => {
    const keys = ["editor.guidance.title", ...EDITOR_GUIDANCE.map((i) => i.labelKey)];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("labelKeys folgen dem stabilen Schema editor.guidance.<id>", () => {
    for (const item of EDITOR_GUIDANCE) {
      expect(item.labelKey).toBe(`editor.guidance.${item.id}`);
    }
  });

  it("der Blöcke-Punkt verweist auf die real existierenden Blocktypen", () => {
    const blocksItem = EDITOR_GUIDANCE.find((i) => i.id === "blocks");
    expect(blocksItem?.blocks).toEqual(EDITOR_BLOCKS);
    expect(blocksItem?.blocks).toHaveLength(4);
  });

  it("bleibt ehrlich: kein Auto-/Validierungs-Versprechen im KI-Punkt (DE)", () => {
    const ai = String(i18n.getResource("de", "translation", "editor.guidance.ai") ?? "");
    expect(ai).toMatch(/bewusst/i);
    expect(ai).toMatch(/keine Auto/i);
  });
});
