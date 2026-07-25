// AUFTRAG kimodus-live (Nachtlauf-Bug, 24.07.): EINE Quelle dafür, welche Queries den
// AI-STATE der Topbar füttern — pure, DOM-frei, damit direkt testbar und von Admin genutzt.
//
// Der KI-Modus-Badge (KiModePill), der Reasoner-Erreichbarkeits-Badge (ReasonerStatusPill) und
// die Admin-Zeile „Aktiver Provider · Modus" beziehen ihren Zustand aus zwei react-query-Queries:
//   - ["reasoner", "config"]  → Admin-Detailsicht (kiHeaderStatus): welcher Provider je Aufgabe
//   - ["reasoner", "status"]  → öffentlicher abstrahierter Status + Erreichbarkeit (Probe)
// Wird die globale KI-Zuordnung geändert und übernommen, MÜSSEN beide invalidiert werden, sonst
// zeigt die Topbar bis zum Hard-Reload den ALTEN (falschen) Modus und „lügt" im Fenster dazwischen.
//
// Die Ehrlichkeit bleibt unangetastet: Der Status-Refetch triggert serverseitig
// refreshReachabilityIfStale(); ist der neue Modus erst noch zu prüfen, zeigt der Badge ehrlich
// „ungeprüft" und löst nach der Probe auf — KEIN optimistisches Schönfärben.
import type { QueryClient } from "@tanstack/react-query";

/** Queries, die den effektiven KI-Modus in Topbar + Admin-Statuszeile speisen. */
export const AI_STATE_QUERY_KEYS = [
  ["reasoner", "config"],
  ["reasoner", "status"],
] as const;

/** Invalidiert alle AI-STATE-Queries → sofortiger Refetch, Topbar/Statuszeile live neu. */
export function invalidateAiState(qc: QueryClient): void {
  for (const queryKey of AI_STATE_QUERY_KEYS) {
    void qc.invalidateQueries({ queryKey });
  }
}
