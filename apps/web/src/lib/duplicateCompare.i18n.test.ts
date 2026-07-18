import { afterEach, describe, expect, it } from "vitest";
import i18n from "../i18n";
import { makeKo } from "../test/render";
import { buildDuplicateCompareSections } from "./duplicateCompare";

// SCRUM-513/487 (WP5): die Vergleichs-WERTE (leftValue/rightValue) sind lokalisiert — keine deutschen
// Rohstrings mehr in EN/NL (Audit A4). Die Metrik-Semantik (match/conflict/tone) bleibt unverändert.

afterEach(async () => {
  await i18n.changeLanguage("de");
});

describe("buildDuplicateCompareSections — i18n der Werte", () => {
  it("DE: leere Felder → lokalisiertes 'Kein Wert vorhanden'", () => {
    const a = makeKo({ conditions: [] });
    const b = makeKo({ conditions: [] });
    const rows = buildDuplicateCompareSections(a, b, i18n.t);
    const cond = rows.find((r) => r.key === "Bedingungen");
    expect(cond?.leftValue).toBe("Kein Wert vorhanden");
  });

  it("EN: keine deutschen Rohwerte (noValue + Trust/Status lokalisiert)", async () => {
    await i18n.changeLanguage("en");
    const a = makeKo({ conditions: [], trust: 50, status: "offen", neededValidations: 3 });
    const b = makeKo({ conditions: [] });
    const rows = buildDuplicateCompareSections(a, b, i18n.t);

    const cond = rows.find((r) => r.key === "Bedingungen");
    expect(cond?.leftValue).toBe("No value"); // nicht „Kein Wert vorhanden"

    const trust = rows.find((r) => r.key === "Trust / Validierungsstatus");
    expect(trust?.leftValue).toContain("Trust 50");
    expect(trust?.leftValue).not.toContain("benötigte"); // kein deutsches Wort
    expect(trust?.leftValue).not.toContain("Offen"); // kein deutsches Status-Label
  });

  it("Metrik-Semantik unverändert: identische Titel → match 100 / tone green", () => {
    const a = makeKo({ title: "Gleicher Titel" });
    const b = makeKo({ title: "Gleicher Titel" });
    const rows = buildDuplicateCompareSections(a, b, i18n.t);
    const title = rows.find((r) => r.key === "Titel");
    expect(title?.metrics.match).toBe(100);
    expect(title?.tone).toBe("green");
  });
});
