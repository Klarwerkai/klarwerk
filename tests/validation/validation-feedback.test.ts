import { describe, expect, it } from "vitest";
import {
  buildValidationFeedback,
  feedbackPrefix,
  isFeedbackSubmittable,
} from "../../apps/web/src/lib/validationFeedback";

describe("FE-VAL-06: Validierungs-Feedback", () => {
  it("nutzt klares Präfix je Verdict", () => {
    expect(feedbackPrefix("warn")).toBe("Validierungsfeedback (Bedingt)");
    expect(feedbackPrefix("down")).toBe("Validierungsfeedback (Ablehnung)");
  });

  it("baut den Kommentartext mit Präfix und getrimmtem Text", () => {
    expect(buildValidationFeedback("warn", "  Quelle fehlt  ")).toBe(
      "Validierungsfeedback (Bedingt): Quelle fehlt",
    );
    expect(buildValidationFeedback("down", "Faktisch falsch")).toBe(
      "Validierungsfeedback (Ablehnung): Faktisch falsch",
    );
  });

  it("verweigert leeres/whitespace Feedback", () => {
    expect(() => buildValidationFeedback("warn", "   ")).toThrow();
    expect(isFeedbackSubmittable("")).toBe(false);
    expect(isFeedbackSubmittable("   ")).toBe(false);
    expect(isFeedbackSubmittable("ok")).toBe(true);
  });
});
