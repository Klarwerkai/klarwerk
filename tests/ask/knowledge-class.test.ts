import { describe, expect, it } from "vitest";
import type { KnowledgeClass } from "../../apps/web/src/api/types";
import { KNOWLEDGE_CLASS_META, knowledgeClassMeta } from "../../apps/web/src/lib/knowledgeClass";

// SCRUM-137: Jede KnowledgeClass muss ein verständliches Label + Tone haben.
const ALL_CLASSES: readonly KnowledgeClass[] = [
  "gesichert",
  "ungeprueft",
  "meinung",
  "extern",
  "annahme",
  "unbekannt",
];

describe("SCRUM-137: KnowledgeClass-Mapping", () => {
  it("hat für jeden KnowledgeClass-Wert ein Mapping mit Label-Key + Tone", () => {
    for (const k of ALL_CLASSES) {
      const meta = knowledgeClassMeta(k);
      expect(meta.labelKey).toBe(`ask.knowledgeClass.${k}`);
      expect(["pos", "warn", "crit", "neutral"]).toContain(meta.tone);
    }
    // Vollständigkeit: keine zusätzlichen/fehlenden Schlüssel im Record.
    expect(Object.keys(KNOWLEDGE_CLASS_META).sort()).toEqual([...ALL_CLASSES].sort());
  });

  it("liefert die richtigen Tones für gesichert und unbekannt", () => {
    expect(knowledgeClassMeta("gesichert")).toEqual({
      labelKey: "ask.knowledgeClass.gesichert",
      tone: "pos",
    });
    expect(knowledgeClassMeta("unbekannt")).toEqual({
      labelKey: "ask.knowledgeClass.unbekannt",
      tone: "crit",
    });
  });
});
