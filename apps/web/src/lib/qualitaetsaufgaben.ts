// ================================================================================================
// ADMIN-10 · QUALITÄTSAUFGABEN — Filter, Zähler und Adresse, DOM-frei.
// ================================================================================================
//
// produkt:20261009:admin-qualitaetsaufgaben. Liste und Zähler entstehen aus DERSELBEN Antwort
// (`GET /api/qualitaetsaufgaben`, ein Abfrageschlüssel) und DERSELBEN Auswahlregel (`passt`). Ein
// Zähler je Filterwert rechnet mit allen ÜBRIGEN Filtern — so sagt er, wie viele Einträge die Liste
// zeigen würde, wenn man ihn wählt; die Gesamtzahl ist die Länge der gezeigten Liste.
//
// Die Filterwahl steht ausschliesslich in der Adresse (Muster `taskViewState.ts`, JOB 3101): sie
// übersteht Zurück aus dem Arbeitsweg und Neuladen, und es gibt keinen zweiten Zustandsort.
import {
  type QualitaetsVorgang,
  VORGANG_TYPEN,
  VORGANG_ZUSTAENDE,
  type VorgangTyp,
  type VorgangZustand,
} from "../api/qualitaetsaufgaben";

/** Filterwert „ohne Space" bzw. „niemand zuständig" — ausdrücklich wählbar, nicht nur „alle". */
export const OHNE = "ohne";

export interface QualitaetsFilter {
  space: string | null;
  typ: VorgangTyp | null;
  zustand: VorgangZustand | null;
  zustaendig: string | null;
}

export type FilterDimension = keyof QualitaetsFilter;

export const FILTER_PARAM: Record<FilterDimension, string> = {
  space: "space",
  typ: "typ",
  zustand: "zustand",
  zustaendig: "zustaendig",
};

export const LEERER_FILTER: QualitaetsFilter = {
  space: null,
  typ: null,
  zustand: null,
  zustaendig: null,
};

function wert(params: URLSearchParams, name: string): string | null {
  const roh = (params.get(name) ?? "").trim();
  return roh === "" ? null : roh;
}

/** Die Wahl aus der Adresse. Ein unbekannter Typ oder Zustand gilt als „alle", nie als Leerliste. */
export function filterAusAdresse(params: URLSearchParams): QualitaetsFilter {
  const typ = wert(params, FILTER_PARAM.typ);
  const zustand = wert(params, FILTER_PARAM.zustand);
  return {
    space: wert(params, FILTER_PARAM.space),
    typ:
      typ !== null && (VORGANG_TYPEN as readonly string[]).includes(typ)
        ? (typ as VorgangTyp)
        : null,
    zustand:
      zustand !== null && (VORGANG_ZUSTAENDE as readonly string[]).includes(zustand)
        ? (zustand as VorgangZustand)
        : null,
    zustaendig: wert(params, FILTER_PARAM.zustaendig),
  };
}

/** Eine Dimension setzen oder (mit `null`) entfernen; fremde Parameter bleiben unberührt. */
export function filterInAdresse(
  vorher: URLSearchParams,
  dimension: FilterDimension,
  neu: string | null,
): URLSearchParams {
  const params = new URLSearchParams(vorher);
  if (neu === null) {
    params.delete(FILTER_PARAM[dimension]);
  } else {
    params.set(FILTER_PARAM[dimension], neu);
  }
  return params;
}

/** Ob ein Eintrag zur Wahl passt — ohne die Dimension `ausser` (für Zähler je Filterwert). */
export function passt(
  v: QualitaetsVorgang,
  filter: QualitaetsFilter,
  ausser?: FilterDimension,
): boolean {
  if (ausser !== "space" && filter.space !== null) {
    const trifft = filter.space === OHNE ? v.spaces.length === 0 : v.spaces.includes(filter.space);
    if (!trifft) {
      return false;
    }
  }
  if (ausser !== "typ" && filter.typ !== null && v.typ !== filter.typ) {
    return false;
  }
  if (ausser !== "zustand" && filter.zustand !== null && v.zustand !== filter.zustand) {
    return false;
  }
  if (ausser !== "zustaendig" && filter.zustaendig !== null) {
    const trifft =
      filter.zustaendig === OHNE
        ? v.zustaendig.length === 0
        : v.zustaendig.some((z) => z.id === filter.zustaendig);
    if (!trifft) {
      return false;
    }
  }
  return true;
}

