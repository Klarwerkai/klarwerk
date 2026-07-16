import { describe, expect, it } from "vitest";
import { dropConfidential, isConfidential, normalizeConfidentiality } from "./confidentiality";

// SCRUM-415/502: EIN Prädikat für alle Egress-Stellen. „intern"/fehlend = nicht vertraulich (bleibt drin);
// „vertraulich"/„streng_vertraulich" = vertraulich (raus aus externen Kontexten).
describe("SCRUM-502: Vertraulichkeits-Egress-Filter", () => {
  it("isConfidential: nur vertraulich/streng_vertraulich; fehlend/leer/intern = false", () => {
    expect(isConfidential("vertraulich")).toBe(true);
    expect(isConfidential("streng_vertraulich")).toBe(true);
    expect(isConfidential("intern")).toBe(false);
    expect(isConfidential(undefined)).toBe(false);
    expect(isConfidential(null)).toBe(false);
  });

  it("dropConfidential: entfernt vertrauliche Einträge, behält interne/fehlende, Reihenfolge stabil", () => {
    const items = [
      { id: "a", confidentiality: "intern" as const },
      { id: "b", confidentiality: "vertraulich" as const },
      { id: "c" }, // fehlend = intern
      { id: "d", confidentiality: "streng_vertraulich" as const },
    ];
    expect(dropConfidential(items).map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("normalizeConfidentiality: unbekannt/leer → intern (defensiv)", () => {
    expect(normalizeConfidentiality("quatsch")).toBe("intern");
    expect(normalizeConfidentiality(undefined)).toBe("intern");
    expect(normalizeConfidentiality("vertraulich")).toBe("vertraulich");
  });
});
