// WP-D9b (bens D9-Befunde aus BERICHT-sammel1): (ROT 1) finales Body-Budget mit Drop-to-fit — die
// Rohbyte-Caps sind nur Vorfilter, autoritativ ist MAX_INLINE_BODY_HTML_BYTES in echten UTF-8-Bytes;
// überzählige GANZE figures fallen weg (deterministischer First-Fit in Dokumentreihenfolge), Text bleibt IMMER.
// (GELB 2) bildreine Decks sind importierbar (fileImportHasContent). (GELB 3) chunked Base64 mit
// identischer 1-/2-/3-Byte-Endsemantik (Referenz: Buffer).
//
// JOB 513 / D2 (BYTEBUDGET-/TRANSFERVERTRAG): die realen Bytebudget-Grenzen werden zusaetzlich UNTERHALB,
// EXAKT AN, KNAPP OBERHALB und DEUTLICH OBERHALB der Grenze geprueft - ausschliesslich mit den BESTEHENDEN
// Bytekonstanten und den REALEN Ergebniszaehlern; eine feste "erlaubte Bildzahl" gibt es im Produkt nicht
// und wird hier auch nicht erfunden.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  CAPTURE_FILE_TEXT,
  fileImportHasContent,
  imageTransferOutcome,
  imageTransferSummary,
} from "../../apps/web/src/lib/captureFromFile";
import {
  type DocxEngine,
  MAX_INLINE_BODY_HTML_BYTES,
  extractDocxRich,
  imageTransferBalanced,
  imageTransferContract,
  utf8ByteLength,
} from "../../apps/web/src/lib/docx";
import {
  PPTX_MAX_IMAGE_BYTES,
  PPTX_MAX_TOTAL_IMAGE_BYTES,
  type PptxUnzip,
  extractPptxRich,
} from "../../apps/web/src/lib/pptx";

const URI_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const URI_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const URI_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PLACEHOLDER = "Noch keine Bildbeschreibung";

function enc(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function noiseBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  let s = 0x9e3779b9;
  for (let i = 0; i < length; i += 1) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s |= 0;
    out[i] = s & 0xff;
  }
  return out;
}

function unzipOf(files: Record<string, Uint8Array>): PptxUnzip {
  return () => files;
}

function pictureSlide(rid: string, before: string, after: string): string {
  const sp = (txt: string) =>
    `<p:sp><p:txBody><a:p><a:r><a:t>${txt}</a:t></a:r></a:p></p:txBody></p:sp>`;
  const pic = `<p:pic><p:blipFill><a:blip r:embed="${rid}"/></p:blipFill></p:pic>`;
  return `<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:cSld><p:spTree>${sp(before)}${pic}${sp(after)}</p:spTree></p:cSld></p:sld>`;
}

function slideRels(rid: string, target: string): string {
  return `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/></Relationships>`;
}

describe("WP-D9b ROT-Fix 1: finales Body-Budget mit Drop-to-fit (REALE Konstanten)", () => {
  it("PFLICHT-Grenzfall: Rohbild UNTER 5 MiB, Base64+Text ÜBER 3,5 MB → Bild gedroppt, Text bleibt", async () => {
    // 2,7 MB roh: unter dem Rohbyte-Vorfilter (5 MiB) — Base64 = 4·ceil(n/3) = 3,6 Mio Zeichen und
    // sprengt damit die autoritative UTF-8-Grenze MAX_INLINE_BODY_HTML_BYTES (3.500.000).
    const rawBytes = 2_700_000;
    expect(rawBytes).toBeLessThan(PPTX_MAX_IMAGE_BYTES);
    const files: Record<string, Uint8Array> = {
      "ppt/slides/slide1.xml": enc(
        pictureSlide("rId2", "Wichtiger Text vor dem Bild", "Wichtiger Text nach dem Bild"),
      ),
      "ppt/slides/_rels/slide1.xml.rels": enc(slideRels("rId2", "../media/big.png")),
      "ppt/media/big.png": noiseBytes(rawBytes),
    };
    // KEIN Kunstbudget: Default-Grenzen (MAX_INLINE_BODY_HTML_BYTES, PPTX_MAX_IMAGE_BYTES).
    const res = await extractPptxRich(new ArrayBuffer(0), {
      unzip: unzipOf(files),
      imageCaptionPlaceholder: PLACEHOLDER,
      imageRunToken: "tok9b1",
    });
    // Das Bild passte roh, aber nicht als Base64 in den Body → GANZE figure entfernt, ehrlich gezählt.
    expect(res.droppedImageBudget).toBe(1);
    expect(res.embeddedImages).toBe(0);
    expect(res.html).not.toContain("<figure>");
    // Text bleibt IMMER erhalten; kein harter Fehler.
    expect(res.html).toContain("Wichtiger Text vor dem Bild");
    expect(res.html).toContain("Wichtiger Text nach dem Bild");
    expect(res.htmlOverflow).toBe(false);
    // Finales HTML unter der autoritativen Client-Grenze — und damit weit unter dem Server-Ceiling
    // (5 MiB Route-bodyLimit): Draft-Speicherung und Original-Upload bleiben möglich.
    expect(utf8ByteLength(res.html)).toBeLessThanOrEqual(MAX_INLINE_BODY_HTML_BYTES);
    expect(utf8ByteLength(res.html)).toBeLessThan(5 * 1024 * 1024);
  });

  it("Drop-to-fit ist First-Fit in Dokumentreihenfolge (frühe figures haben Vorrang)", async () => {
    // Zwei Bilder à ~90 KB Base64; Budget lässt nur eines zu → das ERSTE bleibt, das zweite fällt.
    const files: Record<string, Uint8Array> = {
      "ppt/slides/slide1.xml": enc(pictureSlide("rId2", "Erstes", "danach")),
      "ppt/slides/_rels/slide1.xml.rels": enc(slideRels("rId2", "../media/one.png")),
      "ppt/slides/slide2.xml": enc(pictureSlide("rId3", "Zweites", "Ende")),
      "ppt/slides/_rels/slide2.xml.rels": enc(slideRels("rId3", "../media/two.png")),
      "ppt/media/one.png": noiseBytes(66_000),
      "ppt/media/two.png": noiseBytes(66_000),
    };
    const res = await extractPptxRich(new ArrayBuffer(0), {
      unzip: unzipOf(files),
      imageCaptionPlaceholder: PLACEHOLDER,
      imageRunToken: "tok9b2",
      budgetBytes: 120_000, // Platz für EIN ~88-KB-Base64-Bild + Text, nicht für zwei
    });
    expect(res.embeddedImages).toBe(1);
    expect(res.droppedImageBudget).toBe(1);
    // First-Fit: das VORDERE Bild (Folie 1) hat Vorrang aufs Budget, das hintere passt nicht mehr.
    expect(res.html).toContain('data-image-id="kw-img-tok9b2-1"');
    expect(res.html).not.toContain('data-image-id="kw-img-tok9b2-2"');
    expect(res.html).toContain("Zweites"); // Text der zweiten Folie bleibt vollständig
    expect(res.htmlOverflow).toBe(false);
  });
});

