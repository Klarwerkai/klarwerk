// ================================================================================================
// AUFTRAG-mega63 BLOCK B — VIER FÄLLE, VIER ANTWORTEN, EINZELN BELEGT.
// ================================================================================================
//
// mega62 H hat die Auflösung an EINEN Ort geholt und den Rückfall vom Ladezustand getrennt. Was
// dabei zusammenfiel, hat ben benannt (BERICHT-ben-sammel60-mega62.md, Abschnitt 3): „läuft noch"
// und „fehlgeschlagen" bedeuten beide `data === undefined` und bekamen deshalb denselben Text.
//
// WARUM DAS EINE EHRLICHKEITSFRAGE IST UND KEINE KOSMETIK: Die beiden Zustände verlangen von der
// Nutzerin GEGENTEILIGES. „Lädt noch" vergeht von selbst — die richtige Reaktion ist Warten.
// „Nicht abrufbar" bleibt — die richtige Reaktion ist, es zu melden. Ein gemeinsamer Text sagt
// „warte" in einem Fall, in dem Warten nichts bringt: Aus einem Ausfall wird eine Geduldsfrage,
// und niemand erfährt davon.
//
// Die vier Fälle stehen hier EINZELN und nicht als Schleife über eine Tabelle: Bei einem roten
// Lauf soll der Name des Falles im Bericht stehen, nicht ein Index.
import { describe, expect, it } from "vitest";
import {
  AUTHOR_LOADING_KEY,
  AUTHOR_UNAVAILABLE_KEY,
  AUTHOR_UNKNOWN_KEY,
  type DirectoryQueryState,
  makeAuthorNameResolver,
} from "../../apps/web/src/lib/koAuthor";

// Die Texte sind hier absichtlich UNTERSCHEIDBARE Marken und nicht die echten Sätze: Geprüft wird,
// dass der richtige Zweig greift. Ob der Satz gut formuliert ist, entscheidet kein Test.
const TEXTE = {
  unknown: (ref: string) => `UNBEKANNT:${ref}`,
  loading: () => "LAEDT",
  unavailable: () => "NICHT-ABRUFBAR",
};

const UID = "83e361aa-0000-4000-8000-000000000001";

describe("mega63 B · die vier Fälle sind einzeln unterscheidbar", () => {
  it("FALL 1 · geladen, Eintrag vorhanden → der Name", () => {
    const zustand: DirectoryQueryState = {
      data: [{ id: UID, name: "Erik Experte" }],
      isPending: false,
      isError: false,
    };
    expect(makeAuthorNameResolver(zustand, TEXTE)(UID)).toBe("Erik Experte");
  });

  it("FALL 2 · geladen, Eintrag fehlt → die geprüfte Unbekannt-Auskunft (mega51 F2, unverändert)", () => {
    const zustand: DirectoryQueryState = {
      data: [{ id: "u-carla", name: "Carla Controller" }],
      isPending: false,
      isError: false,
    };
    expect(makeAuthorNameResolver(zustand, TEXTE)(UID)).toBe("UNBEKANNT:83e361");
  });

  it("FALL 3 · Abfrage läuft → lädt-noch, NICHT nicht-abrufbar", () => {
    const zustand: DirectoryQueryState = { data: undefined, isPending: true, isError: false };
    expect(makeAuthorNameResolver(zustand, TEXTE)(UID)).toBe("LAEDT");
  });

  it("FALL 4 · Abfrage fehlgeschlagen → nicht-abrufbar, NICHT lädt-noch", () => {
    const zustand: DirectoryQueryState = { data: undefined, isPending: false, isError: true };
    expect(makeAuthorNameResolver(zustand, TEXTE)(UID)).toBe("NICHT-ABRUFBAR");
  });

  it("DIE ZUSAGE ALS GANZES: die vier Fälle liefern vier VERSCHIEDENE Antworten", () => {
    // Der eigentliche Wächter gegen einen Rückfall. Würde jemand zwei Zweige wieder auf denselben
    // Text legen, blieben die vier Fälle oben einzeln grün — und genau so ist die Zusammenlegung
    // aus mega62 entstanden. Hier wird sie unmöglich.
    const antworten = [
      makeAuthorNameResolver(
        { data: [{ id: UID, name: "Erik" }], isPending: false, isError: false },
        TEXTE,
      )(UID),
      makeAuthorNameResolver({ data: [], isPending: false, isError: false }, TEXTE)(UID),
      makeAuthorNameResolver({ data: undefined, isPending: true, isError: false }, TEXTE)(UID),
      makeAuthorNameResolver({ data: undefined, isPending: false, isError: true }, TEXTE)(UID),
    ];
    expect(
      new Set(antworten).size,
      `vier Fälle, aber nur ${new Set(antworten).size} Antworten`,
    ).toBe(4);
  });
});

describe("mega63 B · die Kanten, bei denen die Reihenfolge entscheidet", () => {
  it("bekannte Namen bleiben stehen, wenn eine AKTUALISIERUNG scheitert", () => {
    // React Query behält bei einem fehlgeschlagenen Refetch die alten Daten und setzt zugleich
    // `isError`. Die Namen sind dann NICHT falsch geworden — sie zu verschweigen wäre ein Rückschritt
    // gegenüber mega62. Deshalb wird `data` zuerst geprüft.
    const zustand: DirectoryQueryState = {
      data: [{ id: UID, name: "Erik Experte" }],
      isPending: false,
      isError: true,
    };
    expect(makeAuthorNameResolver(zustand, TEXTE)(UID)).toBe("Erik Experte");
  });

  it("Fehler schlägt lädt-noch, wenn beides zugleich gilt", () => {
    // Ein erneuter Versuch nach einem Fehler kann beide Merker wahr machen. „Lädt noch" würde
    // einen bereits eingetretenen Ausfall wieder zur Geduldsfrage machen — genau der Fehler, den
    // dieser Block behebt.
    const zustand: DirectoryQueryState = { data: undefined, isPending: true, isError: true };
    expect(makeAuthorNameResolver(zustand, TEXTE)(UID)).toBe("NICHT-ABRUFBAR");
  });

  it("weder Daten noch Laden noch Fehler → die ehrlichere der beiden Auskünfte", () => {
    // Etwa eine abgeschaltete Abfrage. Wir haben das Verzeichnis nicht; „lädt noch" wäre ein
    // Versprechen auf etwas, das niemand angefordert hat.
    const zustand: DirectoryQueryState = { data: undefined, isPending: false, isError: false };
    expect(makeAuthorNameResolver(zustand, TEXTE)(UID)).toBe("NICHT-ABRUFBAR");
  });
});

describe("mega63 B · die drei Schlüssel tragen drei verschiedene Sätze", () => {
  it("kein Schlüssel doppelt — sonst wäre die Trennung im Code, aber nicht auf dem Schirm", () => {
    // Die Trennung im Auflöser nützt nichts, wenn zwei Schlüssel denselben Satz übersetzen. Das
    // ist keine hypothetische Sorge: „nicht abrufbar" WAR bis mega62 der Text für beide Zustände.
    expect(new Set([AUTHOR_UNKNOWN_KEY, AUTHOR_LOADING_KEY, AUTHOR_UNAVAILABLE_KEY]).size).toBe(3);
  });
});
