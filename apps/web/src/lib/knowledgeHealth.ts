// Reine, DOM-freie Ableitung für Knowledge Health (SCRUM-141) & Risiko-Cockpit (SCRUM-133).
// Ein Modul für beide — keine doppelte Logik. Alle Werte aus echten Bestandsdaten,
// keine Mock-/Demo-Zahlen. Kein Trend über Zeit (historische Snapshots fehlen).
import type {
  AiCheckCoverageSummary,
  BusFactorEntry,
  Conflict,
  Gap,
  KnowledgeObject,
} from "../api/types";

export type HealthBand = "gut" | "mittel" | "kritisch";
export type FactorDirection = "positive" | "negative";

export interface HealthFactor {
  key: string;
  value: number; // Prozent oder Anzahl, je nach Faktor
  unit: "percent" | "count";
  direction: FactorDirection; // wirkt der Faktor förderlich oder belastend?
}

// ================================================================================================
// AUFTRAG-mega33 BLOCK B (Pedis Entscheidung 27.07., nach bens ROT 1) — DER SCORE ZEIGT DEN
// SCHLECHTESTEN FALL.
// ================================================================================================
//
// DIE VORGABE AUS mega32 WAR FALSCH, und sie stammte nicht aus dem Code: „Konfliktfaktor bei
// unbelegter Erkennung nicht einrechnen" hieß in Zahlen — belegte Erkennung mit drei gefundenen
// Konflikten ergab 65, lückenhafte ohne gefundene ergab 80. Ein Abzug von NULL ist eben KEIN
// neutraler Umgang mit Unwissen, sondern eine Annahme über einen unbekannten negativen Faktor:
// dieselbe Annahme, die seit mega31 überall sonst abgeschafft ist.
//
// PEDIS ENTSCHEIDUNG 27.07. Bei unbelegter Erkennung rechnet die sichtbare Punktzahl mit dem
// VOLLEN Konfliktabzug — als wären alle unbekannten Konflikte vorhanden. Der optimistische Wert
// aus den bereits gefundenen Konflikten steht daneben, benannt als das, was er ist.
//
//   Spanne:  Basis − maximaler Konfliktabzug   …   Basis − Abzug der bekannten Konflikte
//            └── das ist `score`, die große Zahl        └── das ist `scoreOptimistic`
//
// Bereits gefundene Konflikte bleiben in JEDEM Fall als sicherer Mindestabzug erhalten — ein
// Konflikt, den wir kennen, verschwindet nicht dadurch, dass wir andere nicht kennen. Und weil
// `bekannt ≤ maximal` gilt, kann eine lückenhafte Lage nie besser dastehen als dieselbe Lage mit
// belegter Erkennung. Das ist die Zusicherung, die den ganzen Block trägt.
export type ConflictFactorExclusion =
  // Die Abdeckungs-Zusammenfassung weist unvollständige oder gar nicht belegte Läufe aus.
  | "detection-incomplete"
  // Über die Abdeckung liegt gar keine Aussage vor (Zusammenfassung nicht geladen/nicht verfügbar).
  // Nach der Beweislast-Umkehr aus mega31 A ist „unbekannt" genau so wenig ein Beleg wie „lückenhaft".
  | "detection-unknown";

export interface ConflictFactorState {
  // Ist die Konflikterkennung BELEGT vollständig gelaufen?
  proven: boolean;
  // Warum nicht — null, solange sie belegt ist.
  reason: ConflictFactorExclusion | null;
  // Der sichere Mindestabzug aus den BEREITS GEFUNDENEN Konflikten. Er gilt immer.
  knownPenalty: number;
  // Der maximal mögliche Konfliktabzug (der Deckel).
  maxPenalty: number;
  // Was tatsächlich in `score` steckt: unbelegt ⇒ maxPenalty, belegt ⇒ knownPenalty.
  appliedPenalty: number;
}

export interface KnowledgeHealth {
  // Die sichtbare Zahl: der SCHLECHTESTE Fall (0–100).
  score: number;
  // Der optimistische Rand: Basis − Abzug der bekannten Konflikte. Bei belegter Erkennung ist er
  // identisch mit `score` — dann gibt es keine Spanne, weil nichts offen ist.
  scoreOptimistic: number;
  // AUFTRAG-mega33 B3: null, solange der Konfliktanteil unbelegt ist. Ein Band ist eine Aussage
  // über die Gesamtlage; sie mit „unvollständig" zu beschriften und trotzdem „gut" hinzuschreiben,
  // wäre wieder eine Behauptung mit Fußnote. Also entfällt sie, bis sie belegt ist.
  band: HealthBand | null;
  validatedRatio: number; // %
  staleRatio: number; // %
  singleSourceShare: number; // %
  openKos: number;
  openGaps: number;
  openConflicts: number;
  avgTrust: number;
  factors: HealthFactor[];
  // AUFTRAG-mega33 B: der Zustand des Konfliktfaktors, immer gesetzt — er trägt die Spanne.
  conflictFactor: ConflictFactorState;
}

