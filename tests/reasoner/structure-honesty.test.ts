import { describe, expect, it } from "vitest";
import {
  DeterministicProvider,
  honestNonInformativeDraft,
  isNonInformative,
} from "../../services/reasoner/src/provider";

// G-2 / Pedi-Review 02.07.2026 (Alt-App-Verhalten): Unbrauchbare Eingaben ("qwe", "123")
// werden nicht in Entwurfsfelder gekippt, sondern ehrlich als nicht verwertbar strukturiert.
describe("Reasoner-Strukturierung: ehrlicher Umgang mit unbrauchbaren Eingaben", () => {
  const p = new DeterministicProvider();

  it("erkennt nicht-informative Eingaben, lässt echte Fachsätze durch", () => {
    for (const bad of ["", "   ", "123", "qwe", "???", "ab 12"]) {
      expect(isNonInformative(bad), bad).toBe(true);
    }
    for (const good of [
      "Spindel SP-7 nur im Stillstand schmieren.",
      "Presse entlüften vor Wartung",
    ]) {
      expect(isNonInformative(good), good).toBe(false);
    }
  });

  it("'qwe' → ehrlicher Entwurf mit Bedingungen und Vorgehen statt Echo", async () => {
    const draft = await p.structure("qwe", "de");
    expect(draft.title).toContain("keine verwertbare Information");
    expect(draft.statement).toContain("'qwe'");
    expect(draft.conditions.length).toBeGreaterThan(0);
    expect(draft.measures).toContain("Eingabe nicht als Wissensobjekt speichern");
    expect(draft.confidence).toBe(0);
  });

  it("englische Oberfläche erhält die englische Fassung", async () => {
    const draft = await p.structure("123", "en");
    expect(draft.title).toContain("no usable information");
  });

  it("echter Fachsatz wird unverändert normal strukturiert", async () => {
    const draft = await p.structure(
      "Spindel SP-7 nur im Stillstand schmieren. Sonst Lagerschaden.",
    );
    expect(draft.title).toBe("Spindel SP-7 nur im Stillstand schmieren");
    expect(draft.statement).toContain("Lagerschaden");
  });

  it("honestNonInformativeDraft kürzt lange Roh-Eingaben im Zitat", () => {
    const d = honestNonInformativeDraft("1".repeat(200), "de");
    expect(d.statement.length).toBeLessThan(300);
  });
});
