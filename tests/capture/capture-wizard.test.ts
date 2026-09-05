// SCRUM-384: Wizard-Zustand der Erfassung — ein Fokus je Schritt (DOM-frei).
import { describe, expect, it } from "vitest";
import { CAPTURE_WIZARD_TEXT, resolveWizardStep } from "../../apps/web/src/lib/captureWizard";

describe("captureWizard", () => {
  it("erlaubt refine nur mit vorhandenem Entwurf (ehrlich zurück zu tell)", () => {
    expect(resolveWizardStep("refine", false)).toBe("tell");
    expect(resolveWizardStep("refine", true)).toBe("refine");
    expect(resolveWizardStep("tell", true)).toBe("tell");
  });

  // JOB 3062 · H3: Die beiden Fälle über `wizardChips` sind ERSATZLOS gestrichen. Sie prüften die
  // sichtbare Schritt-Leiste auf `/erfassen` — sie ist mit dem Standardweg-Kasten gelöscht, weil
  // das Blatt keine Schritte mehr hat (Auftrag §5). Der Zustand selbst wird oben weiter geprüft.

  it("Copy-Schlüssel sind eindeutig und im capture.wizard-Namensraum", () => {
    const keys = Object.values(CAPTURE_WIZARD_TEXT);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) expect(k.startsWith("capture.wizard.")).toBe(true);
  });
});
