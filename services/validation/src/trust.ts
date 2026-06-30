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
// Die abgestufte Konflikt-Wirkung läuft separat über SCRUM-358 (KoService.markTruthConflictReview);
// die vollständige spec-konforme §3-Formel (mehrstufige Konflikt-/Quellen-Gewichte) bleibt Folge-Gap.
export const TRUST_WEIGHTS: Readonly<Record<Verdict, number>> = { up: 1, warn: -0.5, down: -1 };

// Oberer Trust-Deckel: 99, nie 100 (PI-K2: Trust ist kein Wahrheitsversprechen).
export const TRUST_MAX = 99;

export function computeOutcome(verdicts: readonly Verdict[], needed: number): ValidationOutcome {
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
  const trust = Math.min(TRUST_MAX, Math.max(0, raw));
  // FR-VAL-02: validiert bei >= n grünen Bewertungen und 0 roten. Amber (warn) blockiert die Freigabe
  // nicht, senkt aber den Trust → „validiert mit Vorbehalt" statt stiller Vollfreigabe.
  const status: ValidationOutcome["status"] = up >= needed && down === 0 ? "validiert" : "offen";
  return { up, warn, down, trust, status };
}
