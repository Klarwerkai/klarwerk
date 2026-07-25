// AUFTRAG-sortfilter · Punkt 1: ehrliche Sortierung der Bibliothek-Trefferliste. Rein, DOM-frei,
// testbar. Wirkt auf die BEREITS gefilterte Treffermenge (komponiert mit den Facetten) und — bei
// aktiven Untergruppen — INNERHALB jeder Gruppe, weil die stabile Ordnung in die Gruppen-Buckets
// mitgenommen wird (groupByFacet bewahrt die Einfüge-Reihenfolge; die Gruppen-Reihenfolge selbst
// bleibt nach Größe). „Relevanz" ist der Default = die bisherige Reihenfolge (searchLibrary-Ranking),
// die anderen Optionen tragen je eine FESTE, klar benannte Richtung (kein verwirrender Umschalter).
import type { KnowledgeObject } from "../api/types";

export const LIBRARY_SORT_KEYS = ["relevance", "title", "trust", "recent"] as const;
export type LibrarySortKey = (typeof LIBRARY_SORT_KEYS)[number];

// Default = bisherige Reihenfolge (Relevanz-Ranking aus searchLibrary), damit nichts still umsortiert.
export const DEFAULT_LIBRARY_SORT: LibrarySortKey = "relevance";

export const LIBRARY_SORT_STORAGE_KEY = "klarwerk.library.sort";

export const LIBRARY_SORT_LABEL_KEYS: Record<LibrarySortKey, string> = {
  relevance: "lib.sort.relevance",
  title: "lib.sort.title",
  trust: "lib.sort.trust",
  recent: "lib.sort.recent",
};

export function isLibrarySortKey(value: unknown): value is LibrarySortKey {
  return typeof value === "string" && (LIBRARY_SORT_KEYS as readonly string[]).includes(value);
}

// Ehrliches „zuletzt geändert" (ms): jüngster History-Eintrag, sonst das Erstell-Datum. Kein neues
// Backend-Feld — beide Werte liegen bereits im KO. Unbekannte/kaputte Daten sinken ans Ende (0).
export function koChangedMs(ko: KnowledgeObject): number {
  let ms = Date.parse(ko.createdAt ?? "");
  for (const entry of ko.history ?? []) {
    const at = Date.parse(entry.at ?? "");
    if (Number.isFinite(at) && (!Number.isFinite(ms) || at > ms)) {
      ms = at;
    }
  }
  return Number.isFinite(ms) ? ms : 0;
}

// Stabile Sortierung der (bereits gefilterten) Treffer. „relevance" gibt die eingehende Reihenfolge
// unverändert zurück (kopiert, verändert nie das Original). Sonst wird eine Kopie stabil sortiert:
// der Original-Index ist der letzte Tie-Breaker, damit gleichrangige Treffer ihre Relevanz-Ordnung
// behalten (kein Wackeln bei gleichem Titel/Trust/Datum).
export function sortLibrary<T>(
  items: readonly T[],
  key: LibrarySortKey,
  koOf: (item: T) => KnowledgeObject,
): T[] {
  if (key === "relevance") {
    return items.slice();
  }
  const primary = (a: T, b: T): number => {
    switch (key) {
      case "title":
        return koOf(a).title.localeCompare(koOf(b).title);
      case "trust":
        return (koOf(b).trust ?? 0) - (koOf(a).trust ?? 0);
      case "recent":
        return koChangedMs(koOf(b)) - koChangedMs(koOf(a));
      default:
        return 0;
    }
  };
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => primary(a.item, b.item) || a.index - b.index)
    .map((entry) => entry.item);
}
