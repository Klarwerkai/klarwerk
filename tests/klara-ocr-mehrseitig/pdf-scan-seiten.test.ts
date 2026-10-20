// ================================================================================================
// OCR-E04 · VOLLSTÄNDIG GESCANNTE, MEHRSEITIGE DOKUMENTE AUTOMATISCH LESEN — Verhalten des Kerns.
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-mehrseitige-scans, Revision 1.
//
// Kontrollierte PDF mit bekanntem Inhalt (`scan-pdf.ts`), an der ECHTEN pdfjs-Engine gelesen (Text-
// ebene je Seite, und ob eine Seite ein Bild zeichnet). Ersetzt sind nur das Zeichnen der Seite und
// die Texterkennung — damit Inhalt, Fehler und Laufzeit je Seite steuerbar sind. Die echte Erkennung
// im Browser misst `tests-smoke/klara-ocr-mehrseitige-scans-browser.spec.ts`.
//
//   S1  Seitenarten aus der echten Engine: Bildseite, Textseite, gemischte Seite.
//   S2  Ein mehrseitiger Scan wird ohne separaten Auftrag Seite für Seite gelesen, in Reihenfolge,
//       mit Zeilen/Absätzen; „vollständig“ erst, wenn jede Seite gelesen ist.
//   S3  Fragen zur ersten und letzten Seite: Fundstelle mit der richtigen Seitenzahl.
//   S4  Gemischte Datei: keine Bildseite still ausgelassen, keine Passage doppelt im Kontext.
//   S5  Fehler auf einer Seite: Fehler sichtbar, die übrigen Seiten gelesen und im Kontext.
//   S6  Laufend, aus, fehlende Seiten über der Grenze — jeweils im Status, nie „vollständig“.
//   S7  Gleiche Seitenbilder werden nicht zweimal erkannt; ein Lauf, der abbricht, startet nichts.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import {
  type BildFundstelle,
  type QuellenBefund,
  createBildAnalyse,
} from "../../apps/web/src/lib/bildAutomatik";
import {
  belegstellen,
  klaraAnweisung,
  klaraBildKontext,
} from "../../apps/web/src/lib/klaraBildKontext";
import type { OcrResult } from "../../apps/web/src/lib/ocr";
import { MAX_PDF_PAGES, type PdfEngine, extractPdfDocument } from "../../apps/web/src/lib/pdf";
import {
  type PdfScanEingang,
  lesePdfSeiten,
  ohneDoppelteZeilen,
  pdfQuellenStatus,
  pdfScanEingang,
  pdfSeitenPlan,
  pdfSeitenText,
  pdfSeitenTexte,
} from "../../apps/web/src/lib/pdfScanSeiten";
import { grauBild, scanPdf } from "./scan-pdf";

const require = createRequire(import.meta.url);

/** Der `legacy`-Build — derselbe, den `files.ts` im Browser lazy lädt, samt Bildbefehlen. */
async function echteEngine(): Promise<PdfEngine> {
  const pdfjs = (await import(
    "../../apps/web/node_modules/pdfjs-dist/legacy/build/pdf.mjs"
  )) as unknown as PdfEngine & {
    GlobalWorkerOptions?: { workerSrc: string };
    OPS: Record<string, number>;
  };
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
      "../../apps/web/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    );
  }
  const namen = ["paintImageXObject", "paintInlineImageXObject", "paintImageMaskXObject"];
  const bildBefehle = namen.flatMap((n) => {
    const nr = pdfjs.OPS[n];
    return typeof nr === "number" ? [nr] : [];
  });
  return { getDocument: (src) => pdfjs.getDocument(src), bildBefehle };
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const kopie = new Uint8Array(bytes.byteLength);
  kopie.set(bytes);
  return kopie.buffer;
}

const NAME = "fiktiver-wartungsbericht-scan.pdf";

// Bekannter Inhalt je Seite: was die Texterkennung auf der gezeichneten Seite „liest“.
const SCAN_TEXT: Record<number, string> = {
  1: "WARTUNGSBERICHT ANLAGE 7\n\nPruefkarte 47 wurde am Montag abgezeichnet.",
  2: "Abschnitt Druckpruefung\n\nDer Druck betrug 4,5 bar.",
  3: "Abschnitt Ventile\n\nVentil V3 wurde getauscht.",
  4: "ABSCHLUSS\n\nLager 29 ist freigegeben.",
};

