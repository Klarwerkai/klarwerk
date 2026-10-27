import { useMemo } from "react";
import { type FacetGroupConfig, buildFacetGroups } from "./facetFilter";
import { type FacetDependency, type FacetRailUiState, facetRailGroupsFromViews } from "./facetRail";
import type { FacetSelection, FacetValues } from "./facets";

// Die Bestandsrechnung hängt nur an Bestand, Konfiguration und Auswahl. Autor-/Sprachlabels
// und Menüsuche werden danach aktuell angewandt, auch bei neuer Resolverreferenz je Render.
export function useFacetRailGroups(
  items: readonly FacetValues[],
  configs: readonly FacetGroupConfig[],
  selection: FacetSelection,
  ui: FacetRailUiState,
  labelForValue: (key: string, value: string) => string,
  dependencies: readonly FacetDependency[] = [],
) {
  const groups = useMemo(
    () => buildFacetGroups(items, configs, selection, Number.MAX_SAFE_INTEGER),
    [items, configs, selection],
  );
  return facetRailGroupsFromViews(groups, selection, ui, labelForValue, dependencies);
}
