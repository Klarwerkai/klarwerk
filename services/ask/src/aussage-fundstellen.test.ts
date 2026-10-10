// produkt:20261009:referenzki-quellenbelege (REF-01) — Aussage → Quellenversion → Passage.
// Alle Inhalte sind fiktiv (Ventil F3, Pumpe P7, Fiktivmetall); keine Kundendaten.
import { describe, expect, it } from "vitest";
import {
  type AufloesbaresObjekt,
  type BindungsQuelle,
  type FundstellenLeser,
  type FundstellenVerweis,
  type InterneFundstelle,
  type ObjektFassung,
  aufKernaussagenBeschraenkt,
  bestaetigungGilt,
  bindeAussagen,
  fingerabdruck,
  leseFundstellenAnfrage,
  loeseFundstelleAuf,
  pruefPaket,
  volltextDerFassung,
} from "./aussage-fundstellen";

const VENTIL_TEXT =
  "Am Ventil F3 gilt eine Höchsttemperatur von 80 °C. Bei Dauerbetrieb gilt 70 °C.";

const VENTIL: BindungsQuelle = {
  id: "ko-ventil",
  version: 4,
  originalAuthor: "autorin-fiktiv",
  statement: VENTIL_TEXT,
};

const PUMPE: BindungsQuelle = {
  id: "ko-pumpe",
  version: 2,
  originalAuthor: "autor-fiktiv",
  statement: "Die Pumpe P7 vor dem Start vollständig entlüften.",
  bodyText: "Einleitung zur Pumpe. Das Entlüftungsventil der Pumpe P7 sitzt oben links.",
};

const FIKTIVMETALL: BindungsQuelle = {
  id: "ko-metall",
  version: 1,
  originalAuthor: "autor-fiktiv",
  statement: "Zum Fiktivmetall gibt es eine gespeicherte Lexikonquelle.",
  sources: [
    {
      id: "q-lexikon",
      url: "https://de.wikipedia.org/wiki/Fiktivmetall",
      excerpt: "Fiktivmetall ist erfunden. Fiktivmetall schmilzt bei 1234 °C.",
      provider: "Wikipedia",
      at: "2026-10-01T08:00:00.000Z",
    },
    {
      id: "q-nur-link",
      url: "https://example.invalid/fiktivmetall",
      excerpt: null,
      at: "2026-10-02T08:00:00.000Z",
    },
  ],
};

function quellen(...qs: BindungsQuelle[]): ReadonlyMap<string, BindungsQuelle> {
  return new Map(qs.map((q) => [q.id, q]));
}

function binde(antwort: string, sources: string[], qs: BindungsQuelle[]) {
  return bindeAussagen({
    antwort,
    sources,
    citedSources: sources,
    quellen: quellen(...qs),
  });
}

