// WP-D1/WP-D4 (Pedi/VIP): DOCX-Import strukturerhaltend — ein hochgeladenes Word-Dokument darf nicht
// „zerschossen" werden. Getestet wird der DOM-freie Kern (injizierte Engine, Muster PdfEngine) und die
// ECHTE Pipeline bis zum autoritativen Server-Sanitizer (services/structure): Überschriften, Listen,
// Tabellen, Fett und eingebettete data:image-Bilder überleben; der Quelle-Blockquote trägt den
// ehrlichen, formatabhängigen Import-Hinweis; der Klartext bleibt für die KI-Punkte verfügbar.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  wholeDocumentBodyHtml,
  wholeDocumentDraftPayload,
} from "../../apps/web/src/lib/captureFromFile";
import {
  type DocxEngine,
  applyInlineImageBudget,
  extractDocxRich,
  mapDocxHeadings,
  mapInlineImages,
} from "../../apps/web/src/lib/docx";
import { sanitizeHtml } from "../../services/structure";

const PNG_SRC = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==";

// Deterministische Fake-Engine: liefert, was mammoth.convertToHtml für ein strukturiertes
// Word-Dokument typischerweise produziert (h1, Listen, Tabelle, strong, Inline-Bild als data-URL).
const FIXTURE_HTML = `<h1>Wartungsplan L4</h1><p><strong>Wichtig:</strong> Ventil <em>täglich</em> prüfen.</p><ul><li>Schritt eins</li><li>Schritt zwei</li></ul><table><tr><td>Intervall</td><td>500 h</td></tr></table><img src="${PNG_SRC}" /><h4>Anhang</h4>`;
const FIXTURE_TEXT = "Wartungsplan L4\nWichtig: Ventil täglich prüfen.\nSchritt eins";

const engine: DocxEngine = {
  convertToHtml: async () => ({ value: FIXTURE_HTML, messages: [] }),
  extractRawText: async () => ({ value: FIXTURE_TEXT, messages: [] }),
};

describe("WP-D1: extractDocxRich (DOM-freier Kern, injizierte Engine)", () => {
  it("liefert strukturerhaltendes HTML (h1→h2, h4→h3) UND weiterhin den Klartext", async () => {
    const { html, text } = await extractDocxRich(new ArrayBuffer(4), { engine });
    expect(html).toContain("<h2>Wartungsplan L4</h2>");
    expect(html).not.toContain("<h1");
    expect(html).toContain("<h3>Anhang</h3>");
    expect(html).toContain("<li>Schritt eins</li>");
    expect(html).toContain("<td>Intervall</td>");
    expect(html).toContain("<strong>Wichtig:</strong>");
    expect(html).toContain(PNG_SRC); // eingebettetes Bild als data:image übernommen
    expect(text).toBe(FIXTURE_TEXT); // Klartext für die KI-Punkte-Extraktion bleibt verfügbar
  });

  it("mapImage-Hook skaliert eingebettete Bilder (src wird ersetzt)", async () => {
    const { html } = await extractDocxRich(new ArrayBuffer(4), {
      engine,
      mapImage: async () => "data:image/jpeg;base64,SCALED",
    });
    expect(html).toContain("data:image/jpeg;base64,SCALED");
    expect(html).not.toContain(PNG_SRC);
  });

  it("mapInlineImages fasst NUR data:image-Quellen an", async () => {
    const calls: string[] = [];
    const html = `<img src="/api/objects/x-1/raw"><img src="${PNG_SRC}">`;
    const out = await mapInlineImages(html, async (src) => {
      calls.push(src);
      return "data:image/jpeg;base64,Y";
    });
    expect(calls).toEqual([PNG_SRC]);
    expect(out).toContain('src="/api/objects/x-1/raw"');
    expect(out).toContain("data:image/jpeg;base64,Y");
  });

  it("mapDocxHeadings ist idempotent und fasst h2/h3 nicht an", () => {
    const html = "<h2>a</h2><h3>b</h3>";
    expect(mapDocxHeadings(html)).toBe(html);
  });
});

