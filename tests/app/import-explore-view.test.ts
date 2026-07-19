import { describe, expect, it } from "vitest";
import type { ImportExploreSummary } from "../../apps/web/src/api/types";
import {
  EXPLORE_TOP_AUTHORS,
  EXPLORE_TOP_THEMES,
  formatPeriod,
  toExploreView,
} from "../../apps/web/src/lib/importExplore";

// IC-2 (Import-Cockpit): PURE View-Model-Aufbereitung der Erkundung — deterministisch, DOM-frei.

function summary(over: Partial<ImportExploreSummary> = {}): ImportExploreSummary {
  return {
    totalCount: over.totalCount ?? 0,
    distinctSources: over.distinctSources ?? 0,
    authors: over.authors ?? [],
    themes: over.themes ?? [],
    dateRange: over.dateRange ?? null,
    withImagesHint: over.withImagesHint ?? 0,
  };
}

function authors(n: number): { name: string; count: number }[] {
  return Array.from({ length: n }, (_, i) => ({ name: `autor-${i}`, count: n - i }));
}

describe("IC-2: formatPeriod", () => {
  it("null → „—“", () => {
    expect(formatPeriod(null)).toBe("—");
  });

  it("verschiedene Jahre → Spanne mit Gedankenstrich", () => {
    expect(
      formatPeriod({ earliest: "2019-03-01T00:00:00.000Z", latest: "2026-07-19T00:00:00.000Z" }),
    ).toBe("2019–2026");
  });

  it("gleiches Jahr → nur ein Jahr", () => {
    expect(
      formatPeriod({ earliest: "2026-01-02T00:00:00.000Z", latest: "2026-12-30T00:00:00.000Z" }),
    ).toBe("2026");
  });

  it("unbrauchbarer Zeitstempel → „—“", () => {
    expect(formatPeriod({ earliest: "kaputt", latest: "2026-01-01" })).toBe("—");
  });
});

describe("IC-2: toExploreView", () => {
  it("leere Summary → Nullwerte, Zeitraum „—“, keine Listen", () => {
    const v = toExploreView(summary());
    expect(v.totalCount).toBe(0);
    expect(v.distinctSources).toBe(0);
    expect(v.period).toBe("—");
    expect(v.authors).toEqual([]);
    expect(v.authorsRest).toBe(0);
    expect(v.themes).toEqual([]);
    expect(v.themesRest).toBe(0);
    expect(v.withImagesHint).toBe(0);
  });

  it("übernimmt Kennzahlen und formatiert den Zeitraum", () => {
    const v = toExploreView(
      summary({
        totalCount: 42,
        distinctSources: 3,
        dateRange: { earliest: "2020-05-01T00:00:00.000Z", latest: "2026-02-02T00:00:00.000Z" },
        withImagesHint: 7,
      }),
    );
    expect(v.totalCount).toBe(42);
    expect(v.distinctSources).toBe(3);
    expect(v.period).toBe("2020–2026");
    expect(v.withImagesHint).toBe(7);
  });

  it("deckelt Autoren auf Top-N und meldet den Rest als „+N“", () => {
    const v = toExploreView(summary({ authors: authors(EXPLORE_TOP_AUTHORS + 3) }));
    expect(v.authors).toHaveLength(EXPLORE_TOP_AUTHORS);
    expect(v.authorsRest).toBe(3);
    // Reihenfolge aus der Summary bleibt erhalten (IC-1 sortiert bereits).
    expect(v.authors[0]?.name).toBe("autor-0");
  });

  it("kein Autoren-Rest, wenn ≤ Top-N", () => {
    const v = toExploreView(summary({ authors: authors(EXPLORE_TOP_AUTHORS) }));
    expect(v.authors).toHaveLength(EXPLORE_TOP_AUTHORS);
    expect(v.authorsRest).toBe(0);
  });

  it("deckelt Themen auf Top-12 (Reihenfolge stabil) und meldet den Rest", () => {
    const themes = Array.from({ length: EXPLORE_TOP_THEMES + 5 }, (_, i) => ({
      label: `t-${i}`,
      count: 100 - i,
    }));
    const v = toExploreView(summary({ themes }));
    expect(v.themes).toHaveLength(EXPLORE_TOP_THEMES);
    expect(v.themesRest).toBe(5);
    const expected = themes.slice(0, EXPLORE_TOP_THEMES).map((th) => th.label);
    expect(v.themes.map((th) => th.label)).toEqual(expected);
  });
});
