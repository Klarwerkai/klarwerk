// WP-SHIP9-S1 (Pedis B3): Die Bestätigungs-Karte auf /erfassen behauptete nach dem Einreichen
// mit einem STATISCHEN Hinweis, die KI-Prüfung laufe im Hintergrund — ohne den echten Job-Status
// (aiCheck pending/done/failed, WP-SUBMIT-ASYNC) je nachzulesen. Diese pure Logik bildet den
// TATSÄCHLICHEN Server-Zustand auf den Karten-Text ab: „läuft" NUR solange kein Ergebnis vorliegt,
// der Wechsel kommt ausschließlich vom echten Ergebnis, ein Fehlschlag heißt ehrlich fehlgeschlagen
// mit Ursache (F1-Vertrag — dieselben Ursachen-Keys wie das AiCheckBadge der Validierung).
import type { KnowledgeObject } from "../api/types";

// Ursache → i18n-Key (ehrlich benannt): ohne aktives Modell wurde nichts geprueft (no-model);
// WP-SHIP8-FINAL (bens Bedingung 2): timeout (Job-Frist ueberschritten) und queue-overflow
// (Warteschlangen-Kappe) sind eigene, ehrliche Ursachen. WP-SHIP8-CLOSE (bens F1): model-timeout
// (das MODELL antwortete nicht rechtzeitig) eigenständig. Unbekannt/fehlend → model-error.
// WP-SHIP9-S1 (Pedis B3): aus AiCheckBadge.tsx HIERHER gezogen (lib importiert keine .tsx —
// Root-Build ohne jsx); das Badge importiert die Funktion jetzt von hier. EINE Quelle für
// Validierungs-Badge UND Bestätigungs-Karte.
export function aiCheckFailureReasonKey(fallbackReason: string | undefined): string {
  if (fallbackReason === "no-model") {
    return "val.aiCheck.reason.no-model";
  }
  if (fallbackReason === "timeout") {
    return "val.aiCheck.reason.timeout";
  }
  if (fallbackReason === "model-timeout") {
    return "val.aiCheck.reason.model-timeout";
  }
  if (fallbackReason === "queue-overflow") {
    return "val.aiCheck.reason.queue-overflow";
  }
  return "val.aiCheck.reason.model-error";
}

// Flache Copy-Schlüssel — EINE Quelle für Komponente + Test (Muster CAPTURE_FILE_TEXT).
export const AI_CHECK_CARD_TEXT = {
  running: "capture.aiCheck.running",
  done: "capture.aiCheck.done",
  failed: "capture.aiCheck.failed",
} as const;

// Poll-Intervall der Karte: schnell genug für den Kurz-Check (Sekunden bis wenige Minuten),
// sparsam genug, um den Server nicht zu belasten.
export const AI_CHECK_POLL_MS = 3000;

export type AiCheckCardState =
  | { kind: "running" }
  | { kind: "done" }
  | { kind: "failed"; reasonKey: string }
  // Kein Prüf-Job vermerkt (Altbestand / Deployment ohne Worker): NICHTS behaupten —
  // weder „läuft" noch ein stilles Grün.
  | { kind: "none" };

export function aiCheckCardState(
  aiCheck: KnowledgeObject["aiCheck"] | null | undefined,
): AiCheckCardState {
  if (!aiCheck) {
    return { kind: "none" };
  }
  if (aiCheck.status === "failed") {
    return { kind: "failed", reasonKey: aiCheckFailureReasonKey(aiCheck.fallbackReason) };
  }
  if (aiCheck.status === "done") {
    return { kind: "done" };
  }
  return { kind: "running" };
}

// Weiter pollen NUR solange der echte Status offen ist — done/failed/none beenden das Polling.
export function aiCheckPollAgain(aiCheck: KnowledgeObject["aiCheck"] | null | undefined): boolean {
  return aiCheck?.status === "pending";
}
