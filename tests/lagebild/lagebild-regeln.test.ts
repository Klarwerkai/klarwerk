// ================================================================================================
// PETER-20261011-P13 · LAGEBILD UND WISSENSKAPITAL — DIE REGELN (`apps/web/src/lib/lagebild.ts`).
// ================================================================================================
//
// Agentenprüfung mit EIGENEN FIKTIVEN Testdaten (Arbeitswege „aw-wartung" und „aw-angebot", Fälle
// „F-…"). Keine Messung mit realen Anwendern; die Belege mit Messart `mensch` sind hier ebenso
// erfunden und prüfen nur die Regel, nicht einen echten Alltagsnutzen.
//
//   K1  Reifegrade pro Arbeitsweg durch Belege definiert
//   K2  Agentenprüfung von realer menschlicher Nutzung getrennt
//   K4  Unbekannte Grundgesamtheit erzeugt keine erfundene Prozentzahl
//   K6  Geldwerte nur aus tatsächlichen Fällen mit offengelegten Annahmen
//   K7  Zusatzaufwand und negative Entlastung bleiben in Rechnung
import { describe, expect, it } from "vitest";
import {
  BERECHNUNGSVERSION,
  type Beleg,
  type GemessenerFall,
  type Nachweis,
  REIFESTUFEN,
  type Reifestufe,
  STUFEN_NACHWEISE,
  geldwert,
  quote,
  reifegrad,
} from "../../apps/web/src/lib/lagebild";

const STAND = "2026-10-12T08:00:00.000Z";

/** Alle Nachweise einer Stufe für einen Arbeitsweg, mit einer bestimmten Messart. */
function belegeFuer(arbeitsweg: string, stufe: Reifestufe, messart: Beleg["messart"]): Beleg[] {
  const nachweise: readonly Nachweis[] = STUFEN_NACHWEISE[stufe];
  return nachweise.map((nachweis) => ({
    arbeitsweg,
    nachweis,
    messart,
    quelle: `fiktiv:${arbeitsweg}:${nachweis}`,
    stand: STAND,
  }));
}

/** Belege bis einschliesslich `bis` — „system" für Bestand, „agent" ab der technischen Prüfung. */
function belegeBis(arbeitsweg: string, bis: Reifestufe): Beleg[] {
  const ende = REIFESTUFEN.indexOf(bis);
  return REIFESTUFEN.slice(0, ende + 1).flatMap((s) =>
    belegeFuer(arbeitsweg, s, s === "technisch_geprueft" ? "agent" : "system"),
  );
}

/** Ein gemessener Fall; Vorgabe: echte Anwender, vergleichbare Qualität. */
const fall = (id: string, ohne: number, mit: number, teil: Partial<GemessenerFall> = {}) => ({
  id,
  messart: "mensch" as const,
  minutenOhne: ohne,
  minutenMit: mit,
  qualitaetVergleichbar: true,
  ...teil,
});

describe("K1 · Reifegrad je Arbeitsweg aus Belegen", () => {
  it("ohne Belege kein Reifegrad; die nächste Stufe nennt ihre fehlenden Nachweise", () => {
    const r = reifegrad("aw-wartung", []);
    expect(r.stufe).toBeNull();
    expect(r.naechste).toEqual({ stufe: "erfasst", fehlend: [...STUFEN_NACHWEISE.erfasst] });
    expect(r.version).toBe(BERECHNUNGSVERSION);
  });

  it("eine Stufe gilt erst, wenn JEDER ihrer Nachweise belegt ist", () => {
    const fastErfasst = belegeFuer("aw-wartung", "erfasst", "system").filter(
      (b) => b.nachweis !== "einstufung",
    );
    const r = reifegrad("aw-wartung", fastErfasst);
    expect(r.stufe).toBeNull();
    expect(r.naechste).toEqual({ stufe: "erfasst", fehlend: ["einstufung"] });
  });

  it("Stufen sind kumulativ: ein höherer Beleg ohne die Stufe darunter hebt nichts", () => {
    const ohneGeordnet = [
      ...belegeFuer("aw-wartung", "erfasst", "system"),
      ...belegeFuer("aw-wartung", "fachlich_bestaetigt", "system"),
      ...belegeFuer("aw-wartung", "technisch_geprueft", "agent"),
    ];
    const r = reifegrad("aw-wartung", ohneGeordnet);
    expect(r.stufe).toBe("erfasst");
    expect(r.naechste?.stufe).toBe("geordnet");
  });

  it("Belege eines anderen Arbeitswegs zählen nicht — der Reifegrad ist nie firmenweit", () => {
    const belege = belegeBis("aw-angebot", "technisch_geprueft");
    expect(reifegrad("aw-angebot", belege).stufe).toBe("technisch_geprueft");
    expect(reifegrad("aw-wartung", belege).stufe).toBeNull();
  });

  it("ein nicht bestandener Prüflauf oder ein Beleg ohne Quelle ist kein Nachweis", () => {
    const belege = belegeBis("aw-wartung", "technisch_geprueft").map((b) =>
      b.nachweis === "negativfaelle" ? { ...b, bestanden: false } : b,
    );
    expect(reifegrad("aw-wartung", belege).stufe).toBe("fachlich_bestaetigt");
    const ohneQuelle = belegeBis("aw-wartung", "erfasst").map((b) =>
      b.nachweis === "version" ? { ...b, quelle: " " } : b,
    );
    expect(reifegrad("aw-wartung", ohneQuelle).stufe).toBeNull();
  });
});