export function gefiltert(
  vorgaenge: readonly QualitaetsVorgang[],
  filter: QualitaetsFilter,
): QualitaetsVorgang[] {
  return vorgaenge.filter((v) => passt(v, filter));
}

/** Die Werte, die ein Eintrag in einer Dimension trägt (für die Zähler je Filterwert). */
function werteVon(v: QualitaetsVorgang, dimension: FilterDimension): string[] {
  switch (dimension) {
    case "space":
      return v.spaces.length === 0 ? [OHNE] : v.spaces;
    case "typ":
      return [v.typ];
    case "zustand":
      return [v.zustand];
    case "zustaendig":
      return v.zustaendig.length === 0 ? [OHNE] : [...new Set(v.zustaendig.map((z) => z.id))];
  }
}

/**
 * Zähler je Wert einer Dimension, gerechnet mit allen ÜBRIGEN Filtern. Ein Eintrag mit zwei Spaces
 * oder zwei Prüfern zählt in beiden Werten — wählt man einen davon, steht er in der Liste.
 */
export function zaehleJe(
  vorgaenge: readonly QualitaetsVorgang[],
  filter: QualitaetsFilter,
  dimension: FilterDimension,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const v of vorgaenge) {
    if (!passt(v, filter, dimension)) {
      continue;
    }
    for (const w of werteVon(v, dimension)) {
      out.set(w, (out.get(w) ?? 0) + 1);
    }
  }
  return out;
}

/** Alle Zuständigen, die im Bestand vorkommen — nach Name, Unbekannte zuletzt. */
export function zustaendigeIm(
  vorgaenge: readonly QualitaetsVorgang[],
): { id: string; name: string | null }[] {
  const je = new Map<string, string | null>();
  for (const v of vorgaenge) {
    for (const z of v.zustaendig) {
      if (!je.has(z.id) || je.get(z.id) === null) {
        je.set(z.id, z.name);
      }
    }
  }
  return [...je.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => {
      if (a.name === null || b.name === null) {
        return a.name === null ? (b.name === null ? 0 : 1) : -1;
      }
      return a.name.localeCompare(b.name);
    });
}

/**
 * „Einmal gezählt" nachvollziehbar: wie viele Einstiege auf wie viele Einträge fallen. Ein Eintrag
 * mit drei Einstiegen ist EIN Vorgang; die Differenz ist genau das, was nicht doppelt zählt.
 */
export function einstiegsBilanz(vorgaenge: readonly QualitaetsVorgang[]): {
  vorgaenge: number;
  einstiege: number;
} {
  return {
    vorgaenge: vorgaenge.length,
    einstiege: vorgaenge.reduce((n, v) => n + v.einstiege.length, 0),
  };
}

/** Ganze Tage seit `seit` (Zeitpunkt oder Kalendertag) — `null`, wenn kein Beginn erfasst ist. */
export function alterInTagen(seit: string | null, jetztMs: number): number | null {
  if (seit === null) {
    return null;
  }
  const ms = Date.parse(seit);
  if (Number.isNaN(ms)) {
    return null;
  }
  return Math.max(0, Math.floor((jetztMs - ms) / 86_400_000));
}

/** Die Grundart eines Einstiegs (`zuweisung:<id>` → `zuweisung`) für die Anzeige. */
export function einstiegsArt(einstieg: string): string {
  const doppelpunkt = einstieg.indexOf(":");
  return doppelpunkt < 0 ? einstieg : einstieg.slice(0, doppelpunkt);
}
