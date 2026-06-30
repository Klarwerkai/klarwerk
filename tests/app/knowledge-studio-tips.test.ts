import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  KNOWLEDGE_STUDIO_TIPS,
  type KnowledgeStudioTipId,
  knowledgeStudioTips,
} from "../../apps/web/src/lib/knowledgeStudioTips";

// SCRUM-345: DOM-freie Bedien-/Formatierungs-Hilfe für den Knowledge Input Studio.
describe("SCRUM-345: knowledgeStudioTips", () => {
  it("liefert die stabile Item-Liste in fester Reihenfolge mit stabilen IDs", () => {
    expect(knowledgeStudioTips()).toBe(KNOWLEDGE_STUDIO_TIPS);
    expect(KNOWLEDGE_STUDIO_TIPS.map((t) => t.id)).toEqual<KnowledgeStudioTipId[]>([
      "select",
      "structure",
      "ai",
      "blocks",
    ]);
  });

  it("label/hint folgen dem stabilen Schema studio.tips.<id>.{label,hint}", () => {
    for (const tip of KNOWLEDGE_STUDIO_TIPS) {
      expect(tip.labelKey).toBe(`studio.tips.${tip.id}.label`);
      expect(tip.hintKey).toBe(`studio.tips.${tip.id}.hint`);
    }
  });

  it("nur der Formatier-Tipp trägt einen reinen Anzeige-Shortcut (kein echtes Shortcut-System)", () => {
    const select = KNOWLEDGE_STUDIO_TIPS.find((t) => t.id === "select");
    expect(select?.shortcut).toBeTruthy();
    expect(KNOWLEDGE_STUDIO_TIPS.filter((t) => t.shortcut).map((t) => t.id)).toEqual(["select"]);
  });

  it("Titel + alle label/hint sind DE und EN vorhanden (keine leeren Keys)", () => {
    const keys = [
      "studio.tips.title",
      ...KNOWLEDGE_STUDIO_TIPS.flatMap((t) => [t.labelKey, t.hintKey]),
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("bleibt ehrlich: KI-Tipp verspricht kein Auto-Speichern (DE/EN)", () => {
    expect(String(i18n.getResource("de", "translation", "studio.tips.ai.hint") ?? "")).toMatch(
      /bewusst|nichts wird automatisch/i,
    );
    expect(String(i18n.getResource("en", "translation", "studio.tips.ai.hint") ?? "")).toMatch(
      /nothing is saved automatically/i,
    );
  });
});
