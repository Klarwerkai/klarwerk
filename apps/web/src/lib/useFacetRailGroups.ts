import { useMemo } from "react";
import { type FacetGroupConfig, buildFacetGroups } from "./facetFilter";
import { type FacetDependency, type FacetRailUiState, facetRailGroupsFromViews } from "./facetRail";
import type { FacetSelection, FacetValues } from "./facets";

// Die Bestandsrechnung hängt nur an Bestand, Konfiguration und Auswahl. Autor-/Sprachlabels
// und Menüsuche werden danach aktuell angewandt, auch bei neuer Resolverreferenz je Render.
export function useFacetRailGroups(
  readItems: () => readonly FacetValues[],
  configs: readonly FacetGroupConfig[],
  selection: FacetSelection,
  ui: FacetRailUiState,
  labelForValue: (key: string, value: string) => string,
  dependencies: readonly FacetDependency[] = [],
) {
  // Die geschlossenen Menüs zeigen nur die Auswahl. Die Zähler aller Treffer werden erst
  // beim Öffnen gebraucht und bleiben für denselben Bestand und dieselbe Auswahl gültig.
  const readGroups = useMemo(() => {
    let groups: ReturnType<typeof buildFacetGroups> | undefined;
    return () => {
      groups ??= buildFacetGroups(readItems(), configs, selection, Number.MAX_SAFE_INTEGER);
      return groups;
    };
  }, [readItems, configs, selection]);
  return () => facetRailGroupsFromViews(readGroups(), selection, ui, labelForValue, dependencies);
}
