import { TRUTH_CONFLICT_TRUST_PENALTY } from "../../knowledge-object";
import type { Verdict } from "./types";

export interface ValidationOutcome {
  up: number;
  warn: number;
  down: number;
  trust: number; // 0..TRUST_MAX
  status: "offen" | "validiert";
}

// SCRUM-359 / AG-05 / EK-22 / Top Requirement #7: beta-plausible, NACHVOLLZIEHBARE Trust-Formel als
// pragmatische Teilableitung von Technischem Anhang §3. Trust ist ein Review-/Evidenzsignal (0..99),
// KEINE Wahrheitsgarantie (PI-K2) — deshalb deckelt TRUST_MAX bewusst bei 99, nicht 100: nichts gilt je
// als „100 % wahr". Gewichte je Peer-Bewertung, normiert auf die geforderten Validierungen (needed):
//  - up   (✅): +1.0  — positive Peer-Bewertung
//  - warn (⚠️): −0.5  — Amber ist KEIN volles OK, sondern „mit Vorbehalt / Review nötig"
//  - down (❌): −1.0  — rote Bewertung senkt Trust stark und hält den Status offen
// Die Stimmengewichte bleiben bewusst die von SCRUM-359 und NICHT die Referenzzeile aus Anhang §3.2
// (green·100 + amber·55 + red·10): dort HEBT eine gelbe Stimme den Wert von 0 auf 55. Der jüngere
// Vertrag (R-0230: „Rückfrage senkt ihn leicht, Ablehnung stark") verlangt das Gegenteil.
export const TRUST_WEIGHTS: Readonly<Record<Verdict, number>> = { up: 1, warn: -0.5, down: -1 };

// Oberer Trust-Deckel: 99, nie 100 (PI-K2: Trust ist kein Wahrheitsversprechen).
export const TRUST_MAX = 99;

// ================================================================================================
// R-0256 — DIE ABGESTUFTE KONFLIKTWIRKUNG IN DER EINEN FORMEL.
// ================================================================================================
//
// Bis hierher wirkte nur der Wahrheitskonflikt, und nur EINMAL beim Anlegen
// (`KoService.markTruthConflictReview`). Die nächste Bewertung rechnete den Wert allein aus den
// Stimmen neu und schrieb die Konfliktstrafe still wieder weg. Jetzt trägt `computeOutcome` die
// offenen Konflikte des Objekts mit, und jede Art hat ihr eigenes Gewicht aus Technischem Anhang
// §3.3. Der Wahrheitskonflikt nimmt dieselbe Zahl wie der Anlageweg — eine Quelle, keine Kopie.
//
// MEHRERE OFFENE KONFLIKTE: es zählt die stärkste Wirkung, nicht die Summe. Der Anhang kennt genau
// eine Wirkung je Berechnung („trust + conflict.impact"); dieselbe Unstimmigkeit, zweimal gemeldet,
// darf den Wert nicht zweimal senken.
//
// UNTERGRENZE 15 (Anhang §3.2 „max(15, …)"): ein Konflikt drückt den Wert nie unter 15. Er HEBT
// aber auch keinen Wert, der schon darunter liegt — ein Konflikt ist kein Grund für mehr Vertrauen.
//
// Gewichte nach Prüfererfahrung (R-0254) und je Quellenart (R-0256) stehen weiter unten.
export type KonfliktArt = "truth" | "experience" | "context" | "temporal" | "role";

export const CONFLICT_TRUST_IMPACT: Readonly<Record<KonfliktArt, number>> = {
  truth: -TRUTH_CONFLICT_TRUST_PENALTY,
  experience: -8,
  context: -6,
  temporal: -8,
  role: -5,
};

export const CONFLICT_TRUST_FLOOR = 15;

