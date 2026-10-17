// ================================================================================================
// OCR-E01 · FUNDSTELLEN AM ORIGINAL — Zuordnung, Markierung, Drehung, Größe und ehrlicher Rückfall.
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-fundstellen-korrekturen, Kriterien K1–K4 (mit K10/K11).
//
// Kontrollierte Fixtures mit bekanntem Text und echten Fundstellen: Bilder mit echtem PNG-Kopf
// (Breite × Höhe aus `IHDR`) bzw. JPEG mit EXIF-Drehangabe; eine echte PPTX-Importkette (zwei Folien,
// drei Bilder, dasselbe Wort auf zwei Folien); eine Erkennung, die je Bild bekannte Wörter MIT Rahmen
// liefert (dieselbe Form wie tesseract.js). Ersetzt ist nur die Engine; Analyse, Zuordnung und
// Markierung sind echt. Die echte Engine und die Lage der Markierung auf dem Bildschirm misst
// `tests-smoke/klara-ocr-fundstelle-korrektur-browser.spec.ts`.
//
//   F1  K1 — Zahl, Name, Datum: jede Textstelle führt zu IHREM Bild und zum gemessenen Bereich.
//   F2  K2 — PowerPoint mit zwei Folien: dasselbe Wort auf Folie 1 und 2 öffnet jeweils das Bild
//            SEINER Folie (Anker, Bytes) und SEINEN Bereich; eine wiederverwendete Analyse ebenso.
//   F3  K3 — gedrehtes Foto (EXIF 6 und 8) und skalierte bzw. gedrehte Ansicht.
//   F4  K4 — Rückfall: keine Wortrahmen, unlesbare Maße, unklare Drehung, Rahmen außerhalb,
//            ergänztes Wort — es wird nie eine Position erfunden.
//   F5  Bildmaße und Drehangabe aus den Bytes (PNG, JPEG/EXIF, GIF, WebP).
//   F6  Textstellen: Rohbefund mit Kennzeichnung und Berichtigung werden den Wörtern zugeordnet.
import { describe, expect, it } from "vitest";
import {
  type BildBefund,
  type BildQuelleEingang,
  createBildAnalyse,
  einzelbildEingang,
  pptxBildEingang,
} from "../../apps/web/src/lib/bildAutomatik";
import {
  type Bereich,
  ansichtsMasse,
  ausrichten,
  gesamtDrehung,
  markierung,
  originalAusEingang,
  textStellen,
} from "../../apps/web/src/lib/bildFundstelle";
import { type WortPosition, bildRahmenAus } from "../../apps/web/src/lib/bildRahmen";
import type { OcrResult, OcrWort } from "../../apps/web/src/lib/ocr";
import { bildMit, bildMitMassen, dataUrl, deck, lesePptx, markeAus } from "./deck";

function wort(text: string, x0: number, y0: number, x1: number, y1: number): OcrWort {
  return { text, confidence: 95, bbox: { x0, y0, x1, y1 } };
}

/** Eine Erkennung, die je Marke bekannten Text samt Wortrahmen liefert. */
function positionsEngine(je: Record<string, { text: string; woerter: OcrWort[] }>) {
  return async (src: string): Promise<OcrResult> => {
    const marke = markeAus(src);
    const eintrag = marke ? je[marke] : undefined;
    return eintrag
      ? { status: "success", text: eintrag.text, woerter: eintrag.woerter }
      : { status: "success", text: "" };
  };
}

function nahe(ist: Bereich | undefined, soll: Bereich): void {
  expect(ist).toBeDefined();
  expect(ist?.links).toBeCloseTo(soll.links, 6);
  expect(ist?.oben).toBeCloseTo(soll.oben, 6);
  expect(ist?.breite).toBeCloseTo(soll.breite, 6);
  expect(ist?.hoehe).toBeCloseTo(soll.hoehe, 6);
}

function stelleVon(b: BildBefund, text: string): number | null {
  const s = textStellen(b.textGekennzeichnet, b.woerter).find((x) => x.text === text);
  if (!s) {
    throw new Error(`keine Stelle „${text}“`);
  }
  return s.wort;
}

/** Eine Rechnung (1000 × 500 px) mit Zahl, Name und Datum an bekannten Stellen. */
const RECHNUNG = {
  text: "Rechnung 4.250,00 EUR\nErika Mustermann 12.10.2026",
  woerter: [
    wort("Rechnung", 40, 30, 260, 80),
    wort("4.250,00", 300, 30, 520, 80),
    wort("EUR", 540, 30, 640, 80),
    wort("Erika", 40, 300, 180, 350),
    wort("Mustermann", 200, 300, 520, 350),
    wort("12.10.2026", 600, 300, 900, 350),
  ],
};