/** Das „gezeichnete“ Seitenbild: eine Bild-data-URL je Seite mit unterscheidbaren Bytes. */
function seitenBild(seite: number): string {
  return `data:image/png;base64,${Buffer.from(`seite-${seite}`).toString("base64")}`;
}

function zeichneStub(fehlerAuf: ReadonlySet<number> = new Set()) {
  const aufrufe: number[] = [];
  const zeichne = async (seite: number): Promise<string | null> => {
    aufrufe.push(seite);
    if (fehlerAuf.has(seite)) {
      throw new Error(`seite-${seite}-defekt`);
    }
    return seitenBild(seite);
  };
  return { zeichne, aufrufe };
}

/** Die Erkennung: liest den bekannten Text der Seite aus der data-URL. */
function erkenneStub(versagtAuf: ReadonlySet<number> = new Set()) {
  return async (src: string): Promise<OcrResult> => {
    const bytes = Buffer.from(src.split(",")[1] ?? "", "base64").toString();
    const seite = Number(/seite-(\d+)/.exec(bytes)?.[1]);
    if (versagtAuf.has(seite)) {
      return { status: "failed", text: "", error: "engine-fehler" };
    }
    return { status: "success", text: SCAN_TEXT[seite] ?? "" };
  };
}

const ue = (schluessel: string, werte?: Record<string, string | number>): string =>
  `${schluessel}${werte ? JSON.stringify(werte) : ""}`;

function ortVon(f: BildFundstelle): string {
  if (f.seite === undefined) {
    return "";
  }
  return f.seitenteil === "bild" ? `Seite ${f.seite}, erkannt` : `Seite ${f.seite}`;
}

interface LeseOptionen {
  fehlerAuf?: number[];
  versagtAuf?: number[];
  lage?: "an" | "aus" | "unbekannt";
}

const VIER_GELESEN = ["gelesen", "gelesen", "gelesen", "gelesen"];

async function lies(eingang: PdfScanEingang, optionen: LeseOptionen = {}) {
  const analyse = createBildAnalyse({ erkenne: erkenneStub(new Set(optionen.versagtAuf ?? [])) });
  const z = zeichneStub(new Set(optionen.fehlerAuf ?? []));
  const staende: QuellenBefund[] = [];
  const befund = await lesePdfSeiten(eingang, {
    analyse,
    zeichne: z.zeichne,
    lage: optionen.lage ?? "an",
    onFortschritt: (s) => staende.push(s),
  });
  return { befund, staende, aufrufe: z.aufrufe, analyse };
}

/** Ein vollständig gescannter Bericht: vier Seiten, keine Textebene. */
async function gescannt(): Promise<PdfScanEingang> {
  const bytes = scanPdf([1, 2, 3, 4].map((n) => ({ bild: grauBild(0x40 + n) })));
  const pdf = await extractPdfDocument(arrayBuffer(bytes), await echteEngine());
  const eingang = pdfScanEingang(NAME, pdf);
  if (!eingang) {
    throw new Error("kein Seitenlesen geplant");
  }
  return eingang;
}

/** Gemischt: S1 Scan, S2 nur Text, S3 Text + Bild (das Bild wiederholt die Überschrift), S4 Scan. */
const TEXT_S2 = ["Abschnitt Druckpruefung", "Der Druck betrug 4,5 bar laut Messprotokoll."];
const TEXT_S3 = ["Abschnitt Ventile", "Die Ventile wurden einzeln geprueft und dokumentiert."];

async function gemischt(): Promise<PdfScanEingang> {
  const bytes = scanPdf([
    { bild: grauBild(0x41) },
    { text: TEXT_S2 },
    { text: TEXT_S3, bild: grauBild(0x43) },
    { bild: grauBild(0x44) },
  ]);
  const pdf = await extractPdfDocument(arrayBuffer(bytes), await echteEngine());
  const eingang = pdfScanEingang("fiktiv-gemischt.pdf", pdf);
  if (!eingang) {
    throw new Error("kein Seitenlesen geplant");
  }
  return eingang;
}

