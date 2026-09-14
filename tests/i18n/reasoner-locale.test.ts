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

  // JOB 3980: Der Zweig, an dem Klaras Hilfe-KI haengt, war bis heute unbelegt — `nl` kann der
  // Helfer seit AUFTRAG-mega52 D1, geprueft hat es niemand.
  it("niederlaendische Sprachcodes → nl", () => {
    expect(toReasonerLocale("nl")).toBe("nl");
    expect(toReasonerLocale("nl-NL")).toBe("nl");
  });

  it("leer/unbekannt → de (sicherer Default)", () => {
    expect(toReasonerLocale("")).toBe("de");
    expect(toReasonerLocale(undefined)).toBe("de");
    expect(toReasonerLocale("fr")).toBe("de");
  });
});
