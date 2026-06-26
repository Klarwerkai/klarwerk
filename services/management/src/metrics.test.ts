import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../knowledge-object";
import {
  bandForScore,
  capitalScore,
  computeSnapshot,
  house,
  maturity,
  pilot,
  priorities,
  recommendations,
  statement,
} from "./metrics";
import type { BusFactorLike, MetricsInput } from "./types";

const NOW = Date.parse("2026-06-26T00:00:00Z");

function ko(p: Partial<KnowledgeObject> & { id: string }): KnowledgeObject {
  return {
    title: p.id,
    statement: "s",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "a",
    author: "a",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-06-20",
    history: [],
    ...p,
  } as KnowledgeObject;
}

function input(over: Partial<MetricsInput> = {}): MetricsInput {
  return {
    kos: [],
    openGaps: 0,
    openConflicts: 0,
    pendingRevalidation: [],
    busFactor: [],
    now: NOW,
    ...over,
  };
}

const bus = (category: string, singleSource: boolean, authorCount = 1): BusFactorLike => ({
  category,
  authorCount,
  koCount: 1,
  singleSource,
});

describe("SCRUM-120: bandForScore", () => {
  it("Schwellen 70/40", () => {
    expect(bandForScore(85)).toBe("gut");
    expect(bandForScore(55)).toBe("mittel");
    expect(bandForScore(20)).toBe("kritisch");
  });
});

describe("SCRUM-120: capitalScore", () => {
  it("leerer Bestand → Score 0, kein NaN, Gewichte summieren auf 1", () => {
    const c = capitalScore(input());
    expect(c.score).toBe(0);
    expect(Number.isNaN(c.score)).toBe(false);
    expect(c.parts.reduce((s, p) => s + p.weight, 0)).toBeCloseTo(1, 5);
  });

  it("gesunder Bestand → hoher Score", () => {
    const c = capitalScore(
      input({
        kos: [ko({ id: "K1", trust: 90 }), ko({ id: "K2", trust: 80 })],
        busFactor: [bus("Anlage 1", false, 3)],
      }),
    );
    expect(c.score).toBeGreaterThan(70);
    expect(c.band).toBe("gut");
  });

  it("Single-Source + offene Objekte senken den Score", () => {
    const weak = capitalScore(
      input({
        kos: [ko({ id: "K1", status: "offen", trust: 30 }), ko({ id: "K2", status: "offen" })],
        busFactor: [bus("Anlage 1", true)],
        pendingRevalidation: ["K1"],
      }),
    );
    expect(weak.score).toBeLessThan(50);
  });
});

describe("SCRUM-120: statement", () => {
  it("Aktiva = validiert, Risiken summiert, Netto = übergebener Score", () => {
    const s = statement(
      input({
        kos: [ko({ id: "K1" }), ko({ id: "K2", status: "offen" })],
        busFactor: [bus("Anlage 1", true)],
        pendingRevalidation: ["K2"],
        openGaps: 2,
        openConflicts: 1,
      }),
      63,
    );
    expect(s.assets).toBe(1);
    expect(s.riskBreakdown).toEqual({
      singleSourceCategories: 1,
      stale: 1,
      openGaps: 2,
      openConflicts: 1,
    });
    expect(s.riskItems).toBe(5);
    expect(s.net).toBe(63);
  });
});

describe("SCRUM-120: maturity", () => {
  it("leerer Bestand → Stufe 0", () => {
    expect(maturity(input(), 0).stage).toBe(0);
  });
  it("hohe Validierungsquote + Mehrautor → hohe Stufe", () => {
    const kos = [ko({ id: "K1" }), ko({ id: "K2" }), ko({ id: "K3" }), ko({ id: "K4" })];
    const m = maturity(input({ kos, busFactor: [bus("Anlage 1", false, 3)] }), 90);
    expect(m.stage).toBe(5);
    expect(m.stageKey).toBe("skalieren");
    expect(m.progressPct).toBe(90);
  });
});

describe("SCRUM-120: priorities (9 Faktoren)", () => {
  it("liefert genau 9 Faktoren je Kategorie und sortiert nach Dringlichkeit", () => {
    const rows = priorities(
      input({
        kos: [
          ko({ id: "A1", category: "Anlage 1", status: "offen", trust: 20 }),
          ko({ id: "B1", category: "Anlage 2", status: "validiert", trust: 90 }),
        ],
        busFactor: [bus("Anlage 1", true), bus("Anlage 2", false, 3)],
      }),
    );
    expect(rows[0]?.factors).toHaveLength(9);
    expect(rows[0]?.category).toBe("Anlage 1"); // dringlicher zuerst
    expect(rows[0]?.score).toBeGreaterThan(rows[1]?.score ?? 0);
  });
});

describe("SCRUM-120: recommendations", () => {
  it("leitet Empfehlungen aus echten Defiziten ab und sortiert nach Anzahl", () => {
    const recs = recommendations(
      input({
        kos: [ko({ id: "K1", status: "offen" }), ko({ id: "K2", status: "offen" })],
        busFactor: [bus("Anlage 1", true), bus("Anlage 2", true)],
        pendingRevalidation: ["K1"],
        openGaps: 4,
        openConflicts: 1,
      }),
    );
    const keys = recs.map((r) => r.key);
    expect(keys).toContain("secureSingleSource");
    expect(keys).toContain("resolveConflicts");
    expect(recs.find((r) => r.key === "secureSingleSource")?.severity).toBe("hoch");
    expect(recs).toEqual([...recs].sort((a, b) => b.count - a.count));
  });

  it("sauberer Bestand → keine Empfehlungen", () => {
    expect(recommendations(input({ kos: [ko({ id: "K1" })] }))).toEqual([]);
  });
});

describe("SCRUM-120: house + pilot", () => {
  it("house markiert fragile Domänen", () => {
    const rows = house(
      input({
        kos: [
          ko({ id: "A1", category: "Anlage 1", status: "offen" }),
          ko({ id: "B1", category: "Anlage 2" }),
        ],
        busFactor: [bus("Anlage 1", false), bus("Anlage 2", false)],
      }),
    );
    expect(rows.find((r) => r.category === "Anlage 1")?.fragile).toBe(true);
  });

  it("pilot zählt nur Objekte innerhalb des Fensters", () => {
    const p = pilot(
      input({
        kos: [
          ko({ id: "neu", createdAt: "2026-06-20" }), // < 30 Tage
          ko({ id: "alt", createdAt: "2026-01-01" }), // > 90 Tage
        ],
      }),
    );
    expect(p.map((w) => w.days)).toEqual([30, 60, 90]);
    expect(p[0]?.created).toBe(1);
    expect(p[2]?.validated).toBe(1);
  });
});

describe("SCRUM-120: computeSnapshot", () => {
  it("baut alle Abschnitte zusammen", () => {
    const snap = computeSnapshot(
      input({ kos: [ko({ id: "K1" })], busFactor: [bus("Anlage 1", false)] }),
    );
    expect(snap.overview.totalKos).toBe(1);
    expect(snap.capital.parts).toHaveLength(5);
    expect(snap.pilot).toHaveLength(3);
    expect(snap.valuationFacts.validatedKos).toBe(1);
  });
});