describe("F1 · K1 — Zahl, Name und Datum führen zum Original und zum richtigen Bereich", () => {
  it("jede Stelle trägt ihr Wort; die Markierung ist der gemessene Rahmen", async () => {
    const src = dataUrl(bildMitMassen("R", 1000, 500));
    const eingang = einzelbildEingang("rechnung.png", src);
    const analyse = createBildAnalyse({ erkenne: positionsEngine({ R: RECHNUNG }) });
    const befund = (await analyse.analysiereQuelle(eingang, { automatik: true })).befunde[0];
    if (!befund) {
      throw new Error("kein Befund");
    }
    expect(befund.rahmen).toEqual({ breite: 1000, hoehe: 500, orientierung: 1 });
    expect(befund.woerter?.map((w) => w.text)).toEqual(RECHNUNG.woerter.map((w) => w.text));
    // Das Original ist genau das gelesene Bild.
    expect(originalAusEingang(eingang, befund.fundstelle)).toBe(src);

    const soll: [string, Bereich][] = [
      ["4.250,00", { links: 30, oben: 6, breite: 22, hoehe: 10 }],
      ["Mustermann", { links: 20, oben: 60, breite: 32, hoehe: 10 }],
      ["12.10.2026", { links: 60, oben: 60, breite: 30, hoehe: 10 }],
    ];
    for (const [text, bereich] of soll) {
      const m = markierung(befund, [stelleVon(befund, text)]);
      if (m.art !== "bereich") {
        throw new Error(`keine Markierung für ${text}: ${m.grund}`);
      }
      expect(m.rahmen).toEqual({ breite: 1000, hoehe: 500 });
      expect(m.drehung).toBe(0);
      expect(m.bereiche).toHaveLength(1);
      nahe(m.bereiche[0], bereich);
    }
  });
});

describe("F2 · K2 — mehrere Bilder bzw. Folien verwechseln keine Fundstellen", () => {
  const JE_MARKE = {
    A: {
      text: "LAGER 4711",
      woerter: [wort("LAGER", 100, 100, 300, 160), wort("4711", 320, 100, 480, 160)],
    },
    B: {
      text: "VENTIL 4711",
      woerter: [wort("VENTIL", 50, 300, 250, 360), wort("4711", 500, 300, 700, 360)],
    },
    C: {
      text: "PRUEFKARTE 47",
      woerter: [wort("PRUEFKARTE", 10, 10, 400, 80), wort("47", 420, 10, 500, 80)],
    },
  };

  async function lesen(): Promise<{ eingang: BildQuelleEingang; befunde: BildBefund[] }> {
    const bytes = deck(bildMitMassen("B", 800, 400), {
      a: bildMitMassen("A", 1200, 600),
      c: bildMitMassen("C", 600, 600),
    });
    const pptx = await lesePptx(bytes);
    const eingang = pptxBildEingang("anlage.pptx", pptx.html, pptx);
    const analyse = createBildAnalyse({ erkenne: positionsEngine(JE_MARKE) });
    const q = await analyse.analysiereQuelle(eingang, { automatik: true });
    // Ein zweiter Eingang derselben Datei: wiederverwendete Befunde tragen dieselben Fundstellen.
    const nochmal = await analyse.analysiereQuelle(eingang, { automatik: true });
    expect(nochmal.befunde.every((b) => b.wiederverwendet)).toBe(true);
    expect(nochmal.befunde.map((b) => b.woerter)).toEqual(q.befunde.map((b) => b.woerter));
    expect(nochmal.befunde.map((b) => b.rahmen)).toEqual(q.befunde.map((b) => b.rahmen));
    return { eingang, befunde: q.befunde };
  }

  it("„4711“ auf Folie 1 und Folie 2: jede Stelle öffnet ihr Bild und ihren Bereich", async () => {
    const { eingang, befunde } = await lesen();
    expect(befunde.map((b) => [b.fundstelle.folie, b.fundstelle.bildAufFolie, b.text])).toEqual([
      [1, 1, "LAGER 4711"],
      [2, 1, "VENTIL 4711"],
      [2, 2, "PRUEFKARTE 47"],
    ]);
    const [f1, f2] = befunde;
    if (!f1 || !f2) {
      throw new Error("Befunde fehlen");
    }
    // Das Original je Fundstelle: verschiedene Anker, verschiedene Bytes — die richtige Folie.
    const o1 = originalAusEingang(eingang, f1.fundstelle);
    const o2 = originalAusEingang(eingang, f2.fundstelle);
    expect(o1 && markeAus(o1)).toBe("A");
    expect(o2 && markeAus(o2)).toBe("B");
    expect(f1.fundstelle.imageId).not.toBe(f2.fundstelle.imageId);

    const m1 = markierung(f1, [stelleVon(f1, "4711")]);
    const m2 = markierung(f2, [stelleVon(f2, "4711")]);
    if (m1.art !== "bereich" || m2.art !== "bereich") {
      throw new Error("keine Markierung");
    }
    // Folie 1: 1200 × 600, Wort bei x 320–480, y 100–160.
    expect(m1.rahmen).toEqual({ breite: 1200, hoehe: 600 });
    nahe(m1.bereiche[0], { links: 320 / 12, oben: 100 / 6, breite: 160 / 12, hoehe: 60 / 6 });
    // Folie 2: 800 × 400, Wort bei x 500–700, y 300–360.
    expect(m2.rahmen).toEqual({ breite: 800, hoehe: 400 });
    nahe(m2.bereiche[0], { links: 62.5, oben: 75, breite: 25, hoehe: 15 });
  });
});

