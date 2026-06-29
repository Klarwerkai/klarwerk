// SCRUM-307: DOM-freie, EINE Quelle der Wahrheit für die Einordnung beobachteter Pilot-Reibungen in
// die BESTEHENDEN Knowledge-OS-Flows. Pilotführer sehen damit: „so etwas beobachtet → gehört in
// diesen vorhandenen Klarwerk-Fluss". Verweist NUR auf vorhandene Routen; reine UX-/Pilotnotizen
// bekommen bewusst KEINEN Produktlink (to: null) und keine (Fake-)Speicherung. Kein Backend, keine
// Feedback-DB, kein Tracking, keine Jira-/Task-Automatik. Reine i18n-Datenbeschreibung — testbar.

export interface PilotObservation {
  id: string;
  labelKey: string; // i18n-Key: was im Pilotlauf beobachtet wurde (die Reibung)
  mapKey: string; // i18n-Key: in welchen bestehenden Fluss das gehört
  to: string | null; // vorhandene App-Route; null = bewusst kein Produktlink (organisatorisch notieren)
}

// Kategorien (Reihenfolge = Anzeigereihenfolge):
//  - missing    Fehlendes Wissen        → Gap/Risk bzw. Capture (Risiko-Board)
//  - unverified Unfertig/ungeprüft       → Validation
//  - outdated   Veraltetes Wissen        → Lifecycle/Revalidation
//  - source     Unklare Quelle/Trust/Nutzbarkeit → Library/KO-Detail (Einstieg /bibliothek, keine Fake-ID)
//  - uxnote     Reine UX-/Pilotnotiz      → organisatorisch notieren, KEIN Produktfluss (to: null)
export const PILOT_OBSERVATIONS: readonly PilotObservation[] = [
  {
    id: "missing",
    labelKey: "pilot.obs.missing.label",
    mapKey: "pilot.obs.missing.map",
    to: "/risiko",
  },
  {
    id: "unverified",
    labelKey: "pilot.obs.unverified.label",
    mapKey: "pilot.obs.unverified.map",
    to: "/validierung",
  },
  {
    id: "outdated",
    labelKey: "pilot.obs.outdated.label",
    mapKey: "pilot.obs.outdated.map",
    to: "/lebenszyklus",
  },
  {
    id: "source",
    labelKey: "pilot.obs.source.label",
    mapKey: "pilot.obs.source.map",
    to: "/bibliothek",
  },
  { id: "uxnote", labelKey: "pilot.obs.uxnote.label", mapKey: "pilot.obs.uxnote.map", to: null },
];

export function pilotObservationGuide(): readonly PilotObservation[] {
  return PILOT_OBSERVATIONS;
}
