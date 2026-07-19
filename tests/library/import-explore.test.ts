import { describe, expect, it } from "vitest";
import type { ImportItem } from "../../services/library-analytics";
import {
  NO_AUTHOR_LABEL,
  NO_THEME_LABEL,
  summarizeImportItems,
} from "../../services/library-analytics";

// IC-1 (Import-Cockpit): READ-ONLY Erkundungs-Aggregat — deterministisch, pure, kein Netz/keine KI.

function item(over: Partial<ImportItem> = {}): ImportItem {
  return {
    title: over.title ?? "T",
    statement: over.statement ?? "S",
    type: over.type ?? "best_practice",
    category: over.category ?? "K",
    ...over,
  };
}

describe("IC-1: summarizeImportItems", () => {
  it("leere Liste → Nullwerte, kein Zeitraum", () => {
    const s = summarizeImportItems([]);
    expect(s.totalCount).toBe(0);
    expect(s.distinctSources).toBe(0);
    expect(s.authors).toEqual([]);
    expect(s.themes).toEqual([]);
    expect(s.dateRange).toBeNull();
    expect(s.withImagesHint).toBe(0);
  });

  it("zählt Autoren absteigend; fehlender Autor → „(ohne Autor)“", () => {
    const s = summarizeImportItems([
      item({ author: "anna" }),
      item({ author: "bob" }),
      item({ author: "anna" }),
      item({}), // ohne Autor
    ]);
    expect(s.totalCount).toBe(4);
    expect(s.authors).toEqual([
      { name: "anna", count: 2 },
      { name: NO_AUTHOR_LABEL, count: 1 },
      { name: "bob", count: 1 },
    ]);
  });

  it("Themen aus tags absteigend; Items ohne Label → „(ohne Label)“-Zähler am Ende", () => {
    const s = summarizeImportItems([
      item({ tags: ["sicherheit", "wartung"] }),
      item({ tags: ["sicherheit"] }),
      item({ tags: [] }),
      item({}), // kein tags-Feld
    ]);
    expect(s.themes).toEqual([
      { label: "sicherheit", count: 2 },
      { label: "wartung", count: 1 },
      { label: NO_THEME_LABEL, count: 2 },
    ]);
  });

  it("distinctSources zählt sourceScope (Fallback category)", () => {
    const s = summarizeImportItems([
      item({ sourceScope: "SPACE-A" }),
      item({ sourceScope: "SPACE-A" }),
      item({ sourceScope: "SPACE-B" }),
      item({ category: "NUR-KAT" }), // kein sourceScope → category zählt
    ]);
    expect(s.distinctSources).toBe(3);
  });

  it("Zeitraum aus updatedAt (nur wenn vorhanden), lexikografisch min/max", () => {
    const s = summarizeImportItems([
      item({ updatedAt: "2026-03-05T10:00:00.000Z" }),
      item({ updatedAt: "2026-01-02T08:00:00.000Z" }),
      item({ updatedAt: "2026-07-19T23:00:00.000Z" }),
      item({}), // ohne Datum → ignoriert
    ]);
    expect(s.dateRange).toEqual({
      earliest: "2026-01-02T08:00:00.000Z",
      latest: "2026-07-19T23:00:00.000Z",
    });
  });

  it("kein einziges updatedAt → dateRange null", () => {
    expect(summarizeImportItems([item({}), item({})]).dateRange).toBeNull();
  });

  it("withImagesHint zählt nur bodyHtml mit <img; ohne bodyHtml = 0", () => {
    const s = summarizeImportItems([
      item({ bodyHtml: '<p>Text <img src="/api/objects/x/raw"></p>' }),
      item({ bodyHtml: "<p>ohne Bild</p>" }),
      item({}), // kein bodyHtml
      item({ bodyHtml: "<IMG SRC=data:image/png;base64,AA>" }), // case-insensitiv
    ]);
    expect(s.withImagesHint).toBe(2);
  });

  it("Top-N begrenzt Autoren-/Themen-Listen (Sortierung stabil)", () => {
    const s = summarizeImportItems(
      [
        item({ author: "anna", tags: ["a", "b"] }),
        item({ author: "anna", tags: ["a"] }),
        item({ author: "bob", tags: ["a"] }),
        item({ author: "cara", tags: ["c"] }),
      ],
      { topAuthors: 1, topThemes: 1 },
    );
    expect(s.authors).toEqual([{ name: "anna", count: 2 }]);
    // Top-1-Thema „a" (count 3); „(ohne Label)" wird NICHT gezählt (alle hatten Labels).
    expect(s.themes).toEqual([{ label: "a", count: 3 }]);
  });

  it("gleiche Zählwerte → alphabetische Tie-Breaker-Sortierung (deterministisch)", () => {
    const s = summarizeImportItems([item({ author: "zoe" }), item({ author: "amy" })]);
    expect(s.authors.map((a) => a.name)).toEqual(["amy", "zoe"]);
  });
});