describe("K2 · Agentenprüfung getrennt von echter Nutzung", () => {
  it("Agentenbelege tragen bis „Technisch geprüft“, nie bis „Im echten Alltag belegt“", () => {
    const belege = [
      ...belegeBis("aw-wartung", "technisch_geprueft"),
      ...belegeFuer("aw-wartung", "alltag_belegt", "agent"),
    ];
    const r = reifegrad("aw-wartung", belege);
    expect(r.stufe).toBe("technisch_geprueft");
    expect(r.naechste).toEqual({
      stufe: "alltag_belegt",
      fehlend: [...STUFEN_NACHWEISE.alltag_belegt],
    });
    // Benannt, nicht still verworfen.
    expect(r.nichtAnrechenbar.map((b) => b.nachweis).sort()).toEqual(
      [...STUFEN_NACHWEISE.alltag_belegt].sort(),
    );
  });

  it("erst Belege echter Anwender (Messart mensch) erreichen den Alltag", () => {
    const belege = [
      ...belegeBis("aw-wartung", "technisch_geprueft"),
      ...belegeFuer("aw-wartung", "alltag_belegt", "mensch"),
    ];
    const r = reifegrad("aw-wartung", belege);
    expect(r.stufe).toBe("alltag_belegt");
    expect(r.naechste).toBeNull();
    expect(r.nichtAnrechenbar).toEqual([]);
  });

  it("ein Agentenbeleg für den Alltag wird auch benannt, wenn der Arbeitsweg tiefer steht", () => {
    const r = reifegrad("aw-wartung", belegeFuer("aw-wartung", "alltag_belegt", "agent"));
    expect(r.stufe).toBeNull();
    expect(r.nichtAnrechenbar).toHaveLength(STUFEN_NACHWEISE.alltag_belegt.length);
  });

  it("Agenten- und Menschenmessung werden im Geldwert nie zusammengerechnet", () => {
    const g = geldwert({
      faelle: [fall("F-1", 30, 10, { messart: "agent" }), fall("F-2", 30, 10)],
      kostensatzEurProStunde: 60,
      zusatzkostenEur: 0,
    });
    expect(g).toMatchObject({ lage: "nicht_berechenbar", grund: "messart_gemischt" });
  });

  it("das Ergebnis trägt seine Messart — eine Agentenmessung bleibt als solche erkennbar", () => {
    const g = geldwert({
      faelle: [fall("F-1", 30, 10, { messart: "agent" })],
      kostensatzEurProStunde: 60,
      zusatzkostenEur: 0,
    });
    expect(g).toMatchObject({ lage: "berechnet", messart: "agent" });
  });
});

describe("K4 · keine Prozentzahl ohne bekannte Grundgesamtheit", () => {
  it("ohne festgelegten Sollbestand bleibt der Wert leer — keine 0, keine 100", () => {
    expect(quote(7, null)).toEqual({
      wert: null,
      grund: "grundgesamtheit_unbekannt",
      zaehler: 7,
      nenner: null,
    });
  });

  it("Nenner 0 ist nicht berechenbar, ein Zähler über dem Nenner ungültig", () => {
    expect(quote(0, 0)).toMatchObject({ wert: null, grund: "nenner_null" });
    expect(quote(5, 4)).toMatchObject({ wert: null, grund: "ungueltig" });
  });

  it("mit festgelegtem Sollbestand: Prozent mit einer Nachkommastelle", () => {
    expect(quote(2, 3)).toMatchObject({ wert: 66.7, grund: "berechnet" });
  });
});