// Der Deckel des Konfliktabzugs. Er ist zugleich der Abzug, mit dem bei unbelegter Erkennung
// gerechnet wird: das ist der schlechteste Fall, den dieser Faktor überhaupt annehmen kann.
export const MAX_CONFLICT_PENALTY = 20;

export interface HealthInput {
  kos: readonly KnowledgeObject[];
  gaps: readonly Gap[];
  conflicts: readonly Conflict[];
  pendingRevalidation: readonly string[];
  busFactor: readonly BusFactorEntry[];
  // AUFTRAG-mega33 B: die serverseitige Abdeckungs-Zusammenfassung (mega29 C2). Fehlt sie, ist die
  // Erkennung UNBELEGT — und dann gilt der schlechteste Fall, genau wie bei nachweislich
  // lückenhafter Erkennung. Beweispflicht statt Plausibilität, dieselbe Regel wie überall sonst.
  detectionCoverage?: AiCheckCoverageSummary | null | undefined;
}

// AUFTRAG-mega32 F: Die Erkennung ist genau dann BELEGT vollständig, wenn die Zusammenfassung
// vorliegt UND keiner ihrer drei Lücken-Zähler etwas ausweist. Ein leerer Bestand (total 0) zählt
// als belegt — es gibt nichts, worüber ein Lauf schweigen könnte.
export function detectionProven(summary: AiCheckCoverageSummary | null | undefined): boolean {
  if (!summary) {
    return false;
  }
  return summary.incomplete === 0 && summary.unchecked === 0 && summary.noCoverage === 0;
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

  // AUFTRAG-mega33 B: der Konfliktabzug hat ab jetzt ZWEI Ränder. Der bekannte Abzug ist der
  // sichere Mindestwert — er gilt immer, auch bei lückenhafter Erkennung. Der maximale Abzug ist
  // der schlechteste Fall, und mit ihm rechnet die sichtbare Zahl, solange nicht belegt ist, dass
  // vollständig gesucht wurde.
  const knownPenalty = Math.min(MAX_CONFLICT_PENALTY, openConflicts * 5);
  const proven = detectionProven(input.detectionCoverage);
  const conflictFactor: ConflictFactorState = {
    proven,
    reason: proven ? null : input.detectionCoverage ? "detection-incomplete" : "detection-unknown",
    knownPenalty,
    maxPenalty: MAX_CONFLICT_PENALTY,
    appliedPenalty: proven ? knownPenalty : MAX_CONFLICT_PENALTY,
  };

  // Basis = Validierungsquote; Abzüge für belastende Signale, geklemmt auf 0–100. Die übrigen
  // Abzüge stehen in BEIDEN Rändern — die Spanne entsteht ausschließlich aus dem Konfliktanteil.
  const basePenalty =
    staleRatio * 0.4 + // veraltetes/zu revalidierendes Wissen
    singleSourceShare * 0.3 + // Klumpenrisiko Single-Source
    Math.min(20, openGaps * 4); // offene Wissenslücken
  const clamp = (raw: number): number => Math.max(0, Math.min(100, Math.round(raw)));
  const score = clamp(validatedRatio - basePenalty - conflictFactor.appliedPenalty);
  const scoreOptimistic = clamp(validatedRatio - basePenalty - knownPenalty);

  const factors: HealthFactor[] = [
    { key: "validatedRatio", value: validatedRatio, unit: "percent", direction: "positive" },
    { key: "staleRatio", value: staleRatio, unit: "percent", direction: "negative" },
    { key: "singleSourceShare", value: singleSourceShare, unit: "percent", direction: "negative" },
    { key: "openGaps", value: openGaps, unit: "count", direction: "negative" },
    // Die Zahl ist und bleibt die der GEFUNDENEN Konflikte. Wie viel davon in der Punktzahl steckt,
    // steht in `conflictFactor` — nicht hier, damit die Liste keine zweite Rechnung aufmacht.
    { key: "openConflicts", value: openConflicts, unit: "count", direction: "negative" },
  ];

  return {
    score,
    scoreOptimistic,
    band: proven ? bandForScore(score) : null,
    validatedRatio,
    staleRatio,
    singleSourceShare,
    openKos,
    openGaps,
    openConflicts,
    avgTrust,
    factors,
    conflictFactor,
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
