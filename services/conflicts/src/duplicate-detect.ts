// Berater-Konzept Duplikate 04.07. (Stufe D1, dup-v1): DOM-freie, testbare Kernlogik der
// Überschneidungs-Erkennung. Rein aus Texten + optionalem Modellurteil; KEIN Modul-Import über
// Grenzen, KEIN Reasoner-Aufruf. Baut auf denselben Text-Helfern wie die Konflikterkennung auf.
//
// Anders als ein Konflikt ist eine Überschneidung ein GRAD + eine BEZIEHUNG (identisch → enthalten →
// teilweise → verwandt), keine Ja/Nein-Frage. Deshalb: ein deterministischer, reproduzierbarer
// Textdeckungs-Wert (lexicalScore) für Kandidatenwahl UND ehrliche Anzeige, plus — bei den schweren
// Fällen — ein Modell-Profil. „verwandt"/„verschieden"/„unsicher" erzeugen bewusst KEINEN Eintrag.
import { type DetectSubject, quoteFound, trigramSimilarity } from "./detect";

export type { DetectSubject } from "./detect";

// Die Beziehungen, die automatisch einen Eintrag erzeugen dürfen (5.1: nur belegbare Text-Urteile).
export type OverlapRelation =
  | "identisch"
  | "a_enthaelt_b"
  | "b_enthaelt_a"
  | "teilweise"
  | "verwandt";

// dup-v1 Modellurteil (Überschneidungs-Profil, striktes JSON). „verschieden"/„unsicher" sind
// gültige Nicht-Treffer-Antworten (kein Eintrag, aber ehrlich protokolliert).
export type OverlapModelRelation = OverlapRelation | "verschieden" | "unsicher";

export interface OverlapAspect {
  beschreibung: string;
  zitatA: string;
  zitatB: string;
}

export type OverlapRecommendation =
  | "zusammenfuehren"
  | "zusammenfuehren_pruefen"
  | "getrennt_lassen"
  | "verwandt_verlinken";

export interface OverlapVerdict {
  beziehung: OverlapModelRelation;
  aspects: OverlapAspect[];
  nurInA: string;
  nurInB: string;
  empfehlung: OverlapRecommendation;
  confidence: number;
  begruendung: string;
}

// Startwerte (4.1/4.2, bewusst konservativ — Präzision vor Vollständigkeit).
export const DUP_DETERMINISTIC_THRESHOLD = 0.85; // ≥ → Auto-Eintrag „identisch" ohne Modell
export const DUP_MODEL_MIN = 0.45; // [MIN, DET) → Modell-Kandidat (die schweren Fälle)
export const DUP_TITLE_MIN = 0.8; // gleicher Titel, anderer Text ist ein klassisches Duplikat-Muster
// Pedi 04.07.: Startwert der Anzeige-Schwelle jetzt 0,5 (vorher 0,7) — und im Admin einstellbar
// (OverlapSettings). „Lieber ein Fehlalarm zum Wegklicken als ein übersehenes Duplikat."
export const DUP_MIN_CONFIDENCE = 0.5;

function fieldSimilarity(a: string, b: string): number | null {
  // Beidseitig leeres Feld ist KEIN Deckungssignal (sonst würde Leere Ähnlichkeit vortäuschen).
  if (a.trim().length === 0 && b.trim().length === 0) {
    return null;
  }
  return trigramSimilarity(a, b);
}

// Deterministischer Textdeckungs-Grad 0..1 (4.1): gewichtet je Feld (Titel 0,30 · Aussage 0,40 ·
// Bedingungen 0,15 · Maßnahmen 0,15), über die tatsächlich vorhandenen Felder RENORMALISIERT.
// Kategorie/Tags/Anlage fließen NICHT ein (die Zahl bedeutet „Textdeckung", nicht „Themennähe").
export function lexicalOverlapScore(a: DetectSubject, b: DetectSubject): number {
  const fields: { weight: number; sim: number | null }[] = [
    { weight: 0.3, sim: fieldSimilarity(a.title, b.title) },
    { weight: 0.4, sim: fieldSimilarity(a.statement, b.statement) },
    { weight: 0.15, sim: fieldSimilarity(a.conditions.join(" "), b.conditions.join(" ")) },
    { weight: 0.15, sim: fieldSimilarity(a.measures.join(" "), b.measures.join(" ")) },
  ];
  let weighted = 0;
  let weightSum = 0;
  for (const f of fields) {
    if (f.sim === null) {
      continue;
    }
    weighted += f.weight * f.sim;
    weightSum += f.weight;
  }
  return weightSum === 0 ? 0 : weighted / weightSum;
}

export type OverlapCandidacy = "deterministic" | "model" | "none";

// Kandidatenstufe (4.1): sehr hohe Deckung → deterministischer Auto-Eintrag; mittlere Deckung ODER
// sehr ähnlicher Titel → Modell; sonst kein Kandidat.
export function overlapCandidacy(
  lexicalScore: number,
  titleSimilarity: number,
  opts: { deterministic?: number; modelMin?: number; titleMin?: number } = {},
): OverlapCandidacy {
  if (lexicalScore >= (opts.deterministic ?? DUP_DETERMINISTIC_THRESHOLD)) {
    return "deterministic";
  }
  if (
    lexicalScore >= (opts.modelMin ?? DUP_MODEL_MIN) ||
    titleSimilarity >= (opts.titleMin ?? DUP_TITLE_MIN)
  ) {
    return "model";
  }
  return "none";
}

