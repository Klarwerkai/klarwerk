// ================================================================================================
// OCR-E01/E02 · WIRKUNG IN DEN KONTROLLIERTEN FORMATEN DER GEMEINSAMEN ABNAHME (K10/K11).
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-fundstellen-korrekturen, Nacharbeit 2 (Bens Befund K10/K11).
// Geprüft wird AUSSCHLIESSLICH die E01/E02-Wirkung — Fundstelle am Original und Berichtigung — in
// den Formaten der gemeinsamen Abnahme. Neue Funktionen von OCR-E03 bis E06 (bearbeitbare Tabellen,
// PDF-Scanlesen, Widerspruchserkennung, Bereichsfrage) werden NICHT vorausgesetzt; deren Grenzen
// stehen in den Fällen ausdrücklich.
//
// Kontrollierte Fixtures: Bilder mit echtem PNG-Kopf, die echte PPTX-Importkette (`deck.ts`), eine
// Erkennung mit bekannten Wörtern und Rahmen (wie tesseract.js). Echt sind Analyse, Zuordnung,
// Markierung, Berichtigung und Klaras Kontext.
//
//   W1  Tabelle: Fundstelle einer Zelle; Berichtigung einer falsch erkannten Zelle wirkt im Text
//       und in Klaras Kontext; die erkannte Tabelle bleibt als Rohbefund (Grenze: keine
//       Tabellenbearbeitung, das ist OCR-E03).
//   W2  Mehrseitig (Seiten als Bilder im unterstützten Erfassungsweg PowerPoint): erste und letzte
//       Seite führen zu ihrem Bild, eine fehlgeschlagene Seite bleibt sichtbar, die Berichtigung
//       der letzten Seite wirkt nur dort (Grenze: gescannte PDF-Seiten liest der Bestand nicht).
//   W3  Gemischtes Dokument: nativer Folientext bleibt unverändert und genau einmal im Kontext,
//       jedes Bild ist zugeordnet, die Berichtigung steht nur im Bildtext.
//   W4  Tatsächliche und scheinbare Zahlenabweichung: getrennte Fundstellen je Bild; die
//       Berichtigung eines Lesefehlers wirkt nur lokal (keine Widerspruchsbewertung, OCR-E05).
//   W5  Ausgewählter Bildbereich in einem Bild mit zwei Textblöcken: die gewählte Stelle markiert
//       nur ihren Block — auch nach einer Berichtigung im anderen Block (keine Bereichsfrage, E06).
import { describe, expect, it } from "vitest";
import {
  type BildBefund,
  type QuellenBefund,
  createBildAnalyse,
  einzelbildEingang,
  pptxBildEingang,
} from "../../apps/web/src/lib/bildAutomatik";
import { type Bereich, markierung, textStellen } from "../../apps/web/src/lib/bildFundstelle";
import {
  type BildKorrekturDaten,
  befundMitKorrektur,
  korrekturQuelleFuer,
  ortKennung,
  quellenMitKorrekturen,
} from "../../apps/web/src/lib/bildKorrektur";
import { klaraBildKontext } from "../../apps/web/src/lib/klaraBildKontext";
import type { OcrResult, OcrWort } from "../../apps/web/src/lib/ocr";
import { FOLIENTEXT, bildMitMassen, dataUrl, deck, lesePptx, markeAus } from "./deck";

function wort(text: string, x0: number, y0: number, x1: number, y1: number): OcrWort {
  return { text, confidence: 95, bbox: { x0, y0, x1, y1 } };
}

type Erkannt = { text: string; woerter?: OcrWort[]; fehler?: boolean };

function engine(je: Record<string, Erkannt>) {
  return async (src: string): Promise<OcrResult> => {
    const e = je[markeAus(src) ?? ""];
    if (!e) {
      return { status: "success", text: "" };
    }
    if (e.fehler) {
      return { status: "failed", text: "", error: "Seite nicht lesbar" };
    }
    return e.woerter
      ? { status: "success", text: e.text, woerter: e.woerter }
      : { status: "success", text: e.text };
  };
}

