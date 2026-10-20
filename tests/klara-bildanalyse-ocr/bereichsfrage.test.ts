// ================================================================================================
// OCR-E06 · „KLARA, WAS STEHT HIER?“ — die Bereichslogik an der echten Analyse der Fläche.
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-bereichsfrage. Ersetzt ist allein die Texterkennung: sie liest
// aus den Bildbytes eine Marke und gibt die kontrollierte Lesung mit Wortrahmen zurück
// (`bereich-fixtur.ts`: mehrere Textblöcke, gedrehter Text, unsicheres Datum, unleserliche Stelle,
// Bild ohne Rahmen, leeres Bild). Analyse, Wiederverwendung, Bereichsauswahl und Kontextbau sind echt.
//
//   B1  K1 — ganzes Bild: sein Text, und Klaras Kontext trägt genau diesen Text samt Bildinhalt.
//   B2  K2 — Bereich in einem Bild mit mehreren Blöcken: ausschließlich der gewählte Block; ein
//       angeschnittenes Nachbarwort bleibt draußen; die Nachfrage trägt denselben Bereich.
//   B3  K3 — der Auswahlschlüssel wechselt mit Bereich, Bild, Lauf und Konto, sonst nicht.
//   B4  K4 — die Automatik liest weiter wie bisher; eine Bereichsfrage nutzt ihr Ergebnis (keine
//       neue Erkennung) und ergänzt ohne Automatik genau das eine Bild.
//   B5  leer, unleserlich, ohne Positionen, nicht gelesen — benannt, nie mit fremdem Text gefüllt.
import { describe, expect, it, vi } from "vitest";
import {
  type BildQuelleEingang,
  createBildAnalyse,
  einzelbildEingang,
} from "../../apps/web/src/lib/bildAutomatik";
import {
  type BildBereich,
  type Uebersetze,
  auswahlSchluessel,
  bereichAus,
  bereichsAnweisung,
  bereichsErgebnis,
  bereichsKontext,
  lesungInVorschau,
  lesungMitBerichtigung,
  woerterImBereich,
} from "../../apps/web/src/lib/klaraBereich";
import texte from "../../apps/web/src/texte/klarabereich";
import {
  BEREICH,
  MEHRBLOCK,
  MEHRBLOCK_GEKENNZEICHNET,
  MEHRBLOCK_WOERTER,
  bereichsEngine,
} from "./bereich-fixtur";
import { bildMit, dataUrl } from "./deck";

const DE: Record<string, string> = texte.de;

/** Die deutschen Texte des Moduls, mit eingesetzten Werten. */
const t: Uebersetze = (schluessel, werte) => {
  const vorlage = DE[schluessel] ?? schluessel;
  return vorlage.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(werte?.[name] ?? ""));
};

const MB = dataUrl(bildMit("MB"));
const LS = dataUrl(bildMit("LS"));

function zweiBilder(): BildQuelleEingang {
  return {
    quelle: "beleg.docx",
    art: "docx",
    vorkommen: [
      { fundstelle: { quelle: "beleg.docx", art: "docx", bild: 1 }, src: MB },
      { fundstelle: { quelle: "beleg.docx", art: "docx", bild: 2 }, src: LS },
    ],
  };
}

function analyse() {
  const erkenne = vi.fn(bereichsEngine);
  return { erkenne, a: createBildAnalyse({ erkenne }) };
}

describe("B1 · K1 — ausgewähltes Bild: sein Text und ein Kontext nur aus diesem Bild", () => {
  it("ganzes Bild liefert den gekennzeichneten Text; Klara bekommt Text und Bildinhalt", async () => {
    const { a } = analyse();
    const eingang = zweiBilder();
    const bild = eingang.vorkommen[0];
    if (!bild) {
      throw new Error("Fixtur");
    }
    const ergebnis = bereichsErgebnis(await a.lesungFuerBild(bild), null);
    expect(ergebnis.status).toBe("gelesen");
    expect(ergebnis.text).toBe(MEHRBLOCK_GEKENNZEICHNET);
    expect(ergebnis.unsicher).toBe(2);

    const ort = "beleg.docx · Bild 1";
    const kontext = bereichsKontext(ort, ergebnis, "Foto einer Rechnung", [], t);
    expect(kontext).toContain(`[${ort}]`);
    expect(kontext).toContain(`Erkannter Text: ${MEHRBLOCK_GEKENNZEICHNET}`);
    expect(kontext).toContain("Bildinhalt: Foto einer Rechnung");
    expect(kontext).not.toContain("LIEFERSCHEIN");
    const anweisung = bereichsAnweisung("Was steht hier?", ort, t);
    expect(anweisung).toContain(`[${ort}]`);
    expect(anweisung).toContain("Was steht hier?");
    expect(anweisung).toContain("erkläre es kurz");
    expect(anweisung).toContain("Verwende nichts außerhalb dieser Auswahl");
  });
});

