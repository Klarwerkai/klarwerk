import { describe, expect, it } from "vitest";
import { dropConfidential, isConfidential, normalizeConfidentiality } from "./confidentiality";

// P6: EIN Prädikat für alle Egress-Stellen. Nur ausdrücklich intern darf hinaus;
// vertrauliche und ungeklärte Werte bleiben geschützt, ohne eine Einstufung zu erfinden.
describe("SCRUM-502: Vertraulichkeits-Egress-Filter", () => {
  it("isConfidential: nur ausdrücklich intern passiert die Ausleitungsgrenze", () => {
    expect(isConfidential("vertraulich")).toBe(true);
    expect(isConfidential("streng_vertraulich")).toBe(true);
    expect(isConfidential("intern")).toBe(false);
    expect(isConfidential(undefined)).toBe(true);
    expect(isConfidential(null)).toBe(true);
  });

  it("dropConfidential: entfernt auch ungeklärte Einträge, behält ausdrücklich interne stabil", () => {
    const items = [
      { id: "a", confidentiality: "intern" as const },
      { id: "b", confidentiality: "vertraulich" as const },
      { id: "c" }, // fehlend bleibt ungeklärt
      { id: "d", confidentiality: "streng_vertraulich" as const },
    ];
    expect(dropConfidential(items).map((x) => x.id)).toEqual(["a"]);
  });

  it("normalizeConfidentiality: unbekannt/leer → intern (defensiv)", () => {
    expect(normalizeConfidentiality("quatsch")).toBe("intern");
    expect(normalizeConfidentiality(undefined)).toBe("intern");
    expect(normalizeConfidentiality("vertraulich")).toBe("vertraulich");
  });
});

describe("P6 · ungeklärte Ausleitung und unveränderte Bestandsverträge", () => {
  it.each([undefined, null, "", "Intern", "quatsch", 0, false, {}, []])(
    "ungültig/ungeklärt %j wird nicht als ausdrückliche Einstufung freigegeben",
    (stufe) => expect(isConfidential(stufe)).toBe(true),
  );

  it("der Filter erhält Auswahlreihenfolge und Objektidentität der internen Positiva", () => {
    const internA = { id: "intern-a", confidentiality: "intern" };
    const internB = { id: "intern-b", confidentiality: "intern" };
    const auswahl = [
      { id: "fehlt" },
      internA,
      { id: "null", confidentiality: null },
      { id: "ungueltig", confidentiality: "UNBEKANNT" },
      { id: "vertraulich", confidentiality: "vertraulich" },
      internB,
      { id: "streng", confidentiality: "streng_vertraulich" },
    ];
    const kopie = [...auswahl];
    const gefiltert = dropConfidential(auswahl);
    expect(gefiltert).toEqual([internA, internB]);
    expect(gefiltert[0]).toBe(internA);
    expect(gefiltert[1]).toBe(internB);
    expect(auswahl).toEqual(kopie);
  });
});
