// ================================================================================================
// JOB 3061 · H2 · R2 — DER REITERZÄHLER UND DIE VIER LAGEN DER FLÄCHE, AM VERHALTEN GEMESSEN.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT (Runde 2, Prüflücke der Runde 1): Auftrag §9 schreibt für die Zähler
// am Reiterkopf drei Lagen vor — „erst nach frischem Abruf, sonst nur der Name; Cache mit laufender
// Auffrischung zeigt die alte Zahl gedämpft; gescheiterte Auffrischung: Name ohne Zahl". Gebaut war
// das in `components/pruefen/zaehler.ts` richtig, GEMESSEN war es nirgends: die einzige Erwähnung
// im Testbaum (`tests/app/mega45-validierung-facetten.test.ts:128`) pinnt den QUELLTEXT
// (`expect(VALIDATION).toContain("flaechenZustand(query)")`), nicht das Verhalten.
//
// GEMESSEN, NICHT BEHAUPTET: In Runde 2 wurde `reiterZaehler` gegenmutiert — der Fehlerzweig gab
// statt `{lage:"unbekannt", wert:null}` die alte Zahl als `frisch` zurück. Der komplette Lauf über
// `tests/pruefseite` blieb GRÜN (57/57). Genau diese Mutation macht C3 unten rot. Eine Zusage ohne
// Messung ist keine Zusage — und für eine ZAHL gilt das doppelt: „9 offen" nach einem
// gescheiterten Abruf ist eine Tatsachenbehauptung über den Bestand ohne ihre Voraussetzung
// (Regelwerk §7, zweiter Spiegelstrich).
import { describe, expect, it } from "vitest";
import {
  abhaengigeQuelle,
  flaechenZustand,
  reiterZaehler,
  zaehlerQuelle,
} from "../../apps/web/src/components/pruefen/zaehler";

describe("JOB 3061 · C · der Reiterzähler sagt nur, was er weiß", () => {
  it("C1 · frischer Abruf → die gemessene Zahl, normal", () => {
    expect(
      reiterZaehler({ hatAntwort: true, gescheitert: false, frischtAuf: false, wert: 9 }),
    ).toEqual({ lage: "frisch", wert: 9 });
  });

  it("C2 · Cache mit laufender Auffrischung → die alte Zahl, gedämpft", () => {
    // Der Bestand ist da und bleibt lesbar; nur seine Frische steht in Frage.
    expect(
      reiterZaehler({ hatAntwort: true, gescheitert: false, frischtAuf: true, wert: 9 }),
    ).toEqual({ lage: "gedaempft", wert: 9 });
  });

  it("C3 · gescheiterte Auffrischung → NUR der Name, nie die alte Zahl", () => {
    // DIE STELLE, die der Gegenmutation standhalten muss: eine Zahl wäre hier eine Aussage über
    // einen Bestand, den niemand gerade gezählt hat.
    const z = reiterZaehler({ hatAntwort: true, gescheitert: true, frischtAuf: false, wert: 9 });
    expect(z).toEqual({ lage: "unbekannt", wert: null });
    expect(z.wert).toBeNull();
  });

  it("C4 · nie eine Antwort → nur der Name, keine geratene Null", () => {
    // „unbekannt" und „0" sind zwei verschiedene Aussagen (Regelwerk §7, dritter Spiegelstrich).
    expect(
      reiterZaehler({ hatAntwort: false, gescheitert: false, frischtAuf: true, wert: null }),
    ).toEqual({ lage: "unbekannt", wert: null });
  });

  it("C5 · eine echte 0 ist eine Zahl und wird gezeigt — nicht mit „unbekannt“ verwechselt", () => {
    expect(
      reiterZaehler({ hatAntwort: true, gescheitert: false, frischtAuf: false, wert: 0 }),
    ).toEqual({ lage: "frisch", wert: 0 });
  });

  it("C6 · `zaehlerQuelle` zählt die Antwort, statt eine Länge zu raten", () => {
    expect(zaehlerQuelle({ data: [1, 2, 3], isError: false, isFetching: false })).toEqual({
      hatAntwort: true,
      gescheitert: false,
      frischtAuf: false,
      wert: 3,
    });
    // Ohne Antwort ausdrücklich `null` — nicht 0.
    expect(zaehlerQuelle({ isError: false, isFetching: true }).wert).toBeNull();
    expect(zaehlerQuelle({ data: [], isError: false, isFetching: false }).wert).toBe(0);
  });
});

