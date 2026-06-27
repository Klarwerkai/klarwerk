import { describe, expect, it } from "vitest";
import { stufe2FeatureLabelKeys, stufe2HintKind } from "../../apps/web/src/lib/stufe2Hint";

describe("SCRUM-235: stufe2Hint", () => {
  it("nur Admin mit ausgeschaltetem Schalter → 'enable'", () => {
    expect(stufe2HintKind("admin", false)).toBe("enable");
  });

  it("Admin mit aktivem Schalter → kein Hinweis (Navigation zeigt die Gruppe)", () => {
    expect(stufe2HintKind("admin", true)).toBe("none");
  });

  it("Nicht-Admins bekommen keinen Hinweis (kein falsches Versprechen)", () => {
    for (const role of ["viewer", "experte", "controller"] as const) {
      expect(stufe2HintKind(role, false)).toBe("none");
      expect(stufe2HintKind(role, true)).toBe("none");
    }
  });

  it("Feature-Labels werden aus der Navigation abgeleitet (Stufe-2-Module)", () => {
    const keys = stufe2FeatureLabelKeys();
    expect(keys).toEqual(
      expect.arrayContaining(["nav.output", "nav.import", "nav.graph", "nav.capital"]),
    );
    // alle Keys sind nav.*-Labels, keine leeren Einträge
    expect(keys.every((k) => k.startsWith("nav."))).toBe(true);
    expect(keys.length).toBeGreaterThanOrEqual(4);
  });
});
