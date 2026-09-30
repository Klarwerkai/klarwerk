// PEDI 28.09.2026 · Ergänzung 1: WESSEN Arbeitsstand liegt auf der Fragenseite?
//
// Gelesen wird die Kennung aus der Sitzungsabfrage `["auth", "me"]`, die `AuthContext` führt —
// NUR GELESEN, nicht gestartet und nicht ungültig gemacht (dieselbe Haltung wie
// `app/useOfflineQueue.ts`). Bewusst nicht über `useSession()`: das wirft ohne `AuthProvider`, und
// die Fragenseite wird in vielen Prüfungen ohne ihn montiert. Ohne Abfrage gibt es keine Kennung —
// und ohne Kennung wird kein Arbeitsstand gelesen oder geschrieben.
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import type { SessionUser } from "../api/auth";

const KONTO_ABFRAGE = ["auth", "me"] as const;

export function useKontoKennung(): string | null {
  const qc = useQueryClient();
  const abonnieren = useCallback(
    (melden: () => void) => qc.getQueryCache().subscribe(melden),
    [qc],
  );
  const lesen = useCallback((): string | null => {
    // Nur eine ERFOLGREICHE Auskunft zählt: nach einem Fehler (abgelaufene Sitzung, 401) hält
    // react-query die alten Daten fest — wie `resolveSessionUser` gilt dann niemand als angemeldet.
    const zustand = qc.getQueryState<SessionUser | null>(KONTO_ABFRAGE);
    const kennung = zustand?.status === "success" ? zustand.data?.id : undefined;
    return typeof kennung === "string" && kennung !== "" ? kennung : null;
  }, [qc]);
  return useSyncExternalStore(abonnieren, lesen, lesen);
}