describe("OCR-E04 · S1 · Seitenarten an der echten pdfjs-Engine", () => {
  it("erkennt Bildseite, Textseite und gemischte Seite; Text-PDF bleibt beim bisherigen Weg", async () => {
    const engine = await echteEngine();
    const bytes = scanPdf([
      { bild: grauBild() },
      { text: TEXT_S2 },
      { text: TEXT_S3, bild: grauBild() },
    ]);
    const pdf = await extractPdfDocument(arrayBuffer(bytes), engine);
    expect(pdf.pageCount).toBe(3);
    expect(pdf.totalPages).toBe(3);
    expect(pdf.pageImages).toEqual([true, false, true]);
    expect(pdf.pages?.[1]).toContain("Der Druck betrug 4,5 bar");
    expect(pdfSeitenPlan(pdf).map((s) => s.art)).toEqual(["bildseite", "textebene", "gemischt"]);

    const nurText = await extractPdfDocument(
      arrayBuffer(scanPdf([{ text: TEXT_S2 }, { text: TEXT_S3 }])),
      engine,
    );
    expect(nurText.pageImages).toEqual([false, false]);
    expect(pdfScanEingang("text.pdf", nurText)).toBeNull();
  });

  it("eine kurze Textebene über einem Scan bleibt erhalten — die Seite ist gemischt", async () => {
    // Nacharbeit 1 (Browserprobe): „ABSCHLUSSBERICHT“ (16 Zeichen) über einem Bild fiel unter die
    // Schwelle, die Seite galt als Bildseite und ihre Textebene wurde still verworfen.
    const bytes = scanPdf([{ text: ["ABSCHLUSSBERICHT"], bild: grauBild() }]);
    const pdf = await extractPdfDocument(arrayBuffer(bytes), await echteEngine());
    expect(pdfSeitenPlan(pdf)).toEqual([
      { seite: 1, art: "gemischt", textebene: "ABSCHLUSSBERICHT" },
    ]);
    const eingang = pdfScanEingang("kurz.pdf", pdf);
    const teile = (eingang?.vorkommen ?? []).map((v) => v.fundstelle.seitenteil);
    expect(teile).toEqual(["textebene", "bild"]);
    // Ohne Bildangabe der Engine: kurze Textebene → Bildseite, die Textebene bleibt trotzdem.
    expect(pdfSeitenPlan({ pages: ["Seite 3"] })).toEqual([
      { seite: 1, art: "bildseite", textebene: "Seite 3" },
    ]);
  });
});

describe("OCR-E04 · S2/S3 · mehrseitiger Scan, ohne separaten Auftrag", () => {
  it("liest jede Seite automatisch in Reihenfolge; vollständig erst am Ende", async () => {
    const eingang = await gescannt();
    expect(eingang.vorkommen.map((v) => [v.fundstelle.seite, v.fundstelle.seitenteil])).toEqual([
      [1, "bild"],
      [2, "bild"],
      [3, "bild"],
      [4, "bild"],
    ]);
    const { befund, staende, aufrufe } = await lies(eingang);

    expect(aufrufe).toEqual([1, 2, 3, 4]);
    expect(befund.status).toBe("vollstaendig");
    expect(befund.befunde.map((b) => b.status)).toEqual(VIER_GELESEN);
    // Zwischenstände sind nie „vollständig“, solange eine Seite wartet oder läuft.
    expect(staende.slice(0, -1).every((s) => s.status === "laeuft")).toBe(true);
    // Überschriften und Absätze bleiben, Seiten in Reihenfolge.
    const ganz = pdfSeitenText(befund);
    expect(ganz.indexOf("WARTUNGSBERICHT")).toBeLessThan(ganz.indexOf("Druckpruefung"));
    expect(ganz.indexOf("Druckpruefung")).toBeLessThan(ganz.indexOf("Ventile"));
    expect(ganz.indexOf("Ventile")).toBeLessThan(ganz.indexOf("ABSCHLUSS"));
    expect(ganz).toContain("WARTUNGSBERICHT ANLAGE 7\n\nPruefkarte 47");
  });

  it("Fragen zur ersten und letzten Seite nennen die richtige Seite", async () => {
    const { befund } = await lies(await gescannt());
    const k = klaraBildKontext("", [befund], ue, ortVon);
    expect(k.vollstaendig).toBe(true);
    expect(k.kontext).toContain(`[${NAME} · Seite 1, erkannt]`);
    expect(k.kontext).toContain(`[${NAME} · Seite 4, erkannt]`);

    const erste = belegstellen("Welche Pruefkarte wurde abgezeichnet?", "", k);
    expect(erste[0]?.ort).toBe("Seite 1, erkannt");
    expect(erste[0]?.auszug).toContain("Pruefkarte 47");

    const letzte = belegstellen("Welches Lager ist freigegeben?", "", k);
    expect(letzte[0]?.ort).toBe("Seite 4, erkannt");
    expect(letzte[0]?.auszug).toContain("Lager 29");
    expect(letzte.some((b) => b.ort.startsWith("Seite 1"))).toBe(false);
  });
});

