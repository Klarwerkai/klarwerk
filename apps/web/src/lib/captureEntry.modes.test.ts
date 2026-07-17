import { describe, expect, it } from "vitest";
import { EXPERT_MODE, NARRATE_MODES, initialCaptureWorkspaceOpen } from "./captureEntry";

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

// SCRUM-458 (Nullschulung): Der Erfassungs-Arbeitsraum (Schritt-Leiste · Erzähl-Modi · Formular) startet
// EINGEKLAPPT — Schritt 1 zeigt zunächst nur den ruhigen Aufklapp-Einstieg. Defensiv aufgeklappt, wenn
// beim Betreten bereits ein aktiver Kontext vorliegt, der sonst verdeckt wäre.
describe("SCRUM-458: Erfassungs-Arbeitsraum standardmäßig eingeklappt", () => {
  it("Standard (kein Kontext) → eingeklappt", () => {
    expect(initialCaptureWorkspaceOpen({ hasGapContext: false, hasPrefilledRaw: false })).toBe(
      false,
    );
  });

  it("Lücken-Kontext (?gap=) → aufgeklappt, damit der Gap-Entwurf nicht verdeckt startet", () => {
    expect(initialCaptureWorkspaceOpen({ hasGapContext: true, hasPrefilledRaw: false })).toBe(true);
  });

  it("vorbefüllter Rohtext (Deep-Link/Entwurf) → aufgeklappt", () => {
    expect(initialCaptureWorkspaceOpen({ hasGapContext: false, hasPrefilledRaw: true })).toBe(true);
  });

  it("beide Kontexte → aufgeklappt", () => {
    expect(initialCaptureWorkspaceOpen({ hasGapContext: true, hasPrefilledRaw: true })).toBe(true);
  });
});
