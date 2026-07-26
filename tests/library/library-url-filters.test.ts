// AUFTRAG-mega9 Block E-2 (KW-E2E-006): Der Bibliotheksfilter übersteht den Reload.
//
// Befund: Sortierung (localStorage) und der Aufklapper „Weitere Filter" (localStorage) blieben, die
// eigentliche Facetten-Auswahl lag in useState und war nach dem Reload weg. Der Zustand wandert
// deshalb in die URL — teilbar, reload-fest und Fundament für das noch abzunehmende Filter-Redesign.
//
// Geprüft wird der reine Serialisierungs-Vertrag (DOM-frei): Hin- und Rückweg, Erhalt fremder
// Parameter, Rückwärtskompatibilität der bestehenden Einzelwert-Deep-Links und die bewusste
// Nicht-Serialisierung des strukturellen No-Match.
import { describe, expect, it } from "vitest";
import { FACET_NO_MATCH_SELECTION, type FacetSelection } from "../../apps/web/src/lib/facets";
import {
  facetSelectionFromParams,
  serializeFacetSelection,
  writeFacetSelectionToParams,
} from "../../apps/web/src/lib/libraryUrlFilters";

// Dieselben neun Dimensionen wie LIBRARY_FILTER_CONFIGS in Library.tsx.
const KEYS = [
  "maturity",
  "category",
  "author",
  "origin",
  "type",
  "language",
  "tag",
  "age",
  "trust",
] as const;

describe("Block E-2: Facetten-Auswahl ⇄ URL", () => {
  it("alle neun Dimensionen überleben den Rundweg Auswahl → URL → Auswahl", () => {
    const selection: FacetSelection = {
      maturity: ["ready"],
      category: ["Instandhaltung"],
      author: ["u1"],
      origin: ["non-demo"],
      type: ["best_practice"],
      language: ["de"],
      tag: ["dichtung", "l4"],
      age: ["fresh"],
      trust: ["high"],
    };

    const params = writeFacetSelectionToParams(new URLSearchParams(), selection, KEYS);
    const roundtrip = facetSelectionFromParams(params, KEYS);

    // Das ist der Kern: nach dem Reload steht dieselbe Auswahl.
    expect(serializeFacetSelection(roundtrip, KEYS)).toBe(serializeFacetSelection(selection, KEYS));
    for (const key of KEYS) {
      expect(roundtrip[key]).toEqual(selection[key]);
    }
  });

  it("Mehrfachauswahl reist als WIEDERHOLTER Parameter — Werte brauchen kein Trennzeichen", () => {
    const params = writeFacetSelectionToParams(
      new URLSearchParams(),
      // Werte mit Komma und Leerzeichen: an einem Trennzeichen-Vertrag wären sie zerbrochen.
      { tag: ["Dichtung, alt", "L4 Linie"] },
      KEYS,
    );
    expect(params.getAll("tag")).toEqual(["Dichtung, alt", "L4 Linie"]);
    expect(facetSelectionFromParams(params, KEYS).tag).toEqual(["Dichtung, alt", "L4 Linie"]);
  });

  it("fremde Parameter bleiben unberührt — insbesondere die Volltextsuche ?q=", () => {
    const before = new URLSearchParams("q=dichtung&fremd=behalten&category=Alt");
    const after = writeFacetSelectionToParams(before, { category: ["Neu"] }, KEYS);

    expect(after.get("q")).toBe("dichtung");
    expect(after.get("fremd")).toBe("behalten");
    // Die Facette selbst wird ersetzt, nicht angehängt.
    expect(after.getAll("category")).toEqual(["Neu"]);
  });

  it("eine abgewählte Dimension verschwindet aus der URL (kein Geisterparameter)", () => {
    const before = new URLSearchParams("category=Alt&tag=x&q=frage");
    const after = writeFacetSelectionToParams(before, { tag: ["x"] }, KEYS);

    expect(after.has("category")).toBe(false);
    expect(after.getAll("tag")).toEqual(["x"]);
    expect(after.get("q")).toBe("frage");
  });

  it("bestehende Einzelwert-Deep-Links bleiben gültig (?category=… aus Risiko & Lücken)", () => {
    const selection = facetSelectionFromParams(
      new URLSearchParams("category=Instandhaltung"),
      KEYS,
    );
    expect(selection.category).toEqual(["Instandhaltung"]);
  });

  it("?origin= behält seinen Vertrag: gültig filtert, ungültig bleibt NEUTRAL", () => {
    // Gültiger Wert (Deep-Link „eigenes Wissen ansehen") filtert wie bisher.
    expect(facetSelectionFromParams(new URLSearchParams("origin=non-demo"), KEYS).origin).toEqual([
      "non-demo",
    ]);
    // „all" ist der neutrale Wert — kein Filter.
    expect(
      facetSelectionFromParams(new URLSearchParams("origin=all"), KEYS).origin,
    ).toBeUndefined();
    // Und ein UNGÜLTIGER Wert bleibt neutral, statt auf null Treffer zu filtern. Ohne diese
    // Sonderbehandlung hätte ein bestehender Link mit Tippfehler plötzlich eine leere Liste gezeigt.
    expect(
      facetSelectionFromParams(new URLSearchParams("origin=quatsch"), KEYS).origin,
    ).toBeUndefined();
  });

  it("leere Werte im Link werden ignoriert, Doppelte vereinheitlicht", () => {
    const selection = facetSelectionFromParams(new URLSearchParams("tag=&tag=a&tag=a&tag=b"), KEYS);
    expect(selection.tag).toEqual(["a", "b"]);
  });

  it("der strukturelle No-Match wird NICHT in die URL geschrieben", () => {
    const params = writeFacetSelectionToParams(
      new URLSearchParams(),
      { category: FACET_NO_MATCH_SELECTION, tag: ["a"] },
      KEYS,
    );
    // Kein reservierter Magic-String in der URL — genau das verbietet der uxpol4-Vertrag in
    // lib/facets („kein Wert, den ein echter Wert je erzeugen könnte").
    expect(params.has("category")).toBe(false);
    expect(params.toString()).not.toContain("noMatch");
    expect(params.getAll("tag")).toEqual(["a"]);
  });

  it("eine unbekannte Dimension in der URL wird nicht eingeschleppt", () => {
    const selection = facetSelectionFromParams(new URLSearchParams("erfunden=xyz&tag=a"), KEYS);
    expect(selection.erfunden).toBeUndefined();
    expect(Object.keys(selection)).toEqual(["tag"]);
  });

  it("leere Auswahl ⇒ leere Facetten-Parameter, aber ?q= bleibt", () => {
    const after = writeFacetSelectionToParams(
      new URLSearchParams("q=x&tag=a&trust=high"),
      {},
      KEYS,
    );
    expect(after.toString()).toBe("q=x");
  });
});
