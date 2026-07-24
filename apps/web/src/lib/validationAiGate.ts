// WP-SHIP9-B3FIX (Pedis Live-Befund 23.07.): Frisch Eingereichtes erscheint auf der Validierungs-
// LISTE sofort als aktiv/„in Validierung", obwohl die Hintergrund-KI-Prüfung (aiCheck, WP-SUBMIT-
// ASYNC) noch läuft. Slice 1 hat nur die Erfolgskarte auf /erfassen ehrlich gemacht; die Liste selbst
// kannte den pending-Zustand nicht. Diese pure Logik sagt der Karte: solange die Prüfung offen ist
// (aiCheck pending), ist der Eintrag reine Anzeige — ausgegraut, Prüf-Aktionen gesperrt, ehrlicher
// Hinweis „läuft …". done/kein Prüf-Job (Altbestand) → normal aktiv; failed → NICHT gesperrt, das
// AiCheckBadge (F1-Vertrag) kennzeichnet den Fehlschlag mit Ursache + Retry.
import type { KnowledgeObject } from "../api/types";
// EINE Quelle für das pending-Prädikat — dasselbe, mit dem Capture/aiCheckStatusCard das Polling steuert.
import { aiCheckPollAgain } from "./aiCheckStatusCard";

export type ValidationAiGate =
  // Prüfung läuft (pending): reine Anzeige — Aktionen gesperrt, ehrlicher Hinweis.
  | { locked: true; noteKey: string }
  // done / failed / kein Prüf-Job: Eintrag normal bedienbar (failed bleibt via AiCheckBadge sichtbar).
  | { locked: false };

// Der ehrliche Sperr-Hinweis an der gesperrten Karte (DE/EN/NL in i18n.ts). Ohne Modell: der
// deterministische no-KI-Text; PAKET 1.4 ergänzt den „(mit KI)"-Text bei nutzbarem Modell.
export const VALIDATION_AI_LOCK_NOTE_KEY = "val.aiCheck.locked";
export const VALIDATION_AI_LOCK_NOTE_KEY_AI = "val.aiCheck.lockedAi";

// PAKET 1.4 (D-AISTATE, Pedi 23.07.): modelActive steuert nur den EHRLICHEN NAMEN des Sperr-Hinweises
// (mit KI / ohne KI) — die Sperr-LOGIK (pending → locked) bleibt unverändert.
export function validationAiGate(
  aiCheck: KnowledgeObject["aiCheck"] | null | undefined,
  modelActive = false,
): ValidationAiGate {
  return aiCheckPollAgain(aiCheck)
    ? {
        locked: true,
        noteKey: modelActive ? VALIDATION_AI_LOCK_NOTE_KEY_AI : VALIDATION_AI_LOCK_NOTE_KEY,
      }
    : { locked: false };
}

// Weiter pollen, solange MINDESTENS ein Eintrag der Liste noch in Prüfung ist — kein pending mehr,
// kein Polling (die Liste bekommt den Übergang pending → done/failed ohne manuelles Neuladen mit).
export function boardHasPendingAiCheck(
  items: readonly KnowledgeObject[] | null | undefined,
): boolean {
  return (items ?? []).some((k) => aiCheckPollAgain(k.aiCheck));
}
