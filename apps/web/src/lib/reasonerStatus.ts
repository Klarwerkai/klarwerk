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

export interface ReasonerStatusSummary {
  configured: boolean;
  mode: ReasonerConfigStatus["mode"];
  provider: string;
  model: string | null;
  fallbackAvailable: boolean;
  localeCount: number;
  taskCount: number;
}

export function reasonerStatusSummary(status: ReasonerConfigStatus): ReasonerStatusSummary {
  return {
    configured: status.configured,
    mode: status.mode,
    provider: status.provider,
    model: status.model ?? null,
    fallbackAvailable: status.fallbackAvailable,
    localeCount: status.supportsLocales.length,
    taskCount: status.tasks.length,
  };
}
