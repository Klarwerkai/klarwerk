import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  KNOWLEDGE_STUDIO_SECTIONS,
  type KnowledgeStudioSectionId,
  knowledgeStudioSectionLabelKey,
  knowledgeStudioSections,
} from "../../apps/web/src/lib/knowledgeStudioLayout";

// SCRUM-341: Workspace-Layout des Knowledge Input Studio — drei stabile Bereiche (DOM-frei).
describe("SCRUM-341: knowledgeStudioLayout", () => {
  it("liefert genau die drei Bereiche in fester Reihenfolge", () => {
    expect(knowledgeStudioSections()).toBe(KNOWLEDGE_STUDIO_SECTIONS);
    expect(KNOWLEDGE_STUDIO_SECTIONS.map((s) => s.id)).toEqual<KnowledgeStudioSectionId[]>([
      "context",
      "editor",
      "assist",
    ]);
  });

  it("baut stabile labelKeys je Bereich", () => {
    expect(knowledgeStudioSectionLabelKey("context")).toBe("studio.section.context");
    expect(knowledgeStudioSectionLabelKey("editor")).toBe("studio.section.editor");
    expect(knowledgeStudioSectionLabelKey("assist")).toBe("studio.section.assist");
    expect(KNOWLEDGE_STUDIO_SECTIONS.map((s) => s.labelKey)).toEqual([
      "studio.section.context",
      "studio.section.editor",
      "studio.section.assist",
    ]);
  });

  it("Bereichs-i18n (studio.section.*) DE+EN vorhanden", () => {
    for (const section of KNOWLEDGE_STUDIO_SECTIONS) {
      for (const lng of ["de", "en"]) {
        expect(
          String(i18n.getResource(lng, "translation", section.labelKey) ?? "").length,
        ).toBeGreaterThan(0);
      }
    }
  });
});
