// ================================================================================================
// OCR-02 · DIE AUTOMATIK AN DER ECHTEN IMPORTKETTE — Auslösung, Fundstelle, Wiederverwendung, Status
// ================================================================================================
//
// Auftrag produkt:20261012:klara-bildanalyse-ocr-automatik, Kriterien K1–K5.
//
// Die PowerPoint-Fälle laufen durch DIESELBE Kette wie `readPptxRich`: echte ZIP-Bytes (fflate) →
// `budgetedPptxUnzip` → `extractPptxRich` mit Bildeinbettung → `pptxBildEingang` → Analyse. Ersetzt
// ist allein die Texterkennung: sie liest aus den Bildbytes eine Marke und gibt den dazu gehörenden
// Text zurück. So ist nachprüfbar, dass JEDES Bild SEINEN Text bekommt — die Genauigkeit der echten
// Engine misst `tests-smoke/klara-bildautomatik-browser.spec.ts` im Browser.
import { describe, expect, it, vi } from "vitest";
import { Unzip, UnzipInflate, UnzipPassThrough, zipSync } from "../../apps/web/node_modules/fflate";
import {
  BILD_AUTOMATIK_VOREINSTELLUNG,
  type BildQuelleEingang,
  type QuellenBefund,
  bildVorkommenAusRumpf,
  createBildAnalyse,
  docxBildEingang,
  einzelbildEingang,
  kennzeichneUnsicheres,
  pptxBildEingang,
} from "../../apps/web/src/lib/bildAutomatik";
import { MAX_INLINE_BODY_HTML_BYTES } from "../../apps/web/src/lib/docx";
import type { OcrResult } from "../../apps/web/src/lib/ocr";
import { budgetedPptxUnzip, extractPptxRich } from "../../apps/web/src/lib/pptx";

// ------------------------------------------------------------------------------------------------
// Bilder mit Marke und eine Engine, die die Marke liest
// ------------------------------------------------------------------------------------------------

const PNG_SIGNATUR = [137, 80, 78, 71, 13, 10, 26, 10];

/** Bildbytes mit einer Marke am Ende — verschiedene Marke, verschiedener Inhalt. */
function bildMit(marke: string): Uint8Array {
  const marken = new TextEncoder().encode(`#${marke}#`);
  return Uint8Array.from([...PNG_SIGNATUR, 0, 0, 0, 13, ...marken]);
}

const TEXT_JE_MARKE: Record<string, string> = {
  A: "PRUEFKARTE 47",
  B: "VENTIL 83 SCHLIESSEN",
  B2: "VENTIL 84 OEFFNEN",
  C: "LAGER 29",
  E: "AUSHANG 61",
};

function markeAus(src: string): string | null {
  const b64 = src.slice(src.indexOf(",") + 1);
  const roh = Buffer.from(b64, "base64").toString("latin1");
  return /#([A-Z0-9]+)#$/.exec(roh)?.[1] ?? null;
}

function markenEngine() {
  return vi.fn(async (src: string): Promise<OcrResult> => {
    const marke = markeAus(src);
    const text = marke ? TEXT_JE_MARKE[marke] : undefined;
    return text ? { status: "success", text } : { status: "success", text: "" };
  });
}

const dataUrl = (bytes: Uint8Array, mime = "image/png"): string =>
  `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;

// ------------------------------------------------------------------------------------------------
// Ein Deck: Folie 1 Text + Bild A; Folie 2 Text + Bild B + Bild C + ein BMP (wird nicht übernommen)
// ------------------------------------------------------------------------------------------------

const URI_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const URI_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const URI_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const URI_PKG_R = "http://schemas.openxmlformats.org/package/2006/relationships";
const KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function folie(titel: string, absatz: string, rids: readonly string[]): string {
  const sp = (ph: string, text: string) =>
    `<p:sp><p:nvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const bilder = rids
    .map((rid) => `<p:pic><p:blipFill><a:blip r:embed="${rid}"/></p:blipFill></p:pic>`)
    .join("");
  return `${KOPF}<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:cSld><p:spTree>${sp('<p:ph type="title"/>', titel)}${sp("", absatz)}${bilder}</p:spTree></p:cSld></p:sld>`;
}

