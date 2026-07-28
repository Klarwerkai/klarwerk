// AUFTRAG-mega27 Block B: die Filter der Auswahl-Trefferliste laufen über DIESELBE Facetten-Technik
// wie die Bibliothek — kein zweiter Nachbau. Dieser Test pinnt fest:
//   B1 die Bausteine sind wiederverwendet (kein Eigenbau-Zähler, kein Eigenbau-Match),
//   B2 die Facetten (Ordner/Status/Thema/Autor/Sprache) + Jahr als Bereich, Zähler KOMBINIERBAR,
//   B3 die aktive Leiste hängt über der Trefferliste,
//   B4 Massenaktionen sind KEINE Filter,
//   B5 Auswahl- und Übernahme-Semantik bleiben unverändert.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ImportPreviewEntry } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { combinableFacetCounts, matchesFacets } from "../../apps/web/src/lib/facets";
import {
  DEFAULT_PREVIEW_VIEW,
  IMPORT_SELECT_FACET_CONFIGS,
  IMPORT_SELECT_SECONDARY_FACET_KEYS,
  previewChangedMs,
  previewFacetValues,
  previewTopFolder,
  visibleRows,
} from "../../apps/web/src/lib/importSelectView";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

function entry(over: Partial<ImportPreviewEntry> & { title: string }): ImportPreviewEntry {
  return { hasImage: false, themes: [], ...over };
}

const ENTRIES: ImportPreviewEntry[] = [
  entry({
    title: "DE: Warnfarbe",
    themes: ["arbeitssicherheit"],
    author: "Anna",
    sourceScope: "KWDEMO",
    sourcePath: ["Betrieb", "Arbeitssicherheit"],
    updatedAt: "2024-03-01T00:00:00.000Z",
  }),
  entry({
    title: "[EN] Backup",
    themes: ["it-betrieb"],
    author: "Bert",
    sourceScope: "KWDEMO",
    sourcePath: ["Betrieb", "IT-Betrieb"],
    updatedAt: "2026-05-01T00:00:00.000Z",
    alreadyImported: true,
  }),
  entry({
    title: "Reisekosten",
    themes: ["verwaltung"],
    author: "Anna",
    sourceScope: "KWDEMO",
    sourcePath: ["Verwaltung"],
    updatedAt: "2019-11-01T00:00:00.000Z",
  }),
  // Ohne Elternkette: hat ehrlich KEINEN Ordner-Wert.
  entry({ title: "Lose Seite", themes: [], sourceScope: "KWDEMO" }),
];

const VALUES = ENTRIES.map(previewFacetValues);

function withSelection(
  over: Record<string, readonly string[] | undefined>,
): typeof DEFAULT_PREVIEW_VIEW {
  return { ...DEFAULT_PREVIEW_VIEW, selection: over };
}

