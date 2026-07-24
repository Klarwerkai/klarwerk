// D-BIB (nacht24 Paket 5): pure Facetten-Technik der Bibliothek — Zähler korrekt UND kombinierbar,
// Werte-Ableitung (Sprache/Alter/Trust/Status), Untergruppen, gespeicherte Sichten überleben den
// „Reload" (localStorage-Fake: neue Lese-Instanz über denselben Speicher).
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  applyFacetSelection,
  combinableFacetCounts,
  languageFromTitle,
  matchesFacets,
  toggleFacetValue,
} from "../../apps/web/src/lib/facets";
import {
  LIBRARY_FACET_KEYS,
  ageBucket,
  groupByFacet,
  libraryFacetValues,
  readLibraryViews,
  removeLibraryView,
  saveLibraryView,
  trustBucket,
} from "../../apps/web/src/lib/libraryFacets";

const NOW = Date.parse("2026-07-23T22:00:00.000Z");

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Ventil entlasten",
    status: "offen",
    assignments: [],
    trust: 0,
    category: "Anlage 1",
    author: "u1",
    createdAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  } as unknown as KnowledgeObject;
}

describe("D-BIB: Facetten-Zähler (korrekt + kombinierbar)", () => {
  const items = [
    { category: ["Anlage 1"], language: ["de"] },
    { category: ["Anlage 1"], language: ["en"] },
    { category: ["Anlage 2"], language: ["de"] },
  ];

  it("zählt je Facette nur vorkommende Werte, sortiert nach Häufigkeit", () => {
    const counts = combinableFacetCounts(items, ["category", "language"], {});
    expect(counts.category).toEqual([
      { value: "Anlage 1", count: 2 },
      { value: "Anlage 2", count: 1 },
    ]);
    expect(counts.language).toEqual([
      { value: "de", count: 2 },
      { value: "en", count: 1 },
    ]);
  });

  it("KOMBINIERBAR: die eigene Facette wird beim Zählen ausgeklammert, fremde Auswahl gilt", () => {
    const counts = combinableFacetCounts(items, ["category", "language"], { language: "de" });
    // Kategorie-Zähler auf der de-Menge (fremde Auswahl gilt) …
    expect(counts.category).toEqual([
      { value: "Anlage 1", count: 1 },
      { value: "Anlage 2", count: 1 },
    ]);
    // … aber der Sprach-Zähler zeigt weiter ALLE Sprachen (eigene Facette ausgeklammert) —
    // so bleibt ein Wechsel der Wahl sichtbar/möglich.
    expect(counts.language).toEqual([
      { value: "de", count: 2 },
      { value: "en", count: 1 },
    ]);
  });

  it("applyFacetSelection UND-verknüpft; toggleFacetValue wählt ab bei erneutem Klick", () => {
    const filtered = applyFacetSelection(items, (i) => i, {
      category: "Anlage 1",
      language: "de",
    });
    expect(filtered).toEqual([{ category: ["Anlage 1"], language: ["de"] }]);
    let sel = toggleFacetValue({}, "language", "de");
    expect(sel.language).toBe("de");
    sel = toggleFacetValue(sel, "language", "de");
    expect(sel.language).toBeUndefined();
    // matchesFacets: fehlender Wert am Element fällt bei aktiver Auswahl heraus (kein Raten).
    expect(matchesFacets({ category: [] }, { category: "Anlage 1" })).toBe(false);
  });
});

