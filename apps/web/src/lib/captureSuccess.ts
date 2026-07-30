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

import { type Role, routePathAllows } from "../app/navigation";
import { libraryOriginHref, validationOriginHref } from "./demoKnowledge";

export interface CaptureNextStep {
  labelKey: string;
  to: string; // vorhandene Route
  primary?: boolean; // betonte nächste Handlung
}

// AUFTRAG-mega70 BLOCK C (bens Befund): `/validierung` war für JEDE Rolle fest als `primary`
// markiert — für eine Expertin der dunkel hervorgehobene Hauptknopf direkt nach ihrem ersten
// Erfolg, und der Router weist sie dort zurück. Die betonte Handlung richtet sich jetzt nach dem,
// was die Rolle darf; die Frage beantwortet `routePathAllows` — dieselbe Registry, aus der der
// Router sein Gate zieht. Kann die Rolle nicht validieren, wird das Objekt-Ansehen betont; der
// Validierungs-Schritt BLEIBT in der Liste (Block B rendert ihn über RoleLink als sichtbare,
// nicht begehbare Lage), damit der Prozess verständlich bleibt.
export function captureNextSteps(koId: string, role: Role): CaptureNextStep[] {
  const validateTo = validationOriginHref("non-demo");
  const darfValidieren = routePathAllows(validateTo, role);
  return [
    { labelKey: "capture.savedViewKo", to: `/wissen/${koId}`, primary: !darfValidieren },
    // SCRUM-310: frisch erfasstes Wissen in der Bibliothek wiederfinden — gefiltert auf
    // eigenes/nicht-Demo-Wissen (ohne Demo-Tag). Nur Auffinden/Übersicht, KEINE Validierung,
    // keine Autor-/User-Zuordnung. Nie betont.
    { labelKey: "capture.savedViewLibrary", to: libraryOriginHref("non-demo") },
    // SCRUM-286: Validierung/Prüfung ist die betonte nächste Handlung — wenn die Rolle sie tun kann.
    // SCRUM-311: direkt ins Board, vorgefiltert auf eigenes/nicht-Demo-Wissen — keine Vermischung
    // mit Demo-Beispielen. Filter ist nur Ansicht, keine Auto-Validierung.
    { labelKey: "capture.savedValidate", to: validateTo, primary: darfValidieren },
  ];
}

// SCRUM-286: ehrlicher Status-Hinweis für die Success-Card. Reine i18n-Schlüssel (DOM-frei,
// testbar): das frisch erfasste KO ist „offen / noch nicht validiert" und wird erst nach
// ausreichender Bewertung nutzbares Wissen. Kein abgeleiteter Live-Status nötig — direkt nach
// Capture ist ein neues KO per Definition offen (status: "offen").
export interface CaptureSavedStatus {
  badgeKey: string; // kurzer Statuschip: „offen — noch nicht validiert"
  // AUFTRAG-mega70 BLOCK C: erklärt den Prozess (erst nach Bewertung in der Validierung nutzbar),
  // ohne zu einer Handlung aufzufordern, die die Rolle womöglich nicht tun kann.
  hintKey: string;
}

export function captureSavedStatus(): CaptureSavedStatus {
  return { badgeKey: "capture.savedStatusBadge", hintKey: "capture.savedBody" };
}
