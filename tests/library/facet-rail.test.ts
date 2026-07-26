// AUFTRAG-mega10 Block B: die reine Logik der Filterschiene — Suche INNERHALB einer Dimension,
// „Alle N zeigen“, die aus dem Bestand abgeleitete abhängige Auswahl (Kategorie → Schlagwort) samt
// Aufräumen einer ungültig gewordenen Unterauswahl, und der additive Bereichsfilter.
import { describe, expect, it } from "vitest";
import type { FacetGroupConfig } from "../../apps/web/src/lib/facetFilter";
import {
  EMPTY_FACET_RANGE,
  EMPTY_RAIL_UI,
  FACET_RAIL_LIMIT,
  type FacetRange,
  facetRailGroups,
  facetRangeFromParams,
  isFacetRangeActive,
  isFacetRangeContradictory,
  matchesFacetRange,
  pruneDependentSelection,
  serializeFacetRange,
  writeFacetRangeToParams,
} from "../../apps/web/src/lib/facetRail";
import { FACET_NO_MATCH_SELECTION, type FacetValues } from "../../apps/web/src/lib/facets";

const CONFIGS: readonly FacetGroupConfig[] = [
  { key: "category", labelKey: "lib.facet.category" },
  { key: "tag", labelKey: "lib.facet.tag" },
  { key: "author", labelKey: "lib.facet.author" },
];
const DEPS = [{ parent: "category", child: "tag" }] as const;

// Autoren tragen im Datensatz IDs, in der Anzeige Namen — genau der Fall, in dem eine Suche über
// den Rohwert danebenläge.
const AUTHOR_NAMES: Record<string, string> = {
  u1: "Anna Berger",
  u2: "Bernd Cordes",
  u3: "Claudia Dietrich",
  u4: "Dirk Ehlers",
  u5: "Elena Faber",
  u6: "Frank Groß",
  u7: "Gudrun Hartmann",
  u8: "Hakan Illner",
  u9: "Ines Jansen",
  u10: "Jörg Köhler",
  u11: "Katrin Lorenz",
  u12: "Zeynep Yilmaz",
};
const labelForValue = (key: string, value: string): string =>
  key === "author" ? (AUTHOR_NAMES[value] ?? value) : value;

// Zwölf Autoren (über dem Deckel von 8), zwei Kategorien mit klar getrennten Schlagwortmengen.
const ITEMS: FacetValues[] = Object.keys(AUTHOR_NAMES).map((author, i) => ({
  author: [author],
  category: [i < 6 ? "Anlage 1" : "Fuhrpark"],
  tag: i < 6 ? ["ventil", "sicherheit"] : ["firmenwagen", "reifen"],
}));

const groupsOf = (selection = {}, ui = EMPTY_RAIL_UI): ReturnType<typeof facetRailGroups> =>
  facetRailGroups(ITEMS, CONFIGS, selection, ui, labelForValue, DEPS);
const groupBy = (
  key: string,
  selection = {},
  ui = EMPTY_RAIL_UI,
): ReturnType<typeof facetRailGroups>[number] => {
  const group = groupsOf(selection, ui).find((g) => g.key === key);
  if (!group) {
    throw new Error(`Gruppe ${key} fehlt`);
  }
  return group;
};

