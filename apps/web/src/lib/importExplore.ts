// IC-2 (Import-Cockpit): PURE View-Model-Aufbereitung der READ-ONLY Erkundung „was ist da". Nimmt die
// ImportExploreSummary (IC-1) und formt daraus die Anzeige-Landkarte: formatierte Kennzahlen, gedeckelte
// Autoren-/Themen-Listen mit ehrlichem „+N weitere". Deterministisch, DOM-frei, ohne i18n-Abhängigkeit
// (die Komponente übersetzt Labels/Fallbacks) — reine Daten-zu-Anzeige-Logik, unit-testbar.

import type { ImportExploreSummary, ImportSelectCriteria } from "../api/types";

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
  // WP-IC-PAKET-1 (Teil 2): true = deterministisch aus Seitentiteln abgeleitet (dezent gekennzeichnet).
  derived: boolean;
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
  // WP-SAMMEL20-FIX (bens Fix 6b): der Server liefert nur noch die Top-N (Wire-Deckel) plus
  // GESAMTZAHLEN — für die ehrliche „Top 20 von 134"-Zeile. listed = Länge der Server-Liste;
  // total = echte Gesamtzahl (Altbestands-Antworten ohne Zähler → Listenlänge, Anzeige entfällt).
  authorsListed: number;
  authorsTotal: number;
  themesListed: number;
  themesTotal: number;
  withImagesHint: number; // Items mit Bildern (0 → die Komponente blendet den Hinweis aus)
  // WP-IC-PAKET-1 (Teil 3): Quell-Container (Spaces) namentlich — Filter-Chips nur bei MEHREREN.
  spaces: ExploreAuthorView[];
  // WP-IC-PAKET-1c (ROT-2): true = alle Namen kanonisch dekodiert (Decode-Marker der Summary) —
  // die Chip-Anzeige dekodiert dann NICHT erneut (kein Doppel-Dekodieren echter Literale).
  textDecoded: boolean;
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

// IC-3: die EFFEKTIV benutzten Auswahl-Kriterien als lesbare Zeilen — macht transparent, wie ein
// Freitext-Prompt verstanden wurde. Leere Kriterien → leere Liste (die Komponente zeigt „alles").
// Reine Formatierung; die Übersetzung der Feld-Bezeichner macht der Aufrufer via labels-Parameter.
export interface CriteriaLabels {
  themes: string;
  authors: string;
  keywords: string;
  years: string;
  limit: string;
  // WP-IC-PAKET-1 (Teil 3): Space-Filter-Zeile.
  spaces: string;
}

export function summarizeSelectCriteria(
  criteria: ImportSelectCriteria,
  labels: CriteriaLabels,
): string[] {
  const lines: string[] = [];
  if (criteria.themes && criteria.themes.length > 0) {
    lines.push(`${labels.themes}: ${criteria.themes.join(", ")}`);
  }
  if (criteria.authors && criteria.authors.length > 0) {
    lines.push(`${labels.authors}: ${criteria.authors.join(", ")}`);
  }
  if (criteria.spaces && criteria.spaces.length > 0) {
    lines.push(`${labels.spaces}: ${criteria.spaces.join(", ")}`);
  }
  if (criteria.keywords && criteria.keywords.length > 0) {
    lines.push(`${labels.keywords}: ${criteria.keywords.join(", ")}`);
  }
  if (criteria.yearFrom !== undefined || criteria.yearTo !== undefined) {
    const from = criteria.yearFrom ?? "…";
    const to = criteria.yearTo ?? "…";
    lines.push(`${labels.years}: ${from}–${to}`);
  }
  if (criteria.limit !== undefined) {
    lines.push(`${labels.limit}: ${criteria.limit}`);
  }
  return lines;
}

export function toExploreView(summary: ImportExploreSummary): ExploreView {
  const authors = summary.authors.slice(0, EXPLORE_TOP_AUTHORS);
  const themes = summary.themes.slice(0, EXPLORE_TOP_THEMES);
  // WP-SAMMEL20-FIX (bens Fix 6b): der Rest rechnet gegen die ECHTE Gesamtzahl (Server-Zähler),
  // nicht gegen die gedeckelte Wire-Liste — sonst wäre „+N weitere" nach dem Server-Deckel gelogen.
  const authorsTotal = summary.authorsTotal ?? summary.authors.length;
  const themesTotal = summary.topicsTotal ?? summary.themes.length;
  return {
    totalCount: summary.totalCount,
    distinctSources: summary.distinctSources,
    period: formatPeriod(summary.dateRange),
    authors: authors.map((a) => ({ name: a.name, count: a.count })),
    authorsRest: Math.max(0, authorsTotal - authors.length),
    // WP-IC-PAKET-1 (Teil 2): abgeleitete Themen ehrlich gekennzeichnet weiterreichen.
    themes: themes.map((t) => ({
      label: t.label,
      count: t.count,
      derived: t.origin === "derived",
    })),
    themesRest: Math.max(0, themesTotal - themes.length),
    authorsListed: summary.authors.length,
    authorsTotal,
    themesListed: summary.themes.length,
    themesTotal,
    withImagesHint: summary.withImagesHint,
    // WP-IC-PAKET-1 (Teil 3): Spaces namentlich (Altbestand-Antworten ohne Feld → leer, kein Filter).
    spaces: (summary.sourceNames ?? []).map((s) => ({ name: s.name, count: s.count })),
    // WP-IC-PAKET-1c (ROT-2): Marker der Summary durchreichen (fehlt er → defensiver Anzeige-Decode).
    textDecoded: summary.textCodec === "decoded",
  };
}
