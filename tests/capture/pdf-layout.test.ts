import { describe, expect, it } from "vitest";
import { type PdfPositionedItem, reconstructPageLines } from "../../apps/web/src/lib/extract";
import { type PdfEngine, type PdfTextItem, extractPdfDocument } from "../../apps/web/src/lib/pdf";

// WP-D3: PDF-Absatzrekonstruktion — ein VIP-PDF darf nicht als Wortsalat ankommen. Getestet wird der
// reine Kern (reconstructPageLines, Y/X-basiert) und der Adapter (extractPdfDocument, Seiten-Cap).

const LINE_H = 10;
const item = (str: string, x: number, y: number): PdfPositionedItem => ({
  str,
  x,
  y,
  height: LINE_H,
});

describe("WP-D3: reconstructPageLines (Y/X-Rekonstruktion)", () => {
  it("gruppiert nach Y zu Zeilen, sortiert innerhalb der Zeile nach X", () => {
    // Bewusst in falscher Array-Reihenfolge geliefert (rechts vor links) → Sortierung muss greifen.
    const lines = reconstructPageLines([
      item("Zeile", 40, 100),
      item("Erste", 10, 100),
      item("Zweite", 10, 88), // Abstand 12 ≈ 1,2×Zeilenhöhe → dieselbe Absatzgruppe, neue Zeile
    ]);
    expect(lines).toEqual(["Erste Zeile", "Zweite"]);
  });

  it("setzt bei großem Y-Sprung eine Absatz-Leerzeile", () => {
    const lines = reconstructPageLines([
      item("Absatz", 10, 100),
      item("eins", 40, 100),
      item("Neuer", 10, 70), // Sprung 30 > 1,5×Zeilenhöhe → Absatzumbruch
      item("Absatz", 45, 70),
    ]);
    expect(lines).toEqual(["Absatz eins", "", "Neuer Absatz"]);
  });

  it("liest Zeilen nach Y absteigend (PDF-Ursprung unten links)", () => {
    // Eingabe von unten nach oben; Ausgabe muss oben (großes Y) zuerst sein. Abstand 10 (≈Zeilenhöhe)
    // → benachbarte Zeile, kein Absatzumbruch — hier zählt nur die Reihenfolge.
    const lines = reconstructPageLines([item("unten", 10, 90), item("oben", 10, 100)]);
    expect(lines).toEqual(["oben", "unten"]);
  });

  it("ignoriert leere Fragmente; ohne Positionsdaten bleibt es eine Zeile", () => {
    expect(reconstructPageLines([item("  ", 10, 100), item("Text", 30, 100)])).toEqual(["Text"]);
    // height/y = 0 (z. B. Stub) → alle Fragmente derselben Zeile, Reihenfolge nach X.
    expect(
      reconstructPageLines([
        { str: "A", x: 0, y: 0, height: 0 },
        { str: "B", x: 0, y: 0, height: 0 },
      ]),
    ).toEqual(["A B"]);
  });

  it("einspaltiger Normalfall bleibt lesbar (mehrere Zeilen, ein Absatz)", () => {
    const lines = reconstructPageLines([
      item("Dosierwert", 10, 100),
      item("kalibrieren", 60, 100),
      item("nach", 10, 89),
      item("Schichtwechsel", 40, 89),
    ]);
    expect(lines).toEqual(["Dosierwert kalibrieren", "nach Schichtwechsel"]);
  });
});

// Stub-Engine mit positionierten Items je Seite (DI, kein echtes pdfjs).
function positionedEngine(pages: PdfTextItem[][]): PdfEngine {
  return {
    getDocument: () => ({
      promise: Promise.resolve({
        numPages: pages.length,
        getPage: (n: number) =>
          Promise.resolve({
            getTextContent: () => Promise.resolve({ items: pages[n - 1] ?? [] }),
          }),
      }),
    }),
  };
}

const posItem = (str: string, x: number, y: number): PdfTextItem => ({
  str,
  transform: [1, 0, 0, 1, x, y],
  height: LINE_H,
});

describe("WP-D3: extractPdfDocument (Seiten-Cap + truncated)", () => {
  it("rekonstruiert Zeilen/Absätze über die transform-Positionen", async () => {
    const engine = positionedEngine([
      [posItem("Ventil", 10, 100), posItem("schließen", 55, 100), posItem("Danach", 10, 70)],
    ]);
    const doc = await extractPdfDocument(new ArrayBuffer(8), engine);
    expect(doc.text).toBe("Ventil schließen\n\nDanach");
    expect(doc.truncated).toBe(false);
    expect(doc.pageCount).toBe(1);
  });

  it("Seiten-Cap greift: nur die ersten N Seiten, truncated=true", async () => {
    const engine = positionedEngine([
      [posItem("S1", 10, 100)],
      [posItem("S2", 10, 100)],
      [posItem("S3", 10, 100)],
    ]);
    const doc = await extractPdfDocument(new ArrayBuffer(8), engine, { maxPages: 2 });
    expect(doc.pageCount).toBe(2);
    expect(doc.truncated).toBe(true);
    expect(doc.text).toBe("S1\n\nS2"); // S3 nicht mehr enthalten
  });

  it("innerhalb des Caps → truncated=false", async () => {
    const engine = positionedEngine([[posItem("Nur", 10, 100)]]);
    const doc = await extractPdfDocument(new ArrayBuffer(8), engine, { maxPages: 200 });
    expect(doc.truncated).toBe(false);
  });
});
