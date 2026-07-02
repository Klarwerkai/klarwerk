import { describe, expect, it } from "vitest";
import type { ReasonerConfigStatus } from "../../apps/web/src/api/types";
import type { EvidenceFreshnessResult } from "../../apps/web/src/lib/evidenceFreshness";
import type { EvidenceIndexSummary } from "../../apps/web/src/lib/evidenceIndex";
import type { HealthBand, KnowledgeHealth } from "../../apps/web/src/lib/knowledgeHealth";
import { buildKnowledgeOsHints } from "../../apps/web/src/lib/knowledgeOsHints";
import type { ModelRunSummary } from "../../apps/web/src/lib/modelRuns";
import type { ProvenanceIndexResult } from "../../apps/web/src/lib/provenanceIndex";

function modelRuns(overrides: Partial<ModelRunSummary>): ModelRunSummary {
  return {
    total: 10,
    success: 10,
    errors: 0,
    fallbacks: 0,
    demo: 0,
    byTask: { structure: 0, assist: 0, interview: 0, answer: 0, select: 0 },
    ...overrides,
  };
}

function provenance(overrides: Partial<ProvenanceIndexResult["summary"]>): ProvenanceIndexResult {
  return {
    rows: [],
    summary: {
      totalKOs: 5,
      withTransfer: 0,
      withSources: 0,
      withAttachments: 0,
      withEvidence: 0,
      withoutEvidence: 0,
      multiVersion: 0,
      warningCount: 0,
      ...overrides,
    },
  };
}

function reasoner(mode: ReasonerConfigStatus["mode"]): ReasonerConfigStatus {
  return {
    provider: "deterministic",
    configured: mode === "model",
    mode,
    fallbackAvailable: true,
    taskConfig: { global: "auto", perTask: {} },
    effective: {
      structure: "model",
      assist: "model",
      interview: "model",
      answer: "model",
      select: "model",
    },
    persisted: false,
    supportsLocales: ["de", "en"],
    tasks: ["structure", "assist", "interview", "answer", "select"],
  };
}

const evidence = (total: number): EvidenceIndexSummary => ({
  total,
  sources: 0,
  attachments: 0,
  withProvider: 0,
  withUrl: 0,
  withObject: 0,
  distinctKos: 0,
});

function freshness(
  overrides: Partial<EvidenceFreshnessResult["summary"]>,
): EvidenceFreshnessResult {
  return {
    rows: [],
    summary: { total: 0, current: 0, outdated: 0, missing: 0, neutral: 0, ...overrides },
  };
}

function health(band: HealthBand): KnowledgeHealth {
  const score = band === "gut" ? 85 : band === "mittel" ? 55 : 20;
  return {
    score,
    band,
    validatedRatio: 80,
    staleRatio: 0,
    singleSourceShare: 0,
    openKos: 0,
    openGaps: 0,
    openConflicts: 0,
    avgTrust: 70,
    factors: [],
  };
}

