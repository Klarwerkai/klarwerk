import { describe, expect, it } from "vitest";
import type { BusFactorEntry, Gap, KnowledgeObject } from "../../apps/web/src/api/types";
import { executiveKpis } from "../../apps/web/src/lib/executiveKpis";

// SCRUM-431: Executive-Kennzahlen aus echten Live-Daten — reine Ableitung, keine erfundenen Zahlen.
function ko(o: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "k",
    title: "T",
    statement: "S",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 50,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u",
    author: "u",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    history: [],
    ...o,
  } as KnowledgeObject;
}

const gap = (status: Gap["status"]): Gap => ({
  id: `g-${status}-${Math.round(0)}`,
  question: "Q",
  status,
  assignee: null,
  priority: "mittel",
  createdAt: "2026-07-01T00:00:00.000Z",
});

const bus = (singleSource: boolean, category: string): BusFactorEntry =>
  ({ category, authorCount: singleSource ? 1 : 3, koCount: 2, singleSource }) as BusFactorEntry;

describe("SCRUM-431: executiveKpis", () => {
  it("zählt validiertes Wissen, offene Prüfungen, Einzelquellen-Kategorien und geschlossene Lücken", () => {
    const kpis = executiveKpis({
      kos: [
        ko({ id: "1", status: "validiert" }),
        ko({ id: "2", status: "validiert" }),
        ko({ id: "3", status: "offen" }),
      ],
      gaps: [gap("geschlossen"), gap("offen"), gap("geschlossen")],
      busFactor: [bus(true, "A"), bus(false, "B"), bus(true, "C")],
    });
    expect(kpis).toEqual({
      validated: 2,
      openReviews: 1,
      singleSourceCategories: 2,
      rescuedGaps: 2,
    });
  });

  it("leere Bestände → alle Kennzahlen 0 (ehrlich, kein Fake)", () => {
    expect(executiveKpis({ kos: [], gaps: [], busFactor: [] })).toEqual({
      validated: 0,
      openReviews: 0,
      singleSourceCategories: 0,
      rescuedGaps: 0,
    });
  });
});