/** Die Wirkung der offenen Konflikte auf einen bereits aus den Stimmen errechneten Wert. */
export function applyConflictImpact(
  trust: number,
  offeneKonflikte: readonly KonfliktArt[],
): number {
  if (offeneKonflikte.length === 0) {
    return trust;
  }
  const staerkste = Math.min(...offeneKonflikte.map((art) => CONFLICT_TRUST_IMPACT[art]));
  return Math.min(trust, Math.max(CONFLICT_TRUST_FLOOR, trust + staerkste));
}

// ================================================================================================
// R-0254 — DIE STIMME ERFAHRENER PRÜFER ZÄHLT MEHR.
// ================================================================================================
//
// MASS DER ERFAHRUNG: die Zahl der Bewertungen, die die Person bereits an ANDEREN Wissensobjekten
// abgegeben hat (`RatingRepo.fruehereBewertungen`). Das ist die einzige Erfahrungsangabe, die das
// Produkt heute belegt speichert; Rolle oder Betriebszugehörigkeit sagen über Prüferfahrung nichts
// (bewerten dürfen ohnehin nur Controller und Verwalter, R-0566).
//
// WIRKUNG NUR AUF DEN VERTRAUENSWERT, NICHT AUF DEN STATUS: „validiert" zählt weiter unabhängige
// Freigaben (R-1091, FR-VAL-02: n grüne Personen, 0 rote). Eine erfahrene Stimme ersetzt keine
// zweite Person. Das Gewicht gilt für jede Stimme dieser Person — eine erfahrene Ablehnung senkt
// den Wert entsprechend stärker.
//
// TECHNISCHE STARTWERTE, keine Quellenzahlen: unter 10 früheren Bewertungen 1,0 (Neuling); ab 10
// 1,25; ab 50 1,5. Die Schwellen liegen bewusst so, dass ein Neuling nie schlechter steht als
// bisher. Die Zahlen selbst sind eine fachliche Festlegung, die Pedi bestätigen oder ändern kann.
export type PrueferStufe = "neu" | "erfahren" | "sehr_erfahren";

export const PRUEFER_ERFAHRUNG_AB: Readonly<Record<Exclude<PrueferStufe, "neu">, number>> = {
  erfahren: 10,
  sehr_erfahren: 50,
};

export const PRUEFER_GEWICHT: Readonly<Record<PrueferStufe, number>> = {
  neu: 1,
  erfahren: 1.25,
  sehr_erfahren: 1.5,
};

export function prueferStufe(fruehereBewertungen: number): PrueferStufe {
  if (fruehereBewertungen >= PRUEFER_ERFAHRUNG_AB.sehr_erfahren) {
    return "sehr_erfahren";
  }
  if (fruehereBewertungen >= PRUEFER_ERFAHRUNG_AB.erfahren) {
    return "erfahren";
  }
  return "neu";
}

/** Eine Stimme mit dem Gewicht ihrer Prüferstufe. Eine nackte `Verdict` zählt wie ein Neuling. */
export interface GewichteteStimme {
  verdict: Verdict;
  gewicht: number;
}

// ================================================================================================
// R-0256 — EIGENE GEWICHTE JE QUELLENART.
// ================================================================================================
//
// QUELLENARTEN aus dem, was eine Belegstelle am Objekt nachweislich trägt (`KoSource`):
//   · `beleg_anhang` — vom Server gegen die EIGENE Anhangsliste bestätigter Anker (`objectId`): das
//                      Originaldokument liegt am Objekt selbst.
//   · `quellsystem`  — Anker in ein angebundenes Quellsystem (`externalId`, `attachmentOf`,
//                      `sourceRecordId`; z. B. Confluence-Import), rückverfolgbar und abgleichbar.
//   · `extern`       — sonstige Verweise (Weblink, Freitext). Nie peer-validiert, Stufe 2
//                      (SCRUM-129): keine Wirkung.
// Eine im Quellsystem gelöschte Belegstelle (`sourceRemovedAt`) zählt nicht mehr.
//
// WIRKUNG: ein Aufschlag auf den Wert aus den Stimmen — es zählt die STÄRKSTE Quellenart, nicht
// die Summe (zehn Links sind kein zehnfacher Beleg). Er wirkt nur, wenn die Stimmen den Wert
// überhaupt über 0 heben: Vertrauen entsteht aus den Prüfstimmen (R-0230), eine Quelle allein
// macht kein geprüftes Wissen. Der Deckel 99 gilt weiter.
//
// TECHNISCHE STARTWERTE wie oben: +5 / +3 / 0 — von Pedi zu bestätigen oder zu ändern.
export type QuellenArt = "beleg_anhang" | "quellsystem" | "extern";

