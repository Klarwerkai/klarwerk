import { describe, expect, it } from "vitest";
import { emptyStateActions } from "../../apps/web/src/lib/emptyStateActions";

describe("SCRUM-181: emptyStateActions", () => {
  it("start (admin, stufe2) bietet Erfassen/Import/Admin", () => {
    const a = emptyStateActions("start", "admin", true).map((x) => x.labelKey);
    expect(a).toEqual(["empty.cta.capture", "empty.cta.import", "empty.cta.admin"]);
  });

  it("viewer sieht KEIN Erfassen (ko.create-Rolle nötig) und kein Admin", () => {
    const a = emptyStateActions("start", "viewer", true).map((x) => x.labelKey);
    expect(a).not.toContain("empty.cta.capture");
    expect(a).not.toContain("empty.cta.admin");
  });

  it("Import ist Stufe-2 + Admin: nur mit aktivem Stufe-2 angeboten", () => {
    const withS2 = emptyStateActions("library", "admin", true).map((x) => x.labelKey);
    const noS2 = emptyStateActions("library", "admin", false).map((x) => x.labelKey);
    expect(withS2).toContain("empty.cta.import");
    expect(noS2).not.toContain("empty.cta.import");
    expect(noS2).toContain("empty.cta.capture"); // Erfassen bleibt verfügbar
  });

  it("validation: Experte bekommt Erfassen + Aufgaben", () => {
    const a = emptyStateActions("validation", "experte", false).map((x) => x.labelKey);
    expect(a).toEqual(["empty.cta.capture", "empty.cta.tasks"]);
  });

  it("liefert echte Navigationspfade (kein Fremd-Link)", () => {
    for (const action of emptyStateActions("tasks", "admin", true)) {
      expect(action.to.startsWith("/")).toBe(true);
    }
  });
});