describe("WP-D9b GELB-Fix 2: bildreine PPTX importierbar", () => {
  const FIGURE_HTML =
    '<h2>Folie 1</h2><figure><img data-image-id="kw-img-x1-1" src="data:image/png;base64,QQ=="><figcaption data-image-id="kw-img-x1-1">c</figcaption></figure>';

  it("fileImportHasContent: Bilder ohne Text → importierbar; weder Text noch Bilder → Ablehnung", () => {
    expect(fileImportHasContent("", FIGURE_HTML)).toBe(true);
    expect(fileImportHasContent("   ", FIGURE_HTML)).toBe(true);
    expect(fileImportHasContent("Text da", null)).toBe(true);
    // Komplett leeres Deck (weder Text noch verankerte figure) → weiterhin ehrliche Ablehnung.
    expect(fileImportHasContent("", null)).toBe(false);
    expect(fileImportHasContent("", "<h2>Folie 1</h2><p></p>")).toBe(false);
    // figure OHNE data-image-id zählt nicht (kein Fußnoten-Vertrag).
    expect(
      fileImportHasContent("", '<figure><img src="data:image/png;base64,QQ=="></figure>'),
    ).toBe(false);
  });

  it("bildreines Deck Ende-zu-Ende: Extraktion liefert figures, die Import-Entscheidung lässt es zu", async () => {
    const files: Record<string, Uint8Array> = {
      "ppt/slides/slide1.xml": enc(
        `<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:cSld><p:spTree><p:pic><p:blipFill><a:blip r:embed="rId2"/></p:blipFill></p:pic></p:spTree></p:cSld></p:sld>`,
      ),
      "ppt/slides/_rels/slide1.xml.rels": enc(slideRels("rId2", "../media/foto.png")),
      "ppt/media/foto.png": noiseBytes(512),
    };
    const res = await extractPptxRich(new ArrayBuffer(0), {
      unzip: unzipOf(files),
      imageCaptionPlaceholder: PLACEHOLDER,
      imageRunToken: "tok9b3",
    });
    expect(res.text).toBe(""); // reine Bild-Folie: ehrlich kein Klartext
    expect(res.embeddedImages).toBe(1);
    expect(fileImportHasContent(res.text, res.html)).toBe(true);
  });

  it("Capture-Verdrahtung: Gate nutzt fileImportHasContent VOR setFileOriginal; Extraktion ohne Text deaktiviert", () => {
    const src = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"), "utf8");
    // WP-D9c: das Gate traegt jetzt zusaetzlich das Quell-Signal (sourceHadImages).
    const gate = src.indexOf("fileImportHasContent(text, rich.html, sourceHadImages)");
    const original = src.indexOf("setFileOriginal({");
    expect(gate).toBeGreaterThan(0);
    // Das Original wird NACH dem Gate gesetzt → ein bildreiches Deck erreicht den Original-Anhang.
    expect(original).toBeGreaterThan(gate);
    // Nur die KI-Punkte-Extraktion bleibt ohne Text aus (PAKET 1 D-AISTATE: zusätzlich ohne Modell).
    expect(src).toContain("fileText.trim().length === 0");
    expect(src).toContain("!extractAi.available");
    // JOB 513/D3B: die Meldungswahl hängt am Bildtransfer-VERTRAG — „übernommen" nur bei real
    // eingebetteten Bildern; über den Original-Anhang wird zur Lesezeit nichts behauptet.
    expect(src).toContain("imageTransfer.embeddedImages > 0");
  });

  it("die ehrliche Meldung existiert DE/EN/NL", () => {
    for (const lng of ["de", "en", "nl"]) {
      const msg = String(i18n.getResource(lng, "translation", "capture.file.imagesOnlyNoText"));
      expect(msg.length, lng).toBeGreaterThan(0);
    }
    expect(
      String(i18n.getResource("de", "translation", "capture.file.imagesOnlyNoText")),
    ).toContain("keine KI-Vorschläge");
  });
});

