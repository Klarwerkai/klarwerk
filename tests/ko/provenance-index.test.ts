import { describe, expect, it } from "vitest";
import type { EvidenceRecord, KnowledgeObject } from "../../apps/web/src/api/types";
import { buildProvenanceIndex } from "../../apps/web/src/lib/provenanceIndex";

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

describe("SCRUM-171: buildProvenanceIndex", () => {
  it("leerer Bestand → Null-Summary, keine Rows", () => {
    const res = buildProvenanceIndex({ kos: [] });
    expect(res.rows).toEqual([]);
    expect(res.summary).toMatchObject({ totalKOs: 0, withTransfer: 0, withEvidence: 0 });
  });

  it("erkennt Autorentransfer (author !== originalAuthor)", () => {
    const res = buildProvenanceIndex({
      kos: [ko({ id: "a", originalAuthor: "u-1", author: "u-2" })],
    });
    expect(res.rows[0]).toMatchObject({ transferred: true });
    expect(res.rows[0]?.warningKinds).toContain("transferred-author");
    expect(res.summary.withTransfer).toBe(1);
  });

  it("erkennt Multi-Version (version > 1 oder history > 1)", () => {
    const res = buildProvenanceIndex({
      kos: [
        ko({ id: "v", version: 3 }),
        ko({
          id: "h",
          version: 1,
          history: [
            { version: 1, at: "x", author: "u-1", note: "a" },
            { version: 2, at: "y", author: "u-1", note: "b" },
          ],
        }),
      ],
    });
    expect(res.summary.multiVersion).toBe(2);
    expect(res.rows.every((r) => r.warningKinds.includes("multi-version"))).toBe(true);
  });

  it("zählt EvidenceCount je koId aus globalem Evidence-Stand", () => {
    const res = buildProvenanceIndex({
      kos: [ko({ id: "a" }), ko({ id: "b" })],
      evidence: [
        ev({ id: "1", koId: "a" }),
        ev({ id: "2", koId: "a" }),
        ev({ id: "3", koId: "b" }),
      ],
    });
    expect(res.rows.find((r) => r.koId === "a")?.evidenceCount).toBe(2);
    expect(res.rows.find((r) => r.koId === "b")?.evidenceCount).toBe(1);
    expect(res.summary.withEvidence).toBe(2);
  });

  it("no-evidence nur wenn Evidence-Stand bekannt UND Quellen/Anhänge ohne Evidence", () => {
    const withSig = ko({
      id: "a",
      sources: [
        {
          id: "s1",
          label: "Q",
          url: null,
          excerpt: null,
          kind: "external",
          peerValidated: false,
          author: "u-1",
          at: "x",
        },
      ],
    });
    // Evidence-Stand bekannt (leeres Array) → no-evidence wird ehrlich gesetzt.
    const known = buildProvenanceIndex({ kos: [withSig], evidence: [] });
    expect(known.rows[0]?.warningKinds).toContain("no-evidence");
    expect(known.summary.withoutEvidence).toBe(1);
    // Evidence-Stand unbekannt (kein evidence-Argument) → keine no-evidence-Behauptung.
    const unknown = buildProvenanceIndex({ kos: [withSig] });
    expect(unknown.rows[0]?.warningKinds).not.toContain("no-evidence");
    expect(unknown.summary.withoutEvidence).toBe(0);
  });

  it("ohne provenance-relevante Signale kein no-evidence (sauberes KO)", () => {
    const res = buildProvenanceIndex({ kos: [ko({ id: "clean" })], evidence: [] });
    expect(res.rows[0]?.warningKinds).toEqual([]);
    expect(res.summary.warningCount).toBe(0);
  });

  it("sortiert deterministisch: meiste Warnungen, dann Version, dann Titel", () => {
    const res = buildProvenanceIndex({
      kos: [
        ko({ id: "clean", title: "ZZZ", version: 1 }),
        ko({ id: "transfer", title: "AAA", originalAuthor: "u-1", author: "u-2", version: 1 }),
        ko({ id: "both", title: "MMM", originalAuthor: "u-1", author: "u-2", version: 4 }),
      ],
    });
    expect(res.rows.map((r) => r.koId)).toEqual(["both", "transfer", "clean"]);
  });
});
