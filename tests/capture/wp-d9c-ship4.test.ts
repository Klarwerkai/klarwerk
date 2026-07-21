// WP-D9c (bens letzte Befunde aus BERICHT-sammel2, vor Ship 4): (ROT 1) All-images-dropped-Kombinationsfall
// — die Import-Entscheidung zählt die QUELLE (sourceHadImages), nicht den Rest nach dem Drop; das Original
// bleibt als Anhang erreichbar und die Meldung behauptet kein „übernommen". (Evidenz 4) Der ECHTE
// Draft-Payload des Produktpfads bleibt unter dem 5-MiB-Server-Ceiling (DRAFTS_BODY_LIMIT).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  fileImportHasContent,
  wholeDocumentDraftPayload,
} from "../../apps/web/src/lib/captureFromFile";
import { utf8ByteLength } from "../../apps/web/src/lib/docx";
import { type PptxUnzip, extractPptxRich } from "../../apps/web/src/lib/pptx";
import { DRAFTS_BODY_LIMIT } from "../../services/app/src/routes/capture-routes";

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

function pictureOnlySlide(rid: string): string {
  return `<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:cSld><p:spTree><p:pic><p:blipFill><a:blip r:embed="${rid}"/></p:blipFill></p:pic></p:spTree></p:cSld></p:sld>`;
}

function slideRels(rid: string, target: string): string {
  return `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/></Relationships>`;
}

