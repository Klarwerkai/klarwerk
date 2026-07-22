// WP-COCKPIT-LINIE (Pedis VIP2-Klarstellung, 22.07.): der Import-Weg ist EINE gerade, geführte
// Linie in fünf Schritten — Quelle · Erkunden · Eingrenzen · Gruppen freigeben · Übernehmen &
// Bilanz. Diese pure Logik (DOM-frei, im Node-Gate testbar) bildet den Fortschritt ab: welcher
// Schritt ist erledigt, welcher aktiv, welcher kommt noch. Die BESTEHENDEN Bausteine melden nur
// ihre Meilensteine; hier wird daraus der Zustand der Schritt-Leiste abgeleitet.

// Die fünf Schritte des abgenommenen Konzepts, in Lauf-Reihenfolge.
export const IMPORT_STEPS = ["source", "explore", "narrow", "groups", "apply"] as const;
export type ImportStep = (typeof IMPORT_STEPS)[number];

// Erreichte Stufe des Flusses (Meilensteine der Bausteine):
//   start     — noch nichts passiert (Quelle wählen ist der aktive Schritt)
//   explored  — die Landkarte der Quelle ist da (Erkundung gelaufen)
//   previewed — eine Auswahl-Vorschau ist da (Eingrenzung gelaufen)
//   grouping  — die Gruppen-Freigabe ist sichtbar
//   applied   — die Übernahme ist gelaufen, die Bilanz steht
export type ImportStage = "start" | "explored" | "previewed" | "grouping" | "applied";

const STAGE_RANK: Record<ImportStage, number> = {
  start: 0,
  explored: 1,
  previewed: 2,
  grouping: 3,
  applied: 4,
};

// Aktiver Schritt (0-basiert) je Stufe. "start" hält Schritt 1 (Quelle) aktiv; nach der Landkarte
// ist Eingrenzen dran (Quelle + Erkunden erledigt); nach der Vorschau die Gruppen-Freigabe;
// "applied" liegt HINTER dem letzten Schritt — alles erledigt, nichts mehr aktiv.
const ACTIVE_INDEX: Record<ImportStage, number> = {
  start: 0,
  explored: 2,
  previewed: 3,
  grouping: 3,
  applied: IMPORT_STEPS.length,
};

// Monoton: einmal Erreichtes fällt nie zurück. Remounts einzelner Bausteine (z. B. eine geänderte
// Eingrenzung setzt die Gruppierung zurück) dürfen den roten Faden nicht rückwärts reißen.
export function maxStage(a: ImportStage, b: ImportStage): ImportStage {
  return STAGE_RANK[b] > STAGE_RANK[a] ? b : a;
}

export type ImportStepStatus = "done" | "active" | "upcoming";

export function importStepStatus(stage: ImportStage, step: ImportStep): ImportStepStatus {
  const index = IMPORT_STEPS.indexOf(step);
  const active = ACTIVE_INDEX[stage];
  if (index < active) {
    return "done";
  }
  return index === active ? "active" : "upcoming";
}

// Flache Copy-Schlüssel — EINE Quelle für Leiste, Schritt-Karten und Tests (Muster IMPORT_GROUPS_TEXT).
export const IMPORT_STEP_TEXT: Record<ImportStep, { title: string; hint: string }> = {
  source: { title: "imp.step.source", hint: "imp.step.sourceHint" },
  explore: { title: "imp.step.explore", hint: "imp.step.exploreHint" },
  narrow: { title: "imp.step.narrow", hint: "imp.step.narrowHint" },
  groups: { title: "imp.step.groups", hint: "imp.step.groupsHint" },
  apply: { title: "imp.step.apply", hint: "imp.step.applyHint" },
};
