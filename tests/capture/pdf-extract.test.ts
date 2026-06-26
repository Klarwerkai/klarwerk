import { describe, expect, it } from "vitest";
import { type PdfEngine, extractPdfText } from "../../apps/web/src/lib/pdf";

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
    const text = await extractPdfText(
      new ArrayBuffer(8),
      stubEngine([["Druck", "P2"], ["Ventil"]]),
    );
    expect(text).toBe("Druck P2\n\nVentil");
  });

  it("leeres PDF → leerer String", async () => {
    expect(await extractPdfText(new ArrayBuffer(8), stubEngine([]))).toBe("");
  });

  it("Fehler der Engine wird propagiert (Caller zeigt failed)", async () => {
    const failing: PdfEngine = {
      getDocument: () => ({ promise: Promise.reject(new Error("corrupt-pdf")) }),
    };
    await expect(extractPdfText(new ArrayBuffer(8), failing)).rejects.toThrow("corrupt-pdf");
  });
});
