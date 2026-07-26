// AUFTRAG-mega10 Block B: aus der Pillenwand wird eine Suchmaske. Dies ist die REINE, DOM-freie
// Logik der Filterschiene — sie baut AUF lib/facetFilter auf (kein zweites Zähl-/Match-Werk) und
// liefert der Komponente genau das, was sie zeichnen muss.
//
// Warum ein eigener Schnitt neben `facetFilter.ts`: dort liegt das Facetten-VIEW-MODELL (Kontext-
// Zähler, Ausgrauen, Pillen) — es gilt unverändert für jeden Träger. Hier liegt das, was die
// SCHIENE zusätzlich kann: in einer Dimension suchen, den Anzeige-Deckel aufmachen, eine Dimension
// von einer anderen abhängig machen, und der Bereichsfilter. Das ist Anzeige-Zustand (Suchtext je
// Gruppe, „alle zeigen“), kein Facetten-Vertrag — deshalb getrennt und einzeln testbar.
import {
  type FacetGroupConfig,
  type FacetGroupView,
  type FacetOptionView,
  buildFacetGroups,
} from "./facetFilter";
import {
  type FacetSelection,
  type FacetValues,
  facetSelectedValues,
  isFacetNoMatch,
} from "./facets";

// Anzeige-Deckel EINER Gruppe in der Schiene. Kleiner als der frühere Wand-Deckel (12): in einer
// schmalen Schiene zählt die Höhe, und der Rest ist ab jetzt über Suche/„Alle N zeigen“ ERREICHBAR —
// das war der eigentliche Mangel, nicht die Zahl.
export const FACET_RAIL_LIMIT = 8;

// Ab wie vielen Werten eine Dimension ein eigenes Suchfeld bekommt. Unterhalb davon passt die
// Gruppe ohnehin vollständig auf den Schirm; ein Suchfeld wäre dort nur Rauschen.
export const FACET_SEARCH_THRESHOLD = FACET_RAIL_LIMIT;

// Anzeige-Zustand EINER Gruppe in der Schiene (Suchtext + „alle zeigen“), je Dimension.
export interface FacetRailUiState {
  readonly query: Record<string, string>;
  readonly showAll: Record<string, boolean>;
}

export const EMPTY_RAIL_UI: FacetRailUiState = { query: {}, showAll: {} };

export interface FacetRailGroupView extends FacetGroupView {
  // Alle Werte der Dimension im aktuellen Kontext (Basis für „Alle N zeigen“).
  totalCount: number;
  // Bekommt diese Gruppe ein Suchfeld? (genug Werte, um Tippen sinnvoll zu machen)
  searchable: boolean;
  // Der aktuelle Suchtext dieser Gruppe (leer = keine Suche).
  query: string;
  // Ist der Deckel gerade aufgemacht?
  showAll: boolean;
  // Suchtext gesetzt, aber kein Wert passt → die Anzeige sagt das ehrlich statt leer zu bleiben.
  noSearchHit: boolean;
  // Diese Dimension ist gerade auf die Werte einer übergeordneten Dimension eingeschränkt
  // (Block B Punkt 2). Die Anzeige weist das AUS — eine stille Verkürzung wäre unehrlich.
  restricted: boolean;
}

// Abhängige Auswahl (Block B Punkt 2) — Kategorie → Schlagwort.
//
// WICHTIG, und im Auftrag ausdrücklich so verlangt: Der Prototyp zeigte „Fachgebiet → Thema“ als
// TAXONOMIE. Die gibt es in unseren Daten nicht (`ko.category` ist ein flaches Feld). Diese
// Abhängigkeit ist deshalb NICHT modelliert, sondern AUS DEM BESTAND ABGELEITET: sobald die
// Elterndimension eine Wahl trägt, sind genau die Kindwerte übrig, die im aktuellen Kontext
// tatsächlich vorkommen (Kontext-Zähler > 0). Ohne Elternwahl wird NICHTS eingeschränkt — dann
// gilt unverändert die uxpol-Regel „0-Treffer ausgegraut statt verschwiegen“.
export interface FacetDependency {
  readonly parent: string;
  readonly child: string;
}

// Ist die Elterndimension einer Abhängigkeit gerade gesetzt (echte Werte, nicht No-Match)?
function parentActive(selection: FacetSelection, parent: string): boolean {
  return facetSelectedValues(selection[parent]).length > 0;
}

