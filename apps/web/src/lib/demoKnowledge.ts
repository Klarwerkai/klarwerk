// SCRUM-308: DOM-freie Erkennung + Kennzeichnung von Demo-/Seed-Wissen. Pilotnutzer sollen
// validiertes Demo-Wissen nutzen können, es aber nicht mit produktiv erhobenem Wissen verwechseln.
// Erkennung AUSSCHLIESSLICH über den vorhandenen `tags`-Eintrag `DEMO_TAG` (kein neues Datenmodell,
// keine Migration). Der Tag wird ausschließlich im Demo-Seed gesetzt (services/app/src/seed-demo.ts);
// produktiv erfasste KOs tragen ihn nicht → werden nie fälschlich als Demo markiert.
//
// WICHTIG: Das Demo-Badge ist nur HERKUNFT/Kontext — es ersetzt NICHT Status, Trust, Quelle,
// Nutzbarkeit oder Validierung. „validiert" bleibt validiert, „offen" bleibt offen.
import type { KnowledgeObject } from "../api/types";

// Muss mit dem Literal in services/app/src/seed-demo.ts (DEMO_TAG) übereinstimmen.
export const DEMO_TAG = "pilot-demo";

export function isDemoKnowledge(ko: Pick<KnowledgeObject, "tags">): boolean {
  return (ko.tags ?? []).includes(DEMO_TAG);
}

export interface DemoKnowledgeBadge {
  labelKey: string;
  hintKey: string;
  // bewusst neutral: Herkunft, KEIN Qualitäts-/Status-/Trust-Signal.
  tone: "neutral";
}

// Liefert das Demo-Badge nur für Demo-/Seed-Wissen, sonst null (normale KOs bleiben unmarkiert).
export function demoKnowledgeBadge(ko: Pick<KnowledgeObject, "tags">): DemoKnowledgeBadge | null {
  return isDemoKnowledge(ko)
    ? { labelKey: "demo.badge.label", hintKey: "demo.badge.hint", tone: "neutral" }
    : null;
}
