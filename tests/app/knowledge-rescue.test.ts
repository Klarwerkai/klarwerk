import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  KNOWLEDGE_RESCUE_IMPACT,
  KNOWLEDGE_RESCUE_STEPS,
  type KnowledgeRescueStepId,
  knowledgeRescueImpact,
  knowledgeRescueSteps,
  rescueStepLabelKey,
} from "../../apps/web/src/lib/knowledgeRescue";

// SCRUM-352: geführter „Knowledge Rescue"-Einstieg — DOM-freie Story-/Schritt-/Wertbeitrag-Beschreibung.
describe("SCRUM-352: knowledgeRescue", () => {
  it("liefert die geführten Schritte in fester Reihenfolge (erzählen → strukturieren → prüfen)", () => {
    expect(knowledgeRescueSteps()).toBe(KNOWLEDGE_RESCUE_STEPS);
    expect(KNOWLEDGE_RESCUE_STEPS.map((s) => s.id)).toEqual<KnowledgeRescueStepId[]>([
      "tell",
      "structure",
      "validate",
    ]);
  });

  it("Schritte sind an die echte Knowledge-OS-Phase gebunden (erfassen/erfassen/validieren)", () => {
    expect(KNOWLEDGE_RESCUE_STEPS.map((s) => s.phase)).toEqual(["capture", "capture", "validate"]);
  });

  it("label/hint folgen dem stabilen Schema capture.rescue.step.<id>.{label,hint}", () => {
    for (const step of KNOWLEDGE_RESCUE_STEPS) {
      expect(step.labelKey).toBe(`capture.rescue.step.${step.id}.label`);
      expect(step.hintKey).toBe(`capture.rescue.step.${step.id}.hint`);
      expect(rescueStepLabelKey(step.id)).toBe(step.labelKey);
    }
  });

  it("Wertbeitrag-Items sind stabil und leichtgewichtig (kein Score-Feld)", () => {
    expect(knowledgeRescueImpact()).toBe(KNOWLEDGE_RESCUE_IMPACT);
    expect(KNOWLEDGE_RESCUE_IMPACT.map((i) => i.id)).toEqual(["secure", "improve", "honest"]);
    for (const item of KNOWLEDGE_RESCUE_IMPACT) {
      expect(Object.keys(item).sort()).toEqual(["id", "labelKey"]);
    }
  });

  it("Story-/Schritt-/Wertbeitrag-Texte sind DE und EN vorhanden (keine leeren Keys)", () => {
    const keys = [
      "capture.rescue.kicker",
      "capture.rescue.title",
      "capture.rescue.subtitle",
      "capture.rescue.impactTitle",
      "capture.rescue.showLess",
      "capture.rescue.showMore",
      ...KNOWLEDGE_RESCUE_STEPS.flatMap((s) => [s.labelKey, s.hintKey]),
      ...KNOWLEDGE_RESCUE_IMPACT.map((i) => i.labelKey),
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("bleibt ehrlich: Wertbeitrag verspricht keine sofortige Gültigkeit (erst nach Prüfung) (DE/EN)", () => {
    expect(
      String(i18n.getResource("de", "translation", "capture.rescue.impact.honest") ?? ""),
    ).toMatch(/nach Prüfung|gesichert/i);
    expect(
      String(i18n.getResource("en", "translation", "capture.rescue.impact.honest") ?? ""),
    ).toMatch(/after review|verified/i);
  });
});
