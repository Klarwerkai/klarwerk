import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  buildValidationFeedback,
  latestValidationFeedback,
  parseValidationFeedback,
} from "../../apps/web/src/lib/validationFeedback";

// SCRUM-332: Validierungsfeedback aus KO-Kommentaren wieder LESEN (am stabilen Präfix erkannt).
describe("SCRUM-332: parseValidationFeedback", () => {
  it("erkennt warn-/down-Feedback am Präfix und liefert den reinen Text", () => {
    expect(parseValidationFeedback(buildValidationFeedback("warn", "Quelle fehlt"))).toEqual({
      verdict: "warn",
      body: "Quelle fehlt",
    });
    expect(parseValidationFeedback(buildValidationFeedback("down", "Inhalt falsch"))).toEqual({
      verdict: "down",
      body: "Inhalt falsch",
    });
  });

  it("ignoriert normale/unbekannte/leere Kommentare (null)", () => {
    expect(parseValidationFeedback("Ein ganz normaler Kommentar")).toBeNull();
    expect(parseValidationFeedback("Validierungsfeedback ist super")).toBeNull();
    expect(parseValidationFeedback("")).toBeNull();
    expect(parseValidationFeedback(null)).toBeNull();
    expect(parseValidationFeedback(undefined)).toBeNull();
  });
});

describe("SCRUM-332: latestValidationFeedback", () => {
  it("liefert null bei leeren/fehlenden/ausschließlich normalen Kommentaren", () => {
    expect(latestValidationFeedback([])).toBeNull();
    expect(latestValidationFeedback(null)).toBeNull();
    expect(latestValidationFeedback(undefined)).toBeNull();
    expect(
      latestValidationFeedback([
        { text: "normal", author: "u1", at: "2026-01-01" },
        { text: "auch normal", author: "u2", at: "2026-01-02" },
      ]),
    ).toBeNull();
  });

  it("liefert das jüngste Validierungsfeedback (per ISO-at), inkl. Autor/Zeit", () => {
    const result = latestValidationFeedback([
      { text: buildValidationFeedback("warn", "alt"), author: "u1", at: "2026-01-01T08:00:00Z" },
      { text: "dazwischen normal", author: "u2", at: "2026-01-02T08:00:00Z" },
      { text: buildValidationFeedback("down", "neu"), author: "u3", at: "2026-01-03T08:00:00Z" },
    ]);
    expect(result).toEqual({
      verdict: "down",
      body: "neu",
      author: "u3",
      at: "2026-01-03T08:00:00Z",
    });
  });

  it("bei fehlendem at greift die spätere Array-Position", () => {
    const result = latestValidationFeedback([
      { text: buildValidationFeedback("warn", "erstes") },
      { text: buildValidationFeedback("warn", "zweites") },
    ]);
    expect(result?.body).toBe("zweites");
    expect(result?.author).toBe("");
    expect(result?.at).toBe("");
  });

  it("bei gemischten Zeitstempeln darf ein späterer Kommentar ohne at den vorherigen Kontext überholen", () => {
    const result = latestValidationFeedback([
      { text: buildValidationFeedback("warn", "mit Zeit"), at: "2026-01-03T08:00:00Z" },
      { text: buildValidationFeedback("down", "später ohne Zeit") },
    ]);
    expect(result?.verdict).toBe("down");
    expect(result?.body).toBe("später ohne Zeit");
  });

  it("robust gegen fehlenden text im Kommentar", () => {
    expect(() => latestValidationFeedback([{ author: "u1", at: "x" }])).not.toThrow();
    expect(latestValidationFeedback([{ author: "u1", at: "x" }])).toBeNull();
  });

  it("Banner-i18n (feedbackTitle + verdict-Labels) DE+EN vorhanden", () => {
    const keys = ["ko.rework.feedbackTitle", "ko.rework.feedback.warn", "ko.rework.feedback.down"];
    for (const key of keys) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  // SCRUM-333: Rework-Edit-Hilfe (Feedback während der Revision als Arbeitshilfe).
  it("Edit-Hilfe-i18n (editTitle/editHint) DE+EN vorhanden", () => {
    for (const key of ["ko.rework.editTitle", "ko.rework.editHint"]) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
  });

  it("ehrlich: editHint benennt neue Version + erneute Prüfung, keine automatische Freigabe (DE/EN)", () => {
    const de = String(i18n.getResource("de", "translation", "ko.rework.editHint") ?? "");
    expect(de).toMatch(/neue Version/i);
    expect(de).toMatch(/keine automatische Freigabe/i);
    const en = String(i18n.getResource("en", "translation", "ko.rework.editHint") ?? "");
    expect(en).toMatch(/new version/i);
    expect(en).toMatch(/no automatic approval/i);
  });
});
