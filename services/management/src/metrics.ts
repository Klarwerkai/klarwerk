// Reine, DOM-freie Management-/Kapital-Metriken (SCRUM-120). Deterministisch, kein NaN
// bei leerem Bestand. Bewusst KEIN Re-Use der FE-Health-Formel (eigene, kapital-
// spezifische Aggregate); minimaler Overlap der Rohquoten ist akzeptiert.
import type { KnowledgeObject } from "../../knowledge-object";
import { ASSESSMENT_VALUE, type AssessmentLevel } from "./profiles";
import type {
  Band,
  CapitalScore,
  CategoryPriority,
  HouseFloor,
  HouseFlow,
  KnowledgeStatement,
  ManagementSnapshot,
  Maturity,
  MetricsInput,
  Overview,
  PilotWindow,
  PriorityFactorKey,
  PriorityFlag,
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

// ================================================================================================
// FE-MGMT-09 / FR-EXT-04 / R-0751 (Nacharbeit 1, ben F2) — DIE NEUN FAKTOREN DER QUELLE.
// ================================================================================================
//
// Bis zur Nacharbeit rechnete diese Funktion neun ANDERE Größen (size, lowValidation, …). Jetzt
// steht jeder Faktor der Quelle für sich (jeder 0–100, höher = dringender zu sichern):
//
//   busFactor        100 / Zahl der Urheber der Kategorie (Bus-Faktor 1 ⇒ 100)
//   criticality      gepflegte Stufe im Bereichsprofil (Nacharbeit 3): niedrig 0, mittel 50, hoch 100
//   processProximity gepflegte Stufe im Bereichsprofil (Nacharbeit 3)
//   age              mittleres Alter seit `createdAt`, 730 Tage und älter ⇒ 100
//   sourceQuality    Mittel aus (100 − mittleres Vertrauen) und Anteil Objekte ohne Quelle
//   conflictDensity  Anteil Objekte an einem offenen sichtbaren Konflikt (fehlt die Angabe ⇒ keine Daten)
//   repetition       gepflegte Stufe im Bereichsprofil (Nacharbeit 3) — Lücken zählen zwar ihre
//                    Häufigkeit, tragen aber keine Kategorie; deshalb eingeschätzt, nicht abgeleitet
//   damagePotential  gepflegte Stufe im Bereichsprofil (Nacharbeit 3)
//   (Ohne Profil oder ohne gesetzte Stufe bleiben diese vier „keine Eingangsdaten".)
//   protection       Schutzwert aus `confidentiality`: intern 0, vertraulich 50, streng vertraulich 100
//                    (fehlende Stufe zählt wie „intern" — dieselbe Regel wie beim Zugriff)
//
// Ein Faktor ohne Eingangsdaten ist `null`: er wird NICHT geschätzt und NICHT durch eine andere
// Größe ersetzt. Der Score ist das gleichgewichtete Mittel der Faktoren MIT Daten; `knownFactors`
// sagt, aus wie vielen der neun er stammt.
export const PRIORITY_FACTOR_KEYS: readonly PriorityFactorKey[] = [
  "busFactor",
  "criticality",
  "processProximity",
  "age",
  "sourceQuality",
  "conflictDensity",
  "repetition",
  "damagePotential",
  "protection",
];
const ALTER_VOLL_TAGE = 730;
const SCHUTZWERT: Record<string, number> = { intern: 0, vertraulich: 50, streng_vertraulich: 100 };
/** Ab diesem Schutzwert trägt eine Kategorie das Merkmal „hoher Schutzwert". */
const HOHER_SCHUTZWERT = 50;

function mittel(werte: readonly number[]): number | null {
  return werte.length === 0 ? null : werte.reduce((s, w) => s + w, 0) / werte.length;
}

export function priorities(input: MetricsInput): CategoryPriority[] {
  const cats = categories(input.kos);
  const busByCat = new Map(input.busFactor.map((b) => [b.category, b]));
  const pendingSet = new Set(input.pendingRevalidation);
  const konflikte = input.openConflictKoIds ? new Set(input.openConflictKoIds) : null;
  const profilByCat = new Map((input.categoryProfiles ?? []).map((p) => [p.category, p]));
  const stufe = (s: AssessmentLevel | null | undefined): number | null =>
    s ? ASSESSMENT_VALUE[s] : null;

  const rows: CategoryPriority[] = [];
  for (const [category, list] of cats) {
    const bus = busByCat.get(category);
    const profil = profilByCat.get(category);
    const alterTage = mittel(
      list
        .map((k) => Date.parse(k.createdAt))
        .filter((t) => !Number.isNaN(t))
        .map((t) => Math.max(0, (input.now - t) / DAY_MS)),
    );
    const ohneQuelle = pct(list.filter((k) => (k.sources ?? []).length === 0).length, list.length);
    const schutz = mittel(list.map((k) => SCHUTZWERT[k.confidentiality ?? "intern"] ?? 0));
    const imKonflikt = konflikte === null ? null : list.filter((k) => konflikte.has(k.id)).length;

    const werte: Record<PriorityFactorKey, number | null> = {
      busFactor: bus ? clamp(100 / Math.max(1, bus.authorCount)) : null,
      criticality: stufe(profil?.criticality),
      processProximity: stufe(profil?.processProximity),
      age: alterTage === null ? null : clamp((alterTage / ALTER_VOLL_TAGE) * 100),
      sourceQuality: clamp((100 - avgTrustOf(list) + ohneQuelle) / 2),
      conflictDensity: imKonflikt === null ? null : clamp(pct(imKonflikt, list.length)),
      repetition: stufe(profil?.repetition),
      damagePotential: stufe(profil?.damagePotential),
      protection: schutz === null ? null : clamp(schutz),
    };
    const factors = PRIORITY_FACTOR_KEYS.map((key) => ({ key, value: werte[key] }));
    const bekannt = factors.flatMap((f) => (f.value === null ? [] : [f.value]));

    const flags: PriorityFlag[] = [];
    if (bus?.singleSource) {
      flags.push("busFactorOne");
    }
    if (list.some((k) => pendingSet.has(k.id))) {
      flags.push("stale");
    }
    if ((werte.protection ?? 0) >= HOHER_SCHUTZWERT) {
      flags.push("highProtection");
    }

    rows.push({
      category,
      score: clamp(mittel(bekannt) ?? 0),
      knownFactors: bekannt.length,
      factors,
      flags,
    });
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

// R-0139: importiert ist, was einer der Importwege als solches markiert hat. Altbestand ohne Marke
// zählt nicht als importiert — nichts wird nachträglich geraten.
function isImported(ko: KnowledgeObject): boolean {
  return ko.importedVia !== undefined || ko.origin === "import";
}

// FE-MGMT-08 / R-0768 / FR-EXT-05: Knowledge House — je FACHGEBIET ein Stockwerk, gesichert vs.
// fragil. Der Bus-Faktor wird je Stockwerk aus denselben (sichtbaren) Objekten gerechnet, nach der
// Regel aus library-analytics (Einzelquelle = höchstens ein Urheber); die Kategoriezeilen aus
// `input.busFactor` passen nicht auf Fachgebiete.
export function house(input: MetricsInput): HouseFloor[] {
  const floors = new Map<string | null, KnowledgeObject[]>();
  for (const ko of input.kos) {
    const domain = ko.domain?.trim() || null;
    const list = floors.get(domain) ?? [];
    list.push(ko);
    floors.set(domain, list);
  }
  const rows: HouseFloor[] = [];
  for (const [domain, list] of floors) {
    const validated = list.filter((k) => k.status === "validiert").length;
    const validatedRatio = pct(validated, list.length);
    const authorCount = new Set(list.map((k) => k.originalAuthor)).size;
    const singleSource = authorCount <= 1;
    rows.push({
      domain,
      koCount: list.length,
      validated,
      validatedRatio,
      authorCount,
      singleSource,
      fragile: validatedRatio < 50 || singleSource,
      imported: list.filter(isImported).length,
    });
  }
  // Das Stockwerk ohne Fachgebiet steht immer zuletzt; sonst die vollsten zuerst.
  rows.sort(
    (a, b) =>
      Number(a.domain === null) - Number(b.domain === null) ||
      b.koCount - a.koCount ||
      (a.domain ?? "").localeCompare(b.domain ?? ""),
  );
  return rows;
}

// R-0768 / FR-EXT-05: Import → Haus → Ausgabe als Zähler über demselben Bestand wie die Stockwerke.
export function houseFlow(input: MetricsInput, floors: readonly HouseFloor[]): HouseFlow {
  const imported = input.kos.filter(isImported);
  const secured = input.kos.filter((k) => k.status === "validiert").length;
  return {
    imported: imported.length,
    importedValidated: imported.filter((k) => k.status === "validiert").length,
    inHouse: input.kos.length,
    secured,
    floors: floors.length,
    fragileFloors: floors.filter((f) => f.fragile).length,
    outputReady: secured,
  };
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
  const floors = house(input);
  return {
    overview: overview(input, capital.score),
    capital,
    valuationFacts: valuationFacts(input),
    statement: statement(input, capital.score),
    maturity: maturity(input, capital.score),
    priorities: priorities(input),
    recommendations: recommendations(input),
    house: floors,
    houseFlow: houseFlow(input, floors),
    pilot: pilot(input),
  };
}