describe("B2 · K2 — ein Bereich liefert ausschließlich seinen Block", () => {
  it("Block B ohne angeschnittenes Nachbarwort; Block C mit Kennzeichnung; gedrehter Block D", async () => {
    const { a } = analyse();
    const bild = zweiBilder().vorkommen[0];
    if (!bild) {
      throw new Error("Fixtur");
    }
    const lesung = await a.lesungFuerBild(bild);

    const summe = bereichsErgebnis(lesung, BEREICH.summe);
    expect(summe).toMatchObject({ status: "gelesen", text: "SUMME 1.800 EUR", unsicher: 0 });
    // „NOTIZ“ ragt in den Bereich, seine Mitte liegt außerhalb: nicht Text dieses Bereichs.
    expect(woerterImBereich(MEHRBLOCK_WOERTER, BEREICH.summe).map((w) => w.text)).toEqual([
      "SUMME",
      "1.800",
      "EUR",
    ]);
    for (const fremd of ["RECHNUNG", "NOTIZ", "ZAHLBAR", "PRUEFVERMERK", "unleserlich"]) {
      expect(summe.text).not.toContain(fremd);
    }

    const datum = bereichsErgebnis(lesung, BEREICH.datum);
    expect(datum).toMatchObject({ text: "ZAHLBAR BIS [?31.10.2026]", unsicher: 1 });
    expect(bereichsErgebnis(lesung, BEREICH.gedreht).text).toBe("PRUEFVERMERK");

    // Nachfrage: derselbe Bereich, sein Text und der Verlauf — nichts anderes.
    const ort = "beleg.docx · Bild 1, ausgewählter Bereich";
    const verlauf = [{ frage: "Was steht hier?", antwort: "Eine Summe von 1.800 EUR." }];
    const nachfrage = bereichsKontext(ort, summe, null, verlauf, t);
    expect(nachfrage).toContain("Erkannter Text: SUMME 1.800 EUR");
    expect(nachfrage).toContain("Frage: Was steht hier?");
    expect(nachfrage).toContain("Antwort: Eine Summe von 1.800 EUR.");
    expect(nachfrage).not.toContain("RECHNUNG");
    expect(nachfrage).not.toContain("ZAHLBAR");
    // Ein Bereich trägt die Bildbeschreibung des ganzen Bildes nicht.
    expect(nachfrage).not.toContain("Bildinhalt");
  });

  it("Bereiche aus Zeigerpunkten: begrenzt, gerundet, zu kleine gelten nicht", () => {
    const { breite, hoehe } = MEHRBLOCK;
    const gezogen = bereichAus({ x: 600.4, y: 330.4 }, { x: 19.6, y: 239.5 }, breite, hoehe);
    expect(gezogen).toEqual(BEREICH.summe);
    const ueberRand = bereichAus({ x: -50, y: -50 }, { x: 2000, y: 900 }, breite, hoehe);
    expect(ueberRand).toEqual({ x0: 0, y0: 0, x1: breite, y1: hoehe });
    expect(bereichAus({ x: 10, y: 10 }, { x: 12, y: 200 }, breite, hoehe)).toBeNull();
  });
});

describe("B3 · K3 — der Wechsel der Auswahl wechselt den Kontext", () => {
  it("Schlüssel je Bereich, Bild, Lauf und Konto", () => {
    const f1 = { quelle: "beleg.docx", art: "docx" as const, bild: 1 };
    const f2 = { ...f1, bild: 2 };
    const bereich: BildBereich = BEREICH.summe;
    const s = (konto: string, lauf: string, fundstelle = f1, b = bereich) =>
      auswahlSchluessel(konto, lauf, { fundstelle, bereich: b });
    const basis = s("konto-a", "datei:1");
    expect(s("konto-a", "datei:1")).toBe(basis);
    const ganz = auswahlSchluessel("konto-a", "datei:1", { fundstelle: f1, bereich: null });
    expect(ganz).not.toBe(basis);
    expect(s("konto-a", "datei:1", f1, BEREICH.datum)).not.toBe(basis);
    expect(s("konto-a", "datei:1", f2)).not.toBe(basis);
    expect(s("konto-a", "datei:2")).not.toBe(basis);
    expect(s("konto-b", "datei:1")).not.toBe(basis);
  });
});

