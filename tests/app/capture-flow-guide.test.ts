import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  CAPTURE_FLOW_STEPS,
  CAPTURE_FLOW_TEXT,
  type CaptureFlowStepId,
  captureFlowStepLabelKey,
  captureFlowSteps,
  recommendedFlowStep,
} from "../../apps/web/src/lib/captureFlowGuide";

// SCRUM-370 / AG-12 / AG-13 / AG-P2-4: geführter Capture-Weg — Rohwissen → im Studio strukturieren
// (empfohlen) → prüfen & einreichen. DOM-freie Beschreibung, eine Quelle für die Rail + Studio-Lead +
// Beitragswert am Submit.
describe("SCRUM-370: captureFlowGuide", () => {
  it("liefert den geführten Weg in fester Reihenfolge (rohwissen → studio → prüfen)", () => {
    expect(captureFlowSteps()).toBe(CAPTURE_FLOW_STEPS);
    expect(CAPTURE_FLOW_STEPS.map((s) => s.id)).toEqual<CaptureFlowStepId[]>([
      "raw",
      "studio",
      "review",
    ]);
  });

  it("markiert genau EINEN empfohlenen Hauptweg-Schritt — das Studio", () => {
    const recommended = CAPTURE_FLOW_STEPS.filter((s) => s.recommended);
    expect(recommended.map((s) => s.id)).toEqual(["studio"]);
    expect(recommendedFlowStep().id).toBe("studio");
  });

  it("label/hint folgen dem stabilen Schema capture.flow.step.<id>.{label,hint}", () => {
    for (const step of CAPTURE_FLOW_STEPS) {
      expect(step.labelKey).toBe(`capture.flow.step.${step.id}.label`);
      expect(step.hintKey).toBe(`capture.flow.step.${step.id}.hint`);
      expect(captureFlowStepLabelKey(step.id)).toBe(step.labelKey);
    }
  });

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
    const keys = [
      ...Object.values(CAPTURE_FLOW_TEXT),
      "capture.flow.railKickerHint",
      ...CAPTURE_FLOW_STEPS.flatMap((s) => [s.labelKey, s.hintKey]),
    ];
    for (const key of keys) {
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
