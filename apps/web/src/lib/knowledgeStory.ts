// SCRUM-377: DOM-freie, app-weite „Knowledge-Rescue"-Story für leere/erste Zustände. Erzählt über
// mehrere Kernflächen hinweg dieselbe ruhige Kernbotschaft — Klarwerk sichert Erfahrungswissen,
// bevor es verloren geht — und ordnet jede Fläche in den Knowledge-OS-Kreis (Erfassen → Validieren →
// Nutzen → Aktuell halten) ein, damit Capture → Review → Use verständlicher wird. Leere Zustände sind
// dadurch keine Sackgassen, sondern zeigen den nächsten sinnvollen Schritt (die echten Routen liefern
// die vorhandenen EmptyState-CTAs). Ehrlich: nichts wird automatisch validiert — Wissen gilt erst nach
// der Prüfung als gesichert. KEIN Score, KEINE Punkte/Gamification, KEIN Backend, kein DOM, keine
// Mutation. Reine Daten/i18n-Ableitung; wiederverwendet die vorhandene Kreissprache (phaseLabelKey).

import { type KnowledgeOsPhase, phaseLabelKey } from "./taskAction";

// Die vier Kernflächen mit echten leeren/ersten Zuständen (identisch zu EmptyStateContext).
export type StorySurface = "start" | "tasks" | "library" | "validation";

export const KNOWLEDGE_STORY_SURFACES: readonly StorySurface[] = [
  "start",
  "tasks",
  "library",
  "validation",
] as const;

// Jede Fläche steht für eine reale Phase im Knowledge-OS-Kreis — dieselbe Sprache wie Start/MyTasks.
const SURFACE_PHASE: Record<StorySurface, KnowledgeOsPhase> = {
  start: "capture", // Einstieg: den Kreis mit Erfassen starten.
  tasks: "validate", // persönliche Prüf-/Nacharbeits-Warteschlange.
  library: "use", // gesichertes Wissen quellengebunden nutzen.
  validation: "validate", // Team-Prüfung, bevor Wissen als gesichert gilt.
};

export interface KnowledgeStory {
  // Geteilte Kernbotschaft (Rescue-Story) — auf allen Flächen gleich.
  titleKey: string;
  // Flächenspezifische, ehrliche Einordnung des leeren/ersten Zustands + nächster sinnvoller Sinn.
  leadKey: string;
  // Phase im Knowledge-OS-Kreis, für die diese Fläche steht.
  phase: KnowledgeOsPhase;
  // Kreis-Label der Phase (cycle.<phase>.label) — EINE Vokabel über die ganze App.
  phaseLabelKey: string;
  // Ehrlicher Dauerhinweis: nichts wird automatisch validiert.
  honestKey: string;
}

export function knowledgeStory(surface: StorySurface): KnowledgeStory {
  const phase = SURFACE_PHASE[surface];
  return {
    titleKey: "story.rescue.title",
    leadKey: `story.surface.${surface}.lead`,
    phase,
    phaseLabelKey: phaseLabelKey(phase),
    honestKey: "story.honest",
  };
}
