// AUFTRAG-sortfilter · Punkt 1: reine, DOM-freie Sortier-Logik der Bibliothek. Gepinnt:
//  · „relevance" gibt die eingehende Reihenfolge unverändert zurück (kopiert, mutiert nie das Original).
//  · Titel A→Z, Trust hoch→niedrig, Zuletzt geändert neu→alt sortieren korrekt.
//  · koChangedMs nimmt den jüngsten History-Eintrag, sonst createdAt (kaputt/unbekannt → 0).
//  · stabile Ordnung: gleichrangige Elemente behalten ihre Eingangsreihenfolge.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  DEFAULT_LIBRARY_SORT,
  isLibrarySortKey,
  koChangedMs,
  sortLibrary,
} from "../../apps/web/src/lib/librarySort";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
    statement: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

const A = ko({ id: "a", title: "Alpha", trust: 10, createdAt: "2026-07-20T00:00:00.000Z" });
const B = ko({ id: "b", title: "Zeta", trust: 90, createdAt: "2026-07-10T00:00:00.000Z" });
const C = ko({
  id: "c",
  title: "Mittel",
  trust: 50,
  createdAt: "2026-07-01T00:00:00.000Z",
  history: [{ version: 2, at: "2026-07-30T00:00:00.000Z", author: "u1", note: "" }],
});
const ITEMS = [A, B, C];
const ids = (list: readonly KnowledgeObject[]): string[] => list.map((k) => k.id);

describe("AUFTRAG-sortfilter: sortLibrary (rein)", () => {
  it("Default ist Relevanz und gibt die Eingangsreihenfolge unverändert zurück", () => {
    expect(DEFAULT_LIBRARY_SORT).toBe("relevance");
    const out = sortLibrary(ITEMS, "relevance", (k) => k);
    expect(ids(out)).toEqual(["a", "b", "c"]);
    // Kopie, keine Mutation des Originals.
    expect(out).not.toBe(ITEMS);
    expect(ids(ITEMS)).toEqual(["a", "b", "c"]);
  });

  it("Titel A→Z sortiert alphabetisch", () => {
    expect(ids(sortLibrary(ITEMS, "title", (k) => k))).toEqual(["a", "c", "b"]);
  });

  it("Trust hoch→niedrig sortiert absteigend", () => {
    expect(ids(sortLibrary(ITEMS, "trust", (k) => k))).toEqual(["b", "c", "a"]);
  });

  it("Zuletzt geändert neu→alt nutzt den jüngsten History-Eintrag vor createdAt", () => {
    // C hat createdAt sehr alt, aber einen History-Eintrag vom 30.07. → C ist am „jüngsten".
    expect(ids(sortLibrary(ITEMS, "recent", (k) => k))).toEqual(["c", "a", "b"]);
  });

  it("koChangedMs: jüngster History-Eintrag vor createdAt; kaputt/unbekannt → 0", () => {
    expect(koChangedMs(C)).toBe(Date.parse("2026-07-30T00:00:00.000Z"));
    expect(koChangedMs(A)).toBe(Date.parse("2026-07-20T00:00:00.000Z"));
    expect(koChangedMs(ko({ createdAt: "kaputt", history: [] }))).toBe(0);
  });

  it("stabile Ordnung: gleicher Titel behält Eingangsreihenfolge", () => {
    const x1 = ko({ id: "x1", title: "Gleich" });
    const x2 = ko({ id: "x2", title: "Gleich" });
    expect(ids(sortLibrary([x1, x2], "title", (k) => k))).toEqual(["x1", "x2"]);
    expect(ids(sortLibrary([x2, x1], "title", (k) => k))).toEqual(["x2", "x1"]);
  });

  it("isLibrarySortKey erkennt gültige Schlüssel und weist Fremdwerte ab", () => {
    expect(isLibrarySortKey("trust")).toBe(true);
    expect(isLibrarySortKey("bogus")).toBe(false);
    expect(isLibrarySortKey(null)).toBe(false);
  });
});
