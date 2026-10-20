// @vitest-environment jsdom
// ================================================================================================
// OCR-E05 · SACHLICHE WIDERSPRÜCHE ZWISCHEN BILDTEXT UND DOKUMENTTEXT (Auftrag
// produkt:20261012:klara-ocr-widersprueche) — der DOM-freie Kern (`lib/bildWidersprueche.ts`) an
// der ECHTEN Editor-Kette (`rumpfBildEingang` → `createBildAnalyse` → `klaraBildKontext`) und die
// echte Klara-Fläche (`KlaraBildKontextFrage`). Ersetzt ist nur die Texterkennung: sie liest die
// Marke aus den Bildbytes und liefert einen bekannten Text samt Sicherheit je Wort. Die echte
// Engine misst `tests-smoke/klara-bild-widersprueche-browser.spec.ts`.
// ================================================================================================
//
//   W1  K1 — „1.500 €“ im Text, „1.800 €“ im Bild (drei Bilder, Bild 1 als Tabelle): genau diese
//       beiden Angaben mit Absatz/Satz bzw. Quelle · Bild · Zeile als mögliche Abweichung.
//   W2  K2 — gleiche Werte in anderer Schreibweise, andere Jahre, Quartale, Versionen, Einheiten:
//       kein Hinweis. Gegenprobe: derselbe Bezug mit anderem Wert ergibt genau einen.
//   W3  K3 — absichtlicher OCR-Fehler: unsicher gelesen → „unsichere Erkennung“, kein Widerspruch;
//       berichtigt (Form von OCR-E02) → neu bewertet: richtig berichtigt kein Hinweis, anders
//       berichtigt eine mögliche Abweichung. Unleserlich ebenfalls nur „unsicher“.
//   W4  K4 — Rumpf, Dokumenttext und Befund bleiben unverändert; die Anweisung an Klara verlangt
//       beide Angaben und verbietet die Entscheidung ohne Beleg; die Fläche zeigt beide Seiten und
//       bewertet nach einer Berichtigung neu.
//   W5  K2/K1 — Nacharbeit 3 (Ben): verschiedene Projekte („Projekt Nord“/„Projekt West“) sind
//       verschiedene Sachverhalte, kein Hinweis; dasselbe Projekt mit anderem Betrag ergibt einen.
//   W6  K1/K2 — Nacharbeit 3 (Ben): Vorzeichen bleiben erhalten — „-1.500 €“ gegenüber „1.500 €“,
//       „-12 %“ gegenüber „12 %“, „-5“ gegenüber „5“ sind Abweichungen mit unverändertem Wortlaut;
//       gleichwertige negative Schreibweisen (−, „€ -1.500“, „-1,5 Tsd. €“, Prozent) sind gleich.
//   W7  K5/K6 — Nacharbeit 7 (Ben): Quellwechsel und Vollständigkeit. Befunde einer anderen Quelle
//       oder eines ausgetauschten Bildes ergeben keinen Hinweis; ein nicht gelesenes Bild ergibt
//       keinen, die Quelle heißt nicht vollständig, und das gelesene zweite Bild trägt seinen.
//   W8  K5/K6 — Nacharbeit 7 (Ben): Tabellenstruktur. Eine aus Wortrahmen erkannte Bildtabelle
//       (`tabelleAusWoertern`) behält ihre Struktur; die Abweichung steht in ihrer Tabellenzeile.
//   W9  K2/K3 — Nacharbeit 8 (Ben): ein unsicheres Stück derselben Zahlengruppe („[unleserlich] 800 €“,
//       „[?O] 800 €“) macht den sicher gelesenen Teilbetrag unsicher — „unsichere Erkennung“, kein
//       Widerspruch. Gegenproben: sicherer Teilbetrag und unsicheres Bezugswort bleiben Abweichungen.
//       Nacharbeit 9: auch ein längeres verlesenes Zahlenpräfix („[?l.OOO] 800 €“) gehört zur Gruppe.
//       Nacharbeit 10: ein Wort aus verwechselbaren Buchstaben („[?Solo] 800 €“) gehört nicht dazu.
//       Nacharbeit 11: auch nicht in Großschreibung („[?SOLO]“, „[?BOSS]“), wenn der Text denselben
//       Sachverhalt mit diesem Wort benennt.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  type ImageDescribeValue,
  ImageDescribeValueProvider,
} from "../../apps/web/src/app/ImageDescribeContext";
import { fundstelleBaustein } from "../../apps/web/src/components/BildBefundListe";
import { KlaraBildKontextFrage } from "../../apps/web/src/components/KlaraBildKontextFrage";
import i18n from "../../apps/web/src/i18n";
import {
  type BildFundstelle,
  type BildQuelleEingang,
  type QuellenBefund,
  createBildAnalyse,
  rumpfBildEingang,
} from "../../apps/web/src/lib/bildAutomatik";
import {
  type BildTextAbweichung,
  angabeOrt,
  bildWidersprueche,
  widerspruchsAnweisung,
  zahlWert,
} from "../../apps/web/src/lib/bildWidersprueche";
import { type Uebersetze, klaraBildKontext } from "../../apps/web/src/lib/klaraBildKontext";
import type { OcrResult } from "../../apps/web/src/lib/ocr";
import { htmlToPlainText } from "../../apps/web/src/lib/richText";
import { bildMit, dataUrl, markeAus } from "./deck";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const t: Uebersetze = (k, w) => String(i18n.t(k, w ?? {}));
const ortVon = (f: BildFundstelle, quelle: string): string => {
  const b = fundstelleBaustein(f, quelle);
  return String(i18n.t(b.key, b.params));
};