describe("B2 · die Facetten der Auswahl", () => {
  it("Ordner = OBERSTE Pfadebene; ohne Elternkette ehrlich kein Wert", () => {
    expect(previewTopFolder(ENTRIES[0] as ImportPreviewEntry)).toEqual(["Betrieb"]);
    expect(previewTopFolder(ENTRIES[2] as ImportPreviewEntry)).toEqual(["Verwaltung"]);
    expect(previewTopFolder(ENTRIES[3] as ImportPreviewEntry)).toEqual([]);
  });

  it("leitet alle sechs Dimensionen ab (fünf Wertefacetten + der Zeitpunkt für den Bereich)", () => {
    expect(IMPORT_SELECT_FACET_CONFIGS.map((c) => c.key)).toEqual([
      "folder",
      "status",
      "theme",
      "author",
      "language",
    ]);
    expect(VALUES[0]).toEqual({
      folder: ["Betrieb"],
      status: ["new"],
      theme: ["arbeitssicherheit"],
      author: ["Anna"],
      language: ["de"],
    });
    expect(previewChangedMs(ENTRIES[0] as ImportPreviewEntry)).toBe(
      Date.parse("2024-03-01T00:00:00.000Z"),
    );
    // Kein/unlesbares Quell-Datum → NaN (matchesFacetRange schließt bei aktivem Bereich aus).
    expect(Number.isNaN(previewChangedMs(ENTRIES[3] as ImportPreviewEntry))).toBe(true);
    expect(Number.isNaN(previewChangedMs(entry({ title: "x", updatedAt: "gestern" })))).toBe(true);
  });

  it("Werte, die im Bestand nicht vorkommen, erscheinen nicht", () => {
    const counts = combinableFacetCounts(VALUES, ["folder", "language"], {});
    expect(counts.folder?.map((c) => c.value)).toEqual(["Betrieb", "Verwaltung"]);
    // Es gibt kein NL im Bestand → kein nl-Wert. Reihenfolge = Häufigkeit, dann alphabetisch
    // (dieselbe Sortierung wie in der Bibliothek — combinableFacetCounts, keine Zweitregel).
    expect(counts.language?.map((c) => c.value)).toEqual(["other", "de", "en"]);
  });

  it("Zähler sind KOMBINIERBAR: jede Facette zählt auf der Menge, die alle anderen Wahlen erfüllt", () => {
    // Autor „Anna" gewählt → die Ordner-Zähler zeigen nur noch Annas Ordner …
    const counts = combinableFacetCounts(VALUES, ["folder", "author"], { author: ["Anna"] });
    expect(counts.folder).toEqual([
      { value: "Betrieb", count: 1 },
      { value: "Verwaltung", count: 1 },
    ]);
    // … die AUTOR-Facette selbst bleibt aber auf dem vollen Kontext (sich selbst ausgeklammert).
    expect(counts.author).toEqual([
      { value: "Anna", count: 2 },
      { value: "Bert", count: 1 },
    ]);
  });

  it("ODER innerhalb einer Gruppe, UND zwischen Gruppen (Mengensemantik von lib/facets)", () => {
    const both = visibleRows(ENTRIES, withSelection({ folder: ["Betrieb", "Verwaltung"] }));
    expect(both.map((r) => r.index)).toEqual([0, 1, 2]);
    const and = visibleRows(ENTRIES, withSelection({ folder: ["Betrieb"], author: ["Anna"] }));
    expect(and.map((r) => r.index)).toEqual([0]);
    // Ein Eintrag OHNE Ordner fällt bei aktiver Ordner-Wahl heraus (FacetValues-Vertrag).
    expect(both.some((r) => r.index === 3)).toBe(false);
  });

  it("der Bereichsfilter wirkt ZUSÄTZLICH (UND) auf dem Quell-Datum", () => {
    const rows = visibleRows(ENTRIES, {
      ...DEFAULT_PREVIEW_VIEW,
      range: { from: "2024-01-01", to: "2026-12-31" },
    });
    expect(rows.map((r) => r.index)).toEqual([0, 1]);
    // Zusammen mit einer Facette: UND.
    const narrow = visibleRows(ENTRIES, {
      ...DEFAULT_PREVIEW_VIEW,
      selection: { author: ["Anna"] },
      range: { from: "2024-01-01", to: "2026-12-31" },
    });
    expect(narrow.map((r) => r.index)).toEqual([0]);
  });

  it("Suche und Facetten kombinieren (Suche bleibt unverändert)", () => {
    expect(
      visibleRows(ENTRIES, {
        ...DEFAULT_PREVIEW_VIEW,
        query: "anna",
        selection: { folder: ["Verwaltung"] },
      }).map((r) => r.index),
    ).toEqual([2]);
  });

  it("matchesFacets ist die EINE Match-Regel — visibleRows erfindet keine zweite", () => {
    const selection = { status: ["new"], author: ["Anna"] };
    const expected = ENTRIES.flatMap((e, i) =>
      matchesFacets(previewFacetValues(e), selection) ? [i] : [],
    );
    expect(visibleRows(ENTRIES, withSelection(selection)).map((r) => r.index)).toEqual(expected);
  });
});

