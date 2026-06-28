import { describe, expect, it } from "vitest";
import { KNOWLEDGE_CYCLE } from "../../apps/web/src/lib/knowledgeCycle";

// SCRUM-261: Der Knowledge-OS-Kreis ist der vorhandene Arbeitsfluss Capture → Validate → Use → Maintain.
describe("SCRUM-261: knowledgeCycle", () => {
  it("beschreibt genau vier Schritte in der Reihenfolge capture → validate → use → maintain", () => {
    expect(KNOWLEDGE_CYCLE.map((s) => s.id)).toEqual(["capture", "validate", "use", "maintain"]);
  });

  it("führt nur auf vorhandene Routen", () => {
    expect(KNOWLEDGE_CYCLE.map((s) => s.to)).toEqual([
      "/erfassen",
      "/validierung",
      "/fragen",
      "/lebenszyklus",
    ]);
  });

  it("jeder Schritt hat ein nicht-leeres Label- und Beschreibungs-Label", () => {
    for (const step of KNOWLEDGE_CYCLE) {
      expect(step.labelKey.length).toBeGreaterThan(0);
      expect(step.descKey.length).toBeGreaterThan(0);
    }
  });
});