const sicher = (text: string): OcrResult => ({ status: "success", text });

/** Der bekannte Text je Bildmarke. `FEHLER`: das Bild zeigt 1.500, gelesen wird unsicher 1.300. */
const BILDTEXT: Record<string, OcrResult> = {
  SUMME: sicher("Position Betrag\nMaterial 1.200 €\nGesamtsumme 1.800 €"),
  ANGABEN: sicher("Lieferdatum 12.10.2026\nAnzahlung 300,00 EUR"),
  NAME: sicher("Ansprechpartnerin: Clara Berg"),
  PERIODE: sicher("Gesamtsumme 2025: 1.500 €\nGesamtsumme 2026: 1.800 €\nKosten Q2: 450 €"),
  EINHEIT: sicher("Gewicht 1,8 t\nUmsatz Version 3: 2.400 €\nRücklage 1.500,00 EUR"),
  GEGEN: sicher("Gesamtsumme 2025: 1.800 €"),
  WEST: sicher("Gesamtsumme Projekt West: 1.800 €"),
  NORD: sicher("Gesamtsumme Projekt Nord: 1.800 €"),
  VZPOS: sicher("Saldo 1.500 €\nAbweichung 12 %\nTemperatur 5"),
  KAPUTT: { status: "failed", text: "", error: "Erkennung fehlgeschlagen" },
  // Nacharbeit 8: die Tausenderstelle vor „800“ ist unleserlich bzw. als „O“ unsicher gelesen.
  LUECKE: {
    status: "success",
    text: "Gesamtsumme: X 800 €",
    woerter: [
      { text: "Gesamtsumme:", confidence: 96 },
      { text: "X", confidence: 15 },
      { text: "800", confidence: 95 },
      { text: "€", confidence: 95 },
    ],
  },
  VERLESEN: {
    status: "success",
    text: "Gesamtsumme: O 800 €",
    woerter: [
      { text: "Gesamtsumme:", confidence: 96 },
      { text: "O", confidence: 45 },
      { text: "800", confidence: 95 },
      { text: "€", confidence: 95 },
    ],
  },
  // Nacharbeit 9: ein längeres verlesenes Zahlenpräfix („1.000“ als „l.OOO“, unsicher).
  PRAEFIX: {
    status: "success",
    text: "Gesamtsumme: l.OOO 800 €",
    woerter: [
      { text: "Gesamtsumme:", confidence: 96 },
      { text: "l.OOO", confidence: 40 },
      { text: "800", confidence: 95 },
      { text: "€", confidence: 95 },
    ],
  },
  // Nacharbeit 10: ein eigenständiges Bezugswort aus verwechselbaren Buchstaben, unsicher gelesen.
  SOLO: {
    status: "success",
    text: "Solo 800 €",
    woerter: [
      { text: "Solo", confidence: 45 },
      { text: "800", confidence: 95 },
      { text: "€", confidence: 95 },
    ],
  },
  // Nacharbeit 11: eigenständige Bezugswörter in Großschreibung, unsicher gelesen.
  SOLOGROSS: {
    status: "success",
    text: "SOLO 800 €",
    woerter: [
      { text: "SOLO", confidence: 45 },
      { text: "800", confidence: 95 },
      { text: "€", confidence: 95 },
    ],
  },
  BOSS: {
    status: "success",
    text: "BOSS 800 €",
    woerter: [
      { text: "BOSS", confidence: 45 },
      { text: "800", confidence: 95 },
      { text: "€", confidence: 95 },
    ],
  },
  TEILSICHER: sicher("Gesamtsumme: 800 €"),
  BEZUGUNSICHER: {
    status: "success",
    text: "Gesamtsumme 1.700 €",
    woerter: [
      { text: "Gesamtsumme", confidence: 45 },
      { text: "1.700", confidence: 95 },
      { text: "€", confidence: 95 },
    ],
  },
  // Eine Tabelle mit Wortrahmen: drei Zeilen, zwei Spalten (Bezeichnung | Betrag).
  TABELLE: {
    status: "success",
    text: "Position Betrag\nMaterial 1.200 €\nGesamtsumme 1.800 €",
    woerter: [
      { text: "Position", confidence: 95, bbox: { x0: 10, y0: 10, x1: 150, y1: 40 } },
      { text: "Betrag", confidence: 95, bbox: { x0: 400, y0: 10, x1: 520, y1: 40 } },
      { text: "Material", confidence: 95, bbox: { x0: 10, y0: 60, x1: 150, y1: 90 } },
      { text: "1.200", confidence: 95, bbox: { x0: 400, y0: 60, x1: 480, y1: 90 } },
      { text: "€", confidence: 95, bbox: { x0: 490, y0: 60, x1: 510, y1: 90 } },
      { text: "Gesamtsumme", confidence: 95, bbox: { x0: 10, y0: 110, x1: 220, y1: 140 } },
      { text: "1.800", confidence: 95, bbox: { x0: 400, y0: 110, x1: 480, y1: 140 } },
      { text: "€", confidence: 95, bbox: { x0: 490, y0: 110, x1: 510, y1: 140 } },
    ],
  },
  VZGLEICH: sicher("Saldo −1.500,00 EUR\nAbweichung -12 Prozent\nTemperatur −5\nVerlust € -1.500"),
  FEHLER: {
    status: "success",
    text: "Gesamtsumme 1.300 €",
    woerter: [
      { text: "Gesamtsumme", confidence: 96 },
      { text: "1.300", confidence: 41 },
      { text: "€", confidence: 93 },
    ],
  },
  UNLESBAR: {
    status: "success",
    text: "Gesamtsumme 1.300 €",
    woerter: [
      { text: "Gesamtsumme", confidence: 96 },
      { text: "1.300", confidence: 18 },
      { text: "€", confidence: 93 },
    ],
  },
};

