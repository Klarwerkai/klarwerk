import { describe, expect, it } from "vitest";
// WP-D5: DOM-freier PowerPoint-Kern (apps/web/src/lib/pptx.ts) mit kleinen XML-Fixtures gepinnt.
// Schwerpunkte: Titel→h2, Bullets→Liste, mehrere Folien in Reihenfolge (presentation.xml + rels sowie
// numerischer Fallback), leere/rein-grafische Folie, Verlust-/Bild-Bilanz, Folien-Cap (truncated),
// htmlOverflow bei zu großem Folien-HTML. Reine Funktions-/Fixture-Tests, kein DOM. WP-D5c ergänzt
// namespace-aware Gegenbeispiele und Budget-Tests mit ECHTEM fflate (zipSync-Fixtures).
import { unzipSync, zipSync } from "../../apps/web/node_modules/fflate";
import { MAX_INLINE_BODY_HTML_BYTES } from "../../apps/web/src/lib/docx";
import {
  MAX_PPTX_SLIDES,
  PptxTooLargeError,
  type PptxUnzip,
  assertArchiveWithinBudget,
  budgetedPptxUnzip,
  createPptxUnzipBudget,
  extractPptxRich,
  isPptxDocumentLike,
  resolveSlideOrder,
  slideToHtml,
} from "../../apps/web/src/lib/pptx";

// Echte OOXML-Namespace-URIs — für die namespace-aware Tests (alternative Präfixe).
const URI_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const URI_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
const URI_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

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

