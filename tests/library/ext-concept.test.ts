import { describe, expect, it } from "vitest";
import type { Conflict, ImportCandidate, KnowledgeObject } from "../../apps/web/src/api/types";
import {
  IMPORT_PIPELINE_STEPS,
  candidateFindings,
  summarizeImportQueue,
  validityProtectionView,
} from "../../apps/web/src/lib/extConcept";

function candidate(over: Partial<ImportCandidate> = {}): ImportCandidate {
  return {
    id: "c1",
    item: { title: "T", statement: "S", type: "best_practice", category: "Anlage 1" },
    status: "neu",
    duplicate: false,
    note: null,
    koId: null,
    createdAt: "2026-06-26T00:00:00.000Z",
    ...over,
  };
}

const ko = (over: Partial<KnowledgeObject> = {}): Pick<KnowledgeObject, "id" | "status"> => ({
  id: "ko1",
  status: "offen",
  ...over,
});

const conflict = (over: Partial<Conflict> = {}): Conflict => ({
  id: "x1",
  koA: "ko1",
  koB: "ko2",
  type: "truth",
  description: "",
  status: "offen",
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  createdAt: "2026-06-26T00:00:00.000Z",
  ...over,
});

describe("SCRUM-90: Import-Pipeline", () => {
  it("Schritte in konzeptioneller Reihenfolge", () => {
    expect([...IMPORT_PIPELINE_STEPS]).toEqual([
      "upload",
      "extract",
      "structure",
      "review",
      "validate",
      "release",
      "reuse",
    ]);
  });
});

describe("SCRUM-91: Queue-Summary + Candidate-Findings", () => {
  it("summarizeImportQueue zählt Status + Dubletten", () => {
    const s = summarizeImportQueue([
      candidate({ id: "a", status: "neu" }),
      candidate({ id: "b", status: "angenommen", koId: "ko9" }),
      candidate({ id: "c", status: "abgelehnt" }),
      candidate({ id: "d", status: "info-angefragt" }),
      candidate({ id: "e", status: "neu", duplicate: true }),
    ]);
    expect(s).toEqual({
      total: 5,
      duplicates: 1,
      accepted: 1,
      rejected: 1,
      infoRequested: 1,
      open: 2,
    });
  });

  it("candidateFindings leitet Badges ehrlich ab", () => {
    expect(candidateFindings(candidate({ status: "angenommen", koId: "ko9" }))).toMatchObject({
      acceptedKo: true,
      rejected: false,
    });
    expect(candidateFindings(candidate({ duplicate: true }))).toMatchObject({ duplicate: true });
    expect(
      candidateFindings(
        candidate({ item: { title: "", statement: "S", type: "best_practice", category: "" } }),
      ).missingInfo,
    ).toBe(true);
    expect(candidateFindings(candidate({ status: "info-angefragt" })).infoRequested).toBe(true);
  });
});

describe("SCRUM-95/96: Validity & Protection", () => {
  it("validiert → outputEligible true + freshness validiert", () => {
    const v = validityProtectionView(ko({ status: "validiert" }), [], []);
    expect(v.freshnessStatus).toBe("validiert");
    expect(v.outputEligible).toBe(true);
    expect(v.recommendation).toBe("output-ready");
    expect(v.ipSensitivity).toBe("nicht-bewertet");
  });

  it("pending → revalidierung-faellig", () => {
    const v = validityProtectionView(ko({ status: "validiert" }), ["ko1"], []);
    expect(v.freshnessStatus).toBe("revalidierung-faellig");
    expect(v.recommendation).toBe("start-revalidation");
  });

  it("Konflikt → konflikt (hat Vorrang)", () => {
    const v = validityProtectionView(ko({ status: "offen" }), ["ko1"], [conflict()]);
    expect(v.freshnessStatus).toBe("konflikt");
    expect(v.recommendation).toBe("clarify-conflict");
  });

  it("gelöster Konflikt zählt nicht", () => {
    const v = validityProtectionView(
      ko({ status: "offen" }),
      [],
      [conflict({ status: "geloest" })],
    );
    expect(v.freshnessStatus).toBe("offen");
  });

  it("offen → outputEligible false + finish-validation", () => {
    const v = validityProtectionView(ko({ status: "offen" }), [], []);
    expect(v.outputEligible).toBe(false);
    expect(v.recommendation).toBe("finish-validation");
  });
});
