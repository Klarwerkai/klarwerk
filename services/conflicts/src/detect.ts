// Berater-Konzept 04.07. (Stufe 2, Erkennungskern, kon-v1) — DOM-freie, testbare Kernlogik der
// automatischen Konflikterkennung. KEIN Modul-Import über Grenzen, KEIN Reasoner-Aufruf hier:
// Diese Datei entscheidet NUR aus Texten + einem bereits vorliegenden Modellurteil, ob und welcher
// Konflikt entsteht. Der Modellaufruf (Reasoner „Konfliktprüfung") und die Verdrahtung an KO-
// Ereignisse leben außerhalb (App-Composition-Root, injizierter judge-Callback).
import type { ConflictType, ConflictWorkKind, KlaraVorschlag, Kollision } from "./types";

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
  // R-1632 / R-1633: die Geltung des Beitrags (Konzern/Werk/Schicht, Rolle), strukturgleich zu
  // `KoGeltung` in knowledge-object — hier nur durchgereicht. Ausgewertet wird sie ausschliesslich
  // über die injizierte Regel `geltungsKollision` (detectForSubject); dieses Modul legt sie nicht aus.
  geltung?: DetectGeltung;
}

/** R-1632 / R-1633: strukturgleich zu `KoGeltung` (knowledge-object) — bewusst eigenständig. */
export interface DetectGeltung {
  ebene: "konzern" | "werk" | "schicht";
  werk?: string;
  schicht?: string;
  rolle?: string;
}

/**
 * R-1632 / R-1633: die Regel, die aus zwei Geltungen die Konfliktart eines erkannten Widerspruchs
 * macht — oder `null` (dann bleibt es beim Wahrheitskonflikt). Die App-Wurzel reicht sie aus
 * knowledge-object herein (`geltungsKollision`); `vermerk` wird an die Beschreibung gehängt.
 */
export type GeltungsKollisionsRegel = (
  a: DetectGeltung | undefined,
  b: DetectGeltung | undefined,
) => { art: "context" | "role"; vermerk: string } | null;

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
  // R-0252 (Nacharbeit 2): bei „widerspruch" ordnet die Prüfung die nötige Arbeit ein — „regel"
  // (zwei interne Festlegungen, keine Quelle entscheidet) oder „sache" (durch Belege entscheidbar).
  // Optional: fehlt sie, bleibt die Arbeitsart unbestimmt — sie wird NICHT aus der Relation geraten.
  arbeit?: "regel" | "sache";
  // R-0263: Klaras Vorschlag Widerspruch/Präzisierung — Seiten als „a"/„b" (s. `vorschlagAusUrteil`).
  vorschlag?: {
    art: "widerspruch" | "praezisierung";
    spezieller?: "a" | "b";
    geltungsbereich?: string;
  };
}

/**
 * R-0263: Klaras Vorschlag aus dem Urteil auf die zwei Punkte abbilden — „a" ist der geprüfte
 * Beitrag, „b" der Kandidat. Nur ein vollständiger Präzisierungsvorschlag (Seite UND Bereich) wird
 * übernommen; alles andere bleibt ein schlichter Widerspruchsvorschlag oder gar keiner.
 */