describe("OCR-E04 · S4 · gemischte Text-/Bilddatei", () => {
  it("keine Bildseite ausgelassen, Textebene je Seite, keine doppelte Passage", async () => {
    const eingang = await gemischt();
    expect(eingang.seiten.map((s) => s.art)).toEqual([
      "bildseite",
      "textebene",
      "gemischt",
      "bildseite",
    ]);
    const teile = eingang.vorkommen.map((v) => `${v.fundstelle.seite}:${v.fundstelle.seitenteil}`);
    expect(teile).toEqual(["1:bild", "2:textebene", "3:textebene", "3:bild", "4:bild"]);
    const { befund, aufrufe } = await lies(eingang);

    // Jede Bild- und gemischte Seite wurde gezeichnet und gelesen; die reine Textseite nicht.
    expect(aufrufe).toEqual([1, 3, 4]);
    expect(befund.status).toBe("vollstaendig");
    // Seite 3: die Erkennung liest „Abschnitt Ventile“ — das steht schon in der Textebene.
    const s3Bild = befund.befunde.find(
      (b) => b.fundstelle.seite === 3 && b.fundstelle.seitenteil === "bild",
    );
    expect(s3Bild?.doppelt).toBe(1);
    expect(s3Bild?.textGekennzeichnet).toBe("Ventil V3 wurde getauscht.");

    const k = klaraBildKontext("", [befund], ue, ortVon, [eingang]);
    const vorkommen = (s: string): number => k.kontext.split(s).length - 1;
    expect(vorkommen("Abschnitt Ventile")).toBe(1);
    expect(vorkommen("Abschnitt Druckpruefung")).toBe(1);
    expect(k.kontext).toContain("Ventil V3 wurde getauscht.");
    expect(k.kontext).toContain("[fiktiv-gemischt.pdf · Seite 2] klarabildkontext.kontext.text");
    // Der zusammengeführte Dateitext: jede Seite einmal, in Reihenfolge.
    const ganz = pdfSeitenText(befund);
    expect(ganz.split("Abschnitt Ventile").length - 1).toBe(1);
    expect(ganz.indexOf("WARTUNGSBERICHT")).toBeLessThan(ganz.indexOf("laut Messprotokoll"));
    expect(ganz.indexOf("laut Messprotokoll")).toBeLessThan(ganz.indexOf("einzeln geprueft"));
    expect(ganz.indexOf("einzeln geprueft")).toBeLessThan(ganz.indexOf("Ventil V3"));
    expect(ganz.indexOf("Ventil V3")).toBeLessThan(ganz.indexOf("Lager 29"));
  });

  it("Nacharbeit 8: Text je Seite — Textebene und erkannter Rest zusammen, Fehlerseite leer", async () => {
    const { befund } = await lies(await gemischt(), { fehlerAuf: [4] });
    const seiten = pdfSeitenTexte(befund, 4);
    expect(seiten).toHaveLength(4);
    expect(seiten[0]).toContain("Pruefkarte 47");
    expect(seiten[1]).toContain("laut Messprotokoll");
    // Seite 3: Textebene, dann der erkannte Rest — die doppelte Überschrift steht einmal.
    expect(seiten[2]?.split("Abschnitt Ventile").length).toBe(2);
    expect(seiten[2]?.indexOf("einzeln geprueft")).toBeLessThan(
      seiten[2]?.indexOf("Ventil V3") ?? -1,
    );
    // Seite 4 ist gescheitert: leer, nicht erfunden; der Status sagt es.
    expect(seiten[3]).toBe("");
    expect(befund.status).toBe("teilweise");
    expect(pdfSeitenText(befund)).toBe(seiten.filter((s) => s.length > 0).join("\n\n"));
  });

  it("Doppelvergleich: nur wörtlich gleiche Zeilen derselben Seite, nicht Wortteile", () => {
    const erkannt = "Abschnitt Ventile\n29";
    expect(ohneDoppelteZeilen(erkannt, erkannt, "Jahr 2029")).toEqual({
      text: erkannt,
      gekennzeichnet: erkannt,
      doppelt: 0,
    });
    const gross = "ABSCHNITT  ventile.\nNeu";
    const markiert = "ABSCHNITT  ventile.\n[?Neu]";
    expect(ohneDoppelteZeilen(gross, markiert, "Abschnitt Ventile")).toEqual({
      text: "Neu",
      gekennzeichnet: "[?Neu]",
      doppelt: 1,
    });
  });

  it("Nacharbeit 2: Vorzeichen, Vergleichsoperatoren und Zahltrenner machen Angaben verschieden", () => {
    // Ben: „1500“ ↔ „-1500“ und „<1500“ ↔ „>1500“ wurden gleichgesetzt und still gelöscht.
    const verschieden: [string, string][] = [
      ["-1500", "1500"],
      ["1500", "-1500"],
      ["+1500", "1500"],
      [">1500", "<1500"],
      ["<1500", ">1500"],
      ["≥ 5 bar", "≤ 5 bar"],
      ["4,5 bar", "45 bar"],
      ["Betrag 1.500 €", "Betrag 1500 €"],
      // Nacharbeit 3 (Ben): abgesetzte Vorzeichen und Operatoren gehören zu ihrer Zahl.
      ["1500", "- 1500"],
      ["- 1500", "1500"],
      ["1500", "< 1500"],
      ["< 1500", "1500"],
      ["< 1500", "> 1500"],
      ["Summe 1500 €", "Summe - 1500 €"],
      ["Summe - 1500 €", "Summe 1500 €"],
      // Nacharbeit 4 (Ben): Leerraum als Tausendertrenner — ein Teil der Zahl ist nicht doppelt.
      ["500 €", "1 500 €"],
      ["500 €", "Summe 1 500 €"],
      ["1 500", "1 500 000"],
      ["500", "1 500 000 Stueck"],
      ["1 500 €", "500 €"],
      ["1 500 €", "1500 €"],
    ];
    for (const [erkannt, textebene] of verschieden) {
      expect(ohneDoppelteZeilen(erkannt, erkannt, textebene), `${erkannt} ↔ ${textebene}`).toEqual({
        text: erkannt,
        gekennzeichnet: erkannt,
        doppelt: 0,
      });
    }
    // Identische Angaben bleiben doppelt — auch mit anderem Leerraum, Satzzeichen, Minuszeichen.
    const gleich: [string, string][] = [
      ["-1500", "-1500"],
      ["<1500", "Grenzwert <1500"],
      ["Betrag: −1.500 €", "Betrag -1.500 €"],
      ["Druck 4,5 bar.", "Druck  4,5 bar"],
      // Nacharbeit 3 (Ben): dieselbe Angabe mit abweichendem Leerraum — in beiden Richtungen.
      ["- 1500", "-1500"],
      ["-1500", "- 1500"],
      ["< 1500", "<1500"],
      ["<1500", "< 1500"],
      ["Betrag − 1.500 €", "Betrag -1.500 €"],
      // Nacharbeit 4 (Ben): dieselbe gruppierte Zahl ist weiterhin doppelt — auch mitten im Text.
      ["1 500 €", "1 500 €"],
      ["Summe 1 500 €", "Die Summe 1 500 € ist bezahlt"],
      ["500 € Anzahlung", "Rest 1 000 €, 500 € Anzahlung"],
    ];
    for (const [erkannt, textebene] of gleich) {
      expect(ohneDoppelteZeilen(erkannt, erkannt, textebene), `${erkannt} ↔ ${textebene}`).toEqual({
        text: "",
        gekennzeichnet: "",
        doppelt: 1,
      });
    }
  });
});

