import type { Verdict } from "./types";

export interface ValidationOutcome {
  up: number;
  warn: number;
  down: number;
  trust: number; // 0..100
  status: "offen" | "validiert";
}

// Trust/Status aus der Bewertungslage. Provisorische Formel — gegen Technischen
// Anhang §3 zu verifizieren (offene Frage im Spec, siehe specs/stories/validation.md).
export function computeOutcome(verdicts: readonly Verdict[], needed: number): ValidationOutcome {
  let up = 0;
  let warn = 0;
  let down = 0;
  for (const verdict of verdicts) {
    if (verdict === "up") {
      up += 1;
    } else if (verdict === "warn") {
      warn += 1;
    } else {
      down += 1;
    }
  }
  const n = Math.max(needed, 1);
  const raw = Math.round(((up - down) / n) * 100);
  const trust = Math.min(100, Math.max(0, raw));
  // FR-VAL-02: validiert bei >= n grünen Bewertungen und 0 roten.
  const status: ValidationOutcome["status"] = up >= needed && down === 0 ? "validiert" : "offen";
  return { up, warn, down, trust, status };
}
