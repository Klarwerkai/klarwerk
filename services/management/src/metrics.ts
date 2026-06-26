// Reine, DOM-freie Management-/Kapital-Metriken (SCRUM-120). Deterministisch, kein NaN
// bei leerem Bestand. Bewusst KEIN Re-Use der FE-Health-Formel (eigene, kapital-
// spezifische Aggregate); minimaler Overlap der Rohquoten ist akzeptiert.
import type { KnowledgeObject } from "../../knowledge-object";
import type {
  Band,
  CapitalScore,
  CategoryPriority,
  HouseFloor,
  KnowledgeStatement,
  ManagementSnapshot,
  Maturity,
  MetricsInput,
  Overview,
  PilotWindow,
  Recommendation,
  ValuationFacts,
} from "./types";

const DAY_MS = 86_400_000;

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function bandForScore(score: number): Band {
  if (score >= 70) {
    return "gut";
  }
  if (score >= 40) {
    return "mittel";
  }
  return "kritisch";
}

function avgTrustOf(kos: readonly KnowledgeObject[]): number {
  return kos.length > 0 ? Math.round(kos.reduce((s, k) => s + (k.trust ?? 0), 0) / kos.length) : 0;
}

function categories(kos: readonly KnowledgeObject[]): Map<string, KnowledgeObject[]> {
  const map = new Map<string, KnowledgeObject[]>();
  for (const ko of kos) {
    const list = map.get(ko.category) ?? [];
    list.push(ko);
    map.set(ko.category, list);
  }
  return map;
}

export function overview(input: MetricsInput, capitalScore: number): Overview {
  const total = input.kos.length;
  const validated = input.kos.filter((k) => k.status === "validiert").length;
  return {
    totalKos: total,
    validated,
    open: total - validated,
    openGaps: input.openGaps,
    openConflicts: input.openConflicts,
    avgTrust: avgTrustOf(input.kos),
    healthScore: capitalScore,
    healthBand: bandForScore(capitalScore),
  };
}

// FE-MGMT-03: erklärbarer Kapital-Score aus gewichteten Teil-Scores (alle 0–100).
export function capitalScore(input: MetricsInput): CapitalScore {
  const total = input.kos.length;
  const validated = input.kos.filter((k) => k.status === "validiert").length;
  const cats = categories(input.kos);
  const catsWithValidated = [...cats.values()].filter((list) =>
    list.some((k) => k.status === "validiert"),
  ).length;
  const singleSourceCats = input.busFactor.filter((b) => b.singleSource).length;

  const validatedRatio = pct(validated, total);
  const avgTrust = avgTrustOf(input.kos);
  const coverage = pct(catsWithValidated, cats.size);
  const singleSourceInv = 100 - pct(singleSourceCats, input.busFactor.length);
  const freshnessInv = 100 - pct(input.pendingRevalidation.length, total);

  const parts = [
    { key: "validatedRatio", value: clamp(validatedRatio), weight: 0.3 },
    { key: "avgTrust", value: clamp(avgTrust), weight: 0.25 },
    { key: "coverage", value: clamp(coverage), weight: 0.15 },
    { key: "singleSourceInv", value: clamp(singleSourceInv), weight: 0.15 },
    { key: "freshnessInv", value: clamp(freshnessInv), weight: 0.15 },
  ];
  const score = total === 0 ? 0 : clamp(parts.reduce((s, p) => s + p.value * p.weight, 0));
  return { score, band: bandForScore(score), parts };
}

export function valuationFacts(input: MetricsInput): ValuationFacts {
  return {
    validatedKos: input.kos.filter((k) => k.status === "validiert").length,
    totalKos: input.kos.length,
    avgTrust: avgTrustOf(input.kos),
  };
}

// FE-MGMT-05: Aktiva (validiert) / Risiken (Single-Source, veraltet, Lücken, Konflikte) / Netto.
export function statement(input: MetricsInput, net: number): KnowledgeStatement {
  const breakdown = {
    singleSourceCategories: input.busFactor.filter((b) => b.singleSource).length,
    stale: input.pendingRevalidation.length,
    openGaps: input.openGaps,
    openConflicts: input.openConflicts,
  };
  const riskItems =
    breakdown.singleSourceCategories +
    breakdown.stale +
    breakdown.openGaps +
    breakdown.openConflicts;
  return {
    assets: input.kos.filter((k) => k.status === "validiert").length,
    riskItems,
    riskBreakdown: breakdown,
    net,
  };
}

// FE-MGMT-06: Reifegrad aus echten Quoten. Stufen 1–5.
const MATURITY_KEYS = ["erfassen", "strukturieren", "validieren", "wiederverwenden", "skalieren"];

export function maturity(input: MetricsInput, capScore: number): Maturity {
  const total = input.kos.length;
  const validated = input.kos.filter((k) => k.status === "validiert").length;
  const validatedRatio = pct(validated, total);
  const singleSourceShare = pct(
    input.busFactor.filter((b) => b.singleSource).length,
    input.busFactor.length,
  );

  let stage = 0;
  if (total > 0) {
    stage = 1;
  }
  if (validated > 0) {
    stage = 2;
  }
  if (validatedRatio >= 40) {
    stage = 3;
  }
  if (validatedRatio >= 70) {
    stage = 4;
  }
  if (validatedRatio >= 85 && singleSourceShare < 30) {
    stage = 5;
  }
  return {
    stage,
    stageKey: stage > 0 ? (MATURITY_KEYS[stage - 1] ?? "erfassen") : "leer",
    progressPct: capScore,
  };
}

