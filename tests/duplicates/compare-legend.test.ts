import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COMPARE_TONE_LEGEND, compareToneLabel } from "../../apps/web/src/lib/duplicateCompare";

const compareSource = readFileSync(
  fileURLToPath(new URL("../../apps/web/src/pages/DuplicateCompare.tsx", import.meta.url)),
  "utf8",
);

// SCRUM-488 (Nullschulung): Die Abschnittsampeln (grün/gelb/rot) hatten keine Erklärung. Getestet:
// sprechende Ton-Labels + eine vollständige, ehrliche Legende, die im Vergleich auch gerendert wird.
describe("SCRUM-488: Ampel-Legende im Duplikat-Vergleich", () => {
  it("compareToneLabel ist sprechend statt bloßer Farbname", () => {
    expect(compareToneLabel("green")).toBe("Übereinstimmung");
    expect(compareToneLabel("yellow")).toBe("Unsicher");
    expect(compareToneLabel("red")).toBe("Unterschied");
    // Kein bloßer Farbname mehr.
    for (const raw of ["gruen", "gelb", "rot", "green", "yellow", "red"]) {
      expect([
        compareToneLabel("green"),
        compareToneLabel("yellow"),
        compareToneLabel("red"),
      ]).not.toContain(raw);
    }
  });

  it("COMPARE_TONE_LEGEND deckt alle drei Töne mit ehrlicher Bedeutung ab", () => {
    expect(COMPARE_TONE_LEGEND.map((e) => e.tone)).toEqual(["green", "yellow", "red"]);
    for (const entry of COMPARE_TONE_LEGEND) {
      expect(entry.label.length).toBeGreaterThan(3);
      expect(entry.meaning.length).toBeGreaterThan(15);
    }
    // Ehrlichkeit: Rot ist ein Unterschied, KEIN bewiesener Widerspruch.
    const red = COMPARE_TONE_LEGEND.find((e) => e.tone === "red");
    expect(red?.meaning).toMatch(/kein bewiesener Widerspruch/i);
  });

  it("DuplicateCompare rendert Legende + Ampel-HelpTip (keine unerklärte Farbe)", () => {
    expect(compareSource).toContain("COMPARE_TONE_LEGEND.map");
    expect(compareSource).toContain("Was bedeuten die Ampelfarben?");
  });
});
