// Reine, DOM-freie Ableitung für Knowledge Health (SCRUM-141) & Risiko-Cockpit (SCRUM-133).
// Ein Modul für beide — keine doppelte Logik. Alle Werte aus echten Bestandsdaten,
// keine Mock-/Demo-Zahlen. Kein Trend über Zeit (historische Snapshots fehlen).
import type { BusFactorEntry, Conflict, Gap, KnowledgeObject } from "../api/types";

export type HealthBand = "gut" | "mittel" | "kritisch";
export type FactorDirection = "positive" | "negative";

export interface HealthFactor {
  key: string;
  value: number; // Prozent oder Anzahl, je nach Faktor
  unit: "percent" | "count";
  direction: FactorDirection; // wirkt der Faktor förderlich oder belastend?
}

export interface KnowledgeHealth {
  score: number; // 0–100
  band: HealthBand;
  validatedRatio: number; // %
  staleRatio: number; // %
  singleSourceShare: number; // %
  openKos: number;
  openGaps: number;
  openConflicts: number;
  avgTrust: number;
  factors: HealthFactor[];
}

export interface HealthInput {
  kos: readonly KnowledgeObject[];
  gaps: readonly Gap[];
  conflicts: readonly Conflict[];
  pendingRevalidation: readonly string[];
  busFactor: readonly BusFactorEntry[];
}

function pct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

export function bandForScore(score: number): HealthBand {
  if (score >= 70) {
    return "gut";
  }
  if (score >= 40) {
    return "mittel";
  }
  return "kritisch";
}

// SCRUM-141: erklärbarer, deterministischer Health-Score aus echten Signalen.
export function knowledgeHealth(input: HealthInput): KnowledgeHealth {
  const total = input.kos.length;
  const validated = input.kos.filter((k) => k.status === "validiert").length;
  const openKos = input.kos.filter((k) => k.status === "offen").length;
  const openGaps = input.gaps.filter((g) => g.status === "offen").length;
  const openConflicts = input.conflicts.filter((c) => c.status !== "geloest").length;
  const avgTrust =
    total > 0 ? Math.round(input.kos.reduce((s, k) => s + (k.trust ?? 0), 0) / total) : 0;

  const validatedRatio = pct(validated, total);
  const staleRatio = pct(input.pendingRevalidation.length, total);
  const singleSourceCats = input.busFactor.filter((b) => b.singleSource).length;
  const singleSourceShare = pct(singleSourceCats, input.busFactor.length);

  // Basis = Validierungsquote; Abzüge für belastende Signale, geklemmt auf 0–100.
  const penalty =
    staleRatio * 0.4 + // veraltetes/zu revalidierendes Wissen
    singleSourceShare * 0.3 + // Klumpenrisiko Single-Source
    Math.min(20, openGaps * 4) + // offene Wissenslücken
    Math.min(20, openConflicts * 5); // offene Konflikte
  const score = Math.max(0, Math.min(100, Math.round(validatedRatio - penalty)));

  const factors: HealthFactor[] = [
    { key: "validatedRatio", value: validatedRatio, unit: "percent", direction: "positive" },
    { key: "staleRatio", value: staleRatio, unit: "percent", direction: "negative" },
    { key: "singleSourceShare", value: singleSourceShare, unit: "percent", direction: "negative" },
    { key: "openGaps", value: openGaps, unit: "count", direction: "negative" },
    { key: "openConflicts", value: openConflicts, unit: "count", direction: "negative" },
  ];

  return {
    score,
    band: bandForScore(score),
    validatedRatio,
    staleRatio,
    singleSourceShare,
    openKos,
    openGaps,
    openConflicts,
    avgTrust,
    factors,
  };
}

export type RiskLevel = "kritisch" | "mittel" | "gut";

export interface DomainRisk {
  category: string;
  koCount: number;
  validatedRatio: number; // %
  openCount: number;
  authorCount: number;
  singleSource: boolean;
  level: RiskLevel;
}

// SCRUM-133: Risiko je Bereich/Domäne/Kategorie aus KO-Bestand + Bus-Faktor.
export function domainRisk(
  kos: readonly KnowledgeObject[],
  busFactor: readonly BusFactorEntry[],
): DomainRisk[] {
  const busByCat = new Map(busFactor.map((b) => [b.category, b]));
  const cats = new Map<string, KnowledgeObject[]>();
  for (const ko of kos) {
    const list = cats.get(ko.category) ?? [];
    list.push(ko);
    cats.set(ko.category, list);
  }

  const rows: DomainRisk[] = [];
  for (const [category, list] of cats) {
    const koCount = list.length;
    const validated = list.filter((k) => k.status === "validiert").length;
    const validatedRatio = pct(validated, koCount);
    const openCount = list.filter((k) => k.status === "offen").length;
    const bus = busByCat.get(category);
    const singleSource = bus?.singleSource ?? false;
    const authorCount = bus?.authorCount ?? 0;

    // Risikolevel: Single-Source ist der stärkste Treiber, dann niedrige Validierung.
    let level: RiskLevel = "gut";
    if (singleSource || validatedRatio < 40) {
      level = "kritisch";
    } else if (validatedRatio < 70) {
      level = "mittel";
    }

    rows.push({ category, koCount, validatedRatio, openCount, authorCount, singleSource, level });
  }

  const order: Record<RiskLevel, number> = { kritisch: 0, mittel: 1, gut: 2 };
  rows.sort(
    (a, b) =>
      order[a.level] - order[b.level] ||
      b.koCount - a.koCount ||
      a.category.localeCompare(b.category),
  );
  return rows;
}
