import type { ReasonerConfigStatus } from "../api/types";

// SCRUM-166: DOM-freie Status-/Badge-/Warnlogik für die Reasoner-Konfigurationssicht.
// Rein abgeleitet aus den read-only Metadaten — keine Secrets, keine Prompt-/Antwortdaten.

export function isModelConfigured(status: Pick<ReasonerConfigStatus, "configured">): boolean {
  return status.configured;
}

export type ReasonerModeTone = "pos" | "warn";

// Konfiguriertes Modell = positiv; Demo/Fallback (kein echtes Modell) = Warnung (ehrlich, kein Fehler).
export function reasonerModeTone(status: Pick<ReasonerConfigStatus, "mode">): ReasonerModeTone {
  return status.mode === "model" ? "pos" : "warn";
}

// R-1349 (Aufnahme gesamt-aufruferwaechter): Hier stand `reasonerStatusSummary` (samt Ergebnistyp),
// eine Zusammenfassung der KI-Konfiguration. Die Konfigurationskarte zeigt Modus, Anbieter, Modell,
// Sprachen und Aufgaben einzeln (`pages/Stufe2.tsx`, R-0991 Nr. 54); die Zusammenfassung las niemand
// und ist entfernt.
