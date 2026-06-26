import { describe, expect, it } from "vitest";
import type { EvidenceRecord, KnowledgeObject } from "../../apps/web/src/api/types";
import { analyzeEvidenceFreshness } from "../../apps/web/src/lib/evidenceFreshness";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko-1",
    title: "KO Eins",
    statement: "S",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 50,
    trust: 50,
    status: "validiert",
    version: 1,
    originalAuthor: "u-1",
    author: "u-1",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-06-26T10:00:00.000Z",
    history: [],
    ...overrides,
  };
}

function ev(overrides: Partial<EvidenceRecord>): EvidenceRecord {
  return {
    id: "ev-1",
    koId: "ko-1",
    koVersion: 1,
    kind: "source",
    label: "Quelle",
    createdBy: "u-1",
    createdAt: "2026-06-26T10:00:00.000Z",
    ...overrides,
  };
}

const source = (id: string): NonNullable<KnowledgeObject["sources"]>[number] => ({
  id,
  label: "Q",
  url: null,
  excerpt: null,
  kind: "external",
  peerValidated: false,
  author: "u-1",
  at: "x",
});

const attachment = (
  id: string,
  extra: Partial<NonNullable<KnowledgeObject["attachments"]>[number]>,
): NonNullable<KnowledgeObject["attachments"]>[number] => ({
  id,
  name: "Datei",
  mime: "image/jpeg",
  author: "u-1",
  at: "x",
  ...extra,
});

describe("SCRUM-174: analyzeEvidenceFreshness", () => {
  it("aktuelle Version hat Evidence → current/ok", () => {
    const res = analyzeEvidenceFreshness({
      kos: [ko({ id: "a", version: 2, sources: [source("s1")] })],
      evidence: [ev({ id: "e", koId: "a", koVersion: 2 })],
    });
    expect(res.rows[0]).toMatchObject({ status: "current", currentCount: 1, olderCount: 0 });
    expect(res.summary.current).toBe(1);
  });

  it("nur ältere Version hat Evidence → outdated", () => {
    const res = analyzeEvidenceFreshness({
      kos: [ko({ id: "a", version: 3, sources: [source("s1")] })],
      evidence: [ev({ id: "e", koId: "a", koVersion: 1 })],
    });
    expect(res.rows[0]).toMatchObject({ status: "outdated", currentCount: 0, olderCount: 1 });
    expect(res.summary.outdated).toBe(1);
  });

  it("Quelle ohne Evidence → missing", () => {
    const res = analyzeEvidenceFreshness({
      kos: [ko({ id: "a", version: 1, sources: [source("s1")] })],
      evidence: [],
    });
    expect(res.rows[0]).toMatchObject({ status: "missing", expectsEvidence: true });
  });

  it("Object-Anhang ohne Evidence → missing", () => {
    const res = analyzeEvidenceFreshness({
      kos: [ko({ id: "a", attachments: [attachment("a1", { objectId: "obj-1" })] })],
      evidence: [],
    });
    expect(res.rows[0]).toMatchObject({ status: "missing", objectAttachmentCount: 1 });
  });

  it("Legacy-dataUrl-Anhang ohne objectId → neutral (kein Evidence-Anlass)", () => {
    const res = analyzeEvidenceFreshness({
      kos: [
        ko({ id: "a", attachments: [attachment("a1", { dataUrl: "data:image/png;base64,AA" })] }),
      ],
      evidence: [],
    });
    expect(res.rows[0]).toMatchObject({
      status: "neutral",
      expectsEvidence: false,
      objectAttachmentCount: 0,
    });
  });

  it("KO ohne Quellen/Anhänge → neutral", () => {
    const res = analyzeEvidenceFreshness({ kos: [ko({ id: "a" })], evidence: [] });
    expect(res.rows[0]?.status).toBe("neutral");
    expect(res.summary.neutral).toBe(1);
  });

  it("sortiert deterministisch: outdated < missing < current < neutral", () => {
    const res = analyzeEvidenceFreshness({
      kos: [
        ko({ id: "neutral", title: "N", version: 1 }),
        ko({ id: "current", title: "C", version: 1, sources: [source("s1")] }),
        ko({ id: "missing", title: "M", version: 1, sources: [source("s2")] }),
        ko({ id: "outdated", title: "O", version: 2, sources: [source("s3")] }),
      ],
      evidence: [
        ev({ id: "c", koId: "current", koVersion: 1 }),
        ev({ id: "o", koId: "outdated", koVersion: 1 }),
      ],
    });
    expect(res.rows.map((r) => r.koId)).toEqual(["outdated", "missing", "current", "neutral"]);
  });
});