describe("Block B Punkt 1: Suche INNERHALB einer Dimension", () => {
  it("deckelt lange Dimensionen und weist den Rest ehrlich aus", () => {
    const author = groupBy("author");
    expect(author.totalCount).toBe(12);
    expect(author.options).toHaveLength(FACET_RAIL_LIMIT);
    expect(author.hiddenCount).toBe(12 - FACET_RAIL_LIMIT);
    expect(author.searchable).toBe(true);
  });

  it("findet einen Wert, der HINTER dem Anzeige-Deckel liegt, und macht ihn anwählbar", () => {
    // Alle Autoren haben denselben Zähler (1) → die Ordnung entscheidet alphabetisch über den
    // Rohwert; „u9“ (Ines Jansen) fällt damit hinter den Deckel von acht.
    const ungefiltert = groupBy("author");
    expect(ungefiltert.options.some((o) => o.value === "u9")).toBe(false);
    expect(ungefiltert.hiddenCount).toBeGreaterThan(0);

    const gesucht = groupBy("author", {}, { query: { author: "ines" }, showAll: {} });
    const treffer = gesucht.options.find((o) => o.value === "u9");
    expect(treffer).toBeDefined();
    // anwählbar heißt: nicht deaktiviert und mit ehrlichem Zähler.
    expect(treffer?.disabled).toBe(false);
    expect(treffer?.count).toBe(1);
    expect(gesucht.options).toHaveLength(1);
  });

  it("sucht über den ANGEZEIGTEN Text, nicht über den Rohwert", () => {
    // „Berger“ steht nur im Namen; der Rohwert ist „u1“.
    const perName = groupBy("author", {}, { query: { author: "berger" }, showAll: {} });
    expect(perName.options.map((o) => o.value)).toEqual(["u1"]);
    expect(perName.noSearchHit).toBe(false);
  });

  it("meldet ehrlich, wenn kein Wert zum Suchtext passt", () => {
    const leer = groupBy("author", {}, { query: { author: "xyz-gibt-es-nicht" }, showAll: {} });
    expect(leer.options).toHaveLength(0);
    expect(leer.noSearchHit).toBe(true);
  });

  it("„Alle N zeigen“ zeigt WIRKLICH alle Werte der Dimension", () => {
    const alle = groupBy("author", {}, { query: {}, showAll: { author: true } });
    expect(alle.options).toHaveLength(12);
    expect(alle.hiddenCount).toBe(0);
    expect(alle.options.map((o) => o.value)).toContain("u12");
  });

  it("kurze Dimensionen bekommen kein Suchfeld (kein Rauschen)", () => {
    expect(groupBy("category").searchable).toBe(false);
    expect(groupBy("category").options).toHaveLength(2);
  });

  it("die gewählte Option bleibt sichtbar, auch wenn Suche und Deckel sie ausschlössen", () => {
    const sel = { author: ["u9"] };
    const trotzSuche = groupBy("author", sel, { query: { author: "anna" }, showAll: {} });
    const gewaehlt = trotzSuche.options.find((o) => o.value === "u9");
    expect(gewaehlt?.selected).toBe(true);
    expect(gewaehlt?.disabled).toBe(false);
  });
});

describe("Block B Punkt 2: abhängige Auswahl Kategorie → Schlagwort (aus dem Bestand)", () => {
  it("ohne Kategoriewahl wird NICHTS eingeschränkt (0-Treffer bleiben ausgegraut sichtbar)", () => {
    const tag = groupBy("tag");
    expect(tag.restricted).toBe(false);
    expect(tag.totalCount).toBe(4);
    expect(tag.options.map((o) => o.value).sort()).toEqual([
      "firmenwagen",
      "reifen",
      "sicherheit",
      "ventil",
    ]);
  });

  it("mit Kategoriewahl schneidet die Schlagwortliste auf die tatsächlich vorkommenden Werte", () => {
    const tag = groupBy("tag", { category: ["Fuhrpark"] });
    expect(tag.restricted).toBe(true);
    expect(tag.options.map((o) => o.value).sort()).toEqual(["firmenwagen", "reifen"]);
    // Nichts still verschluckt: die Einschränkung ist als Zustand ausgewiesen.
    expect(tag.totalCount).toBe(2);
  });

  it("räumt eine ungültig gewordene Unterauswahl auf", () => {
    // „ventil“ gewählt, danach auf „Fuhrpark“ umgestellt — dort kommt „ventil“ nicht vor.
    const vorher = { category: ["Fuhrpark"], tag: ["ventil"] };
    const nachher = pruneDependentSelection(vorher, ITEMS, DEPS);
    expect(nachher.tag).toBeUndefined();
  });

  it("behält den gültigen Teil einer gemischten Unterauswahl", () => {
    const vorher = { category: ["Fuhrpark"], tag: ["ventil", "reifen"] };
    const nachher = pruneDependentSelection(vorher, ITEMS, DEPS);
    expect(nachher.tag).toEqual(["reifen"]);
  });

  it("lässt eine gültige Auswahl unverändert (keine Umwege, gleiche Referenz)", () => {
    const vorher = { category: ["Fuhrpark"], tag: ["reifen"] };
    expect(pruneDependentSelection(vorher, ITEMS, DEPS)).toBe(vorher);
  });

  it("ohne Elternwahl wird nie aufgeräumt", () => {
    const vorher = { tag: ["ventil"] };
    expect(pruneDependentSelection(vorher, ITEMS, DEPS)).toBe(vorher);
  });

  it("fasst ein bestehendes strukturelles No-Match NICHT an und erzeugt nie ein neues", () => {
    const mitNoMatch = { category: ["Fuhrpark"], tag: FACET_NO_MATCH_SELECTION };
    expect(pruneDependentSelection(mitNoMatch, ITEMS, DEPS).tag).toBe(FACET_NO_MATCH_SELECTION);
    // Eine vollständig ungültige Unterauswahl LÖST die Dimension (offen) — sie wird nicht zu No-Match.
    const alleUngueltig = pruneDependentSelection(
      { category: ["Fuhrpark"], tag: ["ventil", "sicherheit"] },
      ITEMS,
      DEPS,
    );
    expect(alleUngueltig.tag).toBeUndefined();
  });

  it("kein Zustand der Schiene taucht je als Zeichenkette „noMatch“ auf", () => {
    const serialisiert = JSON.stringify(groupsOf({ category: ["Fuhrpark"], tag: ["reifen"] }));
    expect(serialisiert).not.toContain("noMatch");
  });
});

