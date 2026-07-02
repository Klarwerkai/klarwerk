// SCRUM-384: Wizard-Zustand der Erfassung — ein Fokus je Schritt (DOM-frei).
import { describe, expect, it } from "vitest";
import {
  CAPTURE_WIZARD_TEXT,
  resolveWizardStep,
  wizardChips,
} from "../../apps/web/src/lib/captureWizard";

describe("captureWizard", () => {
  it("erlaubt refine nur mit vorhandenem Entwurf (ehrlich zurück zu tell)", () => {
    expect(resolveWizardStep("refine", false)).toBe("tell");
    expect(resolveWizardStep("refine", true)).toBe("refine");
    expect(resolveWizardStep("tell", true)).toBe("tell");
  });

  it("bildet die drei Flow-Schritte korrekt auf den Wizard-Zustand ab", () => {
    const tell = wizardChips("tell", false);
    expect(tell.map((c) => c.state)).toEqual(["active", "todo", "todo"]);

    const refine = wizardChips("refine", true);
    expect(refine.map((c) => c.state)).toEqual(["done", "active", "todo"]);

    // Entwurf vorhanden, Nutzer zurück auf tell: studio gilt als erledigt, raw aktiv.
    const back = wizardChips("tell", true);
    expect(back.map((c) => c.state)).toEqual(["active", "done", "todo"]);
  });

  it("refine ohne Entwurf fällt auch in der Leiste auf tell zurück", () => {
    expect(wizardChips("refine", false).map((c) => c.state)).toEqual(["active", "todo", "todo"]);
  });

  it("Copy-Schlüssel sind eindeutig und im capture.wizard-Namensraum", () => {
    const keys = Object.values(CAPTURE_WIZARD_TEXT);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k.startsWith("capture.wizard.")).toBe(true);
  });
});
