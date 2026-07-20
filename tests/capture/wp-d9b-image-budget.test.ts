// WP-D9b (bens D9-Befunde aus BERICHT-sammel1): (ROT 1) finales Body-Budget mit Drop-to-fit — die
// Rohbyte-Caps sind nur Vorfilter, autoritativ ist MAX_INLINE_BODY_HTML_BYTES in echten UTF-8-Bytes;
// überzählige GANZE figures fallen weg (Dokumentreihenfolge → letzte zuerst), Text bleibt IMMER.
// (GELB 2) bildreine Decks sind importierbar (fileImportHasContent). (GELB 3) chunked Base64 mit
// identischer 1-/2-/3-Byte-Endsemantik (Referenz: Buffer).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { fileImportHasContent } from "../../apps/web/src/lib/captureFromFile";
import { MAX_INLINE_BODY_HTML_BYTES, utf8ByteLength } from "../../apps/web/src/lib/docx";
import { PPTX_MAX_IMAGE_BYTES, type PptxUnzip, extractPptxRich } from "../../apps/web/src/lib/pptx";

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

  it("Drop-to-fit entfernt die LETZTEN figures zuerst (Dokumentreihenfolge bleibt vorne intakt)", async () => {
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
    // Das VORDERE Bild (Folie 1) lebt, das hintere ist gedroppt.
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
    const gate = src.indexOf("fileImportHasContent(text, rich.html)");
    const original = src.indexOf("setFileOriginal({");
    expect(gate).toBeGreaterThan(0);
    // Das Original wird NACH dem Gate gesetzt → ein bildreiches Deck erreicht den Original-Anhang.
    expect(original).toBeGreaterThan(gate);
    // Nur die KI-Punkte-Extraktion bleibt ohne Text aus.
    expect(src).toContain("extract.isPending || fileBusy || fileText.trim().length === 0");
    expect(src).toContain("CAPTURE_FILE_TEXT.imagesOnlyNoText");
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
