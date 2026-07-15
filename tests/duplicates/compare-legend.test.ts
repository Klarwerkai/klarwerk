import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COMPARE_TONE_LEGEND, compareToneLabelKey } from "../../apps/web/src/lib/duplicateCompare";

const compareSource = readFileSync(
  fileURLToPath(new URL("../../apps/web/src/pages/DuplicateCompare.tsx", import.meta.url)),
  "utf8",
);
const i18nSource = readFileSync(
  fileURLToPath(new URL("../../apps/web/src/i18n.ts", import.meta.url)),
  "utf8",
);

// SCRUM-488/487 (Nullschulung + i18n): Die Abschnittsampeln (grün/gelb/rot) hatten keine Erklärung.
// Die Lib liefert jetzt nur noch stabile i18n-KEYS; die sprechenden Labels + die ehrliche Bedeutung
// leben in i18n.ts. Getestet: Key-Vertrag der Lib, Rendering im Vergleich, und dass die Ehrlichkeits-
// Aussage („kein bewiesener Widerspruch") im deutschen i18n-Wert erhalten bleibt.
describe("SCRUM-488/487: Ampel-Legende im Duplikat-Vergleich", () => {
  it("compareToneLabelKey liefert stabile i18n-Keys statt Rohtext", () => {
    expect(compareToneLabelKey("green")).toBe("dcmp.tone.green.label");
    expect(compareToneLabelKey("yellow")).toBe("dcmp.tone.yellow.label");
    expect(compareToneLabelKey("red")).toBe("dcmp.tone.red.label");
  });

  it("COMPARE_TONE_LEGEND deckt alle drei Töne als Key-Paare ab", () => {
    expect(COMPARE_TONE_LEGEND.map((e) => e.tone)).toEqual(["green", "yellow", "red"]);
    for (const entry of COMPARE_TONE_LEGEND) {
      expect(entry.labelKey).toBe(`dcmp.tone.${entry.tone}.label`);
      expect(entry.meaningKey).toBe(`dcmp.tone.${entry.tone}.meaning`);
    }
  });

  it("Ehrlichkeit: der deutsche Rot-Wert bleibt „kein bewiesener Widerspruch“", () => {
    // Der Wert ist nach i18n gewandert — die Aussage muss dort erhalten sein.
    const redMeaningLine = i18nSource
      .split("\n")
      .find((l) => l.includes('"dcmp.tone.red.meaning"'));
    expect(redMeaningLine).toBeDefined();
    expect(redMeaningLine).toMatch(/kein bewiesener Widerspruch/i);
  });

  it("DuplicateCompare rendert Legende + Ampel-HelpTip über i18n-Keys (keine unerklärte Farbe)", () => {
    expect(compareSource).toContain("COMPARE_TONE_LEGEND.map");
    expect(compareSource).toContain("dcmp.legendHelpTitle");
    // Der deutsche Erklärtext lebt in i18n, nicht mehr im Screen.
    expect(i18nSource).toContain("Was bedeuten die Ampelfarben?");
  });
});
