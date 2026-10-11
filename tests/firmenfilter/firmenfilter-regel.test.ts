// ================================================================================================
// produkt:20261011:peter-p14 · DIE REGEL DES FIRMENFILTERS — rein, ohne App.
// ================================================================================================
//
// Ordnung zu den Originalkriterien (AUFTRAG-B1.json):
//   K1 · Eigene Firma, freigegebener Partner und öffentlich sind unterscheidbar (`firmenbereichVon`).
//   K2 · Der Filter verleiht keine Rechte: der Trim ist immer `Sichtbarkeit UND Bereich`.
//   K4 · Manipulierte Angaben scheitern mit EINEM Fehlertext, der nichts über den Bestand sagt.
// Alle Kennungen und Namen sind erfundene Testdaten.
import { describe, expect, it } from "vitest";
import {
  type FirmenbereichsFakten,
  FirmenfilterFehler,
  firmenTrim,
  firmenbereichVon,
  imFirmenfilter,
  leseFirmenfilter,
  ohneFirmenfilter,
} from "../../services/app/src/firmenbereich";
import type { SessionUser } from "../../services/app/src/http";
import { sqlSichtbarkeitFuer } from "../../services/app/src/sichtbarkeit";
import {
  bereichsmarken,
  kontextVon,
  partnerbereiche,
  pruefeSpaceEingabe,
} from "../../services/app/src/spaces";

// Nacharbeit 8 (AC01): die Marken der EINEN Bereichsableitung — Partner- und öffentliche Spaces.
const PARTNER = { partner: new Set(["s-alpha"]), oeffentlich: new Set(["s-normen"]) };

function bereich(ko: FirmenbereichsFakten): string {
  return firmenbereichVon(ko, PARTNER);
}

function filterAus(eingabe: { firmenbereich?: unknown; partner?: unknown }) {
  const filter = leseFirmenfilter(eingabe);
  if (!filter) {
    throw new Error("Filter erwartet");
  }
  return filter;
}

