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

// ================================================================================================
// JOB 690 · D-019 — WAS ALS OFFENE ARBEIT ZÄHLT. EINE STELLE, ZWEI LESER.
// ================================================================================================
//
// DER BEFUND: Die Seitenleiste zeigte „54", die Aufgabenseite „Alle · 57". Der Badge zählte zwei
// Quellen, die Seite fünf — und beim Konflikte-Badge zählte die Leiste sogar GELÖSTE Konflikte mit,
// die die Seite herausfiltert (`MyTasks.tsx:98`). Zwei Zähler, zwei Wahrheiten.
//
// Die Regeln liegen ab hier BENANNT an einer Stelle, statt an zwei Orten gleichlautend
// abgeschrieben zu werden. Das Zusammenführen der Aufgabenseite selbst ist eine eigene Scheibe
// (D-019b, nach der Integration von JOB 688) — `MyTasks.tsx` bleibt hier unangetastet.
//
// STRUKTURELLE, NICHT IMPORTIERTE TYPEN: Dieses Modul ist DOM- und abhängigkeitsfrei (wie
// `TaskLike` oben). Es beschreibt, WAS es liest, statt `api/types` hereinzuziehen — so bleibt es im
// Node-Gate prüfbar und die Wiederverwendung an einer zweiten Fläche kostet keinen neuen Import.

/** Die schmalste Sicht auf einen Konflikt, die für diese Entscheidung reicht. */
export interface ConflictLike {
  status: string;
}

/**
 * Offen ist, was NICHT gelöst ist — bewusst als Negativform.
 *
 * `ConflictStatus` kennt vier Werte (`api/types.ts:299`): `offen`, `eskaliert`, `zweitmeinung`,
 * `geloest`. Ein eskalierter Konflikt ist Arbeit, ein Zweitmeinungsfall auch. Eine Positivliste
 * (`=== "offen"`) müsste bei jedem neuen Zustand nachgezogen werden und ließe ihn bis dahin STILL
 * aus dem Zähler fallen — genau die Klasse von Fehler, gegen die dieser Abschnitt gebaut ist.
 * Die Negativform ist zugleich exakt der Vergleich, den die Aufgabenseite fährt (`MyTasks.tsx:98`).
 */
export function isUnresolvedConflict(conflict: ConflictLike): boolean {
  return conflict.status !== "geloest";
}

/** Dieselbe Regel als Zähler. `undefined` (noch nicht geladen) ist 0 — der Ladezustand wird
 *  NICHT hier entschieden, sondern von der aufrufenden Fläche (s. `useNavBadges`). */
export function countUnresolvedConflicts(conflicts: readonly ConflictLike[] | undefined): number {
  return (conflicts ?? []).filter(isUnresolvedConflict).length;
}

/** Die schmalste Sicht auf eine Wissenslücke. */
export interface GapLike {
  status: string;
}

/**
 * Offen heißt bei Wissenslücken wörtlich `offen` — hier ist die Positivform richtig, denn der Typ
 * kennt genau zwei Werte (`offen | geschlossen`, `api/types.ts:425`) und keine Zwischenstufen.
 *
 * WARUM DER BADGE DIESEN HELFER NICHT BENUTZT, obwohl der Auftrag beide Regeln nennt: Der Badge
 * liest `useGapsSummary` (`GET /api/gaps/summary`), und dort zählt der SERVER die offenen Lücken
 * bereits. Sie hier nachzurechnen wäre die zweite Wahrheit, gegen die dieser Abschnitt gebaut ist —
 * und sie bräuchte den Volltextpfad `GET /api/gaps`, den die Shell nach FUNKE-FIX3 P0 nie laden
 * darf. Der Helfer steht deshalb für die Fläche, die die EINZELFÄLLE wirklich hat (die
 * Aufgabenseite). Beide Regeln liegen abgelegt; nur eine wird vom Badge gebraucht, und das ist
 * hier ausgeschrieben statt durch eine Scheinnutzung verdeckt.
 */
export function isOpenGap(gap: GapLike): boolean {
  return gap.status === "offen";
}
