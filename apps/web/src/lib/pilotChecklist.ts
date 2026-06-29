// SCRUM-305: DOM-freie, EINE Quelle der Wahrheit für die In-App-Pilot-Checkliste (erster Nutzerlauf).
// Ordnet die ehrlichen Stage-1-Prüfpunkte entlang Capture → Validation → Use → Gap → Maintain und
// verweist AUSSCHLIESSLICH auf vorhandene App-Routen. Kein Backend, kein Tracking, keine Feedback-DB,
// keine neue Route/Engine. Reine i18n-Datenbeschreibung — testbar ohne DOM/i18n/React.

export interface PilotCheckItem {
  id: string;
  n: number; // 1-basierte Reihenfolge im Pilotlauf
  labelKey: string; // i18n-Key für den ehrlichen Prüfpunkt
  to: string; // vorhandene App-Route zum Ausprobieren
}

// Reihenfolge = Pilot-Reihenfolge. Jede Aussage bleibt Stage-1-ehrlich (kein Stage-2-Versprechen):
//  1. Erfassen speichert OFFEN (nicht validiert)
//  2. Validierung ist Review/Entscheidung (keine Auto-Freigabe)
//  3. Fragen/Bibliothek nutzen Wissen quellen-/statusbewusst
//  4. Keine Grundlage → ehrliche Lücke führt in die Erfassung (kein erfundenes Wissen)
//  5. Revalidierung ist „Aktuell halten" (keine automatische Dauergültigkeit)
export const PILOT_CHECKLIST: readonly PilotCheckItem[] = [
  { id: "capture", n: 1, labelKey: "pilot.check.capture", to: "/erfassen" },
  { id: "validation", n: 2, labelKey: "pilot.check.validation", to: "/validierung" },
  { id: "use", n: 3, labelKey: "pilot.check.use", to: "/fragen" },
  { id: "gap", n: 4, labelKey: "pilot.check.gap", to: "/risiko" },
  { id: "maintain", n: 5, labelKey: "pilot.check.maintain", to: "/lebenszyklus" },
];

export function pilotChecklist(): readonly PilotCheckItem[] {
  return PILOT_CHECKLIST;
}
