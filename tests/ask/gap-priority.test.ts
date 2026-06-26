import { describe, expect, it } from "vitest";
import type { Gap } from "../../apps/web/src/api/types";
import {
  GAP_PRIORITIES,
  priorityRank,
  priorityTone,
  sortGapsByPriority,
} from "../../apps/web/src/lib/gapPriority";

const gap = (p: Partial<Gap> & { id: string }): Gap => ({
  question: p.id,
  status: "offen",
  assignee: null,
  priority: "mittel",
  createdAt: "2026-01-01",
  ...p,
});

describe("FE-RISK-02 / SCRUM-115: gapPriority", () => {
  it("kennt genau drei Prioritäten", () => {
    expect(GAP_PRIORITIES).toEqual(["hoch", "mittel", "niedrig"]);
  });

  it("priorityRank: hoch < mittel < niedrig; fehlend → wie mittel", () => {
    expect(priorityRank("hoch")).toBeLessThan(priorityRank("mittel"));
    expect(priorityRank("mittel")).toBeLessThan(priorityRank("niedrig"));
    expect(priorityRank(undefined)).toBe(priorityRank("mittel"));
  });

  it("sortGapsByPriority: hoch→mittel→niedrig, dann createdAt; Eingabe unverändert", () => {
    const input = [
      gap({ id: "a", priority: "niedrig", createdAt: "2026-01-01" }),
      gap({ id: "b", priority: "hoch", createdAt: "2026-02-01" }),
      gap({ id: "c", priority: "mittel", createdAt: "2026-01-05" }),
      gap({ id: "d", priority: "hoch", createdAt: "2026-01-01" }),
    ];
    expect(sortGapsByPriority(input).map((g) => g.id)).toEqual(["d", "b", "c", "a"]);
    expect(input[0]?.id).toBe("a"); // Original unverändert
  });

  it("priorityTone: hoch=crit, mittel=warn, niedrig=neutral", () => {
    expect(priorityTone("hoch")).toBe("crit");
    expect(priorityTone("mittel")).toBe("warn");
    expect(priorityTone("niedrig")).toBe("neutral");
    expect(priorityTone(undefined)).toBe("warn");
  });
});
