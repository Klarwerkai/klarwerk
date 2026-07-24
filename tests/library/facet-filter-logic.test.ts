// AUFTRAG-uxpol1 (PAKET 1): pure Facetten-Filter-Logik (lib/facetFilter) — Kontext-Zähler korrekt
// UND kombinierbar, 0-Treffer-Optionen ausgegraut (disabled), Universum kennt auch 0-Werte, aktive
// Pillen in Config-Reihenfolge, Reset. Baut auf der vorhandenen facets-Technik auf (keine zweite Logik).
import { describe, expect, it } from "vitest";
import {
  type FacetGroupConfig,
  activeFacetPills,
  buildFacetGroups,
  clearFacetSelection,
  facetUniverse,
  isAnyFacetActive,
} from "../../apps/web/src/lib/facetFilter";
import type { FacetValues } from "../../apps/web/src/lib/facets";

const CONFIGS: readonly FacetGroupConfig[] = [
  { key: "category", labelKey: "cat" },
  { key: "language", labelKey: "lang" },
];

const ITEMS: FacetValues[] = [
  { category: ["A"], language: ["de"] },
  { category: ["A"], language: ["en"] },
  { category: ["B"], language: ["de"] },
];

function group(
  items: FacetValues[],
  sel: Record<string, readonly string[] | undefined>,
  key: string,
) {
  const g = buildFacetGroups(items, CONFIGS, sel).find((x) => x.key === key);
  if (!g) {
    throw new Error(`Gruppe ${key} fehlt`);
  }
  return g;
}

describe("facetUniverse", () => {
  it("kennt ALLE vorkommenden Werte je Facette, nach Häufigkeit sortiert", () => {
    const u = facetUniverse(ITEMS, ["category", "language"]);
    expect(u.category).toEqual(["A", "B"]); // A (2) vor B (1)
    expect(u.language).toEqual(["de", "en"]); // de (2) vor en (1)
  });
});

describe("buildFacetGroups: Kontext-Zähler + Ausgrauen", () => {
  it("ohne Auswahl: jede Option zeigt ihre Bestandshäufigkeit, nichts deaktiviert", () => {
    const cat = group(ITEMS, {}, "category");
    expect(cat.options.map((o) => [o.value, o.count, o.disabled])).toEqual([
      ["A", 2, false],
      ["B", 1, false],
    ]);
  });

  it("KOMBINIERBAR: fremde Auswahl senkt die Zähler, die EIGENE Facette bleibt ausgeklammert", () => {
    // language=de aktiv → Kategorie-Zähler auf der de-Menge (A:1, B:1) …
    const cat = group(ITEMS, { language: ["de"] }, "category");
    expect(cat.options.map((o) => [o.value, o.count])).toEqual([
      ["A", 1],
      ["B", 1],
    ]);
    // … der Sprach-Zähler zeigt weiter ALLE Sprachen (eigene Facette ausgeklammert).
    const lang = group(ITEMS, { language: ["de"] }, "language");
    expect(lang.options.map((o) => [o.value, o.count])).toEqual([
      ["de", 2],
      ["en", 1],
    ]);
  });

  it("0 Treffer im Kontext → Option ausgegraut/deaktiviert (nicht verschluckt), Wert bleibt sichtbar", () => {
    // category=B aktiv → nur item2 (B/de). Sprache: de(1), en(0) → en disabled.
    const lang = group(ITEMS, { category: ["B"] }, "language");
    const de = lang.options.find((o) => o.value === "de");
    const en = lang.options.find((o) => o.value === "en");
    expect(de).toMatchObject({ count: 1, disabled: false });
    expect(en).toMatchObject({ count: 0, disabled: true }); // sichtbar, aber nicht klickbar
  });

  it("die aktuell gewählte Option ist selected und NIE disabled (Abwählen bleibt möglich)", () => {
    const cat = group(ITEMS, { category: ["A"] }, "category");
    const a = cat.options.find((o) => o.value === "A");
    expect(a).toMatchObject({ selected: true, disabled: false });
  });

  it("MEHRFACHAUSWAHL (bens Blocker 1.1): ODER innerhalb der Gruppe — beide gewählten Werte sind selected", () => {
    // category = {A, B} → beide selected; die eigene Facette bleibt beim Zählen ausgeklammert,
    // also zeigen die Zähler weiter die volle Bestandshäufigkeit (A:2, B:1).
    const cat = group(ITEMS, { category: ["A", "B"] }, "category");
    const byValue = new Map(cat.options.map((o) => [o.value, o]));
    expect(byValue.get("A")).toMatchObject({ selected: true, count: 2 });
    expect(byValue.get("B")).toMatchObject({ selected: true, count: 1 });
  });

  it("MEHRFACHAUSWAHL: ODER (category A|B) senkt einen Fremd-Zähler NICHT unter die Vereinigung", () => {
    // Mit category ∈ {A,B} umfasst der Kontext ALLE drei Items → Sprache de(2), en(1) unverändert.
    const lang = group(ITEMS, { category: ["A", "B"] }, "language");
    expect(lang.options.map((o) => [o.value, o.count])).toEqual([
      ["de", 2],
      ["en", 1],
    ]);
  });

  it("DEDUPE (bens Nebenfund): ein doppelter Wert am selben Item zählt für diesen Wert genau EINMAL", () => {
    const dup: FacetValues[] = [{ category: ["A", "A"], language: ["de"] }];
    const cat = buildFacetGroups(dup, CONFIGS, {}).find((x) => x.key === "category");
    expect(cat?.options.find((o) => o.value === "A")?.count).toBe(1);
  });

  it("Anzeige-Deckel: nur die häufigsten N, Rest ehrlich als hiddenCount", () => {
    const many: FacetValues[] = Array.from({ length: 20 }, (_, i) => ({ category: [`C${i}`] }));
    const g = buildFacetGroups(many, [{ key: "category", labelKey: "c" }], {}, 12).find(
      (x) => x.key === "category",
    );
    expect(g?.options.length).toBe(12);
    expect(g?.hiddenCount).toBe(8);
  });
});

describe("Aktive Filter + Reset", () => {
  it("activeFacetPills liefert je gewähltem Wert EINE Pille (Config-Reihenfolge, dann Auswahlreihenfolge)", () => {
    // Mehrfachauswahl: category {A,B} → zwei Pillen; language {de} → eine — alle in Config-Ordnung.
    const pills = activeFacetPills(CONFIGS, { language: ["de"], category: ["A", "B"] });
    expect(pills).toEqual([
      { key: "category", labelKey: "cat", value: "A" },
      { key: "category", labelKey: "cat", value: "B" },
      { key: "language", labelKey: "lang", value: "de" },
    ]);
  });

  it("isAnyFacetActive erkennt aktive/leere Auswahl; clearFacetSelection leert alles", () => {
    expect(isAnyFacetActive({})).toBe(false);
    expect(isAnyFacetActive({ category: undefined })).toBe(false);
    expect(isAnyFacetActive({ category: [] })).toBe(false);
    expect(isAnyFacetActive({ category: ["A"] })).toBe(true);
    expect(clearFacetSelection()).toEqual({});
    expect(isAnyFacetActive(clearFacetSelection())).toBe(false);
  });
});