// FE-MGMT-09: 9-Faktoren-Dringlichkeit je Kategorie (jeder Faktor 0–100, höher = dringender).
const PRIORITY_WEIGHTS: Record<string, number> = {
  size: 0.1,
  lowValidation: 0.2,
  lowTrust: 0.15,
  singleSource: 0.15,
  authorConcentration: 0.1,
  staleShare: 0.1,
  openShare: 0.1,
  fragility: 0.05,
  coverageGap: 0.05,
};

export function priorities(input: MetricsInput): CategoryPriority[] {
  const cats = categories(input.kos);
  const maxCount = Math.max(1, ...[...cats.values()].map((l) => l.length));
  const busByCat = new Map(input.busFactor.map((b) => [b.category, b]));
  const pendingSet = new Set(input.pendingRevalidation);

  const rows: CategoryPriority[] = [];
  for (const [category, list] of cats) {
    const validated = list.filter((k) => k.status === "validiert").length;
    const open = list.length - validated;
    const validatedRatio = pct(validated, list.length);
    const avgTrust = avgTrustOf(list);
    const bus = busByCat.get(category);
    const authorCount = bus?.authorCount ?? 1;
    const stale = list.filter((k) => pendingSet.has(k.id)).length;

    const factors = [
      { key: "size", value: clamp((list.length / maxCount) * 100) },
      { key: "lowValidation", value: clamp(100 - validatedRatio) },
      { key: "lowTrust", value: clamp(100 - avgTrust) },
      { key: "singleSource", value: bus?.singleSource ? 100 : 0 },
      { key: "authorConcentration", value: clamp(100 / Math.max(1, authorCount)) },
      { key: "staleShare", value: clamp(pct(stale, list.length)) },
      { key: "openShare", value: clamp(pct(open, list.length)) },
      { key: "fragility", value: validatedRatio < 50 ? 100 : 0 },
      { key: "coverageGap", value: validated === 0 ? 100 : 0 },
    ];
    const score = clamp(factors.reduce((s, f) => s + f.value * (PRIORITY_WEIGHTS[f.key] ?? 0), 0));
    rows.push({ category, score, factors });
  }
  rows.sort((a, b) => b.score - a.score || a.category.localeCompare(b.category));
  return rows;
}

// FE-MGMT-07: Handlungsempfehlungen deterministisch aus den schlechtesten Signalen.
export function recommendations(input: MetricsInput): Recommendation[] {
  const total = input.kos.length;
  const validated = input.kos.filter((k) => k.status === "validiert").length;
  const singleSourceCats = input.busFactor.filter((b) => b.singleSource).length;
  const out: Recommendation[] = [];
  const add = (key: string, count: number, highAt: number): void => {
    if (count > 0) {
      out.push({ key, severity: count >= highAt ? "hoch" : "mittel", count });
    }
  };
  add("secureSingleSource", singleSourceCats, 2);
  add("revalidate", input.pendingRevalidation.length, 3);
  add("closeGaps", input.openGaps, 3);
  add("resolveConflicts", input.openConflicts, 1);
  add("validateBacklog", total > 0 && pct(validated, total) < 50 ? total - validated : 0, 5);
  out.sort((a, b) => b.count - a.count);
  return out;
}

// FE-MGMT-08: Knowledge House — Domänen als Stockwerke (gesichert vs. fragil).
export function house(input: MetricsInput): HouseFloor[] {
  const cats = categories(input.kos);
  const busByCat = new Map(input.busFactor.map((b) => [b.category, b]));
  const rows: HouseFloor[] = [];
  for (const [category, list] of cats) {
    const validated = list.filter((k) => k.status === "validiert").length;
    const validatedRatio = pct(validated, list.length);
    const singleSource = busByCat.get(category)?.singleSource ?? false;
    rows.push({
      category,
      koCount: list.length,
      validatedRatio,
      fragile: validatedRatio < 50 || singleSource,
    });
  }
  rows.sort((a, b) => b.koCount - a.koCount || a.category.localeCompare(b.category));
  return rows;
}

// FE-MGMT-02: Pilot 30/60/90 — echte Zähler je Fenster aus createdAt.
export function pilot(input: MetricsInput): PilotWindow[] {
  return [30, 60, 90].map((days) => {
    const cutoff = input.now - days * DAY_MS;
    const inWindow = input.kos.filter((k) => Date.parse(k.createdAt) >= cutoff);
    return {
      days,
      created: inWindow.length,
      validated: inWindow.filter((k) => k.status === "validiert").length,
    };
  });
}

export function computeSnapshot(input: MetricsInput): Omit<ManagementSnapshot, "generatedAt"> {
  const capital = capitalScore(input);
  return {
    overview: overview(input, capital.score),
    capital,
    valuationFacts: valuationFacts(input),
    statement: statement(input, capital.score),
    maturity: maturity(input, capital.score),
    priorities: priorities(input),
    recommendations: recommendations(input),
    house: house(input),
    pilot: pilot(input),
  };
}
