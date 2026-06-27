// SCRUM-233: DOM-freie Ableitung eines kleinen Reasoner-Modus-Badges für den Ask-Flow.
// Nutzt ausschließlich die vorhandenen read-only Status-Metadaten (/reasoner/status):
// active/provider/mode. Keine Secrets, keine Prompt-/Antwortdaten, kein Token-/Kosten-Accounting.
import type { ReasonerStatus } from "../api/types";

export type ReasonerBadgeKind = "model" | "deterministic" | "loading" | "unknown";
export type ReasonerBadgeTone = "pos" | "warn" | "neutral";

export interface ReasonerBadge {
  kind: ReasonerBadgeKind;
  tone: ReasonerBadgeTone;
  labelKey: string; // i18n: ask.reasoner.<kind>
}

// Bildet den Query-Zustand (laden/Fehler/Daten) ehrlich auf einen Badge ab.
// Modellmodus = positiv; deterministischer Fallback = Warnung (ehrlich, kein Fehler);
// Lade-/Unbekannt-Zustand = neutral und unaufdringlich.
export function reasonerBadge(input: {
  status: Pick<ReasonerStatus, "mode"> | null | undefined;
  isLoading: boolean;
  isError: boolean;
}): ReasonerBadge {
  if (input.isLoading) {
    return { kind: "loading", tone: "neutral", labelKey: "ask.reasoner.loading" };
  }
  if (input.isError || !input.status) {
    return { kind: "unknown", tone: "neutral", labelKey: "ask.reasoner.unknown" };
  }
  return input.status.mode === "model"
    ? { kind: "model", tone: "pos", labelKey: "ask.reasoner.model" }
    : { kind: "deterministic", tone: "warn", labelKey: "ask.reasoner.deterministic" };
}
