// AUFTRAG-sortfilter · Punkt 2: ehrliche Filterung + Sortierung der Entwurfsliste („Entwürfe
// fortsetzen"). Rein, DOM-frei, testbar. Kein neuer Egress — arbeitet nur auf den bereits geladenen
// Entwürfen (gemeinsamer Pool). Die Suche ist eine Volltext-/Titelsuche (Titel + Aussage + Fließtext),
// der Ersteller-Filter greift nur in der Admin-Ansicht („ALLE ENTWÜRFE"). Leerer Filter = alle.
import type { Draft } from "../api/types";
import { draftTitle } from "./draftForm";

export const DRAFT_SORT_KEYS = ["recent", "oldest", "title"] as const;
export type DraftSortKey = (typeof DRAFT_SORT_KEYS)[number];

// Default = zuletzt gespeichert (neu→alt): frisch bearbeitete Entwürfe stehen oben.
export const DEFAULT_DRAFT_SORT: DraftSortKey = "recent";

export const DRAFT_SORT_STORAGE_KEY = "klarwerk.capture.drafts.sort";
export const DRAFT_QUERY_STORAGE_KEY = "klarwerk.capture.drafts.query";
export const DRAFT_AUTHOR_STORAGE_KEY = "klarwerk.capture.drafts.author";

export const DRAFT_SORT_LABEL_KEYS: Record<DraftSortKey, string> = {
  recent: "capture.draftSort.recent",
  oldest: "capture.draftSort.oldest",
  title: "capture.draftSort.title",
};

export function isDraftSortKey(value: unknown): value is DraftSortKey {
  return typeof value === "string" && (DRAFT_SORT_KEYS as readonly string[]).includes(value);
}

// „Zuletzt gespeichert" (ms): updatedAt, sonst createdAt. Unbekannt/kaputt → 0 (sinkt ans Ende).
export function draftSavedMs(draft: Draft): number {
  const ms = Date.parse(draft.updatedAt || draft.createdAt || "");
  return Number.isFinite(ms) ? ms : 0;
}

// Durchsuchbarer Volltext eines Entwurfs: Titel + Aussage + enttaggter Fließtext (bodyHtml). Rein
// String-basiert (kein DOM) — Tags werden grob entfernt, damit die Suche den sichtbaren Text trifft.
function draftSearchText(draft: Draft, titleFallback: string): string {
  const payload = draft.payload;
  const parts = [
    draftTitle(draft, titleFallback),
    payload.title ?? "",
    payload.statement ?? "",
    (payload.bodyHtml ?? "").replace(/<[^>]*>/g, " "),
  ];
  return parts.join(" ").toLowerCase();
}

export interface DraftListFilter {
  // Volltext-/Titelsuche (leer = alle).
  query: string;
  // Ersteller-Id (leer = alle) — nur in der Admin-Ansicht befüllt.
  author: string;
}

// Filtert die Entwürfe nach Volltext-Suche UND (optional) Ersteller. Beide leer = unveränderte Liste.
export function filterDrafts(
  drafts: readonly Draft[],
  filter: DraftListFilter,
  titleFallback: string,
): Draft[] {
  const query = filter.query.trim().toLowerCase();
  const author = filter.author.trim();
  return drafts.filter((draft) => {
    if (author && draft.originalAuthor !== author) {
      return false;
    }
    if (query && !draftSearchText(draft, titleFallback).includes(query)) {
      return false;
    }
    return true;
  });
}

// Stabile Sortierung; der Original-Index ist der letzte Tie-Breaker (kein Wackeln bei Gleichstand).
export function sortDrafts(
  drafts: readonly Draft[],
  key: DraftSortKey,
  titleFallback: string,
): Draft[] {
  const primary = (a: Draft, b: Draft): number => {
    switch (key) {
      case "recent":
        return draftSavedMs(b) - draftSavedMs(a);
      case "oldest":
        return draftSavedMs(a) - draftSavedMs(b);
      case "title":
        return draftTitle(a, titleFallback).localeCompare(draftTitle(b, titleFallback));
      default:
        return 0;
    }
  };
  return drafts
    .map((draft, index) => ({ draft, index }))
    .sort((a, b) => primary(a.draft, b.draft) || a.index - b.index)
    .map((entry) => entry.draft);
}

// Filtern + Sortieren in einem Schritt (die Sicht der Entwurfsliste).
export function draftListView(
  drafts: readonly Draft[],
  opts: { filter: DraftListFilter; sort: DraftSortKey },
  titleFallback: string,
): Draft[] {
  return sortDrafts(filterDrafts(drafts, opts.filter, titleFallback), opts.sort, titleFallback);
}

// Ersteller-Auswahl für den Admin-Filter: eindeutige Ersteller-Ids in stabiler Erst-Vorkommen-Ordnung.
// Die Namen löst die Oberfläche über das Directory auf (Fallback = Id, nie ein erfundener Name).
export function draftCreatorIds(drafts: readonly Draft[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const draft of drafts) {
    const id = draft.originalAuthor;
    if (id && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}
