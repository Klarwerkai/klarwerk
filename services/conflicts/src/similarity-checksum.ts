// ================================================================================================
// R-0194 (Pedis Entscheidung 95a8fe64) — DIE ÄHNLICHKEITSPRÜFSUMME ALS VIERTE KANDIDATENQUELLE.
// ================================================================================================
//
// Neben Metadaten, Trigramm-Text und Abschnittsvergleich: eine lokal berechnete MinHash-Prüfsumme
// je Wissensobjekt. Sie SCHLÄGT NUR KANDIDATEN VOR. Die genaue Dublettenprüfung (deterministische
// Deckung, KI-Urteil, Zitatprüfung) und die Entscheidung durch den Menschen bleiben unverändert.
//
// WARUM ZUSÄTZLICH ZUM TRIGRAMM-RANG: `lexicalOverlapScore` vergleicht FELD gegen FELD. Wandern
// dieselben Sätze in ein anderes Feld (Aussage → Maßnahme, Bedingung → Titel), fällt der Wert, und
// unter dem Deckel (DETECTION_CANDIDATE_CAP) verdrängen ihn Einträge mit gleichem Titel. Die
// Prüfsumme sieht den Kerntext als WORTMENGE — Reihenfolge und Feldgrenze zählen nicht.
//
// KEIN TEXTABFLUSS: reine Rechnung im Prozess, kein Import außer dem modul-eigenen `./detect`, kein
// Netz, kein Modell, kein Embedder. Gespeichert wird nur die Zahlenfolge, nie der Text.
import { type DetectSubject, coreText, normalizeForCompare } from "./detect";

// Die Herkunft eines Kandidaten (Prüfansicht). Metadaten und Abschnitt gehören zum gemeinsamen
// Vokabular der Prüfansicht; der Duplikatweg selbst erzeugt heute „text" und „pruefsumme".
export type CandidateSource = "metadaten" | "text" | "pruefsumme" | "abschnitt";

// 64 Minima — Standardfehler der Schätzung ≈ 0,06. Schwelle und Deckel bewusst konservativ.
export const CHECKSUM_PERMUTATIONS = 64;
export const CHECKSUM_MIN_SIMILARITY = 0.6; // ab hier schlägt die Prüfsumme einen Kandidaten vor
export const CHECKSUM_CANDIDATE_CAP = 5; // höchstens so viele ZUSÄTZLICHE Vergleiche je Lauf
// Zusätzlich vorgelegt wird nur, was die Prüfsumme DEUTLICH näher sieht als der Trigramm-Wert —
// der blinde Fleck der Feld-gegen-Feld-Deckung. Was der Trigramm-Rang ebenso nah sieht und nur der
// Deckel abgeschnitten hat, bleibt abgeschnitten: der Deckel ist kein Prüfsummen-Nachschlag.
export const CHECKSUM_LEXICAL_MARGIN = 0.25;
const MIN_TOKEN_LENGTH = 4; // kurze Füllwörter (der/die/und …) tragen keinen Inhalt

export type SimilarityChecksum = readonly number[];

function seedFor(i: number): number {
  return Math.imul(i + 1, 0x9e3779b1) >>> 0;
}
const SEEDS = Array.from({ length: CHECKSUM_PERMUTATIONS }, (_, i) => seedFor(i));

