import { describe, expect, it } from "vitest";
import type { EvidenceRecord } from "../../apps/web/src/api/types";
import {
  evidenceKindTone,
  limitEvidence,
  summarizeEvidence,
} from "../../apps/web/src/lib/evidenceIndex";

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

describe("SCRUM-169: evidenceIndex helpers", () => {
  it("summarizeEvidence zählt Kinds, Provider/URL/Object und distinkte KOs", () => {
    const s = summarizeEvidence([
      rec({ id: "a", koId: "ko-1", kind: "source", provider: "Wikipedia", url: "https://x" }),
      rec({ id: "b", koId: "ko-1", kind: "attachment", objectId: "obj-1", mime: "image/jpeg" }),
      rec({ id: "c", koId: "ko-2", kind: "source" }),
    ]);
    expect(s).toMatchObject({
      total: 3,
      sources: 2,
      attachments: 1,
      withProvider: 1,
      withUrl: 1,
      withObject: 1,
      distinctKos: 2,
    });
  });

  it("leere Liste → Nullwerte", () => {
    expect(summarizeEvidence([])).toMatchObject({
      total: 0,
      sources: 0,
      attachments: 0,
      distinctKos: 0,
    });
  });

  it("evidenceKindTone leitet den Ton aus dem Kind ab", () => {
    expect(evidenceKindTone(rec({ kind: "source" }))).toBe("source");
    expect(evidenceKindTone(rec({ kind: "attachment" }))).toBe("attachment");
  });

  it("limitEvidence kappt defensiv", () => {
    const list = [rec({ id: "a" }), rec({ id: "b" }), rec({ id: "c" })];
    expect(limitEvidence(list, 2).map((r) => r.id)).toEqual(["a", "b"]);
    expect(limitEvidence(list, 0)).toHaveLength(0);
    expect(limitEvidence(list, -1)).toHaveLength(0);
  });
});
