import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  REWORK_PARAM,
  REWORK_REVIEW_VALUE,
  isReviewReworkContext,
  reworkHref,
} from "../../apps/web/src/lib/reviewReworkContext";

// SCRUM-330: DOM-freier Review-Nacharbeitskontext (Link + Query-Erkennung fürs KO-Detail).
describe("SCRUM-330: reviewReworkContext", () => {
  it("reworkHref hängt rework=review an /wissen/:id", () => {
    expect(reworkHref("ko-7")).toBe("/wissen/ko-7?rework=review");
    expect(REWORK_PARAM).toBe("rework");
    expect(REWORK_REVIEW_VALUE).toBe("review");
  });

  it("isReviewReworkContext erkennt nur exaktes rework=review", () => {
    expect(isReviewReworkContext(new URLSearchParams("rework=review"))).toBe(true);
    expect(isReviewReworkContext(new URLSearchParams("rework=other"))).toBe(false);
    expect(isReviewReworkContext(new URLSearchParams(""))).toBe(false);
    expect(isReviewReworkContext(new URLSearchParams("foo=bar"))).toBe(false);
  });

  it("erkennt rework=review auch neben anderen Query-Parametern", () => {
    expect(isReviewReworkContext(new URLSearchParams("demo=stage1&rework=review"))).toBe(true);
  });

  it("Banner-i18n-Keys sind DE+EN vorhanden", () => {
    const keys = ["ko.rework.title", "ko.rework.hint", "ko.rework.edit", "ko.rework.back"];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("ehrlich: Hinweis verspricht keine automatische Freigabe/Rückgabe (DE)", () => {
    const hint = String(i18n.getResource("de", "translation", "ko.rework.hint") ?? "");
    expect(hint).toMatch(/keine automatische Freigabe/i);
    expect(hint).toMatch(/keine automatische Rückgabe/i);
  });
});