describe("K1 · drei unterscheidbare Bereiche, abgeleitet aus dem Bestand", () => {
  it("Partnerbereich vor öffentlich vor eigen — und öffentlich nur bei interner Stufe", () => {
    const intern = { confidentiality: "intern" as const };
    expect(bereich({ spaceId: "s-alpha" })).toBe("partner");
    expect(bereich({ spaceId: "s-alpha", oeffentlich: true, ...intern })).toBe("partner");
    expect(bereich({ oeffentlich: true, ...intern })).toBe("oeffentlich");
    // Eine Höherstufung nimmt die Marke ausser Kraft — dieselbe Lesart wie `setOeffentlich`.
    expect(bereich({ oeffentlich: true, confidentiality: "vertraulich" })).toBe("eigen");
    // Nacharbeit 9 (Zusammenführung, Entscheidung 16): eine FEHLENDE Stufe zählt wie vertraulich.
    expect(bereich({ oeffentlich: true })).toBe("eigen");
    expect(bereich({ spaceId: "s-werkstatt" })).toBe("eigen");
    expect(bereich({})).toBe("eigen");
    // Eine Zeichenkette "true" ist keine Marke.
    expect(bereich({ oeffentlich: "true", ...intern })).toBe("eigen");
    // Nacharbeit 8 (AC01): ein Space im Kontext `oeffentlich` ordnet ebenso ein — mit derselben
    // Stufenregel; Partner geht weiterhin vor.
    expect(bereich({ spaceId: "s-normen", ...intern })).toBe("oeffentlich");
    expect(bereich({ spaceId: "s-normen", oeffentlich: true, ...intern })).toBe("oeffentlich");
    expect(bereich({ spaceId: "s-normen" })).toBe("eigen");
    expect(bereich({ spaceId: "s-normen", confidentiality: "vertraulich" })).toBe("eigen");
    expect(bereich({ spaceId: "s-normen", confidentiality: "streng_vertraulich" })).toBe("eigen");
  });

  it("die Bereichsmarken kommen aus dem Spacekontext — auch für Altfassungen nur mit Partnernamen", () => {
    const stempel = {
      version: 1,
      angelegtVon: "u-carla",
      angelegtAm: "2026-10-11T08:00:00.000Z",
      geaendertVon: "u-carla",
      geaendertAm: "2026-10-11T08:00:00.000Z",
      zweck: "Probe",
      verantwortlich: "u-carla",
      mitglieder: [],
      ansichten: [],
    };
    const geschlossen = { ...stempel, zugang: "mitglieder" as const };
    const offen = { ...stempel, zugang: "alle" as const };
    const marken = bereichsmarken([
      { ...geschlossen, id: "s-alpha", name: "A", kontext: "partner", partner: "Alpha GmbH" },
      { ...geschlossen, id: "s-alt", name: "Alt", partner: "Alt GmbH" },
      { ...offen, id: "s-normen", name: "N", kontext: "oeffentlich" },
      { ...geschlossen, id: "s-werk", name: "W", kontext: "firma" },
      { ...offen, id: "s-ohne", name: "O" },
    ]);
    expect([...marken.partner].sort()).toEqual(["s-alpha", "s-alt"]);
    expect([...marken.oeffentlich]).toEqual(["s-normen"]);
  });

  it("die Partnermarke am Space ist optional, geprüft und ergibt die Partnerbereiche", () => {
    const konten = new Set(["u-carla"]);
    const basis = { name: "Alpha", zweck: "Partnerwissen", verantwortlich: "u-carla" };
    const pruefe = (zusatz: Record<string, unknown>) =>
      pruefeSpaceEingabe({ ...basis, ...zusatz }, konten);
    // Zusammenführung mit main (gesamt-wissensprojekte): der Partnerbereich ist der Kontext
    // `partner` samt Namen; ein Name ohne diesen Kontext ist ungültig, und er ist nie für alle offen.
    const partner = { kontext: "partner" };
    expect(pruefe({}).partner).toBeUndefined();
    expect(kontextVon(pruefe({}))).toBe("firma");
    expect(pruefe({ kontext: "firma" }).kontext).toBe("firma");
    expect(pruefe({ ...partner, partner: "  Alpha GmbH " }).partner).toBe("Alpha GmbH");
    expect(pruefe({ partner: null }).partner).toBeUndefined();
    expect(pruefe({ partner: "" }).partner).toBeUndefined();
    expect(() => pruefe({ partner: "Alpha GmbH" })).toThrow();
    expect(() => pruefe({ ...partner })).toThrow();
    expect(() => pruefe({ ...partner, partner: 7 })).toThrow();
    expect(() => pruefe({ ...partner, partner: "x".repeat(81) })).toThrow();
    expect(() => pruefe({ ...partner, partner: "Alpha GmbH", zugang: "alle" })).toThrow();
    const stempel = {
      version: 1,
      angelegtVon: "u-carla",
      angelegtAm: "2026-10-11T08:00:00.000Z",
      geaendertVon: "u-carla",
      geaendertAm: "2026-10-11T08:00:00.000Z",
    };
    const alpha = { ...pruefe({ ...partner, partner: "Alpha GmbH" }), ...stempel, id: "s-alpha" };
    const werkstatt = { ...pruefe({}), ...stempel, id: "s-werkstatt" };
    // Eine Fassung aus den P14-Kandidaten vor der Zusammenführung: Name ohne `kontext`.
    const { kontext: _ohne, ...altEingabe } = pruefe({});
    const altPartner = { ...altEingabe, partner: "Gamma KG", ...stempel, id: "s-gamma" };
    expect([...partnerbereiche([alpha, werkstatt, altPartner])]).toEqual(["s-alpha", "s-gamma"]);
  });
});

