// ================================================================================================
// produkt:20261011:peter-p06:beschaffungsroutine · BES-07 — DER FUNKTIONSVERTRAG AM DIENST.
// ================================================================================================
//
// Gemessen am Dienst mit der Speicherablage und gestellter Uhr. Alle Inhalte sind fiktiv.
//
//   D1  K01 — ein Satz (Text oder Sprache) ergibt ohne Editor eine verständliche Definition.
//   D2  K02 — Produkt, Menge, Termin, Ansprechpartner, Ausnahme sind Parameter; Beispielwerte aus
//             dem Satz werden zurückgemeldet und NICHT gespeichert.
//   D3  K03 — Quellenregel, Schritte, Außenaktionsregel, Empfänger, Ergebnis, Eigentümer, Version,
//             Fehler- und Stopregel stehen im gespeicherten Vertrag.
//   D4  K04 — Entwurf und Speichern lösen keinen Lauf, keine Serie, kein Außenrecht aus.
//   D5  K05 — ein manueller Lauf liest Quellen und Rolle JETZT; nichts aus früheren Läufen.
//   D6  K06 — Serie nur ausdrücklich; Zeitzone, Sommer-/Winterzeit, Monatsende, Ende; nicht ausgelöst.
//   D7  K07 — Ändern (neue Fassung), Pausieren, Deaktivieren, Übernehmen, Konflikt, zweiter Fall.
//   D8  K08 — offene Fähigkeiten sind konkret benannt; ausführbar erst, wenn keine fehlt.
import { describe, expect, it } from "vitest";
import {
  InMemoryKlaraGespraechRepo,
  type KlaraGespraech,
  type KlaraNachricht,
} from "../../services/app/src/klara-gespraech";
import {
  BESCHAFFUNG_FAEHIGKEITEN,
  FunktionenDienst,
  type FunktionsVorbereitung,
  InMemoryFunktionenRepo,
  type QuelleLesen,
  type Zeitauftrag,
  aktuelleFassung,
  entwirfFunktion,
  naechsteTermine,
  ortszeitZuUtc,
} from "../../services/app/src/persoenliche-funktionen";

const ANNA = "konto-anna";
const BERT = "konto-bert";
const JETZT = "2026-10-11T08:00:00.000Z";
const SATZ = "So möchte ich künftig Angebote für eine Verpackung einholen.";
const SATZ_MIT_WERTEN =
  "So möchte ich künftig Angebote für Faltschachteln einholen – diesmal 500 Stück bis 30.11.2026, Ansprechpartner einkauf@lieferant.example.";
const SATZ_MONATLICH = "So möchte ich jeden Monat Angebote für Etiketten einholen.";
const FALL = { parameter: { produkt: "Karton A", menge: "100 Stück", termin: "2026-11-30" } };
const SERIE = {
  rhythmus: "monatlich",
  beginn: "2026-11-01",
  uhrzeit: "08:00",
  nachholen: "einmal",
};

function aufbau(gespraeche?: InMemoryKlaraGespraechRepo) {
  let jetzt = Date.parse(JETZT);
  let n = 0;
  const repo = new InMemoryFunktionenRepo();
  const dienst = new FunktionenDienst({
    repo,
    jetzt: () => jetzt,
    neueId: () => `id-${++n}`,
    ...(gespraeche ? { gespraeche } : {}),
  });
  const weiter = (ms: number): void => {
    jetzt += ms;
  };
  return { repo, dienst, weiter };
}

/** Quellen, deren Fassung sich zwischen zwei Läufen ändern kann; `null` = nicht zugänglich. */
function quellen(stand: Record<string, number | null>): QuelleLesen {
  return async (koId) => {
    const fassung = stand[koId];
    return typeof fassung === "number" ? { fassung, status: "validiert" } : null;
  };
}

const kontext = (rolle = "experte", stand: Record<string, number | null> = {}) => ({
  rolle,
  quelleLesen: quellen(stand),
});

/** Der geworfene Fehler eines synchronen Aufrufs — oder `null`, wenn nichts geworfen wurde. */
function fang(aufruf: () => unknown): unknown {
  try {
    aufruf();
  } catch (fehler) {
    return fehler;
  }
  return null;
}

function serie(teil: Partial<Zeitauftrag>): Zeitauftrag {
  return {
    rhythmus: "monatlich",
    beginn: "2026-11-01",
    ende: null,
    uhrzeit: "08:00",
    zeitzone: "Europe/Berlin",
    nachholen: "einmal",
    eingerichtetAm: JETZT,
    ausfuehrung: "vorbereitung",
    ...teil,
  };
}

describe("D1 · K01 — aus einem Satz eine verständliche Funktion, ohne Editor", () => {
  it("der Satz des Auftrags ergibt Name, Zweck, Thema und die fünf Parameter", () => {
    const e = entwirfFunktion(SATZ, "text");
    expect(e.name).toBe("Angebote für Verpackung einholen");
    expect(e.thema).toBe("Verpackung");
    expect(e.zweck).toContain("Verpackung");
    expect(e.parameter.map((p) => p.name)).toEqual([
      "produkt",
      "menge",
      "termin",
      "ansprechpartner",
      "ausnahme",
    ]);
    expect(e.beispielwerte).toEqual([]);
    expect(e.wiederholungErwaehnt).toBe(false);
  });

  it("gesprochen ist derselbe Weg — der Eingabeweg wird nur vermerkt", () => {
    const e = entwirfFunktion(SATZ, "sprache");
    expect(e.eingabeweg).toBe("sprache");
    expect(e.name).toBe(entwirfFunktion(SATZ, "text").name);
  });

  it("ein Satz ohne Beschaffungsablauf wird abgelehnt statt geraten", () => {
    const fremd = fang(() => entwirfFunktion("Erinnere mich morgen an den Zahnarzt.", "text"));
    expect(fremd).toMatchObject({ status: 400, grund: "nicht_erkannt" });
    expect(fang(() => entwirfFunktion("   ", "text"))).toMatchObject({ grund: "eingabe" });
  });
});

