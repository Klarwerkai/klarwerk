import { describe, expect, it } from "vitest";
import type { BusFactorEntry, Conflict, Gap, KnowledgeObject } from "../../apps/web/src/api/types";
import { bandForScore, domainRisk, knowledgeHealth } from "../../apps/web/src/lib/knowledgeHealth";

const ko = (p: Partial<KnowledgeObject> & { id: string }): KnowledgeObject =>
  ({
    title: p.id,
    statement: "",
    conditions: [],
    measures: [],
    type: "technik",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "a",
    author: "a",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01",
    history: [],
    ...p,
  }) as KnowledgeObject;

const gap = (status: Gap["status"]): Gap =>
  ({ id: `g-${Math.random()}`, question: "?", status, assignee: null, createdAt: "x" }) as Gap;
const conflict = (status: Conflict["status"]): Conflict =>
  ({ id: `c-${Math.random()}`, status }) as Conflict;
const bus = (category: string, singleSource: boolean, authorCount = 1): BusFactorEntry => ({
  category,
  authorCount,
  koCount: 1,
  singleSource,
});

describe("SCRUM-141: Knowledge Health", () => {
  it("Bänder nach Score-Schwellen", () => {
    expect(bandForScore(85)).toBe("gut");
    expect(bandForScore(70)).toBe("gut");
    expect(bandForScore(55)).toBe("mittel");
    expect(bandForScore(40)).toBe("mittel");
    expect(bandForScore(20)).toBe("kritisch");
  });

  it("gesunder Bestand → hoher Score, Band gut", () => {
    const kos = [
      ko({ id: "K1", status: "validiert", trust: 80 }),
      ko({ id: "K2", status: "validiert", trust: 60 }),
    ];
    const h = knowledgeHealth({
      kos,
      gaps: [],
      conflicts: [],
      pendingRevalidation: [],
      busFactor: [bus("Anlage 1", false, 3)],
    });
    expect(h.validatedRatio).toBe(100);
    expect(h.score).toBe(100);
    expect(h.band).toBe("gut");
    expect(h.avgTrust).toBe(70);
  });

  it("belastende Signale senken den Score und sind als Faktoren erklärbar", () => {
    const kos = [ko({ id: "K1", status: "offen" }), ko({ id: "K2", status: "validiert" })];
    const h = knowledgeHealth({
      kos,
      gaps: [gap("offen"), gap("offen")],
      conflicts: [conflict("offen")],
      pendingRevalidation: ["K1"],
      busFactor: [bus("Anlage 1", true)],
    });
    expect(h.score).toBeLessThan(50);
    expect(h.openGaps).toBe(2);
    expect(h.openConflicts).toBe(1);
    expect(h.staleRatio).toBe(50);
    expect(h.singleSourceShare).toBe(100);
    const negatives = h.factors.filter((f) => f.direction === "negative");
    expect(negatives.length).toBeGreaterThanOrEqual(4);
  });

  it("leerer Bestand ist sicher (kein NaN)", () => {
    const h = knowledgeHealth({
      kos: [],
      gaps: [],
      conflicts: [],
      pendingRevalidation: [],
      busFactor: [],
    });
    expect(h.score).toBe(0);
    expect(h.validatedRatio).toBe(0);
    expect(Number.isNaN(h.avgTrust)).toBe(false);
  });
});

describe("SCRUM-133: Domänen-Risiko-Cockpit", () => {
  const kos = [
    ko({ id: "A1", category: "Anlage 1", status: "validiert" }),
    ko({ id: "A2", category: "Anlage 1", status: "offen" }),
    ko({ id: "B1", category: "Anlage 2", status: "validiert" }),
    ko({ id: "B2", category: "Anlage 2", status: "validiert" }),
  ];
  const busFactor = [bus("Anlage 1", true, 1), bus("Anlage 2", false, 3)];

  it("gruppiert je Kategorie und berechnet Validierungsquote", () => {
    const rows = domainRisk(kos, busFactor);
    const a1 = rows.find((r) => r.category === "Anlage 1");
    const a2 = rows.find((r) => r.category === "Anlage 2");
    expect(a1?.koCount).toBe(2);
    expect(a1?.validatedRatio).toBe(50);
    expect(a2?.validatedRatio).toBe(100);
  });

  it("Single-Source → kritisch; gut validiert + Mehrautor → gut; sortiert nach Risiko", () => {
    const rows = domainRisk(kos, busFactor);
    expect(rows[0]?.category).toBe("Anlage 1"); // kritisch zuerst
    expect(rows[0]?.level).toBe("kritisch");
    expect(rows.find((r) => r.category === "Anlage 2")?.level).toBe("gut");
  });

  it("leerer Bestand → leere Liste", () => {
    expect(domainRisk([], [])).toEqual([]);
  });
});