const t = (k: string, w?: Record<string, string | number>): string =>
  w && Object.keys(w).length > 0 ? `${k}${JSON.stringify(w)}` : k;
const ortVon = (f: BildBefund["fundstelle"]): string =>
  f.folie !== undefined ? `Folie ${f.folie}, Bild ${f.bildAufFolie ?? 1}` : `Bild ${f.bild}`;

function korrektur(praefix: string, b: BildBefund, text: string): BildKorrekturDaten {
  return {
    quelle: korrekturQuelleFuer(praefix, b.fundstelle),
    inhaltskennung: b.inhaltskennung ?? "",
    ort: ortKennung(b.fundstelle),
    text,
    schritte: 0,
    geaendertAm: "2026-10-13T10:00:00.000Z",
  };
}

/** Der Bereich der Stelle `text` (Groß-/Kleinschreibung egal) im angezeigten Text des Befunds. */
function bereichVon(b: BildBefund, text: string): Bereich {
  const s = textStellen(b.textGekennzeichnet, b.woerter).find(
    (x) => x.text.toLowerCase() === text.toLowerCase(),
  );
  if (!s) {
    throw new Error(`keine Stelle „${text}“`);
  }
  const m = markierung(b, [s.wort]);
  if (m.art !== "bereich" || !m.bereiche[0]) {
    throw new Error(`keine Markierung für „${text}“`);
  }
  return m.bereiche[0];
}

function nahe(ist: Bereich, soll: Bereich): void {
  expect(ist.links).toBeCloseTo(soll.links, 6);
  expect(ist.oben).toBeCloseTo(soll.oben, 6);
  expect(ist.breite).toBeCloseTo(soll.breite, 6);
  expect(ist.hoehe).toBeCloseTo(soll.hoehe, 6);
}

async function einzeln(
  name: string,
  marke: string,
  b: number,
  h: number,
  je: Record<string, Erkannt>,
) {
  const eingang = einzelbildEingang(name, dataUrl(bildMitMassen(marke, b, h)));
  const q = await createBildAnalyse({ erkenne: engine(je) }).analysiereQuelle(eingang, {
    automatik: true,
  });
  const befund = q.befunde[0];
  if (!befund) {
    throw new Error("kein Befund");
  }
  return { q, befund };
}

describe("W1 · Tabelle — Fundstelle einer Zelle und Berichtigung einer Zelle", () => {
  // 1000 × 300: drei Zeilen, drei Spalten; „1O“ ist ein absichtlicher Lesefehler (Buchstabe O).
  const TABELLE: Erkannt = {
    text: "Teil Menge Preis\nVentil 4 12,50\nDichtung 1O 0,80",
    woerter: [
      wort("Teil", 20, 10, 120, 50),
      wort("Menge", 400, 10, 520, 50),
      wort("Preis", 750, 10, 860, 50),
      wort("Ventil", 20, 110, 150, 150),
      wort("4", 400, 110, 420, 150),
      wort("12,50", 750, 110, 860, 150),
      wort("Dichtung", 20, 210, 200, 250),
      wort("1O", 400, 210, 440, 250),
      wort("0,80", 750, 210, 840, 250),
    ],
  };

  it("die Zelle „12,50“ führt zu ihrem Bereich; „1O“ → „10“ wirkt in Text und Klara", async () => {
    const { q, befund } = await einzeln("teileliste.png", "T", 1000, 300, { T: TABELLE });
    expect(befund.tabelle).toEqual([
      ["Teil", "Menge", "Preis"],
      ["Ventil", "4", "12,50"],
      ["Dichtung", "1O", "0,80"],
    ]);
    nahe(bereichVon(befund, "12,50"), { links: 75, oben: 110 / 3, breite: 11, hoehe: 40 / 3 });

    const praefix = "anhang";
    const text = "Teil Menge Preis\nVentil 4 12,50\nDichtung 10 0,80";
    const [wirksam] = quellenMitKorrekturen([q], praefix, [korrektur(praefix, befund, text)]);
    const b = wirksam?.befunde[0];
    if (!b) {
      throw new Error("kein Befund");
    }
    expect(b.textGekennzeichnet).toBe(text);
    // Die berichtigte Zelle steht an der Stelle der erkannten („1O“).
    nahe(bereichVon(b, "10"), { links: 40, oben: 70, breite: 4, hoehe: 40 / 3 });
    // Klara bekommt die Berichtigung, nicht den Lesefehler.
    const k = klaraBildKontext("", [wirksam as QuellenBefund], t, ortVon);
    expect(quelltext(k.kontext)).toContain("Dichtung 10 0,80");
    expect(quelltext(k.kontext)).not.toContain("1O");
    // Grenze (OCR-E03): die erkannte Tabelle wird nicht nachgebaut, sie bleibt als Rohbefund.
    expect(b.tabelle).toBeNull();
    expect(b.korrektur?.rohTabelle?.[2]).toEqual(["Dichtung", "1O", "0,80"]);
  });
});

