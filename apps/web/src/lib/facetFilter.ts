// AUFTRAG-uxpol1: generisches, config-getriebenes Facetten-Filter-Bauteil (Logik). Baut AUF der
// vorhandenen Facetten-Technik (lib/facets) auf — KEINE zweite Zähl-/Match-Logik — und liefert das
// reine, DOM-freie View-Modell, das die Komponente <FacetFilter> rendert: je Dimension eine Liste
// von Optionen mit KONTEXT-Zähler (klassische kombinierbare Facetten) und ehrlichem Ausgrauen von
// 0-Treffer-Optionen; dazu die aktiven Filter-Pillen und der Reset. Pure Funktionen → unit-testbar.
//
// GRUNDSATZ „Eine Sprache": jede Dimension erscheint GENAU EINMAL als Facette (kein Dropdown OBEN
// und Chip UNTEN parallel). Die Komponente ist generisch — Bibliothek ist der erste Träger; weitere
// Flächen (Validierung/Konflikte/Duplikate/Aufgaben) übernehmen sie später mit eigener Config.
import {
  type FacetSelection,
  type FacetValues,
  facetSelectedValues,
  isFacetGroupActive,
  isFacetNoMatch,
  matchesFacets,
} from "./facets";

// Eine Facetten-Dimension: stabiler key + i18n-Schlüssel des Gruppen-Labels.
export interface FacetGroupConfig {
  readonly key: string;
  readonly labelKey: string;
}

// Eine anzeigbare Option innerhalb einer Facette.
export interface FacetOptionView {
  value: string;
  // Treffer, DIE DIESE OPTION zusätzlich zu den anderen aktiven Facetten ergäbe (Kontext-Zähler).
  count: number;
  // 0 Treffer im aktuellen Kontext UND nicht selbst gewählt → ausgegraut/nicht klickbar (ehrlich,
  // nicht als „· 0" stehen gelassen). Die gewählte Option bleibt immer aktiv (Abwählen möglich).
  disabled: boolean;
  selected: boolean;
}

export interface FacetGroupView {
  key: string;
  labelKey: string;
  options: FacetOptionView[];
  // Ehrlich ausgewiesene, wegen des Anzeige-Deckels NICHT gezeigte Optionen (nichts still verschluckt).
  hiddenCount: number;
}

export interface ActiveFacetPill {
  key: string;
  labelKey: string;
  value: string;
  // AUFTRAG-uxpol4 (bens ROT 3.1): strukturelles No-Match dieser Gruppe (migrierte Widerspruchssicht).
  // Die Pille zeigt „0 Treffer"; Entfernen löst die GANZE Dimension (kein echter Wert → `value` leer).
  noMatch?: boolean;
}

// Anzeige-Deckel je Gruppe (die häufigsten Werte; der Rest via hiddenCount ehrlich ausgewiesen).
export const DEFAULT_FACET_LIMIT = 12;

// Universum der je Facette überhaupt vorkommenden Werte — aus dem VOLLEN Datensatz (ohne
// Facetten-Filterung), sortiert nach Gesamthäufigkeit, bei Gleichstand alphabetisch. Basis fürs
// Ausgrauen: nur so kennt die Anzeige auch die Werte, die im aktuellen Kontext auf 0 fallen.
export function facetUniverse(
  items: readonly FacetValues[],
  keys: readonly string[],
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const key of keys) {
    const counts = new Map<string, number>();
    for (const item of items) {
      // AUFTRAG-uxpol2 (bens Nebenfund): je Element pro Wert nur EINMAL zählen (doppelter Tag ≠ zwei).
      for (const value of new Set(item[key] ?? [])) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    out[key] = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value]) => value);
  }
  return out;
}