// WP-D5b (bens ROT-Fix 1): Namespace-/Attribut-Robustheit — Gegenbeispiele gepinnt.
describe("WP-D5b: namespace-aware Parsing (alternative Präfixe)", () => {
  it("löst das drawingml-Präfix aus xmlns auf — funktioniert mit x: statt a:", () => {
    const slide = `<p:sld xmlns:p="${URI_P}" xmlns:x="${URI_A}"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><x:p><x:r><x:t>Titel X</x:t></x:r></x:p></p:txBody></p:sp><p:sp><p:txBody><x:p><x:pPr><x:buChar char="•"/></x:pPr><x:r><x:t>Punkt X</x:t></x:r></x:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
    const { html } = slideToHtml(slide, { slideNumber: 1, slideLabel: "Folie" });
    expect(html).toBe("<h2>Titel X</h2><ul><li>Punkt X</li></ul>");
  });

  it("löst auch das presentationml-Präfix auf — Titel-Platzhalter unter q: erkannt", () => {
    const slide = `<q:sld xmlns:q="${URI_P}" xmlns:a="${URI_A}"><q:cSld><q:spTree><q:sp><q:nvSpPr><q:nvPr><q:ph type="ctrTitle"/></q:nvPr></q:nvSpPr><q:txBody><a:p><a:r><a:t>Zentraltitel</a:t></a:r></a:p></q:txBody></q:sp></q:spTree></q:cSld></q:sld>`;
    const { html } = slideToHtml(slide, { slideNumber: 3, slideLabel: "Folie" });
    expect(html).toBe("<h2>Zentraltitel</h2>");
  });
});

describe("WP-D5b: resolveSlideOrder — Relationship-Robustheit + kein stiller Folienverlust", () => {
  it("Relationship: Target VOR Id, einfache Quotes, präfigiertes Element", () => {
    const files: Record<string, Uint8Array> = {
      "ppt/presentation.xml": enc(
        `<p:presentation xmlns:p="${URI_P}" xmlns:r="${URI_R}"><p:sldIdLst><p:sldId id="256" r:id='rId1'/></p:sldIdLst></p:presentation>`,
      ),
      "ppt/_rels/presentation.xml.rels": enc(
        `<pr:Relationships xmlns:pr="rel"><pr:Relationship Target='slides/slide1.xml' Id='rId1'/></pr:Relationships>`,
      ),
      "ppt/slides/slide1.xml": enc(slideXml({ title: "Eins" })),
    };
    expect(resolveSlideOrder(files)).toEqual(["ppt/slides/slide1.xml"]);
  });

  it("partielle Auflösung (10 Folien, 1 auflösbar) → ALLE 10 in deterministischer Reihenfolge", () => {
    const files: Record<string, Uint8Array> = {
      // presentation referenziert nur rId5; rels löst nur rId5 → slide7 auf.
      "ppt/presentation.xml": enc(
        `<p:presentation xmlns:p="${URI_P}" xmlns:r="${URI_R}"><p:sldIdLst><p:sldId id="300" r:id="rId5"/></p:sldIdLst></p:presentation>`,
      ),
      "ppt/_rels/presentation.xml.rels": enc(
        `<Relationships><Relationship Id="rId5" Type="t" Target="slides/slide7.xml"/></Relationships>`,
      ),
    };
    for (let i = 1; i <= 10; i += 1) {
      files[`ppt/slides/slide${i}.xml`] = enc(slideXml({ title: `T${i}` }));
    }
    const order = resolveSlideOrder(files);
    // Keine Folie geht verloren: alle 10 sind dabei.
    expect(order).toHaveLength(10);
    // Die aufgelöste Folie führt; der Rest folgt deterministisch numerisch (ohne slide7).
    expect(order[0]).toBe("ppt/slides/slide7.xml");
    const rest = order.slice(1);
    const expectedRest = [1, 2, 3, 4, 5, 6, 8, 9, 10].map((n) => `ppt/slides/slide${n}.xml`);
    expect(rest).toEqual(expectedRest);
  });

  it("nicht auflösbare rels (0 Treffer) → vollständige numerische Reihenfolge, nichts verschwindet", () => {
    const files: Record<string, Uint8Array> = {
      "ppt/presentation.xml": enc(
        `<p:presentation xmlns:p="${URI_P}" xmlns:r="${URI_R}"><p:sldIdLst><p:sldId id="1" r:id="rIdX"/></p:sldIdLst></p:presentation>`,
      ),
      "ppt/_rels/presentation.xml.rels": enc(
        `<Relationships><Relationship Id="rId1" Type="t" Target="slides/slide1.xml"/></Relationships>`,
      ),
      "ppt/slides/slide2.xml": enc(slideXml({ title: "Zwei" })),
      "ppt/slides/slide1.xml": enc(slideXml({ title: "Eins" })),
    };
    expect(resolveSlideOrder(files)).toEqual(["ppt/slides/slide1.xml", "ppt/slides/slide2.xml"]);
  });
});

describe("WP-D5b: Struktur-Lücken (br, ol, Tabellen)", () => {
  function bodySlide(inner: string): string {
    return `<p:sld xmlns:p="${URI_P}" xmlns:a="${URI_A}"><p:cSld><p:spTree>${inner}</p:spTree></p:cSld></p:sld>`;
  }

  it("<a:br/> wird zum Leerzeichen (kein HalloWelt-Verschmelzen)", () => {
    const slide = bodySlide(
      "<p:sp><p:txBody><a:p><a:r><a:t>Hallo</a:t></a:r><a:br/><a:r><a:t>Welt</a:t></a:r></a:p></p:txBody></p:sp>",
    );
    const { html, text } = slideToHtml(slide, { slideNumber: 1, slideLabel: "Folie" });
    expect(html).toContain("<p>Hallo Welt</p>");
    expect(html).not.toContain("HalloWelt");
    expect(text).toContain("Hallo Welt");
  });

  it("buAutoNum wird eine nummerierte Liste <ol> (nicht <ul>)", () => {
    const slide = bodySlide(
      `<p:sp><p:txBody><a:p><a:pPr><a:buAutoNum type="arabicPeriod"/></a:pPr><a:r><a:t>Erstens</a:t></a:r></a:p><a:p><a:pPr><a:buAutoNum type="arabicPeriod"/></a:pPr><a:r><a:t>Zweitens</a:t></a:r></a:p></p:txBody></p:sp>`,
    );
    const { html } = slideToHtml(slide, { slideNumber: 1, slideLabel: "Folie" });
    expect(html).toBe("<h2>Folie 1</h2><ol><li>Erstens</li><li>Zweitens</li></ol>");
  });

  it("Tabelle (p:graphicFrame → a:tbl) wird Best-Effort eine <table>; Reihenfolge bleibt", () => {
    const table =
      "<p:graphicFrame><a:graphic><a:graphicData><a:tbl><a:tr><a:tc><a:txBody><a:p><a:r><a:t>Zelle A</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>Zelle B</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>";
    const para =
      "<p:sp><p:txBody><a:p><a:r><a:t>Vor der Tabelle</a:t></a:r></a:p></p:txBody></p:sp>";
    const slide = bodySlide(`${para}${table}`);
    const { html, text, tableCount } = slideToHtml(slide, { slideNumber: 1, slideLabel: "Folie" });
    expect(tableCount).toBe(1);
    expect(html).toBe(
      "<h2>Folie 1</h2><p>Vor der Tabelle</p><table><tr><td>Zelle A</td><td>Zelle B</td></tr></table>",
    );
    expect(text).toContain("Zelle A | Zelle B");
  });
});

describe("WP-D5b: Archiv-/Dekompressionsbudget (kein UI-Freeze)", () => {
  function bigBytes(n: number): Uint8Array {
    return new Uint8Array(n);
  }

  it("assertArchiveWithinBudget wirft bei zu vielen Einträgen", () => {
    const files: Record<string, Uint8Array> = {};
    for (let i = 0; i < 6; i += 1) {
      files[`ppt/slides/slide${i}.xml`] = enc("<x/>");
    }
    expect(() => assertArchiveWithinBudget(files, { maxEntries: 5 })).toThrow(PptxTooLargeError);
  });

  it("assertArchiveWithinBudget wirft bei zu vielen dekomprimierten Bytes", () => {
    const files: Record<string, Uint8Array> = {
      "ppt/slides/slide1.xml": bigBytes(1000),
    };
    expect(() => assertArchiveWithinBudget(files, { maxTotalBytes: 500 })).toThrow(
      PptxTooLargeError,
    );
  });

  it("extractPptxRich bricht bei gesprengtem Budget ehrlich ab (kein Durchlauf)", async () => {
    const files: Record<string, Uint8Array> = {
      "ppt/slides/slide1.xml": bigBytes(10_000),
    };
    await expect(
      extractPptxRich(new ArrayBuffer(0), {
        unzip: () => files,
        maxTotalBytes: 1000,
      }),
    ).rejects.toBeInstanceOf(PptxTooLargeError);
  });
});

// WP-D5c (bens ROT-Fix 1): mehrfach-/scope-aware Namespace-Auflösung — Gegenbeispiele gepinnt.
describe("WP-D5c: Namespace mehrfach-/scope-aware", () => {
  function slide(inner: string, attrs: string): string {
    return `<p:sld ${attrs}><p:cSld><p:spTree>${inner}</p:spTree></p:cSld></p:sld>`;
  }

  it("(a) zwei Präfixe derselben URI — Text NUR im zweiten (x:t) geht nicht verloren", () => {
    const xml = slide(
      "<p:sp><p:txBody><x:p><x:r><x:t>Nur in x</x:t></x:r></x:p></p:txBody></p:sp>",
      `xmlns:p="${URI_P}" xmlns:a="${URI_A}" xmlns:x="${URI_A}"`,
    );
    const { html } = slideToHtml(xml, { slideNumber: 1, slideLabel: "Folie" });
    expect(html).toBe("<h2>Folie 1</h2><p>Nur in x</p>");
  });

  it("(b/e) Default-DrawingML mit p:-PresentationML — praefixloses <p> kollidiert NICHT mit <p:sp>", () => {
    const xml = slide(
      "<p:sp><p:txBody><p><r><t>Default DrawingML</t></r></p></p:txBody></p:sp>",
      `xmlns:p="${URI_P}" xmlns="${URI_A}"`,
    );
    const { html } = slideToHtml(xml, { slideNumber: 1, slideLabel: "Folie" });
    // Der praefixlose <p>-Absatz wird als Absatz erkannt; <p:sp> bleibt die Form (kein Doppel-Match).
    expect(html).toBe("<h2>Folie 1</h2><p>Default DrawingML</p>");
  });

  it("(c) lokales Rebinding im slide-XML (z:t innerhalb einer Form)", () => {
    const xml = slide(
      `<p:sp><p:txBody xmlns:z="${URI_A}"><z:p><z:r><z:t>Lokal z</z:t></z:r></z:p></p:txBody></p:sp>`,
      `xmlns:p="${URI_P}" xmlns:a="${URI_A}"`,
    );
    const { html } = slideToHtml(xml, { slideNumber: 1, slideLabel: "Folie" });
    expect(html).toBe("<h2>Folie 1</h2><p>Lokal z</p>");
  });

  it("(d) mehrere Relationship-Präfixe — Reihenfolge der sldIdLst bleibt erhalten", () => {
    const files: Record<string, Uint8Array> = {
      "ppt/presentation.xml": enc(
        `<p:presentation xmlns:p="${URI_P}" xmlns:r="${URI_R}" xmlns:r2="${URI_R}"><p:sldIdLst><p:sldId id="1" r:id="rIdA"/><p:sldId id="2" r2:id="rIdB"/></p:sldIdLst></p:presentation>`,
      ),
      // rIdA → slide2, rIdB → slide1: die Präsentationsreihenfolge (A vor B) muss gewinnen.
      "ppt/_rels/presentation.xml.rels": enc(
        '<Relationships><Relationship Id="rIdA" Type="t" Target="slides/slide2.xml"/><Relationship Id="rIdB" Type="t" Target="slides/slide1.xml"/></Relationships>',
      ),
      "ppt/slides/slide1.xml": enc("<x/>"),
      "ppt/slides/slide2.xml": enc("<x/>"),
    };
    expect(resolveSlideOrder(files)).toEqual(["ppt/slides/slide2.xml", "ppt/slides/slide1.xml"]);
  });
});

// WP-D5c (bens ROT-Fix 2): Budget VOR der Dekompression — PURE Gate-Logik + ECHTES fflate.
describe("WP-D5c: Budget-Gate (pure, VOR Dekompression)", () => {
  const goodSlide = { name: "ppt/slides/slide1.xml", compressedSize: 100, originalSize: 300 };

  it("zählt jeden gesehenen Eintrag gegen den Archiv-Iterations-Cap", () => {
    const gate = createPptxUnzipBudget({ maxArchiveEntries: 3 });
    expect(gate.accept({ name: "a", compressedSize: 1, originalSize: 1 })).toBe(false);
    expect(gate.accept({ name: "b", compressedSize: 1, originalSize: 1 })).toBe(false);
    expect(gate.accept({ name: "c", compressedSize: 1, originalSize: 1 })).toBe(false);
    expect(() => gate.accept({ name: "d", compressedSize: 1, originalSize: 1 })).toThrow(
      PptxTooLargeError,
    );
  });

  it("FAIL-CLOSED bei fehlenden/negativen Größen eines benötigten Eintrags", () => {
    const g1 = createPptxUnzipBudget();
    expect(() =>
      g1.accept({ name: "ppt/slides/slide1.xml", compressedSize: 10, originalSize: Number.NaN }),
    ).toThrow(PptxTooLargeError);
    const g2 = createPptxUnzipBudget();
    expect(() =>
      g2.accept({ name: "ppt/slides/slide1.xml", compressedSize: -1, originalSize: 10 }),
    ).toThrow(PptxTooLargeError);
  });

  it("Ratio-Prüfung für JEDEN nichtleeren Eintrag (auch klein < 1 MB)", () => {
    const gate = createPptxUnzipBudget({ maxEntryExpansionRatio: 100 });
    // 200-fach expandierend, aber winzig — muss trotzdem fallen.
    expect(() =>
      gate.accept({ name: "ppt/slides/slide1.xml", compressedSize: 10, originalSize: 2000 }),
    ).toThrow(PptxTooLargeError);
  });

  it("kumuliertes Vorab-Byte-Budget aus ZIP-Metadaten", () => {
    const gate = createPptxUnzipBudget({ maxTotalDecompressedBytes: 500 });
    expect(() =>
      gate.accept({ name: "ppt/slides/slide1.xml", compressedSize: 100, originalSize: 2000 }),
    ).toThrow(PptxTooLargeError);
  });

  it("harter Cap auf akzeptierte slideN.xml-Einträge (bounded Dekompression)", () => {
    const gate = createPptxUnzipBudget({ maxSlideEntries: 2 });
    expect(gate.accept({ ...goodSlide, name: "ppt/slides/slide1.xml" })).toBe(true);
    expect(gate.accept({ ...goodSlide, name: "ppt/slides/slide2.xml" })).toBe(true);
    expect(() => gate.accept({ ...goodSlide, name: "ppt/slides/slide3.xml" })).toThrow(
      PptxTooLargeError,
    );
  });

  it("akzeptiert nur benötigte Einträge; Medien/Layouts werden gar nicht angenommen", () => {
    const gate = createPptxUnzipBudget();
    expect(gate.accept({ name: "ppt/media/image1.png", compressedSize: 5, originalSize: 9 })).toBe(
      false,
    );
    expect(
      gate.accept({
        name: "ppt/slideLayouts/slideLayout1.xml",
        compressedSize: 5,
        originalSize: 9,
      }),
    ).toBe(false);
    expect(gate.accept({ name: "ppt/presentation.xml", compressedSize: 5, originalSize: 9 })).toBe(
      true,
    );
  });
});

describe("WP-D5c: budgetedPptxUnzip mit ECHTEM fflate (zipSync-Fixtures)", () => {
  const smallSlide = enc("<p:sld/>");

  it("entpackt NUR die benötigten Einträge (Medien werden übersprungen)", () => {
    const zip = zipSync({
      "ppt/presentation.xml": enc("<p:presentation/>"),
      "ppt/_rels/presentation.xml.rels": enc("<Relationships/>"),
      "ppt/slides/slide1.xml": smallSlide,
      "ppt/media/image1.png": new Uint8Array(2048),
      "docProps/app.xml": enc("<Properties/>"),
    });
    const files = budgetedPptxUnzip({ unzipSync })(zip);
    expect(Object.keys(files).sort()).toEqual([
      "ppt/_rels/presentation.xml.rels",
      "ppt/presentation.xml",
      "ppt/slides/slide1.xml",
    ]);
    expect(files["ppt/media/image1.png"]).toBeUndefined();
  });

  it("hochkomprimierter Eintrag über Ratio-Cap ⇒ PptxTooLargeError (VOR Dekompression)", () => {
    // stark wiederholter Inhalt komprimiert extrem → Ratio > Cap.
    const bomb = enc("A".repeat(2_000_000));
    const zip = zipSync({ "ppt/slides/slide1.xml": bomb });
    const unzip = budgetedPptxUnzip({ unzipSync }, { maxEntryExpansionRatio: 50 });
    expect(() => unzip(zip)).toThrow(PptxTooLargeError);
  });

  it("zu viele Einträge über den Archiv-Cap ⇒ PptxTooLargeError", () => {
    const entries: Record<string, Uint8Array> = {};
    for (let i = 0; i < 12; i += 1) {
      entries[`docProps/file${i}.xml`] = enc("<x/>");
    }
    const zip = zipSync(entries);
    const unzip = budgetedPptxUnzip({ unzipSync }, { maxArchiveEntries: 5 });
    expect(() => unzip(zip)).toThrow(PptxTooLargeError);
  });

  it("Summe der dekomprimierten Bytes über dem Gesamtbudget ⇒ PptxTooLargeError", () => {
    const zip = zipSync({
      "ppt/slides/slide1.xml": enc("B".repeat(4000)),
      "ppt/slides/slide2.xml": enc("C".repeat(4000)),
    });
    const unzip = budgetedPptxUnzip({ unzipSync }, { maxTotalDecompressedBytes: 5000 });
    expect(() => unzip(zip)).toThrow(PptxTooLargeError);
  });
});
