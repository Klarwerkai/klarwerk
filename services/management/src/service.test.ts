import { describe, expect, it } from "vitest";
import { InMemoryKoRepo, type KnowledgeObject, KoService } from "../../knowledge-object";
import { ManagementService } from "./service";

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

async function makeService(kos: KnowledgeObject[]) {
  const repo = new InMemoryKoRepo();
  for (const k of kos) {
    await repo.insert(k);
  }
  return new ManagementService({
    koService: new KoService({ repo }),
    listGaps: async () => [{ status: "offen" }, { status: "geschlossen" }],
    countOpenConflicts: async () => 1,
    pendingRevalidation: async () => ["K2"],
    busFactor: async () => [
      { category: "Anlage 1", authorCount: 1, koCount: 2, singleSource: true },
    ],
    now: () => Date.parse("2026-06-26T00:00:00Z"),
  });
}

describe("ManagementService (SCRUM-120)", () => {
  it("baut einen Snapshot aus echten Service-Daten", async () => {
    const svc = await makeService([ko({ id: "K1" }), ko({ id: "K2", status: "offen", trust: 40 })]);
    const snap = await svc.snapshot();

    expect(snap.generatedAt).toBe("2026-06-26T00:00:00.000Z");
    expect(snap.overview.totalKos).toBe(2);
    expect(snap.overview.validated).toBe(1);
    expect(snap.overview.openGaps).toBe(1); // nur "offen" zählt
    expect(snap.overview.openConflicts).toBe(1);
    expect(snap.statement.riskBreakdown.singleSourceCategories).toBe(1);
    expect(snap.statement.riskBreakdown.stale).toBe(1);
    expect(snap.recommendations.some((r) => r.key === "secureSingleSource")).toBe(true);
    expect(snap.house[0]?.category).toBe("Anlage 1");
  });

  it("leerer Bestand → sicherer Snapshot (kein NaN, Score 0)", async () => {
    const svc = new ManagementService({
      koService: new KoService({ repo: new InMemoryKoRepo() }),
      listGaps: async () => [],
      countOpenConflicts: async () => 0,
      pendingRevalidation: async () => [],
      busFactor: async () => [],
      now: () => Date.parse("2026-06-26T00:00:00Z"),
    });
    const snap = await svc.snapshot();
    expect(snap.overview.totalKos).toBe(0);
    expect(snap.capital.score).toBe(0);
    expect(Number.isNaN(snap.overview.avgTrust)).toBe(false);
    expect(snap.maturity.stage).toBe(0);
  });
});