describe("D2 · K02 — Parameter statt dauerhafter Testwerte", () => {
  it("Menge, Termin und Ansprechpartner aus dem Satz sind Beispielwerte, im Satz Platzhalter", () => {
    const e = entwirfFunktion(SATZ_MIT_WERTEN, "text");
    expect(e.thema).toBe("Faltschachteln");
    expect(e.beispielwerte).toEqual(
      expect.arrayContaining([
        { parameter: "menge", wert: "500 Stück" },
        { parameter: "termin", wert: "bis 30.11.2026" },
        { parameter: "ansprechpartner", wert: "einkauf@lieferant.example" },
      ]),
    );
    expect(e.beispielwerte.some((b) => b.parameter === "ausnahme")).toBe(true);
    expect(e.ausgangstext).toContain("[Ansprechpartner]");
    for (const wert of ["500", "30.11.2026", "einkauf@", "diesmal"]) {
      expect(e.ausgangstext, wert).not.toContain(wert);
    }
  });

  it("gespeichert wird KEIN Beispielwert — weder im Vertrag noch irgendwo in der Zeile", async () => {
    const { dienst, repo } = aufbau();
    const { beispielwerte } = await dienst.speichern(ANNA, { text: SATZ_MIT_WERTEN }, quellen({}));
    expect(beispielwerte.length).toBeGreaterThanOrEqual(3);
    const roh = JSON.stringify(await repo.eigene(ANNA));
    for (const wert of ["500", "Stück", "30.11.2026", "einkauf@lieferant.example", "diesmal"]) {
      expect(roh, wert).not.toContain(wert);
    }
  });
});

describe("D3 · K03 — der gespeicherte Vertrag", () => {
  it("trägt Quellenregel, Schritte, Außenaktionen, Empfänger, Ergebnis, Eigentümer, Version, Regeln", async () => {
    const { dienst, repo } = aufbau();
    await dienst.speichern(ANNA, { text: SATZ, quellen: ["ko-spez"] }, quellen({ "ko-spez": 3 }));
    const [f] = await repo.eigene(ANNA);
    expect(f?.kontoId).toBe(ANNA);
    const v = f ? aktuelleFassung(f) : undefined;
    expect(v?.version).toBe(1);
    expect(v?.quellen).toEqual(["ko-spez"]);
    expect(v?.quellenregel).toEqual({
      jedenLaufNeuLesen: true,
      nurGeltendeFassung: true,
      entwuerfeUndAnkuendigungenSindKeineFreigabe: true,
      lieferantenantwortenSindDaten: true,
    });
    expect(v?.erlaubteSchritte).toContain("quellen_lesen");
    expect(v?.erlaubteSchritte.join(" ")).not.toMatch(/versand|bestell|zahl/);
    expect(v?.aussenaktionen).toEqual({
      anfrageVersand: "je_lauf_bestaetigen",
      nachfassen: "je_lauf_bestaetigen",
      bestellung: "ausgeschlossen",
      zahlung: "ausgeschlossen",
    });
    expect(v?.empfaengerregel).toContain("heutigen Rechten");
    expect(v?.ergebnis).toContain("Keine Bestellung");
    expect(v?.fehlerregel).toContain("hält der Lauf an");
    expect(v?.stopregel).toContain("Pausieren");
  });

  it("eine unbekannte oder verborgene Quelle wird nicht gespeichert (404, keine Zeile)", async () => {
    const { dienst, repo } = aufbau();
    const eingabe = { text: SATZ, quellen: ["ko-geheim"] };
    await expect(
      dienst.speichern(ANNA, eingabe, quellen({ "ko-geheim": null })),
    ).rejects.toMatchObject({ status: 404, grund: "quelle_unbekannt" });
    expect(await repo.eigene(ANNA)).toEqual([]);
  });
});

describe("D4 · K04 — Speichern und Beobachten bewirken nichts", () => {
  it("der Entwurf schreibt nichts; Speichern legt weder Lauf noch Serie an", async () => {
    const { dienst, repo } = aufbau();
    const vorschau = await dienst.entwurf(ANNA, { text: SATZ_MONATLICH }, quellen({}));
    expect(vorschau.entwurf.wiederholungErwaehnt).toBe(true);
    expect(await repo.eigene(ANNA)).toEqual([]);

    const { funktion } = await dienst.speichern(ANNA, { text: SATZ_MONATLICH }, quellen({}));
    expect(funktion.stand).toBe("aktiv");
    expect(funktion.laeufe).toEqual([]);
    expect(funktion.zeitauftrag).toBeNull();
  });

  it("ein Vorschlag (Lernnotiz) ist nicht aufrufbar, bis das Konto ihn übernimmt", async () => {
    const { dienst } = aufbau();
    const { funktion } = await dienst.speichern(
      ANNA,
      { text: SATZ, art: "vorschlag" },
      quellen({}),
    );
    expect(funktion).toMatchObject({ art: "vorschlag", stand: "vorschlag" });
    await expect(dienst.laufVorbereiten(ANNA, funktion.id, FALL, kontext())).rejects.toMatchObject({
      status: 409,
      grund: "nicht_aufrufbar",
    });
    await expect(
      dienst.setzeZeitauftrag(ANNA, funktion.id, { ...SERIE, rev: funktion.rev }),
    ).rejects.toMatchObject({ status: 409, grund: "nicht_aufrufbar" });

    const uebernommen = await dienst.aendere(
      ANNA,
      funktion.id,
      { rev: funktion.rev, stand: "aktiv" },
      quellen({}),
    );
    expect(uebernommen).toMatchObject({ art: "favorit", stand: "aktiv", laeufe: [] });
  });
});

