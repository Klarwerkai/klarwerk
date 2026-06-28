import { describe, expect, it } from "vitest";
import { KNOWLEDGE_CYCLE } from "../../apps/web/src/lib/knowledgeCycle";

// SCRUM-261: Der Knowledge-OS-Kreis ist der vorhandene Arbeitsfluss Capture → Validate → Use → Maintain.
describe("SCRUM-261: knowledgeCycle", () => {
  it("beschreibt genau vier Schritte in der Reihenfolge capture → validate → use → maintain", () => {
    expect(KNOWLEDGE_CYCLE.map((s) => s.id)).toEqual(["capture", "validate", "use", "maintain"]);
  });

  it("Capture/Validate/Maintain führen unverändert auf ihre vorhandenen Routen", () => {
    const by = Object.fromEntries(KNOWLEDGE_CYCLE.map((s) => [s.id, s.to]));
    expect(by.capture).toBe("/erfassen");
    expect(by.validate).toBe("/validierung");
    expect(by.maintain).toBe("/lebenszyklus");
  });

  // SCRUM-275: Use leitet mit demo-sicherer Startfrage in den Ask-Flow (kein Auto-Submit).
  it("Use führt auf /fragen?q=… mit URL-encodierter, seed-sicherer Startfrage", () => {
    const use = KNOWLEDGE_CYCLE.find((s) => s.id === "use");
    expect(use?.to.startsWith("/fragen?q=")).toBe(true);
    // Seed-Tokens bleiben erhalten → trifft das deutschsprachige validierte Demo-Wissen.
    expect(use?.to).toContain(encodeURIComponent("Ventil X"));
    expect(use?.to).toContain(encodeURIComponent("Überdruck"));
  });

  it("jeder Schritt hat ein nicht-leeres Label- und Beschreibungs-Label", () => {
    for (const step of KNOWLEDGE_CYCLE) {
      expect(step.labelKey.length).toBeGreaterThan(0);
      expect(step.descKey.length).toBeGreaterThan(0);
    }
  });
});
