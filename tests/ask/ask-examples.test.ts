import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { ASK_EXAMPLES, askExpectation } from "../../apps/web/src/lib/askExamples";

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

// SCRUM-266: je Beispiel-Art eine knappe, unterscheidbare Ergebnis-Erwartung.
describe("SCRUM-266: askExpectation", () => {
  it("answerable → Antwort-Erwartung, gap → Lücken-Erwartung", () => {
    expect(askExpectation("answerable")).toEqual({ labelKey: "ask.expect.answer", tone: "answer" });
    expect(askExpectation("gap")).toEqual({ labelKey: "ask.expect.gap", tone: "gap" });
  });

  it("answerable und gap sind unterscheidbar (Tönung und Label)", () => {
    const a = askExpectation("answerable");
    const g = askExpectation("gap");
    expect(a.tone).not.toBe(g.tone);
    expect(a.labelKey).not.toBe(g.labelKey);
  });

  it("jedes Beispiel hat eine auflösbare Erwartung", () => {
    for (const e of ASK_EXAMPLES) {
      expect(askExpectation(e.kind).labelKey.startsWith("ask.expect.")).toBe(true);
    }
  });
});

// SCRUM-269: Beispiele bleiben in DE UND EN seed-sicher — die technischen Seed-Begriffe
// (Ventil X, Überdruck, Filter F3, Linie L4, Dosierwert, Schichtwechsel) gehen durch die
// Übersetzung nicht verloren, damit „answerable" ehrlich answerable bleibt.
describe("SCRUM-269: askExamples seed-sicher (DE/EN)", () => {
  const text = (lng: string, key: string): string =>
    String(i18n.getResource(lng, "translation", key) ?? "");

  it("jedes Beispiel deklariert seine Seed-Tokens", () => {
    for (const e of ASK_EXAMPLES) {
      expect(e.seedTokens.length).toBeGreaterThan(0);
    }
  });

  it("DE und EN Beispieltexte enthalten alle deklarierten Seed-Tokens", () => {
    for (const lng of ["de", "en"]) {
      for (const e of ASK_EXAMPLES) {
        const q = text(lng, e.questionKey).toLowerCase();
        for (const token of e.seedTokens) {
          expect(q).toContain(token.toLowerCase());
        }
      }
    }
  });
});
