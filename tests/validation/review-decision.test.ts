import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  REVIEW_DECISIONS,
  type ReviewVerdict,
  reviewNextSteps,
  reviewOutcome,
} from "../../apps/web/src/lib/reviewDecision";

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

  it("Freigabe (up): KO ansehen + Wissen nutzen (Ask mit KO-Titel) — ohne Rework-Query", () => {
    const steps = reviewNextSteps({ ...decision, verdict: "up" });
    expect(steps.map((s) => s.labelKey)).toEqual(["val.nextViewKo", "val.nextUse"]);
    expect(steps[0]?.to).toBe("/wissen/ko-7");
    expect(steps[0]?.to).not.toContain("rework=");
    expect(steps[1]?.to.startsWith("/fragen?q=")).toBe(true);
    expect(steps[1]?.to).toContain(encodeURIComponent(decision.title));
  });

  // SCRUM-329: Rückfrage/Ablehnung sind keine Sackgasse — eine klare Nacharbeits-Folgehandlung am KO,
  // kein Use-Schritt (warn/down bleiben Review-Arbeit), keine automatische Rückgabe.
  // SCRUM-330: warn/down führen mit Nacharbeitskontext (?rework=review) ins KO-Detail.
  it("Rückfrage/Ablehnung (warn/down): eine Nacharbeits-Folgehandlung am KO mit rework=review", () => {
    for (const verdict of ["warn", "down"] as const) {
      const steps = reviewNextSteps({ ...decision, verdict });
      expect(steps).toHaveLength(1);
      expect(steps[0]?.labelKey).toBe("val.nextRework");
      expect(steps[0]?.to).toBe("/wissen/ko-7?rework=review");
    }
  });

  it("SCRUM-329: val.nextRework ist DE+EN vorhanden (Nacharbeit, keine Rückgabe-/Schließungs-Behauptung)", () => {
    for (const lng of ["de", "en"]) {
      const v = String(i18n.getResource(lng, "translation", "val.nextRework") ?? "");
      expect(v.length).toBeGreaterThan(0);
    }
  });
});

// SCRUM-292: ehrliche Folge-Aussage nach der Bewertung — up nutzbar (status/trust-abhängig),
// warn/down bleiben Review-Arbeit; keine automatische/Fake-Validierung.
describe("SCRUM-292: reviewOutcome", () => {
  it("up ist grundsätzlich nutzbar (pos), warn/down bleiben Review-Arbeit (warn/crit)", () => {
    expect(reviewOutcome("up")).toMatchObject({ tone: "pos", usable: true });
    expect(reviewOutcome("warn")).toMatchObject({ tone: "warn", usable: false });
    expect(reviewOutcome("down")).toMatchObject({ tone: "crit", usable: false });
  });

  it("liefert je Verdict einen Status-i18n-Schlüssel", () => {
    expect(reviewOutcome("up").statusKey).toBe("val.outcome.up");
    expect(reviewOutcome("warn").statusKey).toBe("val.outcome.warn");
    expect(reviewOutcome("down").statusKey).toBe("val.outcome.down");
  });

  const text = (lng: string, key: string) =>
    String(i18n.getResource(lng, "translation", key) ?? "").toLowerCase();

  it("up behauptet KEINE automatische/vollständige Validierung (Ehrlichkeit)", () => {
    const de = text("de", "val.outcome.up");
    const en = text("en", "val.outcome.up");
    expect(de).toContain("automatisch validiert wird");
    expect(de).not.toContain("vollständig validiert");
    expect(en).toContain("does not validate it automatically");
  });

  it("warn/down benennen DE/EN klar Review-/Feedback-Arbeit", () => {
    const verdicts: ReviewVerdict[] = ["warn", "down"];
    for (const v of verdicts) {
      expect(text("de", reviewOutcome(v).statusKey)).toContain("review");
      expect(text("en", reviewOutcome(v).statusKey)).toContain("review");
    }
  });
});
