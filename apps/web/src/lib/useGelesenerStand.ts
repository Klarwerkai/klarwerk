import { useSyncExternalStore } from "react";
import { type Objektbezug, gelesenenStandAbonnieren, gelesenerStandJetzt } from "./objektbezug";

/** Der Stand, den die Lesefläche zuletzt gemeldet hat (`lib/objektbezug.ts`). */
export function useGelesenerStand(): Objektbezug | null {
  return useSyncExternalStore(gelesenenStandAbonnieren, gelesenerStandJetzt, gelesenerStandJetzt);
}
