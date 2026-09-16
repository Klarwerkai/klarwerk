// ================================================================================================
// JOB 4203 · D3 / T8 — DER PDF-PUFFER ÜBERLEBT DAS PARSEN. HEUTE TUT ER ES NICHT.
// ================================================================================================
//
// DER BEFUND, und er ist in Chromium gemessen, nicht überlegt (Cloud-Lauf `dc624ada6dbfabda8816377a`,
// 16.09.): der PDF-Bedienweg bricht mit „«d3-referenz.pdf» konnte nicht gelesen werden" ab —
// `capture.file.parseError`. Die Datei ist in Ordnung: dieselbe Datei, durch DENSELBEN Adapter
// (`extractPdfDocument`) und die ECHTE pdfjs-Engine, liefert in Node alle sechs Zeilen
// (`pdf-referenz-echte-engine.test.ts`, R5). Zwischen beiden Läufen liegt genau ein Unterschied:
// im Browser läuft pdfjs in einem ECHTEN Worker, in Node im eingebauten Ersatz.
//
// UND DARIN LIEGT DIE URSACHE. pdfjs verschickt die übergebenen Daten an den Worker und ÜBERTRÄGT
// den zugrunde liegenden `ArrayBuffer` dabei (Transfer, nicht Kopie) — danach ist der Puffer des
// Aufrufers DETACHED. `extractPdfDocument` reicht heute `new Uint8Array(buffer)` hinein, also eine
// SICHT auf genau den Puffer des Aufrufers.
//
// Der Aufrufer braucht ihn aber noch: `readPdfFileWithOriginal` (`lib/files.ts:338-344`) liest aus
// DEMSELBEN Puffer anschliessend das Original für den Anhang — das ist der ausdrückliche Zweck jener
// Funktion („liest EINMAL und liefert beides aus demselben Puffer", JOB 2700 D1). Auf einem
// detachten Puffer scheitert das, der Fehler landet im `catch` von `onExtractFile`
// (`Capture.tsx:4113-4135`) und wird zum generischen Lesefehler. Im Ersatz-Worker gibt es keinen
// Transfer — deshalb ist der Defekt jedem Node-Test und jedem Stub entgangen.
//
// WARUM DIE REPARATUR IN `pdf.ts` STEHT UND NICHT IN `files.ts`: hier entsteht die Übergabe an die
// Engine, und hier ist sie zu entschärfen — mit einer eigenen Kopie. Dann gilt für JEDEN Aufrufer,
// dass sein Puffer das Parsen übersteht, und nicht nur für den einen, der daran gedacht hat.
// (`files.ts` liegt ausserdem nicht in den Zielpfaden dieses Auftrags.)
import { describe, expect, it } from "vitest";
import {
  type PdfEngine,
  type PdfLoadingTask,
  type PdfTextContent,
  extractPdfDocument,
} from "../../apps/web/src/lib/pdf";

/**
 * Eine Engine, die sich verhält wie pdfjs MIT echtem Worker: sie überträgt den Puffer, den sie
 * bekommt. `structuredClone` mit `transfer` ist derselbe Mechanismus, den `postMessage` benutzt —
 * kein Nachbau eines Verhaltens, sondern dasselbe Verhalten.
 */
function uebertragendeEngine(): PdfEngine {
  return {
    getDocument(src: { data: Uint8Array }): PdfLoadingTask {
      const puffer = src.data.buffer as ArrayBuffer;
      // GENAU DER SCHRITT, den pdfjs beim Absenden an den Worker macht.
      structuredClone(puffer, { transfer: [puffer] });
      return {
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getTextContent: async (): Promise<PdfTextContent> => ({
              items: [{ str: "Seiteninhalt", transform: [1, 0, 0, 1, 72, 700], height: 12 }],
            }),
          }),
        }),
      };
    },
  };
}

/** Ein Puffer mit erkennbarem Inhalt — nach dem Parsen muss er noch genau so dastehen. */
function puffer(): ArrayBuffer {
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
  return bytes.buffer;
}

describe("JOB 4203 · T8 — der Puffer des Aufrufers übersteht das Parsen", () => {
  it("T8a · nach der Extraktion ist der übergebene ArrayBuffer NICHT detached", async () => {
    const roh = puffer();
    const vorher = roh.byteLength;
    const ergebnis = await extractPdfDocument(roh, uebertragendeEngine());

    expect(ergebnis.text, "der Stub hat gar nichts geliefert").toContain("Seiteninhalt");
    // DIE ZUSICHERUNG: der Puffer des Aufrufers gehört dem Aufrufer. Heute steht hier 0 — pdfjs hat
    // ihn mitgenommen, und `readPdfFileWithOriginal` findet nichts mehr vor.
    expect(
      roh.byteLength,
      "der übergebene Puffer wurde an die Engine VERSCHENKT — der Aufrufer kann das Original " +
        "daraus nicht mehr lesen (genau der Abbruch des PDF-Bedienwegs)",
    ).toBe(vorher);
  });

  it("T8b · und er ist nicht nur da, sondern unverändert lesbar", async () => {
    const roh = puffer();
    await extractPdfDocument(roh, uebertragendeEngine());
    // Ein Puffer, der nur zufällig seine Länge behält, hülfe niemandem: gelesen werden MUSS er.
    const wieder = new Uint8Array(roh);
    expect([...wieder.slice(0, 5)]).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d]);
  });

  it("T8c · GEGENPROBE: eine Engine OHNE Transfer lässt den Puffer ohnehin in Ruhe", async () => {
    // Ohne diese Zeile sagte T8a nichts über den Transfer, sondern nur über irgendeinen Zustand:
    // mit der bisherigen Stub-Engine (kein Transfer — so messen alle Bestandstests) war der Puffer
    // IMMER unversehrt. Genau deshalb ist der Defekt jahrelang unbemerkt geblieben.
    const roh = puffer();
    const ohneTransfer: PdfEngine = {
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getTextContent: async (): Promise<PdfTextContent> => ({ items: [{ str: "X" }] }),
          }),
        }),
      }),
    };
    await extractPdfDocument(roh, ohneTransfer);
    expect(roh.byteLength).toBe(8);
  });
});
