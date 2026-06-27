// SCRUM-230: DOM-freie Cockpit-Kennzahlen für die Risiko-Seite. Leitet ausschließlich aus
// vorhandenen Gap-/Conflict-Daten ab (keine neue Engine, kein erfundener Score, kein Backend).
// Reine Funktion → testbar ohne DOM.
import type { Conflict, Gap } from "../api/types";

export interface RiskCockpit {
  openGaps: number; // Lücken mit Status "offen"
  highPriority: number; // offene Lücken mit Priorität "hoch"
  assigned: number; // offene Lücken mit Zuweisung
  unassigned: number; // offene Lücken ohne Zuweisung
  closedGaps: number; // Lücken mit Status "geschlossen"
  openConflicts: number; // Konflikte, die noch nicht gelöst sind
}

export function buildRiskCockpit(
  gaps: readonly Gap[],
  conflicts: readonly Conflict[],
): RiskCockpit {
  let openGaps = 0;
  let highPriority = 0;
  let assigned = 0;
  let unassigned = 0;
  let closedGaps = 0;

  for (const g of gaps) {
    if (g.status === "offen") {
      openGaps += 1;
      if (g.priority === "hoch") {
        highPriority += 1;
      }
      if (g.assignee) {
        assigned += 1;
      } else {
        unassigned += 1;
      }
    } else {
      closedGaps += 1;
    }
  }

  // "geloest" zählt nicht als offen; alle anderen Status (offen/eskaliert/zweitmeinung) schon.
  const openConflicts = conflicts.filter((c) => c.status !== "geloest").length;

  return { openGaps, highPriority, assigned, unassigned, closedGaps, openConflicts };
}
