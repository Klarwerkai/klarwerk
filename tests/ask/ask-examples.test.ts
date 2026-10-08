import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { ASK_EXAMPLES, askExpectation } from "../../apps/web/src/lib/askExamples";

// SCRUM-265: produktnahe Beispiel-Fragen als Startimpuls (kein Auto-Ask, nur Vorlage).
describe("SCRUM-265: askExamples", () => {
  it("bietet 2–3 Beispiele mit eindeutigen IDs, deren Frage in DE, EN und NL echter Text ist", () => {
    expect(ASK_EXAMPLES.length).toBeGreaterThanOrEqual(2);
    expect(ASK_EXAMPLES.length).toBeLessThanOrEqual(3);
    const ids = ASK_EXAMPLES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    // R-1001: die Fragen stehen nicht mehr alle unter `ask.example.*` (Pflege und Verein kommen aus
    // `texte/beispielfragen.ts`). Statt des Namensraums wird deshalb die Wirkung geprüft: jede
    // Frage löst in allen drei Sprachen zu echtem, voneinander verschiedenem Text auf.
    for (const e of ASK_EXAMPLES) {
      const texte = (["de", "en", "nl"] as const).map((lng) => i18n.getFixedT(lng)(e.questionKey));
      for (const text of texte) {
        expect(text, e.questionKey).not.toBe(e.questionKey);
        expect(text.length, e.questionKey).toBeGreaterThan(15);
      }
      expect(
        new Set(texte).size,
        `${e.questionKey}: eine Sprache fiel auf eine andere zurück`,
      ).toBe(3);
    }
  });

  it("zeigt beide ehrlichen Ausgänge: quellengebundene Antwort und Wissenslücke", () => {
    expect(ASK_EXAMPLES.some((e) => e.kind === "answerable")).toBe(true);
    expect(ASK_EXAMPLES.some((e) => e.kind === "gap")).toBe(true);
  });

  it("R-1001: nicht nur Industrie — Pflege und Verein stehen neben dem Industriebeispiel", () => {
    // Der frühere Fall hielt die Industrie-/Linie-L4-/Dosierwert-Story als einzige Lücke fest.
    // R-1001 verlangt Beispiele für jede Organisation; das Industriebeispiel bleibt, weil es den
    // deutschen Demo-Bestand trifft, die Lücken-Frage kommt jetzt aus der Pflege.
    const ids = ASK_EXAMPLES.map((e) => e.id);
    expect(ids).toEqual(["valve", "pflege", "verein"]);
    const ersteLuecke = ASK_EXAMPLES.find((e) => e.kind === "gap");
    expect(ersteLuecke?.id).toBe("pflege");
    expect(ASK_EXAMPLES.find((e) => e.id === "verein")?.kind).toBe("gap");
    expect(ASK_EXAMPLES.find((e) => e.id === "valve")?.kind).toBe("answerable");
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

// SCRUM-269: Beispiele bleiben in DE UND EN seed-sicher — die Seed-Begriffe (Ventil X, Überdruck;
// für die Lücken-Fragen die Kennung B2 und der Betrag 500) gehen durch die Übersetzung nicht
// verloren, damit „answerable" ehrlich answerable bleibt.
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