describe("JOB 3061 · L · die vier Lagen der Fläche", () => {
  it("L1 · nie eine Antwort und noch am Laden → Platzhalter", () => {
    expect(flaechenZustand({ isLoading: true, isError: false })).toEqual({
      lage: "laedt",
      auffrischungGescheitert: false,
    });
  });

  it("L2 · nie eine Antwort und Fehler → Erstfehler (ein Satz + „Erneut laden“)", () => {
    expect(flaechenZustand({ isLoading: false, isError: true })).toEqual({
      lage: "erstfehler",
      auffrischungGescheitert: false,
    });
  });

  it("L3 · eine leere Antwort ist KEIN Erstfehler — sie ist ein Bestand, der leer ist", () => {
    expect(flaechenZustand({ data: [], isLoading: false, isError: false })).toEqual({
      lage: "leer",
      auffrischungGescheitert: false,
    });
  });

  it("L4 · Bestand da, Auffrischung gescheitert → der Bestand BLEIBT, nur nicht mehr frisch", () => {
    // Die Lehre aus JOB 3027 R2 (Regelwerk §7, erster Spiegelstrich): niemals die Fläche leeren,
    // während ein Mensch mitten in der Entscheidung steht.
    expect(flaechenZustand({ data: [1], isLoading: false, isError: true })).toEqual({
      lage: "bestand",
      auffrischungGescheitert: true,
    });
  });

  it("L5 · und eine gescheiterte Auffrischung über LEEREM Bestand leert ebenfalls nichts", () => {
    expect(flaechenZustand({ data: [], isLoading: false, isError: true })).toEqual({
      lage: "leer",
      auffrischungGescheitert: true,
    });
  });
});

// ================================================================================================
// A · DER ABHÄNGIGE ABRUF (bens Korrekturpflicht 2, Runde 4)
// ================================================================================================
//
// Ein Befund aus IDs ist noch keine Fläche. Solange die Objekte fehlen, DARF die Fläche nicht
// „Bestand" sagen — sonst behauptete sie „Objekt entfernt" über etwas, das nur noch nicht da ist.
describe("JOB 3061 · A · die Lage steht auf BEIDEN Abrufen", () => {
  const befund = { data: [1], isLoading: false, isError: false };

  it("A1 · Befund da, abhängiger Abruf ohne Antwort → laedt, nicht bestand", () => {
    expect(flaechenZustand(befund, { hatAntwort: false, isError: false })).toEqual({
      lage: "laedt",
      auffrischungGescheitert: false,
    });
  });

  it("A2 · Befund da, abhängiger Abruf gescheitert und ohne Antwort → Erstfehler", () => {
    expect(flaechenZustand(befund, { hatAntwort: false, isError: true })).toEqual({
      lage: "erstfehler",
      auffrischungGescheitert: false,
    });
  });

  it("A3 · beide da → Bestand; erst JETZT ist „Objekt entfernt“ eine wahre Auskunft", () => {
    expect(flaechenZustand(befund, { hatAntwort: true, isError: false })).toEqual({
      lage: "bestand",
      auffrischungGescheitert: false,
    });
  });

  it("A4 · abhängige Antwort da, ihre Auffrischung gescheitert → Bestand BLEIBT, nur nicht frisch", () => {
    expect(flaechenZustand(befund, { hatAntwort: true, isError: true })).toEqual({
      lage: "bestand",
      auffrischungGescheitert: true,
    });
  });

  it("A5 · leerer Befund braucht die Objekte nicht — „Nichts offen.“ ist auch ohne sie wahr", () => {
    expect(
      flaechenZustand(
        { data: [], isLoading: false, isError: false },
        { hatAntwort: false, isError: false },
      ),
    ).toEqual({ lage: "leer", auffrischungGescheitert: false });
  });

  it("A6 · `abhaengigeQuelle` liest dieselben zwei Merkmale aus einer react-query-Lage", () => {
    expect(abhaengigeQuelle({ data: [], isError: false })).toEqual({
      hatAntwort: true,
      isError: false,
    });
    expect(abhaengigeQuelle({ isError: true })).toEqual({ hatAntwort: false, isError: true });
  });
});
