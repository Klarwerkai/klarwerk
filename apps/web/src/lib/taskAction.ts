// SCRUM-260: DOM-freie View-Beschreibung der nächsten Handlung je Aufgaben-Typ. Macht aus
// „Typ + Titel + Link" eine handlungsnahe Arbeitskarte im Stage-1-Kreis Capture → Validate →
// Use → Maintain. Leitet AUSSCHLIESSLICH aus dem vorhandenen `typeKey` ab — keine neue
// Task-Engine, keine Fake-Aufgaben, keine neue Mutation. Reine Funktion → testbar ohne DOM.

export type TaskTone = "crit" | "warn" | "neutral";

export interface TaskActionView {
  actionLabelKey: string; // i18n-Key für die sichtbare nächste Handlung
  tone: TaskTone; // Tönung passend zur Dringlichkeit der Quelle
  // Pedi 05.07.: kurze Klartext-Erklärung „was ist zu tun" je Aufgabe (die Karte war nicht
  // selbsterklärend). Ein Satz, direkt auf der Karte sichtbar.
  explainKey: string;
}

// Quelle (typeKey) → nächste Handlung. Bewusst an die bestehenden Ziel-Flows angelehnt:
//  - Nacharbeit    → Entwurf überarbeiten   (/wissen/:id)
//  - Konflikt      → Konflikt entscheiden    (/konflikte)
//  - Validierung   → Wissen bewerten         (/wissen/:id bzw. Validierungsboard)
//  - Revalidierung → Gültigkeit prüfen        (/lebenszyklus)
//  - Wissenslücke  → Lücke priorisieren       (/risiko)
const TASK_ACTION: Record<string, TaskActionView> = {
  "task.returned": {
    actionLabelKey: "task.action.returned",
    tone: "crit",
    explainKey: "task.explain.returned",
  },
  "task.conflict": {
    actionLabelKey: "task.action.conflict",
    tone: "crit",
    explainKey: "task.explain.conflict",
  },
  "task.validation": {
    actionLabelKey: "task.action.validation",
    tone: "warn",
    explainKey: "task.explain.validation",
  },
  "task.revalidation": {
    actionLabelKey: "task.action.revalidation",
    tone: "warn",
    explainKey: "task.explain.revalidation",
  },
  "task.gap": {
    actionLabelKey: "task.action.gap",
    tone: "neutral",
    explainKey: "task.explain.gap",
  },
};

// Defensiver Fallback für unbekannte Typen: neutral „öffnen" (keine stille Falschbehauptung).
const FALLBACK: TaskActionView = {
  actionLabelKey: "task.action.open",
  tone: "neutral",
  explainKey: "task.explain.open",
};

export function taskAction(typeKey: string): TaskActionView {
  return TASK_ACTION[typeKey] ?? FALLBACK;
}

// SCRUM-297: Knowledge-OS-Phase je Arbeit, damit Start UND MyTasks dieselbe Kreis-Sprache zeigen
// (Erfassen → Validieren → Nutzen → Aktuell halten). Reine Ableitung aus dem vorhandenen Schlüssel —
// KEINE neue Task-Engine, keine neue Datenquelle, kein neues Statusmodell. Deckt sowohl die
// MyTasks-`typeKey`s als auch die Start-Work-Overview-Keys ab → konsistente Begriffe an beiden Stellen.
export type KnowledgeOsPhase = "capture" | "validate" | "use" | "maintain";

const PHASE_BY_KEY: Record<string, KnowledgeOsPhase> = {
  // MyTasks (typeKey): Nacharbeit/Lücke = Erfassen; Validierung/Konflikt = Validieren; Reval = Aktuell halten.
  "task.returned": "capture",
  "task.gap": "capture",
  "task.validation": "validate",
  "task.conflict": "validate",
  "task.revalidation": "maintain",
  // Start (Work-Overview-Key): gleiche Zuordnung über die vorhandenen Kategorien.
  criticalGaps: "capture",
  validation: "validate",
  conflicts: "validate",
  revalidation: "maintain",
  learning: "maintain",
};

// Unbekannte Schlüssel → „validate" (Review) als sichere, ehrliche Default-Phase.
export function knowledgeOsPhase(key: string): KnowledgeOsPhase {
  return PHASE_BY_KEY[key] ?? "validate";
}

// Phase → vorhandenes Kreis-Label (cycle.*.label) — EINE Sprache für Start, MyTasks und den Kreis.
export function phaseLabelKey(phase: KnowledgeOsPhase): string {
  return `cycle.${phase}.label`;
}
