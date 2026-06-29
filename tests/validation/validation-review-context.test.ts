import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  type ReviewContextKind,
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
