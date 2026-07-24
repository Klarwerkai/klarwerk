// PAKET 1 (D-AISTATE, Pedi 23.07.): der reaktive Hook zur pure Kern-Ableitung (aiAvailability.ts).
// Bewusst NUR auf dem GLOBALEN, für alle Rollen lesbaren Status (/api/reasoner/status: active+mode)
// — das ist die ehrliche Aussage, die allen zusteht (Diagnose Abschnitt 1). Die admin-only per-
// Aufgabe-Auflösung (/api/reasoner/config) wird hier BEWUSST NICHT gezogen: sie bräuchte den
// Rollen-Kontext + würde für Nicht-Admins ein 403 auslösen und jeden isolierten KI-Knopf-Test an
// einen RoleProvider binden. Die feine per-Aufgabe-Zuordnung bleibt in der AiModelInfo-Blase sichtbar;
// das harte Ausgrauen folgt dem globalen „ist überhaupt ein Modell nutzbar?".
import { useReasonerStatus } from "../api/hooks";
import { type AiAvailability, deriveAiAvailable } from "./aiAvailability";

export type { AiAvailability } from "./aiAvailability";

export function useAiAvailable(task: string): AiAvailability {
  const status = useReasonerStatus();
  // „lädt" nur, solange noch kein Status vorliegt — dann NICHT vorschnell ausgrauen (kein Flackern).
  const isLoading = status.isLoading && !status.data;
  // PAKET 3 (bens V4): Kommentar und Verhalten in Einklang — WÄHREND des Ladens bleibt die Aktion
  // bedienbar (available=true), erst der echte Status entscheidet. Danach die ehrliche per-Task-
  // Ableitung (aktiv + erreichbar + Task-Policy) aus dem öffentlichen Status.
  const available = isLoading ? true : deriveAiAvailable(status.data, task);
  return { available, isLoading };
}
