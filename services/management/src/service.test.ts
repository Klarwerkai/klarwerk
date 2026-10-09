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
    const snap = await svc.snapshot({ sichtbar: () => true });

    expect(snap.generatedAt).toBe("2026-06-26T00:00:00.000Z");
    expect(snap.overview.totalKos).toBe(2);
    expect(snap.overview.validated).toBe(1);
    expect(snap.overview.openGaps).toBe(1); // nur "offen" zählt
    expect(snap.overview.openConflicts).toBe(1);
    expect(snap.statement.riskBreakdown.singleSourceCategories).toBe(1);
    expect(snap.statement.riskBreakdown.stale).toBe(1);
    expect(snap.recommendations.some((r) => r.key === "secureSingleSource")).toBe(true);
    // R-0768: Stockwerke je Fachgebiet; ohne angegebenes Fachgebiet ein Stockwerk `domain: null`.
    expect(snap.house[0]).toMatchObject({ domain: null, koCount: 2, validated: 1 });
    expect(snap.houseFlow).toMatchObject({ inHouse: 2, secured: 1, outputReady: 1 });
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
    const snap = await svc.snapshot({ sichtbar: () => true });
    expect(snap.overview.totalKos).toBe(0);
    expect(snap.capital.score).toBe(0);
    expect(Number.isNaN(snap.overview.avgTrust)).toBe(false);
    expect(snap.maturity.stage).toBe(0);
  });

  it("R-0751 (Nacharbeit 1): Konfliktdichte aus dem Konflikt-Eingang, auf den sichtbaren Bestand geschnitten", async () => {
    const repo = new InMemoryKoRepo();
    for (const k of [ko({ id: "K1" }), ko({ id: "K2" }), ko({ id: "GEHEIM" })]) {
      await repo.insert(k);
    }
    const svc = new ManagementService({
      koService: new KoService({ repo }),
      listGaps: async () => [],
      countOpenConflicts: async () => 1,
      // Der Eingang nennt auch ein unsichtbares Objekt — es darf nicht mitzählen.
      openConflictKoIds: async () => ["K1", "GEHEIM"],
      pendingRevalidation: async () => [],
      busFactor: async () => [],
      now: () => Date.parse("2026-06-26T00:00:00Z"),
    });
    const snap = await svc.snapshot({ sichtbar: (k) => k.id !== "GEHEIM" });
    const dichte = snap.priorities[0]?.factors.find((f) => f.key === "conflictDensity");
    expect(dichte?.value).toBe(50); // K1 von K1, K2

    // Gegenprobe: ohne Konflikt-Eingang keine Schätzung.
    const ohne = await makeService([ko({ id: "K1" })]);
    const leer = (await ohne.snapshot({ sichtbar: () => true })).priorities[0];
    expect(leer?.factors.find((f) => f.key === "conflictDensity")?.value).toBeNull();
  });
});
