// IC-1 (Import-Cockpit): READ-ONLY Erkundungs-Aggregat. Bevor irgendetwas importiert wird, fasst diese
// PURE Funktion einen Satz ImportItems zu „was ist da" zusammen — Mengen, Autoren, Themen (Labels),
// Zeitraum. Vollständig deterministisch: kein Netz, keine KI, kein Schreibzugriff, keine Modulgrenzen-
// Verletzung (kennt nur den quell-agnostischen ImportItem-Vertrag, KEIN Confluence-Symbol).

import { deriveTitleThemes } from "./themes";
import type { ImportItem } from "./types";

export interface CountEntry {
  name: string;
  count: number;
}

export interface ThemeEntry {
  label: string;
  count: number;
  // WP-IC-PAKET-1 (Teil 2): Herkunfts-Kennzeichnung — "derived" = deterministisch aus Seitentiteln
  // abgeleitet (Fallback ohne Labels). FEHLT das Feld, stammt das Thema aus echten Quell-Labels
  // (additiv, bestehende Konsumenten unverändert). Der „(ohne Label)"-Zähler trägt nie eine Herkunft.
  origin?: "derived";
}

export interface ImportExploreSummary {
  totalCount: number; // gesehene Items (bei truncated: nur bis zum Cap — der Aufrufer meldet truncated)
  distinctSources: number; // verschiedene Quell-Container (sourceScope, sonst category)
  authors: CountEntry[]; // absteigend nach count, dann Name; „(ohne Autor)" als eigener Eintrag
  themes: ThemeEntry[]; // Labels/Tags absteigend nach count, dann Label; „(ohne Label)" als Zähler
  dateRange: { earliest: string; latest: string } | null; // aus updatedAt, null wenn keins vorhanden
  withImagesHint: number; // Items, deren bodyHtml ein <img enthält (grober Bild-Hinweis), sonst 0
  // WP-IC-PAKET-1 (Teil 3): die Quell-Container NAMENTLICH (für den Space-Filter, wenn mehrere) —
  // additiv; distinctSources bleibt als Zahl erhalten.
  sourceNames: CountEntry[];
}

// Stabile Platzhalter für fehlende Werte — sprach-neutral genug für die Kern-Aggregation; die UI kann
// sie lokalisieren. Bewusst als eigene Einträge (nicht verschwiegen), damit „was ist da" ehrlich bleibt.
export const NO_AUTHOR_LABEL = "(ohne Autor)";
export const NO_THEME_LABEL = "(ohne Label)";

// Sortiert Zähler-Einträge absteigend nach count, bei Gleichstand alphabetisch (deterministisch);
// optional auf die Top-N begrenzt (limit <= 0 oder undefined → alle).
function rankCounts(counts: Map<string, number>, limit?: number): CountEntry[] {
  const entries = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return limit !== undefined && limit > 0 ? entries.slice(0, limit) : entries;
}

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

// Grober Bild-Hinweis: enthält das bodyHtml ein <img-Tag? Bewusst simpel (Read-only-Schätzung, keine
// HTML-Parser-Abhängigkeit) — case-insensitiv auf den Tag-Anfang.
function hasImage(item: ImportItem): boolean {
  return typeof item.bodyHtml === "string" && /<img\b/i.test(item.bodyHtml);
}

export interface SummarizeOptions {
  // Top-N-Begrenzung für Autoren-/Themen-Listen (undefined/<=0 → alle).
  topAuthors?: number;
  topThemes?: number;
}

export function summarizeImportItems(
  items: readonly ImportItem[],
  options: SummarizeOptions = {},
): ImportExploreSummary {
  const sources = new Map<string, number>();
  const authors = new Map<string, number>();
  const themes = new Map<string, number>();
  // WP-IC-PAKET-1 (Teil 2): Herkunft je Themen-Label — echte Labels haben Vorrang; nur rein
  // abgeleitete Labels werden als "derived" gekennzeichnet.
  const derivedOnly = new Set<string>();
  let noTheme = 0;
  let earliest: string | null = null;
  let latest: string | null = null;
  let withImagesHint = 0;

  // WP-IC-PAKET-1 (Teil 2): Items OHNE Labels bekommen deterministisch aus den Titeln abgeleitete
  // Themen-Gruppen (Mindestgröße 2); der Rest bleibt ehrlich „(ohne Label)". Die Ableitung läuft NUR
  // über die label-losen Items — echte Labels bleiben die unangetastete Wahrheit.
  const untagged = items.filter(
    (it) => (it.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0).length === 0,
  );
  const derivedByTitle = new Map<ImportItem, string | null>();
  const derivedLabels = deriveTitleThemes(untagged.map((it) => it.title));
  untagged.forEach((it, i) => {
    derivedByTitle.set(it, derivedLabels[i] ?? null);
  });

  for (const item of items) {
    const scope = (item.sourceScope ?? item.category ?? "").trim();
    if (scope.length > 0) {
      increment(sources, scope);
    }

    const author = item.author?.trim();
    increment(authors, author && author.length > 0 ? author : NO_AUTHOR_LABEL);

    const labels = (item.tags ?? []).map((tag) => tag.trim()).filter((tag) => tag.length > 0);
    if (labels.length === 0) {
      const derived = derivedByTitle.get(item) ?? null;
      if (derived !== null) {
        if (!themes.has(derived)) {
          derivedOnly.add(derived);
        }
        increment(themes, derived);
      } else {
        noTheme += 1;
      }
    } else {
      for (const label of labels) {
        derivedOnly.delete(label); // echtes Label schlägt die abgeleitete Herkunft
        increment(themes, label);
      }
    }

    const when = item.updatedAt?.trim();
    if (when && when.length > 0) {
      // ISO-Zeitstempel sind lexikografisch vergleichbar; kein Date-Parsing nötig (deterministisch,
      // zeitzonen-neutral gegenüber dem Roh-String, wie ihn die Quelle liefert).
      if (earliest === null || when < earliest) {
        earliest = when;
      }
      if (latest === null || when > latest) {
        latest = when;
      }
    }

    if (hasImage(item)) {
      withImagesHint += 1;
    }
  }

  const themeEntries: ThemeEntry[] = rankCounts(themes, options.topThemes).map((e) => ({
    label: e.name,
    count: e.count,
    // WP-IC-PAKET-1 (Teil 2): nur rein abgeleitete Themen tragen die Herkunft (additiv).
    ...(derivedOnly.has(e.name) ? { origin: "derived" as const } : {}),
  }));
  if (noTheme > 0) {
    themeEntries.push({ label: NO_THEME_LABEL, count: noTheme });
  }

  return {
    totalCount: items.length,
    distinctSources: sources.size,
    authors: rankCounts(authors, options.topAuthors),
    themes: themeEntries,
    dateRange: earliest !== null && latest !== null ? { earliest, latest } : null,
    withImagesHint,
    sourceNames: rankCounts(sources),
  };
}
