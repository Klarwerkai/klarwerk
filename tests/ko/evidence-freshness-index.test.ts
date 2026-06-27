import { describe, expect, it } from "vitest";
import type { EvidenceRecord, KnowledgeObject } from "../../apps/web/src/api/types";
import { buildEvidenceFreshnessIndex } from "../../apps/web/src/lib/evidenceFreshnessIndex";

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

describe("SCRUM-176: buildEvidenceFreshnessIndex", () => {
  it("affected enthält nur outdated/missing, Summary bleibt vollständig", () => {
    const res = buildEvidenceFreshnessIndex({
      kos: [
        ko({ id: "current", version: 1, sources: [source("s1")] }),
        ko({ id: "neutral", version: 1 }),
        ko({ id: "outdated", version: 2, sources: [source("s2")] }),
        ko({ id: "missing", version: 1, sources: [source("s3")] }),
      ],
      evidence: [
        ev({ id: "c", koId: "current", koVersion: 1 }),
        ev({ id: "o", koId: "outdated", koVersion: 1 }),
      ],
    });
    expect(res.affected.map((r) => r.koId)).toEqual(["outdated", "missing"]);
    expect(res.summary).toMatchObject({ current: 1, neutral: 1, outdated: 1, missing: 1 });
    expect(res.affectedTotal).toBe(2);
  });

  it("leerer/sauberer Bestand → keine affected, affectedTotal 0", () => {
    const res = buildEvidenceFreshnessIndex({
      kos: [ko({ id: "current", sources: [source("s1")] })],
      evidence: [ev({ id: "c", koId: "current", koVersion: 1 })],
    });
    expect(res.affected).toEqual([]);
    expect(res.affectedTotal).toBe(0);
  });

  it("deterministische Sortierung: outdated vor missing", () => {
    const res = buildEvidenceFreshnessIndex({
      kos: [
        ko({ id: "missing", title: "A", version: 1, sources: [source("s1")] }),
        ko({ id: "outdated", title: "Z", version: 2, sources: [source("s2")] }),
      ],
      evidence: [ev({ id: "o", koId: "outdated", koVersion: 1 })],
    });
    expect(res.affected.map((r) => r.koId)).toEqual(["outdated", "missing"]);
  });

  it("Limit kappt die affected-Liste, affectedTotal bleibt ungekürzt", () => {
    const kos = Array.from({ length: 5 }, (_, i) =>
      ko({ id: `m${i}`, title: `M${i}`, version: 1, sources: [source(`s${i}`)] }),
    );
    const res = buildEvidenceFreshnessIndex({ kos, evidence: [] }, 2);
    expect(res.affected).toHaveLength(2);
    expect(res.affectedTotal).toBe(5);
    expect(res.summary.missing).toBe(5);
  });
});
