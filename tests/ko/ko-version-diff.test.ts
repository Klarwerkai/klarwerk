import { describe, expect, it } from "vitest";
import type { KnowledgeObject, KoVersionSnapshot } from "../../apps/web/src/api/types";
import { diffForVersion, versionDiffs } from "../../apps/web/src/lib/koVersionDiff";

function ko(version: number, overrides: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Original",
    statement: "Aussage",
    conditions: ["Bedingung"],
    measures: ["Maßnahme"],
    type: "technik",
    category: "Instandhaltung",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version,
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

function snap(version: number, overrides: Partial<KnowledgeObject> = {}): KoVersionSnapshot {
  return {
    koId: "ko-1",
    version,
    snapshot: ko(version, overrides),
    at: `2026-06-26T10:0${version}:00.000Z`,
    author: "pedi",
    note: version === 1 ? "erstellt" : "überarbeitet",
  };
}

describe("versionDiffs", () => {
  it("liefert für die erste Version keinen Fake-Diff", () => {
    expect(versionDiffs([snap(1)])).toEqual([{ fromVersion: null, toVersion: 1, changed: [] }]);
  });

  it("vergleicht jede Version mit dem direkten Vorgänger", () => {
    const diffs = versionDiffs([
      snap(2, { title: "Neu", statement: "Aussage" }),
      snap(1),
      snap(3, { title: "Neu", statement: "Andere Aussage", status: "validiert" }),
    ]);
    expect(diffs).toEqual([
      { fromVersion: null, toVersion: 1, changed: [] },
      { fromVersion: 1, toVersion: 2, changed: ["title"] },
      { fromVersion: 2, toVersion: 3, changed: ["statement", "status"] },
    ]);
  });

  it("erkennt Array-Feldänderungen normalisiert", () => {
    expect(
      diffForVersion([snap(1), snap(2, { conditions: ["Bedingung", "Neu"] })], 2)?.changed,
    ).toEqual(["conditions"]);
  });
});