describe("W2 · Mehrseitig — erste und letzte Seite, Teilfehler, Berichtigung der letzten Seite", () => {
  // Seiten als Bilder in einer PowerPoint (unterstützter Weg): Seite 1 = Folie 1, Seiten 2 und 3 =
  // Folie 2; die dritte Datei auf Folie 2 (BMP) wird nicht übernommen und ist gezählt.
  const SEITEN: Record<string, Erkannt> = {
    S1: { text: "Seite 1 Einleitung", woerter: [wort("Einleitung", 100, 100, 400, 160)] },
    S2: { text: "", fehler: true },
    S3: { text: "Seite 3 Ergebnis 7O", woerter: [wort("Ergebnis", 100, 500, 400, 560)] },
  };

  it("Seite 1 und 3 öffnen ihr Bild; Seite 2 bleibt als Fehler sichtbar; Berichtigung nur Seite 3", async () => {
    const pptx = await lesePptx(
      deck(bildMitMassen("S2", 800, 1000), {
        a: bildMitMassen("S1", 800, 1000),
        c: bildMitMassen("S3", 800, 1000),
      }),
    );
    const eingang = pptxBildEingang("scan.pptx", pptx.html, pptx);
    const q = await createBildAnalyse({ erkenne: engine(SEITEN) }).analysiereQuelle(eingang, {
      automatik: true,
    });
    const seiten = q.befunde.map((b) => [b.fundstelle.folie, b.fundstelle.bildAufFolie, b.status]);
    expect(seiten).toEqual([
      [1, 1, "gelesen"],
      [2, 1, "fehlgeschlagen"],
      [2, 2, "gelesen"],
    ]);
    // Nichts wird still ausgelassen: Teilfehler und nicht übernommene Seite stehen im Status.
    expect(q.status).toBe("teilweise");
    expect(q.nichtGelesen).toEqual([{ folie: 2, anzahl: 1 }]);
    const [erste, , letzte] = q.befunde;
    if (!erste || !letzte) {
      throw new Error("Seiten fehlen");
    }
    nahe(bereichVon(erste, "Einleitung"), { links: 12.5, oben: 10, breite: 37.5, hoehe: 6 });
    nahe(bereichVon(letzte, "Ergebnis"), { links: 12.5, oben: 50, breite: 37.5, hoehe: 6 });

    const praefix = "datei:sha256:00|scan.pptx";
    const liste = [korrektur(praefix, letzte, "Seite 3 Ergebnis 70")];
    const [wirksam] = quellenMitKorrekturen([q], praefix, liste);
    expect(wirksam?.befunde.map((b) => b.textGekennzeichnet)).toEqual([
      "Seite 1 Einleitung",
      "",
      "Seite 3 Ergebnis 70",
    ]);
    const k = klaraBildKontext("", [wirksam as QuellenBefund], t, ortVon);
    expect(quelltext(k.kontext)).toContain(
      "[scan.pptx · Folie 2, Bild 2] bildfundstelle.kontext.textBerichtigt: Seite 3 Ergebnis 70",
    );
    expect(quelltext(k.kontext)).toContain(
      "[scan.pptx · Folie 2, Bild 1] klarabildkontext.kontext.offen",
    );
    expect(k.vollstaendig).toBe(false);
  });
});

