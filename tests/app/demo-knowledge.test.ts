import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { sourceRefs } from "../../apps/web/src/lib/askView";
import {
  DEMO_TAG,
  demoKnowledgeBadge,
  isDemoKnowledge,
} from "../../apps/web/src/lib/demoKnowledge";

const ko = (tags: string[]): Pick<KnowledgeObject, "tags"> => ({ tags });

// SCRUM-308: Demo-/Seed-Wissen wird über den vorhandenen tags-Eintrag DEMO_TAG erkannt und ehrlich
// als Herkunft gekennzeichnet — ohne neues Datenmodell, ohne Status/Trust zu ersetzen.
describe("SCRUM-308: demoKnowledge", () => {
  it("erkennt Demo-/Seed-Wissen am DEMO_TAG", () => {
    expect(isDemoKnowledge(ko(["ventil", DEMO_TAG]))).toBe(true);
    expect(DEMO_TAG).toBe("pilot-demo");
  });

  it("erkennt normales (produktiv erfasstes) Wissen NICHT als Demo", () => {
    expect(isDemoKnowledge(ko(["ventil", "wartung"]))).toBe(false);
    expect(isDemoKnowledge(ko([]))).toBe(false);
    expect(isDemoKnowledge({ tags: undefined } as unknown as Pick<KnowledgeObject, "tags">)).toBe(
      false,
    );
  });

  it("demoKnowledgeBadge: Badge nur für Demo-KOs, mit korrekten Keys und neutraler Tönung", () => {
    expect(demoKnowledgeBadge(ko(["x", DEMO_TAG]))).toEqual({
      labelKey: "demo.badge.label",
      hintKey: "demo.badge.hint",
      tone: "neutral",
    });
    expect(demoKnowledgeBadge(ko(["x"]))).toBeNull();
  });

  it("Cross-Surface-Konsistenz: Ask-Quellen (sourceRefs.demo) nutzen dieselbe Erkennung", () => {
    const demoKo = {
      id: "d",
      title: "Ventil X",
      status: "validiert",
      tags: [DEMO_TAG],
    } as unknown as KnowledgeObject;
    const realKo = {
      id: "r",
      title: "Pumpe",
      status: "validiert",
      tags: ["wartung"],
    } as unknown as KnowledgeObject;
    const refs = sourceRefs(["d", "r"], [demoKo, realKo]);
    expect(refs[0]?.demo).toBe(isDemoKnowledge(demoKo));
    expect(refs[0]?.demo).toBe(true);
    expect(refs[1]?.demo).toBe(false);
    // unbekannte Quelle → kein Fake-Demo-Flag.
    expect(sourceRefs(["ghost"], [])[0]?.demo).toBe(false);
  });

  it("Badge-Texte sind DE und EN vorhanden und ehrlich (ersetzt nicht Validierung/Status)", () => {
    for (const lng of ["de", "en"]) {
      for (const key of ["demo.badge.label", "demo.badge.hint"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
    expect(String(i18n.getResource("de", "translation", "demo.badge.hint"))).toMatch(
      /ersetzt nicht/i,
    );
    expect(String(i18n.getResource("en", "translation", "demo.badge.hint"))).toMatch(
      /does not replace/i,
    );
  });
});