describe("OCR-E04 · Nacharbeit 2 · Bildanteil nicht bestimmbar", () => {
  const LANG = "Die Anlage wurde am Montag geprueft und das Protokoll abgelegt.";

  function stubEngine(operatoren: () => Promise<{ fnArray: number[] }>, befehle = [85]): PdfEngine {
    const seite = {
      getTextContent: async () => ({ items: [{ str: LANG }] }),
      getOperatorList: operatoren,
    };
    return {
      getDocument: () => ({
        promise: Promise.resolve({ numPages: 1, getPage: async () => seite }),
      }),
      bildBefehle: befehle,
    };
  }

  it("getOperatorList scheitert: Seite mit längerer Textebene wird trotzdem gelesen", async () => {
    const pdf = await extractPdfDocument(
      new ArrayBuffer(8),
      stubEngine(async () => {
        throw new Error("operator-list-defekt");
      }),
    );
    expect(pdf.pageImages).toEqual([null]);
    expect(pdfSeitenPlan(pdf).map((s) => s.art)).toEqual(["gemischt"]);
    const eingang = pdfScanEingang("unbestimmt.pdf", pdf);
    expect(eingang?.vorkommen.map((v) => v.fundstelle.seitenteil)).toEqual(["textebene", "bild"]);
    if (!eingang) {
      throw new Error("kein Seitenlesen geplant");
    }
    // Die gezeichnete Seite trägt die Textebene UND einen Bildtext: nur dieser kommt hinzu.
    const analyse = createBildAnalyse({
      erkenne: async () => ({ status: "success", text: `${LANG}\nLager 29 ist freigegeben.` }),
    });
    const befund = await lesePdfSeiten(eingang, {
      analyse,
      lage: "an",
      zeichne: async () => seitenBild(1),
    });
    expect(befund.status).toBe("vollstaendig");
    const bild = befund.befunde.find((b) => b.fundstelle.seitenteil === "bild");
    expect(bild?.textGekennzeichnet).toBe("Lager 29 ist freigegeben.");
    expect(bild?.doppelt).toBe(1);
  });

  it("ohne bekannte Bildbefehle heisst es „unbekannt“, nicht „bildfrei“", async () => {
    const pdf = await extractPdfDocument(
      new ArrayBuffer(8),
      stubEngine(async () => ({ fnArray: [] }), []),
    );
    expect(pdf.pageImages).toEqual([null]);
    expect(pdfSeitenPlan(pdf).map((s) => s.art)).toEqual(["gemischt"]);
  });

  it("nachweislich bildfreie Seite bleibt beim bisherigen Weg", async () => {
    const pdf = await extractPdfDocument(
      new ArrayBuffer(8),
      stubEngine(async () => ({ fnArray: [1, 2, 3] })),
    );
    expect(pdf.pageImages).toEqual([false]);
    expect(pdfScanEingang("text.pdf", pdf)).toBeNull();
  });
});

