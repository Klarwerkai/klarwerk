// PAKET 2 (D-AISTATE, Pedi 23.07.): pure, testbare Ableitung der Header-Pille „Extern" (Achse 1 —
// externe Wissensabfrage), klar GETRENNT vom Reasoner-Badge (Achse 2, KI-Modell). „Extern aus" darf
// nicht länger als „KI aus" fehlgedeutet werden: Web-Suche ≠ KI-Modell. DOM-frei — Topbar rendert nur.
import type { ExternalKnowledgeStage } from "../api/types";

export interface ExternalStagePill {
  tone: "neutral" | "warn";
  labelKey: string;
  hintKey: string;
}

// R-0908: der Hinweis kommt aus `texte/websuche.ts` — der frühere Wert von `topbar.external.hint`
// endete auf dem Fachwort „Reasoner", das die übrige Kopfzeile längst „KI-Modell" nennt.
const HINWEIS_KEY = "websuche.hinweis";

export function externalStagePill(stage: ExternalKnowledgeStage | undefined): ExternalStagePill {
  switch (stage) {
    case "blocked":
      return {
        tone: "neutral",
        labelKey: "topbar.external.blocked",
        hintKey: HINWEIS_KEY,
      };
    case "open":
      return { tone: "warn", labelKey: "topbar.external.open", hintKey: HINWEIS_KEY };
    // search_on_click / search_attach: beide sind „Suche" (die Anhängen-Nuance lebt im Admin/Tooltip).
    default:
      return { tone: "warn", labelKey: "topbar.external.search", hintKey: HINWEIS_KEY };
  }
}
