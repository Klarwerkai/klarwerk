import { describe, expect, it } from "vitest";
import { REVIEW_DECISIONS } from "../../apps/web/src/lib/reviewDecision";

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
