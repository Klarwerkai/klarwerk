import { describe, expect, it } from "vitest";
import type { KnowledgeObject, KoVersionSnapshot } from "../../apps/web/src/api/types";
import { koVersionRows, snapshotExcerpt } from "../../apps/web/src/lib/koVersionSnapshots";

function ko(overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Original",
    statement: "Eine sehr klare Aussage.",
    conditions: [],
    measures: [],
    type: "technik",
    category: "Instandhaltung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "pedi",
    author: "pedi",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-06-26T10:00:00.000Z",
    history: [],
    ...overrides,
  };
}

function snap(version: number, title: string): KoVersionSnapshot {
  return {
    koId: "ko-1",
    version,
    snapshot: ko({ title, statement: `${title} Aussage`, version }),
    at: `2026-06-26T10:0${version}:00.000Z`,
    author: version === 1 ? "pedi" : "carla",
    note: version === 1 ? "erstellt" : "überarbeitet",
  };
}

describe("koVersionRows", () => {
  it("sortiert Snapshots absteigend nach Version und baut stabile Anzeigezeilen", () => {
    const rows = koVersionRows([snap(1, "V1"), snap(3, "V3"), snap(2, "V2")]);
    expect(rows.map((r) => r.version)).toEqual([3, 2, 1]);
    expect(rows[0]).toMatchObject({
      key: "ko-1:3",
      title: "V3",
      author: "carla",
      note: "überarbeitet",
      status: "offen",
    });
  });

  it("kürzt lange Aussagen ehrlich", () => {
    expect(snapshotExcerpt("A  B\nC", 20)).toBe("A B C");
    expect(snapshotExcerpt("1234567890", 6)).toBe("12345…");
  });
});