describe("WP-D1/WP-D4: Ganzdokument-Entwurf mit DOCX-HTML durch den Server-Sanitizer", () => {
  it("Struktur, Tabelle, Fett und data:image überleben das Server-Sanitizing", async () => {
    const { html, text } = await extractDocxRich(new ArrayBuffer(4), { engine });
    const payload = wholeDocumentDraftPayload({
      fileName: "wartungsplan.docx",
      text,
      html,
      sourceKind: "docx",
      locale: "de",
    });
    const persisted = sanitizeHtml(payload.bodyHtml ?? ""); // exakt der Server-Schritt vor dem Speichern
    expect(persisted).toContain("Quelle: wartungsplan.docx, gesamtes Dokument");
    expect(persisted).toContain("<h2>Wartungsplan L4</h2>");
    expect(persisted).toContain("<li>Schritt zwei</li>");
    expect(persisted).toContain("<td>Intervall</td>");
    expect(persisted).toContain("<strong>Wichtig:</strong>");
    expect(persisted).toContain(PNG_SRC);
    // WP-D4: der ehrliche DOCX-Hinweis ist Teil des persistierten Quelle-Blockquotes.
    expect(persisted).toContain("Struktur und Bilder übernommen (Best-Effort)");
  });

  it("PDF-Quelle trägt den ehrlichen Nur-Text-Hinweis; reine Textquellen keinen", () => {
    const pdfDe = wholeDocumentBodyHtml({
      fileName: "anleitung.pdf",
      text: "Inhalt aus dem PDF.",
      sourceKind: "pdf",
      locale: "de",
    });
    expect(pdfDe).toContain("Best-Effort-Textimport — Layout und Bilder wurden nicht übernommen.");
    const pdfEn = wholeDocumentBodyHtml({
      fileName: "manual.pdf",
      text: "PDF content.",
      sourceKind: "pdf",
      locale: "en",
    });
    expect(pdfEn).toContain("layout and images were not carried over");
    const plain = wholeDocumentBodyHtml({
      fileName: "notiz.md",
      text: "# Titel\n\nText.",
      sourceKind: "text",
      locale: "de",
    });
    expect(plain).not.toContain("Best-Effort");
    expect(plain).toContain("<h2>Titel</h2>"); // Markdown-Heuristik für txt/md unverändert
  });
});

describe("WP-D4: Scan-PDF-Meldung ohne falsche OCR-Hoffnung (DE/EN/NL)", () => {
  it("docEmpty und file.emptyPdf verweisen NICHT mehr auf OCR", () => {
    const keys = ["capture.docEmpty", "capture.file.emptyPdf"] as const;
    const langs = [
      { lang: "de", expect: /wird noch nicht unterstützt/ },
      { lang: "en", expect: /not supported yet/ },
      { lang: "nl", expect: /nog niet ondersteund/ },
    ] as const;
    for (const key of keys) {
      for (const { lang, expect: pattern } of langs) {
        const text = String(i18n.getResource(lang, "translation", key));
        expect(text, `${lang}:${key}`).toMatch(pattern);
        expect(text, `${lang}:${key}`).not.toMatch(/OCR/i);
      }
    }
  });

  it("die formatabhängige Import-Quittung existiert in DE/EN/NL", () => {
    for (const lang of ["de", "en", "nl"] as const) {
      expect(String(i18n.getResource(lang, "translation", "capture.file.importNote.docx"))).toMatch(
        /best.effort/i,
      );
      expect(String(i18n.getResource(lang, "translation", "capture.file.importNote.pdf"))).toMatch(
        /best.effort/i,
      );
    }
  });
});

// WP-D1b (Fix c): NL-Quittung — bisher fiel die persistierte DOCX/PDF-Verlust-Notiz für „nl" auf
// Deutsch zurück. Jetzt erscheint korrekter niederländischer Text (nicht Deutsch).
describe("WP-D1b: Quelle-Blockquote in NL (kein Deutsch-Fallback)", () => {
  it("wholeDocumentBodyHtml(locale nl) → niederländisches Quelle-Label + DOCX-Hinweis", () => {
    const html = wholeDocumentBodyHtml({
      fileName: "handleiding.docx",
      text: "Inhoud.",
      sourceKind: "docx",
      locale: "nl",
    });
    expect(html).toContain("Bron: handleiding.docx, volledig document");
    expect(html).toContain("Structuur en afbeeldingen overgenomen (best effort)");
    expect(html).not.toContain("Quelle:");
    expect(html).not.toContain("gesamtes Dokument");
  });

  it("wholeDocumentDraftPayload(locale nl, pdf) → niederländischer PDF-Hinweis", () => {
    const payload = wholeDocumentDraftPayload({
      fileName: "rapport.pdf",
      text: "Tekst.",
      sourceKind: "pdf",
      locale: "nl",
    });
    expect(payload.bodyHtml).toContain("Best-effort tekstimport");
    expect(payload.bodyHtml).not.toContain("Best-Effort-Textimport");
  });
});

