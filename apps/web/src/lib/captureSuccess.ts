// SCRUM-276: DOM-freie nächste Schritte nach erfolgreichem Erfassen. Nach dem Speichern eines
// Knowledge Objects zeigt Capture „gespeichert" + die echten nächsten Schritte im Kernfluss:
// das KO ansehen (/wissen/:id) und/oder zur Validierung (/validierung). Keine automatische
// Validierung, keine Fake-Erledigung — nur Orientierung auf vorhandene Routen.
//
// SCRUM-286: zusätzlich ehrlicher Status direkt nach dem Speichern — das KO ist gespeichert, aber
// noch OFFEN (nicht validiert) und gilt erst nach ausreichender Bewertung als nutzbares Wissen.
// Der Weg zur Validierung/Prüfung ist die betonte nächste Handlung (primary). KEIN neuer Status,
// keine Engine, keine automatische Validierung/Nutzung — nur klare Orientierung im Kreis
// Capture → Validate → Use.

import { libraryOriginHref, validationOriginHref } from "./demoKnowledge";

export interface CaptureNextStep {
  labelKey: string;
  to: string; // vorhandene Route
  primary?: boolean; // betonte nächste Handlung (Review/Validierung)
}

export function captureNextSteps(koId: string): CaptureNextStep[] {
  return [
    { labelKey: "capture.savedViewKo", to: `/wissen/${koId}` },
    // SCRUM-310: frisch erfasstes Wissen in der Bibliothek wiederfinden — gefiltert auf
    // eigenes/nicht-Demo-Wissen (ohne Demo-Tag). Nur Auffinden/Übersicht, KEINE Validierung,
    // keine Autor-/User-Zuordnung. Nicht betont (Review bleibt primär).
    { labelKey: "capture.savedViewLibrary", to: libraryOriginHref("non-demo") },
    // SCRUM-286: Validierung/Prüfung ist die betonte nächste Handlung.
    // SCRUM-311: direkt ins Board, vorgefiltert auf eigenes/nicht-Demo-Wissen — keine Vermischung
    // mit Demo-Beispielen. Bleibt die primäre Handlung; Filter ist nur Ansicht, keine Auto-Validierung.
    { labelKey: "capture.savedValidate", to: validationOriginHref("non-demo"), primary: true },
  ];
}

// SCRUM-286: ehrlicher Status-Hinweis für die Success-Card. Reine i18n-Schlüssel (DOM-frei,
// testbar): das frisch erfasste KO ist „offen / noch nicht validiert" und wird erst nach
// ausreichender Bewertung nutzbares Wissen. Kein abgeleiteter Live-Status nötig — direkt nach
// Capture ist ein neues KO per Definition offen (status: "offen").
export interface CaptureSavedStatus {
  badgeKey: string; // kurzer Statuschip: „offen — noch nicht validiert"
  hintKey: string; // erklärt: erst nach Bewertung nutzbar → zur Prüfung geben
}

export function captureSavedStatus(): CaptureSavedStatus {
  return { badgeKey: "capture.savedStatusBadge", hintKey: "capture.savedBody" };
}
