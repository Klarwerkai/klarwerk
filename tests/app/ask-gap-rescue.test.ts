import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  GAP_RESCUE_STEPS,
  GAP_RESCUE_TEXT,
  type GapRescueStepId,
  gapRescueStepLabelKey,
  gapRescueSteps,
} from "../../apps/web/src/lib/askGapRescue";

// SCRUM-369 / AG-12 / AG-13 / AG-P2-4: Ask→Rescue-Rahmung — DOM-freie Beschreibung der
// „Wissenslücke retten"-Story + geführte Schrittfolge (eine Quelle für Ask-Gap-Karte + Capture-Gap-Kontext).
describe("SCRUM-369: askGapRescue", () => {
  it("liefert die geführten Schritte in fester Reihenfolge (antworten → erfahrung → strukturieren → prüfen)", () => {
    expect(gapRescueSteps()).toBe(GAP_RESCUE_STEPS);
    expect(GAP_RESCUE_STEPS.map((s) => s.id)).toEqual<GapRescueStepId[]>([
      "answer",
      "experience",
      "structure",
      "review",
    ]);
  });

  it("label/hint folgen dem stabilen Schema ask.gap.step.<id>.{label,hint}", () => {
    for (const step of GAP_RESCUE_STEPS) {
      expect(step.labelKey).toBe(`ask.gap.step.${step.id}.label`);
      expect(step.hintKey).toBe(`ask.gap.step.${step.id}.hint`);
      expect(gapRescueStepLabelKey(step.id)).toBe(step.labelKey);
    }
  });

  it("GAP_RESCUE_TEXT zeigt auf die vorhandenen (wiederverwendeten) i18n-Keys", () => {
    expect(GAP_RESCUE_TEXT).toEqual({
      storyTitle: "ask.gap.rescueTitle",
      impact: "ask.gap.rescueImpact",
      noInvent: "ask.gap.noInvent",
      cta: "ask.gap.rescueCta",
      stepsTitle: "ask.gap.stepsTitle",
      savedNote: "capture.gapSavedNote",
    });
  });

  it("Story-/Schritt-/Kontext-Texte sind DE und EN vorhanden (keine leeren Keys)", () => {
    const keys = [
      ...Object.values(GAP_RESCUE_TEXT),
      "capture.gapStepsTitle",
      ...GAP_RESCUE_STEPS.flatMap((s) => [s.labelKey, s.hintKey]),
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("bleibt ehrlich: keine erfundene Antwort — Lücke bleibt ohne Quelle offen (DE/EN)", () => {
    expect(String(i18n.getResource("de", "translation", "ask.gap.noInvent") ?? "")).toMatch(
      /erfunden|offen/i,
    );
    expect(String(i18n.getResource("en", "translation", "ask.gap.noInvent") ?? "")).toMatch(
      /invent|open|honest/i,
    );
  });

  it("bleibt ehrlich: Speichern schließt die Lücke NICHT automatisch — die Prüfung entscheidet (DE/EN)", () => {
    expect(String(i18n.getResource("de", "translation", "capture.gapSavedNote") ?? "")).toMatch(
      /nicht automatisch|Prüfung entscheidet/i,
    );
    expect(String(i18n.getResource("en", "translation", "capture.gapSavedNote") ?? "")).toMatch(
      /not closed automatically|review decides/i,
    );
  });

  it("Strukturierungs-Schritt bleibt ehrlich: KI ordnet nur, erfindet nichts (DE)", () => {
    expect(
      String(i18n.getResource("de", "translation", "ask.gap.step.structure.hint") ?? ""),
    ).toMatch(/ordnet nur|erfindet nichts/i);
  });
});
