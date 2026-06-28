// SCRUM-290: DOM-freier Demo-/Pilotpfad durch Stage-1. Führt Pilot-/Demo-Nutzer in wenigen
// Schritten durch einen kleinen, realen Ablauf und macht sichtbar, dass Klarwerk KEIN Chatbot ist,
// sondern ein Knowledge OS: quellengebunden fragen → Quelle/Trust/Status/Version sehen → bei
// ungeprüftem Wissen zur Validierung. Verweist AUSSCHLIESSLICH auf vorhandene Routen — keine neue
// Navigation, keine Suche, kein Backend, keine Engine, kein neues Statusmodell. Reine, testbare
// Datenbeschreibung; baut auf der SCRUM-289-Guidance (gesichert vs. zu prüfen) auf.
import { askQuestionHref } from "./askQuestion";

// SCRUM-275/290: demo-sichere Startfrage — trifft das validierte Seed-Wissen (Ventil X / Überdruck)
// → quellengebundene Antwort statt Lücke. Ask füllt damit nur das Eingabefeld vor (kein Auto-Submit).
const DEMO_QUESTION = "Wann muss Ventil X bei Überdruck geschlossen werden?";

export type DemoPilotStepId = "ask" | "library" | "validation";

export interface DemoPilotStep {
  id: DemoPilotStepId;
  n: number; // 1-basierte Schrittnummer (für die Anzeige)
  labelKey: string;
  descKey: string;
  to: string; // vorhandene Route
}

// Schritt 1 Ask (quellengebunden) → Schritt 2 Library/KO-Detail (Quelle/Trust/Status/Version)
// → Schritt 3 Validation (offenes/ungeprüftes Wissen prüfen). Start ist der Einstieg (diese Karte).
export const DEMO_PILOT_PATH: readonly DemoPilotStep[] = [
  {
    id: "ask",
    n: 1,
    labelKey: "demo.ask.label",
    descKey: "demo.ask.desc",
    to: askQuestionHref(DEMO_QUESTION),
  },
  {
    id: "library",
    n: 2,
    labelKey: "demo.library.label",
    descKey: "demo.library.desc",
    to: "/bibliothek",
  },
  {
    id: "validation",
    n: 3,
    labelKey: "demo.validation.label",
    descKey: "demo.validation.desc",
    to: "/validierung",
  },
];

export function demoPilotPath(): readonly DemoPilotStep[] {
  return DEMO_PILOT_PATH;
}
