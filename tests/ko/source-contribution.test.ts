import { describe, expect, it } from "vitest";
import {
  SOURCE_CONTRIBUTION_PREFIX,
  SOURCE_REFERENCE_PREFIX,
  formatSourceComment,
  isSourceContributionValid,
} from "../../apps/web/src/lib/sourceContribution";

describe("SCRUM-131 / FE-KO-06: Quelle/Beitrag-Helper", () => {
  it("verlangt einen nicht-leeren Pflichttext", () => {
    expect(isSourceContributionValid({ contribution: "Beleg aus Wartungshandbuch" })).toBe(true);
    expect(isSourceContributionValid({ contribution: "   " })).toBe(false);
    expect(isSourceContributionValid({ contribution: "" })).toBe(false);
  });

  it("formatiert mit Präfix und übernimmt optionale Quelle", () => {
    const text = formatSourceComment({
      contribution: "Bestätigt durch Messung an P2",
      source: "https://wiki/x",
    });
    expect(text).toBe(
      `${SOURCE_CONTRIBUTION_PREFIX} Bestätigt durch Messung an P2\n${SOURCE_REFERENCE_PREFIX} https://wiki/x`,
    );
  });

  it("lässt die Quelle-Zeile weg, wenn keine Quelle angegeben ist", () => {
    const text = formatSourceComment({ contribution: "Nur Beitrag" });
    expect(text).toBe(`${SOURCE_CONTRIBUTION_PREFIX} Nur Beitrag`);
    expect(text).not.toContain(SOURCE_REFERENCE_PREFIX);
  });

  it("trimmt Text und Quelle", () => {
    const text = formatSourceComment({ contribution: "  A  ", source: "  ref  " });
    expect(text).toBe(`${SOURCE_CONTRIBUTION_PREFIX} A\n${SOURCE_REFERENCE_PREFIX} ref`);
  });
});
