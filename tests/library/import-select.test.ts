import { describe, expect, it } from "vitest";
import type { ImportItem } from "../../services/library-analytics";
import {
  type SelectCriteria,
  deriveCriteriaFromPrompt,
  filterImportItems,
  sanitizeCriteria,
  toPreviewEntry,
} from "../../services/library-analytics";

// IC-3 (Import-Cockpit): PURE Auswahl-/Filterlogik — deterministisch, kein Netz/keine KI.

function item(over: Partial<ImportItem> = {}): ImportItem {
  return {
    title: over.title ?? "T",
    statement: over.statement ?? "S",
    type: over.type ?? "best_practice",
    category: over.category ?? "K",
    ...over,
  };
}

describe("IC-3: filterImportItems", () => {
  const items: ImportItem[] = [
    item({ title: "Wartung Pumpe", tags: ["wartung"], author: "Anna", updatedAt: "2020-01-01" }),
    item({ title: "Fehlercode E5", tags: ["fehler"], author: "Bob", updatedAt: "2024-06-01" }),
    item({
      title: "Sicherheit",
      tags: ["wartung", "safety"],
      author: "Anna",
      updatedAt: "2026-02-01",
    }),
    item({ title: "Ohne alles" }), // kein tag, kein author, kein updatedAt
  ];

  it("leere Kriterien → alles passt", () => {
    const r = filterImportItems(items, {});
    expect(r.matched).toBe(4);
    expect(r.selected).toHaveLength(4);
    expect(r.limited).toBe(false);
  });

  it("Themen-Filter (Label, case-insensitiv, mind. ein Treffer)", () => {
    const r = filterImportItems(items, { themes: ["Wartung"] });
    expect(r.matched).toBe(2);
    expect(r.selected.map((i) => i.title)).toEqual(["Wartung Pumpe", "Sicherheit"]);
  });

  it("Autor-Filter", () => {
    expect(filterImportItems(items, { authors: ["anna"] }).matched).toBe(2);
    expect(filterImportItems(items, { authors: ["bob"] }).matched).toBe(1);
  });

  it("Jahr-Filter aus updatedAt; Items ohne Datum fallen bei gesetztem Jahr heraus", () => {
    expect(filterImportItems(items, { yearFrom: 2024 }).matched).toBe(2);
    expect(filterImportItems(items, { yearTo: 2020 }).matched).toBe(1);
    expect(filterImportItems(items, { yearFrom: 2023, yearTo: 2025 }).matched).toBe(1);
  });

  it("Stichwort-Substring in Titel/Statement", () => {
    expect(filterImportItems(items, { keywords: ["fehlercode"] }).matched).toBe(1);
    expect(
      filterImportItems([item({ statement: "Der Dosierwert" })], { keywords: ["dosier"] }).matched,
    ).toBe(1);
  });

  it("kombiniert Filter (UND-Verknüpfung)", () => {
    const r = filterImportItems(items, { themes: ["wartung"], authors: ["anna"] });
    expect(r.matched).toBe(2);
  });

  it("Limit deckelt selected und setzt limited", () => {
    const r = filterImportItems(items, { limit: 2 });
    expect(r.matched).toBe(4);
    expect(r.selected).toHaveLength(2);
    expect(r.limited).toBe(true);
  });

  it("Limit ≥ Treffer → nicht limited", () => {
    expect(filterImportItems(items, { limit: 10 }).limited).toBe(false);
  });
});

describe("IC-3: sanitizeCriteria (nie raten, nur Valides)", () => {
  it("übernimmt valide Felder, verwirft Müll", () => {
    const raw = {
      themes: ["a", " b ", "", 5, "a"], // trim, drop leer/nicht-string, dedupe
      authors: ["Anna"],
      keywords: ["x"],
      yearFrom: 2020,
      yearTo: "2026",
      limit: 50,
      bogus: "ignored",
    };
    expect(sanitizeCriteria(raw)).toEqual({
      themes: ["a", "b"],
      authors: ["Anna"],
      keywords: ["x"],
      yearFrom: 2020,
      yearTo: 2026,
      limit: 50,
    });
  });

  it("unbrauchbare Werte → weggelassen (kein Feld)", () => {
    expect(sanitizeCriteria({ yearFrom: 1200, limit: -3, themes: "nope" })).toEqual({});
    expect(sanitizeCriteria(null)).toEqual({});
    expect(sanitizeCriteria("string")).toEqual({});
  });
});

describe("IC-3: toPreviewEntry", () => {
  it("projiziert kompakt inkl. hasImage aus bodyHtml", () => {
    const e = toPreviewEntry(
      item({ title: "T", author: "Anna", updatedAt: "2026-01-01", tags: ["x"], bodyHtml: "<img>" }),
    );
    expect(e).toEqual({
      title: "T",
      author: "Anna",
      updatedAt: "2026-01-01",
      hasImage: true,
      themes: ["x"],
    });
  });

  it("lässt fehlende Felder weg; hasImage false ohne bodyHtml", () => {
    expect(toPreviewEntry(item({ title: "T" }))).toEqual({
      title: "T",
      hasImage: false,
      themes: [],
    });
  });
});

describe("IC-3: deriveCriteriaFromPrompt (injizierte KI, nie erfinden)", () => {
  it("leitet aus Modell-JSON sanitisierte Kriterien ab", async () => {
    const infer = async (): Promise<unknown> => ({ themes: ["wartung"], keywords: ["e5"] });
    expect(await deriveCriteriaFromPrompt("egal", infer)).toEqual({
      themes: ["wartung"],
      keywords: ["e5"],
    });
  });

  it("leerer Prompt → KI wird nicht befragt, leere Kriterien", async () => {
    let called = false;
    const infer = async (): Promise<unknown> => {
      called = true;
      return { themes: ["x"] };
    };
    expect(await deriveCriteriaFromPrompt("   ", infer)).toEqual({});
    expect(called).toBe(false);
  });

  it("KI liefert null oder wirft → leere Kriterien (Fallback auf Klick-Filter)", async () => {
    expect(await deriveCriteriaFromPrompt("x", async () => null)).toEqual({});
    const boom: () => Promise<unknown> = async () => {
      throw new Error("model down");
    };
    expect(await deriveCriteriaFromPrompt("x", boom)).toEqual({});
  });

  it("Müll-JSON vom Modell → sanitisiert zu leer (kein Raten)", async () => {
    const criteria: SelectCriteria = await deriveCriteriaFromPrompt("x", async () => ({
      themes: "nicht-array",
      yearFrom: 42,
    }));
    expect(criteria).toEqual({});
  });
});