describe("REF-01 · Aussage → Quellenversion → Passage", () => {
  it("K1/K2 · passende Fundstelle: Objekt, Fassung, Textbereich, Auszug, Fingerabdruck, Link", () => {
    const beleg = binde("Am Ventil F3 gilt höchstens 80 °C. [1]", ["ko-ventil"], [VENTIL]);
    expect(beleg.aussagen).toHaveLength(1);
    const aussage = beleg.aussagen[0]!;
    expect(aussage.aussageId).toMatch(/^aus_[0-9a-f]{16}$/);
    expect(aussage.deckung).toBe("belegt");
    expect(beleg.fehlendeDeckung).toEqual([]);
    const fs = aussage.teile[0]!.fundstellen[0] as InterneFundstelle;
    const erwartet = "Am Ventil F3 gilt eine Höchsttemperatur von 80 °C.";
    expect(fs).toMatchObject({
      art: "intern",
      koId: "ko-ventil",
      koVersion: 4,
      feld: "statement",
      start: 0,
      ende: erwartet.length,
      auszug: erwartet,
      fingerabdruck: fingerabdruck(erwartet),
      kontextNach: "Bei Dauerbetrieb gilt 70 °C.",
      originalAutor: "autorin-fiktiv",
      // Der bedienbare Link trägt die Belegstelle in derselben Form wie der Quellenchip.
      link: `/wissen/ko-ventil?${new URLSearchParams({ stelle: erwartet, fassung: "4" })}`,
      zuordnung: "marke",
      wortbezug: true,
      unterstuetzung: "nicht_bewertet",
    });
    expect(VENTIL_TEXT.slice(fs.start, fs.ende)).toBe(fs.auszug);
    expect(fs.fingerabdruck).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("K1 · Aussagekennung ist stabil; anderer Inhalt ergibt andere Kennung und anderen Beleg", () => {
    const a = binde("Am Ventil F3 gilt höchstens 80 °C. [1]", ["ko-ventil"], [VENTIL]);
    const b = binde("Am Ventil F3 gilt höchstens 80 °C. [1]", ["ko-ventil"], [VENTIL]);
    const c = binde("Am Ventil F3 gilt höchstens 70 °C. [1]", ["ko-ventil"], [VENTIL]);
    expect(b.aussagen[0]!.aussageId).toBe(a.aussagen[0]!.aussageId);
    expect(b.belegFingerabdruck).toBe(a.belegFingerabdruck);
    expect(c.aussagen[0]!.aussageId).not.toBe(a.aussagen[0]!.aussageId);
    expect(c.belegFingerabdruck).not.toBe(a.belegFingerabdruck);
    // Eine neue Fassung derselben Quelle ändert den Beleg ebenfalls — keine geerbte Bindung.
    const neu = { ...VENTIL, version: 5 };
    const d = binde("Am Ventil F3 gilt höchstens 80 °C. [1]", ["ko-ventil"], [neu]);
    expect(d.belegFingerabdruck).not.toBe(a.belegFingerabdruck);
  });

  it("K1 · fehlende Deckung wird ausdrücklich ausgewiesen, Fragen sind keine Behauptung", () => {
    const beleg = binde(
      "Am Ventil F3 gilt höchstens 80 °C. [1]\n\nDie Kühlschmierung Typ Z wechselt jährlich. Soll ich mehr dazu sagen?",
      ["ko-ventil"],
      [VENTIL],
    );
    expect(beleg.aussagen.map((a) => a.text)).toEqual([
      "Am Ventil F3 gilt höchstens 80 °C.",
      "Die Kühlschmierung Typ Z wechselt jährlich.",
    ]);
    const unbelegt = beleg.aussagen[1]!;
    expect(unbelegt.deckung).toBe("unbelegt");
    expect(unbelegt.teile[0]).toMatchObject({ deckung: "keine_fundstelle", fundstellen: [] });
    expect(beleg.fehlendeDeckung).toEqual([unbelegt.aussageId]);
  });

  it("K3/K8 · erfundene Fundstellen: Modell-Link und Marke ohne Quelle sind kein Beleg", () => {
    const beleg = binde(
      "Laut https://example.invalid/norm-4711 gilt für das Druckventil D9 ein Prüfintervall von 6 Monaten. [7]",
      ["ko-ventil"],
      [VENTIL],
    );
    const aussage = beleg.aussagen[0]!;
    expect(aussage.modellangaben).toEqual([
      { art: "marke", wert: "[7]", zustand: "nicht_aufgeloest" },
      { art: "link", wert: "https://example.invalid/norm-4711", zustand: "nicht_aufgeloest" },
    ]);
    expect(aussage.deckung).toBe("unbelegt");
    expect(aussage.teile.flatMap((t) => t.fundstellen)).toEqual([]);
    const paket = pruefPaket(beleg, { modell: "referenz-fiktiv", oeffentlich: false }, () => true);
    expect(paket.posten.map((p) => p.zustand)).toEqual(["unbelegt"]);
    expect(JSON.stringify(paket)).not.toContain("example.invalid");
  });

  it("K8 · eine Zahl, die die Quelle nicht trägt, findet keine Passage über Wortbezug", () => {
    // Ohne eigene Marke gibt es keinen Rückfall — die Aussage bleibt unbelegt, statt an „80 °C" zu hängen.
    const beleg = binde("Am Ventil F3 gilt höchstens 90 °C.", ["ko-ventil"], [VENTIL]);
    expect(beleg.aussagen[0]!.deckung).toBe("unbelegt");
  });

  it("K6 · Übersetzung: die eigene Marke bindet nachvollziehbar, ausdrücklich ohne Wortbezug", () => {
    const beleg = binde("Valve F3 allows at most 80 °C. [1]", ["ko-ventil"], [VENTIL]);
    const fs = beleg.aussagen[0]!.teile[0]!.fundstellen[0] as InterneFundstelle;
    expect(fs).toMatchObject({
      koId: "ko-ventil",
      koVersion: 4,
      zuordnung: "marke",
      wortbezug: false,
      start: 0,
      ende: VENTIL_TEXT.length,
    });
  });

  it("K6 · zusammengesetzte Aussage: die Passage des einen Teils belegt den anderen nicht", () => {
    const beleg = binde(
      "Die Pumpe P7 vor dem Start entlüften und das Druckventil D9 sofort schließen. [1]",
      ["ko-pumpe"],
      [PUMPE],
    );
    const aussage = beleg.aussagen[0]!;
    expect(aussage.teile.map((t) => t.text)).toEqual([
      "Die Pumpe P7 vor dem Start entlüften",
      "das Druckventil D9 sofort schließen.",
    ]);
    expect(aussage.teile[0]!.deckung).toBe("fundstelle");
    expect(aussage.teile[1]).toMatchObject({ deckung: "keine_fundstelle", fundstellen: [] });
    expect(aussage.deckung).toBe("teilweise");
    expect(aussage.teile[1]!.teilId).toBe(`${aussage.aussageId}.t2`);
  });

  it("K2 · Volltextpassage trägt das Feld und den Bereich im Volltext", () => {
    const satz = "Das Entlüftungsventil der Pumpe P7 sitzt oben links.";
    const beleg = binde(satz, ["ko-pumpe"], [PUMPE]);
    const fs = beleg.aussagen[0]!.teile[0]!.fundstellen[0] as InterneFundstelle;
    expect(fs.feld).toBe("bodyText");
    expect(fs.zuordnung).toBe("tragende_quelle");
    expect(PUMPE.bodyText!.slice(fs.start, fs.ende)).toBe(satz);
    expect(fs.kontextVor).toBe("Einleitung zur Pumpe.");
  });

  it("K2/K3 · externe Fundstelle: Herkunft, Speicherzeit, gespeicherter Auszug, Fingerabdruck", () => {
    const beleg = binde("Fiktivmetall schmilzt bei 1234 °C. [1]", ["ko-metall"], [FIKTIVMETALL]);
    const fundstellen = beleg.aussagen[0]!.teile[0]!.fundstellen;
    const extern = fundstellen.filter((f) => f.art === "extern");
    expect(extern).toHaveLength(1);
    expect(extern[0]).toMatchObject({
      art: "extern",
      koId: "ko-metall",
      koVersion: 1,
      quelleId: "q-lexikon",
      herkunft: "https://de.wikipedia.org/wiki/Fiktivmetall",
      anbieter: "Wikipedia",
      // Ben nacharbeit-4 (K2): der Speicherzeitpunkt ist KEIN Abruf — ohne Abrufnachweis bleibt
      // `abgerufenAm` leer, und die Fundstelle sagt, dass sie in diesem Punkt unvollständig ist.
      gespeichertAm: "2026-10-01T08:00:00.000Z",
      abgerufenAm: null,
      vollstaendigkeit: "abruf_nicht_belegt",
      quellRevision: null,
      auszug: "Fiktivmetall schmilzt bei 1234 °C.",
      fingerabdruck: fingerabdruck("Fiktivmetall schmilzt bei 1234 °C."),
      kontextVor: "Fiktivmetall ist erfunden.",
    });
    // Eine Adresse ohne gespeicherten Auszug ist kein Beleg.
    expect(JSON.stringify(fundstellen)).not.toContain("example.invalid");
  });

  it("K3 · Prüfpaket: nur aufgelöste Auszüge mit Kontext; ohne Freigabe nicht prüfbar statt Versand", () => {
    const beleg = binde("Am Ventil F3 gilt höchstens 80 °C. [1]", ["ko-ventil"], [VENTIL]);
    const intern = pruefPaket(beleg, { modell: "intern-fiktiv", oeffentlich: false }, () => false);
    expect(intern.posten[0]).toMatchObject({ zustand: "pruefbar" });
    expect(intern.posten[0]!.fundstellen[0]).toMatchObject({
      auszug: "Am Ventil F3 gilt eine Höchsttemperatur von 80 °C.",
      kontextNach: "Bei Dauerbetrieb gilt 70 °C.",
      koVersion: 4,
    });

    const oeffentlichOhne = pruefPaket(
      beleg,
      { modell: "oeffentlich-fiktiv", oeffentlich: true },
      () => false,
    );
    expect(oeffentlichOhne.posten[0]).toMatchObject({
      zustand: "nicht_pruefbar",
      grund: "keine_freigabe_externe_verarbeitung",
      fundstellen: [],
    });
    expect(JSON.stringify(oeffentlichOhne.posten)).not.toContain("Höchsttemperatur");

    const oeffentlichMit = pruefPaket(
      beleg,
      { modell: "oeffentlich-fiktiv", oeffentlich: true },
      (koId) => koId === "ko-ventil",
    );
    expect(oeffentlichMit.posten[0]!.zustand).toBe("pruefbar");
  });

  it("Prüfbeleg bindet Antwort, Quellenfassung und Prüfmodell — keine geerbte Bestätigung", () => {
    const beleg = binde("Am Ventil F3 gilt höchstens 80 °C. [1]", ["ko-ventil"], [VENTIL]);
    const paket = pruefPaket(beleg, { modell: "modell-a", oeffentlich: false }, () => true);
    const bestaetigung = { paketFingerabdruck: paket.paketFingerabdruck, modell: "modell-a" };
    expect(bestaetigungGilt(bestaetigung, paket)).toBe(true);

    const anderesModell = pruefPaket(beleg, { modell: "modell-b", oeffentlich: false }, () => true);
    expect(bestaetigungGilt(bestaetigung, anderesModell)).toBe(false);

    const neueFassung = pruefPaket(
      binde("Am Ventil F3 gilt höchstens 80 °C. [1]", ["ko-ventil"], [{ ...VENTIL, version: 5 }]),
      { modell: "modell-a", oeffentlich: false },
      () => true,
    );
    expect(bestaetigungGilt(bestaetigung, neueFassung)).toBe(false);

    const andereAntwort = pruefPaket(
      binde("Am Ventil F3 gilt höchstens 80 °C laut Plan. [1]", ["ko-ventil"], [VENTIL]),
      { modell: "modell-a", oeffentlich: false },
      () => true,
    );
    expect(bestaetigungGilt(bestaetigung, andereAntwort)).toBe(false);
  });

  it("enger Zuschnitt (Add-on): nur Kernaussagen, Deckung ehrlich neu gerechnet", () => {
    const beleg = binde(
      "Die Pumpe P7 vor dem Start vollständig entlüften.\n\nDas Entlüftungsventil der Pumpe P7 sitzt oben links.",
      ["ko-pumpe"],
      [PUMPE],
    );
    expect(beleg.aussagen.map((a) => a.deckung)).toEqual(["belegt", "belegt"]);
    const eng = aufKernaussagenBeschraenkt(beleg);
    expect(eng.aussagen.map((a) => a.deckung)).toEqual(["belegt", "unbelegt"]);
    expect(eng.fehlendeDeckung).toEqual([beleg.aussagen[1]!.aussageId]);
    const uebrig = eng.aussagen.flatMap((a) => a.teile.flatMap((t) => t.fundstellen));
    expect(uebrig.every((f) => f.art === "intern" && f.feld === "statement")).toBe(true);
    // Der Add-on-Weg erfährt keine Personenkennung.
    expect(uebrig.map((f) => (f.art === "intern" ? f.originalAutor : "extern"))).toEqual([null]);
    expect(JSON.stringify(eng)).not.toContain("autor-fiktiv");
    expect(JSON.stringify(uebrig)).not.toContain("Einleitung zur Pumpe");
    expect(eng.belegFingerabdruck).not.toBe(beleg.belegFingerabdruck);
  });

  // ----------------------------------------------------------------------------------------------
  // Ben nacharbeit-4 — die Gegenfälle zu den belegten Befunden.
  // ----------------------------------------------------------------------------------------------

  it("K1 · kurze Aussagen und Kürzel verschwinden nicht: Kennung und ausgewiesene Deckungslücke", () => {
    const ohneQuelle = binde("QX ist gesperrt.", ["ko-ventil"], [VENTIL]);
    expect(ohneQuelle.aussagen.map((a) => a.text)).toEqual(["QX ist gesperrt."]);
    const aussage = ohneQuelle.aussagen[0]!;
    expect(aussage.aussageId).toMatch(/^aus_[0-9a-f]{16}$/);
    expect(aussage.deckung).toBe("unbelegt");
    expect(ohneQuelle.fehlendeDeckung).toEqual([aussage.aussageId]);

    // Gegenprobe: das Kürzel ist Inhalt — die passende Stelle wird über „QX" gefunden.
    const sperre: BindungsQuelle = {
      id: "ko-sperre",
      version: 3,
      originalAuthor: "autor-fiktiv",
      statement: "Die Anlage QX ist seit Montag gesperrt.",
    };
    const mitQuelle = binde("QX ist gesperrt.", ["ko-sperre"], [sperre]);
    expect(mitQuelle.aussagen[0]!.deckung).toBe("belegt");
    expect(mitQuelle.aussagen[0]!.teile[0]!.fundstellen[0]!.auszug).toBe(sperre.statement);
  });

  it("K6 · ein kurzes zusätzliches Prädikat ist eine eigene Teilbehauptung", () => {
    const zu: BindungsQuelle = {
      id: "ko-zu",
      version: 1,
      originalAuthor: "autor-fiktiv",
      statement: "Das Ventil F3 ist geschlossen.",
    };
    const beleg = binde("Das Ventil F3 ist geschlossen und dicht. [1]", ["ko-zu"], [zu]);
    const aussage = beleg.aussagen[0]!;
    expect(aussage.teile.map((t) => t.text)).toEqual(["Das Ventil F3 ist geschlossen", "dicht."]);
    expect(aussage.teile.map((t) => t.deckung)).toEqual(["fundstelle", "keine_fundstelle"]);
    expect(aussage.deckung).toBe("teilweise");
    expect(beleg.fehlendeDeckung).toEqual([aussage.aussageId]);
  });

  it("K1 · Wörterbuchergänzungen sind Teil der gebundenen Antwort — ohne Fundstelle ausgewiesen", () => {
    const kern = "Die Pumpe P7 vor dem Start vollständig entlüften.";
    const woerterbuch = (definition: string) =>
      `${kern}\n\nBegriffe (aus dem Firmenwörterbuch, nicht Teil der Quellenbilanz):\n- Entlüften: ${definition} [Wörterbucheintrag wb-1, Fassung 2]`;
    const vorher = woerterbuch("Luft aus dem Kreislauf ablassen.");
    const beleg = binde(vorher, ["ko-pumpe"], [PUMPE]);
    // Die Überschrift ist keine Behauptung, die Herkunftsangabe des Eintrags auch nicht.
    expect(beleg.aussagen.map((a) => a.text)).toEqual([
      kern,
      "Entlüften: Luft aus dem Kreislauf ablassen.",
    ]);
    expect(beleg.aussagen.map((a) => a.deckung)).toEqual(["belegt", "unbelegt"]);
    expect(beleg.fehlendeDeckung).toEqual([beleg.aussagen[1]!.aussageId]);
    // Eine geänderte Definition ändert Antwort- und Belegfingerabdruck — kein geerbter Beleg.
    const nachher = woerterbuch("Wasser aus dem Kreislauf ablassen.");
    const geaendert = binde(nachher, ["ko-pumpe"], [PUMPE]);
    expect(geaendert.antwortFingerabdruck).not.toBe(beleg.antwortFingerabdruck);
    expect(geaendert.belegFingerabdruck).not.toBe(beleg.belegFingerabdruck);
  });

  it("K4/K5 · eine Belegstelle mit gelöschter Herkunft wird nicht mehr als Fundstelle gebunden", () => {
    const geloescht: BindungsQuelle = {
      ...FIKTIVMETALL,
      sources: (FIKTIVMETALL.sources ?? []).map((s) =>
        s.id === "q-lexikon" ? { ...s, sourceRemovedAt: "2026-10-05T08:00:00.000Z" } : s,
      ),
    };
    const beleg = binde("Fiktivmetall schmilzt bei 1234 °C. [1]", ["ko-metall"], [geloescht]);
    const fundstellen = beleg.aussagen[0]!.teile[0]!.fundstellen;
    expect(fundstellen.filter((f) => f.art === "extern")).toEqual([]);
    expect(JSON.stringify(fundstellen)).not.toContain("schmilzt bei 1234");
  });

  it("K3 · öffentliche Prüf-KI ohne Freigabe: auch Aussage- und Teiltext bleiben zurück", () => {
    // Die wörtliche Antwort IST der Quelltext — ohne Freigabe darf er nicht ins Paket.
    const woertlich = binde(
      "Am Ventil F3 gilt eine Höchsttemperatur von 80 °C. [1]",
      ["ko-ventil"],
      [VENTIL],
    );
    const oeffentlich = { modell: "oeffentlich-fiktiv", oeffentlich: true };
    const ohne = pruefPaket(woertlich, oeffentlich, () => false);
    expect(ohne.posten[0]).toMatchObject({
      zustand: "nicht_pruefbar",
      aussage: null,
      teil: null,
      fundstellen: [],
    });
    expect(JSON.stringify(ohne)).not.toContain("Höchsttemperatur");
    expect(JSON.stringify(ohne)).not.toContain("80 °C");
    // Lokal (interne Prüf-KI) bleibt der Text erhalten.
    const intern = { modell: "intern-fiktiv", oeffentlich: false };
    const lokal = pruefPaket(woertlich, intern, () => false);
    expect(lokal.posten[0]!.teil).toBe("Am Ventil F3 gilt eine Höchsttemperatur von 80 °C.");

    // Gemischte Aussage: ein freigegebener und ein gesperrter Teil. Der gesperrte Teil und der
    // Gesamttext bleiben zurück, der freigegebene Teil ist prüfbar.
    const gemischt = binde(
      "Am Ventil F3 gilt eine Höchsttemperatur von 80 °C und die Pumpe P7 vor dem Start vollständig entlüften. [1][2]",
      ["ko-ventil", "ko-pumpe"],
      [VENTIL, PUMPE],
    );
    const paket = pruefPaket(gemischt, oeffentlich, (koId) => koId === "ko-pumpe");
    expect(paket.posten.map((p) => p.zustand)).toEqual(["nicht_pruefbar", "pruefbar"]);
    expect(paket.posten.map((p) => p.aussage)).toEqual([null, null]);
    expect(paket.posten.map((p) => p.teil)).toEqual([
      null,
      "die Pumpe P7 vor dem Start vollständig entlüften.",
    ]);
    expect(JSON.stringify(paket)).not.toContain("Höchsttemperatur");
  });

  it("K2/K5 · Volltext nur aus der Projektion derselben Fassung", () => {
    expect(volltextDerFassung(undefined, 4)).toBeUndefined();
    expect(volltextDerFassung({ fassung: 5, text: "Neuer Text." }, 4)).toBeUndefined();
    expect(volltextDerFassung({ fassung: 4, text: "Alter Text." }, 4)).toBe("Alter Text.");
  });
});

// ------------------------------------------------------------------------------------------------
// Auflösen mit aktuellen Rechten — fiktiver Bestand mit zwei Berechtigungsräumen.
// ------------------------------------------------------------------------------------------------

interface TestObjekt extends AufloesbaresObjekt {
  readonly raum: "werk-nord" | "werk-sued";
}

const V1 = "Am Ventil F3 gilt eine Höchsttemperatur von 80 °C. Bei Dauerbetrieb gilt 70 °C.";
const V2 = "Am Ventil F3 gilt eine Höchsttemperatur von 85 °C. Bei Dauerbetrieb gilt 70 °C.";
const PASSAGE_V1 = "Am Ventil F3 gilt eine Höchsttemperatur von 80 °C.";

function bestand(opts: {
  aktuell: TestObjekt[];
  papierkorb?: TestObjekt[];
  fassungen: Record<string, Record<number, ObjektFassung>>;
}): FundstellenLeser<TestObjekt> {
  return {
    aktuell: async (id) => opts.aktuell.find((o) => o.id === id),
    imPapierkorb: async (id) => (opts.papierkorb ?? []).find((o) => o.id === id),
    fassung: async (id, version) => opts.fassungen[id]?.[version],
  };
}

const NORD: TestObjekt = {
  id: "ko-nord",
  version: 1,
  originalAuthor: "autorin-fiktiv",
  statement: V1,
  raum: "werk-nord",
};

const SUED: TestObjekt = {
  id: "ko-sued",
  version: 1,
  originalAuthor: "autor-sued-fiktiv",
  statement: "Im Werk Süd gilt für die Presse P2 ein Grenzdruck von 300 bar.",
  raum: "werk-sued",
};

const nurNord = (o: TestObjekt) => o.raum === "werk-nord";

function verweis(koId: string, version: number, auszug: string, start = 0): FundstellenVerweis {
  return {
    art: "intern",
    koId,
    koVersion: version,
    feld: "statement",
    start,
    ende: start + auszug.length,
    fingerabdruck: fingerabdruck(auszug),
  };
}

describe("REF-01 · Fundstellen auflösen — aktuelle Rechte, gelöscht, geändert", () => {
  it("K4/K5 · aktuell: Auszug aus der gebundenen Fassung, Originalautor und Quellenlink", async () => {
    const leser = bestand({ aktuell: [NORD], fassungen: { "ko-nord": { 1: { statement: V1 } } } });
    const r = await loeseFundstelleAuf(verweis("ko-nord", 1, PASSAGE_V1), leser, nurNord);
    expect(r).toMatchObject({
      zustand: "aktuell",
      koId: "ko-nord",
      koVersion: 1,
      auszug: PASSAGE_V1,
      originalAutor: "autorin-fiktiv",
      link: "/wissen/ko-nord",
    });
  });

  it("K5/K8 · nachträglich geändert: historischer Stand und aktuelle Quelle getrennt", async () => {
    const leser = bestand({
      aktuell: [{ ...NORD, version: 2, statement: V2 }],
      fassungen: { "ko-nord": { 1: { statement: V1 }, 2: { statement: V2 } } },
    });
    const r = await loeseFundstelleAuf(verweis("ko-nord", 1, PASSAGE_V1), leser, nurNord);
    expect(r).toMatchObject({
      zustand: "geaendert",
      gebunden: { version: 1, auszug: PASSAGE_V1 },
      aktuell: { version: 2, passageUnveraendert: false },
      originalAutor: "autorin-fiktiv",
      link: "/wissen/ko-nord",
    });
    // Gegenprobe: eine Änderung an anderer Stelle lässt die gebundene Passage wörtlich stehen.
    const leser2 = bestand({
      aktuell: [{ ...NORD, version: 2 }],
      fassungen: {
        "ko-nord": {
          1: { statement: V1 },
          2: { statement: `${PASSAGE_V1} Bei Dauerbetrieb gilt 65 °C.` },
        },
      },
    });
    const r2 = await loeseFundstelleAuf(verweis("ko-nord", 1, PASSAGE_V1), leser2, nurNord);
    expect(r2).toMatchObject({ zustand: "geaendert", aktuell: { passageUnveraendert: true } });
  });

  it("K5 · der damalige Stand ist nicht mehr lesbar: ehrlich benannt, kein Ersatzbeleg", async () => {
    const leser = bestand({ aktuell: [{ ...NORD, version: 3 }], fassungen: {} });
    const r = await loeseFundstelleAuf(verweis("ko-nord", 1, PASSAGE_V1), leser, nurNord);
    expect(r).toEqual({
      zustand: "stand_nicht_verfuegbar",
      hinweis: expect.any(String),
      koId: "ko-nord",
      aktuell: { version: 3 },
      link: "/wissen/ko-nord",
    });
  });

  it("K3/K8 · gefälschter Fingerabdruck oder Bereich: beschädigt, ohne Inhalt", async () => {
    const leser = bestand({ aktuell: [NORD], fassungen: { "ko-nord": { 1: { statement: V1 } } } });
    const falsch = { ...verweis("ko-nord", 1, PASSAGE_V1), fingerabdruck: fingerabdruck("x") };
    const r = await loeseFundstelleAuf(falsch, leser, nurNord);
    expect(r).toEqual({ zustand: "beschaedigt", hinweis: expect.any(String), koId: "ko-nord" });
    const zukunft = await loeseFundstelleAuf(verweis("ko-nord", 9, PASSAGE_V1), leser, nurNord);
    expect(zukunft.zustand).toBe("beschaedigt");
  });

  it("K4/K8 · gelöscht: nur wer die Quelle sehen durfte, erfährt es — ohne Inhalt", async () => {
    const leser = bestand({ aktuell: [], papierkorb: [NORD, SUED], fassungen: {} });
    const nord = await loeseFundstelleAuf(verweis("ko-nord", 1, PASSAGE_V1), leser, nurNord);
    expect(nord).toEqual({ zustand: "geloescht", hinweis: expect.any(String), koId: "ko-nord" });
    const sued = await loeseFundstelleAuf(verweis("ko-sued", 1, "Im Werk Süd"), leser, nurNord);
    expect(sued).toEqual({
      zustand: "nicht_zugaenglich",
      hinweis: expect.any(String),
      koId: "ko-sued",
    });
  });

  it("K4/K8 · nicht berechtigt und unbekannt sind ununterscheidbar (keine fremden Metadaten)", async () => {
    const leser = bestand({
      aktuell: [NORD, SUED],
      fassungen: { "ko-sued": { 1: { statement: SUED.statement } } },
    });
    const fremd = await loeseFundstelleAuf(verweis("ko-sued", 1, "Im Werk Süd"), leser, nurNord);
    const unbekannt = await loeseFundstelleAuf(verweis("ko-gibts-nicht", 1, "x"), leser, nurNord);
    expect(fremd).toEqual({ ...unbekannt, koId: "ko-sued" });
    expect(fremd.zustand).toBe("nicht_zugaenglich");
    const text = JSON.stringify(fremd);
    for (const verraeterisch of ["300 bar", "autor-sued-fiktiv", "werk-sued", "version"]) {
      expect(text).not.toContain(verraeterisch);
    }
    // Gegenprobe: mit Recht auf Werk Süd löst dieselbe Fundstelle auf.
    const alle = () => true;
    const mitRecht = await loeseFundstelleAuf(verweis("ko-sued", 1, "Im Werk Süd"), leser, alle);
    expect(mitRecht.zustand).toBe("aktuell");
  });

  it("externe Fundstelle löst gegen den gespeicherten Auszug der gebundenen Fassung auf", async () => {
    const auszug = "Fiktivmetall schmilzt bei 1234 °C.";
    const excerpt = `Fiktivmetall ist erfunden. ${auszug}`;
    const quelle = {
      id: "q-lexikon",
      url: "https://de.wikipedia.org/wiki/Fiktivmetall",
      excerpt,
      at: "2026-10-01T08:00:00.000Z",
    };
    const leser = bestand({
      aktuell: [{ ...NORD, id: "ko-metall" }],
      fassungen: { "ko-metall": { 1: { statement: "egal", sources: [quelle] } } },
    });
    const externerVerweis: FundstellenVerweis = {
      art: "extern",
      koId: "ko-metall",
      koVersion: 1,
      quelleId: "q-lexikon",
      start: excerpt.indexOf(auszug),
      ende: excerpt.indexOf(auszug) + auszug.length,
      fingerabdruck: fingerabdruck(auszug),
    };
    const r = await loeseFundstelleAuf(externerVerweis, leser, nurNord);
    expect(r).toMatchObject({
      zustand: "aktuell",
      auszug,
      herkunft: "https://de.wikipedia.org/wiki/Fiktivmetall",
      // Ben nacharbeit-4 (K2): Speicherzeit ist keine Abrufzeit.
      gespeichertAm: "2026-10-01T08:00:00.000Z",
      abgerufenAm: null,
    });

    // Ben nacharbeit-4 (K4/K5): die Herkunft wurde gelöscht (Löschvermerk am AKTUELLEN Anker, ohne
    // neue Fassung). Der gespeicherte Auszug wird nicht mehr ausgeliefert.
    const entfernt = bestand({
      aktuell: [
        {
          ...NORD,
          id: "ko-metall",
          sources: [{ ...quelle, sourceRemovedAt: "2026-10-05T08:00:00.000Z" }],
        },
      ],
      fassungen: { "ko-metall": { 1: { statement: "egal", sources: [quelle] } } },
    });
    const weg = await loeseFundstelleAuf(externerVerweis, entfernt, nurNord);
    expect(weg).toEqual({
      zustand: "herkunft_entfernt",
      hinweis: expect.any(String),
      koId: "ko-metall",
      link: "/wissen/ko-metall",
    });
    expect(JSON.stringify(weg)).not.toContain("schmilzt");
  });

  it("Auflösungsanfrage: nur gültige Verweise, höchstens 20, sonst ganz ungültig", () => {
    const gut = verweis("ko-nord", 1, PASSAGE_V1);
    expect(leseFundstellenAnfrage({ fundstellen: [gut] })).toEqual([gut]);
    expect(leseFundstellenAnfrage({ fundstellen: [] })).toBeUndefined();
    expect(leseFundstellenAnfrage({ fundstellen: Array(21).fill(gut) })).toBeUndefined();
    expect(
      leseFundstellenAnfrage({ fundstellen: [gut, { ...gut, start: 9, ende: 3 }] }),
    ).toBeUndefined();
    expect(leseFundstellenAnfrage({ fundstellen: [{ ...gut, feld: "title" }] })).toBeUndefined();
    expect(
      leseFundstellenAnfrage({ fundstellen: [{ ...gut, fingerabdruck: "md5:abc" }] }),
    ).toBeUndefined();
    expect(leseFundstellenAnfrage(null)).toBeUndefined();
  });
});
