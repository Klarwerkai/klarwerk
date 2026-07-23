// WP-IC-PAKET-1 (Teil 3, abgenommener 5-Schritte-Flow Schritt 2/3): fehlende Filter der Erkundung —
// Autoren-/Themen-/Space-Chips klickbar, Zeitraum von/bis, Live-Aktualisierung der Trefferzahl.
// Plus Teil-2-Kennzeichnung (abgeleitete Themen) und Teil-4-Badges/Auswahl in der Vorschau.
// Muster: pures View-Model + Source-/i18n-Pins (wie import-explore-view/import-select-view).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { toExploreView } from "../../apps/web/src/lib/importExplore";

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("WP-IC-PAKET-1 Teil 2/3: ExploreView trägt Herkunft + Spaces", () => {
  it("toExploreView kennzeichnet abgeleitete Themen und reicht die Space-Liste durch", () => {
    const view = toExploreView({
      totalCount: 3,
      distinctSources: 2,
      authors: [{ name: "anna", count: 2 }],
      themes: [
        { label: "wartung", count: 2 },
        { label: "Onboarding", count: 2, origin: "derived" },
      ],
      dateRange: { earliest: "2020-01-01", latest: "2026-05-01" },
      withImagesHint: 0,
      sourceNames: [
        { name: "OPS", count: 2 },
        { name: "DOKU", count: 1 },
      ],
    });
    expect(view.themes).toEqual([
      { label: "wartung", count: 2, derived: false },
      { label: "Onboarding", count: 2, derived: true },
    ]);
    expect(view.spaces).toEqual([
      { name: "OPS", count: 2 },
      { name: "DOKU", count: 1 },
    ]);
  });

  it("Altbestand-Antworten OHNE sourceNames → leere Space-Liste (kein Filter, kein Crash)", () => {
    const view = toExploreView({
      totalCount: 1,
      distinctSources: 1,
      authors: [],
      themes: [],
      dateRange: null,
      withImagesHint: 0,
    });
    expect(view.spaces).toEqual([]);
  });
});

describe("WP-IC-PAKET-1 Teil 3: klickbare Filter-Chips + Zeitraum + Live-Aktualisierung (Verdrahtung)", () => {
  it("Landkarten-Chips sind echte Buttons mit aria-pressed; Autoren/Themen/Spaces speisen die Auswahl", () => {
    const src = read("apps/web/src/components/ImportExplore.tsx");
    expect(src).toContain("aria-pressed={active}");
    expect(src).toContain("toggleValue(setSelAuthors, a.name)");
    expect(src).toContain("toggleValue(setSelThemes, th.label)");
    expect(src).toContain("toggleValue(setSelSpaces, s.name)");
    // Spaces-Filter nur, wenn es MEHRERE gibt.
    expect(src).toContain("view.spaces.length > 1");
    // Abgeleitete Themen dezent gekennzeichnet (Teil 2).
    expect(src).toContain('t("imp.explore.derivedTag")');
    expect(src).toContain('t("imp.explore.derivedHint")');
    // Platzhalter-Chips („ohne Autor/Thema") bleiben NICHT-klickbare Anzeige.
    expect(src).toContain("a.name === NO_AUTHOR_LABEL");
    expect(src).toContain("th.label === NO_THEME_LABEL");
  });

  it("ImportSelect: Zeitraum von/bis, Chip-Kriterien und LIVE-Aktualisierung der Trefferzahl", () => {
    const src = read("apps/web/src/components/ImportSelect.tsx");
    expect(src).toContain('t("imp.select.yearFrom")');
    expect(src).toContain('t("imp.select.yearTo")');
    expect(src).toContain("chip.themes.length > 0 ? { themes: chip.themes }");
    expect(src).toContain("chip.authors.length > 0 ? { authors: chip.authors }");
    expect(src).toContain("chip.spaces.length > 0 ? { spaces: chip.spaces }");
    // Live: bereits geöffnete Vorschau aktualisiert sich bei Filter-Änderungen (debounced).
    expect(src).toContain("const criteriaKey = JSON.stringify(");
    expect(src).toContain("setTimeout(() => mutateRef.current(), 350)");
  });

  it("Teil 4: Vorschau markiert Importiertes und wählt es standardmäßig AB (wieder anwählbar)", () => {
    const src = read("apps/web/src/components/ImportSelect.tsx");
    // Badge-Datenlage + Abwahl-Default aus dem Server-Flag; Checkbox bleibt bedienbar (kein Verbot).
    expect(src).toContain("entry.alreadyImported !== true");
    expect(src).toContain('t("imp.preview.imported")');
    expect(src).toContain('t("imp.preview.sourceNewer")');
    expect(src).toContain('type="checkbox"');
    // WP-SHIP9-S2 Paket 2: Zeilen-Rendering wanderte in renderRow (Originalindex bleibt gebunden).
    expect(src).toContain("onChange={() => toggleRow(index)}");
    expect(src).toContain('t("imp.select.importedDeselected")');
    // Erkundung zeigt den ehrlichen Gesamt-Status.
    const explore = read("apps/web/src/components/ImportExplore.tsx");
    expect(explore).toContain('t("imp.explore.alreadyImported", { n: alreadyImported })');
  });

  it("alle neuen Texte existieren DE/EN/NL", () => {
    for (const key of [
      "imp.explore.derivedTag",
      "imp.explore.derivedHint",
      "imp.explore.spaces",
      "imp.explore.alreadyImported",
      "imp.select.yearFrom",
      "imp.select.yearTo",
      "imp.select.critSpaces",
      "imp.select.alreadyImported",
      "imp.select.selectedCount",
      "imp.select.importedDeselected",
      "imp.preview.imported",
      "imp.preview.sourceNewer",
    ]) {
      for (const lng of ["de", "en", "nl"]) {
        expect(
          String(i18n.getResource(lng, "translation", key) ?? "").length,
          `${lng}:${key}`,
        ).toBeGreaterThan(0);
      }
    }
  });
});
