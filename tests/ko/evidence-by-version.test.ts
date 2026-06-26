import { describe, expect, it } from "vitest";
import type { EvidenceRecord } from "../../apps/web/src/api/types";
import { groupEvidenceByVersion } from "../../apps/web/src/lib/evidenceByVersion";

function rec(overrides: Partial<EvidenceRecord>): EvidenceRecord {
  return {
    id: "ev-1",
    koId: "ko-1",
    koVersion: 1,
    kind: "source",
    label: "Quelle",
    createdBy: "pedi",
    createdAt: "2026-06-26T10:00:00.000Z",
    ...overrides,
  };
}

describe("SCRUM-170: groupEvidenceByVersion", () => {
  it("gruppiert nach koVersion und zählt Kinds je Version", () => {
    const { groups } = groupEvidenceByVersion([
      rec({ id: "a", koVersion: 1, kind: "source" }),
      rec({ id: "b", koVersion: 2, kind: "source" }),
      rec({ id: "c", koVersion: 2, kind: "attachment" }),
    ]);
    expect(groups.map((g) => g.version)).toEqual([2, 1]); // absteigend
    const v2 = groups.find((g) => g.version === 2);
    expect(v2).toMatchObject({ total: 2, sourceCount: 1, attachmentCount: 1 });
    const v1 = groups.find((g) => g.version === 1);
    expect(v1).toMatchObject({ total: 1, sourceCount: 1, attachmentCount: 0 });
  });

  it("sortiert Items je Version jüngste zuerst (mit id-Tiebreak)", () => {
    const { groups } = groupEvidenceByVersion([
      rec({ id: "old", koVersion: 3, createdAt: "2026-06-26T09:00:00.000Z" }),
      rec({ id: "new", koVersion: 3, createdAt: "2026-06-26T12:00:00.000Z" }),
      rec({ id: "mid", koVersion: 3, createdAt: "2026-06-26T10:00:00.000Z" }),
    ]);
    const v3 = groups[0];
    expect(v3?.version).toBe(3);
    expect(v3?.items.map((r) => r.id)).toEqual(["new", "mid", "old"]);
    expect(v3?.latestAt).toBe("2026-06-26T12:00:00.000Z");
  });

  it("leere Evidence → keine Gruppen", () => {
    const res = groupEvidenceByVersion([]);
    expect(res.groups).toEqual([]);
    expect(res.versionsWithoutEvidence).toEqual([]);
  });

  it("markiert bekannte Versionen ohne Evidence (absteigend), wenn versions übergeben werden", () => {
    const { groups, versionsWithoutEvidence } = groupEvidenceByVersion(
      [rec({ id: "a", koVersion: 2 })],
      [{ version: 1 }, { version: 2 }, { version: 3 }],
    );
    expect(groups.map((g) => g.version)).toEqual([2]);
    expect(versionsWithoutEvidence).toEqual([3, 1]);
  });

  it("ohne versions-Argument bleibt versionsWithoutEvidence leer", () => {
    const { versionsWithoutEvidence } = groupEvidenceByVersion([rec({ koVersion: 1 })]);
    expect(versionsWithoutEvidence).toEqual([]);
  });
});
