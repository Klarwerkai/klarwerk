import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { captureNextSteps, captureSavedStatus } from "../../apps/web/src/lib/captureSuccess";

// SCRUM-276: nach dem Einreichen den nächsten Schritt im Kernfluss sichtbar machen.
describe("SCRUM-276: captureNextSteps", () => {
  it("führt zum erstellten KO, in die Bibliothek (eigenes Wissen) und zur Validierung", () => {
    const steps = captureNextSteps("ko-42");
    expect(steps.map((s) => s.to)).toEqual([
      "/wissen/ko-42",
      "/bibliothek?origin=non-demo",
      "/validierung?origin=non-demo",
    ]);
  });

  // SCRUM-310: frisch erfasstes Wissen in der Bibliothek wiederfinden — gefiltert auf eigenes/
  // nicht-Demo-Wissen; Auffinden/Übersicht, NICHT primär (Review bleibt die betonte Handlung).
  it("bietet einen nicht-primären Bibliotheks-Schritt mit Herkunftsfilter eigenes Wissen", () => {
    const lib = captureNextSteps("ko-9").find((s) => s.to.startsWith("/bibliothek"));
    expect(lib?.to).toBe("/bibliothek?origin=non-demo");
    expect(lib?.primary).toBeFalsy();
    expect(lib?.labelKey).toBe("capture.savedViewLibrary");
  });

  it("jeder Schritt hat ein nicht-leeres Label und ein vorhandenes Ziel", () => {
    for (const s of captureNextSteps("ko-1")) {
      expect(s.labelKey.length).toBeGreaterThan(0);
      expect(s.to.length).toBeGreaterThan(0);
    }
  });

  it("bettet die KO-ID in den Detail-Link ein", () => {
    const [viewKo] = captureNextSteps("abc-123");
    expect(viewKo?.to).toBe("/wissen/abc-123");
  });

  it("Bibliotheks-Schritt-Label ist DE und EN vorhanden", () => {
    for (const lng of ["de", "en"]) {
      expect(
        String(i18n.getResource(lng, "translation", "capture.savedViewLibrary") ?? "").length,
      ).toBeGreaterThan(0);
    }
  });
});

// SCRUM-286: nach dem Speichern ehrlich führen — gespeichert, aber noch offen/nicht validiert;
// die Validierung/Prüfung ist die betonte (primary) nächste Handlung.
describe("SCRUM-286: Capture→Validation-Führung", () => {
  it("betont die Validierung als primäre nächste Handlung (nur dieser Schritt)", () => {
    const steps = captureNextSteps("ko-7");
    // SCRUM-311: Review-Step zeigt vorgefiltert auf eigenes/nicht-Demo-Wissen, bleibt aber primär.
    const validate = steps.find((s) => s.to.startsWith("/validierung"));
    const viewKo = steps.find((s) => s.to.startsWith("/wissen/"));
    expect(validate?.to).toBe("/validierung?origin=non-demo");
    expect(validate?.primary).toBe(true);
    expect(viewKo?.primary).toBeFalsy();
    // nur der Validierungs-Schritt ist primär.
    expect(steps.filter((s) => s.primary)).toHaveLength(1);
  });

  it("liefert Status-Schlüssel für offen / noch nicht validiert", () => {
    const status = captureSavedStatus();
    expect(status.badgeKey).toBe("capture.savedStatusBadge");
    expect(status.hintKey).toBe("capture.savedBody");
  });

  const text = (lng: string, key: string) =>
    String(i18n.getResource(lng, "translation", key) ?? "").toLowerCase();

  it("Status-Texte benennen DE/EN ehrlich: nicht validiert + erst nach Bewertung nutzbar", () => {
    const { badgeKey, hintKey } = captureSavedStatus();
    expect(text("de", badgeKey)).toContain("nicht validiert");
    expect(text("de", hintKey)).toContain("nicht validiert");
    expect(text("de", hintKey)).toContain("prüfung");
    expect(text("en", badgeKey)).toContain("not yet validated");
    expect(text("en", hintKey)).toContain("review");
  });
});