// WP-D1b (Fix d): hartes Gesamt-Byte-Budget für Inline-Bilder. Passt ein Bild nicht mehr, wird das
// GANZE <img>-Element weggelassen (Original bleibt via WP-D2 als Anhang) — kein 413.
describe("WP-D1b: applyInlineImageBudget", () => {
  const imgTag = (payload: string): string => `<img src="data:image/jpeg;base64,${payload}">`;
  // encode gibt die src unverändert zurück (die Bytes stecken bereits im Fixture) → reiner Budget-Test.
  const identity = async (src: string): Promise<string> => src;

  it("kein Bild → unverändert, dropped 0", async () => {
    const html = "<p>nur Text</p>";
    expect(await applyInlineImageBudget(html, identity, 1000)).toEqual({ html, dropped: 0 });
  });

  it("über Budget → spätere Bilder werden weggelassen, Zähler stimmt, Rest bleibt", async () => {
    const a = imgTag("A".repeat(300));
    const b = imgTag("B".repeat(300));
    const c = imgTag("C".repeat(300));
    const html = `<p>${a}</p><p>${b}</p><p>${c}</p>`;
    const res = await applyInlineImageBudget(html, identity, 700);
    expect(res.dropped).toBe(1);
    expect(res.html).toContain("A".repeat(300));
    expect(res.html).toContain("B".repeat(300));
    expect(res.html).not.toContain("C".repeat(300));
    expect(res.html).toContain("<p></p>"); // nur das <img> fiel, der umgebende <p> bleibt
  });

  it("ein Bild knapp UNTER Budget → behalten; knapp DARÜBER → weggelassen", async () => {
    const one = imgTag("X".repeat(100));
    // Gemessen wird die src-Länge (data:-URL), nicht die volle Tag-Länge.
    const srcLen = "data:image/jpeg;base64,".length + 100;
    const under = await applyInlineImageBudget(`<div>${one}</div>`, identity, srcLen);
    expect(under.dropped).toBe(0);
    expect(under.html).toContain("X".repeat(100));
    const over = await applyInlineImageBudget(`<div>${one}</div>`, identity, srcLen - 1);
    expect(over.dropped).toBe(1);
    expect(over.html).toBe("<div></div>");
  });

  it("Summe der behaltenen Bild-Bytes bleibt ≤ Budget (Puffer zum Draft-Limit)", async () => {
    const budget = 1000;
    const many = Array.from({ length: 20 }, () => imgTag("Z".repeat(400))).join("");
    const res = await applyInlineImageBudget(`<body>${many}</body>`, identity, budget);
    const kept = res.html.match(/Z+/g) ?? [];
    const keptBytes = kept.reduce((n, s) => n + s.length, 0);
    expect(keptBytes).toBeLessThanOrEqual(budget);
    expect(res.dropped).toBeGreaterThan(0);
  });
});

// WP-D1b: extractDocxRich mit Budget meldet droppedImages und lässt überzählige Bilder weg.
describe("WP-D1b: extractDocxRich mit Byte-Budget", () => {
  it("überzählige Bilder werden weggelassen; droppedImages zählt sie", async () => {
    const big = (id: string): string => `<img src="data:image/jpeg;base64,${id.repeat(400)}">`;
    const engine: DocxEngine = {
      convertToHtml: async () => ({ value: `${big("A")}${big("B")}${big("C")}`, messages: [] }),
      extractRawText: async () => ({ value: "text", messages: [] }),
    };
    const res = await extractDocxRich(new ArrayBuffer(4), {
      engine,
      mapImage: async (src) => src,
      imageBudgetBytes: 900,
    });
    expect(res.droppedImages).toBe(1);
    expect(res.text).toBe("text");
  });

  it("ohne Budget bleibt das bestehende Verhalten (droppedImages 0)", async () => {
    const engine: DocxEngine = {
      convertToHtml: async () => ({
        value: '<img src="data:image/png;base64,AAAA">',
        messages: [],
      }),
      extractRawText: async () => ({ value: "t", messages: [] }),
    };
    const res = await extractDocxRich(new ArrayBuffer(4), { engine, mapImage: async (s) => s });
    expect(res.droppedImages).toBe(0);
    expect(res.html).toContain("data:image/png;base64,AAAA");
  });
});