/** Ein JPEG-Kopf mit EXIF-Orientierung `o` und den gespeicherten Maßen `b × h`. */
function jpegMit(o: number, b: number, h: number): Uint8Array {
  // TIFF (Motorola): Kopf, ein Eintrag 0x0112 (SHORT, 1) = o, kein weiteres Verzeichnis.
  const tiff = [0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, o, 0, 0];
  tiff.push(0, 0, 0, 0);
  const app1Laenge = 2 + 6 + tiff.length;
  const kopf = [0xff, 0xd8, 0xff, 0xe1, app1Laenge >> 8, app1Laenge & 255];
  const exif = [0x45, 0x78, 0x69, 0x66, 0, 0];
  // SOF0: Länge, Genauigkeit, Höhe, Breite (der Rest wird für die Maße nicht gelesen).
  const sof = [0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, b >> 8, b & 255, 3, 1, 0x22, 0];
  const ende = [0xff, 0xd9];
  return Uint8Array.from([...kopf, ...exif, ...tiff, ...sof, ...ende]);
}

describe("F3 · K3 — gedrehte und skalierte Bilder zeigen passende Markierungen", () => {
  // Ein Handyfoto: gespeichert quer (1600 × 1200), laut EXIF um 90° zu drehen (Orientierung 6).
  const quer: WortPosition = { text: "RAUM", x0: 1300, y0: 100, x1: 1500, y1: 200 };
  const hoch: WortPosition = { text: "RAUM", x0: 100, y0: 1300, x1: 300, y1: 1500 };

  it("Erkennung im gespeicherten Rahmen: Bild ohne Drehangabe anzeigen, Rahmen um 90° drehen", () => {
    const rahmen = bildRahmenAus(jpegMit(6, 1600, 1200));
    expect(rahmen).toEqual({ breite: 1600, hoehe: 1200, orientierung: 6 });
    const m = markierung({ woerter: [quer], rahmen }, [0]);
    expect(m).toMatchObject({ art: "bereich", drehangabeAnwenden: false, drehung: 90 });
    if (m.art === "bereich") {
      expect(m.rahmen).toEqual({ breite: 1600, hoehe: 1200 });
      nahe(m.bereiche[0], { links: 81.25, oben: 100 / 12, breite: 12.5, hoehe: 100 / 12 });
    }
    // Orientierung 8: dieselben Rahmen, Drehung 270°.
    const m8 = markierung({ woerter: [quer], rahmen: bildRahmenAus(jpegMit(8, 1600, 1200)) }, [0]);
    expect(m8).toMatchObject({ art: "bereich", drehung: 270 });
  });

  it("Erkennung im angezeigten (gedrehten) Rahmen: Drehangabe anwenden, nicht zusätzlich drehen", () => {
    const m = markierung({ woerter: [hoch], rahmen: bildRahmenAus(jpegMit(6, 1600, 1200)) }, [0]);
    expect(m).toMatchObject({ art: "bereich", drehangabeAnwenden: true, drehung: 0 });
    if (m.art === "bereich") {
      expect(m.rahmen).toEqual({ breite: 1200, hoehe: 1600 });
      nahe(m.bereiche[0], { links: 100 / 12, oben: 81.25, breite: 100 / 6, hoehe: 12.5 });
    }
  });

  it("Ansicht skaliert und gedreht: Bild und Markierung teilen EINEN Rahmen", () => {
    const rahmen = { breite: 1600, hoehe: 1200 };
    const normal = ansichtsMasse(rahmen, 0, 1, 640);
    expect(normal).toMatchObject({ innenBreite: 640, innenHoehe: 480, aussenBreite: 640 });
    const doppelt = ansichtsMasse(rahmen, 0, 2, 640);
    expect(doppelt).toMatchObject({ innenBreite: 1280, innenHoehe: 960 });
    // Gedreht: die Bühne tauscht Breite und Höhe; der Rahmen selbst bleibt das Bild.
    const gedreht = ansichtsMasse(rahmen, gesamtDrehung(90, 0), 1, 640);
    expect(gedreht).toMatchObject({ innenBreite: 853, innenHoehe: 640 });
    expect([gedreht.aussenBreite, gedreht.aussenHoehe]).toEqual([640, 853]);
    expect(gesamtDrehung(270, 180)).toBe(90);
    // Die Markierung ist in Prozent des Rahmens: bei jeder Größe dieselbe Stelle im Bild.
    const m = markierung({ woerter: [quer], rahmen: { ...rahmen, orientierung: 1 } }, [0]);
    if (m.art !== "bereich") {
      throw new Error("keine Markierung");
    }
    for (const masse of [normal, doppelt, gedreht]) {
      const b = m.bereiche[0];
      if (!b) {
        throw new Error("kein Bereich");
      }
      const links = (b.links / 100) * masse.innenBreite;
      expect(links / masse.innenBreite).toBeCloseTo(1300 / 1600, 6);
    }
  });
});

