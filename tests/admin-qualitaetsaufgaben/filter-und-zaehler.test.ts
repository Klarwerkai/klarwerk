// ================================================================================================
// ADMIN-10 · FILTER UND ZÄHLER — DIESELBE AUSWAHLREGEL FÜR LISTE UND ZAHL, DOM-frei.
// ================================================================================================
//
// produkt:20261009:admin-qualitaetsaufgaben, Kriterium 3: „Zähler und Listen verwenden denselben
// berechtigten Bestand; Space-, Typ-, Zustands- und Zuständigkeitsfilter kombinieren sich und
// bleiben beim Rückweg erhalten." Gemessen an `lib/qualitaetsaufgaben.ts` mit fiktiven Einträgen:
//   F1  Für JEDEN Wert JEDER Dimension und jede Kombination der übrigen Filter ist die angezeigte
//       Zahl genau die Länge der Liste, die bei dieser Wahl erscheint.
//   F2  Die vier Filter kombinieren sich (UND); „ohne Space" und „niemand zugeordnet" sind wählbar.
//   F3  Die Wahl steht in der Adresse: lesen ↔ schreiben ist verlustfrei, fremde Parameter bleiben,
//       unbekannte Werte gelten als „alle" (nie als leere Liste).
import { describe, expect, it } from "vitest";
import type { QualitaetsVorgang } from "../../apps/web/src/api/qualitaetsaufgaben";
import {
  type FilterDimension,
  LEERER_FILTER,
  OHNE,
  type QualitaetsFilter,
  alterInTagen,
  einstiegsBilanz,
  filterAusAdresse,
  filterInAdresse,
  gefiltert,
  zaehleJe,
  zustaendigeIm,
} from "../../apps/web/src/lib/qualitaetsaufgaben";

function vorgang(teil: Partial<QualitaetsVorgang> & { schluessel: string }): QualitaetsVorgang {
  return {
    typ: "pruefung",
    zustand: "offen",
    ursprung: { art: "ko", id: teil.schluessel },
    arbeitsweg: "/wissen/x",
    titel: null,
    inhalt: [],
    spaces: [],
    zustaendig: [],
    frist: null,
    ueberfaellig: false,
    seit: null,
    einstiege: ["pruefboard"],
    ...teil,
  };
}

const pia = { id: "u-pia", name: "Pia Prüferin", art: "pruefer" as const };
const paul = { id: "u-paul", name: "Paul Prüfer", art: "pruefer" as const };
const alex = { id: "u-alex", name: "Alex Autorin", art: "autor-ersatz" as const };

const BESTAND: QualitaetsVorgang[] = [
  vorgang({
    schluessel: "pruefung:k1",
    spaces: ["s-werk"],
    zustand: "in_arbeit",
    zustaendig: [pia, paul],
    einstiege: ["pruefboard", "zuweisung:u-pia", "zuweisung:u-paul"],
  }),
  vorgang({ schluessel: "pruefung:k2", spaces: ["s-labor"] }),
  vorgang({
    schluessel: "revalidierung:k3",
    typ: "revalidierung",
    spaces: ["s-werk"],
    zustaendig: [alex],
    frist: "2020-01-15",
    ueberfaellig: true,
  }),
  vorgang({
    schluessel: "konflikt:c1",
    typ: "konflikt",
    zustand: "eskaliert",
    spaces: ["s-werk", "s-labor"],
  }),
  vorgang({ schluessel: "duplikat:d1", typ: "duplikat", spaces: [] }),
  vorgang({ schluessel: "luecke:g1", typ: "luecke", zustaendig: [paul], zustand: "in_arbeit" }),
  vorgang({
    schluessel: "rueckmeldung:M-1",
    typ: "rueckmeldung",
    spaces: ["s-labor"],
    zustaendig: [alex],
  }),
  vorgang({
    schluessel: "rueckmeldung:M-2",
    typ: "rueckmeldung",
    zustand: "erledigt",
    spaces: ["s-werk"],
    zustaendig: [alex],
  }),
  vorgang({
    schluessel: "rueckmeldung:M-3",
    typ: "rueckmeldung",
    zustand: "unklar",
    zustaendig: [alex],
  }),
];

const WERTE: Record<FilterDimension, (string | null)[]> = {
  space: [null, "s-werk", "s-labor", OHNE],
  typ: [null, "pruefung", "revalidierung", "konflikt", "duplikat", "luecke", "rueckmeldung"],
  zustand: [null, "offen", "in_arbeit", "eskaliert", "erledigt", "unklar"],
  zustaendig: [null, "u-pia", "u-paul", "u-alex", OHNE],
};
const DIMENSIONEN = Object.keys(WERTE) as FilterDimension[];

/** Alle Kombinationen der vier Filter (4 × 7 × 6 × 5 = 840). */
function alleFilter(): QualitaetsFilter[] {
  const out: QualitaetsFilter[] = [];
  for (const space of WERTE.space) {
    for (const typ of WERTE.typ) {
      for (const zustand of WERTE.zustand) {
        for (const zustaendig of WERTE.zustaendig) {
          out.push({ space, zustaendig, typ, zustand } as QualitaetsFilter);
        }
      }
    }
  }
  return out;
}