describe("D5 · K05 — der manuelle Lauf liest jetzt, nicht aus dem Verlauf", () => {
  it("jeder Lauf liest die aktuelle Quellfassung und Rolle; ein entzogenes Recht bleibt verborgen", async () => {
    const { dienst, weiter } = aufbau();
    const { funktion } = await dienst.speichern(
      ANNA,
      { text: SATZ, quellen: ["ko-spez", "ko-norm"] },
      quellen({ "ko-spez": 1, "ko-norm": 4 }),
    );
    const erster = await dienst.laufVorbereiten(
      ANNA,
      funktion.id,
      { parameter: { produkt: "Faltschachtel F1", menge: "500 Stück", termin: "2026-11-30" } },
      kontext("experte", { "ko-spez": 1, "ko-norm": 4 }),
    );
    weiter(60_000);
    // Inzwischen: Spezifikation in Fassung 2, Norm nicht mehr zugänglich, Rolle herabgestuft.
    const zweiter = await dienst.laufVorbereiten(
      ANNA,
      funktion.id,
      { parameter: { produkt: "Versandkarton V7", menge: "40 Paletten", termin: "2027-01-15" } },
      kontext("viewer", { "ko-spez": 2, "ko-norm": null }),
    );
    expect(erster.lauf.quellen).toEqual([
      { koId: "ko-spez", zustand: "gelesen", fassung: 1, status: "validiert" },
      { koId: "ko-norm", zustand: "gelesen", fassung: 4, status: "validiert" },
    ]);
    expect(zweiter.lauf.quellen).toEqual([
      { koId: "ko-spez", zustand: "gelesen", fassung: 2, status: "validiert" },
      { koId: "ko-norm", zustand: "nicht_zugaenglich", fassung: null, status: null },
    ]);
    expect(erster.lauf.rechte.rolle).toBe("experte");
    expect(zweiter.lauf.rechte.rolle).toBe("viewer");
    // Die Parameter des ersten Laufs reisen nicht in den zweiten und nicht in den Vertrag.
    expect(zweiter.lauf.parameterwerte).toEqual({
      produkt: "Versandkarton V7",
      menge: "40 Paletten",
      termin: "2027-01-15",
    });
    expect(JSON.stringify(zweiter.funktion.fassungen)).not.toContain("Faltschachtel F1");
    expect(zweiter.lauf.aussenwirkung).toBe("keine");
  });

  it("eine fehlende Pflichtangabe hält an und wird gezielt benannt — nichts wird ergänzt", async () => {
    const { dienst, repo } = aufbau();
    const { funktion } = await dienst.speichern(ANNA, { text: SATZ }, quellen({}));
    await dienst.laufVorbereiten(ANNA, funktion.id, FALL, kontext());
    const ohneMenge = { parameter: { produkt: "Karton B" } };
    await expect(
      dienst.laufVorbereiten(ANNA, funktion.id, ohneMenge, kontext()),
    ).rejects.toMatchObject({ status: 400, grund: "angabe_fehlt", fehlend: ["menge", "termin"] });
    const [f] = await repo.eigene(ANNA);
    expect(f?.laeufe).toHaveLength(1);
  });
});

