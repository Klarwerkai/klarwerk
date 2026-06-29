import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  REVIEW_FOCUS_FILTERS,
  type ReviewContextKind,
  type ReviewFocusFilter,
  countByReviewFocus,
  matchesReviewFocus,
  readReviewFocusFilter,
  reviewFocusLabelKey,
  validationReviewContext,
} from "../../apps/web/src/lib/validationReviewContext";

// SCRUM-326: DOM-freier Review-Kontext fürs Validation Board (neu vs. revidiert via Version).
describe("SCRUM-326: validationReviewContext", () => {
  it("Version 1 → new", () => {
    const c = validationReviewContext({ version: 1, status: "offen", trust: 40 });
    expect(c.kind).toBe<ReviewContextKind>("new");
    expect(c.version).toBe(1);
    expect(c.labelKey).toBe("val.reviewContext.new");
    expect(c.hintKey).toBe("val.reviewContext.hint.new");
    expect(c.tone).toBe("new");
  });

  it("Version 2 → revision", () => {
    const c = validationReviewContext({ version: 2, status: "in_pruefung", trust: 55 });
    expect(c.kind).toBe<ReviewContextKind>("revision");
    expect(c.version).toBe(2);
    expect(c.labelKey).toBe("val.reviewContext.revision");
    expect(c.hintKey).toBe("val.reviewContext.hint.revision");
    expect(c.tone).toBe("revision");
  });

  it("fehlende/0/negative/NaN-Version → defensiv new (Version 1)", () => {
    for (const v of [undefined, null, 0, -3, Number.NaN, Number.POSITIVE_INFINITY]) {
      const c = validationReviewContext({ version: v as number });
      expect(c.kind).toBe("new");
      expect(c.version).toBe(1);
    }
  });

  it("hohe/ungerade Versionen werden gefloored, bleiben revision", () => {
    expect(validationReviewContext({ version: 3.9 }).version).toBe(3);
    expect(validationReviewContext({ version: 3.9 }).kind).toBe("revision");
  });

  it("status/trust werden nur durchgereicht, nicht überschrieben", () => {
    const c = validationReviewContext({ version: 2, status: "validiert", trust: 88 });
    expect(c.status).toBe("validiert");
    expect(c.trust).toBe(88);
    // ungültiger Trust → 0, status leer-Default.
    const d = validationReviewContext({ version: 1, trust: Number.NaN });
    expect(d.trust).toBe(0);
    expect(d.status).toBe("");
  });

  it("robust gegen null/undefined", () => {
    expect(() => validationReviewContext(null)).not.toThrow();
    expect(validationReviewContext(undefined).kind).toBe("new");
  });

  it("Label-/Hint-Keys sind DE+EN vorhanden", () => {
    const keys = [
      "val.reviewContext.new",
      "val.reviewContext.revision",
      "val.reviewContext.hint.new",
      "val.reviewContext.hint.revision",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("ehrlich: Revisions-Hinweis verspricht keine automatische Freigabe (DE)", () => {
    const hint = String(
      i18n.getResource("de", "translation", "val.reviewContext.hint.revision") ?? "",
    );
    expect(hint).toMatch(/keine automatische Freigabe/i);
  });
});

// SCRUM-327: Review-Fokusfilter (Alle/Neu/Überarbeitet) über dieselbe neu-vs.-revision-Logik.
describe("SCRUM-327: ReviewFocusFilter", () => {
  it("FILTERS in fester Reihenfolge", () => {
    expect(REVIEW_FOCUS_FILTERS).toEqual<ReviewFocusFilter[]>(["all", "new", "revision"]);
  });

  it("matchesReviewFocus: all matcht alles", () => {
    expect(matchesReviewFocus({ version: 1 }, "all")).toBe(true);
    expect(matchesReviewFocus({ version: 5 }, "all")).toBe(true);
    expect(matchesReviewFocus(null, "all")).toBe(true);
  });

  it("matchesReviewFocus: new matcht Version 1 + defensive Defaults", () => {
    expect(matchesReviewFocus({ version: 1 }, "new")).toBe(true);
    expect(matchesReviewFocus({ version: 0 }, "new")).toBe(true);
    expect(matchesReviewFocus({ version: Number.NaN }, "new")).toBe(true);
    expect(matchesReviewFocus(null, "new")).toBe(true);
    expect(matchesReviewFocus({ version: 2 }, "new")).toBe(false);
  });

  it("matchesReviewFocus: revision matcht Version > 1", () => {
    expect(matchesReviewFocus({ version: 2 }, "revision")).toBe(true);
    expect(matchesReviewFocus({ version: 9 }, "revision")).toBe(true);
    expect(matchesReviewFocus({ version: 1 }, "revision")).toBe(false);
  });

  it("countByReviewFocus über gemischte Liste", () => {
    const kos = [{ version: 1 }, { version: 2 }, { version: 3 }, { version: 1 }, { version: 0 }];
    expect(countByReviewFocus(kos)).toEqual({ all: 5, new: 3, revision: 2 });
  });

  it("readReviewFocusFilter: gültig durchgereicht, sonst all", () => {
    expect(readReviewFocusFilter(new URLSearchParams("review=new"))).toBe("new");
    expect(readReviewFocusFilter(new URLSearchParams("review=revision"))).toBe("revision");
    expect(readReviewFocusFilter(new URLSearchParams("review=all"))).toBe("all");
    expect(readReviewFocusFilter(new URLSearchParams("review=quatsch"))).toBe("all");
    expect(readReviewFocusFilter(new URLSearchParams(""))).toBe("all");
  });

  it("Label-Keys stabil und DE+EN vorhanden", () => {
    const keys = [
      "val.reviewFocus.label",
      ...REVIEW_FOCUS_FILTERS.map((f) => reviewFocusLabelKey(f)),
    ];
    for (const f of REVIEW_FOCUS_FILTERS) {
      expect(reviewFocusLabelKey(f)).toBe(`val.reviewFocus.${f}`);
    }
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });
});
