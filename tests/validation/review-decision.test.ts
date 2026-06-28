import { describe, expect, it } from "vitest";
import { REVIEW_DECISIONS, reviewNextSteps } from "../../apps/web/src/lib/reviewDecision";

// SCRUM-258: Die Validierungskarte führt genau drei Review-Entscheidungen textlich klar:
// Freigeben (up), Rückfrage (warn), Ablehnen (down) — ohne die bestehende Verdict-Logik zu ändern.
describe("SCRUM-258: reviewDecision", () => {
  it("beschreibt genau drei Entscheidungen in der Reihenfolge up → warn → down", () => {
    expect(REVIEW_DECISIONS.map((d) => d.verdict)).toEqual(["up", "warn", "down"]);
  });

  it("nur Rückfrage und Ablehnung verlangen Pflicht-Feedback, Freigabe nicht", () => {
    const byVerdict = Object.fromEntries(REVIEW_DECISIONS.map((d) => [d.verdict, d]));
    expect(byVerdict.up?.requiresFeedback).toBe(false);
    expect(byVerdict.warn?.requiresFeedback).toBe(true);
    expect(byVerdict.down?.requiresFeedback).toBe(true);
  });

  it("hat sprechende Tönung und i18n-Label je Entscheidung", () => {
    expect(REVIEW_DECISIONS.map((d) => d.tone)).toEqual(["pos", "warn", "crit"]);
    expect(REVIEW_DECISIONS.map((d) => d.labelKey)).toEqual([
      "val.actionApprove",
      "val.actionQuery",
      "val.actionReject",
    ]);
  });
});

// SCRUM-277: nach der Entscheidung den nächsten Use-/Detail-Schritt sichtbar machen.
describe("SCRUM-277: reviewNextSteps", () => {
  const decision = { id: "ko-7", title: "Ventil X bei Überdruck manuell schließen." };

  it("Freigabe (up): KO ansehen + Wissen nutzen (Ask mit KO-Titel)", () => {
    const steps = reviewNextSteps({ ...decision, verdict: "up" });
    expect(steps.map((s) => s.labelKey)).toEqual(["val.nextViewKo", "val.nextUse"]);
    expect(steps[0]?.to).toBe("/wissen/ko-7");
    expect(steps[1]?.to.startsWith("/fragen?q=")).toBe(true);
    expect(steps[1]?.to).toContain(encodeURIComponent(decision.title));
  });

  it("Rückfrage/Ablehnung (warn/down): nur KO ansehen, kein Use-Schritt", () => {
    for (const verdict of ["warn", "down"] as const) {
      const steps = reviewNextSteps({ ...decision, verdict });
      expect(steps).toHaveLength(1);
      expect(steps[0]?.labelKey).toBe("val.nextViewKo");
      expect(steps[0]?.to).toBe("/wissen/ko-7");
    }
  });
});