describe("D6 · K06 — Serie ab Datum mit den Zeitzonenregeln der Laufzeit, ohne Wecker", () => {
  it("Sommerzeit-Lücke: 02:30 wird 03:30; Winterzeit-Doppelung: nur das erste Vorkommen", () => {
    expect(ortszeitZuUtc("2027-03-28", "02:30", "Europe/Berlin")).toEqual({
      utcMs: Date.parse("2027-03-28T01:30:00.000Z"),
      hinweis: "sommerzeit_verschoben",
    });
    expect(ortszeitZuUtc("2026-10-25", "02:30", "Europe/Berlin")).toEqual({
      utcMs: Date.parse("2026-10-25T00:30:00.000Z"),
      hinweis: "winterzeit_doppelt",
    });
    expect(ortszeitZuUtc("2026-07-01", "08:00", "Europe/Berlin").utcMs).toBe(
      Date.parse("2026-07-01T06:00:00.000Z"),
    );
    expect(ortszeitZuUtc("2026-11-02", "08:00", "Europe/Berlin").utcMs).toBe(
      Date.parse("2026-11-02T07:00:00.000Z"),
    );
  });

  it("wöchentlich über die Umstellung, monatlich mit Monatsende, mit Ende und ab jetzt", () => {
    const woechentlich = serie({
      rhythmus: "woechentlich",
      beginn: "2027-03-21",
      ende: "2027-04-04",
      uhrzeit: "02:30",
    });
    const woche = naechsteTermine(woechentlich, Date.parse(JETZT));
    expect(woche.map((t) => [t.datum, t.zeitpunkt, t.hinweis])).toEqual([
      ["2027-03-21", "2027-03-21T01:30:00.000Z", null],
      ["2027-03-28", "2027-03-28T01:30:00.000Z", "sommerzeit_verschoben"],
      ["2027-04-04", "2027-04-04T00:30:00.000Z", null],
    ]);

    const monat = naechsteTermine(serie({ beginn: "2026-08-31" }), Date.parse(JETZT), 5);
    // August und September liegen vor „jetzt" und erscheinen nicht.
    expect(monat.map((t) => [t.datum, t.zeitpunkt, t.hinweis])).toEqual([
      ["2026-10-31", "2026-10-31T07:00:00.000Z", null],
      ["2026-11-30", "2026-11-30T07:00:00.000Z", "monatsende"],
      ["2026-12-31", "2026-12-31T07:00:00.000Z", null],
      ["2027-01-31", "2027-01-31T07:00:00.000Z", null],
      ["2027-02-28", "2027-02-28T07:00:00.000Z", "monatsende"],
    ]);
  });

  it("nur ausdrücklich eingerichtet, gespeichert mit Ausführung offen — und ohne Lauf", async () => {
    const { dienst } = aufbau();
    const { funktion } = await dienst.speichern(ANNA, { text: SATZ }, quellen({}));
    const rev = funktion.rev;
    const mars = { ...SERIE, rev, zeitzone: "Mars/Olymp" };
    await expect(dienst.setzeZeitauftrag(ANNA, funktion.id, mars)).rejects.toMatchObject({
      status: 400,
    });
    const rueckwaerts = { ...SERIE, rev, ende: "2026-10-01" };
    await expect(dienst.setzeZeitauftrag(ANNA, funktion.id, rueckwaerts)).rejects.toMatchObject({
      status: 400,
    });
    const gesetzt = await dienst.setzeZeitauftrag(ANNA, funktion.id, { ...SERIE, rev });
    expect(gesetzt.funktion.zeitauftrag).toMatchObject({
      zeitzone: "Europe/Berlin",
      nachholen: "einmal",
      ausfuehrung: "vorbereitung",
    });
    expect(gesetzt.vorschau[0]).toEqual({
      datum: "2026-11-01",
      zeitpunkt: "2026-11-01T07:00:00.000Z",
      hinweis: null,
    });
    expect(gesetzt.funktion.laeufe).toEqual([]);
    const ohne = await dienst.entferneZeitauftrag(ANNA, funktion.id, gesetzt.funktion.rev);
    expect(ohne.zeitauftrag).toBeNull();
  });
});

describe("D7 · K07 — ändern, pausieren, deaktivieren; alte Ergebnisse bleiben unterscheidbar", () => {
  it("eine Änderung ist eine neue Fassung; Läufe behalten ihre Fassung", async () => {
    const { dienst } = aufbau();
    const { funktion } = await dienst.speichern(ANNA, { text: SATZ }, quellen({}));
    const lauf1 = await dienst.laufVorbereiten(ANNA, funktion.id, FALL, kontext());
    const geaendert = await dienst.aendere(
      ANNA,
      funktion.id,
      { rev: lauf1.funktion.rev, name: "Verpackungsangebote", zweck: "Angebote für Kartons." },
      quellen({}),
    );
    expect(geaendert.fassungen.map((v) => [v.version, v.name])).toEqual([
      [1, "Angebote für Verpackung einholen"],
      [2, "Verpackungsangebote"],
    ]);
    const zweiterFall = {
      parameter: { produkt: "Etikett E2", menge: "2000 Stück", termin: "2026-12-15" },
    };
    const lauf2 = await dienst.laufVorbereiten(ANNA, funktion.id, zweiterFall, kontext());
    expect(lauf2.funktion.laeufe.map((l) => [l.fassung, l.parameterwerte.produkt])).toEqual([
      [1, "Karton A"],
      [2, "Etikett E2"],
    ]);
  });

  it("pausiert und deaktiviert lassen keinen Lauf zu; fortsetzen und reaktivieren schon", async () => {
    const { dienst } = aufbau();
    const { funktion } = await dienst.speichern(ANNA, { text: SATZ }, quellen({}));
    const id = funktion.id;
    const pausiert = await dienst.aendere(ANNA, id, { rev: 1, stand: "pausiert" }, quellen({}));
    expect(pausiert.fassungen).toHaveLength(1);
    await expect(dienst.laufVorbereiten(ANNA, id, FALL, kontext())).rejects.toMatchObject({
      status: 409,
      grund: "nicht_aufrufbar",
    });
    const aus = await dienst.aendere(ANNA, id, { rev: 2, stand: "deaktiviert" }, quellen({}));
    expect(aus.stand).toBe("deaktiviert");
    await expect(dienst.laufVorbereiten(ANNA, id, FALL, kontext())).rejects.toMatchObject({
      status: 409,
    });
    await dienst.aendere(ANNA, id, { rev: 3, stand: "aktiv" }, quellen({}));
    expect((await dienst.laufVorbereiten(ANNA, id, FALL, kontext())).lauf.fassung).toBe(1);
  });

  it("veraltete Marke ist ein Konflikt; unzulässiger Wechsel ist abgelehnt; fremdes Konto sieht 404", async () => {
    const { dienst } = aufbau();
    const { funktion } = await dienst.speichern(ANNA, { text: SATZ }, quellen({}));
    const id = funktion.id;
    await dienst.aendere(ANNA, id, { rev: 1, stand: "pausiert" }, quellen({}));
    await expect(
      dienst.aendere(ANNA, id, { rev: 1, stand: "deaktiviert" }, quellen({})),
    ).rejects.toMatchObject({ status: 409, grund: "konflikt" });
    await expect(
      dienst.aendere(ANNA, id, { rev: 2, stand: "vorschlag" }, quellen({})),
    ).rejects.toMatchObject({ status: 400 });
    await expect(dienst.hole(BERT, id)).rejects.toMatchObject({ status: 404 });
    expect(await dienst.eigene(BERT)).toEqual([]);
  });
});

