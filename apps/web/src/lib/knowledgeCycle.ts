// SCRUM-261: DOM-freie Beschreibung des Knowledge-OS-Kreises für die Startseite.
// Macht den vorhandenen Arbeitsfluss Capture → Validate → Use → Maintain sichtbar und führt
// AUSSCHLIESSLICH auf bereits vorhandene Routen. Keine neue Navigation, keine neuen Datenquellen,
// keine Engine — reine, testbare Datenbeschreibung. Zeigt: Klarwerk ist kein Chatbot, sondern ein
// Kreislauf aus Erfassen, Validieren, Nutzen und Aktuell-Halten.

export type CycleStepId = "capture" | "validate" | "use" | "maintain";

export interface CycleStep {
  id: CycleStepId;
  labelKey: string;
  descKey: string;
  to: string; // vorhandene Route
}

export const KNOWLEDGE_CYCLE: readonly CycleStep[] = [
  {
    id: "capture",
    labelKey: "cycle.capture.label",
    descKey: "cycle.capture.desc",
    to: "/erfassen",
  },
  {
    id: "validate",
    labelKey: "cycle.validate.label",
    descKey: "cycle.validate.desc",
    to: "/validierung",
  },
  { id: "use", labelKey: "cycle.use.label", descKey: "cycle.use.desc", to: "/fragen" },
  {
    id: "maintain",
    labelKey: "cycle.maintain.label",
    descKey: "cycle.maintain.desc",
    to: "/lebenszyklus",
  },
];
