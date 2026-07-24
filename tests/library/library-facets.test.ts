// D-BIB (nacht24 Paket 5): pure Facetten-Technik der Bibliothek — Zähler korrekt UND kombinierbar,
// Werte-Ableitung (Sprache/Alter/Trust/Status), Untergruppen, gespeicherte Sichten überleben den
// „Reload" (localStorage-Fake: neue Lese-Instanz über denselben Speicher).
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  FACET_NO_MATCH_SELECTION,
  type FacetSelection,
  type FacetValues,
  applyFacetSelection,
  combinableFacetCounts,
  isFacetNoMatch,
  languageFromTitle,
  matchesFacets,
  toggleFacetValue,
} from "../../apps/web/src/lib/facets";
import {
  LEGACY_STATUS_MIGRATION,
  LIBRARY_FACET_KEYS,
  type LibrarySavedView,
  ageBucket,
  groupByFacet,
  libraryFacetValues,
  migrateSavedFacetSelection,
  readLibraryViews,
  removeLibraryView,
  saveLibraryView,
  trustBucket,
} from "../../apps/web/src/lib/libraryFacets";

// AUFTRAG-uxpol4 (bens ROT 3.1): der FRÜHERE Magic-String — als echter Backend-Kategorie-/Tag-Wert
// und als URL-Query in den Kollisions-Gegenproben eingesetzt. Er ist KEIN reservierter Wert mehr.
const FORMER_SENTINEL = "__klarwerk_facet_no_match__";

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
    const counts = combinableFacetCounts(items, ["category", "language"], { language: ["de"] });
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

  it("applyFacetSelection UND-verknüpft; toggleFacetValue ergänzt/wählt ab (Mengensemantik)", () => {
    const filtered = applyFacetSelection(items, (i) => i, {
      category: ["Anlage 1"],
      language: ["de"],
    });
    expect(filtered).toEqual([{ category: ["Anlage 1"], language: ["de"] }]);
    let sel = toggleFacetValue({}, "language", "de");
    expect(sel.language).toEqual(["de"]);
    sel = toggleFacetValue(sel, "language", "de");
    expect(sel.language).toBeUndefined();
    // matchesFacets: fehlender Wert am Element fällt bei aktiver Auswahl heraus (kein Raten).
    expect(matchesFacets({ category: [] }, { category: ["Anlage 1"] })).toBe(false);
  });

  it("MEHRFACHAUSWAHL (bens Blocker 1.1): ODER innerhalb Gruppe, UND zwischen Gruppen", () => {
    const three = [
      { category: ["Anlage 1"], language: ["de"] },
      { category: ["Anlage 2"], language: ["de"] },
      { category: ["Anlage 3"], language: ["en"] },
    ];
    // ODER: category ∈ {Anlage 1, Anlage 2} → Vereinigung der beiden Kategorien.
    const or = applyFacetSelection(three, (i) => i, { category: ["Anlage 1", "Anlage 2"] });
    expect(or.map((i) => i.category[0])).toEqual(["Anlage 1", "Anlage 2"]);
    // UND zwischen Gruppen: zusätzlich language=de klammert Anlage 2 (de) ein, Anlage 3 (en) bleibt raus.
    const and = applyFacetSelection(three, (i) => i, {
      category: ["Anlage 1", "Anlage 2"],
      language: ["de"],
    });
    expect(and.map((i) => i.category[0])).toEqual(["Anlage 1", "Anlage 2"]);
    // toggle ergänzt einen zweiten Wert derselben Gruppe (statt ihn zu ersetzen).
    let sel = toggleFacetValue({}, "category", "Anlage 1");
    sel = toggleFacetValue(sel, "category", "Anlage 2");
    expect(sel.category).toEqual(["Anlage 1", "Anlage 2"]);
  });

  it("DEDUPE (bens Nebenfund): doppelter Tag am selben Item zählt für diesen Wert genau EINMAL", () => {
    const dup = [{ tag: ["A", "A", "B"] }];
    const counts = combinableFacetCounts(dup, ["tag"], {});
    expect(counts.tag).toEqual([
      { value: "A", count: 1 },
      { value: "B", count: 1 },
    ]);
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

// AUFTRAG-uxpol2 (bens Blocker 1.2): Migration alter Status-Sichten SEMANTIKTREU. Die reine
// Produktionsfunktion, die Library.applyView aufruft — hier direkt gepinnt.
describe("uxpol2: migrateSavedFacetSelection — Legacy-Sichten ohne Treffermengen-Drift", () => {
  it('Altsicht status:"offen" → {offen, pruefung} (offene KOs MIT Zuweisung bleiben in der Sicht)', () => {
    // Der abgeleitete Anzeigestatus eines offenen, ZUgewiesenen KOs ist „pruefung" — würde `offen`
    // 1:1 übernommen, fiele es aus der alten Treffermenge. Die Menge {offen, pruefung} hält beide.
    const openUnassigned = libraryFacetValues(ko({ status: "offen", assignments: [] }), NOW).status;
    const openAssigned = libraryFacetValues(
      ko({ status: "offen", assignments: ["u2"] }),
      NOW,
    ).status;
    expect(openUnassigned).toEqual(["offen"]);
    expect(openAssigned).toEqual(["pruefung"]);
    const migrated = migrateSavedFacetSelection({ status: "offen" });
    expect(migrated.status).toEqual(["offen", "pruefung"]);
    // Beide abgeleiteten Anzeigestatus (offen + pruefung) liegen in der migrierten Menge → sichtbar.
    expect(migrated.status).toContain(openUnassigned?.[0] ?? "offen");
    expect(migrated.status).toContain(openAssigned?.[0] ?? "pruefung");
    expect(LEGACY_STATUS_MIGRATION.offen).toEqual(["offen", "pruefung"]);
  });

  it('status:"validiert" → {validiert}; Legacy-Einzelfelder werden zu Mengen gehoben', () => {
    const migrated = migrateSavedFacetSelection({
      status: "validiert",
      type: "best_practice",
      category: "Anlage 1",
      tag: "wartung",
      maturity: "ready",
      demoFilter: "non-demo",
    });
    expect(migrated.status).toEqual(["validiert"]);
    expect(migrated.type).toEqual(["best_practice"]);
    expect(migrated.category).toEqual(["Anlage 1"]);
    expect(migrated.tag).toEqual(["wartung"]);
    expect(migrated.maturity).toEqual(["ready"]);
    expect(migrated.origin).toEqual(["non-demo"]); // demoFilter → origin
  });

  it("neue facetSel (Mengen) hat Vorrang und wird NICHT remappt; 'all'-Sentinels filtern nicht", () => {
    // Ein neu gepickter Anzeigestatus {offen} bleibt {offen} (kein Rück-Remap auf pruefung). Da hier
    // Rohstatus „offen" (→ {offen,pruefung}) UND Facette {offen} GLEICHGERICHTET sind, ist ihre
    // Schnittmenge weiterhin {offen} — unverändert (keine Regression durch den Schnitt).
    const migrated = migrateSavedFacetSelection({
      facetSel: { status: ["offen"] },
      status: "offen",
      maturity: "all",
      demoFilter: "all",
    });
    expect(migrated.status).toEqual(["offen"]);
    expect(migrated.maturity).toBeUndefined();
    expect(migrated.origin).toBeUndefined();
  });
});

// AUFTRAG-uxpol3 (bens Restfund 3.1): Alte Sichten speicherten die obere ROHFILTERUNG UND die
// dynamische `facetSel` derselben Dimension gleichzeitig; beide wirkten unabhängig. Treffermengentreu
// ist das die SCHNITTMENGE — eine widersprüchliche Altkombi muss weiterhin 0 Treffer liefern, nicht
// (durch Vorrang von `facetSel`) plötzlich Objekte zeigen.
describe("uxpol3: migrateSavedFacetSelection — widersprüchliche Alt-Doppel-Filter schneiden", () => {
  // Kleiner realer Bestand: ein validiertes und ein offenes (unzugewiesenes) KO in zwei Kategorien.
  const validatedA = ko({ status: "validiert", category: "Anlage 1" });
  const openB = ko({ status: "offen", category: "Anlage 2", assignments: [] });
  const items = [libraryFacetValues(validatedA, NOW), libraryFacetValues(openB, NOW)];

  it('widersprüchlicher Status-Doppel-Filter (roh "validiert" + Facette "offen") ⇒ 0 Treffer', () => {
    // Baseline: roh status=validiert UND facetSel.status=offen → im alten UI beide aktiv → 0 Treffer.
    const migrated = migrateSavedFacetSelection({
      status: "validiert",
      facetSel: { status: ["offen"] },
    });
    // Rohstatus „validiert" → {validiert}; Schnitt mit Facette {offen} = leer → STRUKTURELLES No-Match
    // (kein String-Wert, nicht „kein Filter"). Die Auswahl bleibt AKTIV und matcht nichts.
    expect(isFacetNoMatch(migrated.status)).toBe(true);
    expect(migrated.status).toEqual(FACET_NO_MATCH_SELECTION);
    const shown = applyFacetSelection(items, (v) => v, migrated);
    expect(shown).toEqual([]); // exakt die alte (leere) Treffermenge — kein stilles Aufweichen
  });

  it("widersprüchlicher Kategorie-Doppel-Filter (roh vs. Facette) ⇒ 0 Treffer", () => {
    const migrated = migrateSavedFacetSelection({
      category: "Anlage 1",
      facetSel: { category: ["Anlage 2"] },
    });
    expect(isFacetNoMatch(migrated.category)).toBe(true);
    expect(applyFacetSelection(items, (v) => v, migrated)).toEqual([]);
  });

  it("GEGENPROBE: gleichgerichtete Kategorie-Altsicht bleibt unverändert (keine Regression)", () => {
    // Roh UND Facette zeigen auf dieselbe Kategorie → Schnittmenge = genau diese Kategorie, kein
    // Sentinel; die Sicht zeigt weiter das eine passende KO.
    const migrated = migrateSavedFacetSelection({
      category: "Anlage 1",
      facetSel: { category: ["Anlage 1"] },
    });
    expect(migrated.category).toEqual(["Anlage 1"]);
    const shown = applyFacetSelection(items, (v) => v, migrated);
    expect(shown).toEqual([items[0]]); // nur das validierte KO in „Anlage 1"
  });

  it("GEGENPROBE: einfache Altsicht ohne gleichnamige facetSel bleibt wortgleich übernommen", () => {
    // Nur der alte Rohfilter (kein facetSel für dieselbe Dimension) → unveränderte, semantiktreue
    // Übernahme inkl. Status-Anzeigemengen-Abbildung. Nichts wird geschnitten oder verworfen.
    const migrated = migrateSavedFacetSelection({
      status: "offen",
      category: "Anlage 2",
    });
    expect(migrated.status).toEqual(["offen", "pruefung"]);
    expect(migrated.category).toEqual(["Anlage 2"]);
    expect(applyFacetSelection(items, (v) => v, migrated)).toEqual([items[1]]); // nur das offene KO
  });
});

// AUFTRAG-uxpol4 (bens ROT 3.1): Das No-Match ist STRUKTURELL (kein reservierter String mehr). Diese
// Suite sichert die zentrale Kapselungsinvariante: kein echter Wert — aus Bestand, aus der URL oder aus
// einer gespeicherten Sicht — kann den No-Match-Zustand erzeugen oder aufheben.
describe("uxpol4: strukturelles No-Match — Kollision, URL-Grenze, Save/Load-Zyklus", () => {
  const validatedA = ko({ status: "validiert", category: "Anlage 1" });
  const openB = ko({ status: "offen", category: "Anlage 2", assignments: [] });
  const items = [libraryFacetValues(validatedA, NOW), libraryFacetValues(openB, NOW)];

  it("KOLLISIONS-GEGENPROBE: ein echtes Element mit Kategorie/Tag == früherer Sentinel matcht das No-Match NICHT", () => {
    // Ein reales Element trägt als Kategorie UND als Tag exakt den früheren Magic-String.
    const collidingItem: FacetValues = {
      category: [FORMER_SENTINEL],
      tag: [FORMER_SENTINEL],
    };
    // Widersprüchliche Kategorie-Altsicht → strukturelles No-Match (kein String-Wert).
    const catNoMatch = migrateSavedFacetSelection({
      category: "Anlage 1",
      facetSel: { category: ["Anlage 2"] },
    });
    expect(isFacetNoMatch(catNoMatch.category)).toBe(true);
    // Trotz exakt gleicher Zeichenkette: No-Match ist BEDINGUNGSLOS false — vor jedem Wertvergleich.
    expect(matchesFacets(collidingItem, catNoMatch)).toBe(false);
    expect(applyFacetSelection([collidingItem], (v) => v, catNoMatch)).toEqual([]);
    // Gegenprobe für Tag ebenso: eine No-Match-Tag-Auswahl matcht das kollidierende Tag-Element nicht.
    const tagNoMatch = migrateSavedFacetSelection({
      tag: "A",
      facetSel: { tag: ["B"] },
    });
    expect(isFacetNoMatch(tagNoMatch.tag)).toBe(true);
    expect(matchesFacets(collidingItem, tagNoMatch)).toBe(false);
  });

  it("URL-GRENZE: der frühere Sentinel-String aus ?category=… ist ein ECHTER Wert, KEIN No-Match", () => {
    // Exakt der Zustand, den die Library-URL-Vorbelegung (?category=…) baut: einelementige echte Menge.
    const fromUrl: FacetSelection = { category: [FORMER_SENTINEL] };
    expect(isFacetNoMatch(fromUrl.category)).toBe(false);
    const hit: FacetValues = { category: [FORMER_SENTINEL] };
    const miss: FacetValues = { category: ["Anlage 1"] };
    // Als ECHTER Wert behandelt: nur das Element mit genau dieser Kategorie matcht (nicht „0 für alle").
    expect(matchesFacets(hit, fromUrl)).toBe(true);
    expect(matchesFacets(miss, fromUrl)).toBe(false);
    expect(applyFacetSelection([hit, miss], (v) => v, fromUrl)).toEqual([hit]);
  });

  it("ZYKLUS Migration → Sicht speichern → Sicht laden bewahrt die leere Treffermenge (strukturell)", () => {
    const backing = new Map<string, string>();
    const storage = {
      getItem: (k: string) => backing.get(k) ?? null,
      setItem: (k: string, v: string) => {
        backing.set(k, v);
      },
    };
    // 1) Migration einer widersprüchlichen Altsicht → strukturelles No-Match.
    const migrated = migrateSavedFacetSelection({
      status: "validiert",
      facetSel: { status: ["offen"] },
    });
    expect(isFacetNoMatch(migrated.status)).toBe(true);
    // 2) Aktuellen Zustand als NEUE Sicht speichern (facetSel trägt das strukturelle No-Match-Objekt).
    const view: LibrarySavedView = {
      name: "Widerspruch",
      state: { q: "", facetSel: migrated, groupBy: "none" },
    };
    saveLibraryView(storage, "u1", view);
    // Der frühere Magic-String taucht im serialisierten Speicher NICHT als Wert auf; No-Match ist strukturell.
    const rawJson = backing.get("klarwerk.library.views.u1") ?? "";
    expect(rawJson).not.toContain(FORMER_SENTINEL);
    expect(rawJson).toContain("noMatch");
    // 3) Frische Lese-Instanz („Reload") → migrateSavedFacetSelection erkennt das No-Match STRUKTURELL wieder.
    const loaded = readLibraryViews(storage, "u1")[0];
    expect(loaded).toBeDefined();
    const reMigrated = migrateSavedFacetSelection((loaded as LibrarySavedView).state);
    expect(isFacetNoMatch(reMigrated.status)).toBe(true);
    // Leere Treffermenge bleibt erhalten, ohne den Marker je als echten Wert zu interpretieren.
    expect(applyFacetSelection(items, (v) => v, reMigrated)).toEqual([]);
  });
});
