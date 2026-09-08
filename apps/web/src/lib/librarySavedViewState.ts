import { type BibSegment, bibSegmentAus } from "../components/bibliothek/zustand";
import { type FacetRange, facetRangeFromSaved } from "./facetRail";
import { type FacetSelection, isFacetNoMatch } from "./facets";
import {
  LIBRARY_GROUP_KEYS,
  type LibraryGroupKey,
  foldStatusIntoMaturity,
  migrateSavedFacetSelection,
} from "./libraryFacets";
import { type LibraryScope, parseLibraryScope } from "./libraryOwnScope";

export type LibrarySavedViewState = {
  q: string;
  facetSel: FacetSelection;
  range: FacetRange;
  groupBy: LibraryGroupKey;
  segment: BibSegment;
  scope: LibraryScope;
};

// UX-29 C: Jede gespeicherte Dimension muss auch im sichtbaren Speicherhinweis vorkommen.
export const LIBRARY_SAVED_VIEW_DIMENSIONS = {
  q: "lib.views.dimension.q",
  facetSel: "lib.views.dimension.facetSel",
  range: "lib.views.dimension.range",
  groupBy: "lib.views.dimension.groupBy",
  segment: "lib.views.dimension.segment",
  scope: "lib.views.dimension.scope",
} as const satisfies Record<keyof LibrarySavedViewState, string>;

// P04: Alt-Sichten ohne Segment/Geltungsbereich verwenden die Seitenstandards alle/alle.
// Das schränkt keine alte Treffermenge nachträglich ein; „alle“ umfasst ausschließlich die
// serverseitig erlaubten Inhalte. Freie Ortskennungen werden nie als Scope übernommen.
// Statusmigration und strukturelles No-Match bleiben erhalten, auch wenn Werte inzwischen
// nicht mehr im Bestand vorkommen (eine gespeicherte leere Auswahl darf nicht breiter werden).
export function readLibrarySavedViewState(
  state: Record<string, unknown>,
  facetKeys: readonly string[],
): LibrarySavedViewState {
  const migrated = foldStatusIntoMaturity(migrateSavedFacetSelection(state));
  return {
    q: typeof state.q === "string" ? state.q : "",
    facetSel: Object.fromEntries(
      Object.entries(migrated).filter(([key]) => facetKeys.includes(key)),
    ),
    range: facetRangeFromSaved(state),
    groupBy: LIBRARY_GROUP_KEYS.find((key) => key === state.groupBy) ?? "none",
    segment: bibSegmentAus(typeof state.segment === "string" ? state.segment : null),
    scope: parseLibraryScope(typeof state.scope === "string" ? state.scope : null),
  };
}

function facetKey(selection: FacetSelection): string {
  // Echte Mengen, keine Klickreihenfolge. JSON hält Wertgrenzen eindeutig; weder Trennzeichen
  // in einem Namen noch der frühere No-Match-String können einen gleichen Zustand vortäuschen.
  return JSON.stringify(
    Object.entries(selection)
      .filter(([, values]) => isFacetNoMatch(values) || (values?.length ?? 0) > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, values]) => [
        key,
        isFacetNoMatch(values) ? { noMatch: true } : [...new Set(values)].sort(),
      ]),
  );
}

export function sameLibrarySavedViewState(
  current: LibrarySavedViewState,
  saved: LibrarySavedViewState,
): boolean {
  return (
    current.q === saved.q &&
    current.groupBy === saved.groupBy &&
    current.segment === saved.segment &&
    current.scope === saved.scope &&
    current.range.from === saved.range.from &&
    current.range.to === saved.range.to &&
    facetKey(current.facetSel) === facetKey(saved.facetSel)
  );
}