describe("K6 · Geldwert nur aus tatsächlichen Fällen mit offengelegten Annahmen", () => {
  it("ohne gemessenen Fall gibt es keinen Geldwert — auch nicht aus einem Bestand", () => {
    expect(geldwert({ faelle: [], kostensatzEurProStunde: 60, zusatzkostenEur: 0 })).toEqual({
      lage: "nicht_berechenbar",
      grund: "keine_faelle",
      version: BERECHNUNGSVERSION,
    });
  });

  it("es gibt keine Vorgabewerte: ohne vereinbarten Kostensatz kein Wert", () => {
    const g = geldwert({
      faelle: [fall("F-1", 30, 10)],
      kostensatzEurProStunde: null,
      zusatzkostenEur: 0,
    });
    expect(g).toMatchObject({ lage: "nicht_berechenbar", grund: "kostensatz_fehlt" });
  });

  it("Fallzahl × gemessene Zeitdifferenz × Kostensatz, Annahmen stehen am Ergebnis", () => {
    const g = geldwert({
      faelle: [fall("F-1", 30, 10), fall("F-2", 45, 15)],
      kostensatzEurProStunde: 60,
      zusatzkostenEur: 0,
    });
    expect(g).toEqual({
      lage: "berechnet",
      messart: "mensch",
      fallzahl: 2,
      doppelt: 0,
      minutenDifferenz: 50,
      faelleMitMehraufwand: 0,
      bruttoEur: 50,
      zusatzkostenEur: 0,
      nettoEur: 50,
      kostensatzEurProStunde: 60,
      version: BERECHNUNGSVERSION,
    });
  });

  it("derselbe Fall zählt einmal; Einträge ohne Kennung sind keine Fälle", () => {
    const g = geldwert({
      faelle: [fall("F-1", 30, 10), fall("F-1", 30, 10), fall(" ", 600, 0)],
      kostensatzEurProStunde: 60,
      zusatzkostenEur: 0,
    });
    expect(g).toMatchObject({ lage: "berechnet", fallzahl: 1, doppelt: 1, minutenDifferenz: 20 });
  });

  it("ein Fall ohne vergleichbare Qualität verhindert den Wert — kein Aussortieren", () => {
    const g = geldwert({
      faelle: [fall("F-1", 30, 10), fall("F-2", 30, 50, { qualitaetVergleichbar: false })],
      kostensatzEurProStunde: 60,
      zusatzkostenEur: 0,
    });
    expect(g).toMatchObject({ lage: "nicht_berechenbar", grund: "qualitaet_nicht_vergleichbar" });
  });

  it("eine fehlende oder unsinnige Messung ist keine Null", () => {
    for (const kaputt of [fall("F-1", Number.NaN, 10), fall("F-1", -5, 10)]) {
      const g = geldwert({ faelle: [kaputt], kostensatzEurProStunde: 60, zusatzkostenEur: 0 });
      expect(g).toMatchObject({ lage: "nicht_berechenbar", grund: "ungueltige_messung" });
    }
  });
});

describe("K7 · Zusatzaufwand und negative Entlastung bleiben in Rechnung", () => {
  it("Mehraufwand mit Klarwerk bleibt negativ und wird nicht auf 0 gekappt", () => {
    const g = geldwert({
      faelle: [fall("F-1", 20, 50), fall("F-2", 30, 20)],
      kostensatzEurProStunde: 60,
      zusatzkostenEur: 0,
    });
    expect(g).toMatchObject({
      lage: "berechnet",
      minutenDifferenz: -20,
      faelleMitMehraufwand: 1,
      bruttoEur: -20,
      nettoEur: -20,
    });
  });

  it("Pflege-, Betriebs- und Prüfkosten werden abgezogen — auch bis unter null", () => {
    const g = geldwert({
      faelle: [fall("F-1", 90, 30)],
      kostensatzEurProStunde: 60,
      zusatzkostenEur: 75,
    });
    expect(g).toMatchObject({
      lage: "berechnet",
      bruttoEur: 60,
      zusatzkostenEur: 75,
      nettoEur: -15,
    });
  });

  it("ohne Angabe der Zusatzkosten gibt es keinen Wert — sie fallen nicht still weg", () => {
    const g = geldwert({
      faelle: [fall("F-1", 90, 30)],
      kostensatzEurProStunde: 60,
      zusatzkostenEur: null,
    });
    expect(g).toMatchObject({ lage: "nicht_berechenbar", grund: "zusatzkosten_fehlt" });
  });
});
