// D-BIB / RT5c (nacht24 Paket 5): EINE geteilte Facetten-Technik für Bibliothek UND Import —
// dynamische Filter AUS DEM BESTAND (nur vorkommende Werte, mit Zählern, kombinierbar). Pure,
// DOM-frei, ohne Netz. Effizienz-Vertrag: die (teure) WERT-Ableitung je Element passiert genau
// EINMAL je Datenlauf (der Aufrufer memoisiert `FacetValues`); das Zählen hier sind nur noch
// billige Map-Inkremente über bereits abgeleitete Werte.

// Werte eines Elements je Facette (mehrwertig möglich, z. B. Tags). Leere Liste = Facette
// für dieses Element unbekannt → es fällt bei einer aktiven Auswahl dieser Facette heraus.
export type FacetValues = Record<string, readonly string[]>;

// Aktive Auswahl: je Facette höchstens EIN gewählter Wert (undefined = Facette offen).
export type FacetSelection = Record<string, string | undefined>;

export interface FacetCount {
  value: string;
  count: number;
}

// Erfüllt ein Element die Auswahl? `except` klammert EINE Facette aus (für kombinierbare Zähler).
export function matchesFacets(
  values: FacetValues,
  selection: FacetSelection,
  except?: string,
): boolean {
  for (const [key, selected] of Object.entries(selection)) {
    if (selected === undefined || key === except) {
      continue;
    }
    if (!(values[key] ?? []).includes(selected)) {
      return false;
    }
  }
  return true;
}

// Kombinierbare Zähler (klassische Facetten-Suche): je Facette wird auf der Menge gezählt, die
// alle ANDEREN gewählten Facetten erfüllt — so zeigt jeder Chip ehrlich, was seine Wahl ergäbe.
// Sortierung: Häufigkeit absteigend, bei Gleichstand Wert alphabetisch (stabile Anzeige).
export function combinableFacetCounts(
  items: readonly FacetValues[],
  keys: readonly string[],
  selection: FacetSelection,
): Record<string, FacetCount[]> {
  const out: Record<string, FacetCount[]> = {};
  for (const key of keys) {
    const counts = new Map<string, number>();
    for (const item of items) {
      if (!matchesFacets(item, selection, key)) {
        continue;
      }
      for (const value of item[key] ?? []) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    out[key] = [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  }
  return out;
}

// Auswahl anwenden (alle Facetten UND-verknüpft).
export function applyFacetSelection<T>(
  items: readonly T[],
  valuesOf: (item: T) => FacetValues,
  selection: FacetSelection,
): T[] {
  const active = Object.values(selection).some((v) => v !== undefined);
  if (!active) {
    return [...items];
  }
  return items.filter((item) => matchesFacets(valuesOf(item), selection));
}

// Chip-Klick: gleicher Wert erneut → Facette wieder offen; sonst Wert wählen.
export function toggleFacetValue(
  selection: FacetSelection,
  key: string,
  value: string,
): FacetSelection {
  return { ...selection, [key]: selection[key] === value ? undefined : value };
}

// ---- Sprache aus dem Titel-Präfix (geteilt Bibliothek + Import; RT5c „Code teilen") ----
// Robust gegen die üblichen Trenner/Klammern in Altbestand-Titeln („[DE] …", „EN – …", „NL: …").
// KEIN Sprach-Feld am Objekt → ehrlich "other" (die Anzeige nennt es „ohne Kennzeichnung").
export type TitleLanguage = "de" | "en" | "nl" | "other";

const LANG_PREFIX = /^[\s\-–—·|>[\](){}]*(?:\[|\()?\s*(de|deu|ger|en|eng|nl|nld|ned)\b/i;
const LANG_CANON: Record<string, TitleLanguage> = {
  de: "de",
  deu: "de",
  ger: "de",
  en: "en",
  eng: "en",
  nl: "nl",
  nld: "nl",
  ned: "nl",
};

export function languageFromTitle(title: string): TitleLanguage {
  const match = LANG_PREFIX.exec(title);
  const tag = match?.[1]?.toLowerCase();
  return tag ? (LANG_CANON[tag] ?? "other") : "other";
}