function engine() {
  return vi.fn(async (src: string): Promise<OcrResult> => {
    return BILDTEXT[markeAus(src) ?? ""] ?? sicher("");
  });
}

const figur = (marke: string, id: string): string =>
  `<figure><img data-image-id="${id}" src="${dataUrl(bildMit(marke))}"></figure>`;

const QUELLE = "Abrechnung";

async function lese(html: string) {
  await i18n.changeLanguage("de");
  const eingang = rumpfBildEingang(QUELLE, html);
  const befund = await createBildAnalyse({ erkenne: engine() }).analysiereQuelle(eingang, {
    automatik: true,
  });
  // Derselbe Dokumenttext wie im Editor (`BildBefundeImRumpf`: `htmlToPlainText` des Rumpfs).
  const dokument = htmlToPlainText(html);
  const bewerte = (quellen: readonly QuellenBefund[] = [befund]) =>
    bildWidersprueche(dokument, klaraBildKontext("", quellen, t, ortVon, [eingang]));
  return { eingang, befund, dokument, bewerte };
}

/** Eine Berichtigung in der Form von OCR-E02: der berichtigte Text steht an der Stelle des Rohtexts. */
function berichtigt(q: QuellenBefund, bild: number, text: string): QuellenBefund {
  return {
    ...q,
    befunde: q.befunde.map((b) =>
      b.fundstelle.bild === bild ? { ...b, text, textGekennzeichnet: text, unsicher: [] } : b,
    ),
  };
}

const MISCHDOKUMENT = [
  "<h2>Abrechnung Projekt Nord</h2>",
  "<p>Die Gesamtsumme beträgt 1.500 €.</p>",
  figur("SUMME", "kw-1"),
  "<p>Lieferdatum ist der 12.10.2026.</p>",
  "<p>Die Anzahlung beträgt 300 €.</p>",
  figur("ANGABEN", "kw-2"),
  "<p>Ansprechpartnerin: Clara Berg.</p>",
  figur("NAME", "kw-3"),
].join("");