describe("WP-D9b GELB-Fix 3: chunked Base64 — identische Endsemantik", () => {
  async function base64Of(bytes: Uint8Array): Promise<string> {
    const files: Record<string, Uint8Array> = {
      "ppt/slides/slide1.xml": enc(pictureSlide("rId2", "a", "b")),
      "ppt/slides/_rels/slide1.xml.rels": enc(slideRels("rId2", "../media/x.png")),
      "ppt/media/x.png": bytes,
    };
    const res = await extractPptxRich(new ArrayBuffer(0), {
      unzip: unzipOf(files),
      imageCaptionPlaceholder: PLACEHOLDER,
      imageRunToken: "tok9b4",
    });
    const m = /src="data:image\/png;base64,([^"]*)"/.exec(res.html);
    if (!m?.[1]) {
      throw new Error("keine data-URL im Ergebnis");
    }
    return m[1];
  }

  it("1-/2-/3-Byte-Enden identisch zur Referenz (Buffer)", async () => {
    // Längen 3k, 3k+1, 3k+2 — die drei Padding-Fälle am Gesamt-Ende.
    for (const len of [6, 7, 8]) {
      const bytes = noiseBytes(len);
      expect(await base64Of(bytes), `len=${len}`).toBe(Buffer.from(bytes).toString("base64"));
    }
  });

  it("Chunk-Grenzen (über 8190 Bytes) ändern das Ergebnis nicht", async () => {
    // 20 000 Bytes überspannen mehrere 8190er-Slices; plus die drei End-Varianten um die Grenze herum.
    for (const len of [20_000, 8_190, 8_191, 8_192]) {
      const bytes = noiseBytes(len);
      expect(await base64Of(bytes), `len=${len}`).toBe(Buffer.from(bytes).toString("base64"));
    }
  });
});

// ---------------------------------------------------------------------------
// JOB 513 / D2 - Bytebudget-/Transfervertrag
// ---------------------------------------------------------------------------

// Ein Deck aus N Folien mit je EINEM Bild. `bytes: null` bedeutet: das Ziel steht in den Rels, die
// Mediendatei FEHLT (defektes/unaufloesbares Bild). Gleiches `target` in zwei Folien = doppelte Referenz.
function slideDeck(
  specs: readonly { target: string; bytes: Uint8Array | null }[],
): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  specs.forEach((spec, i) => {
    const n = i + 1;
    const rid = `rId${n + 1}`;
    files[`ppt/slides/slide${n}.xml`] = enc(pictureSlide(rid, `Vor ${n}`, `Nach ${n}`));
    files[`ppt/slides/_rels/slide${n}.xml.rels`] = enc(slideRels(rid, `../media/${spec.target}`));
    if (spec.bytes) {
      files[`ppt/media/${spec.target}`] = spec.bytes;
    }
  });
  return files;
}

async function pptxWith(
  files: Record<string, Uint8Array>,
  budgetBytes?: number,
  token = "tokd2",
): Promise<Awaited<ReturnType<typeof extractPptxRich>>> {
  return extractPptxRich(new ArrayBuffer(0), {
    unzip: unzipOf(files),
    imageCaptionPlaceholder: PLACEHOLDER,
    imageRunToken: token,
    ...(budgetBytes === undefined ? {} : { budgetBytes }),
  });
}

const ONE_IMAGE_DECK = () => slideDeck([{ target: "fit.png", bytes: noiseBytes(66_000) }]);

describe("JOB 513/D2: REALE Bytebudget-Grenze - unterhalb, exakt, knapp darueber, deutlich darueber", () => {
  // Die "erlaubte Bildzahl" ist im Produkt KEINE Konstante, sondern eine Funktion der Bildgroessen. Die
  // wirksame Grenze wird deshalb aus dem REALEN Ergebnis gemessen: EIN Bild + Text, weit unter Budget -
  // die tatsaechlichen UTF-8-Bytes des finalen HTML sind der exakte Punkt, an dem es gerade noch passt.
  async function exactFitBytes(): Promise<number> {
    const res = await pptxWith(ONE_IMAGE_DECK(), MAX_INLINE_BODY_HTML_BYTES, "tokfit");
    expect(res.imageTransfer.embeddedImages).toBe(1);
    return utf8ByteLength(res.html);
  }

  it("UNTERHALB der Grenze: alles uebernommen, Vertrag meldet vollstaendigen Transfer", async () => {
    const exact = await exactFitBytes();
    const res = await pptxWith(ONE_IMAGE_DECK(), exact + 10_000, "tokfit");
    const c = res.imageTransfer;
    expect(c.attempted).toBe(true);
    expect(c.totalImages).toBe(1);
    expect(c.embeddedImages).toBe(1);
    expect(c.droppedImageBudget).toBe(0);
    expect(c.bodyBudgetBytes).toBe(exact + 10_000);
    expect(c.bodyBytes).toBe(exact);
    expect(c.bodyOverflow).toBe(false);
    expect(imageTransferBalanced(c)).toBe(true);
    expect(imageTransferOutcome(c)).toBe("all-transferred");
  });

  it("EXAKT AN der Grenze (bodyBytes gleich bodyBudgetBytes): Bild bleibt, nichts wird verworfen", async () => {
    const exact = await exactFitBytes();
    const res = await pptxWith(ONE_IMAGE_DECK(), exact, "tokfit");
    const c = res.imageTransfer;
    expect(c.bodyBudgetBytes).toBe(exact);
    expect(c.bodyBytes).toBe(exact);
    expect(c.embeddedImages).toBe(1);
    expect(c.droppedImageBudget).toBe(0);
    expect(c.bodyOverflow).toBe(false);
    expect(imageTransferOutcome(c)).toBe("all-transferred");
  });

  it("KNAPP OBERHALB (Grenze minus 1 Byte): das Bild faellt budgetbedingt, der Text bleibt", async () => {
    const exact = await exactFitBytes();
    const res = await pptxWith(ONE_IMAGE_DECK(), exact - 1, "tokfit");
    const c = res.imageTransfer;
    expect(c.totalImages).toBe(1);
    expect(c.embeddedImages).toBe(0);
    expect(c.droppedImageBudget).toBe(1);
    expect(c.bodyBudgetBytes).toBe(exact - 1);
    expect(c.bodyBytes).toBeLessThan(exact - 1);
    expect(c.bodyOverflow).toBe(false);
    expect(res.html).toContain("Vor 1");
    expect(imageTransferBalanced(c)).toBe(true);
    expect(imageTransferOutcome(c)).toBe("none-transferred");
  });

  it("DEUTLICH DARUEBER (Default-Grenze, 2,7-MB-Rohbild): Drop an der echten Konstante", async () => {
    const res = await pptxWith(slideDeck([{ target: "huge.png", bytes: noiseBytes(2_700_000) }]));
    const c = res.imageTransfer;
    expect(c.bodyBudgetBytes).toBe(MAX_INLINE_BODY_HTML_BYTES);
    expect(c.droppedImageBudget).toBe(1);
    expect(c.embeddedImages).toBe(0);
    expect(c.bodyBytes).toBeLessThanOrEqual(MAX_INLINE_BODY_HTML_BYTES);
    expect(imageTransferOutcome(c)).toBe("none-transferred");
  });
});