describe("F4 · K4 — ohne verlässliche Position ein ehrlicher Rückfall, nie eine erfundene", () => {
  const w = wort("PLAN", 10, 10, 90, 40);
  const positionen: WortPosition[] = [{ text: "PLAN", x0: 10, y0: 10, x1: 90, y1: 40 }];

  it("keine Wortrahmen: das Bild, aber kein Bereich", async () => {
    const eingang = einzelbildEingang("plan.png", dataUrl(bildMitMassen("P", 200, 100)));
    const ohneRahmen = async (): Promise<OcrResult> => ({ status: "success", text: "PLAN" });
    const analyse = createBildAnalyse({ erkenne: ohneRahmen });
    const q = await analyse.analysiereQuelle(eingang, { automatik: true });
    const befund = q.befunde[0];
    expect(befund?.woerter).toBeUndefined();
    expect(markierung(befund ?? {}, [null])).toEqual({
      art: "ohne-position",
      grund: "keine-positionen",
    });
    // Das Bild selbst bleibt erreichbar: die Fundstelle führt zum Original.
    const fundstelle = eingang.vorkommen[0]?.fundstelle;
    expect(fundstelle && originalAusEingang(eingang, fundstelle)).toBe(eingang.vorkommen[0]?.src);
  });

  it("unlesbare Bildmaße (unbekanntes Format)", async () => {
    const eingang = einzelbildEingang("plan.png", dataUrl(bildMit("P")));
    const engine = async (): Promise<OcrResult> => ({
      status: "success",
      text: "PLAN",
      woerter: [w],
    });
    const analyse = createBildAnalyse({ erkenne: engine });
    const befund = (await analyse.analysiereQuelle(eingang, { automatik: true })).befunde[0];
    expect(befund?.rahmen).toBeUndefined();
    expect(befund?.woerter).toHaveLength(1);
    expect(markierung(befund ?? {}, [0])).toEqual({ art: "ohne-position", grund: "keine-masse" });
  });

  it("unklare Drehung (180°, gespiegelt, beide Rahmen möglich) und Rahmen außerhalb", () => {
    const r180 = bildRahmenAus(jpegMit(3, 400, 300));
    expect(markierung({ woerter: positionen, rahmen: r180 }, [0])).toEqual({
      art: "ohne-position",
      grund: "drehung-unklar",
    });
    const gespiegelt = bildRahmenAus(jpegMit(5, 400, 300));
    expect(markierung({ woerter: positionen, rahmen: gespiegelt }, [0])).toMatchObject({
      grund: "drehung-unklar",
    });
    // Beide Rahmen (400 × 300 und 300 × 400) fassen das Wort: nicht eindeutig.
    const beide = bildRahmenAus(jpegMit(6, 400, 300));
    expect(markierung({ woerter: positionen, rahmen: beide }, [0])).toMatchObject({
      grund: "drehung-unklar",
    });
    const zuKlein = { breite: 50, hoehe: 20, orientierung: 1 };
    expect(markierung({ woerter: positionen, rahmen: zuKlein }, [0])).toEqual({
      art: "ohne-position",
      grund: "ausserhalb",
    });
  });

  it("ein ergänztes Wort hat keine Position", () => {
    const stellen = textStellen("PLAN NEU", positionen);
    expect(stellen.map((s) => [s.text, s.wort])).toEqual([
      ["PLAN", 0],
      ["NEU", null],
    ]);
    const rahmen = { breite: 200, hoehe: 100, orientierung: 1 };
    expect(markierung({ woerter: positionen, rahmen }, [null])).toEqual({
      art: "ohne-position",
      grund: "ohne-zuordnung",
    });
  });
});

