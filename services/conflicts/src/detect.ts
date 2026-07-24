// Berater-Konzept 04.07. (Stufe 2, Erkennungskern, kon-v1) — DOM-freie, testbare Kernlogik der
// automatischen Konflikterkennung. KEIN Modul-Import über Grenzen, KEIN Reasoner-Aufruf hier:
// Diese Datei entscheidet NUR aus Texten + einem bereits vorliegenden Modellurteil, ob und welcher
// Konflikt entsteht. Der Modellaufruf (Reasoner „Konfliktprüfung") und die Verdrahtung an KO-
// Ereignisse leben außerhalb (App-Composition-Root, injizierter judge-Callback).
import type { ConflictType, Kollision } from "./types";

// K0-2: Erkennungs-Gegenstand ist der Kerntext eines Beitrags (nicht das volle bodyHtml).
export interface DetectSubject {
  refId: string; // koId
  title: string;
  statement: string;
  conditions: string[];
  measures: string[];
  category?: string;
  tags: string[];
  asset?: string | null;
  // D-AISTATE PAKET 1 (bens V1): Vertraulichkeits-MARKE des Beitrags (nur ein Boolean — NIE der Text
  // oder die Stufe). Der Detection-Kern reicht die restriktivste Stufe des PAARES (subject||cand) an
  // den judge-Callback; der Reasoner nimmt die Cloud dann aus der Kette. Fehlt das Feld → nicht
  // vertraulich (Bestandsverhalten).
  confidential?: boolean;
  // D-AISTATE PAKET 4 (bens V5): Inhaltsversion des Beitrags zum Prüfzeitpunkt. Befunde werden an
  // BEIDE beteiligten Versionen gebunden (additiv); ein Aufrufer kann darüber Stale-Läufe verwerfen.
  version?: number;
}

// kon-v1 Modellurteil (striktes JSON aus der Reasoner-Aufgabe „Konfliktprüfung").
export type ConflictRelation =
  | "widerspruch"
  | "doppelung"
  | "ueberholt"
  | "kein_konflikt"
  | "unsicher";

export interface ConflictVerdict {
  relation: ConflictRelation;
  older: "a" | "b" | null; // nur bei "ueberholt": welcher Stand ist überholt
  confidence: number; // 0..1
  begruendung: string; // EIN Satz
  zitat_a: string; // wörtliches Zitat aus A
  zitat_b: string; // wörtliches Zitat aus B
  kollision?: Kollision; // SCRUM-492: optionale strukturierte Gegenüberstellung (Board-Kacheln)
}

// K0-2: Kerntext aus title + statement + conditions + measures (trägt die prüfbare Aussage).
export function coreText(s: DetectSubject): string {
  return [s.title, s.statement, ...s.conditions, ...s.measures]
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .join("\n");
}

// Normalisierung für den deterministischen Vergleich (Kleinschreibung, Satzzeichen → Leerraum).
export function normalizeForCompare(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(normalized: string): Set<string> {
  const padded = ` ${normalized} `;
  const set = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    set.add(padded.slice(i, i + 3));
  }
  return set;
}