describe("JOB 513/D2: Gegenproben - null, klein, gemischt, doppelt, defekt, Format", () => {
  it("NULL Bilder: eigener Grund, KEIN Budgetgrund", async () => {
    const files: Record<string, Uint8Array> = {
      "ppt/slides/slide1.xml": enc(
        `<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Nur Text</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`,
      ),
    };
    const res = await pptxWith(files);
    const c = res.imageTransfer;
    expect(c.totalImages).toBe(0);
    expect(c.embeddedImages).toBe(0);
    expect(c.droppedImageBudget).toBe(0);
    expect(imageTransferOutcome(c)).toBe("no-images");
    const summary = imageTransferSummary(c, { originalAttached: true });
    expect(summary.notices).toEqual([]);
    expect(summary.budgetLimited).toBe(false);
  });

  it("EIN kleines Bild: vollstaendig uebernommen, Original im Anhang", async () => {
    const res = await pptxWith(slideDeck([{ target: "klein.png", bytes: noiseBytes(512) }]));
    const c = res.imageTransfer;
    expect(c.totalImages).toBe(1);
    expect(c.embeddedImages).toBe(1);
    expect(imageTransferOutcome(c)).toBe("all-transferred");
    const summary = imageTransferSummary(c, { originalAttached: true });
    expect(summary.complete).toBe(true);
    expect(summary.budgetLimited).toBe(false);
    expect(summary.notices.map((n) => n.key)).toEqual([CAPTURE_FILE_TEXT.imagesKept]);
  });

  it("MEHRERE unterschiedlich grosse Bilder: First-Fit, ehrliche Teilbilanz statt Erfolgsmeldung", async () => {
    const files = slideDeck([
      { target: "a.png", bytes: noiseBytes(9_000) },
      { target: "b.png", bytes: noiseBytes(30_000) },
      { target: "c.png", bytes: noiseBytes(90_000) },
    ]);
    const res = await pptxWith(files, 70_000, "tokmix");
    const c = res.imageTransfer;
    expect(c.totalImages).toBe(3);
    expect(c.embeddedImages).toBe(2);
    expect(c.droppedImageBudget).toBe(1);
    expect(imageTransferBalanced(c)).toBe(true);
    expect(imageTransferOutcome(c)).toBe("partial-budget");
    const summary = imageTransferSummary(c, { originalAttached: true });
    expect(summary.complete).toBe(false);
    expect(summary.budgetLimited).toBe(true);
    expect(summary.notices.map((n) => n.key)).not.toContain(CAPTURE_FILE_TEXT.imagesKept);
    expect(summary.notices.map((n) => n.key)).toContain(CAPTURE_FILE_TEXT.imagesKeptDropped);
    expect(summary.notices.map((n) => n.key)).toContain(CAPTURE_FILE_TEXT.pptxImagesBudget);
    const budgetNotice = summary.notices.find((n) => n.key === CAPTURE_FILE_TEXT.pptxImagesBudget);
    expect(budgetNotice?.params.count).toBe(1);
  });

  it("DOPPELTE Referenz: getrennt gezaehlt, kein Drop- und kein Fehlergrund", async () => {
    const res = await pptxWith(
      slideDeck([
        { target: "same.png", bytes: noiseBytes(512) },
        { target: "same.png", bytes: noiseBytes(512) },
      ]),
      undefined,
      "tokdup",
    );
    const c = res.imageTransfer;
    expect(c.totalImages).toBe(2);
    expect(c.embeddedImages).toBe(2);
    expect(c.duplicateImageRefs).toBe(1);
    expect(c.droppedImageBudget).toBe(0);
    expect(c.droppedImageFormat).toBe(0);
    expect(c.droppedImageUnresolved).toBe(0);
    expect(imageTransferOutcome(c)).toBe("all-transferred");
  });
});

