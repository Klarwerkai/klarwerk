import { describe, expect, it } from "vitest";
import { captureNextSteps } from "../../apps/web/src/lib/captureSuccess";

// SCRUM-276: nach dem Einreichen den nächsten Schritt im Kernfluss sichtbar machen.
describe("SCRUM-276: captureNextSteps", () => {
  it("führt zum erstellten KO und zur Validierung", () => {
    const steps = captureNextSteps("ko-42");
    expect(steps.map((s) => s.to)).toEqual(["/wissen/ko-42", "/validierung"]);
  });

  it("jeder Schritt hat ein nicht-leeres Label und ein vorhandenes Ziel", () => {
    for (const s of captureNextSteps("ko-1")) {
      expect(s.labelKey.length).toBeGreaterThan(0);
      expect(s.to.length).toBeGreaterThan(0);
    }
  });

  it("bettet die KO-ID in den Detail-Link ein", () => {
    const [viewKo] = captureNextSteps("abc-123");
    expect(viewKo?.to).toBe("/wissen/abc-123");
  });
});
