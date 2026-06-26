import { describe, expect, it } from "vitest";
import type { EvidenceRecord } from "../../apps/web/src/api/types";
import { evidenceKindLabel, evidenceRows } from "../../apps/web/src/lib/koEvidence";

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

describe("koEvidence", () => {
  it("sortiert Evidence neueste zuerst und baut Metadaten ehrlich", () => {
    const rows = evidenceRows([
      rec({ id: "old", createdAt: "2026-06-26T10:00:00.000Z" }),
      rec({
        id: "new",
        kind: "attachment",
        label: "Foto",
        koVersion: 2,
        mime: "image/jpeg",
        objectId: "obj-1",
        createdAt: "2026-06-26T11:00:00.000Z",
      }),
    ]);
    expect(rows.map((r) => r.key)).toEqual(["new", "old"]);
    expect(rows[0]).toMatchObject({
      kind: "attachment",
      title: "Foto",
      meta: ["v2", "image/jpeg", "object:obj-1"],
    });
  });

  it("liefert stabile Kind-Labels", () => {
    expect(evidenceKindLabel("source")).toBe("source");
    expect(evidenceKindLabel("attachment")).toBe("attachment");
  });
});
