import { describe, expect, it } from "vitest";
import {
  EXPERT_MODE,
  NARRATE_MODES,
  areModesExpanded,
  initialCaptureWorkspaceOpen,
  visibleNarrateModes,
} from "./captureEntry";

// SCRUM-458 (Nullschulung): Progressive Disclosure der Erfassungs-Modi. Erstzustand zeigt NUR Freitext;
// die übrigen vier Modi (Diktat · Interview · Aus Datei · Expertenformular) erscheinen erst nach dem
// Aufklappen. Reine Sichtbarkeit — kein Funktionsverlust: switchMode/Modi-Wechsel bleiben unberührt.
describe("SCRUM-458: Erfassungs-Modi hinter 'weitere Optionen'", () => {
  it("Erstzustand (eingeklappt, Freitext) zeigt die vier Nicht-Standard-Modi NICHT", () => {
    const visible = visibleNarrateModes(false, "freitext");
    expect(visible).toEqual(["freitext"]);
    // Genau der Standardweg — Diktat/Interview/Datei sind verdeckt.
    expect(visible).not.toContain("diktat");
    expect(visible).not.toContain("interview");
    expect(visible).not.toContain("datei");
    // Und der Expertenformular-Umschalter ist im Erstzustand ebenfalls verdeckt.
    expect(areModesExpanded(false, "freitext")).toBe(false);
  });

  it("nach Aufklappen sind ALLE Erzähl-Modi erreichbar + Expertenpfad sichtbar", () => {
    const visible = visibleNarrateModes(true, "freitext");
    expect(visible).toEqual(NARRATE_MODES);
    for (const m of ["freitext", "diktat", "interview", "datei"] as const) {
      expect(visible).toContain(m);
    }
    expect(areModesExpanded(true, "freitext")).toBe(true);
  });

  it("defensiv: ein aktiver Nicht-Freitext-Modus klappt die Leiste automatisch auf (nie verdeckt)", () => {
    for (const active of ["diktat", "interview", "datei", EXPERT_MODE] as const) {
      // Selbst wenn der Aufklapper NICHT geklickt wurde (showMore=false):
      expect(areModesExpanded(false, active)).toBe(true);
      expect(visibleNarrateModes(false, active)).toEqual(NARRATE_MODES);
    }
  });

  it("Modus-Wechsel bleibt unverändert möglich — alle Modi sind nach Aufklappen wählbar", () => {
    // Der Wechsel selbst läuft über switchMode in der Komponente; hier belegen wir, dass die
    // Sichtbarkeitsschicht keinen Modus dauerhaft entfernt: jeder Erzähl-Modus ist aufgeklappt sichtbar.
    const shown = visibleNarrateModes(true, "diktat");
    expect(new Set(shown)).toEqual(new Set(NARRATE_MODES));
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
