import { describe, expect, it } from "vitest";
import {
  type FristArt,
  type FristenQuelle,
  erkenneFristen,
  fristIdentitaet,
} from "../../services/app/src/klara-fristen-erkennung";

function quelle(text: string, zusatz: Partial<FristenQuelle> = {}): FristenQuelle {
  return {
    art: "wissensobjekt",
    id: "synthetischer-beleg",
    fassung: "1",
    belegId: "original-import-17",
    text,
    verantwortlich: null,
    ...zusatz,
  };
}

describe("AW19 · belegte Fristenerkennung ohne Wirkungen", () => {
  it("trennt Lizenz und Zertifikat, hält Wortlaut, Absatz und Originalfassung fest", () => {
    const text = "Lizenz L-17 ist gültig bis 2027-04-30.\nZertifikat Z-8: Ablaufdatum 31.12.2027.";
    const b = erkenneFristen(quelle(text, { verantwortlich: "fachlich-hinterlegtes-konto" }));
    expect(b).toHaveLength(2);
    expect(b.map((x) => [x.objekt.kennung, x.art, x.datum, x.klaerung])).toEqual([
      ["L-17", "ablauf", { art: "datum", datum: "2027-04-30" }, []],
      ["Z-8", "ablauf", { art: "datum", datum: "2027-12-31" }, []],
    ]);
    for (const x of b) {
      expect(text.slice(x.abschnitt.von, x.abschnitt.bis)).toBe(x.abschnitt.wortlaut);
      expect(x.quelle.fassung).toBe("1");
      expect(x.verantwortlich).toBe("fachlich-hinterlegtes-konto");
    }
  });

  it.each([
    "Dokumentdatum: 2027-04-30. Zertifikat liegt im Archiv.",
    "Zertifikat Z-8 wurde am 2027-04-30 eingescannt.",
    "Lizenz L-17 wird erwähnt.\nDas Ablaufdatum einer anderen Sache ist 2027-04-30.",
    "Protokoll vom 2027-04-30: Die Zertifikate wurden besprochen.",
  ])("erstellt aus beiläufigem Wort oder Datum keinen Beleg: %s", (text) => {
    expect(erkenneFristen(quelle(text))).toEqual([]);
  });

  const arten: readonly [string, FristArt][] = [
    ["Lizenz L-17: Lizenzende 2027-04-30.", "ablauf"],
    ["Vertrag V-1: Kündigungsfenster bis 2027-04-30.", "kuendigungsfenster"],
    ["Vertrag V-1: Vertragsende 2027-04-30.", "vertragsende"],
    ["Vertrag V-1: automatische Verlängerung am 2027-04-30.", "automatische_verlaengerung"],
    ["Zertifikat Z-8: Erneuerungstermin 2027-04-30.", "erneuerung"],
    ["Anlage P-1: Prüftermin 2027-04-30.", "pruefung"],
    ["Norm N-17: Normankündigung für 2027-04-30.", "normankuendigung"],
    ["Anlage P-1: Wartungstermin 2027-04-30.", "wartung"],
    ["Anleitung A-1: Anleitungspflege bis 2027-04-30.", "anleitungspflege"],
    ["Einarbeitung E-1: Einarbeitungstermin 2027-04-30.", "einarbeitung"],
    ["Anlage P-1: Expertenübergabe bis 2027-04-30.", "expertenuebergabe"],
  ];
  it.each(arten)("hält den belegten Anlass getrennt: %s", (text, art) => {
    const b = erkenneFristen(quelle(text));
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ art, datum: { art: "datum", datum: "2027-04-30" }, klaerung: [] });
  });

  it.each([
    ["Lizenz L-17: Ablauf nach zwei Jahren.", "datum_fehlt"],
    ["Ist Lizenz L-17 gültig bis 2027-04-30?", "geltung_unklar"],
    ["Zertifikat Z-8: gültig bis 04/05/2027.", "mehrdeutiges_datum"],
    ["Lizenz L-17: Ablaufdatum 2027-02-30.", "mehrdeutiges_datum"],
    ["Lizenz L-17: Ablauf am 2027-04-30 um 09:00.", "zeitzone_fehlt"],
    ["Lizenz L-17: Ablauf am 2027-04-30 um 9 Uhr.", "zeitangabe_unklar"],
    ["Lizenz L-17: Ablauf am 2027-04-30 um 09.", "zeitangabe_unklar"],
    ["Lizenz L-17: Ablauf am 2027-04-30 um neun.", "zeitangabe_unklar"],
    ["Lizenz L-17: Ablauf am 2027-04-30 um 09:00:30 Europe/Berlin.", "zeitangabe_unklar"],
    ["Lizenz L-17: Ablaufdatum 2027-04-30 ohne Gewähr.", "geltung_unklar"],
    ["Lizenz L-17 ist bedingt gültig bis 2027-04-30.", "geltung_unklar"],
    ["Lizenz L-17: Ablauf am 2027-04-30 um 09:00 CET.", "zeitzone_fehlt"],
    ["Lizenz L-17: Ablauf am 2026-10-25 um 02:30 Europe/Berlin.", "sommerzeit_unklar"],
    ["Lizenz L-17: Ablauf am 2027-03-28 um 02:30 Europe/Berlin.", "sommerzeit_unklar"],
    ["Lizenz L-17: Ablauf 2027-04-30, abweichend 2027-05-30.", "widerspruch"],
    ["Lizenz L-17 und Lizenz L-18: Ablaufdatum 2027-04-30.", "mehrere_objekte"],
    ["Lizenz L-17: Ablaufdatum 2027-04-30 ist widerrufen.", "geltung_unklar"],
    ["Beispiel: Lizenz L-17 ist gültig bis 2027-04-30.", "geltung_unklar"],
    ["Lizenz L-17 ist nicht gültig bis 2027-04-30.", "geltung_unklar"],
  ])("lässt die konkrete Unklarheit offen: %s", (text, grund) => {
    const b = erkenneFristen(quelle(text));
    expect(b).toHaveLength(1);
    expect(b[0]?.datum).toBeNull();
    expect(b[0]?.klaerung).toContain(grund);
    expect(b[0]?.abschnitt.wortlaut).toBe(text);
  });

  it("benutzt dieselbe Zeitauflösung, ohne eine Sommerzeitentscheidung zu erfinden", () => {
    expect(
      erkenneFristen(quelle("Lizenz L-17: Ablauf am 2027-04-30 um 09:00 Europe/Berlin."))[0]?.datum,
    ).toEqual({
      art: "zeitpunkt",
      datum: "2027-04-30",
      uhrzeit: "09:00",
      zeitzone: "Europe/Berlin",
      utc: "2027-04-30T07:00:00.000Z",
    });
  });

  it("trennt Objekt-/Frist-, Beleg- und Versionsidentität, auch bei gleichem Datum", () => {
    const text = "Lizenz L-17: Ablaufdatum 2027-04-30.";
    const original = erkenneFristen(quelle(text))[0];
    const kopie = erkenneFristen(quelle(text, { id: "andere-ansicht", fassung: "2" }))[0];
    const unabhaengig = erkenneFristen(quelle(text, { belegId: "anderer-beleg" }))[0];
    const anderesObjekt = erkenneFristen(quelle(text.replace("L-17", "L-18")))[0];
    if (!original || !kopie || !unabhaengig || !anderesObjekt) throw new Error("Prüfbestand fehlt");
    expect(original.fingerabdruck).toBe(kopie.fingerabdruck);
    expect(original.fingerabdruck).not.toBe(unabhaengig.fingerabdruck);
    expect(fristIdentitaet("konto-1", original)).toBe(fristIdentitaet("konto-1", unabhaengig));
    expect(fristIdentitaet("konto-1", original)).not.toBe(
      fristIdentitaet("konto-1", anderesObjekt),
    );
    expect(fristIdentitaet("konto-1", original)).not.toBe(fristIdentitaet("konto-2", original));
  });
});