describe("W1 · K1 — 1.500 € im Text, 1.800 € im Bild", () => {
  it("genau diese beiden Angaben, mit korrekten Fundstellen, als mögliche Abweichung", async () => {
    const { befund, dokument, bewerte } = await lese(MISCHDOKUMENT);
    expect(befund.befunde.map((b) => b.status)).toEqual(["gelesen", "gelesen", "gelesen"]);
    expect(dokument).toContain("Die Gesamtsumme beträgt 1.500 €.");
    expect(dokument).not.toContain("1.800");

    const abw = bewerte();
    expect(abw).toHaveLength(1);
    const [a] = abw;
    expect(a).toMatchObject({
      art: "moeglicher-widerspruch",
      angabeArt: "betrag",
      sachverhalt: "Gesamtsumme",
    });
    expect(a?.text).toMatchObject({ wortlaut: "1.500 €", wert: "1500", einheit: "EUR" });
    expect(a?.text.fundstelle).toMatchObject({ art: "dokument", absatz: 1, satz: 1 });
    expect(a?.text.fundstelle.auszug).toContain("Gesamtsumme beträgt 1.500 €");
    expect(a?.bild).toMatchObject({ wortlaut: "1.800 €", wert: "1800", unsicher: false });
    // Bild 1 (nicht Bild 2 oder 3), Zeile 3 der tabellarischen Aufstellung.
    expect(a?.bild.fundstelle).toMatchObject({
      art: "bild",
      quelle: QUELLE,
      zeile: 3,
      fundstelle: { quelle: QUELLE, bild: 1, imageId: "kw-1" },
    });
    expect(a?.bild.fundstelle.auszug).toBe("Gesamtsumme 1.800 €");
    const bildOrt = ortVon({ quelle: QUELLE, art: "rumpf", bild: 1 }, QUELLE);
    expect(a ? angabeOrt(a.text, t) : "").toBe("Text, Absatz 1, Satz 1");
    expect(a ? angabeOrt(a.bild, t) : "").toBe(`${QUELLE} · ${bildOrt}, Zeile 3`);

    const satz = t("bildwidersprueche.beschreibung.moeglich", {
      sachverhalt: a?.sachverhalt ?? "",
      text: a?.text.wortlaut ?? "",
      bild: a?.bild.wortlaut ?? "",
    });
    expect(satz).toContain("„Gesamtsumme“");
    expect(satz).toContain("im Text 1.500 €, im Bild 1.800 €");
    expect(satz).toContain("welche stimmt, lässt sich daraus nicht sagen");
  });
});

describe("W2 · K2 — gleiche Werte und verschiedene Bezüge erzeugen keinen Hinweis", () => {
  const TEXT = [
    "<p>Die Gesamtsumme 2025 beträgt 1.500 €.</p>",
    "<p>Im 1. Quartal liegen die Kosten bei 400 €.</p>",
    "<p>Das Gewicht liegt bei 1.500 kg.</p>",
    "<p>Umsatz laut Version 2: 2.000 €.</p>",
    "<p>Die Rücklage beträgt 1,5 Tsd. €.</p>",
  ].join("");

  it("andere Jahre, Quartale, Versionen, Einheiten, gleiche Werte: leer", async () => {
    const { befund, bewerte } = await lese(
      `${TEXT}${figur("PERIODE", "kw-1")}${figur("EINHEIT", "kw-2")}`,
    );
    expect(befund.befunde.map((b) => b.status)).toEqual(["gelesen", "gelesen"]);
    expect(bewerte()).toEqual([]);
    // Und ohne jeden Bezug zwischen Text und Bild: das gleichlautende Mischdokument trägt nur den
    // einen echten Fall (W1) — Lieferdatum, Anzahlung (300 € = 300,00 EUR) und Name bleiben ruhig.
    const misch = await lese(MISCHDOKUMENT);
    expect(misch.bewerte().map((a) => a.sachverhalt)).toEqual(["Gesamtsumme"]);
  });

  it("Gegenprobe: derselbe Bezug (2025) mit anderem Wert ist eine mögliche Abweichung", async () => {
    const { bewerte } = await lese(`${TEXT}${figur("GEGEN", "kw-1")}`);
    const abw = bewerte();
    expect(abw).toHaveLength(1);
    expect(abw[0]?.text.wortlaut).toBe("1.500 €");
    expect(abw[0]?.bild.wortlaut).toBe("1.800 €");
    expect(abw[0]?.text.bezug).toEqual(["jahr:2025"]);
    expect(abw[0]?.bild.bezug).toEqual(["jahr:2025"]);
  });
});