describe("D8 · K08 — offene Fähigkeit konkret, kein simulierter ausführbarer Favorit", () => {
  it("heute fehlen Auftragsführung, Angebotsvergleich und Postfach; der Lauf nennt genau sie", async () => {
    const { dienst } = aufbau();
    expect(dienst.offeneFaehigkeiten().map((f) => f.id)).toEqual(["BES-02", "BES-06", "postfach"]);
    for (const f of dienst.offeneFaehigkeiten()) {
      expect(f.grund.length).toBeGreaterThan(10);
    }
    const spez = { "ko-spez": 1 };
    const eingabe = { text: SATZ, quellen: ["ko-spez"] };
    const { funktion } = await dienst.speichern(ANNA, eingabe, quellen(spez));
    const { lauf } = await dienst.laufVorbereiten(
      ANNA,
      funktion.id,
      FALL,
      kontext("experte", spez),
    );
    expect(lauf).toMatchObject({
      stand: "wartet_auf_faehigkeit",
      klaerung: [],
      offen: ["BES-02", "BES-06", "postfach"],
      aussenwirkung: "keine",
    });
  });

  it("KALIBRIERUNG: erst wenn jede Fähigkeit erfüllt ist, ist nichts mehr offen", () => {
    const alle = BESCHAFFUNG_FAEHIGKEITEN.map((f) => ({ ...f, erfuellt: true }));
    const dienst = new FunktionenDienst({ repo: new InMemoryFunktionenRepo(), faehigkeiten: alle });
    expect(dienst.offeneFaehigkeiten()).toEqual([]);
  });
});

// ------------------------------------------------------------------------------------------------
// NACHARBEIT 3 (Ben) — Klärungsbedarf statt stiller Fähigkeitsliste; „so wie eben" mit Vorgang.
// ------------------------------------------------------------------------------------------------

describe("D9 · K05/R07 — fehlende oder unzugängliche Quellen sind gezielter Handlungsbedarf", () => {
  it("ohne jede Quelle hält der Lauf mit `keine_quelle` an — vor den Fähigkeiten", async () => {
    const { dienst } = aufbau();
    const { funktion } = await dienst.speichern(ANNA, { text: SATZ }, quellen({}));
    const { lauf } = await dienst.laufVorbereiten(ANNA, funktion.id, FALL, kontext());
    expect(lauf.stand).toBe("klaerung_noetig");
    expect(lauf.klaerung).toEqual([expect.objectContaining({ art: "keine_quelle", koId: null })]);
    expect(lauf.klaerung[0]?.hinweis).toContain("Bearbeiten");
    expect(lauf.aussenwirkung).toBe("keine");
  });

  it("gelöscht, nicht zugänglich und nicht erreichbar werden unterschieden, je mit Hinweis", async () => {
    const { dienst } = aufbau();
    const alle = ["ko-ok", "ko-papierkorb", "ko-entzogen", "ko-ausfall"];
    const anfangs = { "ko-ok": 1, "ko-papierkorb": 1, "ko-entzogen": 1, "ko-ausfall": 1 };
    const { funktion } = await dienst.speichern(
      ANNA,
      { text: SATZ, quellen: alle },
      quellen(anfangs),
    );
    const jetzt: QuelleLesen = async (koId) => {
      if (koId === "ko-ok") {
        return { fassung: 2, status: "validiert" };
      }
      if (koId === "ko-papierkorb") {
        return "geloescht";
      }
      if (koId === "ko-ausfall") {
        throw new Error("Datenbank nicht erreichbar");
      }
      return null;
    };
    const { lauf } = await dienst.laufVorbereiten(ANNA, funktion.id, FALL, {
      rolle: "experte",
      quelleLesen: jetzt,
    });
    expect(lauf.quellen.map((q) => [q.koId, q.zustand])).toEqual([
      ["ko-ok", "gelesen"],
      ["ko-papierkorb", "geloescht"],
      ["ko-entzogen", "nicht_zugaenglich"],
      ["ko-ausfall", "nicht_erreichbar"],
    ]);
    expect(lauf.stand).toBe("klaerung_noetig");
    expect(lauf.klaerung.map((k) => [k.art, k.koId])).toEqual([
      ["quelle_geloescht", "ko-papierkorb"],
      ["quelle_nicht_zugaenglich", "ko-entzogen"],
      ["quelle_nicht_erreichbar", "ko-ausfall"],
    ]);
    for (const k of lauf.klaerung) {
      expect(k.hinweis.length, k.art).toBeGreaterThan(20);
    }
  });
});

