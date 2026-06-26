// SCRUM-158: DOM-freie Aufgaben-Typ-Filter für „Meine Aufgaben". Leitet rein aus den
// vorhandenen Task-typeKeys ab — keine neue Workflow-Semantik, keine Backend-Abfrage.
export type TaskFilterKey = "all" | "validation" | "returned" | "conflict" | "gap" | "revalidation";

export interface TaskLike {
  typeKey: string;
}

// Reihenfolge = Anzeigereihenfolge der Filter-Chips. Leere typeKeys = „alle".
export const TASK_FILTERS: readonly { key: TaskFilterKey; typeKeys: readonly string[] }[] = [
  { key: "all", typeKeys: [] },
  { key: "validation", typeKeys: ["task.validation"] },
  { key: "returned", typeKeys: ["task.returned"] },
  { key: "conflict", typeKeys: ["task.conflict"] },
  { key: "gap", typeKeys: ["task.gap"] },
  { key: "revalidation", typeKeys: ["task.revalidation"] },
];

export function matchesTaskFilter(task: TaskLike, key: TaskFilterKey): boolean {
  const filter = TASK_FILTERS.find((f) => f.key === key);
  // Unbekannter Filter oder „all" (leere Liste) → alles sichtbar (keine stille Ausblendung).
  if (!filter || filter.typeKeys.length === 0) {
    return true;
  }
  return filter.typeKeys.includes(task.typeKey);
}

export function filterTasks<T extends TaskLike>(tasks: readonly T[], key: TaskFilterKey): T[] {
  return tasks.filter((task) => matchesTaskFilter(task, key));
}

// Ehrlicher Zähler je Filter (für die Chips) — „all" = Gesamtzahl.
export function countTasksByFilter(tasks: readonly TaskLike[]): Record<TaskFilterKey, number> {
  const counts = {} as Record<TaskFilterKey, number>;
  for (const { key } of TASK_FILTERS) {
    counts[key] = key === "all" ? tasks.length : filterTasks(tasks, key).length;
  }
  return counts;
}
