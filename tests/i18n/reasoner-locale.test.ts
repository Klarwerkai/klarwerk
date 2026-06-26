import { describe, expect, it } from "vitest";
import { toReasonerLocale } from "../../apps/web/src/lib/reasonerLocale";

describe("SCRUM-88 / FR-I18N-01: toReasonerLocale", () => {
  it("deutsche Sprachcodes → de", () => {
    expect(toReasonerLocale("de")).toBe("de");
    expect(toReasonerLocale("de-DE")).toBe("de");
  });

  it("englische Sprachcodes → en", () => {
    expect(toReasonerLocale("en")).toBe("en");
    expect(toReasonerLocale("en-US")).toBe("en");
    expect(toReasonerLocale("EN-GB")).toBe("en");
  });

  it("leer/unbekannt → de (sicherer Default)", () => {
    expect(toReasonerLocale("")).toBe("de");
    expect(toReasonerLocale(undefined)).toBe("de");
    expect(toReasonerLocale("fr")).toBe("de");
  });
});