function nachricht(
  von: "du" | "klara",
  text: string,
  koId?: string,
  id = `n-${text.length}-${koId ?? "ohne"}`,
  antwortQuellen: string[] = ["ko-norm", "ko-geheim"],
): KlaraNachricht {
  const ort = { pfad: "/bibliothek", seitenName: "Bibliothek", objekt: "Artikel" };
  return {
    id,
    von,
    modus: von === "du" ? "frage" : "ohne_ki",
    text,
    objektbezug: koId ? { ...ort, koId } : ort,
    antwortId: von === "du" ? null : "antwort-1",
    quellen: von === "du" ? [] : antwortQuellen,
    wissensklasse: null,
    grund: null,
    angelegtAm: JETZT,
  };
}

function gespraech(kontoId: string, id: string, nachrichten: KlaraNachricht[]): KlaraGespraech {
  return {
    id,
    kontoId,
    objektbezug: {
      pfad: "/bibliothek",
      seitenName: "Bibliothek",
      objekt: "Start",
      koId: "ko-spez",
    },
    nachrichten,
    letzterSchritt: null,
    einwilligungAm: JETZT,
    angelegtAm: JETZT,
    geaendertAm: JETZT,
    fassung: 3,
  };
}

/** Die Bindung einer Vorschau, wie die Oberfläche sie beim Speichern zurückschickt. */
function gebunden(v: FunktionsVorbereitung) {
  return {
    gespraech: v.bindung?.gespraechId,
    gespraechFassung: v.bindung?.gespraechFassung,
    abschnitt: v.bindung?.abschnitt,
    vorschauQuellen: [...v.quellen],
    vorschauName: v.entwurf.name,
    vorschauAusgangstext: v.entwurf.ausgangstext,
  };
}

