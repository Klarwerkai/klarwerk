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

// SCRUM-309: client-seitiger HERKUNFTS-Filter für die Bibliothek — ERGÄNZEND zum Reife-/Maturity-
// Filter und zur Suche, NICHT als Ersatz für Status/Trust/Nutzbarkeit. Nutzt dieselbe Erkennung wie
// das Demo-Badge (isDemoKnowledge → DEMO_TAG), also keine zweite Logik. Keine Suche, kein Backend.
export type DemoKnowledgeFilter = "all" | "demo" | "non-demo";

export const DEMO_KNOWLEDGE_FILTERS: readonly DemoKnowledgeFilter[] = ["all", "demo", "non-demo"];

// Filtert eine Trefferliste (alles mit `.ko`) nach Herkunft. „all" lässt unverändert (keine stille
// Ausblendung); „demo" nur Demo-/Seed-Wissen; „non-demo" nur produktiv/eigenes Wissen (ohne Demo-Tag).
export function filterByDemoKnowledge<T extends { ko: Pick<KnowledgeObject, "tags"> }>(
  items: readonly T[],
  filter: DemoKnowledgeFilter,
): T[] {
  if (filter === "all") {
    return [...items];
  }
  const wantDemo = filter === "demo";
  return items.filter((item) => isDemoKnowledge(item.ko) === wantDemo);
}

// Ehrliche Zähler je Herkunft (für die Chips). „all" = Gesamtzahl; demo + non-demo = all.
export function countByDemoKnowledge<T extends { ko: Pick<KnowledgeObject, "tags"> }>(
  items: readonly T[],
): Record<DemoKnowledgeFilter, number> {
  const counts: Record<DemoKnowledgeFilter, number> = { all: items.length, demo: 0, "non-demo": 0 };
  for (const item of items) {
    if (isDemoKnowledge(item.ko)) {
      counts.demo += 1;
    } else {
      counts["non-demo"] += 1;
    }
  }
  return counts;
}

// i18n-Label je Herkunftsfilter (bewusst Herkunft, KEINE Qualitätsaussage).
export function demoKnowledgeFilterLabelKey(filter: DemoKnowledgeFilter): string {
  switch (filter) {
    case "demo":
      return "lib.demoFilter.demo";
    case "non-demo":
      return "lib.demoFilter.nonDemo";
    default:
      return "lib.demoFilter.all";
  }
}
