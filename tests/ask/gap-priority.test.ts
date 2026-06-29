import { describe, expect, it } from "vitest";
import type { Gap } from "../../apps/web/src/api/types";
import {
  GAP_PRIORITIES,
  gapNextStep,
  gapPhase,
  priorityRank,
  priorityTone,
  sortGapsByPriority,
} from "../../apps/web/src/lib/gapPriority";
import { knowledgeOsPhase } from "../../apps/web/src/lib/taskAction";

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

describe("SCRUM-253: gapNextStep", () => {
  it("geschlossene Lücke → erledigt", () => {
    expect(gapNextStep(gap({ id: "a", status: "geschlossen" }))).toBe("done");
    expect(gapNextStep(gap({ id: "b", status: "geschlossen", assignee: "u1" }))).toBe("done");
  });

  it("offen + zugewiesen → Wissen erfassen", () => {
    expect(gapNextStep(gap({ id: "a", assignee: "u1", priority: "mittel" }))).toBe("capture");
    expect(gapNextStep(gap({ id: "b", assignee: "u1", priority: "hoch" }))).toBe("capture");
  });

  it("offen + ohne Owner: hoch → zuweisen, sonst → priorisieren", () => {
    expect(gapNextStep(gap({ id: "a", assignee: null, priority: "hoch" }))).toBe("assign");
    expect(gapNextStep(gap({ id: "b", assignee: null, priority: "mittel" }))).toBe("prioritize");
    expect(gapNextStep(gap({ id: "c", assignee: null, priority: "niedrig" }))).toBe("prioritize");
  });
});

// SCRUM-298: eine offene Wissenslücke ist „Erfassen"-Arbeit im Knowledge-OS-Kreis (Lücke → erfassen →
// Review → später quellengebunden nutzen). Gleiche Kreis-Sprache wie Start/MyTasks.
describe("SCRUM-298: gapPhase", () => {
  it("offene Lücke → Phase 'capture' (Erfassen)", () => {
    expect(gapPhase(gap({ id: "a", status: "offen" }))).toBe("capture");
    expect(gapPhase(gap({ id: "b", status: "offen", assignee: "u1" }))).toBe("capture");
  });

  it("geschlossene Lücke → Phase 'maintain' (erledigt, aktuell halten)", () => {
    expect(gapPhase(gap({ id: "a", status: "geschlossen" }))).toBe("maintain");
  });

  it("Konsistenz: offene Lücke hat dieselbe Phase wie die MyTasks-/Start-Lückenarbeit", () => {
    expect(gapPhase(gap({ id: "a", status: "offen" }))).toBe(knowledgeOsPhase("task.gap"));
    expect(gapPhase(gap({ id: "b", status: "offen" }))).toBe(knowledgeOsPhase("criticalGaps"));
  });
});