function rels(ziele: Record<string, string>): string {
  const r = Object.entries(ziele)
    .map(
      ([rid, datei]) =>
        `<Relationship Id="${rid}" Type="${URI_R}/image" Target="../media/${datei}"/>`,
    )
    .join("");
  return `${KOPF}<Relationships xmlns="${URI_PKG_R}">${r}</Relationships>`;
}

const FOLIENTEXT = ["Wartungsplan", "Siehe Bild", "Anlage", "Zwei Bilder"];

function deck(bildB: Uint8Array = bildMit("B")): Uint8Array {
  return zipSync({
    "[Content_Types].xml": enc(
      `${KOPF}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/></Types>`,
    ),
    "_rels/.rels": enc(
      `${KOPF}<Relationships xmlns="${URI_PKG_R}"><Relationship Id="rId1" Type="${URI_R}/officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    ),
    "ppt/presentation.xml": enc(
      `${KOPF}<p:presentation xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst></p:presentation>`,
    ),
    "ppt/_rels/presentation.xml.rels": enc(
      `${KOPF}<Relationships xmlns="${URI_PKG_R}"><Relationship Id="rId1" Type="${URI_R}/slide" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="${URI_R}/slide" Target="slides/slide2.xml"/></Relationships>`,
    ),
    "ppt/slides/slide1.xml": enc(folie("Wartungsplan", "Siehe Bild", ["rId9"])),
    "ppt/slides/slide2.xml": enc(folie("Anlage", "Zwei Bilder", ["rId9", "rId10", "rId11"])),
    "ppt/slides/_rels/slide1.xml.rels": enc(rels({ rId9: "a.png" })),
    "ppt/slides/_rels/slide2.xml.rels": enc(
      rels({ rId9: "b.png", rId10: "c.png", rId11: "d.bmp" }),
    ),
    "ppt/media/a.png": bildMit("A"),
    "ppt/media/b.png": bildB,
    "ppt/media/c.png": bildMit("C"),
    "ppt/media/d.bmp": Uint8Array.from([0x42, 0x4d, 1, 2, 3, 4]),
  });
}

async function lesePptx(bytes: Uint8Array) {
  const kopie = new Uint8Array(bytes);
  return extractPptxRich(kopie.buffer as ArrayBuffer, {
    unzip: budgetedPptxUnzip({ Unzip, UnzipInflate, UnzipPassThrough }),
    budgetBytes: MAX_INLINE_BODY_HTML_BYTES,
    imageCaptionPlaceholder: "",
    imageRunToken: "ocr02",
  });
}

async function pptxEingang(bytes: Uint8Array = deck()): Promise<BildQuelleEingang> {
  const pptx = await lesePptx(bytes);
  return pptxBildEingang("wartung.pptx", pptx.html, pptx);
}

const ohneFortschritt = { automatik: true } as const;

// ================================================================================================
// K1 · Ein neu bereitgestelltes Bild wird bei aktiver Automatik ohne separaten Auftrag verarbeitet.
// ================================================================================================
describe("K1 · Einzelbild: Automatik an liest, Automatik aus liest nicht", () => {
  it("an: der Eingang allein löst die Erkennung aus — einmal, mit Fundstelle", async () => {
    const erkenne = markenEngine();
    const analyse = createBildAnalyse({ erkenne });
    const befund = await analyse.analysiereQuelle(
      einzelbildEingang("aushang.png", dataUrl(bildMit("E"))),
      ohneFortschritt,
    );
    expect(erkenne).toHaveBeenCalledTimes(1);
    expect(befund.status).toBe("vollstaendig");
    expect(befund.befunde).toHaveLength(1);
    expect(befund.befunde[0]).toMatchObject({
      status: "gelesen",
      text: "AUSHANG 61",
      fundstelle: { quelle: "aushang.png", art: "bild", bild: 1 },
      wiederverwendet: false,
    });
    expect(befund.befunde[0]?.inhaltskennung).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("aus: nichts wird erkannt, und es steht nicht als gelesen da", async () => {
    const erkenne = markenEngine();
    const analyse = createBildAnalyse({ erkenne });
    const fortschritt: QuellenBefund[] = [];
    const befund = await analyse.analysiereQuelle(
      einzelbildEingang("aushang.png", dataUrl(bildMit("E"))),
      { automatik: false, onFortschritt: (s) => fortschritt.push(s) },
    );
    expect(erkenne).not.toHaveBeenCalled();
    expect(befund.status).toBe("aus");
    expect(befund.befunde[0]).toMatchObject({ status: "nicht-analysiert", grund: "automatik-aus" });
    expect(fortschritt.map((s) => s.status)).toEqual(["aus"]);
  });

  it("ohne abweichende Einstellung ist die Automatik an", () => {
    expect(BILD_AUTOMATIK_VOREINSTELLUNG).toBe(true);
  });
});

// ================================================================================================
// K2 · PowerPoint: Text eingebetteter Bilder, der nicht als editierbarer Folientext vorliegt
// ================================================================================================
describe("K2 · PowerPoint-Datei: der Text in den eingebetteten Bildern wird erkannt", () => {
  it("der Bildtext steht nicht im Folientext, aber im Befund", async () => {
    const pptx = await lesePptx(deck());
    for (const zeile of FOLIENTEXT) {
      expect(pptx.text).toContain(zeile);
    }
    for (const bildtext of [TEXT_JE_MARKE.A, TEXT_JE_MARKE.B, TEXT_JE_MARKE.C]) {
      expect(pptx.text).not.toContain(bildtext);
    }
    const analyse = createBildAnalyse({ erkenne: markenEngine() });
    const befund = await analyse.analysiereQuelle(
      pptxBildEingang("wartung.pptx", pptx.html, pptx),
      ohneFortschritt,
    );
    expect(befund.befunde.map((b) => [b.status, b.text])).toEqual([
      ["gelesen", TEXT_JE_MARKE.A],
      ["gelesen", TEXT_JE_MARKE.B],
      ["gelesen", TEXT_JE_MARKE.C],
    ]);
  });

  it("der PPTX-Leser liefert die Folie je eingebettetem Bild und die Verluste je Folie", async () => {
    const pptx = await lesePptx(deck());
    expect(pptx.imageSlides).toEqual([
      { imageId: "kw-img-ocr02-1", slide: 1 },
      { imageId: "kw-img-ocr02-2", slide: 2 },
      { imageId: "kw-img-ocr02-3", slide: 2 },
    ]);
    expect(pptx.imagesNotEmbeddedBySlide).toEqual([{ slide: 2, count: 1 }]);
    expect(pptx.imageCount).toBe(4);
  });
});

// ================================================================================================
// K3 · Dokumente mit mehreren Bildern: korrekte Zuordnung und Reihenfolge
// ================================================================================================
describe("K3 · Zuordnung und Reihenfolge", () => {
  it("PowerPoint: Dokumentreihenfolge, Folie und Bild auf der Folie, Anker", async () => {
    const analyse = createBildAnalyse({ erkenne: markenEngine() });
    const befund = await analyse.analysiereQuelle(await pptxEingang(), ohneFortschritt);
    expect(
      befund.befunde.map((b) => ({
        bild: b.fundstelle.bild,
        folie: b.fundstelle.folie,
        aufFolie: b.fundstelle.bildAufFolie,
        anker: b.fundstelle.imageId,
        text: b.text,
      })),
    ).toEqual([
      { bild: 1, folie: 1, aufFolie: 1, anker: "kw-img-ocr02-1", text: TEXT_JE_MARKE.A },
      { bild: 2, folie: 2, aufFolie: 1, anker: "kw-img-ocr02-2", text: TEXT_JE_MARKE.B },
      { bild: 3, folie: 2, aufFolie: 2, anker: "kw-img-ocr02-3", text: TEXT_JE_MARKE.C },
    ]);
  });

  it("die Reihenfolge der Befunde folgt dem Dokument, nicht der Laufzeit der Erkennung", async () => {
    // Das erste Bild braucht am längsten — trotzdem steht es zuerst.
    const erkenne = vi.fn(async (src: string): Promise<OcrResult> => {
      const marke = markeAus(src) ?? "";
      await new Promise((r) => setTimeout(r, marke === "A" ? 30 : 1));
      return { status: "success", text: TEXT_JE_MARKE[marke] ?? "" };
    });
    const befund = await createBildAnalyse({ erkenne }).analysiereQuelle(
      await pptxEingang(),
      ohneFortschritt,
    );
    expect(befund.befunde.map((b) => b.text)).toEqual([
      TEXT_JE_MARKE.A,
      TEXT_JE_MARKE.B,
      TEXT_JE_MARKE.C,
    ]);
  });

  it("Word: mehrere Bilder in Dokumentreihenfolge mit Anker, verlorene Bilder gezählt", async () => {
    const html = [
      "<p>Einleitung</p>",
      `<figure><img data-image-id="kw-fig-1" src="${dataUrl(bildMit("C"))}"><figcaption data-image-id="kw-fig-1"></figcaption></figure>`,
      "<p>Zwischentext</p>",
      `<figure><img data-image-id="kw-fig-2" src="${dataUrl(bildMit("A"))}"><figcaption data-image-id="kw-fig-2"></figcaption></figure>`,
    ].join("");
    const befund = await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(
      docxBildEingang("handbuch.docx", html, 1),
      ohneFortschritt,
    );
    expect(befund.befunde.map((b) => [b.fundstelle.bild, b.fundstelle.imageId, b.text])).toEqual([
      [1, "kw-fig-1", TEXT_JE_MARKE.C],
      [2, "kw-fig-2", TEXT_JE_MARKE.A],
    ]);
    expect(befund.nichtGelesen).toEqual([{ anzahl: 1 }]);
    expect(befund.status).toBe("teilweise");
  });

  it("Folienansicht-Bilder (W04) tragen ihre eigene Foliennummer", () => {
    const html = `<h2>Folienansicht</h2><figure><img data-image-id="kw-img-abc-s3" src="${dataUrl(bildMit("A"))}"></figure>`;
    const [v] = bildVorkommenAusRumpf(html, { name: "x.pptx", art: "pptx" });
    expect(v?.fundstelle).toMatchObject({ folie: 3, folienansicht: true, bildAufFolie: 1 });
  });
});

// ================================================================================================
// K4 · Geändertes Bild → neuer aktueller Befund; unveränderte Bilder → keine erneute Analyse
// ================================================================================================
describe("K4 · Wiederverwendung und Neuauswertung", () => {
  it("dieselbe Datei noch einmal: keine neue Analyse, gleiche Befunde, als wiederverwendet markiert", async () => {
    const erkenne = markenEngine();
    const analyse = createBildAnalyse({ erkenne });
    const erst = await analyse.analysiereQuelle(await pptxEingang(), ohneFortschritt);
    expect(analyse.anzahlAnalysen()).toBe(3);
    const zweit = await analyse.analysiereQuelle(await pptxEingang(), ohneFortschritt);
    expect(analyse.anzahlAnalysen()).toBe(3);
    expect(erkenne).toHaveBeenCalledTimes(3);
    expect(zweit.befunde.map((b) => b.text)).toEqual(erst.befunde.map((b) => b.text));
    expect(zweit.befunde.every((b) => b.wiederverwendet)).toBe(true);
  });

  it("ein geändertes Bild: genau EINE neue Analyse, neuer Text, der alte gilt nicht mehr", async () => {
    const erkenne = markenEngine();
    const analyse = createBildAnalyse({ erkenne });
    const erst = await analyse.analysiereQuelle(await pptxEingang(), ohneFortschritt);
    const geaendert = await analyse.analysiereQuelle(
      await pptxEingang(deck(bildMit("B2"))),
      ohneFortschritt,
    );
    expect(analyse.anzahlAnalysen()).toBe(4);
    const [a, b, c] = geaendert.befunde;
    expect(a).toMatchObject({ text: TEXT_JE_MARKE.A, wiederverwendet: true });
    expect(c).toMatchObject({ text: TEXT_JE_MARKE.C, wiederverwendet: true });
    expect(b).toMatchObject({ text: TEXT_JE_MARKE.B2, wiederverwendet: false });
    expect(b?.text).not.toBe(TEXT_JE_MARKE.B);
    expect(b?.inhaltskennung).not.toBe(erst.befunde[1]?.inhaltskennung);
  });

  it("gleiche Bytes in anderer Quelle: kein zweiter Lauf, aber die eigene Fundstelle", async () => {
    const analyse = createBildAnalyse({ erkenne: markenEngine() });
    await analyse.analysiereQuelle(await pptxEingang(), ohneFortschritt);
    const einzeln = await analyse.analysiereQuelle(
      einzelbildEingang("a-einzeln.png", dataUrl(bildMit("A"))),
      ohneFortschritt,
    );
    expect(analyse.anzahlAnalysen()).toBe(3);
    expect(einzeln.befunde[0]).toMatchObject({
      text: TEXT_JE_MARKE.A,
      wiederverwendet: true,
      fundstelle: { quelle: "a-einzeln.png", art: "bild", bild: 1 },
    });
  });

  it("ein laufender Lauf wird geteilt, nicht verdoppelt", async () => {
    const erkenne = markenEngine();
    const analyse = createBildAnalyse({ erkenne });
    const v = einzelbildEingang("x.png", dataUrl(bildMit("E"))).vorkommen[0];
    if (!v) {
      throw new Error("kein Vorkommen");
    }
    const [eins, zwei] = await Promise.all([analyse.befundFuerBild(v), analyse.befundFuerBild(v)]);
    expect(erkenne).toHaveBeenCalledTimes(1);
    expect(eins.text).toBe(zwei.text);
  });

  it("ein Fehlschlag wird nicht gemerkt — der nächste Eingang versucht es erneut", async () => {
    const erkenne = vi
      .fn<(src: string) => Promise<OcrResult>>()
      .mockResolvedValueOnce({ status: "failed", text: "", error: "worker-crash" })
      .mockResolvedValueOnce({ status: "success", text: "jetzt gelesen" });
    const analyse = createBildAnalyse({ erkenne });
    const eingang = einzelbildEingang("x.png", dataUrl(bildMit("E")));
    const erst = await analyse.analysiereQuelle(eingang, ohneFortschritt);
    expect(erst.status).toBe("fehlgeschlagen");
    const danach = await analyse.analysiereQuelle(eingang, ohneFortschritt);
    expect(erkenne).toHaveBeenCalledTimes(2);
    expect(danach.befunde[0]).toMatchObject({ status: "gelesen", wiederverwendet: false });
  });
});

// ================================================================================================
// K5 · Unleserliche Stellen, fehlende Bildzugriffe, Fehler und Teilverarbeitung sind erkennbar
// ================================================================================================
describe("K5 · erkennbare Grenzen", () => {
  it("unsichere Wörter werden markiert, unleserliche ersetzt — nichts ergänzt", () => {
    const { textGekennzeichnet, unsicher } = kennzeichneUnsicheres("Druck 4,5 bar\nxq7 ok", [
      { text: "Druck", confidence: 96 },
      { text: "4,5", confidence: 41 },
      { text: "bar", confidence: 90 },
      { text: "xq7", confidence: 9 },
      { text: "ok", confidence: 88 },
    ]);
    expect(textGekennzeichnet).toBe("Druck [?4,5] bar\n[unleserlich] ok");
    expect(unsicher).toEqual([
      { wort: "4,5", sicherheit: 41, unleserlich: false },
      { wort: "xq7", sicherheit: 9, unleserlich: true },
    ]);
  });

  it("die Wortsicherheit der Engine kommt im Befund an", async () => {
    const erkenne = vi.fn(
      async (): Promise<OcrResult> => ({
        status: "success",
        text: "Ventil V3",
        woerter: [
          { text: "Ventil", confidence: 92 },
          { text: "V3", confidence: 20 },
        ],
      }),
    );
    const befund = await createBildAnalyse({ erkenne }).analysiereQuelle(
      einzelbildEingang("x.png", dataUrl(bildMit("E"))),
      ohneFortschritt,
    );
    expect(befund.befunde[0]).toMatchObject({
      text: "Ventil V3",
      textGekennzeichnet: "Ventil [unleserlich]",
      unsicher: [{ wort: "V3", sicherheit: 20, unleserlich: true }],
    });
  });

  it("fehlender Bildzugriff: kein Bytezugriff → „kein-zugriff“, keine Erkennung", async () => {
    const erkenne = markenEngine();
    const html = `<figure><img data-image-id="kw-fig-1" src="https://example.invalid/bild.png"></figure><figure><img data-image-id="kw-fig-2" src="${dataUrl(bildMit("A"))}"></figure>`;
    const befund = await createBildAnalyse({ erkenne }).analysiereQuelle(
      docxBildEingang("extern.docx", html, 0),
      ohneFortschritt,
    );
    expect(erkenne).toHaveBeenCalledTimes(1);
    expect(befund.befunde.map((b) => b.status)).toEqual(["kein-zugriff", "gelesen"]);
    expect(befund.status).toBe("teilweise");
  });

  it("Fehler, Zeitüberschreitung und nicht verfügbare Engine sind eigene Zustände", async () => {
    const nieFertig = createBildAnalyse({
      erkenne: () => new Promise<OcrResult>(() => {}),
      zeitlimitMs: 20,
    });
    const zeit = await nieFertig.analysiereQuelle(
      einzelbildEingang("x.png", dataUrl(bildMit("E"))),
      ohneFortschritt,
    );
    expect(zeit.befunde[0]?.status).toBe("zeitueberschreitung");
    expect(zeit.status).toBe("fehlgeschlagen");

    const weg = createBildAnalyse({ erkenne: async () => ({ status: "unavailable", text: "" }) });
    const nv = await weg.analysiereQuelle(
      einzelbildEingang("x.png", dataUrl(bildMit("E"))),
      ohneFortschritt,
    );
    expect(nv.status).toBe("nicht-verfuegbar");

    const wirft = createBildAnalyse({
      erkenne: async () => {
        throw new Error("kaputt");
      },
    });
    const f = await wirft.analysiereQuelle(
      einzelbildEingang("x.png", dataUrl(bildMit("E"))),
      ohneFortschritt,
    );
    expect(f.befunde[0]).toMatchObject({ status: "fehlgeschlagen", fehler: "kaputt" });
  });

  it("Teilverarbeitung: PowerPoint mit verworfenem Bild ist „teilweise“, mit Folie des Verlusts", async () => {
    const befund = await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(
      await pptxEingang(),
      ohneFortschritt,
    );
    expect(befund.befunde.every((b) => b.status === "gelesen")).toBe(true);
    expect(befund.nichtGelesen).toEqual([{ folie: 2, anzahl: 1 }]);
    expect(befund.hinweise).toContain("pptx-layout-nicht-erfasst");
    expect(befund.status).toBe("teilweise");
  });

  it("eine PowerPoint-Quelle heißt nie „vollständig“ — auch ohne Verlust (Layout/Master, L16)", async () => {
    const html = `<h2>Folie 1</h2><figure><img data-image-id="kw-img-t-1" src="${dataUrl(bildMit("A"))}"></figure>`;
    const eingang = pptxBildEingang("x.pptx", html, {
      imageCount: 1,
      imageSlides: [{ imageId: "kw-img-t-1", slide: 1 }],
      imagesNotEmbeddedBySlide: [],
    });
    const befund = await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(
      eingang,
      ohneFortschritt,
    );
    expect(befund.nichtGelesen).toEqual([]);
    expect(befund.status).toBe("teilweise");
  });

  it("große Quellen: über der Höchstzahl bleibt der Rest sichtbar „nicht analysiert“", async () => {
    const erkenne = markenEngine();
    const befund = await createBildAnalyse({ erkenne, hoechstzahl: 2 }).analysiereQuelle(
      await pptxEingang(),
      ohneFortschritt,
    );
    expect(erkenne).toHaveBeenCalledTimes(2);
    expect(befund.befunde.map((b) => b.status)).toEqual(["gelesen", "gelesen", "nicht-analysiert"]);
    expect(befund.befunde[2]?.grund).toBe("grenze");
    expect(befund.hinweise).toContain("grenze-erreicht");
    expect(befund.status).toBe("teilweise");
  });

  it("solange gelesen wird, steht „läuft“ — kein Zwischenstand gibt sich als fertig aus", async () => {
    const fortschritt: QuellenBefund[] = [];
    const ende = await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(
      einzelbildEingang("x.png", dataUrl(bildMit("E"))),
      { automatik: true, onFortschritt: (s) => fortschritt.push(s) },
    );
    expect(fortschritt.length).toBeGreaterThanOrEqual(2);
    expect(fortschritt[0]?.status).toBe("laeuft");
    expect(fortschritt[0]?.befunde[0]?.status).toBe("laeuft");
    expect(fortschritt.slice(0, -1).every((s) => s.status === "laeuft")).toBe(true);
    expect(ende.status).toBe("vollstaendig");
  });

  it("das Lesen verändert weder die Bilddaten noch die PowerPoint-Bytes", async () => {
    const bytes = deck();
    const vorher = Buffer.from(bytes).toString("base64");
    const eingang = await pptxEingang(bytes);
    const quellen = eingang.vorkommen.map((v) => v.src);
    await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(eingang, ohneFortschritt);
    expect(Buffer.from(bytes).toString("base64")).toBe(vorher);
    expect(eingang.vorkommen.map((v) => v.src)).toEqual(quellen);
  });
});