describe("SCRUM-172: buildKnowledgeOsHints", () => {
  it("leerer Input → keine Fehler, alle Kernsignale unknown, keine ok-Behauptung", () => {
    const res = buildKnowledgeOsHints({});
    expect(res.hints).toEqual([]);
    expect(res.summary).toMatchObject({ total: 0, critical: 0, warnings: 0 });
    expect(res.unknownSources.sort()).toEqual([
      "evidence",
      "evidenceFreshness",
      "health",
      "modelRuns",
      "provenance",
      "reasonerConfig",
    ]);
  });

  it("alles bekannt & sauber (inkl. Health & Freshness) → genau ein ok-Hinweis", () => {
    const res = buildKnowledgeOsHints({
      modelRunSummary: modelRuns({}),
      reasonerConfig: reasoner("model"),
      provenance: provenance({}),
      evidenceSummary: evidence(3),
      evidenceFreshness: freshness({ current: 3 }),
      knowledgeHealth: health("gut"),
    });
    expect(res.hints).toHaveLength(1);
    expect(res.hints[0]).toMatchObject({ id: "all-clear", severity: "ok" });
    expect(res.unknownSources).toEqual([]);
  });

  it("ModelRun-Fehler → critical und ganz oben", () => {
    const res = buildKnowledgeOsHints({
      modelRunSummary: modelRuns({ errors: 2, fallbacks: 1 }),
      reasonerConfig: reasoner("demo"),
      provenance: provenance({ withoutEvidence: 4 }),
      evidenceSummary: evidence(5),
    });
    expect(res.hints[0]).toMatchObject({ id: "modelrun-errors", severity: "critical", count: 2 });
    expect(res.summary.critical).toBe(1);
    // danach Warnungen (reasoner-demo, fallbacks, no-evidence)
    expect(res.hints.slice(1, 4).map((h) => h.severity)).toEqual(["warning", "warning", "warning"]);
  });

  it("Reasoner demo/fallback erzeugt Warnung", () => {
    const res = buildKnowledgeOsHints({ reasonerConfig: reasoner("fallback") });
    expect(res.hints.some((h) => h.id === "reasoner-demo" && h.severity === "warning")).toBe(true);
  });

  it("Provenance no-evidence (warning) und lineage (info) werden korrekt priorisiert", () => {
    const res = buildKnowledgeOsHints({
      provenance: provenance({ withoutEvidence: 2, withTransfer: 1, multiVersion: 3 }),
    });
    const ids = res.hints.map((h) => h.id);
    expect(ids).toEqual(["provenance-no-evidence", "provenance-lineage"]);
    expect(res.hints[0]?.severity).toBe("warning");
    expect(res.hints[1]).toMatchObject({ severity: "info", count: 4 });
  });

  it("unknown-Daten werden nicht als Fehler gezählt", () => {
    const res = buildKnowledgeOsHints({ reasonerConfig: reasoner("model") });
    expect(res.summary.critical).toBe(0);
    expect(res.summary.warnings).toBe(0);
    expect(res.unknownSources).toContain("modelRuns");
    expect(res.unknownSources).toContain("provenance");
  });

  it("Severity-Sortierung deterministisch: critical < warning < info < ok", () => {
    const res = buildKnowledgeOsHints({
      modelRunSummary: modelRuns({ errors: 1, fallbacks: 1 }),
      provenance: provenance({ withoutEvidence: 1, multiVersion: 2 }),
      evidenceSummary: evidence(9),
      reasonerConfig: reasoner("model"),
    });
    const ranks = res.hints.map((h) => h.severity);
    const order = { critical: 0, warning: 1, info: 2, ok: 3 } as const;
    const numeric = ranks.map((r) => order[r]);
    expect(numeric).toEqual([...numeric].sort((a, b) => a - b));
  });

  // SCRUM-173: KnowledgeHealth in die Hinweise integriert.
  it("Health kritisch → critical-Hinweis", () => {
    const res = buildKnowledgeOsHints({ knowledgeHealth: health("kritisch") });
    const hint = res.hints.find((h) => h.id === "health-critical");
    expect(hint).toMatchObject({ severity: "critical", count: 20, source: "health" });
    expect(res.unknownSources).not.toContain("health");
  });

  it("Health mittel → warning-Hinweis", () => {
    const res = buildKnowledgeOsHints({ knowledgeHealth: health("mittel") });
    const hint = res.hints.find((h) => h.id === "health-mittel");
    expect(hint).toMatchObject({ severity: "warning", count: 55, source: "health" });
  });

  it("Health gut → kein falscher Warnhinweis", () => {
    const res = buildKnowledgeOsHints({ knowledgeHealth: health("gut") });
    expect(res.hints.some((h) => h.source === "health")).toBe(false);
    expect(res.summary.critical).toBe(0);
    expect(res.summary.warnings).toBe(0);
  });

  it("Health bleibt nur unknown, wenn keine Health-Daten übergeben werden", () => {
    expect(buildKnowledgeOsHints({}).unknownSources).toContain("health");
    expect(buildKnowledgeOsHints({ knowledgeHealth: health("gut") }).unknownSources).not.toContain(
      "health",
    );
  });

  // SCRUM-174: Evidence-Freshness in die Hinweise integriert.
  it("Freshness outdated → warning-Hinweis", () => {
    const res = buildKnowledgeOsHints({ evidenceFreshness: freshness({ outdated: 2 }) });
    const hint = res.hints.find((h) => h.id === "evidence-outdated");
    expect(hint).toMatchObject({ severity: "warning", count: 2, source: "evidenceFreshness" });
    expect(res.unknownSources).not.toContain("evidenceFreshness");
  });

  it("Freshness missing → warning-Hinweis", () => {
    const res = buildKnowledgeOsHints({ evidenceFreshness: freshness({ missing: 3 }) });
    const hint = res.hints.find((h) => h.id === "evidence-missing");
    expect(hint).toMatchObject({ severity: "warning", count: 3, source: "evidenceFreshness" });
  });

  it("Freshness sauber (nur current/neutral) → kein falscher Warnhinweis", () => {
    const res = buildKnowledgeOsHints({ evidenceFreshness: freshness({ current: 4, neutral: 2 }) });
    expect(res.hints.some((h) => h.source === "evidenceFreshness")).toBe(false);
    expect(res.summary.warnings).toBe(0);
  });

  it("Freshness bleibt nur unknown, wenn nicht übergeben", () => {
    expect(buildKnowledgeOsHints({}).unknownSources).toContain("evidenceFreshness");
    expect(
      buildKnowledgeOsHints({ evidenceFreshness: freshness({ current: 1 }) }).unknownSources,
    ).not.toContain("evidenceFreshness");
  });
});
