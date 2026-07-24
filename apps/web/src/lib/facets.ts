// D-BIB / RT5c (nacht24 Paket 5): EINE geteilte Facetten-Technik für Bibliothek UND Import —
// dynamische Filter AUS DEM BESTAND (nur vorkommende Werte, mit Zählern, kombinierbar). Pure,
// DOM-frei, ohne Netz. Effizienz-Vertrag: die (teure) WERT-Ableitung je Element passiert genau
// EINMAL je Datenlauf (der Aufrufer memoisiert `FacetValues`); das Zählen hier sind nur noch
// billige Map-Inkremente über bereits abgeleitete Werte.

// Werte eines Elements je Facette (mehrwertig möglich, z. B. Tags). Leere Liste = Facette
// für dieses Element unbekannt → es fällt bei einer aktiven Auswahl dieser Facette heraus.
export type FacetValues = Record<string, readonly string[]>;

// AUFTRAG-uxpol2 (bens Blocker 1.1): Aktive Auswahl je Facette ist eine WERTEMENGE (kein Einzelwert
// mehr). Innerhalb einer Gruppe gilt ODER (mind. ein gewählter Wert muss vorkommen), ZWISCHEN Gruppen
// UND (jede aktive Gruppe muss erfüllt sein). undefined/leere Menge = Facette offen.
//
// AUFTRAG-uxpol4 (bens ROT 3.1): Der Auswahlzustand je Gruppe ist ENTWEDER eine echte Wertemenge ODER
// der STRUKTURELLE No-Match-Zustand — ein eigenes, NICHT string-basiertes Feld (`{ noMatch: true }`),
// herausgezogen aus dem Namensraum echter Facettenwerte. „bewusst leer ⇒ 0 Treffer" ist damit KEIN
// reservierter Magic-String mehr, sondern ein Typ-Fall, den kein echter Wert (aus Bestand, URL/Query
// oder localStorage) je erzeugen oder aufheben kann. undefined/leere Menge = Facette offen (kein Filter).
export interface FacetNoMatch {
  readonly noMatch: true;
}
export const FACET_NO_MATCH_SELECTION: FacetNoMatch = Object.freeze({ noMatch: true });

export type FacetGroupSelection = readonly string[] | FacetNoMatch;
export type FacetSelection = Record<string, FacetGroupSelection | undefined>;

// Strukturelle Erkennung des No-Match-Zustands — bewusst für UNBEKANNTE (deserialisierte) Werte robust,
// damit die Parser-/Persistenz-Grenze echte Strings NIE als No-Match interpretiert und umgekehrt.
export function isFacetNoMatch(sel: unknown): sel is FacetNoMatch {
  return (
    typeof sel === "object" &&
    sel !== null &&
    !Array.isArray(sel) &&
    (sel as { noMatch?: unknown }).noMatch === true
  );
}

// Echte (String-)Werte einer Gruppenauswahl; No-Match/undefined ⇒ leere Menge (kein echter Wert).
export function facetSelectedValues(sel: FacetGroupSelection | undefined): readonly string[] {
  return Array.isArray(sel) ? sel : [];
}

// Ist für DIESE Gruppe ein Filter aktiv — echte Werte ODER strukturelles No-Match?
export function isFacetGroupActive(sel: FacetGroupSelection | undefined): boolean {
  return isFacetNoMatch(sel) || facetSelectedValues(sel).length > 0;
}

export interface FacetCount {
  value: string;
  count: number;
}

// Erfüllt ein Element die Auswahl? `except` klammert EINE Facette aus (für kombinierbare Zähler).
// ODER innerhalb der Gruppe (mind. ein gewählter Wert trifft), UND zwischen den Gruppen.
export function matchesFacets(
  values: FacetValues,
  selection: FacetSelection,
  except?: string,
): boolean {
  for (const [key, selected] of Object.entries(selection)) {
    if (key === except || selected === undefined) {
      continue;
    }
    // AUFTRAG-uxpol4 (bens ROT 3.1): der strukturelle No-Match-Zustand einer Gruppe wird BEDINGUNGSLOS
    // als „kein Treffer" behandelt — BEVOR irgendein echter Wert verglichen wird. Kein Bestands-/URL-/
    // Sichtenwert kann diesen Zustand erzeugen oder aufheben (er ist keine Zeichenkette).
    if (isFacetNoMatch(selected)) {
      return false;
    }
    if (selected.length === 0) {
      continue;
    }
    const itemValues = values[key] ?? [];
    if (!selected.some((v) => itemValues.includes(v))) {
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
      // AUFTRAG-uxpol2 (bens Nebenfund): je Element pro Wert nur EINMAL zählen — ein doppelter Tag
      // am selben Objekt ist trotzdem nur ein Treffer (Set dedupliziert vor dem Inkrement).
      for (const value of new Set(item[key] ?? [])) {
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
  const active = Object.values(selection).some(isFacetGroupActive);
  if (!active) {
    return [...items];
  }
  return items.filter((item) => matchesFacets(valuesOf(item), selection));
}

// Chip-Klick (Mengensemantik): gewählter Wert erneut → aus der Gruppe entfernen; sonst ERGÄNZEN
// (ODER innerhalb der Gruppe). Leere Menge → Facette wieder offen (undefined).
export function toggleFacetValue(
  selection: FacetSelection,
  key: string,
  value: string,
): FacetSelection {
  // Nur echte Bestandswerte; ein etwaiger No-Match-Zustand der Gruppe wird durch die echte Wahl
  // ersetzt (facetSelectedValues liefert dafür die leere Menge) — ein echter Wert setzt No-Match nie fort.
  const current = facetSelectedValues(selection[key]);
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return { ...selection, [key]: next.length > 0 ? next : undefined };
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
