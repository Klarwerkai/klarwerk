// IC-2 (Import-Cockpit): PURE View-Model-Aufbereitung der READ-ONLY Erkundung „was ist da". Nimmt die
// ImportExploreSummary (IC-1) und formt daraus die Anzeige-Landkarte: formatierte Kennzahlen, gedeckelte
// Autoren-/Themen-Listen mit ehrlichem „+N weitere". Deterministisch, DOM-frei, ohne i18n-Abhängigkeit
// (die Komponente übersetzt Labels/Fallbacks) — reine Daten-zu-Anzeige-Logik, unit-testbar.

import type { ImportExploreSummary } from "../api/types";

export const EXPLORE_TOP_AUTHORS = 8;
export const EXPLORE_TOP_THEMES = 12;

// Sprach-neutrale Platzhalter, wie IC-1 (services/library-analytics) sie in authors/themes einsetzt.
// Bewusst hier gespiegelt (kein Service-Runtime-Import im Browser-Bundle) — die Komponente bildet sie
// auf lokalisierte Anzeigetexte ab. Muss mit dem Server-Kontrakt übereinstimmen.
export const NO_AUTHOR_LABEL = "(ohne Autor)";
export const NO_THEME_LABEL = "(ohne Label)";

export interface ExploreAuthorView {
  name: string;
  count: number;
}

export interface ExploreThemeChip {
  label: string;
  count: number;
}

export interface ExploreView {
  totalCount: number;
  distinctSources: number;
  // Zeitraum als Jahres-Spanne ("2019–2026", ein Jahr → "2026") oder "—", wenn kein Datum vorlag.
  period: string;
  authors: ExploreAuthorView[]; // gedeckelt auf EXPLORE_TOP_AUTHORS
  authorsRest: number; // wie viele Autoren NICHT in der Liste sind (> 0 → „+N weitere")
  themes: ExploreThemeChip[]; // gedeckelt auf EXPLORE_TOP_THEMES
  themesRest: number;
  withImagesHint: number; // Items mit Bildern (0 → die Komponente blendet den Hinweis aus)
}

const EMPTY_PERIOD = "—";

// Jahr aus einem ISO-Zeitstempel (führende 4 Ziffern). Kein Date-Parsing (deterministisch,
// zeitzonen-neutral); ungültige/kurze Werte → null.
function isoYear(iso: string): string | null {
  const match = /^(\d{4})/.exec(iso.trim());
  return match ? (match[1] ?? null) : null;
}

// Zeitraum als Jahres-Spanne. Kein Datum → "—". Gleiches Start-/Endjahr → nur ein Jahr. Sonst
// "früh–spät" (mit Gedankenstrich). earliest/latest kommen bereits sortiert aus IC-1.
export function formatPeriod(dateRange: { earliest: string; latest: string } | null): string {
  if (!dateRange) {
    return EMPTY_PERIOD;
  }
  const from = isoYear(dateRange.earliest);
  const to = isoYear(dateRange.latest);
  if (!from || !to) {
    return EMPTY_PERIOD;
  }
  return from === to ? from : `${from}–${to}`;
}

export function toExploreView(summary: ImportExploreSummary): ExploreView {
  const authors = summary.authors.slice(0, EXPLORE_TOP_AUTHORS);
  const themes = summary.themes.slice(0, EXPLORE_TOP_THEMES);
  return {
    totalCount: summary.totalCount,
    distinctSources: summary.distinctSources,
    period: formatPeriod(summary.dateRange),
    authors: authors.map((a) => ({ name: a.name, count: a.count })),
    authorsRest: Math.max(0, summary.authors.length - authors.length),
    themes: themes.map((t) => ({ label: t.label, count: t.count })),
    themesRest: Math.max(0, summary.themes.length - themes.length),
    withImagesHint: summary.withImagesHint,
  };
}