describe("K4 · manipulierte oder unklare Angaben scheitern gleich", () => {
  it("gültige Formen", () => {
    expect(leseFirmenfilter({})).toBeUndefined();
    expect([...filterAus({ firmenbereich: "eigen" }).bereiche]).toEqual(["eigen"]);
    const zwei = filterAus({ firmenbereich: "eigen,oeffentlich" });
    expect([...zwei.bereiche]).toEqual(["eigen", "oeffentlich"]);
    const wiederholt = filterAus({ firmenbereich: ["partner", "eigen"] });
    expect([...wiederholt.bereiche]).toEqual(["partner", "eigen"]);
    // `partner` allein heisst: genau dieser Partnerbereich.
    expect(filterAus({ partner: "s-alpha" })).toEqual({
      bereiche: new Set(["partner"]),
      partner: "s-alpha",
    });
  });

  it("jede andere Form wirft denselben Fehler mit demselben Text", () => {
    const ungueltig: { firmenbereich?: unknown; partner?: unknown }[] = [
      { firmenbereich: "fremd" },
      { firmenbereich: "" },
      { firmenbereich: "eigen," },
      { firmenbereich: "EIGEN" },
      { firmenbereich: ["eigen", 1] },
      { firmenbereich: "tenant:kunde-b" },
      { partner: "" },
      { partner: "x' OR 1=1 --" },
      { partner: "../s-alpha" },
      { partner: ["s-alpha", "s-beta"] },
      { partner: "a".repeat(65) },
      { firmenbereich: "eigen", partner: "s-alpha" },
    ];
    const texte = new Set<string>();
    for (const eingabe of ungueltig) {
      let fehler: unknown;
      try {
        leseFirmenfilter(eingabe);
      } catch (e) {
        fehler = e;
      }
      expect(fehler, JSON.stringify(eingabe)).toBeInstanceOf(FirmenfilterFehler);
      texte.add((fehler as Error).message);
    }
    expect(texte.size).toBe(1);
  });

  it("die Filterfelder reisen nicht als Fachfilter weiter", () => {
    const abfrage = { tag: "a", firmenbereich: "eigen", partner: "s-alpha" };
    expect(ohneFirmenfilter(abfrage)).toEqual({ tag: "a" });
  });
});

describe("K2 · der Filter verengt nur — er öffnet nichts", () => {
  it("die In-Memory-Form ist Sichtbarkeit UND Bereich", () => {
    const filter = filterAus({ partner: "s-alpha" });
    const partnerObjekt = { spaceId: "s-alpha", author: "u-erik" };
    // Der Bereich passt, das Recht fehlt (kein Mitglied, auch nicht als Admin): nicht sichtbar.
    const fremd: SessionUser = { id: "u-fritz", role: "admin", spaceLesbar: new Set() };
    expect(imFirmenfilter(partnerObjekt, filter, PARTNER)).toBe(true);
    expect(firmenTrim(sqlSichtbarkeitFuer(fremd), filter, PARTNER).trifftZu(partnerObjekt)).toBe(
      false,
    );
    // Gegenprobe: mit Leserecht im Space trifft er zu.
    const lesbar = new Set(["s-alpha"]);
    const mitglied: SessionUser = { id: "u-lea", role: "viewer", spaceLesbar: lesbar };
    const trim = firmenTrim(sqlSichtbarkeitFuer(mitglied), filter, PARTNER);
    expect(trim.trifftZu(partnerObjekt)).toBe(true);
  });

  it("die SQL-Form hängt das Bereichsprädikat UND-verknüpft an den unveränderten Trim", () => {
    const lesbar = new Set(["s-alpha"]);
    const user: SessionUser = { id: "u-lea", role: "experte", spaceLesbar: lesbar };
    const basis = sqlSichtbarkeitFuer(user);
    const trim = firmenTrim(basis, filterAus({ firmenbereich: "eigen,partner" }), PARTNER);
    expect(trim.sql("kos", 3).startsWith(`(${basis.sql("kos", 3)} AND (`)).toBe(true);
    expect(trim.params.slice(0, basis.params.length)).toEqual([...basis.params]);
    // Partnerbereiche, dann (weil `eigen` die Öffentlich-Regel liest) die öffentlichen Spaces.
    expect(trim.params.slice(basis.params.length)).toEqual([["s-alpha"], ["s-normen"]]);
    // Ohne Zweig, der sie liest, reist die Liste nicht mit — kein ungenutzter Platzhalter.
    const nurPartner = firmenTrim(basis, filterAus({ firmenbereich: "partner" }), PARTNER);
    expect(nurPartner.params.slice(basis.params.length)).toEqual([["s-alpha"]]);
    const genau = firmenTrim(basis, filterAus({ partner: "s-alpha" }), PARTNER);
    expect(genau.params.slice(basis.params.length)).toEqual([["s-alpha"], "s-alpha"]);
  });
});