export const QUELLEN_TRUST_WIRKUNG: Readonly<Record<QuellenArt, number>> = {
  beleg_anhang: 5,
  quellsystem: 3,
  extern: 0,
};

/** Die Quellenart einer Belegstelle — `null` für eine im Quellsystem gelöschte. */
export function quellenArtVon(quelle: {
  objectId?: string;
  externalId?: string;
  attachmentOf?: string;
  sourceRecordId?: string;
  sourceRemovedAt?: string;
}): QuellenArt | null {
  if (quelle.sourceRemovedAt) {
    return null;
  }
  if (quelle.objectId) {
    return "beleg_anhang";
  }
  if (quelle.externalId || quelle.attachmentOf || quelle.sourceRecordId) {
    return "quellsystem";
  }
  return "extern";
}

/** Der Aufschlag der stärksten Quellenart — nur, wenn die Stimmen den Wert über 0 heben. */
export function quellenAufschlag(
  ausStimmen: number,
  quellenArten: readonly (QuellenArt | null)[],
): number {
  if (ausStimmen <= 0) {
    return 0;
  }
  let staerkste = 0;
  for (const art of quellenArten) {
    if (art) {
      staerkste = Math.max(staerkste, QUELLEN_TRUST_WIRKUNG[art]);
    }
  }
  return staerkste;
}

export interface FormelEingaben {
  // R-0256: die Arten der OFFENEN Konflikte dieses Objekts. Leer = keine Konfliktwirkung.
  offeneKonflikte?: readonly KonfliktArt[];
  // R-0256: die Quellenarten der Belegstellen dieses Objekts. Leer = kein Aufschlag.
  quellenArten?: readonly (QuellenArt | null)[];
}

export function computeOutcome(
  verdicts: readonly (Verdict | GewichteteStimme)[],
  needed: number,
  { offeneKonflikte = [], quellenArten = [] }: FormelEingaben = {},
): ValidationOutcome {
  let up = 0;
  let warn = 0;
  let down = 0;
  let weighted = 0;
  for (const stimme of verdicts) {
    const verdict = typeof stimme === "string" ? stimme : stimme.verdict;
    const gewicht = typeof stimme === "string" ? 1 : stimme.gewicht;
    if (verdict === "up") {
      up += 1;
    } else if (verdict === "warn") {
      warn += 1;
    } else {
      down += 1;
    }
    weighted += TRUST_WEIGHTS[verdict] * gewicht;
  }
  const n = Math.max(needed, 1);
  // Gewichtete Bewertungslage, normiert auf needed und auf 0..TRUST_MAX geklemmt.
  const raw = Math.round((weighted / n) * 100);
  const ausStimmen = Math.min(TRUST_MAX, Math.max(0, raw));
  const trust = applyConflictImpact(
    Math.min(TRUST_MAX, ausStimmen + quellenAufschlag(ausStimmen, quellenArten)),
    offeneKonflikte,
  );
  // FR-VAL-02: validiert bei >= n grünen Bewertungen und 0 roten. Amber (warn) blockiert die Freigabe
  // nicht, senkt aber den Trust → „validiert mit Vorbehalt" statt stiller Vollfreigabe.
  const status: ValidationOutcome["status"] = up >= needed && down === 0 ? "validiert" : "offen";
  return { up, warn, down, trust, status };
}
