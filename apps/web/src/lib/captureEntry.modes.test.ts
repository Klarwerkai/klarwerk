import { describe, expect, it } from "vitest";
import { EXPERT_MODE, NARRATE_MODES } from "./captureEntry";

// SCRUM-458: Die zweite Aufklapp-Ebene („weitere Optionen/weniger Optionen") ist entfernt — sobald
// „Weitere Wege" aufgeklappt ist, zeigt die Modus-Leiste ALLE Erzähl-Modi direkt und dauerhaft, plus
// den Expertenformular-Umschalter. NARRATE_MODES ist die eine Quelle der direkt sichtbaren Modi; das
// Expertenformular ist ein separater Umschalter (kein Erzähl-Modus). Kein Funktionsverlust: kein Modus
// ist entfernt, nur die redundante zweite Ebene.
describe("SCRUM-458: alle Erfassungs-Modi ohne zweite Aufklapp-Ebene", () => {
  it("NARRATE_MODES listet alle vier Erzähl-Modi (direkt, dauerhaft sichtbar)", () => {
    expect(NARRATE_MODES).toEqual(["freitext", "diktat", "interview", "datei"]);
    for (const m of ["freitext", "diktat", "interview", "datei"] as const) {
      expect(NARRATE_MODES).toContain(m);
    }
  });

  it("das Expertenformular ist ein separater Umschalter, kein Erzähl-Modus", () => {
    expect(EXPERT_MODE).toBe("formular");
    expect(NARRATE_MODES).not.toContain(EXPERT_MODE);
  });
});

// R-1349: Die Fälle zu `initialCaptureWorkspaceOpen` sind mit der Funktion entfallen. Das Blatt
// (JOB 3062) ist immer offen; einen eingeklappten Arbeitsraum gibt es nicht mehr (Capture.tsx ruft
// die Funktion seither nicht mehr).
