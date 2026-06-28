import { describe, expect, it } from "vitest";
import {
  type KnowledgeGuidanceSurface,
  knowledgeGuidance,
} from "../../apps/web/src/lib/knowledgeGuidance";

describe("SCRUM-289: knowledgeGuidance", () => {
  it("liefert pro Oberfläche einen Titel, Body und mindestens zwei Führungspunkte", () => {
    for (const surface of ["start", "library", "ask"] satisfies KnowledgeGuidanceSurface[]) {
      const guide = knowledgeGuidance(surface);
      expect(guide.titleKey).toMatch(/^kg\./);
      expect(guide.bodyKey).toMatch(/^kg\./);
      expect(guide.items.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("Start erklärt den kompletten Knowledge-OS-Fluss: gesichert, prüfen, quellengebunden nutzen", () => {
    expect(knowledgeGuidance("start").items.map((i) => i.id)).toEqual([
      "secured",
      "review",
      "sourceBound",
    ]);
  });

  it("Library erklärt Reife/Nutzbarkeit ohne in Ask für offene KOs umzuleiten", () => {
    const items = knowledgeGuidance("library").items;
    expect(items.map((i) => i.id)).toEqual(["secured", "review"]);
    expect(items.find((i) => i.id === "review")?.to).toBe("/validierung");
  });

  it("Ask erklärt Quellenbindung und Review statt Fake-Sicherheit", () => {
    const items = knowledgeGuidance("ask").items;
    expect(items.map((i) => i.id)).toEqual(["sourceBound", "review"]);
    expect(items.find((i) => i.id === "sourceBound")?.to).toBe("/fragen");
    expect(items.find((i) => i.id === "review")?.to).toBe("/validierung");
  });

  it("verweist nur auf bestehende Produktflüsse und nutzt definierte Tönungen", () => {
    const allowedRoutes = new Set(["/bibliothek", "/validierung", "/fragen"]);
    const allowedTones = new Set(["pos", "warn", "neutral"]);
    for (const surface of ["start", "library", "ask"] satisfies KnowledgeGuidanceSurface[]) {
      for (const item of knowledgeGuidance(surface).items) {
        expect(allowedRoutes.has(item.to)).toBe(true);
        expect(allowedTones.has(item.tone)).toBe(true);
        expect(item.labelKey).toMatch(/^kg\./);
        expect(item.bodyKey).toMatch(/^kg\./);
      }
    }
  });
});
