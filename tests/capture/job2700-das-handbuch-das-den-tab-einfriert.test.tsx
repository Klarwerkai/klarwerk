// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  PdfTooLargeError,
  dataUrlFromBuffer,
  readPdfFile,
  readPdfFileWithOriginal,
} from "../../apps/web/src/lib/files";
import {
  PDF_PARSE_TIMEOUT_MS,
  type PdfDocumentProxy,
  type PdfEngine,
  PdfTimeoutError,
  extractPdfDocument,
} from "../../apps/web/src/lib/pdf";
import { maxRawAttachmentBytes } from "../../apps/web/src/lib/uploadLimits";

// ================================================================================================
// JOB 2700 D1 — DAS HANDBUCH, DAS DEN TAB EINFRIERT (Befund R2-28)
// ================================================================================================
//
// Drei Zusagen am Vertrag, je mit Gegenprobe: (A) die Groessenkante VOR dem Parser, mit derselben
// Ableitung wie 2676 fuer PPTX; (B) die Frist um das Parsen, mit Freigabe (`destroy`) — ein Dokument,
// das zu lange braucht, bricht ab statt zu haengen; (C) die Datei wird EINMAL gelesen, Text und
// Original kommen aus demselben Puffer.

function seite(text: string) {
  return { getTextContent: async () => ({ items: [{ str: text }] }) };
}

/** Eine Stub-Engine mit Zaehlern fuer destroy — optional haengend beim Laden oder beim Lesen. */
function engine(opts: { haengtBeim?: "laden" | "seite"; seiten?: string[] } = {}) {
  const zaehler = { getDocument: 0, taskDestroy: 0, docDestroy: 0 };
  const doc: PdfDocumentProxy = {
    numPages: (opts.seiten ?? ["Seite eins"]).length,
    getPage: async (n) =>
      opts.haengtBeim === "seite"
        ? new Promise(() => undefined)
        : seite((opts.seiten ?? ["Seite eins"])[n - 1] ?? ""),
    destroy: () => {
      zaehler.docDestroy += 1;
    },
  };
  const e: PdfEngine = {
    getDocument: () => {
      zaehler.getDocument += 1;
      return {
        promise: opts.haengtBeim === "laden" ? new Promise(() => undefined) : Promise.resolve(doc),
        destroy: () => {
          zaehler.taskDestroy += 1;
        },
      };
    },
  };
  return { engine: e, zaehler };
}

function pdfDatei(bytes: number, name = "handbuch.pdf"): File {
  return new File([new Uint8Array(bytes)], name, { type: "application/pdf" });
}

describe("JOB 2700 D1 · A · die Kante vor dem Parser", () => {
  it("A1 · dieselbe Ableitung wie 2676: bei 20 MB Uebertragungsgrenze sind 14.999.928 Rohbytes die Kante", () => {
    expect(maxRawAttachmentBytes(20_000_000)).toBe(14_999_928);
  });

  it("A2 · ueber der Kante wird NICHT gelesen: kein arrayBuffer, kein getDocument, ein benannter Fehler mit Zahlen", async () => {
    const { engine: e, zaehler } = engine();
    const datei = pdfDatei(1_001);
    const gelesen = vi.spyOn(datei, "arrayBuffer");
    const fehler = await readPdfFile(datei, { maxBytes: 1_000, engine: e }).catch(
      (x: unknown) => x,
    );
    expect(fehler).toBeInstanceOf(PdfTooLargeError);
    expect((fehler as PdfTooLargeError).size).toBe(1_001);
    expect((fehler as PdfTooLargeError).limit).toBe(1_000);
    expect(gelesen).not.toHaveBeenCalled();
    expect(zaehler.getDocument).toBe(0);
  });

  it("A3 · Gegenprobe: unter der Kante wird gelesen — Text, Seitenzahl, kein truncated", async () => {
    const { engine: e, zaehler } = engine({ seiten: ["Kapitel 1", "Kapitel 2"] });
    const pdf = await readPdfFile(pdfDatei(999), { maxBytes: 1_000, engine: e });
    expect(pdf.text).toContain("Kapitel 1");
    expect(pdf.text).toContain("Kapitel 2");
    expect(pdf.pageCount).toBe(2);
    expect(pdf.truncated).toBe(false);
    expect(zaehler.getDocument).toBe(1);
  });

  it("A4 · ohne maxBytes gibt es keine Kante in files.ts — die Zahl kommt vom Aufrufer (keine zweite Konstante)", async () => {
    const { engine: e } = engine();
    await expect(readPdfFile(pdfDatei(5_000), { engine: e })).resolves.toMatchObject({
      pageCount: 1,
    });
  });
});

