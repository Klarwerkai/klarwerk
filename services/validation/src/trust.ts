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
// Gewichte je QUELLENART und nach Prüfererfahrung (R-0254) stehen bewusst NICHT hier: keine Quelle
// nennt dafür Arten oder Zahlen, und erfundene Gewichte wären eine Vertrauensaussage ohne Beleg.
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

export function computeOutcome(
  verdicts: readonly Verdict[],
  needed: number,
  // R-0256: die Arten der OFFENEN Konflikte dieses Objekts. Leer = keine Konfliktwirkung.
  offeneKonflikte: readonly KonfliktArt[] = [],
): ValidationOutcome {
  let up = 0;
  let warn = 0;
  let down = 0;
  let weighted = 0;
  for (const verdict of verdicts) {
    if (verdict === "up") {
      up += 1;
    } else if (verdict === "warn") {
      warn += 1;
    } else {
      down += 1;
    }
    weighted += TRUST_WEIGHTS[verdict];
  }
  const n = Math.max(needed, 1);
  // Gewichtete Bewertungslage, normiert auf needed und auf 0..TRUST_MAX geklemmt.
  const raw = Math.round((weighted / n) * 100);
  const trust = applyConflictImpact(Math.min(TRUST_MAX, Math.max(0, raw)), offeneKonflikte);
  // FR-VAL-02: validiert bei >= n grünen Bewertungen und 0 roten. Amber (warn) blockiert die Freigabe
  // nicht, senkt aber den Trust → „validiert mit Vorbehalt" statt stiller Vollfreigabe.
  const status: ValidationOutcome["status"] = up >= needed && down === 0 ? "validiert" : "offen";
  return { up, warn, down, trust, status };
}
