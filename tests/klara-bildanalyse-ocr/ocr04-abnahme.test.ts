// @vitest-environment jsdom
// ================================================================================================
// OCR-04 · TESTS ERKENNEN AUSLASSUNGEN, FALSCHE FUNDSTELLEN UND VERALTETE BILDBEFUNDE
// ================================================================================================
//
// Auftrag produkt:20261012:klara-bildanalyse-ocr-hostpruefung, K3 (und K2: Automatik und Genauigkeit
// werden getrennt bewertet).
//
//   A1–A4  GEGENPROBEN: Der Abnahmeprüfer (`abnahme.ts`), den auch die Browserprobe benutzt, meldet
//          eine Auslassung, eine vertauschte Fundstelle, einen fremden Text und einen veralteten
//          Befund — an echten Ergebnissen der PowerPoint-Importkette, die gezielt verdorben werden.
//          Ein Prüfer, der hier nichts meldet, wäre wertlos; deshalb steht das als eigener Test.
//   B1     Der Klara-Kontext einer echten PowerPoint (Importkette `deck.ts`, Erkennung gestellt) hat
//          jedes Bild mit seiner Fundstelle; die Fundstelle einer Frage ist je Bild genau dieses Bild.
//   B2     Eine Auslassung durch das Produkt (Erfassungsgrenze, nicht übernommenes Bild) bleibt
//          sichtbar: der Prüfer sieht den fehlenden Text, und Klaras Kontext ist „nicht vollständig“.
//   B3     Nach einer Bildänderung trägt Klaras Kontext den NEUEN Text, nicht den alten; unveränderte
//          Bilder werden wiederverwendet.
//   C1     Automatik ohne Genauigkeit: ein Lauf, der ohne Klick startet und endet, aber falschen Text
//          liefert, besteht die Automatikprobe und fällt in der Genauigkeitsprüfung durch.
//
// Die Genauigkeit der ECHTEN Engine misst `tests-smoke/klara-bild-ocr04-abnahme-browser.spec.ts`.
import { describe, expect, it } from "vitest";
import { fundstelleBaustein } from "../../apps/web/src/components/BildBefundListe";
import i18n from "../../apps/web/src/i18n";
import {
  type BildFundstelle,
  type QuellenBefund,
  createBildAnalyse,
  pptxBildEingang,
} from "../../apps/web/src/lib/bildAutomatik";
import {
  type Uebersetze,
  belegstellen,
  klaraBildKontext,
} from "../../apps/web/src/lib/klaraBildKontext";
import type { OcrResult } from "../../apps/web/src/lib/ocr";
import { type IstBild, type SollBild, erfundeneWoerter, pruefeBefunde } from "./abnahme";
import { FOLIENTEXT, bildMit, deck, lesePptx, markeAus, markenEngine } from "./deck";

const t: Uebersetze = (k, w) => String(i18n.t(k, w ?? {}));
const ortVon = (f: BildFundstelle, quelle: string): string => {
  const b = fundstelleBaustein(f, quelle);
  return String(i18n.t(b.key, b.params));
};
const DOKUMENT = FOLIENTEXT.join("\n");

/** Was über `deck()` bekannt ist — jedes Bild mit Fundstelle und Text (`deck.ts`, TEXT_JE_MARKE). */
const SOLL: SollBild[] = [
  { ort: "Folie 1, Bild 1", begriffe: ["PRUEFKARTE", "47"] },
  { ort: "Folie 2, Bild 1", begriffe: ["VENTIL", "83", "SCHLIESSEN"] },
  { ort: "Folie 2, Bild 2", begriffe: ["LAGER", "29"] },
];

/** Dasselbe Deck, nachdem das Bild auf Folie 2 ausgetauscht wurde (`bildMit("B2")`). */
const SOLL_GEAENDERT: SollBild[] = [
  SOLL[0] as SollBild,
  { ort: "Folie 2, Bild 1", begriffe: ["VENTIL", "84", "OEFFNEN"], frueher: ["83", "SCHLIESSEN"] },
  SOLL[2] as SollBild,
];

async function lies(bytes = deck(), analyse = createBildAnalyse({ erkenne: markenEngine() })) {
  await i18n.changeLanguage("de");
  const pptx = await lesePptx(bytes);
  const eingang = pptxBildEingang("wartung.pptx", pptx.html, pptx);
  const befund = await analyse.analysiereQuelle(eingang, { automatik: true });
  return { eingang, befund, analyse };
}

