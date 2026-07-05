import { describe, expect, it } from "vitest";
import {
  CONFIDENTIALITY_LEVELS,
  confidentialityChip,
  confidentialityOf,
  isConfidential,
} from "../../apps/web/src/lib/confidentiality";

describe("SCRUM-415: Vertraulichkeit (Frontend-Helfer)", () => {
  it("kennt genau drei Stufen in stabiler Reihenfolge", () => {
    expect(CONFIDENTIALITY_LEVELS).toEqual(["intern", "vertraulich", "streng_vertraulich"]);
  });

  it("behandelt fehlendes Feld als 'intern'", () => {
    expect(confidentialityOf(undefined)).toBe("intern");
    expect(confidentialityOf(null)).toBe("intern");
    expect(confidentialityOf("vertraulich")).toBe("vertraulich");
    expect(isConfidential(undefined)).toBe(false);
    expect(isConfidential("vertraulich")).toBe(true);
  });

  it("liefert ein Chip nur für vertrauliche Stufen (nicht für 'intern')", () => {
    expect(confidentialityChip(undefined).showChip).toBe(false);
    expect(confidentialityChip("intern").showChip).toBe(false);

    const v = confidentialityChip("vertraulich");
    expect(v.showChip).toBe(true);
    expect(v.tone).toBe("warn");
    expect(v.labelKey).toBe("conf.level.vertraulich");

    const s = confidentialityChip("streng_vertraulich");
    expect(s.showChip).toBe(true);
    expect(s.tone).toBe("crit");
    expect(s.labelKey).toBe("conf.level.streng_vertraulich");
  });
});
