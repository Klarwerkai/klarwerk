// SCRUM-175: DOM-freier View-Mapper für die kompakte KO-Detail-Freshness-Anzeige.
// Bildet den read-only Freshness-Status (aus analyzeEvidenceFreshness, SCRUM-174) auf
// Ton + i18n-Schlüssel ab — keine eigene Freshness-Logik, kein DOM.
import type { EvidenceFreshnessStatus } from "./evidenceFreshness";

export type EvidenceFreshnessTone = "pos" | "warn" | "neutral";

// current = belegt (positiv); outdated/missing = ehrliche Warnung; neutral = kein Anlass.
export function evidenceFreshnessTone(status: EvidenceFreshnessStatus): EvidenceFreshnessTone {
  if (status === "current") {
    return "pos";
  }
  if (status === "neutral") {
    return "neutral";
  }
  return "warn";
}

export function evidenceFreshnessLabelKey(status: EvidenceFreshnessStatus): string {
  return `ko.evFresh.${status}`;
}
