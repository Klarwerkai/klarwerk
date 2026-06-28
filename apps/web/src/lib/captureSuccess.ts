// SCRUM-276: DOM-freie nächste Schritte nach erfolgreichem Erfassen. Nach dem Speichern eines
// Knowledge Objects zeigt Capture „gespeichert" + die echten nächsten Schritte im Kernfluss:
// das KO ansehen (/wissen/:id) und/oder zur Validierung (/validierung). Keine automatische
// Validierung, keine Fake-Erledigung — nur Orientierung auf vorhandene Routen.

export interface CaptureNextStep {
  labelKey: string;
  to: string; // vorhandene Route
}

export function captureNextSteps(koId: string): CaptureNextStep[] {
  return [
    { labelKey: "capture.savedViewKo", to: `/wissen/${koId}` },
    { labelKey: "capture.savedValidate", to: "/validierung" },
  ];
}
