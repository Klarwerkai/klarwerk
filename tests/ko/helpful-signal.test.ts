import { describe, expect, it } from "vitest";
import { helpfulDisabled, helpfulLabel } from "../../apps/web/src/lib/helpfulSignal";

describe("FE-LCY-03 / SCRUM-111: Helpful-Button-Entscheidung", () => {
  it("ist während Mutation und nach Erfolg deaktiviert", () => {
    expect(helpfulDisabled({ pending: false, success: false })).toBe(false);
    expect(helpfulDisabled({ pending: true, success: false })).toBe(true);
    expect(helpfulDisabled({ pending: false, success: true })).toBe(true);
  });

  it("berücksichtigt einen zusätzlichen Blockierungsgrund (z. B. keine Quelle)", () => {
    expect(helpfulDisabled({ pending: false, success: false }, true)).toBe(true);
    expect(helpfulDisabled({ pending: false, success: false }, false)).toBe(false);
  });

  it("zeigt nach Erfolg den Dank-Text, sonst das Aktions-Label", () => {
    expect(helpfulLabel({ success: false }, "Hat geholfen", "Danke!")).toBe("Hat geholfen");
    expect(helpfulLabel({ success: true }, "Hat geholfen", "Danke!")).toBe("Danke!");
  });
});