describe("ADMIN-10 · F1 · Zahl und Liste aus derselben Regel", () => {
  it("für jede der 840 Filterlagen: Zähler je Wert = Länge der Liste bei dieser Wahl", () => {
    let geprueft = 0;
    for (const filter of alleFilter()) {
      for (const d of DIMENSIONEN) {
        const zaehler = zaehleJe(BESTAND, filter, d);
        for (const w of WERTE[d]) {
          if (w === null) {
            continue;
          }
          const liste = gefiltert(BESTAND, { ...filter, [d]: w } as QualitaetsFilter);
          expect(zaehler.get(w) ?? 0, `${JSON.stringify(filter)} · ${d}=${w}`).toBe(liste.length);
          geprueft += 1;
        }
      }
    }
    // Kalibrierung: die Schleife lief wirklich über alle Lagen und Werte.
    expect(geprueft).toBe(840 * (3 + 6 + 5 + 4));
  });

  it("ein Vorgang mit zwei Spaces oder zwei Prüfern ist EIN Listeneintrag", () => {
    expect(gefiltert(BESTAND, LEERER_FILTER)).toHaveLength(BESTAND.length);
    const nurWerk = gefiltert(BESTAND, { ...LEERER_FILTER, space: "s-werk" });
    expect(nurWerk.filter((v) => v.schluessel === "konflikt:c1")).toHaveLength(1);
    expect(einstiegsBilanz(BESTAND)).toEqual({ vorgaenge: 9, einstiege: 11 });
  });
});

describe("ADMIN-10 · F2 · die vier Filter kombinieren sich", () => {
  it("Space UND Typ UND Zustand UND Zuständigkeit", () => {
    const f: QualitaetsFilter = {
      space: "s-werk",
      typ: "rueckmeldung",
      zustand: "erledigt",
      zustaendig: "u-alex",
    };
    expect(gefiltert(BESTAND, f).map((v) => v.schluessel)).toEqual(["rueckmeldung:M-2"]);
    expect(gefiltert(BESTAND, { ...f, zustand: "offen" })).toEqual([]);
  });

  it("„ohne Space“ und „niemand zugeordnet“ sind eigene, ausdrückliche Werte", () => {
    const ohneSpace = gefiltert(BESTAND, { ...LEERER_FILTER, space: OHNE });
    expect(ohneSpace.map((v) => v.schluessel).sort()).toEqual(
      ["duplikat:d1", "luecke:g1", "rueckmeldung:M-3"].sort(),
    );
    const niemand = gefiltert(BESTAND, { ...LEERER_FILTER, zustaendig: OHNE });
    expect(niemand.map((v) => v.schluessel).sort()).toEqual(
      ["duplikat:d1", "konflikt:c1", "pruefung:k2"].sort(),
    );
  });

  it("die Zuständigen kommen aus dem Bestand, jede Person einmal", () => {
    expect(zustaendigeIm(BESTAND).map((p) => p.id)).toEqual(["u-alex", "u-paul", "u-pia"]);
  });
});

describe("ADMIN-10 · F3 · die Wahl steht in der Adresse", () => {
  it("lesen ↔ schreiben ist verlustfrei; fremde Parameter bleiben", () => {
    let p = new URLSearchParams("fremd=1");
    p = filterInAdresse(p, "space", "s-werk");
    p = filterInAdresse(p, "typ", "konflikt");
    p = filterInAdresse(p, "zustand", "eskaliert");
    p = filterInAdresse(p, "zustaendig", OHNE);
    expect(filterAusAdresse(p)).toEqual({
      space: "s-werk",
      typ: "konflikt",
      zustand: "eskaliert",
      zustaendig: OHNE,
    });
    expect(p.get("fremd")).toBe("1");
    p = filterInAdresse(p, "typ", null);
    expect(filterAusAdresse(p).typ).toBeNull();
    expect(p.has("typ")).toBe(false);
  });

  it("unbekannte Werte gelten als „alle“, nicht als leere Liste", () => {
    const f = filterAusAdresse(new URLSearchParams("typ=erfunden&zustand=irgendwas&space="));
    expect(f).toEqual(LEERER_FILTER);
    expect(gefiltert(BESTAND, f)).toHaveLength(BESTAND.length);
  });
});

describe("ADMIN-10 · Alter", () => {
  it("ganze Tage seit Beginn; ohne Beginn `null` statt einer erfundenen Null", () => {
    const jetzt = Date.parse("2026-10-10T12:00:00.000Z");
    expect(alterInTagen("2026-10-07T12:00:00.000Z", jetzt)).toBe(3);
    expect(alterInTagen("2026-10-10T08:00:00.000Z", jetzt)).toBe(0);
    expect(alterInTagen(null, jetzt)).toBeNull();
    expect(alterInTagen("kein Datum", jetzt)).toBeNull();
  });
});
