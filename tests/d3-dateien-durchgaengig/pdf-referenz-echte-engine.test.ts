// ================================================================================================
// JOB 4203 · D3 / R5 — DIE PDF-REFERENZ AN DER ECHTEN pdfjs-ENGINE.
// ================================================================================================
//
// WARUM ES DIESEN FALL GIBT, und er ist aus einem Fehlschlag entstanden: der erste Torlauf dieses
// Auftrags (Cloud-Lauf `d3f1dc569a3b0e34b54fe2cc`) hat den PDF-Bedienweg rot gemeldet — die Datei
// wurde gewählt, aber nie eingelesen. Die Meldung sagte NICHT, woran es lag, und beide Erklärungen
// waren offen: die Referenzdatei taugt nicht, oder der Browser-Weg (lazy geladene Engine plus
// Worker) trägt nicht. Genau diese Trennung verlangt der Auftrag (§5.6: „beide möglichen Ursachen
// je Format getrennt gemessen, bevor repariert wird").
//
// DIESER FALL MISST DIE ERSTE HÄLFTE: taugt die DATEI? Er gibt sie der ECHTEN pdfjs-Engine — dem
// `legacy`-Build, den auch `files.ts:256` lädt, nur ohne Worker (in Node fährt pdfjs von sich aus
// den eingebauten Ersatz). Geparst wird über `extractPdfDocument`, also über DENSELBEN Adapter, den
// das Produkt benutzt; es gibt keinen zweiten Auswerteweg.
//
// WAS ER AUSDRÜCKLICH NICHT SAGT: dass der Browser-Weg trägt. Das sagt allein
// `pdf-durchgaengig-chromium.test.ts`. Wird DIESER Fall grün und JENER rot, liegt es am Browser-Weg
// — und umgekehrt. Das ist der ganze Zweck der Aufteilung.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { type PdfEngine, extractPdfDocument } from "../../apps/web/src/lib/pdf";
import { PDF_SUCHBEGRIFF, PDF_ZEILEN, referenzBytes } from "./referenzinhalt";

const require = createRequire(import.meta.url);

/** Der `legacy`-Build — derselbe, den `files.ts:256` im Browser lazy lädt. */
async function echteEngine(): Promise<PdfEngine> {
  const pdfjs = (await import(
    "../../apps/web/node_modules/pdfjs-dist/legacy/build/pdf.mjs"
  )) as unknown as PdfEngine & { GlobalWorkerOptions?: { workerSrc: string } };
  // In Node gibt es keinen Web-Worker; pdfjs fährt dann seinen eingebauten Ersatz. Der Pfad wird
  // trotzdem gesetzt, damit die Auflösung nicht auf eine Browser-URL fällt.
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
      "../../apps/web/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    );
  }
  return { getDocument: (src) => pdfjs.getDocument(src) };
}

describe("JOB 4203 · R5 — die PDF-Referenz an der echten Engine", () => {
  it("R5 · pdfjs liest die Datei und liefert alle sechs Zeilen in Lesereihenfolge", async () => {
    const bytes = referenzBytes("pdf");
    const kopie = new Uint8Array(bytes.byteLength);
    kopie.set(bytes);
    const ergebnis = await extractPdfDocument(kopie.buffer, await echteEngine());

    console.info(`JOB 4203 R5 · Seiten ${ergebnis.pageCount} · Text:\n${ergebnis.text}`);
    expect(ergebnis.pageCount, "keine Seite gelesen").toBe(1);
    expect(ergebnis.truncated).toBe(false);
    for (const zeile of PDF_ZEILEN) {
      expect(ergebnis.text, `Zeile fehlt: ${zeile}`).toContain(zeile);
    }
    expect(ergebnis.text.split(PDF_SUCHBEGRIFF).length - 1).toBe(1);
  }, 60_000);

  it("R5b · die Absatzrekonstruktion greift: 18 pt bleiben EINE Gruppe, 42 pt trennen", async () => {
    const bytes = referenzBytes("pdf");
    const kopie = new Uint8Array(bytes.byteLength);
    kopie.set(bytes);
    const { text } = await extractPdfDocument(kopie.buffer, await echteEngine());
    // Die beiden eng gesetzten Zeilen stehen ohne Leerzeile untereinander …
    expect(text, "die zwei Zeilen desselben Absatzes wurden getrennt").toContain(
      `${PDF_ZEILEN[2]}\n${PDF_ZEILEN[3]}`,
    );
    // … und zwischen den Abschnitten steht eine Leerzeile.
    expect(text, "zwischen den Abschnitten fehlt der Absatzumbruch").toContain(
      `${PDF_ZEILEN[3]}\n\n${PDF_ZEILEN[4]}`,
    );
  }, 60_000);
});
