// SCRUM-261: DOM-freie Beschreibung des Knowledge-OS-Kreises für die Startseite.
// Macht den vorhandenen Arbeitsfluss Capture → Validate → Use → Maintain sichtbar und führt
// AUSSCHLIESSLICH auf bereits vorhandene Routen. Keine neue Navigation, keine neuen Datenquellen,
// keine Engine — reine, testbare Datenbeschreibung. Zeigt: Klarwerk ist kein Chatbot, sondern ein
// Kreislauf aus Erfassen, Validieren, Nutzen und Aktuell-Halten.
import { askQuestionHref } from "./askQuestion";

// SCRUM-275: demo-sichere Startfrage für den „Use"-Schritt. Enthält die Seed-Tokens (Ventil X /
// Überdruck) und trifft damit das deutschsprachige validierte Demo-Wissen → quellengebundene
// Antwort statt Lücke. Ask füllt damit nur das Eingabefeld vor (kein Auto-Submit).
const USE_QUESTION = "Wann muss Ventil X bei Überdruck geschlossen werden?";

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
  {
    id: "use",
    labelKey: "cycle.use.label",
    descKey: "cycle.use.desc",
    // SCRUM-275: in den Ask-Flow mit demo-sicherer Startfrage (vorhandene Route /fragen).
    to: askQuestionHref(USE_QUESTION),
  },
  {
    id: "maintain",
    labelKey: "cycle.maintain.label",
    descKey: "cycle.maintain.desc",
    to: "/lebenszyklus",
  },
];
