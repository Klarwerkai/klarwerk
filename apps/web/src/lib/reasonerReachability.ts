// PAKET 2 (D-AISTATE, Pedi 23.07.): pure, testbare Ableitung des „Reasoner"-Badge-Zustands aus dem
// ehrlichen Erreichbarkeits-Signal (nicht mehr nur „konfiguriert"). „aktiv/grün" NUR, wenn ein
// Modell zuletzt WIRKLICH erreichbar war; konfiguriert-aber-ungeprüft → gelb; nicht erreichbar →
// rot; kein Modell → grau. DOM-frei — die Topbar rendert nur das Ergebnis.
import type { ReasonerStatus } from "../api/types";

export type ReasonerReachability = "none" | "unverified" | "active" | "unreachable";

export interface ReachabilityBadge {
  tone: "pos" | "warn" | "crit" | "neutral";
  labelKey: string;
  hintKey: string;
}

export function reasonerReachabilityBadge(
  status: Pick<ReasonerStatus, "active" | "reachable"> | undefined,
): ReachabilityBadge {
  // Rückwärtskompatibel: fehlt `reachable` (ältere Antwort/Fixture), NICHT vorschnell grün —
  // konfiguriert (active) → „ungeprüft" (gelb), sonst „offline" (grau).
  const state: ReasonerReachability = status?.reachable ?? (status?.active ? "unverified" : "none");
  switch (state) {
    case "active":
      return {
        tone: "pos",
        labelKey: "topbar.reasonerActive",
        hintKey: "topbar.reasonerActiveHint",
      };
    case "unverified":
      return {
        tone: "warn",
        labelKey: "topbar.reasonerUnverified",
        hintKey: "topbar.reasonerUnverifiedHint",
      };
    case "unreachable":
      return {
        tone: "crit",
        labelKey: "topbar.reasonerUnreachable",
        hintKey: "topbar.reasonerUnreachableHint",
      };
    default:
      return {
        tone: "neutral",
        labelKey: "topbar.reasonerOffline",
        hintKey: "topbar.reasonerOfflineHint",
      };
  }
}