// Baut die Schienen-Sicht einer Gruppe: Abhängigkeit anwenden, dann suchen, dann deckeln.
//
// Reihenfolge ist Absicht: die Einschränkung durch die Elterndimension gehört zum KONTEXT (sie
// verändert, welche Werte es überhaupt gibt); die Suche arbeitet auf diesem Kontext; der Deckel
// kommt zuletzt und wird durch eine aktive Suche ausgesetzt (wer tippt, will alle Treffer sehen).
export function facetRailGroup(
  group: FacetGroupView,
  options: {
    labelOf: (value: string) => string;
    query?: string;
    showAll?: boolean;
    limit?: number;
    restricted?: boolean;
    searchThreshold?: number;
  },
): FacetRailGroupView {
  const {
    labelOf,
    query = "",
    showAll = false,
    limit = FACET_RAIL_LIMIT,
    restricted = false,
    searchThreshold = FACET_SEARCH_THRESHOLD,
  } = options;

  // (1) Abhängigkeit: nur Werte, die im Kontext der Elternwahl vorkommen. Eine bereits gewählte
  // Option bleibt IMMER stehen — sonst könnte man sie nicht mehr abwählen (uxpol-Vertrag).
  const inContext = restricted
    ? group.options.filter((o) => o.count > 0 || o.selected)
    : group.options;
  const totalCount = inContext.length;

  // (2) Suche INNERHALB der Dimension — auf dem ANGEZEIGTEN Text, nicht auf dem Rohwert. Der
  // Autor heißt in der Liste „Anna Berger“, im Datensatz aber „u17“; eine Suche über den Rohwert
  // fände genau das nicht, was man liest. Die gewählte Option bleibt auch hier immer sichtbar.
  const trimmed = query.trim().toLowerCase();
  const matched = trimmed
    ? inContext.filter((o) => o.selected || labelOf(o.value).toLowerCase().includes(trimmed))
    : inContext;
  const noSearchHit = trimmed.length > 0 && matched.length === 0;

  // (3) Deckel — bei aktiver Suche oder aufgemachtem Deckel entfällt er.
  const capped = showAll || trimmed ? matched : matched.slice(0, Math.max(0, limit));
  const shown = keepSelectedVisible(capped, matched);

  return {
    key: group.key,
    labelKey: group.labelKey,
    options: shown,
    hiddenCount: Math.max(0, matched.length - shown.length),
    totalCount,
    searchable: totalCount > searchThreshold,
    query,
    showAll,
    noSearchHit,
    restricted,
  };
}

// Jeder gewählte Wert bleibt sichtbar (Abwählen muss möglich bleiben) — dieselbe Regel wie in
// buildFacetGroups, hier nach dem Schienen-Deckel noch einmal angewandt.
function keepSelectedVisible(
  shown: readonly FacetOptionView[],
  all: readonly FacetOptionView[],
): FacetOptionView[] {
  const out = [...shown];
  for (const option of all) {
    if (option.selected && !out.some((o) => o.value === option.value)) {
      out.push(option);
    }
  }
  return out;
}

// Baut die vollständige Schiene. `buildFacetGroups` wird bewusst OHNE Deckel aufgerufen — der
// Deckel ist ab jetzt Sache der Schiene (sie kann ihn aufmachen), und die Suche braucht ohnehin
// die vollständige Werteliste. Die Kosten sind dieselben: buildFacetGroups baut die volle Liste
// intern immer und schnitt sie bisher nur ab (s. Block-A-Messung).
export function facetRailGroups(
  items: readonly FacetValues[],
  configs: readonly FacetGroupConfig[],
  selection: FacetSelection,
  ui: FacetRailUiState,
  labelForValue: (key: string, value: string) => string,
  dependencies: readonly FacetDependency[] = [],
): FacetRailGroupView[] {
  const groups = buildFacetGroups(items, configs, selection, Number.MAX_SAFE_INTEGER);
  const restrictedChildren = new Set(
    dependencies.filter((d) => parentActive(selection, d.parent)).map((d) => d.child),
  );
  return groups.map((group) =>
    facetRailGroup(group, {
      labelOf: (value) => labelForValue(group.key, value),
      query: ui.query[group.key] ?? "",
      showAll: ui.showAll[group.key] === true,
      restricted: restrictedChildren.has(group.key),
    }),
  );
}

// Räumt eine durch die Elternwahl UNGÜLTIG gewordene Kind-Auswahl auf (Block B Punkt 2, Testpflicht).
//
// Beispiel: Schlagwort „ventil“ gewählt, danach Kategorie auf „Fuhrpark“ umgestellt — „ventil“
// kommt dort nicht vor. Ohne Aufräumen bliebe ein unsichtbar wirkender Filter stehen, der die
// Liste bedingungslos auf 0 zöge. Es werden NUR Werte entfernt, die im neuen Kontext nachweislich
// nicht vorkommen; bleibt nichts übrig, wird die Dimension GELÖST (undefined = offen), nicht auf
// No-Match gesetzt — No-Match ist der Zustand einer widersprüchlichen gespeicherten Sicht und darf
// hier nicht neu entstehen. Ein bestehendes No-Match bleibt unangetastet.
export function pruneDependentSelection(
  selection: FacetSelection,
  items: readonly FacetValues[],
  dependencies: readonly FacetDependency[],
): FacetSelection {
  let next = selection;
  for (const { parent, child } of dependencies) {
    if (!parentActive(next, parent)) {
      continue;
    }
    const current = next[child];
    if (isFacetNoMatch(current)) {
      continue;
    }
    const values = facetSelectedValues(current);
    if (values.length === 0) {
      continue;
    }
    // Welche Kindwerte kommen unter der Elternwahl überhaupt vor? Nur die Elterndimension zählt
    // hier — andere aktive Facetten dürfen eine Auswahl NICHT wegräumen (sie sind wegnehmbar, die
    // Auswahl wäre sonst unwiederbringlich verloren, sobald man kurz eng filtert).
    const parentValues = new Set(facetSelectedValues(next[parent]));
    const occurring = new Set<string>();
    for (const item of items) {
      if (!(item[parent] ?? []).some((v) => parentValues.has(v))) {
        continue;
      }
      for (const value of item[child] ?? []) {
        occurring.add(value);
      }
    }
    const kept = values.filter((v) => occurring.has(v));
    if (kept.length === values.length) {
      continue;
    }
    next = { ...next, [child]: kept.length > 0 ? kept : undefined };
  }
  return next;
}