describe("D10 · K01/K05 — „So wie eben speichern“ übernimmt Vorgang und berechtigte Quellen", () => {
  const FRAGE =
    "Bitte hole Angebote für Faltschachteln FS-12 ein, diesmal 500 Stück bis 30.11.2026.";

  async function mitGespraech() {
    const ablage = new InMemoryKlaraGespraechRepo();
    await ablage.lege(
      gespraech(ANNA, "g-anna", [
        nachricht("du", FRAGE, "ko-spez"),
        nachricht("klara", "Gefunden: Spezifikation und Norm."),
      ]),
    );
    await ablage.lege(gespraech(BERT, "g-bert", [nachricht("du", FRAGE)]));
    return { ablage, ...aufbau(ablage) };
  }

  const sicht = quellen({ "ko-spez": 1, "ko-norm": 4, "ko-geheim": null });

  it("ohne Vorgang wird der Übernahmesatz gezielt abgewiesen, nicht geraten", async () => {
    const { dienst } = await mitGespraech();
    const ohne = dienst.speichern(ANNA, { text: "So wie eben speichern." }, sicht);
    await expect(ohne).rejects.toMatchObject({ status: 400, grund: "kontext_fehlt" });
    expect(await dienst.eigene(ANNA)).toEqual([]);
  });

  it("mit Vorgang: Ablauf aus der eigenen Frage, nur sichtbare Quellen, Herkunft als Kennung", async () => {
    const { dienst, repo } = await mitGespraech();
    const eingabe = { text: "So wie eben speichern.", gespraech: "letztes" };
    const gesehen = await dienst.entwurf(ANNA, eingabe, sicht);
    expect(gesehen.quellen).toEqual(["ko-spez", "ko-norm"]);
    expect(gesehen.nichtUebernommen).toBe(1);
    expect(await repo.eigene(ANNA)).toEqual([]);

    // Nacharbeit 4: „letztes" löst nur die Vorschau auf; gespeichert wird mit ihrer Bindung.
    await expect(dienst.speichern(ANNA, eingabe, sicht)).rejects.toMatchObject({
      status: 400,
      grund: "vorschau_fehlt",
    });
    const mitBindung = { text: eingabe.text, ...gebunden(gesehen) };
    const { funktion, nichtUebernommen } = await dienst.speichern(ANNA, mitBindung, sicht);
    const v = aktuelleFassung(funktion);
    expect(v.name).toBe("Angebote für Faltschachteln FS-12 einholen");
    expect(v.quellen).toEqual(["ko-spez", "ko-norm"]);
    expect(v.herkunft).toEqual({
      art: "assistenzgespraech",
      gespraechId: "g-anna",
      gespraechFassung: 3,
      abschnitt: gesehen.bindung?.abschnitt,
    });
    expect(nichtUebernommen).toBe(1);
    // Keine Testwerte aus der Frage, keine verborgene Quelle in der gespeicherten Zeile.
    const roh = JSON.stringify(await repo.eigene(ANNA));
    for (const wert of ["500", "30.11.2026", "ko-geheim", "Gefunden"]) {
      expect(roh, wert).not.toContain(wert);
    }

    // Die Bindung trägt bis zum nächsten manuellen Aufruf: der Lauf liest genau diese Quellen neu.
    const neu = quellen({ "ko-spez": 2, "ko-norm": 4 });
    const { lauf } = await dienst.laufVorbereiten(ANNA, funktion.id, FALL, {
      rolle: "experte",
      quelleLesen: neu,
    });
    expect(lauf.quellen.map((q) => [q.koId, q.fassung])).toEqual([
      ["ko-spez", 2],
      ["ko-norm", 4],
    ]);
    expect(lauf.stand).toBe("wartet_auf_faehigkeit");
  });

  it("ein fremdes oder unbekanntes Gespräch ist kein Vorgang (404)", async () => {
    const { dienst } = await mitGespraech();
    const fremd = { text: "So wie eben speichern.", gespraech: "g-bert" };
    await expect(dienst.entwurf(ANNA, fremd, sicht)).rejects.toMatchObject({
      status: 404,
      grund: "gespraech_unbekannt",
    });
    const ohneAblage = aufbau().dienst;
    const eingabe = { text: "So wie eben speichern.", gespraech: "letztes" };
    await expect(ohneAblage.entwurf(ANNA, eingabe, sicht)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("Bearbeiten: Quelle entfernen und aus dem Gespräch ergänzen ergibt neue Fassungen", async () => {
    const { dienst } = await mitGespraech();
    const vorschau = await dienst.entwurf(ANNA, { text: SATZ, gespraech: "letztes" }, sicht);
    const eingabe = { text: SATZ, ...gebunden(vorschau) };
    const { funktion } = await dienst.speichern(ANNA, eingabe, sicht);
    const ohneNorm = await dienst.aendere(
      ANNA,
      funktion.id,
      { rev: funktion.rev, quellen: ["ko-spez"] },
      sicht,
    );
    const wieder = await dienst.aendere(
      ANNA,
      funktion.id,
      { rev: ohneNorm.rev, gespraech: "letztes" },
      sicht,
    );
    expect(wieder.fassungen.map((v) => v.quellen)).toEqual([
      ["ko-spez", "ko-norm"],
      ["ko-spez"],
      ["ko-spez", "ko-norm"],
    ]);
  });
});

// ------------------------------------------------------------------------------------------------
// NACHARBEIT 4 (Ben) — ein Fall statt des ganzen Gesprächs; die Vorschau bindet bis zum Speichern.
// ------------------------------------------------------------------------------------------------

describe("D11 · K01/K03 — zwei Beschaffungsfälle im Gespräch, getrennte Quellen, gebundene Vorschau", () => {
  const FALL_ALT = "Bitte hole Angebote für Faltschachteln FS-12 ein.";
  const FALL_NEU = "Und jetzt bitte Angebote für Etiketten E7 anfragen.";
  const sichtAlle = quellen({
    "ko-spez": 1,
    "ko-alt": 1,
    "ko-alt-norm": 1,
    "ko-neu": 1,
    "ko-neu-norm": 1,
  });

  function zweiFaelle(fassung = 6, extra: KlaraNachricht[] = []): KlaraGespraech {
    return {
      ...gespraech(ANNA, "g-zwei", [
        nachricht("du", FALL_ALT, "ko-alt", "fall-1"),
        nachricht("klara", "Spezifikation gefunden.", undefined, "a-1", ["ko-alt-norm"]),
        nachricht("du", FALL_NEU, "ko-neu", "fall-2"),
        nachricht("klara", "Etikettennorm gefunden.", undefined, "a-2", ["ko-neu-norm"]),
        ...extra,
      ]),
      fassung,
    };
  }

  async function aufbauZwei() {
    const ablage = new InMemoryKlaraGespraechRepo();
    await ablage.lege(zweiFaelle());
    return { ablage, ...aufbau(ablage) };
  }

  const so = { text: "So wie eben speichern.", gespraech: "letztes" };

  it("ohne Wahl ist der Vorgang mehrdeutig — beide Fälle stehen zur Auswahl, nichts wird vermischt", async () => {
    const { dienst } = await aufbauZwei();
    await expect(dienst.entwurf(ANNA, so, sichtAlle)).rejects.toMatchObject({
      status: 409,
      grund: "vorgang_mehrdeutig",
      abschnitte: [
        expect.objectContaining({ abschnitt: "fall-1", text: FALL_ALT }),
        expect.objectContaining({ abschnitt: "fall-2", text: FALL_NEU }),
      ],
    });
  });

  it("jeder gewählte Fall bringt nur SEINEN Ablauf und SEINE Quellen", async () => {
    const { dienst } = await aufbauZwei();
    const neu = await dienst.entwurf(ANNA, { ...so, abschnitt: "fall-2" }, sichtAlle);
    expect(neu.entwurf.name).toBe("Angebote für Etiketten E7 einholen");
    expect(neu.quellen).toEqual(["ko-neu", "ko-neu-norm"]);
    const alt = await dienst.entwurf(ANNA, { ...so, abschnitt: "fall-1" }, sichtAlle);
    expect(alt.entwurf.name).toBe("Angebote für Faltschachteln FS-12 einholen");
    expect(alt.quellen).toEqual(["ko-alt", "ko-alt-norm"]);
    // Der Objektbezug beim Gesprächsbeginn gehört zu keinem Fall.
    expect([...neu.quellen, ...alt.quellen]).not.toContain("ko-spez");

    const { funktion } = await dienst.speichern(
      ANNA,
      { text: so.text, ...gebunden(neu) },
      sichtAlle,
    );
    expect(aktuelleFassung(funktion).quellen).toEqual(["ko-neu", "ko-neu-norm"]);
    expect(aktuelleFassung(funktion).herkunft).toMatchObject({ abschnitt: "fall-2" });
    await expect(
      dienst.entwurf(ANNA, { ...so, abschnitt: "gibt-es-nicht" }, sichtAlle),
    ).rejects.toMatchObject({ status: 404, grund: "abschnitt_unbekannt" });
  });

  it("ändert sich das Gespräch zwischen Vorschau und Speichern, ist das ein Konflikt", async () => {
    const { dienst, ablage } = await aufbauZwei();
    const vorschau = await dienst.entwurf(ANNA, { ...so, abschnitt: "fall-2" }, sichtAlle);
    const nachtrag = nachricht("klara", "Noch eine Quelle.", undefined, "a-3", ["ko-alt-norm"]);
    expect(await ablage.ersetze(zweiFaelle(7, [nachtrag]))).toBe(true);
    await expect(
      dienst.speichern(ANNA, { text: so.text, ...gebunden(vorschau) }, sichtAlle),
    ).rejects.toMatchObject({ status: 409, grund: "vorgang_geaendert" });
    expect(await dienst.eigene(ANNA)).toEqual([]);
  });

  // Nacharbeit 5 (Ben): ein nach der Vorschau getippter oder diktierter Satz, der einen ANDEREN
  // Ablauf nennt, darf nicht mit der alten Bindung gespeichert werden.
  it("ein nach der Vorschau geänderter Text mit der alten Bindung ist ein Konflikt", async () => {
    const { dienst } = await aufbauZwei();
    const vorschau = await dienst.entwurf(ANNA, { ...so, abschnitt: "fall-1" }, sichtAlle);
    expect(vorschau.entwurf.name).toBe("Angebote für Faltschachteln FS-12 einholen");
    const anderer = { text: "Bitte Angebote für Paletten P3 anfragen.", ...gebunden(vorschau) };
    await expect(dienst.speichern(ANNA, anderer, sichtAlle)).rejects.toMatchObject({
      status: 409,
      grund: "vorgang_geaendert",
    });
    // Ohne die angezeigte Definition gibt es mit Vorgang gar kein Speichern.
    const b = gebunden(vorschau);
    const ohneDefinition = {
      gespraech: b.gespraech,
      gespraechFassung: b.gespraechFassung,
      abschnitt: b.abschnitt,
      vorschauQuellen: b.vorschauQuellen,
    };
    await expect(
      dienst.speichern(ANNA, { text: so.text, ...ohneDefinition }, sichtAlle),
    ).rejects.toMatchObject({ status: 400, grund: "vorschau_fehlt" });
    expect(await dienst.eigene(ANNA)).toEqual([]);
    // Gegenprobe: mit unverändertem Eingabestand wird genau die Vorschau gespeichert.
    const { funktion } = await dienst.speichern(
      ANNA,
      { text: so.text, ...gebunden(vorschau) },
      sichtAlle,
    );
    expect(aktuelleFassung(funktion).name).toBe(vorschau.entwurf.name);
  });

  it("ohne Vorgang: geänderter Text gegenüber der mitgeschickten Vorschau ist ein Konflikt", async () => {
    const { dienst } = aufbau();
    const vorschau = await dienst.entwurf(ANNA, { text: SATZ }, quellen({}));
    const geaendert = {
      text: "So möchte ich künftig Angebote für Etiketten einholen.",
      vorschauName: vorschau.entwurf.name,
      vorschauAusgangstext: vorschau.entwurf.ausgangstext,
    };
    await expect(dienst.speichern(ANNA, geaendert, quellen({}))).rejects.toMatchObject({
      status: 409,
      grund: "vorgang_geaendert",
    });
    expect(await dienst.eigene(ANNA)).toEqual([]);
  });

  it("ändern sich die Rechte an einer gezeigten Quelle, ist das ein Konflikt", async () => {
    const { dienst } = await aufbauZwei();
    const vorschau = await dienst.entwurf(ANNA, { ...so, abschnitt: "fall-2" }, sichtAlle);
    const entzogen = quellen({ "ko-neu": 1, "ko-neu-norm": null });
    await expect(
      dienst.speichern(ANNA, { text: so.text, ...gebunden(vorschau) }, entzogen),
    ).rejects.toMatchObject({ status: 409, grund: "vorgang_geaendert" });
    expect(await dienst.eigene(ANNA)).toEqual([]);
  });

  it("wechselt das letzte Gespräch, speichert die Bindung trotzdem genau die gezeigte Vorschau", async () => {
    const { dienst, ablage } = await aufbauZwei();
    const vorschau = await dienst.entwurf(ANNA, { ...so, abschnitt: "fall-1" }, sichtAlle);
    // Inzwischen beginnt ein neues Gespräch mit einem anderen Fall — es ist jetzt das „letzte".
    await ablage.lege({
      ...gespraech(ANNA, "g-danach", [nachricht("du", FALL_NEU, "ko-neu", "fall-x")]),
      geaendertAm: "2026-10-11T09:00:00.000Z",
    });
    const jetzt = await dienst.entwurf(ANNA, so, sichtAlle);
    expect(jetzt.bindung?.gespraechId).toBe("g-danach");

    const { funktion } = await dienst.speichern(
      ANNA,
      { text: so.text, ...gebunden(vorschau) },
      sichtAlle,
    );
    const v = aktuelleFassung(funktion);
    expect(v.herkunft).toMatchObject({ gespraechId: "g-zwei", abschnitt: "fall-1" });
    expect(v.name).toBe(vorschau.entwurf.name);
    expect(v.quellen).toEqual(vorschau.quellen);
  });
});
