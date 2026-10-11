import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FLOW_TEXT } from "../../apps/web/src/lib/captureFlowGuide";

// SCRUM-370 / AG-12 / AG-13 / AG-P2-4: geführter Capture-Weg — Rohwissen → im Studio strukturieren
// (empfohlen) → prüfen & einreichen. DOM-freie Beschreibung, eine Quelle für die Rail + Studio-Lead +
// Beitragswert am Submit.
//
// R-1349 (Aufnahme gesamt-aufruferwaechter): Die Schritt-Tabelle `CAPTURE_FLOW_STEPS` und ihre drei
// Zugriffe sind entfernt — keiner hatte einen Produktleser (die Erfassung führt über
// `lib/captureWizard.ts`, R-0991 Nr. 12). Mit ihnen sind die drei Fälle zu Reihenfolge, Empfehlung und
// Schlüsselschema entfallen. Gemessen bleibt, was `pages/Capture.tsx` liest: die Texte.
describe("SCRUM-370: captureFlowGuide", () => {
  it("CAPTURE_FLOW_TEXT zeigt auf die flachen capture.flow.*-Copy-Keys", () => {
    expect(CAPTURE_FLOW_TEXT).toEqual({
      railKicker: "capture.flow.railKicker",
      railKickerHint: "capture.flow.railKickerHint",
      studioRecommended: "capture.flow.studioRecommended",
      studioLead: "capture.flow.studioLead",
      submitValue: "capture.flow.submitValue",
    });
  });

  it("alle Weg-/Studio-/Beitrags-Texte sind DE und EN vorhanden (keine leeren Keys)", () => {
    for (const key of Object.values(CAPTURE_FLOW_TEXT)) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("bleibt ehrlich: Beitragswert verspricht keine sofortige Gültigkeit (erst nach Prüfung) (DE/EN)", () => {
    expect(String(i18n.getResource("de", "translation", "capture.flow.submitValue") ?? "")).toMatch(
      /nach der Prüfung|nichts automatisch|Automatisch validiert wird nichts/i,
    );
    expect(String(i18n.getResource("en", "translation", "capture.flow.submitValue") ?? "")).toMatch(
      /after review|automatically/i,
    );
  });

  it("bleibt ehrlich: der empfohlene Studio-Weg ist kein Zwang (DE/EN)", () => {
    expect(
      String(i18n.getResource("de", "translation", "capture.flow.railKickerHint") ?? ""),
    ).toMatch(/nichts wird erzwungen|empfohlen/i);
    expect(
      String(i18n.getResource("en", "translation", "capture.flow.railKickerHint") ?? ""),
    ).toMatch(/nothing is forced|recommended/i);
  });
});
