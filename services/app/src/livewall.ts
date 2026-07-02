import type { KnowledgeObject } from "../../knowledge-object";

// Audit-P4 (SCRUM-398): Live-Wall — „frisch gesichert / hat heute geholfen".
// Reine, DOM-freie Aggregation aus VORHANDENEN Daten (KO-Bestand + answer.helpful-Audit).
// Ehrlich: keine Scores, keine Ranglisten, keine erfundenen Zahlen — nur echte Ereignisse
// mit Zeitstempel (EK-19-Richtung, wie PMO-FEA-0002).

export interface LiveWallSavedItem {
  koId: string;
  title: string;
  author: string;
  at: string;
  status: "offen" | "validiert";
}

export interface LiveWallHelpedItem {
  koId: string;
  title: string;
  at: string;
}

export interface LiveWall {
  saved: LiveWallSavedItem[];
  helped: LiveWallHelpedItem[];
  // Anzahl „hat geholfen"-Ereignisse mit Datum von `today` (Kalendertag, ISO-Präfix).
  helpedToday: number;
}

const DEFAULT_LIMIT = 6;

// `today` wird hereingereicht (testbar, keine versteckte Uhr): ISO-Datum "YYYY-MM-DD".
export function buildLiveWall(input: {
  kos: KnowledgeObject[];
  helpful: Array<{ target: string; at: string; payload: Record<string, unknown> }>;
  today: string;
  limit?: number;
}): LiveWall {
  const limit = input.limit && input.limit > 0 && input.limit <= 20 ? input.limit : DEFAULT_LIMIT;
  const saved = [...input.kos]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .map((ko) => ({
      koId: ko.id,
      title: ko.title,
      author: ko.author,
      at: ko.createdAt,
      status: ko.status,
    }));
  // Nur Einträge mit echtem Titel-Payload — nichts erfinden, nichts Halbes anzeigen.
  const helpedAll = input.helpful
    .filter((e) => typeof e.payload.koTitle === "string")
    .map((e) => ({ koId: e.target, title: e.payload.koTitle as string, at: e.at }))
    .sort((a, b) => b.at.localeCompare(a.at));
  return {
    saved,
    helped: helpedAll.slice(0, limit),
    helpedToday: helpedAll.filter((e) => e.at.startsWith(input.today)).length,
  };
}