describe("JOB 513/D2: Defekt- und Formatgruende bleiben vom Budgetgrund getrennt", () => {
  it("DEFEKTES Bild (Rels-Ziel ohne Mediendatei): eigener Zaehler, nicht Budget und nicht Format", async () => {
    const res = await pptxWith(
      slideDeck([
        { target: "gut.png", bytes: noiseBytes(512) },
        { target: "kaputt.png", bytes: null },
      ]),
      undefined,
      "tokdef",
    );
    const c = res.imageTransfer;
    expect(c.totalImages).toBe(2);
    expect(c.embeddedImages).toBe(1);
    expect(c.droppedImageUnresolved).toBe(1);
    expect(c.droppedImageBudget).toBe(0);
    expect(c.droppedImageFormat).toBe(0);
    expect(imageTransferBalanced(c)).toBe(true);
    expect(imageTransferOutcome(c)).toBe("partial-defect");
    const summary = imageTransferSummary(c, { originalAttached: true });
    expect(summary.complete).toBe(false);
    expect(summary.budgetLimited).toBe(false);
    // JOB 513/D3B (BEN2-D2 Mangel 4): der Defektgrund IST jetzt lokalisiert — er hat einen echten
    // DE/EN/NL-Schlüssel. `hasUnlocalizedCause` meldet ab hier nur noch den unausgeglichenen Rest,
    // und die Bilanz geht hier auf. Der D2-Stand pinnte genau die Lücke fest, die diese Scheibe schließt.
    expect(summary.hasUnlocalizedCause).toBe(false);
    expect(summary.balanced).toBe(true);
    expect(summary.notices.map((n) => n.key)).toContain(CAPTURE_FILE_TEXT.imagesDefect);
    const defectNotice = summary.notices.find((n) => n.key === CAPTURE_FILE_TEXT.imagesDefect);
    expect(defectNotice?.params.count).toBe(1);
    for (const lng of ["de", "en", "nl"]) {
      const msg = String(i18n.getResource(lng, "translation", CAPTURE_FILE_TEXT.imagesDefect));
      expect(msg.length, lng).toBeGreaterThan(0);
    }
  });

  it("NICHT UNTERSTUETZTES Format (.emf): Formatgrund, getrennt vom Budgetgrund", async () => {
    const res = await pptxWith(
      slideDeck([
        { target: "gut.png", bytes: noiseBytes(512) },
        { target: "alt.emf", bytes: noiseBytes(512) },
      ]),
      undefined,
      "tokfmt",
    );
    const c = res.imageTransfer;
    expect(c.totalImages).toBe(2);
    expect(c.embeddedImages).toBe(1);
    expect(c.droppedImageFormat).toBe(1);
    expect(c.droppedImageBudget).toBe(0);
    expect(imageTransferBalanced(c)).toBe(true);
    expect(imageTransferOutcome(c)).toBe("partial-format");
    const summary = imageTransferSummary(c, { originalAttached: true });
    expect(summary.budgetLimited).toBe(false);
    expect(summary.notices.map((n) => n.key)).toContain(CAPTURE_FILE_TEXT.pptxImagesFormat);
    expect(summary.notices.map((n) => n.key)).not.toContain(CAPTURE_FILE_TEXT.pptxImagesBudget);
  });

  it("GEMISCHT (Budget und Format): beide Gruende getrennt benannt", async () => {
    const res = await pptxWith(
      slideDeck([
        { target: "klein.png", bytes: noiseBytes(600) },
        { target: "alt.emf", bytes: noiseBytes(512) },
        { target: "gross.png", bytes: noiseBytes(90_000) },
      ]),
      6_000,
      "tokmixed",
    );
    const c = res.imageTransfer;
    expect(c.droppedImageFormat).toBe(1);
    expect(c.droppedImageBudget).toBe(1);
    expect(imageTransferBalanced(c)).toBe(true);
    expect(imageTransferOutcome(c)).toBe("partial-mixed");
    const summary = imageTransferSummary(c, { originalAttached: false });
    expect(summary.budgetLimited).toBe(true);
    expect(summary.notices.map((n) => n.key)).toContain(CAPTURE_FILE_TEXT.imagesLost);
    expect(summary.notices.map((n) => n.key)).toContain(CAPTURE_FILE_TEXT.pptxImagesBudget);
    expect(summary.notices.map((n) => n.key)).toContain(CAPTURE_FILE_TEXT.pptxImagesFormat);
  });

  it("jeder gelieferte Meldungsschluessel existiert real in DE/EN/NL", async () => {
    const res = await pptxWith(
      slideDeck([
        { target: "klein.png", bytes: noiseBytes(600) },
        { target: "alt.emf", bytes: noiseBytes(512) },
        { target: "gross.png", bytes: noiseBytes(90_000) },
      ]),
      6_000,
      "tokkeys",
    );
    const summary = imageTransferSummary(res.imageTransfer, { originalAttached: true });
    expect(summary.notices.length).toBeGreaterThan(0);
    for (const notice of summary.notices) {
      for (const lng of ["de", "en", "nl"]) {
        const msg = String(i18n.getResource(lng, "translation", notice.key));
        expect(msg.length, `${notice.key}/${lng}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("JOB 513/D2: DOCX und PPTX liefern denselben Vertrag", () => {
  function docxEngine(html: string): DocxEngine {
    return {
      convertToHtml: async () => ({ value: html, messages: [] }),
      extractRawText: async () => ({ value: "Dokumenttext", messages: [] }),
    };
  }

  const IMG = (payload: string) => `<img src="data:image/png;base64,${payload}">`;

  it("DOCX: derselbe Vertrag mit derselben autoritativen Bytegrenze", async () => {
    const res = await extractDocxRich(new ArrayBuffer(0), {
      engine: docxEngine(`<p>Text</p>${IMG("A".repeat(400))}`),
      mapImage: async (src) => src,
      imageBudgetBytes: MAX_INLINE_BODY_HTML_BYTES,
      imageCaptionPlaceholder: PLACEHOLDER,
      imageRunToken: "tokdocx",
    });
    const c = res.imageTransfer;
    expect(c.attempted).toBe(true);
    expect(c.totalImages).toBe(1);
    expect(c.embeddedImages).toBe(1);
    expect(c.droppedImageBudget).toBe(0);
    expect(c.bodyBudgetBytes).toBe(MAX_INLINE_BODY_HTML_BYTES);
    expect(c.bodyBytes).toBe(utf8ByteLength(res.html));
    expect(imageTransferBalanced(c)).toBe(true);
    expect(imageTransferOutcome(c)).toBe("all-transferred");
    expect(res.totalImages).toBe(1);
    expect(res.droppedImages).toBe(0);
  });

  it("DOCX: budgetbedingter Drop wird identisch zu PPTX benannt", async () => {
    const html = `<p>Text</p>${IMG("A".repeat(4_000))}${IMG("B".repeat(4_000))}`;
    const wide = await extractDocxRich(new ArrayBuffer(0), {
      engine: docxEngine(html),
      mapImage: async (src) => src,
      imageBudgetBytes: MAX_INLINE_BODY_HTML_BYTES,
      imageCaptionPlaceholder: PLACEHOLDER,
      imageRunToken: "tokdocx2",
    });
    const full = utf8ByteLength(wide.html);
    const res = await extractDocxRich(new ArrayBuffer(0), {
      engine: docxEngine(html),
      mapImage: async (src) => src,
      imageBudgetBytes: full - 1,
      imageCaptionPlaceholder: PLACEHOLDER,
      imageRunToken: "tokdocx2",
    });
    const c = res.imageTransfer;
    expect(c.totalImages).toBe(2);
    expect(c.embeddedImages).toBe(1);
    expect(c.droppedImageBudget).toBe(1);
    expect(c.bodyBudgetBytes).toBe(full - 1);
    expect(imageTransferOutcome(c)).toBe("partial-budget");
    const summary = imageTransferSummary(c, { originalAttached: true });
    expect(summary.budgetLimited).toBe(true);
    expect(summary.notices.map((n) => n.key)).toContain(CAPTURE_FILE_TEXT.imagesKeptDropped);
  });

  it("DOCX ohne Bytebudget: ehrlich KEINE wirksame Grenze (null), kein erfundener Wert", async () => {
    const res = await extractDocxRich(new ArrayBuffer(0), {
      engine: docxEngine(`<p>Text</p>${IMG("A".repeat(400))}`),
      mapImage: async (src) => src,
      imageCaptionPlaceholder: PLACEHOLDER,
      imageRunToken: "tokdocx3",
    });
    const c = res.imageTransfer;
    expect(c.bodyBudgetBytes).toBeNull();
    expect(c.totalImages).toBe(1);
    expect(c.embeddedImages).toBe(1);
    expect(c.droppedImageBudget).toBe(0);
    expect(imageTransferBalanced(c)).toBe(true);
  });

  it("JOB 513/D3B: DOCX meldet die Grenzart body-html mit realem Grenzwert", async () => {
    const html = `<p>Text</p>${IMG("A".repeat(4_000))}${IMG("B".repeat(4_000))}`;
    const wide = await extractDocxRich(new ArrayBuffer(0), {
      engine: docxEngine(html),
      mapImage: async (src) => src,
      imageBudgetBytes: MAX_INLINE_BODY_HTML_BYTES,
      imageCaptionPlaceholder: PLACEHOLDER,
      imageRunToken: "tokdocxk",
    });
    const full = utf8ByteLength(wide.html);
    const res = await extractDocxRich(new ArrayBuffer(0), {
      engine: docxEngine(html),
      mapImage: async (src) => src,
      imageBudgetBytes: full - 1,
      imageCaptionPlaceholder: PLACEHOLDER,
      imageRunToken: "tokdocxk",
    });
    const c = res.imageTransfer;
    expect(c.droppedImageBudget).toBe(1);
    expect(c.budgetDrops).toHaveLength(1);
    expect(c.budgetDrops[0]?.kind).toBe("body-html");
    // Der REALE Grenzwert, nicht irgendeine Konstante daneben.
    expect(c.budgetDrops[0]?.limitBytes).toBe(full - 1);
    expect(c.budgetDrops[0]?.count).toBe(1);
    // Der ausloesende Bedarf lag ueber der Grenze — sonst waere nichts gedroppt worden.
    expect(c.budgetDrops[0]?.actualBytes).toBeGreaterThan(full - 1);
    // Der DOCX-Weg kennt KEINE Rohbyte-Kanten.
    expect(c.budgetDrops.some((d) => d.kind !== "body-html")).toBe(false);
  });

  it("captureFromFile fuehrt KEINE eigene Bytegrenze - die Grenze reist im Vertrag", () => {
    const src = readFileSync(resolve(process.cwd(), "apps/web/src/lib/captureFromFile.ts"), "utf8");
    expect(src).not.toContain("MAX_INLINE_BODY_HTML_BYTES =");
    expect(src).not.toContain("PPTX_MAX_IMAGE_BYTES =");
    expect(src).toContain("DRAFT_PAYLOAD_LIMIT_BYTES = 4_500_000");
  });
});

// ---------------------------------------------------------------------------
// JOB 513 / D3B — die DREI Budgetkanten, die fail-closed-Bilanz und originalAttached
// ---------------------------------------------------------------------------
// BEN2-D2 Mangel 1: PPTX hat drei reale Grenzen; D2 schrieb alle in einen Zaehler und meldete danach
// pauschal die HTML-Grenze. Hier bekommt jede Kante ihren eigenen Unter-/Exakt-/Uebertest mit dem
// REALEN Grenzwert. Kunstbudgets sind ausdruecklich erlaubt und noetig: die Vorgabewerte (5 MiB / 20 MiB)
// liessen sich sonst nur mit 20-MB-Fixtures pruefen.

// Eine Folie mit EINEM p:pic-Bild UND einem Hintergrund-a:blip ausserhalb des p:pic-Pfads.
function backgroundBlipSlide(picRid: string, bgRid: string): string {
  const pic = `<p:pic><p:blipFill><a:blip r:embed="${picRid}"/></p:blipFill></p:pic>`;
  const bg = `<p:bg><p:bgPr><a:blipFill><a:blip r:embed="${bgRid}"/></a:blipFill></p:bgPr></p:bg>`;
  return `<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:cSld>${bg}<p:spTree>${pic}</p:spTree></p:cSld></p:sld>`;
}

async function oneImage(
  rawBytes: number,
  opts: { maxImageBytes?: number; maxTotalImageBytes?: number },
): Promise<Awaited<ReturnType<typeof extractPptxRich>>> {
  return extractPptxRich(new ArrayBuffer(0), {
    unzip: unzipOf(slideDeck([{ target: "x.png", bytes: noiseBytes(rawBytes) }])),
    imageCaptionPlaceholder: PLACEHOLDER,
    imageRunToken: "tokk",
    ...opts,
  });
}

describe("JOB 513/D3B: Grenzart pptx-single-image - unter, exakt, darueber", () => {
  const LIMIT = 1_000;

  it("UNTERHALB: Bild bleibt, keine Budgetmeldung", async () => {
    const c = (await oneImage(LIMIT - 1, { maxImageBytes: LIMIT })).imageTransfer;
    expect(c.embeddedImages).toBe(1);
    expect(c.droppedImageBudget).toBe(0);
    expect(c.budgetDrops).toEqual([]);
    expect(imageTransferOutcome(c)).toBe("all-transferred");
  });

  it("EXAKT AN der Grenze: Bild bleibt (die Grenze ist ein Hoechstwert, kein Ausschluss)", async () => {
    const c = (await oneImage(LIMIT, { maxImageBytes: LIMIT })).imageTransfer;
    expect(c.embeddedImages).toBe(1);
    expect(c.droppedImageBudget).toBe(0);
    expect(c.budgetDrops).toEqual([]);
  });

  it("DARUEBER: Drop mit Grenzart pptx-single-image, realem Grenzwert und ausloesendem Wert", async () => {
    const c = (await oneImage(LIMIT + 1, { maxImageBytes: LIMIT })).imageTransfer;
    expect(c.embeddedImages).toBe(0);
    expect(c.droppedImageBudget).toBe(1);
    expect(c.budgetDrops).toEqual([
      { kind: "pptx-single-image", limitBytes: LIMIT, actualBytes: LIMIT + 1, count: 1 },
    ]);
    expect(imageTransferBalanced(c)).toBe(true);
    expect(imageTransferOutcome(c)).toBe("none-transferred");
    // Die gemeldete Grenze ist NICHT das HTML-Budget — genau das war der D2-Mangel.
    expect(c.budgetDrops.some((d) => d.kind === "body-html")).toBe(false);
  });

  it("die REALE Konstante wirkt ohne Kunstbudget: 5 MiB je Bild", async () => {
    const c = (await oneImage(PPTX_MAX_IMAGE_BYTES + 1, {})).imageTransfer;
    expect(c.droppedImageBudget).toBe(1);
    expect(c.budgetDrops[0]?.kind).toBe("pptx-single-image");
    expect(c.budgetDrops[0]?.limitBytes).toBe(PPTX_MAX_IMAGE_BYTES);
  });
});

describe("JOB 513/D3B: Grenzart pptx-total-images - unter, exakt, darueber", () => {
  async function twoImages(each: number, maxTotalImageBytes: number) {
    const res = await extractPptxRich(new ArrayBuffer(0), {
      unzip: unzipOf(
        slideDeck([
          { target: "a.png", bytes: noiseBytes(each) },
          { target: "b.png", bytes: noiseBytes(each) },
        ]),
      ),
      imageCaptionPlaceholder: PLACEHOLDER,
      imageRunToken: "toktot",
      maxTotalImageBytes,
    });
    return res.imageTransfer;
  }

  it("UNTERHALB der Summengrenze: beide Bilder bleiben", async () => {
    const c = await twoImages(1_000, 3_000);
    expect(c.embeddedImages).toBe(2);
    expect(c.droppedImageBudget).toBe(0);
    expect(c.budgetDrops).toEqual([]);
  });

  it("EXAKT AN der Summengrenze: beide Bilder bleiben", async () => {
    const c = await twoImages(1_000, 2_000);
    expect(c.embeddedImages).toBe(2);
    expect(c.droppedImageBudget).toBe(0);
  });

  it("DARUEBER: das zweite faellt mit Grenzart pptx-total-images", async () => {
    const c = await twoImages(1_000, 1_999);
    expect(c.embeddedImages).toBe(1);
    expect(c.droppedImageBudget).toBe(1);
    expect(c.budgetDrops).toEqual([
      { kind: "pptx-total-images", limitBytes: 1_999, actualBytes: 2_000, count: 1 },
    ]);
    expect(imageTransferBalanced(c)).toBe(true);
    expect(imageTransferOutcome(c)).toBe("partial-budget");
  });

  it("die REALE Konstante existiert und ist die Summengrenze", () => {
    expect(PPTX_MAX_TOTAL_IMAGE_BYTES).toBe(20 * 1024 * 1024);
    expect(PPTX_MAX_TOTAL_IMAGE_BYTES).toBeGreaterThan(PPTX_MAX_IMAGE_BYTES);
  });

  it("reisst ein Bild BEIDE Rohgrenzen, gilt die ZUERST ausloesende (Einzelbild)", async () => {
    const c = (await oneImage(2_000, { maxImageBytes: 1_000, maxTotalImageBytes: 1_500 }))
      .imageTransfer;
    expect(c.droppedImageBudget).toBe(1);
    expect(c.budgetDrops).toHaveLength(1);
    expect(c.budgetDrops[0]?.kind).toBe("pptx-single-image");
  });
});

describe("JOB 513/D3B: fail-closed Bilanz", () => {
  it("Hintergrund-a:blip ausserhalb p:pic: eigener Grund, NIE all-transferred", async () => {
    const files: Record<string, Uint8Array> = {
      "ppt/slides/slide1.xml": enc(backgroundBlipSlide("rId2", "rId3")),
      "ppt/slides/_rels/slide1.xml.rels": enc(slideRels("rId2", "../media/vorn.png")),
      "ppt/media/vorn.png": noiseBytes(512),
    };
    const res = await pptxWith(files, undefined, "tokbg");
    const c = res.imageTransfer;
    // Zwei a:blip in der Quelle, aber nur eines im ausgewerteten p:pic-Pfad.
    expect(c.totalImages).toBe(2);
    expect(c.embeddedImages).toBe(1);
    expect(c.droppedImageOutsidePath).toBe(1);
    expect(c.droppedImageBudget).toBe(0);
    expect(c.droppedImageFormat).toBe(0);
    expect(c.droppedImageUnresolved).toBe(0);
    // Die Bilanz geht auf — WEIL der Grund jetzt existiert. In D2 fehlte er und sie ging still nicht auf.
    expect(imageTransferBalanced(c)).toBe(true);
    expect(imageTransferOutcome(c)).toBe("partial-outside-path");
    const summary = imageTransferSummary(c, { originalAttached: true });
    expect(summary.complete).toBe(false);
    expect(summary.notices.map((n) => n.key)).toContain(CAPTURE_FILE_TEXT.imagesOutsidePath);
    expect(summary.hasUnlocalizedCause).toBe(false);
  });

  it("UNAUSGEGLICHEN darf niemals all-transferred oder complete liefern", () => {
    // Direkt konstruiert: drei erkannte Bilder, eines uebernommen, KEIN Verlustgrund. Genau dieser
    // Vertrag lieferte in D2 `all-transferred` und `complete: true`.
    const c = imageTransferContract({
      attempted: true,
      totalImages: 3,
      embeddedImages: 1,
      bodyBytes: 100,
      bodyBudgetBytes: MAX_INLINE_BODY_HTML_BYTES,
      bodyOverflow: false,
    });
    expect(imageTransferBalanced(c)).toBe(false);
    expect(imageTransferOutcome(c)).toBe("unbalanced");
    const summary = imageTransferSummary(c, { originalAttached: true });
    expect(summary.complete).toBe(false);
    expect(summary.balanced).toBe(false);
    // Der unerklaerte Rest ist der EINZIGE verbleibende unlokalisierte Grund.
    expect(summary.hasUnlocalizedCause).toBe(true);
  });
});

describe("JOB 513/D3B: originalAttached wird in JEDEM Meldungszweig respektiert", () => {
  it("alles verworfen OHNE Original: kein Satz behauptet einen Anhang", async () => {
    const res = await pptxWith(slideDeck([{ target: "gross.png", bytes: noiseBytes(2_700_000) }]));
    const c = res.imageTransfer;
    expect(c.embeddedImages).toBe(0);
    expect(c.droppedImageBudget).toBe(1);
    const summary = imageTransferSummary(c, { originalAttached: false });
    const keys = summary.notices.map((n) => n.key);
    expect(keys).toContain(CAPTURE_FILE_TEXT.imagesAllDroppedNoOriginal);
    // Der Satz mit der Anhangs-Zusage darf hier NICHT vorkommen (BEN2-D2 Mangel 3).
    expect(keys).not.toContain(CAPTURE_FILE_TEXT.imagesAllDropped);
    const de = String(
      i18n.getResource("de", "translation", CAPTURE_FILE_TEXT.imagesAllDroppedNoOriginal),
    );
    expect(de).toContain("NICHT");
    expect(de).not.toMatch(/wird beim Speichern als Anhang mitgeführt/);
  });

  it("alles verworfen MIT Original: die Anhangs-Zusage ist gedeckt und darf stehen", async () => {
    const res = await pptxWith(slideDeck([{ target: "gross.png", bytes: noiseBytes(2_700_000) }]));
    const summary = imageTransferSummary(res.imageTransfer, { originalAttached: true });
    expect(summary.notices.map((n) => n.key)).toContain(CAPTURE_FILE_TEXT.imagesAllDropped);
  });

  it("Format-/Defektverlust OHNE Original wird ebenfalls benannt", async () => {
    const res = await pptxWith(
      slideDeck([
        { target: "gut.png", bytes: noiseBytes(512) },
        { target: "alt.emf", bytes: noiseBytes(512) },
        { target: "kaputt.png", bytes: null },
      ]),
      undefined,
      "tokfdn",
    );
    const c = res.imageTransfer;
    expect(c.droppedImageBudget).toBe(0);
    expect(c.droppedImageFormat).toBe(1);
    expect(c.droppedImageUnresolved).toBe(1);
    const summary = imageTransferSummary(c, { originalAttached: false });
    const keys = summary.notices.map((n) => n.key);
    // Ohne Budgetanteil gab es in D2 gar keine Aussage zum Original — jetzt schon.
    expect(keys).toContain(CAPTURE_FILE_TEXT.imagesNoOriginal);
    expect(keys).toContain(CAPTURE_FILE_TEXT.pptxImagesFormat);
    expect(keys).toContain(CAPTURE_FILE_TEXT.imagesDefect);
    expect(keys).not.toContain(CAPTURE_FILE_TEXT.imagesKept);
  });

  it("jeder D3B-Meldungsschluessel existiert real in DE/EN/NL", () => {
    const keys = [
      CAPTURE_FILE_TEXT.imagesAllDroppedNoOriginal,
      CAPTURE_FILE_TEXT.imagesDefect,
      CAPTURE_FILE_TEXT.imagesOutsidePath,
      CAPTURE_FILE_TEXT.imagesBudgetBodyHtml,
      CAPTURE_FILE_TEXT.imagesBudgetSingleImage,
      CAPTURE_FILE_TEXT.imagesBudgetTotalImages,
    ];
    for (const key of keys) {
      for (const lng of ["de", "en", "nl"]) {
        const msg = String(i18n.getResource(lng, "translation", key));
        expect(msg.length, `${key}/${lng}`).toBeGreaterThan(0);
        expect(msg, `${key}/${lng}`).not.toBe(key);
      }
    }
  });
});
