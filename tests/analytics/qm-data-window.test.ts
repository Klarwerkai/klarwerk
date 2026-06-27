import { describe, expect, it } from "vitest";
import { evaluateDataWindow } from "../../apps/web/src/lib/qmDataWindow";

describe("SCRUM-177: evaluateDataWindow", () => {
  it("loaded < limit → withinWindow", () => {
    expect(evaluateDataWindow({ loaded: 12, limit: 50, source: "modelRuns" }).status).toBe(
      "withinWindow",
    );
  });

  it("loaded === limit → potentiallyLimited", () => {
    expect(evaluateDataWindow({ loaded: 50, limit: 50, source: "modelRuns" }).status).toBe(
      "potentiallyLimited",
    );
  });

  it("loaded > limit → potentiallyLimited", () => {
    expect(evaluateDataWindow({ loaded: 600, limit: 500, source: "evidence" }).status).toBe(
      "potentiallyLimited",
    );
  });

  it("limit 0 → defensiv withinWindow", () => {
    expect(evaluateDataWindow({ loaded: 10, limit: 0, source: "evidence" }).status).toBe(
      "withinWindow",
    );
  });

  it("negatives Limit → defensiv withinWindow", () => {
    expect(evaluateDataWindow({ loaded: 10, limit: -5, source: "evidence" }).status).toBe(
      "withinWindow",
    );
  });

  it("übernimmt loaded/limit/source und normalisiert defensiv", () => {
    const w = evaluateDataWindow({ loaded: 7.9, limit: 50, source: "modelRuns" });
    expect(w).toMatchObject({ loaded: 7, limit: 50, source: "modelRuns", status: "withinWindow" });
  });

  it("nicht-finite loaded → 0, withinWindow", () => {
    const w = evaluateDataWindow({ loaded: Number.NaN, limit: 50, source: "evidence" });
    expect(w.loaded).toBe(0);
    expect(w.status).toBe("withinWindow");
  });
});