/** Das IST, wie es die Oberfläche zeigt: Fundstelle im Wortlaut und gekennzeichneter Text. */
function istAus(befund: QuellenBefund): IstBild[] {
  return befund.befunde.map((b) => ({
    ort: ortVon(b.fundstelle, befund.quelle),
    text: b.textGekennzeichnet,
  }));
}

describe("A · Gegenproben — der Abnahmeprüfer erkennt jeden Mangel", () => {
  it("A0 · das unverdorbene Ergebnis der Importkette ist mangelfrei", async () => {
    const { befund } = await lies();
    expect(pruefeBefunde(SOLL, istAus(befund))).toEqual([]);
  });

  it("A1 · Auslassung: ein Bild fehlt im Befund", async () => {
    const ist = istAus((await lies()).befund).filter((b) => b.ort !== "Folie 2, Bild 1");
    expect(pruefeBefunde(SOLL, ist)).toEqual([{ art: "auslassung", ort: "Folie 2, Bild 1" }]);
  });

  it("A2 · falsche Fundstelle: zwei Bilder tragen die Texte vertauscht", async () => {
    const ist = istAus((await lies()).befund);
    const [a, b, c] = ist as [IstBild, IstBild, IstBild];
    const vertauscht = [a, { ...b, text: c.text }, { ...c, text: b.text }];
    const maengel = pruefeBefunde(SOLL, vertauscht);
    expect(maengel).toContainEqual({
      art: "falsche-fundstelle",
      ort: "Folie 2, Bild 1",
      gefundenBei: "Folie 2, Bild 2",
    });
    expect(maengel).toContainEqual({
      art: "falsche-fundstelle",
      ort: "Folie 2, Bild 2",
      gefundenBei: "Folie 2, Bild 1",
    });
    expect(maengel).toContainEqual({
      art: "fremder-text",
      ort: "Folie 2, Bild 2",
      begriff: "83",
      gehoertZu: "Folie 2, Bild 1",
    });
  });

  it("A3 · eine Folie zu viel oder zu wenig gezählt: Text unter einer Fundstelle, die es nicht gibt", async () => {
    const ist = istAus((await lies()).befund).map((b) =>
      b.ort === "Folie 1, Bild 1" ? { ...b, ort: "Folie 2, Bild 3" } : b,
    );
    expect(pruefeBefunde(SOLL, ist)).toEqual([
      { art: "falsche-fundstelle", ort: "Folie 1, Bild 1", gefundenBei: "Folie 2, Bild 3" },
      { art: "ueberzaehlig", ort: "Folie 2, Bild 3" },
    ]);
  });

  it("A4 · veraltet: der Befund des früheren Bildes wird für die geänderte Datei weiter gezeigt", async () => {
    const alt = istAus((await lies()).befund);
    const maengel = pruefeBefunde(SOLL_GEAENDERT, alt);
    expect(maengel).toContainEqual({ art: "veraltet", ort: "Folie 2, Bild 1", begriff: "83" });
    expect(maengel).toContainEqual({
      art: "veraltet",
      ort: "Folie 2, Bild 1",
      begriff: "SCHLIESSEN",
    });
    expect(maengel).toContainEqual({
      art: "fehlender-text",
      ort: "Folie 2, Bild 1",
      begriff: "84",
    });
  });

  it("A5 · schwierige Vorlage: ungekennzeichnet Falsches ist erfunden, Gekennzeichnetes nicht", () => {
    const vorlage = ["VENTIL 38", "DRUCK 72"];
    expect(erfundeneWoerter("VENTIL 38\nDRUCK 72", vorlage)).toEqual([]);
    expect(erfundeneWoerter("VENTIL [?36]\n[unleserlich] 72", vorlage)).toEqual([]);
    expect(erfundeneWoerter("VENTIL 36\nDRUCK 72", vorlage)).toEqual(["36"]);
  });
});

