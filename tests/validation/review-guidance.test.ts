import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  DECISION_IMPACTS,
  DECISION_TRUST_NOTE_KEY,
  REVIEW_CHECK_ITEMS,
  decisionImpact,
  reviewGuidanceFocusKey,
} from "../../apps/web/src/lib/reviewGuidance";

const text = (lng: string, key: string) =>
  String(i18n.getResource(lng, "translation", key) ?? "").toLowerCase();
const present = (key: string) => ["de", "en"].every((lng) => text(lng, key).length > 0);

// SCRUM-365 / AG-12 / PI-K2: ruhige, ehrliche Review-Führung vor der Entscheidung. Reine, DOM-freie
// Logik — testet Struktur, Reihenfolge, i18n-Präsenz und die Ehrlichkeit der Copy (keine Auto-Freigabe,
// Trust ≠ Wahrheit, Gelb/Rot als Nacharbeits-Hilfe mit Begründungspflicht).
describe("SCRUM-365: reviewGuidance — Was prüfe ich?", () => {
  it("hat genau die vier stabilen Prüfpunkte in fester Reihenfolge", () => {
    expect(REVIEW_CHECK_ITEMS.map((i) => i.id)).toEqual([
      "statement",
      "evidence",
      "context",
      "traceable",
    ]);
  });

  it("jeder Prüfpunkt hat Label + Hinweis DE/EN", () => {
    for (const item of REVIEW_CHECK_ITEMS) {
      expect(present(item.labelKey)).toBe(true);
      expect(present(item.hintKey)).toBe(true);
    }
  });

  it("Kontext-Fokus: revidiert > Autor-Transfer > Basis (null)", () => {
    expect(reviewGuidanceFocusKey({ kind: "revision", authorTransferred: false })).toBe(
      "val.guide.focus.revision",
    );
    // Revision hat Vorrang, auch wenn zusätzlich übertragen.
    expect(reviewGuidanceFocusKey({ kind: "revision", authorTransferred: true })).toBe(
      "val.guide.focus.revision",
    );
    expect(reviewGuidanceFocusKey({ kind: "new", authorTransferred: true })).toBe(
      "val.guide.focus.transfer",
    );
    // Neu + nicht übertragen → Basis-Checkliste reicht.
    expect(reviewGuidanceFocusKey({ kind: "new", authorTransferred: false })).toBeNull();
    expect(present("val.guide.focus.revision")).toBe(true);
    expect(present("val.guide.focus.transfer")).toBe(true);
  });

  it("Quorum-/Trust-Notiz ist ehrlich (Trust ≠ Wahrheit, Quorum sichert) DE/EN", () => {
    expect(DECISION_TRUST_NOTE_KEY).toBe("val.guide.trustNote");
    expect(present(DECISION_TRUST_NOTE_KEY)).toBe(true);
    expect(text("de", DECISION_TRUST_NOTE_KEY)).toContain("keine wahrheitsgarantie");
    expect(text("de", DECISION_TRUST_NOTE_KEY)).toContain("quorum");
    expect(text("en", DECISION_TRUST_NOTE_KEY)).toContain("not a guarantee of truth");
    expect(text("en", DECISION_TRUST_NOTE_KEY)).toContain("quorum");
  });
});

describe("SCRUM-365: decisionImpact — Was bewirkt Grün/Gelb/Rot?", () => {
  it("drei Wirkungen up→warn→down mit passender Tönung", () => {
    expect(DECISION_IMPACTS.map((d) => d.verdict)).toEqual(["up", "warn", "down"]);
    expect(DECISION_IMPACTS.map((d) => d.tone)).toEqual(["pos", "warn", "crit"]);
  });

  it("nur warn/down brauchen eine Begründung (wie REVIEW_DECISIONS)", () => {
    expect(decisionImpact("up").needsReason).toBe(false);
    expect(decisionImpact("warn").needsReason).toBe(true);
    expect(decisionImpact("down").needsReason).toBe(true);
  });

  it("Titel + Wirkungstext sind DE/EN vorhanden", () => {
    for (const d of DECISION_IMPACTS) {
      expect(present(d.titleKey)).toBe(true);
      expect(present(d.bodyKey)).toBe(true);
    }
  });

  it("Freigabe behauptet KEINE automatische Freigabe (Ehrlichkeit, PI-K2)", () => {
    expect(text("de", "val.impact.up.body")).toContain("nichts wird automatisch freigegeben");
    expect(text("en", "val.impact.up.body")).toContain("nothing is released automatically");
  });

  it("Gelb/Rot sind als Begründung + Nacharbeit gerahmt (keine Auto-Schließung)", () => {
    expect(text("de", "val.impact.warn.body")).toContain("begründung");
    expect(text("de", "val.impact.warn.body")).toContain("nachzuarbeiten");
    expect(text("de", "val.impact.down.body")).toContain("nacharbeit");
    expect(text("de", "val.impact.down.body")).toContain("nichts automatisch");
    expect(text("en", "val.impact.down.body")).toContain("nothing is closed automatically");
  });
});

// SCRUM-365 / AG-12: Feedback-Pflicht für Gelb/Rot bleibt, ist aber als Nacharbeits-Hilfe gerahmt.
describe("SCRUM-365: feedback help hint", () => {
  it("val.feedback.helpHint rahmt Feedback als Hilfe für die nächste Revision (DE/EN)", () => {
    expect(present("val.feedback.helpHint")).toBe(true);
    expect(text("de", "val.feedback.helpHint")).toContain("nächste version");
    expect(text("en", "val.feedback.helpHint")).toContain("next version");
  });
});