describe("WP-D9c ROT-Fix 1: All-images-dropped-Kombinationsfall", () => {
  it("bildreines Deck, finaler Deckel droppt ALLE figures → Import-Entscheidung bleibt JA (Quelle zählt)", async () => {
    // Ein 2,7-MB-Rohbild (unter dem 5-MiB-Vorfilter) auf einer BILDREINEN Folie: Base64 sprengt die
    // finale UTF-8-Grenze → Drop-to-fit entfernt die einzige figure. Ohne Quell-Signal wäre das Deck
    // jetzt „leer" und das Original ginge verloren.
    const files: Record<string, Uint8Array> = {
      "ppt/slides/slide1.xml": enc(pictureOnlySlide("rId2")),
      "ppt/slides/_rels/slide1.xml.rels": enc(slideRels("rId2", "../media/big.png")),
      "ppt/media/big.png": noiseBytes(2_700_000),
    };
    const res = await extractPptxRich(new ArrayBuffer(0), {
      unzip: unzipOf(files),
      imageCaptionPlaceholder: PLACEHOLDER,
      imageRunToken: "tok9c1",
    });
    expect(res.text).toBe("");
    expect(res.imageCount).toBe(1); // die QUELLE hatte ein Bild …
    expect(res.embeddedImages).toBe(0); // … aber der finale Deckel hat es gedroppt
    expect(res.droppedImageBudget).toBe(1);
    expect(res.html).not.toContain("<figure>");
    // ALT (nur Rest nach Drop): Ablehnung. NEU (Quell-Signal): importierbar → fileOriginal wird gesetzt.
    expect(fileImportHasContent(res.text, res.html, res.imageCount > 0)).toBe(true);
    expect(fileImportHasContent(res.text, res.html)).toBe(false); // ohne Signal wäre es der alte Bug
  });

  it("komplett leeres Deck (kein Text, keine Quell-Bilder) bleibt abgelehnt", () => {
    expect(fileImportHasContent("", null, false)).toBe(false);
    expect(fileImportHasContent("", "<h2>Folie 1</h2><p></p>", false)).toBe(false);
  });

  it("Capture-Verdrahtung: Quell-Signal vor dem Gate, Gate vor setFileOriginal, ehrliche Meldungswahl", () => {
    const src = readFileSync(resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"), "utf8");
    // Das Gate bekommt das Quell-Signal …
    expect(src).toContain("fileImportHasContent(text, rich.html, sourceHadImages)");
    // … das in BEIDEN Bild-Pfaden aus der Quelle gesetzt wird (DOCX totalImages, PPTX imageCount).
    expect(src).toContain("sourceHadImages = docx.totalImages > 0");
    expect(src).toContain("sourceHadImages = pptx.imageCount > 0");
    // Original erst NACH dem Gate → All-dropped-Deck erreicht den Original-Anhang.
    expect(src.indexOf("fileImportHasContent(text, rich.html, sourceHadImages)")).toBeLessThan(
      src.indexOf("setFileOriginal({"),
    );
    // Meldungswahl: „übernommen" NUR wenn wirklich Bilder im Beitrag sind, sonst All-dropped-Variante.
    // WP-D11b (GELB c): die Entscheidung ist jetzt PURE in captureFromFile.imagesOnlyNoticeKey
    // extrahiert (Folien fließen über mergeSlideImageInfo in dieselbe Bilanz) — der Pin wandert
    // mit: die Verdrahtung ruft die pure Funktion mit der gemergten Bilanz auf, die `keptImages > 0`-
    // Logik samt imagesAllDropped-Key lebt unverändert in der Lib (dort direkt getestet).
    expect(src).toContain("imagesOnlyNoticeKey(text, imageInfo)");
    expect(src).toContain("mergeSlideImageInfo(imageInfo, slidesTotal, kept)");
    const lib = readFileSync(resolve(process.cwd(), "apps/web/src/lib/captureFromFile.ts"), "utf8");
    expect(lib).toContain("keptImages > 0");
    expect(lib).toContain("CAPTURE_FILE_TEXT.imagesAllDropped");
  });

  it("die All-dropped-Meldung existiert DE/EN/NL und behauptet keinen Uebernahme-Erfolg", () => {
    for (const lng of ["de", "en", "nl"]) {
      const msg = String(i18n.getResource(lng, "translation", "capture.file.imagesAllDropped"));
      expect(msg.length, lng).toBeGreaterThan(0);
    }
    const de = String(i18n.getResource("de", "translation", "capture.file.imagesAllDropped"));
    // Ehrlich: die Bilder sind NICHT im Beitrag; das Original reist beim Speichern als Anhang mit.
    expect(de).toContain("konnten nicht");
    expect(de).toContain("Anhang");
    expect(de).not.toMatch(/^Bilder übernommen/);
  });
});

describe("WP-D9c Evidenz 4: echter Draft-Payload unter dem Server-Ceiling", () => {
  it("Grenzfall-Deck → wholeDocumentDraftPayload (realer Produktpfad) bleibt unter DRAFTS_BODY_LIMIT", async () => {
    // Dasselbe Grenzszenario wie der D9b-PFLICHT-Test: Text + 2,7-MB-Rohbild, finaler Deckel droppt das
    // Bild. Jetzt wird der ECHTE Draft-Payload gebaut (derselbe Weg wie der Ganzdokument-Import in
    // Capture) und als JSON gegen das reale Server-Ceiling (DRAFTS_BODY_LIMIT, 5 MiB) gemessen.
    const sp = (txt: string) =>
      `<p:sp><p:txBody><a:p><a:r><a:t>${txt}</a:t></a:r></a:p></p:txBody></p:sp>`;
    const slide = `<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:r="${URI_R}"><p:cSld><p:spTree>${sp("Wichtiger Fließtext")}<p:pic><p:blipFill><a:blip r:embed="rId2"/></p:blipFill></p:pic></p:spTree></p:cSld></p:sld>`;
    const files: Record<string, Uint8Array> = {
      "ppt/slides/slide1.xml": enc(slide),
      "ppt/slides/_rels/slide1.xml.rels": enc(slideRels("rId2", "../media/big.png")),
      "ppt/media/big.png": noiseBytes(2_700_000),
    };
    const res = await extractPptxRich(new ArrayBuffer(0), {
      unzip: unzipOf(files),
      imageCaptionPlaceholder: PLACEHOLDER,
      imageRunToken: "tok9c2",
    });
    expect(res.droppedImageBudget).toBe(1);

    const payload = wholeDocumentDraftPayload({
      fileName: "grenzfall.pptx",
      text: res.text,
      html: res.html,
      sourceKind: "pptx",
    });
    expect(payload.bodyHtml).toContain("Wichtiger Fließtext");
    // Der reale Draft-Body (JSON, wie ihn POST /api/drafts empfängt) liegt unter dem Route-bodyLimit.
    expect(DRAFTS_BODY_LIMIT).toBe(5 * 1024 * 1024);
    expect(utf8ByteLength(JSON.stringify(payload))).toBeLessThan(DRAFTS_BODY_LIMIT);
  });
});
