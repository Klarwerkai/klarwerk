import { describe, expect, it } from "vitest";
import {
  ANALYTICS_AUDIT_ANCHOR,
  ANALYTICS_AUDIT_PATH,
  hashToElementId,
} from "../../apps/web/src/lib/analyticsSections";

describe("SCRUM-229: analyticsSections", () => {
  it("Audit-Anker und Deep-Link-Pfad sind stabil und konsistent", () => {
    expect(ANALYTICS_AUDIT_ANCHOR).toBe("analytics-audit");
    expect(ANALYTICS_AUDIT_PATH).toBe("/analytics#analytics-audit");
  });

  it("hashToElementId entfernt führendes # und trimmt", () => {
    expect(hashToElementId("#analytics-audit")).toBe("analytics-audit");
    expect(hashToElementId("analytics-audit")).toBe("analytics-audit");
    expect(hashToElementId("#  spaced  ")).toBe("spaced");
  });

  it("leerer/whitespace Hash → null (kein Scroll-Ziel)", () => {
    expect(hashToElementId("")).toBeNull();
    expect(hashToElementId("#")).toBeNull();
    expect(hashToElementId("#   ")).toBeNull();
  });
});