describe("OCR-E04 · S5 · ein Fehler auf einer Seite", () => {
  it("Zeichenfehler und Erkennungsfehler sind sichtbar, die übrigen Seiten gelesen", async () => {
    const { befund, aufrufe } = await lies(await gescannt(), { fehlerAuf: [2], versagtAuf: [3] });
    expect(aufrufe).toEqual([1, 2, 3, 4]);
    expect(befund.befunde.map((b) => b.status)).toEqual([
      "gelesen",
      "fehlgeschlagen",
      "fehlgeschlagen",
      "gelesen",
    ]);
    expect(befund.befunde[1]?.fehler).toBe("seite-2-defekt");
    expect(befund.status).toBe("teilweise");

    const k = klaraBildKontext("", [befund], ue, ortVon);
    expect(k.vollstaendig).toBe(false);
    expect(k.gelesen).toBe(2);
    expect(k.offen).toBe(2);
    expect(k.kontext).toContain("Pruefkarte 47");
    expect(k.kontext).toContain("Lager 29");
    expect(k.kontext).toContain(`[${NAME} · Seite 2, erkannt] klarabildkontext.kontext.offen`);
    expect(k.kontext).toContain(`[${NAME} · Seite 3, erkannt] klarabildkontext.kontext.offen`);
    expect(klaraAnweisung("frage", "Was steht auf Seite 2?", k, ue)).toContain(
      'klarabildkontext.anweisung.unvollstaendig{"offen":2,"gesamt":4}',
    );
    // Der Dateitext enthält, was gelesen wurde — die Lücke verschweigt er nicht, er füllt sie nicht.
    const ganz = pdfSeitenText(befund);
    expect(ganz).toContain("Pruefkarte 47");
    expect(ganz).toContain("Lager 29");
    expect(ganz).not.toContain("4,5 bar");
  });

  it("eine Seite, die nicht rechtzeitig gezeichnet wird, heisst Zeitüberschreitung", async () => {
    const analyse = createBildAnalyse({ erkenne: erkenneStub() });
    const hier = async (seite: number): Promise<string> => seitenBild(seite);
    const eingang = await gescannt();
    const befund = await lesePdfSeiten(eingang, {
      analyse,
      lage: "an",
      zeichenfristMs: 20,
      zeichne: (seite) => (seite === 2 ? new Promise<string>(() => undefined) : hier(seite)),
    });
    expect(befund.befunde.map((b) => b.status)).toEqual([
      "gelesen",
      "zeitueberschreitung",
      "gelesen",
      "gelesen",
    ]);
    expect(befund.status).toBe("teilweise");
  });
});