describe("B4 · K4 — die Automatik bleibt wirksam; die Bereichsfrage nutzt und ergänzt", () => {
  it("Automatik an: beide Bilder gelesen; Bereichsfrage ohne neue Erkennung", async () => {
    const { a, erkenne } = analyse();
    const stand = await a.analysiereQuelle(zweiBilder(), { automatik: true });
    expect(stand.befunde.map((b) => b.status)).toEqual(["gelesen", "gelesen"]);
    expect(stand.befunde[0]?.textGekennzeichnet).toBe(MEHRBLOCK_GEKENNZEICHNET);
    expect(stand.befunde[1]?.text).toBe("LIEFERSCHEIN 77");
    expect(erkenne).toHaveBeenCalledTimes(2);

    const bild = zweiBilder().vorkommen[0];
    if (!bild) {
      throw new Error("Fixtur");
    }
    const lesung = await a.lesungFuerBild(bild);
    expect(lesung.wiederverwendet).toBe(true);
    expect(bereichsErgebnis(lesung, BEREICH.summe).text).toBe("SUMME 1.800 EUR");
    // Keine erneute Analyse — weder des Bildes noch der Quelle.
    expect(erkenne).toHaveBeenCalledTimes(2);
    expect(a.anzahlAnalysen()).toBe(2);
  });

  it("Automatik aus: nichts automatisch; die Frage liest genau das eine Bild", async () => {
    const { a, erkenne } = analyse();
    const aus = await a.analysiereQuelle(zweiBilder(), { automatik: false });
    expect(aus.befunde.map((b) => b.status)).toEqual(["nicht-analysiert", "nicht-analysiert"]);
    expect(erkenne).not.toHaveBeenCalled();

    const zweites = zweiBilder().vorkommen[1];
    if (!zweites) {
      throw new Error("Fixtur");
    }
    const lesung = await a.lesungFuerBild(zweites);
    expect(lesung.wiederverwendet).toBe(false);
    expect(bereichsErgebnis(lesung, null).text).toBe("LIEFERSCHEIN 77");
    expect(erkenne).toHaveBeenCalledTimes(1);
    expect(erkenne.mock.calls[0]?.[0]).toBe(LS);

    // Die Einstellung bleibt „aus“: Bild 1 wird nicht gelesen; das gezielt gelesene Bild 2 ist ein
    // vorhandenes Ergebnis derselben Bytes.
    const danach = await a.analysiereQuelle(zweiBilder(), { automatik: false });
    expect(danach.befunde.map((b) => b.status)).toEqual(["nicht-analysiert", "gelesen"]);
    expect(danach.befunde[1]?.wiederverwendet).toBe(true);
    expect(erkenne).toHaveBeenCalledTimes(1);
    // Wieder an: nur das noch fehlende Bild wird gelesen.
    await a.analysiereQuelle(zweiBilder(), { automatik: true });
    expect(erkenne).toHaveBeenCalledTimes(2);
  });
});

