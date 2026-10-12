// AUFTRAG-sortfilter · Punkt 1: ehrliche Sortierung der Bibliothek-Trefferliste. Rein, DOM-frei,
// testbar. Wirkt auf die BEREITS gefilterte Treffermenge (komponiert mit den Facetten) und — bei
// aktiven Untergruppen — INNERHALB jeder Gruppe, weil die stabile Ordnung in die Gruppen-Buckets
// mitgenommen wird (groupByFacet bewahrt die Einfüge-Reihenfolge; die Gruppen-Reihenfolge selbst
// bleibt nach Größe). „Relevanz" ist der Default = die bisherige Reihenfolge (searchLibrary-Ranking),
// die anderen Optionen tragen je eine FESTE, klar benannte Richtung (kein verwirrender Umschalter).
import type { KnowledgeObject } from "../api/types";
import type { DisplayStatus } from "../components/trust/types";
import { deriveStatus } from "./displayStatus";

export const LIBRARY_SORT_KEYS = ["relevance", "title", "trust", "recent", "risk"] as const;
export type LibrarySortKey = (typeof LIBRARY_SORT_KEYS)[number];

// Default = bisherige Reihenfolge (Relevanz-Ranking aus searchLibrary), damit nichts still umsortiert.
export const DEFAULT_LIBRARY_SORT: LibrarySortKey = "relevance";

export const LIBRARY_SORT_STORAGE_KEY = "klarwerk.library.sort";

export const LIBRARY_SORT_LABEL_KEYS: Record<LibrarySortKey, string> = {
  relevance: "lib.sort.relevance",
  title: "lib.sort.title",
  trust: "lib.sort.trust",
  recent: "lib.sort.recent",
  risk: "lib.sort.risk",
};

// R-1006 (K16): „Risiko" je Wissensobjekt — kein neuer Score, sondern die vorhandene Reife-Einteilung
// (`koOverview.usabilityOf`: validiert → nutzbar; pruefung/revalidierung → in Prüfung; alles andere
// → zu prüfen): wer sich auf ein Objekt am wenigsten verlassen kann, steht oben. Innerhalb derselben
// Gruppe entscheidet das Vertrauen, niedrig zuerst. Das Bereichsrisiko der Risiko-Seite
// (`domainRisk`) gilt je Kategorie und ist hier bewusst NICHT verwendet.
//
// BEN NACHARBEIT 5: der Rang hängt am ANGEZEIGTEN Zustand, nicht am Rohstatus des Suchobjekts. Die
// Suchantwort trägt weder die erhobene Revalidierung noch die Konfliktkenntnis; die Fläche reicht
// deshalb ihre Zustandsauskunft (`auskunftFuer`, dieselbe wie Punkt, Wort und Segment) als
// `statusOf` herein. Nur ohne sie fällt der Rang auf `deriveStatus` am Objekt zurück.
const RISK_RANK: Record<DisplayStatus, number> = {
  entwurf: 0,
  offen: 0,
  abgelehnt: 0,
  konflikt: 0,
  pruefung: 1,
  revalidierung: 1,
  validiert: 2,
};

export function riskRankOf(status: DisplayStatus): number {
  return RISK_RANK[status];
}

// R-1349 (Aufnahme gesamt-aufruferwaechter): Hier stand `isLibrarySortKey`. Die Bibliothek prüft den
// gespeicherten Wert im Speicherhaken gegen `LIBRARY_SORT_KEYS`
// (`components/bibliothek/BibliothekFlaeche.tsx`, R-0991 Nr. 44); der Typwächter rief niemand und ist
// entfernt.

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
  statusOf: (item: T) => DisplayStatus = (item) => deriveStatus(koOf(item)),
): T[] {
  if (key === "relevance") {
    return items.slice();
  }
  const rank = (item: T): number => riskRankOf(statusOf(item));
  const primary = (a: T, b: T): number => {
    switch (key) {
      case "title":
        return koOf(a).title.localeCompare(koOf(b).title);
      case "trust":
        return (koOf(b).trust ?? 0) - (koOf(a).trust ?? 0);
      case "recent":
        return koChangedMs(koOf(b)) - koChangedMs(koOf(a));
      case "risk":
        return rank(a) - rank(b) || (koOf(a).trust ?? 0) - (koOf(b).trust ?? 0);
      default:
        return 0;
    }
  };
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => primary(a.item, b.item) || a.index - b.index)
    .map((entry) => entry.item);
}