describe("B · das Produkt: keine Auslassung, keine falsche Fundstelle, kein veralteter Befund", () => {
  it("B1 · Klaras Kontext hat jedes Bild mit Fundstelle; die Frage je Bild nennt genau dieses Bild", async () => {
    const { eingang, befund } = await lies();
    const k = klaraBildKontext(DOKUMENT, [befund], t, ortVon, [eingang]);
    expect(pruefeBefunde(SOLL, k.eintraege)).toEqual([]);
    const fragen: Record<string, string> = {
      "Folie 1, Bild 1": "Welche Nummer hat die Pruefkarte?",
      "Folie 2, Bild 1": "Welches Ventil ist zu schliessen?",
      "Folie 2, Bild 2": "Welche Nummer hat das Lager?",
    };
    for (const s of SOLL) {
      const belege = belegstellen(fragen[s.ort] as string, DOKUMENT, k);
      expect(belege[0], s.ort).toMatchObject({ art: "bild", quelle: "wartung.pptx", ort: s.ort });
      const beleg: IstBild = { ort: belege[0]?.ort ?? "", text: belege[0]?.auszug ?? "" };
      expect(pruefeBefunde([s], [beleg])).toEqual([]);
    }
  });

  it("B2 · eine Auslassung durch das Produkt bleibt sichtbar — nie als vollständig", async () => {
    await i18n.changeLanguage("de");
    const pptx = await lesePptx(deck());
    const eingang = pptxBildEingang("wartung.pptx", pptx.html, pptx);
    // Erfassungsgrenze: nur zwei Bilder werden gelesen; das BMP wird beim Import nicht übernommen.
    const analyse = createBildAnalyse({ erkenne: markenEngine(), hoechstzahl: 2 });
    const befund = await analyse.analysiereQuelle(eingang, { automatik: true });
    const k = klaraBildKontext(DOKUMENT, [befund], t, ortVon, [eingang]);
    expect(pruefeBefunde(SOLL, k.eintraege)).toEqual([
      { art: "fehlender-text", ort: "Folie 2, Bild 2", begriff: "LAGER" },
      { art: "fehlender-text", ort: "Folie 2, Bild 2", begriff: "29" },
    ]);
    expect(k.vollstaendig).toBe(false);
    // Drei eingebettete Bilder plus das nicht übernommene BMP; gelesen sind zwei.
    expect(k).toMatchObject({ gesamt: 4, gelesen: 2, offen: 2 });
    const offen = i18n.t("klarabildkontext.kontext.offen", {
      status: i18n.t("bildautomatik.status.nichtAnalysiert"),
    });
    expect(quelltext(k.kontext)).toContain(`[wartung.pptx · Folie 2, Bild 2] ${offen}`);
  });

  it("B3 · nach der Bildänderung trägt Klaras Kontext den neuen Text, nicht den alten", async () => {
    const analyse = createBildAnalyse({ erkenne: markenEngine() });
    await lies(deck(), analyse);
    const { eingang, befund } = await lies(deck(bildMit("B2")), analyse);
    expect(pruefeBefunde(SOLL_GEAENDERT, istAus(befund))).toEqual([]);
    const k = klaraBildKontext(DOKUMENT, [befund], t, ortVon, [eingang]);
    expect(pruefeBefunde(SOLL_GEAENDERT, k.eintraege)).toEqual([]);
    const belege = belegstellen("Welches Ventil ist zu oeffnen?", DOKUMENT, k);
    expect(belege[0]).toMatchObject({ art: "bild", ort: "Folie 2, Bild 1" });
    expect(belege[0]?.auszug).toContain("84");
    expect(belege[0]?.auszug).not.toContain("83");
    // Nur das geänderte Bild wurde neu erkannt.
    expect(analyse.anzahlAnalysen()).toBe(4);
    expect(befund.befunde.map((b) => b.wiederverwendet)).toEqual([true, false, true]);
  });
});

describe("C · Automatik und Genauigkeit sind getrennte Nachweise", () => {
  it("C1 · ohne Klick gestartet und beendet, aber falsch gelesen: Automatik ja, Genauigkeit nein", async () => {
    // Eine Erkennung, die jedes Bild „liest“, aber immer denselben falschen Text liefert.
    const falsch = async (src: string): Promise<OcrResult> => ({
      status: "success",
      text: markeAus(src) ? "PRUEFKARTE 74" : "",
    });
    const { befund } = await lies(deck(), createBildAnalyse({ erkenne: falsch }));
    // Die Automatik hat ihren Teil erfüllt: jedes Bild ist ohne Auftrag gelesen worden.
    expect(befund.befunde.map((b) => b.status)).toEqual(["gelesen", "gelesen", "gelesen"]);
    // Die Genauigkeit nicht: die bekannten Begriffe fehlen.
    const maengel = pruefeBefunde(SOLL, istAus(befund));
    expect(maengel).toContainEqual({
      art: "fehlender-text",
      ort: "Folie 1, Bild 1",
      begriff: "47",
    });
    expect(maengel).toContainEqual({
      art: "fehlender-text",
      ort: "Folie 2, Bild 2",
      begriff: "29",
    });
  });
});

// OCR3: derselbe legitime Text und dieselben Fundstellen liegen jetzt in begrenzten JSON-Daten.
function quelltext(kontext: string): string {
  const daten = JSON.parse(kontext.split("\n")[1] ?? "null") as {
    dokument: string;
    hinweise: string[];
  };
  return [daten.dokument, ...daten.hinweise].join("\n\n");
}
