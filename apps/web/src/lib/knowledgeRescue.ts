// SCRUM-352: DOM-freie Beschreibung des geführten „Knowledge Rescue"-Einstiegs. Erzählt die Kernstory
// (Erfahrungswissen sichern, bevor es verloren geht) als drei ruhige, geführte Schritte und macht den
// Wertbeitrag leichtgewichtig sichtbar — OHNE Gamification, Punkte, Scoring oder neue Architektur.
// Reine Daten/i18n-Beschreibung, an die bestehende Knowledge-OS-Kreissprache (Erfassen → Validieren →
// Nutzen → Aktuell halten) angelehnt. Kein DOM, keine Mutation, keine Funktion wird entfernt.

import type { KnowledgeOsPhase } from "./taskAction";

export type KnowledgeRescueStepId = "tell" | "structure" | "validate";

export interface KnowledgeRescueStep {
  id: KnowledgeRescueStepId;
  labelKey: string;
  hintKey: string;
  // An die echte Phase im Knowledge-OS-Kreis gebunden (gleiche Sprache wie Start/MyTasks).
  phase: KnowledgeOsPhase;
}

// Feste Reihenfolge = geführter Ablauf: erzählen → KI strukturiert → prüfen lassen.
export const KNOWLEDGE_RESCUE_STEPS: readonly KnowledgeRescueStep[] = [
  {
    id: "tell",
    labelKey: "capture.rescue.step.tell.label",
    hintKey: "capture.rescue.step.tell.hint",
    phase: "capture",
  },
  {
    id: "structure",
    labelKey: "capture.rescue.step.structure.label",
    hintKey: "capture.rescue.step.structure.hint",
    phase: "capture",
  },
  {
    id: "validate",
    labelKey: "capture.rescue.step.validate.label",
    hintKey: "capture.rescue.step.validate.hint",
    phase: "validate",
  },
];

export function knowledgeRescueSteps(): readonly KnowledgeRescueStep[] {
  return KNOWLEDGE_RESCUE_STEPS;
}

export function rescueStepLabelKey(id: KnowledgeRescueStepId): string {
  return `capture.rescue.step.${id}.label`;
}

export type KnowledgeRescueImpactId = "secure" | "improve" | "honest";

export interface KnowledgeRescueImpact {
  id: KnowledgeRescueImpactId;
  labelKey: string;
}

// Leichtgewichtiger Wertbeitrag: warum der Beitrag zählt — und ehrlich, dass er erst nach Validierung
// gesichert ist. KEIN Score, KEINE Punkte, KEINE Rolle — nur Anzeige-Text.
export const KNOWLEDGE_RESCUE_IMPACT: readonly KnowledgeRescueImpact[] = [
  { id: "secure", labelKey: "capture.rescue.impact.secure" },
  { id: "improve", labelKey: "capture.rescue.impact.improve" },
  { id: "honest", labelKey: "capture.rescue.impact.honest" },
];

export function knowledgeRescueImpact(): readonly KnowledgeRescueImpact[] {
  return KNOWLEDGE_RESCUE_IMPACT;
}