export function vorschlagAusUrteil(
  verdict: ConflictVerdict,
  koA: string,
  koB: string,
): KlaraVorschlag | undefined {
  const v = verdict.vorschlag;
  if (verdict.relation !== "widerspruch" || !v) {
    return undefined;
  }
  const bereich = (v.geltungsbereich ?? "").trim();
  if (v.art === "praezisierung" && (v.spezieller === "a" || v.spezieller === "b") && bereich) {
    return {
      art: "praezisierung",
      spezieller: v.spezieller === "a" ? koA : koB,
      geltungsbereich: bereich,
    };
  }
  return v.art === "widerspruch" ? { art: "widerspruch" } : undefined;
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
//
// AUFTRAG-mega28 A1 (Pedi 26.07.): Der Deckel ist im Live-Weg wieder scharf (bis mega27 stand dort
// Number.POSITIVE_INFINITY). Damit wird die BESTIMMTHEIT dieser Sortierung erstmals wirksam — und
// sie war es nicht: bei gleichem Score entschied die Reihenfolge, in der die Datenquelle die Zeilen
// lieferte (sort ist stabil, also blieb Pool-Ordnung stehen). Der refId-Stichentscheid macht die
// Ordnung TOTAL — zwei Läufe über denselben Bestand legen dieselbe Menge vor.
//
// AUFNAHME 20260922 · R-1124 (wahlweiser Vollabgleich): `nurNachbarn = false` hebt den fachlichen
// Vorfilter auf — jedes Objekt außer dem Subjekt wird nach demselben Score und Stichentscheid gereiht.
// Ohne Deckel (`cap = ∞`) ist das der ganze Bestand. Der Standard bleibt der gefilterte Weg.
export function selectCandidates(
  subject: DetectSubject,
  pool: readonly DetectSubject[],
  cap = 8,
  nurNachbarn = true,
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
    if (!neighbor && nurNachbarn) {
      continue;
    }
    const score =
      textSim + (sameCategory ? 0.2 : 0) + (sameAsset ? 0.2 : 0) + (tagOverlap ? 0.2 : 0);
    scored.push({ subject: c, score });
  }
  scored.sort((a, b) =>
    b.score === a.score ? a.subject.refId.localeCompare(b.subject.refId) : b.score - a.score,
  );
  return (Number.isFinite(cap) ? scored.slice(0, Math.max(0, cap)) : scored).map((x) => x.subject);
}

// R-1117: Ein Token ist eine Folge aus Buchstaben/Ziffern ODER genau ein anderes Zeichen. Satzzeichen
// bleiben damit Teil des Vergleichs ('1,5' ≠ '1–5', '.5' ≠ '5', '-8' ≠ '8').
const ZITAT_TOKEN = /[\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}\s]/gu;

// Typografische Varianten DESSELBEN Zeichens werden gleichgesetzt — sonst nichts. Prime ′/″ sind
// Maßzeichen, keine Anführungszeichen, und bleiben bewusst eigenständig (Bens BEN-1).
const ZITAT_ZEICHEN: ReadonlyArray<[RegExp, string]> = [
  [/[„“”‟«»〝〞＂]/g, '"'],
  [/[‚‘’‛‹›＇]/g, "'"],
  [/[‐‑‒–—―]/g, "-"],
  [/…/g, "..."],
];

const ANFUEHRUNG = new Set(['"', "'"]);
const SATZENDE = new Set([".", ",", ";", ":", "!", "?"]);
const KLAMMER_AUF = new Set(["(", "[", "{"]);
const KLAMMER_ZU = new Set([")", "]", "}"]);

interface ZitatToken {
  text: string;
  // true: steht ohne Leerraum direkt am vorigen Token ('5' in '1.5', '.' in 'bar.').
  angeklebt: boolean;
}

function zitatTokens(text: string): ZitatToken[] {
  let t = text.normalize("NFC").toLowerCase();
  for (const [muster, ersatz] of ZITAT_ZEICHEN) {
    t = t.replace(muster, ersatz);
  }
  const tokens: ZitatToken[] = [];
  let ende = -1;
  for (const m of t.matchAll(ZITAT_TOKEN)) {
    const start = m.index ?? 0;
    tokens.push({ text: m[0], angeklebt: start === ende });
    ende = start + m[0].length;
  }
  return tokens;
}

// Randbereinigung des Modellzitats: entfernt werden nur Zeichen, die das Modell um das Zitat setzt —
// Anführungszeichen am Anfang, ein freistehender Satzzeichen-Lauf am Anfang ('... 5 bar') sowie
// Anführungszeichen, Satzendezeichen und schließende Klammern am Ende. Ein Zeichen, das am Zitatinhalt
// klebt und Bedeutung trägt ('.5', '-5', '+5', '5%'), bleibt stehen.
function zitatRandBereinigt(tokens: ZitatToken[]): ZitatToken[] {
  let von = 0;
  let bis = tokens.length;
  for (;;) {
    const kopf = tokens[von];
    if (kopf && (ANFUEHRUNG.has(kopf.text) || KLAMMER_AUF.has(kopf.text))) {
      von++;
      continue;
    }
    let lauf = von;
    while (lauf < bis && SATZENDE.has(tokens[lauf]?.text ?? "")) {
      lauf++;
    }
    if (lauf > von && lauf < bis && !tokens[lauf]?.angeklebt) {
      von = lauf;
      continue;
    }
    break;
  }
  while (bis > von) {
    const fuss = tokens[bis - 1]?.text ?? "";
    if (!(ANFUEHRUNG.has(fuss) || SATZENDE.has(fuss) || KLAMMER_ZU.has(fuss))) {
      break;
    }
    bis--;
  }
  return tokens.slice(von, bis);
}

