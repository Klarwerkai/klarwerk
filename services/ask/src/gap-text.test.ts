import { describe, expect, it } from "vitest";
import { MAX_GAP_QUESTION_LENGTH, normalizeGapQuestion } from "./gap-text";

// SCRUM-284: deterministische, datensparsame Begrenzung/Normalisierung gespeicherter Gap-Fragen.
describe("SCRUM-284: normalizeGapQuestion", () => {
  it("lässt kurze, normale Fragen unverändert", () => {
    const q = "Warum schwankt der Dosierwert an Linie L4 nach jedem Schichtwechsel?";
    expect(normalizeGapQuestion(q)).toBe(q);
  });

  it("trimmt Ränder und zieht Whitespace/Zeilenumbrüche zusammen", () => {
    expect(normalizeGapQuestion("  Wann   schließt\n das  Ventil?  ")).toBe(
      "Wann schließt das Ventil?",
    );
  });

  it("begrenzt sehr lange Fragen/Kontext-Blobs deterministisch mit Ellipse", () => {
    const blob = `Bitte beachte folgenden Kontext: ${"lorem ipsum dolor sit amet ".repeat(40)}Was ist die Hauptstadt?`;
    const out = normalizeGapQuestion(blob);
    expect(out.length).toBeLessThanOrEqual(MAX_GAP_QUESTION_LENGTH + 1); // + Ellipse
    expect(out.endsWith("…")).toBe(true);
    expect(out.startsWith("Bitte beachte folgenden Kontext:")).toBe(true); // Anfang bleibt lesbar
    // Deterministisch: gleicher Input → gleiches Ergebnis.
    expect(normalizeGapQuestion(blob)).toBe(out);
  });

  it("schneidet an Wortgrenze, wenn sinnvoll (kein abgehacktes Wort am Ende)", () => {
    const q = `${"Anlagenteil ".repeat(30)}Ende`;
    const out = normalizeGapQuestion(q);
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toContain("Anlagente…"); // nicht mitten im Wort abgeschnitten
  });

  it("respektiert eine eigene Maximallänge", () => {
    expect(normalizeGapQuestion("abcdefghij klmnop", 8)).toBe("abcdefgh…");
  });

  it("leere/whitespace-Eingabe → leerer String", () => {
    expect(normalizeGapQuestion("   \n  ")).toBe("");
  });
});