describe("D-BIB: Werte-Ableitung je KO (einmal je Datenlauf)", () => {
  it("Sprache aus dem Titel-Präfix — geteilte Erkennung (auch Import nutzt sie)", () => {
    expect(languageFromTitle("[DE] Wartungsplan")).toBe("de");
    expect(languageFromTitle("EN – Maintenance guide")).toBe("en");
    expect(languageFromTitle("NL: Onderhoud")).toBe("nl");
    expect(languageFromTitle("Wartungsplan ohne Präfix")).toBe("other");
  });

  it("Alter-Buckets aus createdAt; unparsebar → unknown (kein erfundenes Alter)", () => {
    const day = 24 * 60 * 60 * 1000;
    expect(ageBucket(new Date(NOW - 5 * day).toISOString(), NOW)).toBe("d30");
    expect(ageBucket(new Date(NOW - 100 * day).toISOString(), NOW)).toBe("d180");
    expect(ageBucket(new Date(NOW - 300 * day).toISOString(), NOW)).toBe("y1");
    expect(ageBucket(new Date(NOW - 500 * day).toISOString(), NOW)).toBe("older");
    expect(ageBucket("kein-datum", NOW)).toBe("unknown");
    expect(ageBucket(undefined, NOW)).toBe("unknown");
  });

  it("Trust-Buckets 0 / 1–39 / 40–69 / 70+", () => {
    expect(trustBucket(0)).toBe("t0");
    expect(trustBucket(39)).toBe("t1");
    expect(trustBucket(40)).toBe("t40");
    expect(trustBucket(70)).toBe("t70");
  });

  it("libraryFacetValues: alle sechs Facetten, Status über die Validierungs-Ableitung", () => {
    const values = libraryFacetValues(
      ko({ status: "offen", assignments: ["u2"], trust: 55, title: "[EN] Pump guide" }),
      NOW,
    );
    expect(Object.keys(values).sort()).toEqual([...LIBRARY_FACET_KEYS].sort());
    expect(values.status).toEqual(["pruefung"]); // offen + Zuweisung = In Prüfung (wie Validierung)
    expect(values.language).toEqual(["en"]);
    expect(values.trust).toEqual(["t40"]);
    expect(values.category).toEqual(["Anlage 1"]);
  });

  it("groupByFacet: Untergruppen nach erstem Facettenwert, Größe absteigend", () => {
    const items = [
      { ko: ko({ id: "a", category: "Anlage 1" }) },
      { ko: ko({ id: "b", category: "Anlage 2" }) },
      { ko: ko({ id: "c", category: "Anlage 2" }) },
    ];
    const groups = groupByFacet(items, (i) => libraryFacetValues(i.ko, NOW), "category");
    expect(groups.map((g) => [g.value, g.items.length])).toEqual([
      ["Anlage 2", 2],
      ["Anlage 1", 1],
    ]);
  });
});

// localStorage-Fake: ein simpler Map-Speicher — „Reload" = erneutes Lesen aus demselben Speicher
// (neue Aufrufe ohne gehaltenen Zustand), genau wie ein neuer Seitenaufruf im Browser.
function fakeStorage(): Pick<Storage, "getItem" | "setItem"> & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => {
      raw.set(key, value);
    },
  };
}

describe("D-BIB: gespeicherte Sichten (lokal, je Nutzer)", () => {
  it("Sicht speichern → überlebt den Reload (frisches Lesen aus demselben Speicher)", () => {
    const storage = fakeStorage();
    saveLibraryView(storage, "u1", {
      name: "Meine Anlage",
      state: { category: "Anlage 1", groupBy: "category", facetSel: { language: "de" } },
    });
    // „Reload": keine gehaltene Liste — nur der Speicher bleibt.
    const reloaded = readLibraryViews(storage, "u1");
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]?.name).toBe("Meine Anlage");
    expect(reloaded[0]?.state).toMatchObject({ category: "Anlage 1", groupBy: "category" });
    // Je Nutzer getrennt: ein anderer Nutzer sieht die Sicht NICHT.
    expect(readLibraryViews(storage, "u2")).toHaveLength(0);
  });

  it("Upsert per Name, alphabetisch sortiert; löschen entfernt genau die eine Sicht", () => {
    const storage = fakeStorage();
    saveLibraryView(storage, "u1", { name: "Zulu", state: { a: 1 } });
    saveLibraryView(storage, "u1", { name: "Alpha", state: { a: 1 } });
    saveLibraryView(storage, "u1", { name: "Zulu", state: { a: 2 } }); // Upsert
    const views = readLibraryViews(storage, "u1");
    expect(views.map((v) => v.name)).toEqual(["Alpha", "Zulu"]);
    expect(views[1]?.state).toEqual({ a: 2 });
    removeLibraryView(storage, "u1", "Zulu");
    expect(readLibraryViews(storage, "u1").map((v) => v.name)).toEqual(["Alpha"]);
  });

  it("kaputtes JSON/Fremdformat → leere Liste (kein Crash); leerer Name wird nicht gespeichert", () => {
    const storage = fakeStorage();
    storage.raw.set("klarwerk.library.views.u1", "{kaputt");
    expect(readLibraryViews(storage, "u1")).toEqual([]);
    storage.raw.set("klarwerk.library.views.u1", JSON.stringify({ nicht: "eine Liste" }));
    expect(readLibraryViews(storage, "u1")).toEqual([]);
    expect(saveLibraryView(storage, "u1", { name: "   ", state: {} })).toEqual([]);
  });
});