describe("B5 · leere und unleserliche Auswahl, Grenzen der Bestimmbarkeit", () => {
  it("leer und unleserlich werden benannt, nie mit Text von außerhalb gefüllt", async () => {
    const { a } = analyse();
    const bild = zweiBilder().vorkommen[0];
    if (!bild) {
      throw new Error("Fixtur");
    }
    const lesung = await a.lesungFuerBild(bild);
    expect(bereichsErgebnis(lesung, BEREICH.leer)).toMatchObject({ status: "leer", text: "" });
    expect(bereichsErgebnis(lesung, BEREICH.unleserlich)).toMatchObject({
      status: "unleserlich",
      text: "",
    });
  });

  it("ohne Wortrahmen kein Bereichstext; leeres und nicht lesbares Bild", async () => {
    const { a } = analyse();
    const ohneRahmen = einzelbildEingang("scan.png", dataUrl(bildMit("OR"))).vorkommen[0];
    const leer = einzelbildEingang("leer.png", dataUrl(bildMit("LE"))).vorkommen[0];
    const kaputt = einzelbildEingang("x.png", dataUrl(bildMit("ZZ"))).vorkommen[0];
    const fremd = einzelbildEingang("fremd.png", "https://example.invalid/bild.png").vorkommen[0];
    if (!ohneRahmen || !leer || !kaputt || !fremd) {
      throw new Error("Fixtur");
    }
    const rahmenlos = await a.lesungFuerBild(ohneRahmen);
    expect(bereichsErgebnis(rahmenlos, BEREICH.summe)).toMatchObject({
      status: "ohne-positionen",
      text: "",
    });
    // Das ganze Bild hat seinen Text — nur der Bereich ist nicht bestimmbar.
    expect(bereichsErgebnis(rahmenlos, null).text).toBe("OHNE RAHMEN");
    expect(bereichsErgebnis(await a.lesungFuerBild(leer), null).status).toBe("leer");
    expect(bereichsErgebnis(await a.lesungFuerBild(kaputt), null)).toMatchObject({
      status: "nicht-gelesen",
      lesung: "fehlgeschlagen",
    });
    expect(bereichsErgebnis(await a.lesungFuerBild(fremd), BEREICH.summe)).toMatchObject({
      status: "nicht-gelesen",
      lesung: "kein-zugriff",
    });
  });
});

describe("E01/E02 in E06 · bestätigte Korrektur und gedrehte Vorschau", () => {
  it("verwendet korrigierten Text nur an derselben Bildfassung; hinzugefügte Wörter erhalten keine fremde Position", async () => {
    const { a } = analyse();
    const bild = zweiBilder().vorkommen[0];
    if (!bild) throw new Error("Fixture");
    const lesung = await a.lesungFuerBild(bild);
    const roh = await a.befundFuerBild(bild);
    const { befundMitKorrektur } = await import("../../apps/web/src/lib/bildKorrektur");
    const berichtigt = befundMitKorrektur(roh, {
      quelle: "datei:test",
      inhaltskennung: roh.inhaltskennung ?? "",
      ort: null,
      text: MEHRBLOCK_GEKENNZEICHNET.replace("1.800", "1.500"),
      schritte: 0,
      geaendertAm: "2026-10-20T07:00:00Z",
    });
    const wirksam = lesungMitBerichtigung(lesung, berichtigt);
    expect(bereichsErgebnis(wirksam, BEREICH.summe).text).toBe("SUMME 1.500 EUR");
    expect(
      bereichsErgebnis(
        lesungMitBerichtigung({ ...lesung, inhaltskennung: "andere-fassung" }, berichtigt),
        null,
      ).text,
    ).toContain("1.800");
    const ergaenzt = {
      ...berichtigt,
      textGekennzeichnet: `${berichtigt.textGekennzeichnet} ZUSATZ`,
    };
    expect(bereichsErgebnis(lesungMitBerichtigung(lesung, ergaenzt), BEREICH.summe).status).toBe(
      "ohne-positionen",
    );
    expect(bereichsErgebnis(lesungMitBerichtigung(lesung, ergaenzt), null).text).toContain(
      "ZUSATZ",
    );
    expect(a.anzahlAnalysen()).toBe(1);
  });

  it("ordnet EXIF-6-Rahmen der sichtbaren Vorschau zu; unklare Drehung bleibt ohne Bereich", () => {
    const lesung = {
      status: "gelesen" as const,
      inhaltskennung: "sha256:test",
      text: "GEDREHT",
      textGekennzeichnet: "GEDREHT",
      wiederverwendet: true,
      rahmen: { breite: 1000, hoehe: 400, orientierung: 6 },
      woerter: [{ text: "GEDREHT", confidence: 95, bbox: { x0: 800, y0: 20, x1: 950, y1: 60 } }],
    };
    const vorschau = lesungInVorschau(lesung);
    expect(bereichsErgebnis(vorschau, { x0: 330, x1: 390, y0: 790, y1: 960 }).text).toBe("GEDREHT");
    expect(bereichsErgebnis(vorschau, { x0: 0, x1: 100, y0: 0, y1: 100 }).status).toBe("leer");
    expect(
      bereichsErgebnis(
        lesungInVorschau({ ...lesung, rahmen: { ...lesung.rahmen, orientierung: 3 } }),
        BEREICH.summe,
      ).status,
    ).toBe("ohne-positionen");
  });
});
