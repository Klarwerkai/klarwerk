// SCRUM-293: EINE konsistente „Use-Readiness"-Sprache für KO-Detail, Library (und Ask-Bezug).
// Leitet AUSSCHLIESSLICH aus der bereits vorhandenen `KoUsability` (koOverview → Status/Trust)
// ein einheitliches Label + einen kurzen, ehrlichen Hinweis + Tönung ab. So sagen KO-Detail und
// Bibliothek für denselben Zustand DASSELBE: „Nutzbar" (validiert) · „In Prüfung" · „Zu prüfen".
// KEIN neues Statusmodell, KEINE Mutation, KEINE automatische/Fake-Validierung: „ready" heißt
// nutzbar, WEIL validiert (Status/Trust tragen) — eine einzelne Bewertung validiert nichts (SCRUM-292).
import type { KoUsability } from "./koOverview";

export type UseReadinessTone = "pos" | "warn" | "neutral";

export interface UseReadiness {
  usability: KoUsability;
  labelKey: string; // konsistentes Label (KO-Detail + Library identisch)
  hintKey: string; // kurze, ehrliche Erklärung des Zustands
  tone: UseReadinessTone;
}

const READINESS: Record<KoUsability, UseReadiness> = {
  ready: {
    usability: "ready",
    labelKey: "use.ready.label",
    hintKey: "use.ready.hint",
    tone: "pos",
  },
  "in-review": {
    usability: "in-review",
    labelKey: "use.review.label",
    hintKey: "use.review.hint",
    tone: "warn",
  },
  "needs-work": {
    usability: "needs-work",
    labelKey: "use.open.label",
    hintKey: "use.open.hint",
    tone: "neutral",
  },
};

export function useReadiness(usability: KoUsability): UseReadiness {
  return READINESS[usability];
}
