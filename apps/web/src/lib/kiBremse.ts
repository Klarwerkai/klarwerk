import { ApiError } from "../api/client";

// Aufnahme gesamt-integrations-api (R-0842): hat die KI-Bremse des Servers abgewiesen
// (`KI_ANFRAGEN_GEBREMST`, services/app/src/ki-anfragebremse.ts), steht in der Meldung ein
// verständlicher Satz MIT Wartezeit in der Sprache der Anfrage. Diese Hilfe liefert genau diesen
// Satz — oder `null` für jeden anderen Fehler, der dann seinen bisherigen Text behält.
export const KI_ANFRAGEN_GEBREMST = "KI_ANFRAGEN_GEBREMST";

export function kiBremsSatz(fehler: unknown): string | null {
  return fehler instanceof ApiError && fehler.code === KI_ANFRAGEN_GEBREMST && fehler.message
    ? fehler.message
    : null;
}