describe("W3 · Gemischtes Dokument — nativer Text unverändert, jedes Bild zugeordnet", () => {
  it("Folientext genau einmal, Bilder mit Folie, Berichtigung nur im Bildtext", async () => {
    const pptx = await lesePptx(
      deck(bildMitMassen("B", 600, 200), {
        a: bildMitMassen("A", 600, 200),
        c: bildMitMassen("C", 600, 200),
      }),
    );
    const eingang = pptxBildEingang("plan.pptx", pptx.html, pptx);
    const je: Record<string, Erkannt> = {
      A: { text: "PRUEFKARTE 47", woerter: [wort("PRUEFKARTE", 10, 10, 300, 60)] },
      B: { text: "VENTIL 8E", woerter: [wort("VENTIL", 10, 10, 200, 60)] },
      C: { text: "LAGER 29", woerter: [wort("LAGER", 10, 10, 200, 60)] },
    };
    const q = await createBildAnalyse({ erkenne: engine(je) }).analysiereQuelle(eingang, {
      automatik: true,
    });
    const b = q.befunde[1];
    if (!b) {
      throw new Error("kein Befund");
    }
    const praefix = "datei:sha256:00|plan.pptx";
    const [wirksam] = quellenMitKorrekturen([q], praefix, [korrektur(praefix, b, "VENTIL 83")]);
    const k = klaraBildKontext(pptx.text, [wirksam as QuellenBefund], t, ortVon);
    // Jeder Folientext steht so oft im Kontext wie in der Datei — nichts doppelt durch die Bilder.
    const anzahl = (text: string, teil: string): number => text.split(teil).length - 1;
    for (const zeile of FOLIENTEXT) {
      expect(anzahl(pptx.text, zeile), zeile).toBeGreaterThan(0);
      expect(anzahl(k.kontext, zeile), zeile).toBe(anzahl(pptx.text, zeile));
    }
    // Jedes übernommene Bild steht mit seiner Folie im Kontext; das nicht übernommene ist gezählt.
    expect(k.eintraege.map((e) => e.ort)).toEqual([
      "Folie 1, Bild 1",
      "Folie 2, Bild 1",
      "Folie 2, Bild 2",
    ]);
    expect(k.gesamt).toBe(4);
    expect(quelltext(k.kontext)).toContain("VENTIL 83");
    expect(quelltext(k.kontext)).not.toContain("VENTIL 8E");
    // Der native Text der Datei ist durch die Berichtigung nicht verändert.
    expect(quelltext(k.kontext).startsWith(pptx.text.trim())).toBe(true);
  });
});

