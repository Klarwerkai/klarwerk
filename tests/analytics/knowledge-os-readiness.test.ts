import { describe, expect, it } from "vitest";
import type { KnowledgeOsHintsResult } from "../../apps/web/src/lib/knowledgeOsHints";
import { buildKnowledgeOsReadiness } from "../../apps/web/src/lib/knowledgeOsReadiness";
import type { QmDataWindow } from "../../apps/web/src/lib/qmDataWindow";

function hints(
  summary: Partial<KnowledgeOsHintsResult["summary"]>,
  unknownSources: KnowledgeOsHintsResult["unknownSources"] = [],
): KnowledgeOsHintsResult {
  return {
    hints: [],
    summary: { total: 0, critical: 0, warnings: 0, info: 0, ok: 0, ...summary },
    unknownSources,
  };
}

const win = (status: QmDataWindow["status"]): QmDataWindow => ({
  status,
  loaded: 500,
  limit: 500,
  source: "evidence",
});

describe("SCRUM-178: buildKnowledgeOsReadiness", () => {
  it("critical hint → critical", () => {
    const res = buildKnowledgeOsReadiness({ hints: hints({ critical: 1, warnings: 2 }) });
    expect(res.readiness).toBe("critical");
    expect(res.counts).toMatchObject({ critical: 1, warnings: 2 });
    expect(res.reasons[0]).toBe("critical");
  });

  it("warning hint (kein critical) → attention", () => {
    const res = buildKnowledgeOsReadiness({ hints: hints({ warnings: 3 }) });
    expect(res.readiness).toBe("attention");
    expect(res.reasons).toContain("warning");
  });

  it("window potentiallyLimited → attention", () => {
    const res = buildKnowledgeOsReadiness({
      hints: hints({}),
      windows: [win("withinWindow"), win("potentiallyLimited")],
    });
    expect(res.readiness).toBe("attention");
    expect(res.counts.windowLimited).toBe(1);
    expect(res.reasons).toContain("window");
  });

  it("unknown ohne warnings → incomplete", () => {
    const res = buildKnowledgeOsReadiness({
      hints: hints({}, ["modelRuns", "evidence"]),
    });
    expect(res.readiness).toBe("incomplete");
    expect(res.counts.unknown).toBe(2);
    expect(res.reasons).toEqual(["unknown"]);
  });

  it("all clear + keine unknowns + keine limited windows → ready", () => {
    const res = buildKnowledgeOsReadiness({
      hints: hints({ ok: 1 }),
      windows: [win("withinWindow")],
    });
    expect(res.readiness).toBe("ready");
    expect(res.reasons).toEqual([]);
  });

  it("Gründe max. 3 und deterministisch nach Priorität", () => {
    const res = buildKnowledgeOsReadiness({
      hints: hints({ critical: 1, warnings: 1 }, ["modelRuns"]),
      windows: [win("potentiallyLimited")],
    });
    // critical > warning > window > unknown, gekappt auf 3.
    expect(res.reasons).toEqual(["critical", "warning", "window"]);
  });
});
