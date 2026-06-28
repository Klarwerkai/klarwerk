// SCRUM-247: DOM-freie Arbeitszentrale. Leitet die „nächsten Handlungen" AUSSCHLIESSLICH aus
// vorhandenen echten Signalen ab (Validierungs-Board, Konflikte, Revalidierung, kritische Lücken,
// Lernpfad) — keine neue Task-Engine, keine Fake-Aufgaben. Kategorien bleiben getrennt (nicht
// vermischt), aber handlungsnah. Reine Funktionen → testbar ohne DOM.
import type { Conflict, Gap, KnowledgeObject } from "../api/types";

export type WorkSeverity = "critical" | "today" | "later";

// ---------------------------------------------------------------------------
// Start: kompakte, getrennte Arbeitsübersicht
// ---------------------------------------------------------------------------
export interface WorkSignals {
  validationOpen: number; // offene KOs im Validierungs-Board
  conflictsOpen: number; // ungelöste Konflikte
  revalidationPending: number; // fällige Revalidierungen
  criticalGaps: number; // offene Wissenslücken mit Priorität „hoch"
  learningOpenSteps: number; // offene Schritte im Rollen-Lernpfad
}

export interface WorkOverviewItem {
  key: string; // i18n: work.<key>
  count: number;
  to: string;
  severity: WorkSeverity;
}

// Feste Kategorie-Definition: getrennt, geordnet (kritisch → heute → später).
const WORK_OVERVIEW: readonly {
  key: string;
  to: string;
  severity: WorkSeverity;
  pick: (s: WorkSignals) => number;
}[] = [
  { key: "conflicts", to: "/konflikte", severity: "critical", pick: (s) => s.conflictsOpen },
  { key: "criticalGaps", to: "/risiko", severity: "critical", pick: (s) => s.criticalGaps },
  {
    key: "revalidation",
    to: "/lebenszyklus",
    severity: "today",
    pick: (s) => s.revalidationPending,
  },
  { key: "validation", to: "/validierung", severity: "today", pick: (s) => s.validationOpen },
  { key: "learning", to: "/lebenszyklus", severity: "later", pick: (s) => s.learningOpenSteps },
];

// Nur Kategorien mit echtem Signal (count>0); keine Fake-/Nullzeilen.
export function buildWorkOverview(signals: WorkSignals): WorkOverviewItem[] {
  return WORK_OVERVIEW.map((c) => ({
    key: c.key,
    to: c.to,
    severity: c.severity,
    count: c.pick(signals),
  })).filter((i) => i.count > 0);
}

// SCRUM-271: bester nächster Einstieg aus der vorhandenen Arbeitsübersicht — KEINE neue Engine,
// keine neue Datenquelle. Deterministisch: kritisch vor heute vor später, innerhalb derselben
// Dringlichkeit bleibt die bestehende Reihenfolge (stabile Sortierung). Null, wenn keine Signale.
const SEVERITY_RANK: Record<WorkSeverity, number> = { critical: 0, today: 1, later: 2 };

export function primaryWorkItem(items: readonly WorkOverviewItem[]): WorkOverviewItem | null {
  if (items.length === 0) {
    return null;
  }
  return (
    [...items].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])[0] ?? null
  );
}

// Signale aus den vorhandenen Rohdaten ableiten (echte Service-Reads, kein Backend-Umbau).
export function workSignalsFrom(input: {
  board: readonly KnowledgeObject[];
  conflicts: readonly Conflict[];
  revalidation: readonly string[];
  gaps: readonly Gap[];
  learningOpenSteps: number;
}): WorkSignals {
  return {
    validationOpen: input.board.length,
    conflictsOpen: input.conflicts.filter((c) => c.status !== "geloest").length,
    revalidationPending: input.revalidation.length,
    criticalGaps: input.gaps.filter((g) => g.status === "offen" && g.priority === "hoch").length,
    learningOpenSteps: Math.max(0, input.learningOpenSteps),
  };
}

// Offene Lernpfad-Schritte = Schritte − erledigte (defensiv, nie negativ).
export function learningOpenSteps(
  path: { steps: readonly unknown[] } | null | undefined,
  done: readonly string[] | undefined,
): number {
  if (!path) {
    return 0;
  }
  return Math.max(0, path.steps.length - (done?.length ?? 0));
}

// ---------------------------------------------------------------------------
// MyTasks: Severity je Quelle + Gruppierung (getrennt, priorisiert)
// ---------------------------------------------------------------------------
// Quelle (typeKey) → Dringlichkeit. Nacharbeit/Konflikt = kritisch; Validierung/Revalidierung =
// heute; Wissenslücke = später. Unbekannt fällt sicher auf „später".
const SEVERITY_BY_TYPE: Record<string, WorkSeverity> = {
  "task.returned": "critical",
  "task.conflict": "critical",
  "task.validation": "today",
  "task.revalidation": "today",
  "task.gap": "later",
};

export function severityForType(typeKey: string): WorkSeverity {
  return SEVERITY_BY_TYPE[typeKey] ?? "later";
}

export interface WorkGroups<T> {
  critical: T[];
  today: T[];
  later: T[];
}

// Stabile Partitionierung nach Severity (Eingabereihenfolge bleibt je Gruppe erhalten).
export function groupTasks<T extends { severity: WorkSeverity }>(
  tasks: readonly T[],
): WorkGroups<T> {
  return {
    critical: tasks.filter((t) => t.severity === "critical"),
    today: tasks.filter((t) => t.severity === "today"),
    later: tasks.filter((t) => t.severity === "later"),
  };
}