describe("W4 · Tatsächliche und scheinbare Zahlenabweichung — getrennte Fundstellen, lokale Berichtigung", () => {
  it("1.800 (tatsächlich) bleibt; 1.5OO (Lesefehler) → 1.500 nur in seinem Bild", async () => {
    const dokument = "Gesamtsumme laut Vertrag: 1.500 €.";
    const tatsaechlich = await einzeln("angebot.png", "P", 1000, 200, {
      P: { text: "Gesamtsumme 1.800 €", woerter: [wort("1.800", 500, 50, 700, 120)] },
    });
    const scheinbar = await einzeln("rechnung.png", "Q", 800, 400, {
      Q: { text: "Gesamtsumme 1.5OO €", woerter: [wort("1.5OO", 100, 300, 300, 360)] },
    });
    // Getrennte Fundstellen je Bild und Zahl.
    nahe(bereichVon(tatsaechlich.befund, "1.800"), { links: 50, oben: 25, breite: 20, hoehe: 35 });
    nahe(bereichVon(scheinbar.befund, "1.5OO"), { links: 12.5, oben: 75, breite: 25, hoehe: 15 });

    const praefix = "anhang";
    const liste = [korrektur(praefix, scheinbar.befund, "Gesamtsumme 1.500 €")];
    const p = befundMitKorrektur(tatsaechlich.befund, null);
    const [qWirksam] = quellenMitKorrekturen([scheinbar.q], praefix, liste);
    const [pWirksam] = quellenMitKorrekturen([tatsaechlich.q], praefix, liste);
    // Die Berichtigung gilt nur für ihr Bild; die tatsächliche Abweichung bleibt stehen.
    expect(qWirksam?.befunde[0]?.textGekennzeichnet).toBe("Gesamtsumme 1.500 €");
    expect(pWirksam?.befunde[0]?.textGekennzeichnet).toBe("Gesamtsumme 1.800 €");
    expect(p.korrektur).toBeUndefined();
    // Die berichtigte Zahl führt weiter zu ihrer Stelle im eigenen Bild.
    const q0 = qWirksam?.befunde[0];
    if (!q0) {
      throw new Error("kein Befund");
    }
    nahe(bereichVon(q0, "1.500"), { links: 12.5, oben: 75, breite: 25, hoehe: 15 });
    // Klara bekommt beide Angaben mit ihrer Fundstelle; der Dokumenttext bleibt unverändert.
    const k = klaraBildKontext(
      dokument,
      [pWirksam as QuellenBefund, qWirksam as QuellenBefund],
      t,
      ortVon,
    );
    expect(quelltext(k.kontext)).toContain(dokument);
    expect(quelltext(k.kontext)).toContain(
      "[angebot.png · Bild 1] klarabildkontext.kontext.text: Gesamtsumme 1.800 €",
    );
    expect(quelltext(k.kontext)).toContain(
      "[rechnung.png · Bild 1] bildfundstelle.kontext.textBerichtigt: Gesamtsumme 1.500 €",
    );
    expect(quelltext(k.kontext)).not.toContain("1.5OO");
  });
});

describe("W5 · Ausgewählter Bereich — zwei Textblöcke in einem Bild", () => {
  it("„34“ markiert nur den unteren Block; nach Berichtigung oben bleibt die Zuordnung", async () => {
    const BLOECKE: Erkannt = {
      text: "ANGEB0T 12\nRECHNUNG 34",
      woerter: [
        wort("ANGEB0T", 40, 40, 300, 100),
        wort("12", 320, 40, 380, 100),
        wort("RECHNUNG", 600, 600, 880, 660),
        wort("34", 900, 600, 960, 660),
      ],
    };
    const { q, befund } = await einzeln("aushang.png", "M", 1000, 800, { M: BLOECKE });
    const unten = bereichVon(befund, "34");
    nahe(unten, { links: 90, oben: 75, breite: 6, hoehe: 7.5 });
    // Nur ein Bereich, und er liegt vollständig im unteren rechten Block.
    const s = textStellen(befund.textGekennzeichnet, befund.woerter).find((x) => x.text === "34");
    const m = markierung(befund, [s?.wort ?? null]);
    expect(m.art === "bereich" ? m.bereiche.length : 0).toBe(1);
    expect(unten.links).toBeGreaterThan(50);
    expect(unten.oben).toBeGreaterThan(50);

    const praefix = "anhang";
    const liste = [korrektur(praefix, befund, "ANGEBOT 12\nRECHNUNG 34")];
    const [wirksam] = quellenMitKorrekturen([q], praefix, liste);
    const b = wirksam?.befunde[0];
    if (!b) {
      throw new Error("kein Befund");
    }
    nahe(bereichVon(b, "34"), { links: 90, oben: 75, breite: 6, hoehe: 7.5 });
    // Das berichtigte Wort oben führt zu SEINEM Block, nicht zum unteren.
    nahe(bereichVon(b, "ANGEBOT"), { links: 4, oben: 5, breite: 26, hoehe: 7.5 });
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
