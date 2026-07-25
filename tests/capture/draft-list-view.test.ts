// AUFTRAG-sortfilter · Punkt 2: reine, DOM-freie Filter-/Sortier-Logik der Entwurfsliste. Gepinnt:
//  · Volltext-/Titelsuche filtert (Titel + Aussage + enttaggter Fließtext), case-insensitiv.
//  · Ersteller-Filter (Admin) grenzt auf originalAuthor ein; leerer Filter = alle.
//  · Sortierung: zuletzt gespeichert neu→alt (Default), alt→neu, Titel A→Z.
//  · draftCreatorIds liefert eindeutige Ersteller in stabiler Erst-Vorkommen-Ordnung.
import { describe, expect, it } from "vitest";
import type { Draft } from "../../apps/web/src/api/types";
import {
  DEFAULT_DRAFT_SORT,
  draftCreatorIds,
  draftListView,
  filterDrafts,
  isDraftSortKey,
  sortDrafts,
} from "../../apps/web/src/lib/draftListView";

function draft(overrides: Partial<Draft> & { id: string }): Draft {
  return {
    payload: {},
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  } as Draft;
}

const FALLBACK = "Entwurf";

const D1 = draft({
  id: "d1",
  payload: { title: "Alpha Notiz", statement: "Ventil entlasten" },
  originalAuthor: "u1",
  updatedAt: "2026-07-20T00:00:00.000Z",
});
const D2 = draft({
  id: "d2",
  payload: { title: "Zeta Notiz", bodyHtml: "<p>Pumpe <b>warten</b></p>" },
  originalAuthor: "u2",
  updatedAt: "2026-07-24T00:00:00.000Z",
});
const D3 = draft({
  id: "d3",
  payload: { title: "Mittel Notiz" },
  originalAuthor: "u1",
  updatedAt: "2026-07-22T00:00:00.000Z",
});
const DRAFTS = [D1, D2, D3];
const ids = (list: readonly Draft[]): string[] => list.map((d) => d.id);

describe("AUFTRAG-sortfilter: filterDrafts (rein)", () => {
  it("leerer Filter zeigt alle", () => {
    expect(ids(filterDrafts(DRAFTS, { query: "", author: "" }, FALLBACK))).toEqual([
      "d1",
      "d2",
      "d3",
    ]);
  });

  it("Titelsuche filtert case-insensitiv", () => {
    expect(ids(filterDrafts(DRAFTS, { query: "alpha", author: "" }, FALLBACK))).toEqual(["d1"]);
  });

  it("Volltextsuche trifft die Aussage und den enttaggten Fließtext", () => {
    expect(ids(filterDrafts(DRAFTS, { query: "ventil", author: "" }, FALLBACK))).toEqual(["d1"]);
    // „warten" steckt nur im bodyHtml (mit Tags) — die Suche trifft den sichtbaren Text.
    expect(ids(filterDrafts(DRAFTS, { query: "warten", author: "" }, FALLBACK))).toEqual(["d2"]);
  });

  it("Ersteller-Filter grenzt auf originalAuthor ein", () => {
    expect(ids(filterDrafts(DRAFTS, { query: "", author: "u1" }, FALLBACK))).toEqual(["d1", "d3"]);
    expect(ids(filterDrafts(DRAFTS, { query: "", author: "u2" }, FALLBACK))).toEqual(["d2"]);
  });

  it("Suche und Ersteller-Filter wirken zusammen (UND)", () => {
    expect(ids(filterDrafts(DRAFTS, { query: "notiz", author: "u1" }, FALLBACK))).toEqual([
      "d1",
      "d3",
    ]);
  });
});

describe("AUFTRAG-sortfilter: sortDrafts (rein)", () => {
  it("Default ist zuletzt gespeichert (neu→alt)", () => {
    expect(DEFAULT_DRAFT_SORT).toBe("recent");
    expect(ids(sortDrafts(DRAFTS, "recent", FALLBACK))).toEqual(["d2", "d3", "d1"]);
  });

  it("alt→neu kehrt die Datumsordnung um", () => {
    expect(ids(sortDrafts(DRAFTS, "oldest", FALLBACK))).toEqual(["d1", "d3", "d2"]);
  });

  it("Titel A→Z sortiert alphabetisch", () => {
    expect(ids(sortDrafts(DRAFTS, "title", FALLBACK))).toEqual(["d1", "d3", "d2"]);
  });

  it("isDraftSortKey erkennt gültige Schlüssel und weist Fremdwerte ab", () => {
    expect(isDraftSortKey("oldest")).toBe(true);
    expect(isDraftSortKey("bogus")).toBe(false);
  });
});

describe("AUFTRAG-sortfilter: draftListView + draftCreatorIds (rein)", () => {
  it("filtert und sortiert in einem Schritt", () => {
    const view = draftListView(
      DRAFTS,
      { filter: { query: "notiz", author: "u1" }, sort: "title" },
      FALLBACK,
    );
    expect(ids(view)).toEqual(["d1", "d3"]);
  });

  it("draftCreatorIds liefert eindeutige Ersteller in Erst-Vorkommen-Ordnung", () => {
    expect(draftCreatorIds(DRAFTS)).toEqual(["u1", "u2"]);
  });
});