describe("B1/B3/B4 · Wiederverwendung und Anordnung (Quell-Inspektion)", () => {
  const src = read("apps/web/src/components/ImportSelect.tsx");

  it("verwendet die Bibliotheks-Bausteine statt eines zweiten Nachbaus", () => {
    for (const needle of [
      '"./FacetFilter"',
      '"./facets/FacetActiveBar"',
      "facetRailGroups(",
      "toggleFacetValue(",
      "clearFacetSelection(",
      "<FacetFilter",
      "<FacetActiveBar",
    ]) {
      expect(src, needle).toContain(needle);
    }
    // Die abgelösten Eigenbauten sind WEG (kein zweiter Zähler, kein zweiter Ausblenden-Schalter).
    expect(src).not.toContain("statusChipCounts");
    expect(src).not.toContain("hideImported");
  });

  it("B1: das eingeklappte Weitere-Filter-Panel ist verdrahtet (Vorbild Bibliothek)", () => {
    expect(src).toContain("secondaryKeys={IMPORT_SELECT_SECONDARY_FACET_KEYS}");
    expect(src).toContain("moreStorageKey={IMPORT_MORE_FILTERS_STORAGE_KEY}");
    // AUFTRAG-mega28 BLOCK C (Pedi 26.07.): „Sprache" ist zurück in der SICHTBAREN Reihe — der
    // Bestand ist dreisprachig gedoppelt und die Sprache ist der Filter, den Pedi benutzt.
    // Hinter der Klappe bleibt allein „Autor"; die übrige Reihenfolge ist unverändert.
    expect(IMPORT_SELECT_SECONDARY_FACET_KEYS).toEqual(["author"]);
  });

  it("B3: die aktive Leiste steht über der TREFFERLISTE, nicht in der Schiene", () => {
    const bar = src.indexOf("<FacetActiveBar");
    const list = src.indexOf("<ImportPreviewTree");
    const rail = src.indexOf("<FacetFilter");
    expect(bar).toBeGreaterThan(-1);
    expect(bar).toBeGreaterThan(rail); // nach der Schiene …
    expect(bar).toBeLessThan(list); // … und vor der Liste.
  });

  it("B4: Massenaktionen stehen in ihrer eigenen Zeile, nicht in der Filterschiene", () => {
    expect(src).toContain('t("imp.select.bulkLabel")');
    // Die Sprach-Abwahl ist eine Massenaktion und liegt hinter der aktiven Filterleiste.
    expect(src.indexOf("<LanguageDeselectChips")).toBeGreaterThan(src.indexOf("<FacetActiveBar"));
    // Sie ist KEIN Prop der Schiene.
    const railBlock = src.slice(src.indexOf("<FacetFilter"), src.indexOf("<FacetActiveBar"));
    expect(railBlock).not.toContain("LanguageDeselectChips");
    expect(railBlock).not.toContain("deselectLanguage");
  });

  it("die neuen Texte sind in DE/EN/NL vorhanden", () => {
    const keys = [
      ...IMPORT_SELECT_FACET_CONFIGS.map((c) => c.labelKey),
      "imp.select.facetCount",
      "imp.select.rangeLabel",
      "imp.select.bulkLabel",
      "imp.select.groupFolder",
      "imp.select.noFolder",
      "imp.select.folderFallbackNoPath",
      "imp.select.folderFallbackSingle",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en", "nl"]) {
        // AUFTRAG-mega34 F: pluralisierte Schlüssel liegen als `_one`/`_other` vor — der Wächter
        // akzeptiert die Basis ODER die Formen, damit er die Copy weiter wirklich prüft.
        const vorhanden = [key, `${key}_one`, `${key}_other`].some(
          (k) => String(i18n.getResource(lng, "translation", k) ?? "").length > 0,
        );
        expect(vorhanden, `${lng}:${key}`).toBe(true);
      }
    }
  });
});

describe("B5 · Auswahl- und Übernahme-Semantik bleibt unverändert", () => {
  const src = read("apps/web/src/components/ImportSelect.tsx");

  it("Vorab-Abwahl bereits importierter UND vorgemerkter Einträge bleibt", () => {
    expect(src).toContain(
      "data.preview.map((entry) => entry.alreadyImported !== true && entry.alreadyQueued !== true)",
    );
  });

  it("latest-wins, Live-Aktualisierung und candidateIdOf-Weitergabe bleiben verdrahtet", () => {
    expect(src).toContain("latestRef.current.isCurrent(requestId)");
    expect(src).toContain("setTimeout(() => mutateRef.current(), 350)");
    expect(src).toContain("selectedCandidateIds={selectedCandidateIds}");
    expect(src).toContain("checkedRows[index] === true && entry.id");
  });

  it("F1/F2 bleiben: Bulk fasst Bekanntes nie an, Alle-abwählen leert global", () => {
    expect(src).toContain("setRowsSelected(prev, bulkRows, true)");
    expect(src).toContain("clearAllSelected(prev)");
    expect(src).toContain("setRowsSelected(prev, bulkSelectableRows(groupRowsArg), true)");
    expect(src).toContain("setRowsSelected(prev, groupRowsArg, false)");
  });
});
