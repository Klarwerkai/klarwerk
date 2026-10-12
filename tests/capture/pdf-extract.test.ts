import { describe, expect, it } from "vitest";
import { type PdfEngine, extractPdfDocument } from "../../apps/web/src/lib/pdf";

// R-1349 (Aufnahme gesamt-aufruferwaechter): gemessen an `extractPdfDocument`, dem Weg, den das
// Einlesen nimmt — die Text-Hülle `extractPdfText` hatte keinen Aufrufer mehr und ist entfernt.
const text = async (buffer: ArrayBuffer, engine: PdfEngine): Promise<string> =>
  (await extractPdfDocument(buffer, engine)).text;

// Stub-Engine: simuliert pdfjs ohne echte Bibliothek (DI).
function stubEngine(pages: string[][]): PdfEngine {
  return {
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: pages.length,
        getPage: (n: number) =>
          Promise.resolve({
            getTextContent: () =>
              Promise.resolve({ items: (pages[n - 1] ?? []).map((str) => ({ str })) }),
          }),
      }),
    }),
  };
}

describe("SCRUM-122: PDF-Adapter (injizierte Engine)", () => {
  it("extrahiert und verbindet Seitentext", async () => {
    expect(await text(new ArrayBuffer(8), stubEngine([["Druck", "P2"], ["Ventil"]]))).toBe(
      "Druck P2\n\nVentil",
    );
  });

  it("leeres PDF → leerer String", async () => {
    expect(await text(new ArrayBuffer(8), stubEngine([]))).toBe("");
  });

  it("Fehler der Engine wird propagiert (Caller zeigt failed)", async () => {
    const failing: PdfEngine = {
      getDocument: () => ({ promise: Promise.reject(new Error("corrupt-pdf")) }),
    };
    await expect(text(new ArrayBuffer(8), failing)).rejects.toThrow("corrupt-pdf");
  });
});
