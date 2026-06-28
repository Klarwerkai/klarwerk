import { describe, expect, it } from "vitest";
import { ASK_EXAMPLES } from "../../apps/web/src/lib/askExamples";

// SCRUM-265: produktnahe Beispiel-Fragen als Startimpuls (kein Auto-Ask, nur Vorlage).
describe("SCRUM-265: askExamples", () => {
  it("bietet 2–3 Beispiele mit eindeutigen IDs und i18n-Frage-Keys", () => {
    expect(ASK_EXAMPLES.length).toBeGreaterThanOrEqual(2);
    expect(ASK_EXAMPLES.length).toBeLessThanOrEqual(3);
    const ids = ASK_EXAMPLES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of ASK_EXAMPLES) {
      expect(e.questionKey.startsWith("ask.example.")).toBe(true);
    }
  });

  it("zeigt beide ehrlichen Ausgänge: quellengebundene Antwort und Wissenslücke", () => {
    expect(ASK_EXAMPLES.some((e) => e.kind === "answerable")).toBe(true);
    expect(ASK_EXAMPLES.some((e) => e.kind === "gap")).toBe(true);
  });

  it("enthält die Industrie-/Linie-L4-/Dosierwert-Story als offene Lücke", () => {
    const dosing = ASK_EXAMPLES.find((e) => e.id === "dosing");
    expect(dosing).toBeDefined();
    expect(dosing?.kind).toBe("gap");
  });
});