describe("W3 · K3 — absichtlicher OCR-Fehler, Berichtigung, Neubewertung", () => {
  const TEXT = "<p>Die Gesamtsumme beträgt 1.500 €.</p>";

  it("unsicher gelesen ist kein Widerspruch; nach Berichtigung neu bewertet", async () => {
    const { befund, bewerte } = await lese(`${TEXT}${figur("FEHLER", "kw-1")}`);
    expect(befund.befunde[0]?.textGekennzeichnet).toBe("Gesamtsumme [?1.300] €");

    const roh = bewerte();
    expect(roh).toHaveLength(1);
    expect(roh[0]).toMatchObject({ art: "unsichere-erkennung", sachverhalt: "Gesamtsumme" });
    expect(roh[0]?.bild).toMatchObject({ wortlaut: "1.300 €", unsicher: true });

    // Berichtigt auf das, was im Bild steht → kein Hinweis mehr.
    expect(bewerte([berichtigt(befund, 1, "Gesamtsumme 1.500 €")])).toEqual([]);
    // Berichtigt auf einen anderen, sicheren Wert → mögliche Abweichung.
    const anders = bewerte([berichtigt(befund, 1, "Gesamtsumme 1.800 €")]);
    expect(anders).toHaveLength(1);
    expect(anders[0]).toMatchObject({ art: "moeglicher-widerspruch" });
    expect(anders[0]?.bild).toMatchObject({ wortlaut: "1.800 €", unsicher: false });
    // Zurück auf den Rohbefund → wieder nur „unsichere Erkennung“.
    expect(bewerte([befund])[0]?.art).toBe("unsichere-erkennung");
  });

  it("unleserlicher Wert: unsichere Erkennung, kein Widerspruch", async () => {
    const { befund, bewerte } = await lese(`${TEXT}${figur("UNLESBAR", "kw-1")}`);
    expect(befund.befunde[0]?.textGekennzeichnet).toBe("Gesamtsumme [unleserlich] €");
    const abw = bewerte();
    expect(abw.map((a) => a.art)).toEqual(["unsichere-erkennung"]);
    expect(abw[0]?.bild.wortlaut).toBe("[unleserlich] €");
  });
});

describe("W5 · K2/K1 — unterscheidende Sachverhaltsangaben (Nacharbeit 3)", () => {
  const TEXT = "<p>Gesamtsumme Projekt Nord: 1.500 €.</p>";

  it("verschiedene Projekte: kein Hinweis", async () => {
    const { befund, bewerte } = await lese(`${TEXT}${figur("WEST", "kw-1")}`);
    expect(befund.befunde[0]?.text).toBe("Gesamtsumme Projekt West: 1.800 €");
    expect(bewerte()).toEqual([]);
  });

  it("dasselbe Projekt mit abweichendem Betrag: mögliche Abweichung", async () => {
    const { bewerte } = await lese(`${TEXT}${figur("NORD", "kw-1")}`);
    const abw = bewerte();
    expect(abw).toHaveLength(1);
    expect(abw[0]).toMatchObject({
      art: "moeglicher-widerspruch",
      sachverhalt: "Gesamtsumme Projekt Nord",
    });
    expect(abw[0]?.text.wortlaut).toBe("1.500 €");
    expect(abw[0]?.bild.wortlaut).toBe("1.800 €");
  });
});

describe("W6 · K1/K2 — Vorzeichen bleiben erhalten (Nacharbeit 3)", () => {
  const TEXT = [
    "<p>Der Saldo beträgt -1.500 €.</p>",
    "<p>Die Abweichung liegt bei -12 %.</p>",
    "<p>Die Temperatur liegt bei -5.</p>",
  ].join("");

  it("zahlWert: das Vorzeichen bleibt, auch mit Tausenderpunkt", () => {
    expect(zahlWert("-1.500")).toBe(-1500);
    expect(zahlWert("−1.500,50")).toBe(-1500.5);
    expect(zahlWert("–1.500")).toBe(-1500);
    expect(zahlWert("+1.500")).toBe(1500);
    expect(zahlWert("1.500")).toBe(1500);
    expect(zahlWert("-1,5")).toBe(-1.5);
  });

  it("anderes Vorzeichen: Betrag, Zahl mit und ohne Einheit sind Abweichungen", async () => {
    const { bewerte } = await lese(`${TEXT}${figur("VZPOS", "kw-1")}`);
    const abw = bewerte();
    expect(abw.map((a) => [a.art, a.angabeArt, a.text.wortlaut, a.bild.wortlaut])).toEqual([
      ["moeglicher-widerspruch", "betrag", "-1.500 €", "1.500 €"],
      ["moeglicher-widerspruch", "zahl", "-12 %", "12 %"],
      ["moeglicher-widerspruch", "zahl", "-5", "5"],
    ]);
    expect(abw.map((a) => [a.text.wert, a.bild.wert])).toEqual([
      ["-1500", "1500"],
      ["-12", "12"],
      ["-5", "5"],
    ]);
    expect(abw[1]?.text.einheit).toBe("%");
  });

  it("gleichwertige negative Schreibweisen: kein Hinweis", async () => {
    const { befund, bewerte } = await lese(
      `${TEXT}<p>Der Verlust beträgt -1,5 Tsd. €.</p>${figur("VZGLEICH", "kw-1")}`,
    );
    expect(befund.befunde[0]?.status).toBe("gelesen");
    expect(bewerte()).toEqual([]);
  });
});

