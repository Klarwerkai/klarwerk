// WP-D5: DOM-freier PowerPoint-Kern (apps/web/src/lib/pptx.ts) mit kleinen XML-Fixtures gepinnt.
// Schwerpunkte: Titel→h2, Bullets→Liste, mehrere Folien in Reihenfolge (presentation.xml + rels sowie
// numerischer Fallback), leere/rein-grafische Folie, Verlust-/Bild-Bilanz, Folien-Cap (truncated),
// htmlOverflow bei zu großem Folien-HTML. Reine Funktions-/Fixture-Tests, kein DOM, kein echtes fflate.
import { describe, expect, it } from "vitest";
import { MAX_INLINE_BODY_HTML_BYTES } from "../../apps/web/src/lib/docx";
import {
  MAX_PPTX_SLIDES,
  type PptxUnzip,
  extractPptxRich,
  isPptxDocumentLike,
  resolveSlideOrder,
  slideToHtml,
} from "../../apps/web/src/lib/pptx";

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function enc(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

// Minimaler, aber realistischer Folien-XML-Baustein (Titel-Platzhalter + Textrahmen mit Bullets).
function slideXml(opts: {
  title?: string;
  bullets?: string[];
  paragraphs?: string[];
  picture?: boolean;
}): string {
  const titleShape = opts.title
    ? `<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${opts.title}</a:t></a:r></a:p></p:txBody></p:sp>`
    : "";
  const bulletParas = (opts.bullets ?? [])
    .map((b) => `<a:p><a:pPr><a:buChar char="•"/></a:pPr><a:r><a:t>${b}</a:t></a:r></a:p>`)
    .join("");
  const plainParas = (opts.paragraphs ?? [])
    .map((p) => `<a:p><a:r><a:t>${p}</a:t></a:r></a:p>`)
    .join("");
  const bodyShape =
    bulletParas || plainParas
      ? `<p:sp><p:nvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:txBody>${bulletParas}${plainParas}</p:txBody></p:sp>`
      : "";
  const pic = opts.picture
    ? `<p:pic><p:blipFill><a:blip r:embed="rId9"/></p:blipFill></p:pic>`
    : "";
  return `<?xml version="1.0"?><p:sld xmlns:p="p" xmlns:a="a" xmlns:r="r"><p:cSld><p:spTree>${titleShape}${bodyShape}${pic}</p:spTree></p:cSld></p:sld>`;
}

describe("WP-D5: Erkennung", () => {
  it("erkennt .pptx über Endung und MIME, sonst nicht", () => {
    expect(isPptxDocumentLike({ name: "Deck.pptx" })).toBe(true);
    expect(isPptxDocumentLike({ name: "x", type: PPTX_MIME })).toBe(true);
    expect(isPptxDocumentLike({ name: "text.docx" })).toBe(false);
    expect(isPptxDocumentLike({ name: "report.pdf" })).toBe(false);
  });
});

describe("WP-D5: slideToHtml (Titel→h2, Bullets→Liste, Absätze)", () => {
  it("Titel wird h2, Bullets werden eine Liste, Fließtext ein Absatz", () => {
    const { html, text } = slideToHtml(
      slideXml({
        title: "Quartalsziele",
        bullets: ["Umsatz steigern", "Kosten senken"],
        paragraphs: ["Abschlussbemerkung"],
      }),
      { slideNumber: 1, slideLabel: "Folie" },
    );
    expect(html).toBe(
      "<h2>Quartalsziele</h2><ul><li>Umsatz steigern</li><li>Kosten senken</li></ul><p>Abschlussbemerkung</p>",
    );
    expect(text).toBe("Quartalsziele\n- Umsatz steigern\n- Kosten senken\nAbschlussbemerkung");
  });

  it("ohne Titel-Platzhalter trennt der Folien-Label-Header sichtbar (nur im HTML, nicht im Klartext)", () => {
    const { html, text } = slideToHtml(slideXml({ paragraphs: ["Nur Text"] }), {
      slideNumber: 4,
      slideLabel: "Folie",
    });
    expect(html).toBe("<h2>Folie 4</h2><p>Nur Text</p>");
    // Die Struktur-Überschrift „Folie 4" ist KEIN Wissen — der Klartext trägt nur echten Inhalt.
    expect(text).toBe("Nur Text");
  });

  it("HTML-Sonderzeichen im Folientext werden escaped", () => {
    const { html } = slideToHtml(slideXml({ title: "A & B < C" }), {
      slideNumber: 1,
      slideLabel: "Folie",
    });
    expect(html).toContain("<h2>A &amp; B &lt; C</h2>");
  });

  it("rein grafische Folie: h2-Trenner im HTML, aber leerer Klartext", () => {
    const { html, text } = slideToHtml(slideXml({ picture: true }), {
      slideNumber: 2,
      slideLabel: "Folie",
    });
    expect(html).toBe("<h2>Folie 2</h2>");
    expect(text).toBe("");
  });
});

describe("WP-D5: resolveSlideOrder", () => {
  it("nutzt presentation.xml + rels für die Reihenfolge (nicht die Datei-Nummer)", () => {
    const files: Record<string, Uint8Array> = {
      "ppt/presentation.xml": enc(
        '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/></p:sldIdLst></p:presentation>',
      ),
      "ppt/_rels/presentation.xml.rels": enc(
        '<Relationships xmlns="rel"><Relationship Id="rId1" Type="t" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="t" Target="slides/slide2.xml"/></Relationships>',
      ),
      "ppt/slides/slide1.xml": enc(slideXml({ title: "Erste" })),
      "ppt/slides/slide2.xml": enc(slideXml({ title: "Zweite" })),
    };
    // rId2 (slide2) steht zuerst in der sldIdLst → slide2 vor slide1.
    expect(resolveSlideOrder(files)).toEqual(["ppt/slides/slide2.xml", "ppt/slides/slide1.xml"]);
  });

  it("fällt ohne presentation.xml auf numerische Sortierung zurück", () => {
    const files: Record<string, Uint8Array> = {
      "ppt/slides/slide10.xml": enc(slideXml({ title: "Zehn" })),
      "ppt/slides/slide2.xml": enc(slideXml({ title: "Zwei" })),
      "ppt/slides/slide1.xml": enc(slideXml({ title: "Eins" })),
    };
    expect(resolveSlideOrder(files)).toEqual([
      "ppt/slides/slide1.xml",
      "ppt/slides/slide2.xml",
      "ppt/slides/slide10.xml",
    ]);
  });
});

describe("WP-D5: extractPptxRich (Orchestrierung, Bilanz, Cap)", () => {
  function unzipOf(files: Record<string, Uint8Array>): PptxUnzip {
    return () => files;
  }

  it("mehrere Folien in Reihenfolge, Bilder gezählt (nicht inline), Text zusammengeführt", async () => {
    const files: Record<string, Uint8Array> = {
      "ppt/presentation.xml": enc(
        '<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst><p:sldId id="1" r:id="rId1"/><p:sldId id="2" r:id="rId2"/></p:sldIdLst></p:presentation>',
      ),
      "ppt/_rels/presentation.xml.rels": enc(
        '<Relationships><Relationship Id="rId1" Type="t" Target="slides/slide1.xml"/><Relationship Id="rId2" Type="t" Target="slides/slide2.xml"/></Relationships>',
      ),
      "ppt/slides/slide1.xml": enc(slideXml({ title: "Agenda", bullets: ["Punkt A"] })),
      "ppt/slides/slide2.xml": enc(slideXml({ title: "Details", picture: true })),
    };
    const res = await extractPptxRich(new ArrayBuffer(0), { unzip: unzipOf(files) });
    expect(res.slideCount).toBe(2);
    expect(res.truncated).toBe(false);
    expect(res.imageCount).toBe(1); // ein <a:blip> — gezählt, aber NICHT inline übernommen
    expect(res.html.indexOf("Agenda")).toBeLessThan(res.html.indexOf("Details"));
    expect(res.html).toContain("<ul><li>Punkt A</li></ul>");
    expect(res.html).not.toContain("<img"); // keine inline-Bilder in diesem Slice
    expect(res.text).toContain("Agenda");
    expect(res.text).toContain("Punkt A");
    expect(res.htmlOverflow).toBe(false);
  });

  it("reines Grafik-Deck: kein Klartext (emptyPptx-Fall), Bilder ehrlich gezählt", async () => {
    const files: Record<string, Uint8Array> = {
      "ppt/slides/slide1.xml": enc(slideXml({ picture: true })),
    };
    const res = await extractPptxRich(new ArrayBuffer(0), { unzip: unzipOf(files) });
    expect(res.text).toBe("");
    expect(res.imageCount).toBe(1);
    expect(res.html).toContain("<h2>Folie 1</h2>");
  });

  it("Folien-Cap: über MAX_PPTX_SLIDES wird truncated ehrlich gemeldet", async () => {
    const files: Record<string, Uint8Array> = {};
    for (let i = 1; i <= 3; i += 1) {
      files[`ppt/slides/slide${i}.xml`] = enc(slideXml({ title: `T${i}` }));
    }
    const res = await extractPptxRich(new ArrayBuffer(0), {
      unzip: unzipOf(files),
      maxSlides: 2,
    });
    expect(res.slideCount).toBe(2);
    expect(res.truncated).toBe(true);
    expect(res.html).toContain("T1");
    expect(res.html).toContain("T2");
    expect(res.html).not.toContain("T3");
    // Der Default-Cap ist großzügig (Decks sind klein).
    expect(MAX_PPTX_SLIDES).toBeGreaterThanOrEqual(200);
  });

  it("htmlOverflow: übersteigt das Folien-HTML das Byte-Budget, wird es ehrlich gemeldet", async () => {
    const huge = "x".repeat(MAX_INLINE_BODY_HTML_BYTES + 1000);
    const files: Record<string, Uint8Array> = {
      "ppt/slides/slide1.xml": enc(slideXml({ paragraphs: [huge] })),
    };
    const res = await extractPptxRich(new ArrayBuffer(0), { unzip: unzipOf(files) });
    expect(res.htmlOverflow).toBe(true);
  });
});