// ---- Bereichsfilter „Zuletzt geändert von / bis“ (Block B Punkt 4) ---------------------------
//
// AUSDRÜCKLICH NEBEN der Facettenauswahl, nicht darin. `FacetSelection` ist eine WERTEMENGE je
// Gruppe; auf diesem Vertrag ruhen bens struktureller No-Match und die semantiktreue Sicht-
// Migration. Ein Bereich ist kein Wert — ihn in die Wertemenge zu pressen hieße, einen Bereich als
// Zeichenkette zu kodieren und damit genau den reservierten Wert wieder einzuführen, den uxpol4
// abgeschafft hat. Der Bereich ist deshalb ein eigener, additiver Filter mit eigenem Zustand,
// eigenen URL-Parametern und eigener Pille.
export interface FacetRange {
  // ISO-Datum „JJJJ-MM-TT“; leer = diese Seite offen.
  readonly from: string;
  readonly to: string;
}

export const EMPTY_FACET_RANGE: FacetRange = Object.freeze({ from: "", to: "" });

export function isFacetRangeActive(range: FacetRange): boolean {
  return range.from.length > 0 || range.to.length > 0;
}

// Trifft ein Zeitpunkt (ms) den Bereich? Die „bis“-Grenze schließt den GANZEN Tag ein — wer
// „bis 31.12.“ wählt, meint einschließlich des 31.12., nicht dessen Mitternacht.
// Unparsbare Grenzen wirken nicht (offen), ein unparsbarer Zeitpunkt fällt bei aktivem Bereich
// heraus (ehrlich: er lässt sich nicht einordnen).
export function matchesFacetRange(ms: number, range: FacetRange): boolean {
  if (!isFacetRangeActive(range)) {
    return true;
  }
  if (!Number.isFinite(ms) || ms <= 0) {
    return false;
  }
  const from = Date.parse(`${range.from}T00:00:00.000Z`);
  if (range.from && Number.isFinite(from) && ms < from) {
    return false;
  }
  const to = Date.parse(`${range.to}T23:59:59.999Z`);
  if (range.to && Number.isFinite(to) && ms > to) {
    return false;
  }
  return true;
}

// Widersprüchlicher Bereich (von > bis) — die Anzeige sagt das, statt kommentarlos 0 zu zeigen.
export function isFacetRangeContradictory(range: FacetRange): boolean {
  return range.from.length > 0 && range.to.length > 0 && range.from > range.to;
}

export function facetRangeFromParams(
  params: URLSearchParams,
  fromKey: string,
  toKey: string,
): FacetRange {
  return {
    from: normalizeIsoDate(params.get(fromKey)),
    to: normalizeIsoDate(params.get(toKey)),
  };
}

// Nur ein echtes ISO-Datum wird übernommen; alles andere fällt neutral aus (kein Filter) — wie
// `?origin=` behält damit auch ein kaputter Link seine harmlose Bedeutung, statt plötzlich auf
// nichts zu filtern.
function normalizeIsoDate(raw: string | null): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return "";
  }
  return Number.isFinite(Date.parse(`${raw}T00:00:00.000Z`)) ? raw : "";
}

export function writeFacetRangeToParams(
  prev: URLSearchParams,
  range: FacetRange,
  fromKey: string,
  toKey: string,
): URLSearchParams {
  const next = new URLSearchParams(prev);
  for (const [key, value] of [
    [fromKey, range.from],
    [toKey, range.to],
  ] as const) {
    next.delete(key);
    if (value.length > 0) {
      next.append(key, value);
    }
  }
  return next;
}

export function serializeFacetRange(range: FacetRange): string {
  return `${range.from}|${range.to}`;
}

// Liest den Bereich aus einem gespeicherten Sicht-Zustand. Altsichten (vor mega10) kennen das Feld
// nicht → leerer Bereich = KEIN Filter. Damit bleibt die Treffermenge einer Altsicht exakt erhalten;
// ein neu hinzugekommener Filter darf sie niemals nachträglich verkleinern. Fremdformate werden
// genauso defensiv geglättet wie in der URL-Grenze (nur echte ISO-Daten zählen).
export function facetRangeFromSaved(state: Record<string, unknown>): FacetRange {
  const raw = state.range;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return EMPTY_FACET_RANGE;
  }
  const { from, to } = raw as { from?: unknown; to?: unknown };
  return {
    from: normalizeIsoDate(typeof from === "string" ? from : null),
    to: normalizeIsoDate(typeof to === "string" ? to : null),
  };
}