// Der Treffer darf kein Bruchstück einer längeren Angabe sein: ein am Treffer klebendes Nachbartoken
// im Kerntext ist nur erlaubt, wenn es öffnende (davor) bzw. schließende Zeichensetzung (danach) ist,
// die ihrerseits frei steht. 'beträgt 1' trifft so weder 'beträgt 1.5' noch 'beträgt 1–5', '5 bar'
// trifft aber 'Set pressure to 5 bar.'.
function randFrei(core: ZitatToken[], start: number, ende: number): boolean {
  for (let i = start; core[i]?.angeklebt && i > 0; i--) {
    const davor = core[i - 1]?.text ?? "";
    if (!(ANFUEHRUNG.has(davor) || KLAMMER_AUF.has(davor))) {
      return false;
    }
  }
  for (let i = ende; i < core.length && core[i]?.angeklebt; i++) {
    const danach = core[i]?.text ?? "";
    if (!(ANFUEHRUNG.has(danach) || SATZENDE.has(danach) || KLAMMER_ZU.has(danach))) {
      return false;
    }
  }
  return true;
}

// G-2 (3.4 Schritt 4) / R-1117: Beide Belegzitate müssen WÖRTLICH in den jeweiligen Kerntexten
// vorkommen — als lückenlose Tokenfolge, Token für Token gleich (Groß-/Kleinschreibung, Leerraum und
// typografische Varianten gleicher Zeichen egal). Sonst wird das Urteil als Modell-Halluzination
// verworfen (kein Konflikt). Leeres Zitat gilt als Fehlschlag. Dieselbe Funktion prüft die geteilten
// Zitate der Dublettenaspekte (verifiedAspects).
// Bekannte Grenze: Zitate mit abweichender Zeichensetzung in der Mitte oder einer Auslassung („…")
// in der Mitte gelten als nicht wörtlich.
export function quoteFound(quote: string, core: string): boolean {
  const q = zitatRandBereinigt(zitatTokens(quote));
  if (q.length === 0) {
    return false;
  }
  const c = zitatTokens(core);
  for (let start = 0; start + q.length <= c.length; start++) {
    if (
      q.every((tok, i) => c[start + i]?.text === tok.text) &&
      randFrei(c, start, start + q.length)
    ) {
      return true;
    }
  }
  return false;
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
  // R-0252: die Arbeitsart des anzulegenden Konflikts — unabhängig von `type` bestimmt.
  arbeitsart?: ConflictWorkKind;
}

/**
 * R-0252 (Nacharbeit 2): die Arbeitsart aus dem URTEIL, nicht aus der Konfliktart. „ueberholt" ist
 * per Definition dieselbe Sache in zwei Ständen. Bei „widerspruch" zählt allein die Einordnung der
 * Prüfung (`arbeit`); ohne sie bleibt die Arbeitsart offen.
 */
export function arbeitsartAusUrteil(verdict: ConflictVerdict): ConflictWorkKind | undefined {
  if (verdict.relation === "ueberholt") {
    return "version";
  }
  const arbeit = verdict.arbeit;
  if (verdict.relation === "widerspruch" && (arbeit === "regel" || arbeit === "sache")) {
    return arbeit;
  }
  return undefined;
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
  const arbeitsart = arbeitsartAusUrteil(verdict);
  return { create: true, type, reason: "created", ...(arbeitsart ? { arbeitsart } : {}) };
}

// Ehrliche, als solche markierte Beschreibung eines automatisch erkannten Konflikts (aus
// Begründung + beiden Zitaten). Die Anzeige kennzeichnet die Herkunft „automatisch erkannt".
// mega52 D1: Niederländisch ist eine eigene Reasoner-Sprache — die Signatur zieht mit, statt
// den nl-Fall am Typ abprallen zu lassen.
export function autoDescription(
  verdict: ConflictVerdict,
  locale: "de" | "en" | "nl" = "de",
): string {
  const lead =
    locale === "en"
      ? "Automatically detected"
      : locale === "nl"
        ? "Automatisch herkend"
        : "Automatisch erkannt";
  return `${lead}: ${verdict.begruendung.trim()}`;
}