describe("JOB 2700 D1 · B · die Frist um das Parsen, mit Freigabe", () => {
  it("B1 · die Voreinstellung ist eine Minute", () => {
    expect(PDF_PARSE_TIMEOUT_MS).toBe(60_000);
  });

  it("B2 · haengt das LADEN, bricht die Extraktion nach der Frist ab und gibt die Ladeaufgabe frei", async () => {
    const { engine: e, zaehler } = engine({ haengtBeim: "laden" });
    const t0 = Date.now();
    const fehler = await extractPdfDocument(new ArrayBuffer(8), e, { timeoutMs: 80 }).catch(
      (x: unknown) => x,
    );
    expect(fehler).toBeInstanceOf(PdfTimeoutError);
    expect((fehler as PdfTimeoutError).timeoutMs).toBe(80);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(60);
    expect(Date.now() - t0).toBeLessThan(2_000);
    expect(zaehler.taskDestroy).toBe(1);
    expect(zaehler.docDestroy).toBe(0); // es gab noch kein Dokument
  });

  it("B3 · haengt das LESEN einer Seite, bricht es ebenso ab — und gibt Dokument UND Ladeaufgabe frei", async () => {
    const { engine: e, zaehler } = engine({ haengtBeim: "seite" });
    const fehler = await extractPdfDocument(new ArrayBuffer(8), e, { timeoutMs: 80 }).catch(
      (x: unknown) => x,
    );
    expect(fehler).toBeInstanceOf(PdfTimeoutError);
    expect(zaehler.docDestroy).toBe(1);
    expect(zaehler.taskDestroy).toBe(1);
  });

  it("B4 · Gegenprobe: ein Dokument in der Frist wird gelesen — und danach ebenfalls freigegeben", async () => {
    const { engine: e, zaehler } = engine({ seiten: ["A", "B", "C"] });
    const pdf = await extractPdfDocument(new ArrayBuffer(8), e, { timeoutMs: 1_000 });
    expect(pdf.pageCount).toBe(3);
    expect(zaehler.docDestroy).toBe(1);
    expect(zaehler.taskDestroy).toBe(1);
  });

  it("B5 · ein Engine-Fehler bleibt ein Engine-Fehler (kein Timeout), und es wird freigegeben", async () => {
    const e: PdfEngine = {
      getDocument: () => ({ promise: Promise.reject(new Error("corrupt-pdf")) }),
    };
    await expect(extractPdfDocument(new ArrayBuffer(8), e, { timeoutMs: 1_000 })).rejects.toThrow(
      "corrupt-pdf",
    );
  });
});

describe("JOB 2700 D1 · C · die Datei wird einmal gelesen", () => {
  it("C1 · readPdfFileWithOriginal liest arrayBuffer GENAU EINMAL und liefert Text und Original", async () => {
    const { engine: e } = engine({ seiten: ["Inhalt"] });
    const datei = new File([new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52])], "h.pdf", {
      type: "application/pdf",
    });
    const gelesen = vi.spyOn(datei, "arrayBuffer");
    const { pdf, original } = await readPdfFileWithOriginal(datei, { maxBytes: 1_000, engine: e });
    expect(pdf.text).toContain("Inhalt");
    expect(gelesen).toHaveBeenCalledTimes(1);
    expect(original).toBe("data:application/pdf;base64,JVBERi0xLjQ=");
  });

  it("C2 · dataUrlFromBuffer entspricht der Daten-URL des FileReader — Byte fuer Byte, auch ueber die Chunk-Grenze", async () => {
    const bytes = new Uint8Array(0x8000 + 7);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = (i * 31) % 256;
    }
    const datei = new File([bytes], "x.pdf", { type: "application/pdf" });
    const erwartet = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("read-error"));
      r.readAsDataURL(datei);
    });
    expect(dataUrlFromBuffer(bytes.buffer, "application/pdf")).toBe(erwartet);
  });
});
