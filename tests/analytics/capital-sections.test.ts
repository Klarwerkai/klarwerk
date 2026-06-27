import { describe, expect, it } from "vitest";
import {
  CAPITAL_SECTIONS,
  sectionAnchor,
  sectionHref,
} from "../../apps/web/src/lib/capitalSections";

describe("SCRUM-227: capitalSections", () => {
  it("listet genau die konsolidierten Management-Sektionen in Renderreihenfolge", () => {
    expect(CAPITAL_SECTIONS.map((s) => s.id)).toEqual([
      "overview",
      "capital",
      "valuation",
      "statement",
      "maturity",
      "house",
      "recommendations",
      "priorities",
      "pilot",
    ]);
  });

  it("jede Sektion hat einen mgmt.*-Label-Key", () => {
    for (const s of CAPITAL_SECTIONS) {
      expect(s.labelKey.startsWith("mgmt.")).toBe(true);
    }
  });

  it("IDs sind eindeutig (keine Anker-Kollision)", () => {
    const ids = CAPITAL_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("sectionAnchor/sectionHref liefern stabile, kollisionsarme Anker", () => {
    expect(sectionAnchor("overview")).toBe("kapital-overview");
    expect(sectionHref("pilot")).toBe("#kapital-pilot");
  });
});
