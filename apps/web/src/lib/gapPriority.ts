// Reine, DOM-freie Helfer für Gap-Priorität (SCRUM-115 / FE-RISK-02).
import type { Gap, GapPriority } from "../api/types";
import type { KnowledgeOsPhase } from "./taskAction";

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

// SCRUM-253: genau EINE sinnvolle nächste Handlung pro Wissenslücke aus vorhandenen Feldern
// (Status, Priorität, Zuweisung) ableiten. Verweist nur auf bestehende echte Aktionen der
// Risiko-Seite (priorisieren/zuweisen/erfassen/schließen) — keine neue Engine, keine Auto-Mutation,
// keine automatische KO-Erzeugung. Lebenszyklus: triagieren → zuweisen → Wissen erfassen → schließen.
//  - geschlossen                     → erledigt (done)
//  - offen, zugewiesen               → Wissen erfassen (Owner schließt die Lücke)
//  - offen, ohne Owner, Prio hoch    → zuweisen (bereits dringend eingestuft)
//  - offen, ohne Owner, Prio < hoch  → priorisieren (Dringlichkeit einschätzen)
export type GapNextStep = "prioritize" | "assign" | "capture" | "done";

export function gapNextStep(gap: Pick<Gap, "status" | "priority" | "assignee">): GapNextStep {
  if (gap.status === "geschlossen") {
    return "done";
  }
  if (gap.assignee) {
    return "capture";
  }
  return gap.priority === "hoch" ? "assign" : "prioritize";
}

// SCRUM-298: eine offene Wissenslücke ist „Erfassen"-Arbeit im Knowledge-OS-Kreis — Ziel ist, die
// Erfahrung zu erfassen (Capture), die dann in Review/Validation geht und erst danach quellengebunden
// nutzbar wird. Geschlossene Lücke = erledigt → „Aktuell halten". Konsistent mit
// knowledgeOsPhase("task.gap") (Start/MyTasks). KEINE Auto-Schließung, KEINE automatische KO-Erzeugung.
export function gapPhase(gap: Pick<Gap, "status">): KnowledgeOsPhase {
  return gap.status === "geschlossen" ? "maintain" : "capture";
}