describe("W7 · K5/K6 — Quellwechsel und Vollständigkeit (Nacharbeit 7)", () => {
  const TEXT = "<p>Die Gesamtsumme beträgt 1.500 €.</p>";

  it("andere Quelle oder ausgetauschtes Bild: kein Hinweis aus dem alten Befund", async () => {
    const html = `${TEXT}${figur("SUMME", "kw-1")}`;
    const { befund, dokument, bewerte } = await lese(html);
    expect(bewerte()).toHaveLength(1);
    // Dieselbe Stelle trägt jetzt ein anderes Bild (anderer Anker) — der alte Befund gilt nicht.
    const getauscht = rumpfBildEingang(QUELLE, html.replace("kw-1", "kw-9"));
    const k1 = klaraBildKontext("", [befund], t, ortVon, [getauscht]);
    expect(bildWidersprueche(dokument, k1)).toEqual([]);
    // Eine andere Quelle mit demselben Rumpf — ebenfalls nichts aus diesem Befund.
    const fremd = rumpfBildEingang("Andere Quelle", html);
    const k2 = klaraBildKontext("", [befund], t, ortVon, [fremd]);
    expect(bildWidersprueche(dokument, k2)).toEqual([]);
  });

  it("ein Bild nicht gelesen: kein Hinweis daraus, Quelle nicht vollständig, Bild 2 trägt seinen", async () => {
    const html = `${TEXT}${figur("KAPUTT", "kw-1")}${figur("SUMME", "kw-2")}`;
    const { eingang, befund, bewerte } = await lese(html);
    expect(befund.befunde.map((b) => b.status)).toEqual(["fehlgeschlagen", "gelesen"]);
    expect(befund.status).not.toBe("vollstaendig");
    const k = klaraBildKontext("", [befund], t, ortVon, [eingang]);
    expect(k).toMatchObject({ vollstaendig: false, gelesen: 1, gesamt: 2 });
    const abw = bewerte();
    expect(abw).toHaveLength(1);
    expect(abw[0]?.bild.fundstelle).toMatchObject({ fundstelle: { bild: 2, imageId: "kw-2" } });
  });
});

describe("W8 · K5/K6 — Abweichung in einer Bildtabelle (Nacharbeit 7)", () => {
  it("die Tabelle behält Zeilen und Spalten; die Abweichung steht in ihrer Zeile", async () => {
    const { befund, bewerte } = await lese(
      `<p>Die Gesamtsumme beträgt 1.500 €.</p>${figur("TABELLE", "kw-1")}`,
    );
    expect(befund.befunde[0]?.tabelle).toEqual([
      ["Position", "Betrag"],
      ["Material", "1.200 €"],
      ["Gesamtsumme", "1.800 €"],
    ]);
    const abw = bewerte();
    expect(abw).toHaveLength(1);
    expect(abw[0]).toMatchObject({ art: "moeglicher-widerspruch", sachverhalt: "Gesamtsumme" });
    expect(abw[0]?.bild).toMatchObject({ wortlaut: "1.800 €" });
    expect(abw[0]?.bild.fundstelle).toMatchObject({ zeile: 3 });
  });
});