// Trigram-Ähnlichkeit (Jaccard, 0..1) auf normalisiertem Text — Basis der Doppelungs-Erkennung
// und der Textnähe in der Kandidaten-Vorauswahl.
export function trigramSimilarity(a: string, b: string): number {
  const ta = trigrams(normalizeForCompare(a));
  const tb = trigrams(normalizeForCompare(b));
  if (ta.size === 0 && tb.size === 0) {
    return 1;
  }
  if (ta.size === 0 || tb.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const g of ta) {
    if (tb.has(g)) {
      intersection++;
    }
  }
  const union = ta.size + tb.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Dedup-Schlüssel (2.3): type + sortierte Beteiligten-Referenzen. Invariante: höchstens EIN
// offener Konflikt je pairKey (in der Anlegestelle erzwungen, nicht hier).
export function pairKey(type: ConflictType, refA: string, refB: string): string {
  const [x, y] = [refA, refB].sort();
  return `${type}|ko:${x}|ko:${y}`;
}

interface CandidateScore {
  subject: DetectSubject;
  score: number;
}

// Stufe 1 (4.1): Kandidaten-Vorauswahl — fachliche Nachbarschaft (Kategorie/Tags/Anlage) ODER
// Textnähe; nach Score sortiert, hart auf `cap` gedeckelt (Aufwand O(N·k) statt O(N²)).
export function selectCandidates(
  subject: DetectSubject,
  pool: readonly DetectSubject[],
  cap = 8,
): DetectSubject[] {
  const tagSet = new Set(subject.tags.map((t) => t.toLowerCase()));
  const subjectText = `${subject.title} ${subject.statement}`;
  const scored: CandidateScore[] = [];
  for (const c of pool) {
    if (c.refId === subject.refId) {
      continue;
    }
    const sameCategory = Boolean(subject.category) && c.category === subject.category;
    const sameAsset = Boolean(subject.asset) && c.asset === subject.asset;
    const tagOverlap = c.tags.some((t) => tagSet.has(t.toLowerCase()));
    const textSim = trigramSimilarity(subjectText, `${c.title} ${c.statement}`);
    const neighbor = sameCategory || sameAsset || tagOverlap || textSim >= 0.3;
    if (!neighbor) {
      continue;
    }
    const score =
      textSim + (sameCategory ? 0.2 : 0) + (sameAsset ? 0.2 : 0) + (tagOverlap ? 0.2 : 0);
    scored.push({ subject: c, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, cap).map((x) => x.subject);
}

// G-2 (3.4 Schritt 4): Beide Belegzitate müssen WÖRTLICH in den jeweiligen Kerntexten vorkommen —
// sonst wird das Urteil als Modell-Halluzination verworfen (kein Konflikt). Vergleich auf
// normalisiertem Text (Robustheit gegen Leerraum/Satzzeichen), leeres Zitat gilt als Fehlschlag.
export function quoteFound(quote: string, core: string): boolean {
  const q = normalizeForCompare(quote);
  if (q.length === 0) {
    return false;
  }
  return normalizeForCompare(core).includes(q);
}

export function quotesVerbatim(verdict: ConflictVerdict, coreA: string, coreB: string): boolean {
  return quoteFound(verdict.zitat_a, coreA) && quoteFound(verdict.zitat_b, coreB);
}

// Automatische Erkennung erzeugt nur Typen, die ein Modell zuverlässig aus Texten ableitet
// (5.1). „doppelung" (→ neuer Typ `duplicate`) ist bewusst NOCH nicht abgebildet — eigene Stufe;
// hier daher null (kein Auto-Anlegen), damit keine Enum-Migration in diesem Schritt nötig ist.
export function relationToType(relation: ConflictRelation): ConflictType | null {
  if (relation === "widerspruch") {
    return "truth";
  }
  if (relation === "ueberholt") {
    return "temporal";
  }
  return null;
}

export type DetectOutcomeReason =
  | "created"
  | "below_threshold"
  | "no_conflict"
  | "unsupported_relation"
  | "hallucination";

export interface DetectDecision {
  create: boolean;
  type: ConflictType | null;
  reason: DetectOutcomeReason;
}

// Startwert der Anlege-Schwelle (4.2): Präzision vor Vollständigkeit.
export const CONFLICT_MIN_CONFIDENCE = 0.7;

// Entscheidung aus einem Modellurteil (4.2 + 3.4 Schritt 4): angelegt wird bei
// widerspruch/ueberholt mit ausreichender Sicherheit UND wörtlich belegten Zitaten (G-2).
// „kein_konflikt"/„unsicher"/unter Schwelle → kein Konflikt (still, Ledger merkt sich den Stand).
export function decideFromVerdict(
  verdict: ConflictVerdict,
  coreA: string,
  coreB: string,
  minConfidence = CONFLICT_MIN_CONFIDENCE,
): DetectDecision {
  const type = relationToType(verdict.relation);
  if (type === null) {
    // kein_konflikt, unsicher oder (noch) nicht abgebildete Relation (doppelung).
    const reason: DetectOutcomeReason =
      verdict.relation === "doppelung" ? "unsupported_relation" : "no_conflict";
    return { create: false, type: null, reason };
  }
  if (verdict.confidence < minConfidence) {
    return { create: false, type: null, reason: "below_threshold" };
  }
  if (!quotesVerbatim(verdict, coreA, coreB)) {
    return { create: false, type: null, reason: "hallucination" };
  }
  return { create: true, type, reason: "created" };
}

// Ehrliche, als solche markierte Beschreibung eines automatisch erkannten Konflikts (aus
// Begründung + beiden Zitaten). Die Anzeige kennzeichnet die Herkunft „automatisch erkannt".
export function autoDescription(verdict: ConflictVerdict, locale: "de" | "en" = "de"): string {
  const lead = locale === "en" ? "Automatically detected" : "Automatisch erkannt";
  return `${lead}: ${verdict.begruendung.trim()}`;
}
