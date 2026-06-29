// SCRUM-306: DOM-freie, EINE Quelle der Wahrheit für die Operator-Next-Steps nach dem Demodaten-/
// Pilot-Start. Macht sichtbar, wohin es weitergeht — Stage-1 ansehen/starten, Pilot-Checkliste öffnen,
// optional die demo-sichere Beispiel-Frage. Verweist AUSSCHLIESSLICH auf vorhandene App-Routen
// (Start `/start`, Hilfe `/hilfe`, Ask-Deep-Link aus dem bestehenden Demo-Pilotpfad). Keine
// automatische Navigation, keine neue Route/Seed-Logik, kein Backend, kein Tracking.
import { DEMO_PILOT_PATH } from "./demoPilotPath";

export interface PilotNextStep {
  id: string;
  labelKey: string; // i18n-Key für die sichtbare nächste Handlung
  to: string; // vorhandene App-Route
}

// Reihenfolge = Anzeigereihenfolge: zuerst Stage-1 öffnen, dann die Checkliste, dann optional die
// vorbereitete Beispiel-Frage (demo-sicher, kein Auto-Submit; Deep-Link stammt aus DEMO_PILOT_PATH).
export const PILOT_NEXT_STEPS: readonly PilotNextStep[] = [
  { id: "start", labelKey: "pilot.next.start", to: "/start" },
  { id: "checklist", labelKey: "pilot.next.checklist", to: "/hilfe" },
  { id: "ask", labelKey: "pilot.next.ask", to: DEMO_PILOT_PATH[0]?.to ?? "/fragen" },
];

export function pilotNextSteps(): readonly PilotNextStep[] {
  return PILOT_NEXT_STEPS;
}
