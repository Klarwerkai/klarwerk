import { describe, expect, it } from "vitest";
import type { Conflict, Gap } from "../../apps/web/src/api/types";
import { buildRiskCockpit } from "../../apps/web/src/lib/riskCockpit";

function gap(overrides: Partial<Gap>): Gap {
  return {
    id: "g1",
    question: "Frage?",
    status: "offen",
    assignee: null,
    priority: "mittel",
    createdAt: "2026-06-26T10:00:00.000Z",
    ...overrides,
  };
}

function conflict(overrides: Partial<Conflict>): Conflict {
  return {
    id: "c1",
    koA: "a",
    koB: "b",
    type: "truth",
    description: "x",
    status: "offen",
    secondOpinion: null,
    decidedBy: null,
    decision: null,
    createdAt: "2026-06-26T10:00:00.000Z",
    ...overrides,
  };
}

describe("SCRUM-230: buildRiskCockpit", () => {
  it("leere Daten → alle Kennzahlen 0", () => {
    expect(buildRiskCockpit([], [])).toEqual({
      openGaps: 0,
      highPriority: 0,
      assigned: 0,
      unassigned: 0,
      closedGaps: 0,
      openConflicts: 0,
    });
  });

  it("zählt offene/geschlossene Lücken, Priorität und Zuweisung getrennt", () => {
    const gaps = [
      gap({ id: "a", status: "offen", priority: "hoch", assignee: "u1" }),
      gap({ id: "b", status: "offen", priority: "hoch", assignee: null }),
      gap({ id: "c", status: "offen", priority: "niedrig", assignee: null }),
      gap({ id: "d", status: "geschlossen", priority: "mittel", assignee: "u2" }),
    ];
    const c = buildRiskCockpit(gaps, []);
    expect(c.openGaps).toBe(3);
    expect(c.highPriority).toBe(2);
    expect(c.assigned).toBe(1);
    expect(c.unassigned).toBe(2);
    expect(c.closedGaps).toBe(1);
  });

  it("offene Konflikte = alles außer geloest", () => {
    const conflicts = [
      conflict({ id: "1", status: "offen" }),
      conflict({ id: "2", status: "eskaliert" }),
      conflict({ id: "3", status: "zweitmeinung" }),
      conflict({ id: "4", status: "geloest" }),
    ];
    expect(buildRiskCockpit([], conflicts).openConflicts).toBe(3);
  });
});