// Baut je Config-Gruppe das View-Modell: Kontext-Zähler (die eigene Facette ausgeklammert, fremde
// Auswahl gilt — identisch zur klassischen combinableFacetCounts-Regel), Ausgrauen der 0-Optionen,
// Anzeige-Deckel mit ehrlichem hiddenCount. Die aktuell gewählte Option wird IMMER gezeigt.
export function buildFacetGroups(
  items: readonly FacetValues[],
  configs: readonly FacetGroupConfig[],
  selection: FacetSelection,
  limit: number = DEFAULT_FACET_LIMIT,
): FacetGroupView[] {
  const universe = facetUniverse(
    items,
    configs.map((c) => c.key),
  );
  return configs.map((cfg) => {
    const { key } = cfg;
    // Kontext-Zähler: nur Elemente zählen, die alle ANDEREN aktiven Facetten erfüllen.
    const counts = new Map<string, number>();
    for (const item of items) {
      if (!matchesFacets(item, selection, key)) {
        continue;
      }
      // Dedupe je Element (bens Nebenfund) — doppelter Tag am selben Objekt zählt für diesen Wert 1×.
      for (const value of new Set(item[key] ?? [])) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    // AUFTRAG-uxpol2 (bens Blocker 1.1): die Auswahl je Gruppe ist eine Wertemenge → `selected` prüft
    // Zugehörigkeit (includes), nicht mehr Gleichheit. Mehrere gewählte Werte einer Gruppe (ODER).
    const selected = facetSelectedValues(selection[key]);
    const all: FacetOptionView[] = (universe[key] ?? []).map((value) => {
      const count = counts.get(value) ?? 0;
      const isSelected = selected.includes(value);
      return {
        value,
        count,
        selected: isSelected,
        disabled: count === 0 && !isSelected,
      };
    });
    // Reihenfolge: gewählte Option zuerst, dann Häufigkeit absteigend (0-Optionen sinken nach unten),
    // bei Gleichstand alphabetisch — ruhige, vorhersagbare Anzeige.
    all.sort(
      (a, b) =>
        (a.selected === b.selected ? 0 : a.selected ? -1 : 1) ||
        b.count - a.count ||
        a.value.localeCompare(b.value),
    );
    let options = all.slice(0, limit);
    // Jeder gewählte Wert bleibt sichtbar (Abwählen möglich), auch wenn er hinter den Anzeige-Deckel fiele.
    for (const value of selected) {
      if (!options.some((o) => o.value === value)) {
        const sel = all.find((o) => o.value === value);
        if (sel) {
          options = [...options, sel];
        }
      }
    }
    return {
      key,
      labelKey: cfg.labelKey,
      options,
      hiddenCount: Math.max(0, all.length - options.length),
    };
  });
}

// Aktive-Filter-Leiste: je gewähltem Wert EINE entfernbare Pille (Mengensemantik), in Config-
// Reihenfolge; innerhalb einer Gruppe in Auswahlreihenfolge.
export function activeFacetPills(
  configs: readonly FacetGroupConfig[],
  selection: FacetSelection,
): ActiveFacetPill[] {
  const pills: ActiveFacetPill[] = [];
  for (const cfg of configs) {
    const sel = selection[cfg.key];
    // AUFTRAG-uxpol4: eine No-Match-Gruppe ergibt GENAU EINE „0 Treffer"-Pille (kein echter Wert).
    if (isFacetNoMatch(sel)) {
      pills.push({ key: cfg.key, labelKey: cfg.labelKey, value: "", noMatch: true });
      continue;
    }
    for (const value of facetSelectedValues(sel)) {
      pills.push({ key: cfg.key, labelKey: cfg.labelKey, value });
    }
  }
  return pills;
}

// Ist mindestens ein Filter aktiv? (steuert Aktive-Leiste + „gefiltert"-Hinweis).
export function isAnyFacetActive(selection: FacetSelection): boolean {
  return Object.values(selection).some(isFacetGroupActive);
}

// „Alle zurücksetzen" → leere Auswahl.
export function clearFacetSelection(): FacetSelection {
  return {};
}