describe("OCR-E04 · S6 · Status: laufend, aus, unbekannt, fehlende Seiten", () => {
  it("Automatik aus: nichts gelesen, sichtbar „aus“; Textebene bleibt nutzbar", async () => {
    const { befund, aufrufe } = await lies(await gescannt(), { lage: "aus" });
    expect(aufrufe).toEqual([]);
    expect(befund.status).toBe("aus");
    expect(befund.befunde.every((b) => b.grund === "automatik-aus")).toBe(true);

    const gem = await lies(await gemischt(), { lage: "aus" });
    expect(gem.aufrufe).toEqual([]);
    expect(gem.befund.status).toBe("teilweise");
    const k = klaraBildKontext("", [gem.befund], ue, ortVon);
    expect(k.kontext).toContain("laut Messprotokoll");
    expect(k.vollstaendig).toBe(false);
  });

  it("Einstellung nicht lesbar: nichts gelesen, Hinweis steht da", async () => {
    const { befund, aufrufe } = await lies(await gescannt(), { lage: "unbekannt" });
    expect(aufrufe).toEqual([]);
    expect(befund.hinweise).toContain("einstellung-unbekannt");
    expect(befund.status).not.toBe("vollstaendig");
  });

  it("Seiten über der Grenze fehlen sichtbar — nie „vollständig“", () => {
    const seiten = Array.from({ length: MAX_PDF_PAGES }, () => "");
    const eingang = pdfScanEingang("riesig.pdf", {
      pages: seiten,
      pageCount: MAX_PDF_PAGES,
      totalPages: MAX_PDF_PAGES + 5,
    });
    expect(eingang?.fehlendeSeiten).toBe(5);
    expect(eingang?.hinweise).toEqual(["pdf-seiten-fehlen"]);
    const alleGelesen = (eingang?.vorkommen ?? []).map((v) => ({
      fundstelle: v.fundstelle,
      status: "gelesen" as const,
      inhaltskennung: null,
      text: "x",
      textGekennzeichnet: "x",
      unsicher: [],
      tabelle: null,
      bildinhalt: { status: "nicht-angebunden" as const, text: "" },
      wiederverwendet: false,
    }));
    expect(pdfQuellenStatus(alleGelesen, 5)).toBe("teilweise");
    expect(pdfQuellenStatus(alleGelesen, 0)).toBe("vollstaendig");
    const k = klaraBildKontext(
      "",
      [
        {
          quelle: "riesig.pdf",
          art: "pdf",
          status: "teilweise",
          befunde: alleGelesen,
          nichtGelesen: [],
          hinweise: ["pdf-seiten-fehlen"],
          fehlendeSeiten: 5,
        },
      ],
      ue,
      ortVon,
    );
    expect(k.offen).toBe(5);
    expect(k.vollstaendig).toBe(false);
    expect(k.kontext).toContain(
      `pdfscan.hinweis.seitenFehlen{"max":40,"seiten":${MAX_PDF_PAGES},"fehlend":5}`,
    );
  });
});

describe("OCR-E04 · S7 · Wiederverwendung und Abbruch", () => {
  it("gleiche Seitenbilder werden nicht zweimal erkannt; ein abgebrochener Lauf startet nichts", async () => {
    const eingang = await gescannt();
    const { analyse } = await lies(eingang);
    expect(analyse.anzahlAnalysen()).toBe(4);
    const z = zeichneStub();
    await lesePdfSeiten(eingang, { analyse, zeichne: z.zeichne, lage: "an" });
    expect(analyse.anzahlAnalysen()).toBe(4);

    const z2 = zeichneStub();
    let erlaubt = 1;
    const abgebrochen = await lesePdfSeiten(eingang, {
      analyse: createBildAnalyse({ erkenne: erkenneStub() }),
      zeichne: z2.zeichne,
      lage: "an",
      abbrechen: () => {
        erlaubt -= 1;
        return erlaubt < 0;
      },
    });
    expect(z2.aufrufe).toEqual([1]);
    expect(abgebrochen.status).toBe("laeuft");
  });
});
