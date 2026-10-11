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

// SCRUM-271: der „beste nächste Einstieg" aus der Arbeitsübersicht (die Geschichte darunter erklärt,
// wie er rollenbewusst wurde — und warum es ihn seit JOB 3064 H5 nicht mehr gibt).
// ================================================================================================
// AUFTRAG-mega38 BLOCK G3 — WER DARF DAS ÜBERHAUPT?
// ================================================================================================
// Die Übersicht entsteht aus GLOBALEN Signalen (alle Konflikte, das ganze Board). „Bester nächster
// Einstieg" hat daraus bisher rollenblind den dringendsten Posten gewählt — und einem Viewer
// deshalb „Konflikte lösen" empfohlen, eine Arbeit, die er auf der Zielseite gar nicht ausführen
// darf. Eine Empfehlung in eine Sackgasse ist schlimmer als keine.
// Die Zeile in der LISTE darunter bleibt für alle sichtbar (die Zahl ist eine wahre Auskunft über
// den Bestand); nur als EMPFEHLUNG erscheint sie nicht mehr bei Rollen ohne Handhabe.
//
// ================================================================================================
// AUFTRAG-mega39 BLOCK A (ben, sammel37-mega38) — DIESELBE QUELLE, NICHT EINE ZWEITE.
// ================================================================================================
// G3 hat „rollenbewusst" behauptet und dafür eine EIGENE Tabelle (`WORK_ROLES`) angelegt. Die sagte
// für `criticalGaps` und `learning` „viewer, experte" — die Ziele dieser beiden Kategorien sind
// `/risiko` und `/lebenszyklus`, und die tragen in app/navigation.ts beide `minRole: "controller"`.
// Der Router schickt eine Viewerin dort mit `<Navigate to={HOME_ROUTE}>` zurück (routes.tsx). Die
// Empfehlung führte also genau in die Sackgasse, die G3 beseitigen wollte.
//
// Die Ursache war nicht der Inhalt der Tabelle, sondern DASS es eine zweite gab. Deshalb steht hier
// keine korrigierte Liste, sondern gar keine: die Frage „darf diese Rolle dorthin?" beantwortet ab
// jetzt dieselbe Quelle, die Sidebar (`canSee`) und Router (`roleAllows`) fragen — über das
// KLICKZIEL der Kategorie. Eine neue Kategorie ist damit automatisch richtig eingestuft, und eine
// verschobene `minRole` in der Navigation zieht die Empfehlung ohne Nacharbeit mit.
//
// ENTSCHEIDUNG JE KATEGORIE (A2, Bericht): alle fünf Kategorien behalten ihr heutiges Ziel und
// werden Rollen, die dort nicht hindürfen, NICHT mehr empfohlen. Ein Ersatzziel gäbe es für keine
// von ihnen — Risiko-Board, Validierung, Konflikte und Lebenszyklus (auch der Lernpfad) sind
// vollständig Controller-Oberflächen. Für Viewer und Experte entfällt die Empfehlung damit ganz;
// die Zahlen in der Liste darunter bleiben unverändert sichtbar.
//
// R-1349 (Aufnahme gesamt-aufruferwaechter): Hier standen `canActOn` und `primaryWorkItem` — die
// hervorgehobene Einstiegszeile über der Arbeitsliste, rollengefiltert gegen `roleAllows`. Seit
// JOB 3064 H5 gibt es diese Zeile nicht mehr: das Zielbild zieht Empfehlung und Liste zu EINER
// Karte „FÜR DICH" zusammen (`components/start/forYou.ts`), die selbst nach Dringlichkeit reiht —
// eine zweite Hervorhebung derselben Sache wäre die Doppelung, die mega38 G2 beseitigt hat. Beide
// hatten danach keinen Produktaufrufer und sind entfernt, mit ihnen der mega39-Prüfstand, der allein
// sie maß. Ob „FÜR DICH" Arbeitszeilen für Ziele zeigen soll, die die Rolle nicht öffnen darf, ist
// damit nicht entschieden: mega39 hielt die Zahlen der Liste ausdrücklich für alle sichtbar und
// filterte nur die Empfehlung. Diese Frage beantwortet dieser Auftrag nicht.

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
