import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { HELP_TOPICS } from "../../apps/web/src/lib/helpTopics";
import { PILOT_CHECKLIST, pilotChecklist } from "../../apps/web/src/lib/pilotChecklist";

// SCRUM-305: In-App-Pilot-Checkliste für den ersten Nutzerlauf — ehrliche Stage-1-Prüfpunkte entlang
// Capture → Validation → Use → Gap → Maintain, nur auf vorhandene App-Routen.
describe("SCRUM-305: pilotChecklist", () => {
  it("liefert genau fünf Schritte in fester Reihenfolge", () => {
    expect(pilotChecklist()).toBe(PILOT_CHECKLIST);
    expect(PILOT_CHECKLIST.map((c) => c.id)).toEqual([
      "capture",
      "validation",
      "use",
      "gap",
      "maintain",
    ]);
    expect(PILOT_CHECKLIST.map((c) => c.n)).toEqual([1, 2, 3, 4, 5]);
  });

  it("verweist ausschließlich auf vorhandene App-Routen (gedeckt durch Help-Topics)", () => {
    const knownRoutes = new Set(HELP_TOPICS.map((tp) => tp.to));
    for (const item of PILOT_CHECKLIST) {
      expect(knownRoutes.has(item.to)).toBe(true);
    }
  });

  it("nutzt stabile i18n-Keys, die DE und EN vorhanden sind", () => {
    const keys = ["pilot.title", "pilot.subtitle", ...PILOT_CHECKLIST.map((c) => c.labelKey)];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("bleibt ehrlich/Stage-1: kein Auto-/Stage-2-Versprechen in den DE-Texten", () => {
    const de = PILOT_CHECKLIST.map((c) =>
      String(i18n.getResource("de", "translation", c.labelKey) ?? ""),
    ).join(" ");
    // Capture offen, keine automatische Freigabe/Gültigkeit, kein erfundenes Wissen.
    expect(de).toMatch(/offen/i);
    expect(de).toMatch(/keine automatische/i);
    expect(de).toMatch(/kein erfundenes Wissen/i);
  });
});