describe("F5 · Bildmaße und Drehangabe aus den Bytes", () => {
  it("PNG, JPEG mit und ohne EXIF, GIF, WebP; Unbekanntes heißt null", () => {
    expect(bildRahmenAus(bildMitMassen("X", 321, 123))).toEqual({
      breite: 321,
      hoehe: 123,
      orientierung: 1,
    });
    expect(bildRahmenAus(jpegMit(1, 640, 480))).toEqual({
      breite: 640,
      hoehe: 480,
      orientierung: 1,
    });
    expect(bildRahmenAus(jpegMit(8, 640, 480))?.orientierung).toBe(8);
    const gifKopf = new TextEncoder().encode("GIF89a");
    const gif = Uint8Array.from([...gifKopf, 0x20, 0x03, 0x58, 0x02, 0]);
    expect(bildRahmenAus(gif)).toEqual({ breite: 800, hoehe: 600, orientierung: 1 });
    const webp = new Uint8Array(30);
    webp.set(new TextEncoder().encode("RIFF"), 0);
    webp.set(new TextEncoder().encode("WEBPVP8X"), 8);
    webp.set([0x3f, 0x01, 0x00], 24); // Breite − 1 = 319
    webp.set([0xef, 0x00, 0x00], 27); // Höhe − 1 = 239
    expect(bildRahmenAus(webp)).toEqual({ breite: 320, hoehe: 240, orientierung: 1 });
    webp[20] = 0x08; // EXIF vorhanden → Drehangabe unbekannt
    expect(bildRahmenAus(webp)?.orientierung).toBe(0);
    expect(bildRahmenAus(bildMit("X"))).toBeNull();
    expect(bildRahmenAus(new TextEncoder().encode("kein Bild, nur Text"))).toBeNull();
  });
});

describe("F6 · Textstellen — Rohbefund und Berichtigung werden den Wörtern zugeordnet", () => {
  const woerter: WortPosition[] = [
    { text: "Herr", x0: 0, y0: 0, x1: 10, y1: 10 },
    { text: "Mül1er", x0: 20, y0: 0, x1: 60, y1: 10 },
    { text: "zahlt", x0: 70, y0: 0, x1: 100, y1: 10 },
    { text: "4.250", x0: 0, y0: 20, x1: 40, y1: 30 },
  ];

  it("gekennzeichnete Stellen ([?…], [unleserlich]) bleiben ihrem Wort zugeordnet", () => {
    const stellen = textStellen("Herr [?Mül1er] zahlt\n[unleserlich]", woerter);
    expect(stellen.map((s) => [s.text, s.wort, s.ersetzt])).toEqual([
      ["Herr", 0, false],
      ["[?Mül1er]", 1, false],
      ["zahlt", 2, false],
      ["[unleserlich]", 3, true],
    ]);
    // Der Text bleibt Zeichen für Zeichen derselbe.
    expect(stellen.map((s) => s.vor + s.text).join("")).toBe("Herr [?Mül1er] zahlt\n[unleserlich]");
  });

  it("berichtigtes Wort an der Stelle des erkannten, Ergänztes ohne Position", () => {
    const stellen = textStellen("Herr Müller zahlt 4.250 EUR", woerter);
    expect(stellen.map((s) => [s.text, s.wort, s.ersetzt])).toEqual([
      ["Herr", 0, false],
      ["Müller", 1, true],
      ["zahlt", 2, false],
      ["4.250", 3, false],
      ["EUR", null, false],
    ]);
    expect(ausrichten([], ["a"])).toEqual([]);
    expect(ausrichten(["a"], [])).toEqual([{ wort: null, ersetzt: false }]);
  });
});