// FNV-1a (32 Bit) über die UTF-16-Einheiten des Worts.
function fnv1a(token: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Murmur3-Finalizer: bijektiv auf 32 Bit — je Seed eine eigene Permutation der Wortwerte.
function mix(h: number): number {
  let x = h;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
}

export function checksumTokens(subject: DetectSubject): Set<string> {
  // Zahlen tragen immer Inhalt („Pumpe P2" ≠ „Pumpe P3", „500 Stunden" ≠ „50 Stunden").
  const words = normalizeForCompare(coreText(subject)).split(" ");
  return new Set(words.filter((t) => t.length >= MIN_TOKEN_LENGTH || /\d/.test(t)));
}

// Prüfsumme eines Subjekts; `null`, wenn der Kerntext kein tragendes Wort enthält (kein Signal).
export function similarityChecksum(subject: DetectSubject): SimilarityChecksum | null {
  const tokens = checksumTokens(subject);
  if (tokens.size === 0) {
    return null;
  }
  const mins = new Array<number>(CHECKSUM_PERMUTATIONS).fill(0xffffffff);
  for (const token of tokens) {
    const base = fnv1a(token);
    for (let i = 0; i < CHECKSUM_PERMUTATIONS; i++) {
      const v = mix((base ^ (SEEDS[i] ?? 0)) >>> 0);
      if (v < (mins[i] ?? 0xffffffff)) {
        mins[i] = v;
      }
    }
  }
  return mins;
}

// Geschätzte Jaccard-Ähnlichkeit der Wortmengen (0..1): Anteil übereinstimmender Minima.
export function checksumSimilarity(a: SimilarityChecksum, b: SimilarityChecksum): number {
  let same = 0;
  for (let i = 0; i < CHECKSUM_PERMUTATIONS; i++) {
    if (a[i] === b[i]) {
      same += 1;
    }
  }
  return same / CHECKSUM_PERMUTATIONS;
}

// Die gepflegte Prüfsummen-Ablage je Wissensobjekt (Schlüssel: refId). Anlage und Änderung
// schreiben über `upsert` (eine neue Inhaltsversion rechnet neu), Löschung entfernt über `remove`.
// Prozesslokal: nach einem Neustart füllt sie sich beim nächsten Lauf aus dem Bestand nach — die
// Prüfsumme ist eine reine Funktion des Kerntexts, ein Nachrechnen ergibt denselben Wert.
interface IndexEntry {
  version: number | undefined;
  checksum: SimilarityChecksum | null;
}

export class SimilarityChecksumIndex {
  private readonly entries = new Map<string, IndexEntry>();

  upsert(subject: DetectSubject): SimilarityChecksum | null {
    const known = this.entries.get(subject.refId);
    // Ohne Inhaltsversion lässt sich „unverändert" nicht belegen — dann wird immer neu gerechnet.
    if (known && subject.version !== undefined && known.version === subject.version) {
      return known.checksum;
    }
    const checksum = similarityChecksum(subject);
    this.entries.set(subject.refId, { version: subject.version, checksum });
    return checksum;
  }

  remove(refId: string): boolean {
    return this.entries.delete(refId);
  }

  get(refId: string): SimilarityChecksum | null | undefined {
    return this.entries.get(refId)?.checksum;
  }

  has(refId: string): boolean {
    return this.entries.has(refId);
  }
}

export interface ChecksumCandidate {
  subject: DetectSubject;
  similarity: number;
}

// Die Kandidaten der Prüfsumme: Ähnlichkeit ≥ Schwelle, das Subjekt selbst ausgeschlossen,
// absteigend nach Ähnlichkeit, refId als Stichentscheid (totale, reproduzierbare Ordnung).
export function selectChecksumCandidates(
  subject: DetectSubject,
  pool: readonly DetectSubject[],
  index: SimilarityChecksumIndex,
  minSimilarity = CHECKSUM_MIN_SIMILARITY,
): ChecksumCandidate[] {
  const own = index.upsert(subject);
  if (!own) {
    return [];
  }
  const found: ChecksumCandidate[] = [];
  for (const cand of pool) {
    if (cand.refId === subject.refId) {
      continue;
    }
    const other = index.upsert(cand);
    if (!other) {
      continue;
    }
    const similarity = checksumSimilarity(own, other);
    if (similarity >= minSimilarity) {
      found.push({ subject: cand, similarity });
    }
  }
  found.sort((a, b) =>
    b.similarity === a.similarity
      ? a.subject.refId.localeCompare(b.subject.refId)
      : b.similarity - a.similarity,
  );
  return found;
}
