// AUFTRAG-mega67 BLOCK G: der reaktive Hook zur puren Kern-Ableitung (aiAvailability.ts,
// deriveAiBillable) — „kostet ein Klick auf DIESE Aufgabe wirklich etwas?".
//
// Er lebt getrennt von der puren Ableitung, aus demselben Grund wie `useAiAvailable.tsx`: eine
// `.ts`-lib darf keine `.tsx` importieren (der Wurzel-Build läuft ohne jsx).
//
// AUFRUFEN NUR, WO EIN REACT-QUERY-CLIENT GARANTIERT IST. Der Kostenhinweis selbst (AiCostHint)
// ruft ihn bewusst NICHT — er sitzt als Blatt auch in Bäumen ohne Provider (Editor,
// Bildbeschreibungs-Formulare). Dort kommt der Boolean von oben herein.
import { useReasonerStatus } from "../api/hooks";
import type { ReasonerTask } from "../api/types";
import { deriveAiBillable } from "./aiAvailability";

// JOB 615 D7: geschlossener Aufgabentyp, auch in der Mehrfachform (s. useAiAvailable.tsx).
export function useAiBillable(task: ReasonerTask | readonly ReasonerTask[]): boolean {
  const status = useReasonerStatus();
  return deriveAiBillable(status.data, task);
}