describe("W9 · K2/K3 — Unsicherheit der ganzen Zahlengruppe (Nacharbeit 8)", () => {
  const TEXT = "<p>Gesamtsumme: 1.800 €.</p>";

  it("„[unleserlich] 800 €“: unsichere Erkennung, kein Widerspruch", async () => {
    const { befund, bewerte } = await lese(`${TEXT}${figur("LUECKE", "kw-1")}`);
    expect(befund.befunde[0]?.textGekennzeichnet).toBe("Gesamtsumme: [unleserlich] 800 €");
    const abw = bewerte();
    expect(abw.map((a) => [a.art, a.bild.wortlaut, a.bild.unsicher])).toEqual([
      ["unsichere-erkennung", "800 €", true],
    ]);
  });

  it("„[?O] 800 €“: unsichere Erkennung, kein Widerspruch", async () => {
    const { befund, bewerte } = await lese(`${TEXT}${figur("VERLESEN", "kw-1")}`);
    expect(befund.befunde[0]?.textGekennzeichnet).toBe("Gesamtsumme: [?O] 800 €");
    const abw = bewerte();
    expect(abw.map((a) => [a.art, a.bild.wortlaut, a.bild.unsicher])).toEqual([
      ["unsichere-erkennung", "800 €", true],
    ]);
  });

  it("Nacharbeit 9 · „[?l.OOO] 800 €“ gegenüber „1.000.800 €“: unsichere Erkennung", async () => {
    const { befund, bewerte } = await lese(
      `<p>Gesamtsumme: 1.000.800 €.</p>${figur("PRAEFIX", "kw-1")}`,
    );
    expect(befund.befunde[0]?.textGekennzeichnet).toBe("Gesamtsumme: [?l.OOO] 800 €");
    const abw = bewerte();
    expect(abw.map((a) => [a.art, a.text.wortlaut, a.bild.wortlaut, a.bild.unsicher])).toEqual([
      ["unsichere-erkennung", "1.000.800 €", "800 €", true],
    ]);
  });

  it("Gegenproben: sicherer Betrag und unsicheres Bezugswort bleiben mögliche Abweichungen", async () => {
    const sicherer = await lese(`${TEXT}${figur("TEILSICHER", "kw-1")}`);
    expect(sicherer.bewerte().map((a) => [a.art, a.bild.wortlaut])).toEqual([
      ["moeglicher-widerspruch", "800 €"],
    ]);
    const bezug = await lese(`${TEXT}${figur("BEZUGUNSICHER", "kw-1")}`);
    expect(bezug.befund.befunde[0]?.textGekennzeichnet).toBe("[?Gesamtsumme] 1.700 €");
    expect(bezug.bewerte().map((a) => [a.art, a.bild.wortlaut, a.bild.unsicher])).toEqual([
      ["moeglicher-widerspruch", "1.700 €", false],
    ]);
    // Nacharbeit 10 (Ben): „Solo“ besteht nur aus verwechselbaren Buchstaben, ist aber ein Wort —
    // kein Zahlenpräfix. Die sicher gelesenen 800 € bleiben eine mögliche Abweichung zu 1.500 €.
    const solo = await lese(`<p>Solo 1.500 €.</p>${figur("SOLO", "kw-1")}`);
    expect(solo.befund.befunde[0]?.textGekennzeichnet).toBe("[?Solo] 800 €");
    const soloAbw = solo.bewerte();
    const zeilen = soloAbw.map((a) => [a.art, a.text.wortlaut, a.bild.wortlaut, a.bild.unsicher]);
    expect(zeilen).toEqual([["moeglicher-widerspruch", "1.500 €", "800 €", false]]);
  });

  it("Nacharbeit 11 · Großschreibung: „[?SOLO]“ und „[?BOSS]“ sind Bezugswörter, keine Präfixe", async () => {
    const zeile = (a: BildTextAbweichung) => [
      a.art,
      a.text.wortlaut,
      a.bild.wortlaut,
      a.bild.unsicher,
    ];
    const abweichung = [["moeglicher-widerspruch", "1.500 €", "800 €", false]];
    const solo = await lese(`<p>SOLO 1.500 €.</p>${figur("SOLOGROSS", "kw-1")}`);
    expect(solo.befund.befunde[0]?.textGekennzeichnet).toBe("[?SOLO] 800 €");
    expect(solo.bewerte().map(zeile)).toEqual(abweichung);
    // „BOSS“ besteht nur aus verwechselbaren Zeichen und hat keine Kleinbuchstaben — dass es ein
    // Bezugswort ist, zeigt erst der Text, der denselben Sachverhalt so benennt.
    const boss = await lese(`<p>BOSS 1.500 €.</p>${figur("BOSS", "kw-1")}`);
    expect(boss.befund.befunde[0]?.textGekennzeichnet).toBe("[?BOSS] 800 €");
    expect(boss.bewerte().map(zeile)).toEqual(abweichung);
    // Erhalten: ein verlesenes Zahlenpräfix steht nie als Wort im Text — es bleibt unsicher.
    const praefix = await lese(`<p>Gesamtsumme: 1.000.800 €.</p>${figur("PRAEFIX", "kw-1")}`);
    expect(praefix.bewerte().map(zeile)).toEqual([
      ["unsichere-erkennung", "1.000.800 €", "800 €", true],
    ]);
  });
});

