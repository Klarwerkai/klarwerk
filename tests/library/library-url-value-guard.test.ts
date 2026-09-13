// AUFTRAG-mega11 Block C (bens SB-3): Fremde URL-WERTE dürfen keine echten Facettenwerte werden.
//
// mega9 begrenzte die Parameter-NAMEN auf die bekannten Facettenschlüssel — die WERTE nur auf „nicht
// leer". `?category=erfunden` wurde damit zu einer normalen `FacetSelection`, filterte auf null
// Treffer und war vom Typ her ein ECHTER Wert; über `currentViewState` konnte er in eine gespeicherte
// Sicht wandern. Das ist bens uxpol4-Blocker auf einem neuen Weg: damals über den Magic-String, jetzt
// über die Adresszeile.
//
// Hier steht der reine Vertrag der beiden neuen Funktionen. Der gemountete Beleg (Seite, gespeicherte
// Sicht, Reload) liegt in library-url-value-guard-mounted.test.tsx.
import { describe, expect, it } from "vitest";
import {
  FACET_NO_MATCH_SELECTION,
  type FacetSelection,
  type FacetValues,
  isFacetNoMatch,
} from "../../apps/web/src/lib/facets";
import {
  droppedFacetDimensions,
  facetSelectionFromParams,
  knownFacetValues,
  pruneFacetSelectionToKnownValues,
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

// Ein winziger, aber ECHTER Bestand: zwei Objekte, wie ihn libraryFilterValues ableitet.
const INVENTORY: FacetValues[] = [
  {
    maturity: ["ready"],
    category: ["Instandhaltung"],
    author: ["u1"],
    origin: ["non-demo"],
    type: ["best_practice"],
    language: ["de"],
    tag: ["dichtung", "l4"],
    age: ["d30"],
    trust: ["t70"],
  },
  {
    maturity: ["draft"],
    category: ["Anlage 1"],
    author: ["u2"],
    origin: ["non-demo"],
    type: ["lesson_learned"],
    language: ["en"],
    tag: ["ventil"],
    age: ["y1"],
    trust: ["t0"],
  },
];

const known = knownFacetValues(INVENTORY, KEYS);

function prune(selection: FacetSelection): FacetSelection {
  return pruneFacetSelectionToKnownValues(selection, known);
}

describe("Block C: der Bestand ist die Werte-Grenze", () => {
  it("knownFacetValues sammelt genau die vorkommenden Werte je Dimension", () => {
    expect([...(known.get("category") ?? [])].sort()).toEqual(["Anlage 1", "Instandhaltung"]);
    // Mehrwertige Dimension (Tags) wird vereinigt, nicht überschrieben.
    expect([...(known.get("tag") ?? [])].sort()).toEqual(["dichtung", "l4", "ventil"]);
    // Eine Dimension ohne jeden Wert bleibt eine leere Menge (kein `undefined`, kein Absturz).
    expect(knownFacetValues([], KEYS).get("category")?.size).toBe(0);
  });

  it("unbekannter Wert bei BEKANNTEM Schlüssel erreicht die Auswahl nicht", () => {
    const fromUrl = facetSelectionFromParams(new URLSearchParams("category=erfunden"), KEYS);
    // Ohne die Prüfung ist er ein ganz normaler Facettenwert — genau das war der Befund.
    expect(fromUrl.category).toEqual(["erfunden"]);

    const guarded = prune(fromUrl);
    expect(guarded.category).toBeUndefined();
    // Und die Dimension ist OFFEN, nicht „bewusst leer": kein struktureller No-Match aus einem Link.
    expect(isFacetNoMatch(guarded.category)).toBe(false);
    expect(Object.keys(guarded)).toEqual([]);
  });

  it("gemischt bekannte und unbekannte Werte in DERSELBEN Dimension: nur die bekannten bleiben", () => {
    const fromUrl = facetSelectionFromParams(
      new URLSearchParams("category=Anlage+1&category=erfunden&tag=ventil&tag=quatsch"),
      KEYS,
    );
    const guarded = prune(fromUrl);
    expect(guarded.category).toEqual(["Anlage 1"]);
    expect(guarded.tag).toEqual(["ventil"]);
  });

  it("ein unbekannter Wert wird NIE zu FACET_NO_MATCH_SELECTION", () => {
    // Die uxpol4-Grenze: No-Match ist der strukturelle Zustand „bewusst alles abgewählt". Ein Link
    // darf ihn nicht erzeugen können, sonst ist der Magic-String durch die Hintertür zurück.
    for (const url of ["category=erfunden", "tag=x&tag=y", "trust=t99"]) {
      const guarded = prune(facetSelectionFromParams(new URLSearchParams(url), KEYS));
      for (const value of Object.values(guarded)) {
        expect(isFacetNoMatch(value)).toBe(false);
      }
    }
  });

  it("ein ECHTES No-Match (aus der Bedienung) überlebt die Prüfung unverändert", () => {
    const guarded = prune({ category: FACET_NO_MATCH_SELECTION });
    expect(guarded.category).toBe(FACET_NO_MATCH_SELECTION);
  });

  it("gültige Werte bleiben vollständig erhalten — die Prüfung ist kein Filter gegen den Nutzer", () => {
    const selection: FacetSelection = {
      maturity: ["ready", "draft"],
      category: ["Instandhaltung"],
      tag: ["dichtung", "l4", "ventil"],
      trust: ["t0"],
    };
    expect(prune(selection)).toEqual(selection);
  });

  it("`origin` behält seinen Sondervertrag: ungültig bleibt neutral, gültig filtert weiter", () => {
    // Ungültig scheitert schon am Eingang (readDemoKnowledgeFilter → „all" → gar keine Auswahl).
    expect(facetSelectionFromParams(new URLSearchParams("origin=quatsch"), KEYS).origin).toBe(
      undefined,
    );

    // Und ein GÜLTIGER origin-Wert wird von der Bestandsprüfung ausdrücklich NICHT angetastet — auch
    // dann nicht, wenn er im Bestand nicht vorkommt. `?origin=demo` ohne Demo-Wissen zeigt ehrlich 0
    // Treffer; ihn wegzuräumen machte daraus stillschweigend „kein Filter" und die volle Liste.
    const demoOnly = facetSelectionFromParams(new URLSearchParams("origin=demo"), KEYS);
    expect(demoOnly.origin).toEqual(["demo"]);
    expect(known.get("origin")?.has("demo")).toBe(false);
    expect(prune(demoOnly).origin).toEqual(["demo"]);
  });

  it("bestehende Deep-Links bleiben gültig, solange der Wert im Bestand steht", () => {
    // `?category=…` aus „Risiko & Lücken" — der Regelfall, der nicht kaputtgehen darf.
    const guarded = prune(
      facetSelectionFromParams(new URLSearchParams("category=Instandhaltung"), KEYS),
    );
    expect(guarded.category).toEqual(["Instandhaltung"]);
  });

  it("leerer Bestand räumt alles ab — außer origin", () => {
    const emptyKnown = knownFacetValues([], KEYS);
    const guarded = pruneFacetSelectionToKnownValues(
      { category: ["Instandhaltung"], origin: ["demo"] },
      emptyKnown,
    );
    expect(guarded.category).toBeUndefined();
    expect(guarded.origin).toEqual(["demo"]);
  });

  // ----------------------------------------------------------------------------------------------
  // JOB 3877 · B7b — DIE MELDUNG NEBEN DER AUSWAHL, UND DIE GRENZE, DIE SIE NICHT VERSCHIEBT
  // ----------------------------------------------------------------------------------------------
  // Die Auswahl verliert beim Wegräumen die Information, dass überhaupt eingegrenzt wurde; auf einem
  // leeren Bestand stand deshalb „Noch keine Einträge." unter einem Link, der eingegrenzt hat
  // (`tests/bibliothek-leer-oder-eingegrenzt/leersatz-sagt-die-wahrheit.test.tsx`, B7b). Gemeldet
  // wird das jetzt NEBEN der Auswahl — die Auswahl selbst bleibt Byte für Byte, was sie war.

  it("JOB 3877: die Meldung nennt die verworfene Dimension — die Auswahl bleibt unangetastet", () => {
    const fromUrl = facetSelectionFromParams(new URLSearchParams("category=erfunden"), KEYS);
    const guarded = prune(fromUrl);

    expect(droppedFacetDimensions(fromUrl, guarded)).toEqual(["category"]);

    // Und dieselbe Eingabe liefert weiterhin GENAU die Auswahl von vorher: der Schlüssel fehlt, und
    // kein Wert ist zu No-Match geworden. Das ist die uxpol4-Grenze, hier nachgemessen statt behauptet.
    expect(guarded.category).toBeUndefined();
    expect(Object.keys(guarded)).toEqual([]);
    for (const value of Object.values(guarded)) {
      expect(isFacetNoMatch(value)).toBe(false);
    }
  });

  it("JOB 3877: teilweise überlebende, leere und No-Match-Dimensionen melden NICHTS", () => {
    // Gemischt: „Anlage 1" überlebt, die Eingrenzung steht sichtbar im Menü — nichts ist verloren.
    const gemischt = facetSelectionFromParams(
      new URLSearchParams("category=Anlage+1&category=erfunden"),
      KEYS,
    );
    expect(droppedFacetDimensions(gemischt, prune(gemischt))).toEqual([]);

    // Eine leere Dimension hatte nichts zu verlieren.
    expect(droppedFacetDimensions({ category: [] }, prune({ category: [] }))).toEqual([]);

    // Und das strukturelle No-Match ist kein Wert: es überlebt die Prüfung und ist nie „verworfen".
    const noMatch: FacetSelection = { category: FACET_NO_MATCH_SELECTION };
    expect(droppedFacetDimensions(noMatch, prune(noMatch))).toEqual([]);
  });

  it("JOB 3877: der `origin`-Sondervertrag löst die Meldung NICHT aus", () => {
    // `?origin=demo` auf leerem Bestand ist eine echte, ÜBERLEBENDE Auswahl (s. der Fall darüber).
    // Sie zusätzlich als „verworfen" zu melden, hiesse denselben Filter zweimal zu zählen.
    const emptyKnown = knownFacetValues([], KEYS);
    const vorher: FacetSelection = { category: ["Instandhaltung"], origin: ["demo"] };
    const nachher = pruneFacetSelectionToKnownValues(vorher, emptyKnown);
    expect(droppedFacetDimensions(vorher, nachher)).toEqual(["category"]);

    // Allein `origin` in der Adresse ⇒ gar keine Meldung.
    const nurOrigin = facetSelectionFromParams(new URLSearchParams("origin=demo"), KEYS);
    expect(
      droppedFacetDimensions(nurOrigin, pruneFacetSelectionToKnownValues(nurOrigin, emptyKnown)),
    ).toEqual([]);
  });
});