// „Jeder gegen jeden" (Pedi 04.07.): der Textabgleich ist nur noch die günstige Abkürzung für den
// offensichtlichen Fall (fast wortgleich → deterministischer Eintrag ohne Modell). Alles andere geht
// IMMER an die inhaltliche KI-Prüfung — kein „none" mehr. Der Inhalt (die KI-Wahrscheinlichkeit),
// nicht die Wortdeckung, entscheidet dann, ob ein vermutliches Duplikat entsteht. Bewusst teurer:
// der Stakeholder will keine übersehenen Duplikate, KI-Mehraufwand ist nachrangig.
export function exhaustiveOverlapCandidacy(
  lexicalScore: number,
  opts: { deterministic?: number } = {},
): "deterministic" | "model" {
  return lexicalScore >= (opts.deterministic ?? DUP_DETERMINISTIC_THRESHOLD)
    ? "deterministic"
    : "model";
}

// G-2: nur Aspekte mit WÖRTLICH belegten Zitaten in beiden Kerntexten zählen (sonst gestrichen).
export function verifiedAspects(
  verdict: OverlapVerdict,
  coreA: string,
  coreB: string,
): OverlapAspect[] {
  return verdict.aspects.filter((a) => quoteFound(a.zitatA, coreA) && quoteFound(a.zitatB, coreB));
}

// Erzeugt eine Modell-Beziehung einen Eintrag? Nur die vier belegbaren; „verwandt" NICHT
// automatisch (10.5: Themennähe-Rauschen würde die Seite entwerten).
export function relationCreatesEntry(relation: OverlapModelRelation): relation is OverlapRelation {
  return (
    relation === "identisch" ||
    relation === "a_enthaelt_b" ||
    relation === "b_enthaelt_a" ||
    relation === "teilweise"
  );
}

export type OverlapOutcomeReason =
  | "created_deterministic"
  | "created_model"
  | "below_threshold"
  | "no_overlap"
  | "related_only"
  | "no_verified_aspect";

export interface OverlapDecision {
  create: boolean;
  relation: OverlapRelation | null;
  recommendation: OverlapRecommendation | null;
  aspects: OverlapAspect[];
  reason: OverlapOutcomeReason;
}

// Entscheidung aus dem Modell-Profil (4.2 + G-2): angelegt wird bei identisch/enthalten/teilweise
// mit ausreichender Sicherheit UND mindestens einem belegten gemeinsamen Aspekt. „verwandt" →
// related_only (kein Eintrag). „verschieden"/„unsicher"/unter Schwelle → kein Eintrag.
export function decideFromOverlapVerdict(
  verdict: OverlapVerdict,
  coreA: string,
  coreB: string,
  minConfidence = DUP_MIN_CONFIDENCE,
): OverlapDecision {
  if (verdict.beziehung === "verwandt") {
    return {
      create: false,
      relation: null,
      recommendation: null,
      aspects: [],
      reason: "related_only",
    };
  }
  if (!relationCreatesEntry(verdict.beziehung)) {
    return {
      create: false,
      relation: null,
      recommendation: null,
      aspects: [],
      reason: "no_overlap",
    };
  }
  if (verdict.confidence < minConfidence) {
    return {
      create: false,
      relation: null,
      recommendation: null,
      aspects: [],
      reason: "below_threshold",
    };
  }
  const aspects = verifiedAspects(verdict, coreA, coreB);
  if (aspects.length === 0) {
    return {
      create: false,
      relation: null,
      recommendation: null,
      aspects: [],
      reason: "no_verified_aspect",
    };
  }
  return {
    create: true,
    relation: verdict.beziehung,
    recommendation: verdict.empfehlung,
    aspects,
    reason: "created_model",
  };
}

// Deterministischer Eintrag ohne Modell (lexicalScore ≥ Schwelle): relation „identisch",
// Empfehlung „zusammenfuehren"; der Beleg ist die Textdeckung selbst (kein erfundenes Zitat).
export function deterministicOverlapDecision(): OverlapDecision {
  return {
    create: true,
    relation: "identisch",
    recommendation: "zusammenfuehren",
    aspects: [],
    reason: "created_deterministic",
  };
}

// Dedup-Schlüssel im eigenen Namensraum „dup|" (2.3) — unabhängig vom Konflikt-pairKey desselben Paars.
export function overlapPairKey(refA: string, refB: string): string {
  const [x, y] = [refA, refB].sort();
  return `dup|ko:${x}|ko:${y}`;
}

// Textdeckung als ehrliche Prozentzahl fürs Board (Anhaltspunkt, kein Urteil).
export function overlapScorePercent(lexicalScore: number): number {
  return Math.round(Math.min(1, Math.max(0, lexicalScore)) * 100);
}

// Nur der Titel-Ähnlichkeitswert (für die Kandidatenstufe „gleicher Titel, anderer Text").
export function titleSimilarity(a: DetectSubject, b: DetectSubject): number {
  return trigramSimilarity(a.title, b.title);
}