describe("Block B Punkt 4: Bereichsfilter — additiv, NICHT in der Facetten-Wertemenge", () => {
  it("leerer Bereich ist inaktiv und lässt alles durch", () => {
    expect(isFacetRangeActive(EMPTY_FACET_RANGE)).toBe(false);
    expect(matchesFacetRange(Date.parse("2020-01-01T00:00:00Z"), EMPTY_FACET_RANGE)).toBe(true);
  });

  it("„von“ und „bis“ grenzen ein; „bis“ schließt den ganzen Tag ein", () => {
    const range: FacetRange = { from: "2026-01-01", to: "2026-01-31" };
    expect(matchesFacetRange(Date.parse("2025-12-31T23:59:59Z"), range)).toBe(false);
    expect(matchesFacetRange(Date.parse("2026-01-01T00:00:00Z"), range)).toBe(true);
    // Der letzte Tag zählt VOLLSTÄNDIG dazu — nicht nur seine Mitternacht.
    expect(matchesFacetRange(Date.parse("2026-01-31T18:30:00Z"), range)).toBe(true);
    expect(matchesFacetRange(Date.parse("2026-02-01T00:00:00Z"), range)).toBe(false);
  });

  it("eine offene Seite wirkt einseitig", () => {
    expect(
      matchesFacetRange(Date.parse("2019-01-01T00:00:00Z"), { from: "2020-01-01", to: "" }),
    ).toBe(false);
    expect(
      matchesFacetRange(Date.parse("2021-01-01T00:00:00Z"), { from: "2020-01-01", to: "" }),
    ).toBe(true);
  });

  it("ein unbekannter Zeitpunkt fällt bei aktivem Bereich ehrlich heraus", () => {
    expect(matchesFacetRange(0, { from: "2020-01-01", to: "" })).toBe(false);
    expect(matchesFacetRange(Number.NaN, { from: "", to: "2020-01-01" })).toBe(false);
    // ohne Bereich bleibt er drin (kein Filter = kein Ausschluss)
    expect(matchesFacetRange(0, EMPTY_FACET_RANGE)).toBe(true);
  });

  it("erkennt einen widersprüchlichen Bereich (von > bis)", () => {
    expect(isFacetRangeContradictory({ from: "2026-05-01", to: "2026-01-01" })).toBe(true);
    expect(isFacetRangeContradictory({ from: "2026-01-01", to: "2026-05-01" })).toBe(false);
    expect(isFacetRangeContradictory({ from: "2026-01-01", to: "" })).toBe(false);
  });

  it("URL: Bereich hin und zurück, kaputte Werte bleiben NEUTRAL (wie ?origin=)", () => {
    const params = new URLSearchParams("q=ventil&von=2026-01-01&bis=2026-03-31");
    expect(facetRangeFromParams(params, "von", "bis")).toEqual({
      from: "2026-01-01",
      to: "2026-03-31",
    });
    // Ein kaputter Wert macht aus einem harmlosen Link keinen Filter auf nichts.
    expect(facetRangeFromParams(new URLSearchParams("von=quatsch"), "von", "bis")).toEqual(
      EMPTY_FACET_RANGE,
    );
    expect(facetRangeFromParams(new URLSearchParams("von=2026-13-45"), "von", "bis").from).toBe("");

    const written = writeFacetRangeToParams(params, { from: "2025-06-01", to: "" }, "von", "bis");
    expect(written.get("von")).toBe("2025-06-01");
    expect(written.has("bis")).toBe(false);
    // Fremde Parameter bleiben unberührt.
    expect(written.get("q")).toBe("ventil");
  });

  it("die kanonische Zeichenkette unterscheidet Bereiche (Schleifenschutz der URL-Fortschreibung)", () => {
    expect(serializeFacetRange({ from: "2026-01-01", to: "" })).not.toBe(
      serializeFacetRange({ from: "", to: "2026-01-01" }),
    );
    expect(serializeFacetRange(EMPTY_FACET_RANGE)).toBe(serializeFacetRange({ from: "", to: "" }));
  });
});