describe("W4 · K4 — Originale bleiben, Klara entscheidet nicht ohne Beleg", () => {
  let wurzel: HTMLDivElement | null = null;
  afterEach(() => {
    wurzel?.remove();
    wurzel = null;
  });

  it("nichts wird verändert; die Anweisung nennt beide Angaben und verbietet die Entscheidung", async () => {
    const html = MISCHDOKUMENT;
    const { eingang, befund, dokument, bewerte } = await lese(html);
    const befundVorher = structuredClone(befund);
    const quellenVorher = eingang.vorkommen.map((v) => v.src);
    const abw = bewerte();
    widerspruchsAnweisung(abw, t);
    expect(befund).toEqual(befundVorher);
    expect(eingang.vorkommen.map((v) => v.src)).toEqual(quellenVorher);
    expect(htmlToPlainText(html)).toBe(dokument);

    const anweisung = widerspruchsAnweisung(abw, t);
    expect(anweisung).toContain("1.500 € (Text, Absatz 1, Satz 1)");
    expect(anweisung).toContain(`1.800 € ([${QUELLE} · `);
    expect(anweisung).toContain("entscheide nicht ohne Beleg, welche stimmt");
    expect(widerspruchsAnweisung([], t)).toBe("");
  });

  it("die Klara-Fläche zeigt beide Seiten, gibt sie an Klara weiter und bewertet neu", async () => {
    const html = `<p>Die Gesamtsumme beträgt 1.500 €.</p>${figur("FEHLER", "kw-1")}`;
    const { eingang, befund, dokument } = await lese(html);
    const anfragen: { text: string; anweisung: string }[] = [];
    // Ein Modellweg, der nur aufzeichnet — kein Modell, kein Netz.
    const wert = {
      available: false,
      describe: async () => ({ text: "", demo: true }),
      frageVerfuegbar: true,
      frage: async (text: string, anweisung: string) => {
        anfragen.push({ text, anweisung });
        return { text: "Antwort", demo: false };
      },
    } as unknown as ImageDescribeValue;
    wurzel = document.createElement("div");
    document.body.append(wurzel);
    const root = createRoot(wurzel);
    const zeige = async (quellen: QuellenBefund[], aktuell: BildQuelleEingang[]) => {
      await act(async () => {
        // `children` als Prop: der Provider verlangt sie im Typ ausdrücklich.
        root.render(
          createElement(ImageDescribeValueProvider, {
            value: wert,
            children: createElement(KlaraBildKontextFrage, {
              kontextSchluessel: "rumpf:1",
              dokumentTextVon: () => dokument,
              quellen,
              aktuell,
            }),
          }),
        );
      });
    };
    const eintraege = () =>
      [...document.querySelectorAll("[data-testid=bild-widerspruch]")].map((el) => ({
        art: el.getAttribute("data-art"),
        text: el.querySelector("[data-testid=bild-widerspruch-text-wert]")?.textContent,
        bild: el.querySelector("[data-testid=bild-widerspruch-bild-wert]")?.textContent,
        bildOrt: el.querySelector("[data-testid=bild-widerspruch-bild-ort]")?.textContent ?? "",
      }));

    // Roh: der Bildwert ist unsicher gelesen.
    await zeige([befund], [eingang]);
    expect(eintraege()).toEqual([
      {
        art: "unsichere-erkennung",
        text: "1.500 €",
        bild: "1.300 €",
        bildOrt: expect.stringContaining(`${QUELLE} · `),
      },
    ]);
    expect(document.body.textContent).toContain(i18n.t("bildwidersprueche.art.unsicher") as string);

    // Anders berichtigt: mögliche Abweichung — und Klara bekommt beide Angaben mit Fundstelle.
    await zeige([berichtigt(befund, 1, "Gesamtsumme 1.800 €")], [eingang]);
    expect(eintraege().map((e) => [e.art, e.text, e.bild])).toEqual([
      ["moeglicher-widerspruch", "1.500 €", "1.800 €"],
    ]);
    const knopf = document.querySelector("[data-testid=klara-bild-kontext-zusammenfassen]");
    await act(async () => {
      (knopf as HTMLButtonElement).click();
    });
    expect(anfragen).toHaveLength(1);
    expect(anfragen[0]?.text).toContain("1.500 €");
    expect(anfragen[0]?.text).toContain("Gesamtsumme 1.800 €");
    expect(anfragen[0]?.anweisung).toContain("1.500 € (Text, Absatz 1, Satz 1)");
    expect(anfragen[0]?.anweisung).toContain("entscheide nicht ohne Beleg, welche stimmt");

    // Richtig berichtigt: kein Hinweis mehr.
    await zeige([berichtigt(befund, 1, "Gesamtsumme 1.500 €")], [eingang]);
    expect(document.querySelector("[data-testid=bild-widersprueche]")).toBeNull();
    // Der Rohbefund selbst ist unverändert geblieben.
    expect(befund.befunde[0]?.textGekennzeichnet).toBe("Gesamtsumme [?1.300] €");
    await act(async () => {
      root.unmount();
    });
  });
});
