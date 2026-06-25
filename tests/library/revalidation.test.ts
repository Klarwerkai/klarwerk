import { describe, expect, it } from "vitest";
import { canRevalidate } from "../../apps/web/src/lib/revalidation";

// SCRUM-136: Re-Validierung aus der Bibliothek nur für validierte Objekte.
describe("SCRUM-136: canRevalidate", () => {
  it("erlaubt Re-Validierung nur für validierte KOs", () => {
    expect(canRevalidate("validiert")).toBe(true);
    expect(canRevalidate("offen")).toBe(false);
  });
});
