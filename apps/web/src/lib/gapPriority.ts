// Reine, DOM-freie Helfer für Gap-Priorität (SCRUM-115 / FE-RISK-02).
import type { Gap, GapPriority } from "../api/types";

export const GAP_PRIORITIES: readonly GapPriority[] = ["hoch", "mittel", "niedrig"];

// Höhere Dringlichkeit = kleinerer Rang (für aufsteigende Sortierung).
const RANK: Record<GapPriority, number> = { hoch: 0, mittel: 1, niedrig: 2 };

export function priorityRank(priority: GapPriority | undefined): number {
  return RANK[priority ?? "mittel"];
}

// Sortiert Gaps: hoch → mittel → niedrig, dann nach createdAt (älteste zuerst).
// Reine Funktion, verändert die Eingabe nicht.
export function sortGapsByPriority(gaps: readonly Gap[]): Gap[] {
  return [...gaps].sort(
    (a, b) =>
      priorityRank(a.priority) - priorityRank(b.priority) || a.createdAt.localeCompare(b.createdAt),
  );
}

export type PriorityTone = "crit" | "warn" | "neutral";

export function priorityTone(priority: GapPriority | undefined): PriorityTone {
  switch (priority ?? "mittel") {
    case "hoch":
      return "crit";
    case "niedrig":
      return "neutral";
    default:
      return "warn";
  }
}
