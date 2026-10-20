// @vitest-environment jsdom
// ================================================================================================
// OCR-E04 · Nacharbeit 8 (Ben) · „TEXT AUS DATEI EINFÜGEN“ LIEST GESCANNTE PDF-SEITEN — gemountet.
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-mehrseitige-scans, Revision 1. Bis hier fügte dieser Eingang
// des Erfassens (`onDocs`) nur die Textebene einer PDF ein; ein reiner Scan endete mit „kein Text“.
// Gemountet über die Hülle aus `tests/entwurf-verlassen/`. Ersetzt sind allein das Lesen der PDF
// (`readPdfFile`), das Zeichnen der Seite (`pdfSeitenZeichner`) und die Texterkennung.
//
//   T1  Reiner Scan mit Fehler auf Seite 2: die gelesenen Seiten stehen in Seitenreihenfolge im Text,
//       die Meldung nennt ausdrücklich, dass nur 2 von 3 Seiten gelesen sind.
//   T2  Keine Seite lesbar: ehrliche Meldung, nichts eingefügt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrResult } from "../../apps/web/src/lib/ocr";
import type { PdfDocumentText } from "../../apps/web/src/lib/pdf";

const steuerung = vi.hoisted(() => ({
  pdf: { text: "", truncated: false, pageCount: 0 } as PdfDocumentText,
  zeichneFehler: new Set<number>(),
  ocrText: {} as Record<number, string>,
}));

vi.mock("../../apps/web/src/lib/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/lib/files")>()),
  readPdfFile: async () => steuerung.pdf,
  runImageOcr: async (input: unknown): Promise<OcrResult> => {
    const roh = typeof input === "string" ? atob(input.split(",")[1] ?? "") : "";
    const text = steuerung.ocrText[Number(/seite-(\d+)/.exec(roh)?.[1])];
    return text === undefined ? { status: "failed", text: "" } : { status: "success", text };
  },
  pdfSeitenZeichner: async () => ({
    zeichne: async (seite: number) => {
      if (steuerung.zeichneFehler.has(seite)) {
        throw new Error(`seite-${seite}-defekt`);
      }
      return `data:image/png;base64,${btoa(`seite-${seite}`)}`;
    },
    schliessen: async () => undefined,
  }),
}));

vi.mock("../../apps/web/src/api/auth", async () =>
  (await import("../entwurf-verlassen/attrappen")).authAttrappe(),
);

vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("../entwurf-verlassen/attrappen")).endpointsAttrappe(),
);

import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { FILE_TEXT_INSERT_ACCEPT } from "../../apps/web/src/lib/captureFromFile";
import { abbauen, flaeche, flush, grundzustand, mount } from "../entwurf-verlassen/huelle";

function einfuegen(): HTMLInputElement {
  const input = flaeche().querySelector<HTMLInputElement>(
    `input[type="file"][accept="${FILE_TEXT_INSERT_ACCEPT}"]`,
  );
  if (!input) {
    throw new Error("Kein Eingang „Text aus Datei einfügen“");
  }
  return input;
}

async function waehle(datei: File): Promise<void> {
  const input = einfuegen();
  Object.defineProperty(input, "files", { value: [datei], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  for (let i = 0; i < 4; i += 1) {
    await act(flush);
  }
}

/** Der eingefügte Text steht im Erzählfeld (Rohtext) des Erfassens. */
function eingefuegt(): string {
  return [...flaeche().querySelectorAll("textarea")].map((el) => el.value).join("\n");
}

/** Der Stand je Seite der eingefügten PDF („Seite:Status“). */
function seiten(): string[] {
  const liste = flaeche().querySelector("[data-testid=einfuegen-pdf-seiten]");
  const zeilen = liste?.querySelectorAll<HTMLElement>("[data-testid=pdf-seite]") ?? [];
  return [...zeilen].map((el) => {
    const status = el.getAttribute("data-status");
    return `${el.getAttribute("data-seite")}:${status}`;
  });
}

function sichtbar(): string {
  return (document.body.textContent ?? "").replace(/\s+/g, " ");
}

function pdfDatei(name: string): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type: "application/pdf" });
}

beforeEach(async () => {
  await grundzustand();
  steuerung.zeichneFehler = new Set();
  await mount("/erfassen", "freitext");
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("OCR-E04 · „Text aus Datei einfügen“: gescannte PDF", () => {
  it("T1 · reiner Scan, Fehler auf Seite 2: gelesene Seiten eingefügt, Teilstand genannt", async () => {
    steuerung.pdf = {
      text: "",
      truncated: false,
      pageCount: 3,
      totalPages: 3,
      pages: ["", "", ""],
      pageImages: [true, true, true],
    };
    steuerung.ocrText = {
      1: "Pruefkarte 47 wurde am Montag abgezeichnet.",
      2: "Der Druck betrug 4,5 bar.",
      3: "Lager 29 ist freigegeben.",
    };
    steuerung.zeichneFehler = new Set([2]);
    await waehle(pdfDatei("fiktiver-scan.pdf"));

    const text = eingefuegt();
    expect(text).toContain("[fiktiver-scan.pdf]");
    expect(text.indexOf("Pruefkarte 47")).toBeGreaterThan(text.indexOf("[fiktiver-scan.pdf]"));
    expect(text.indexOf("Pruefkarte 47")).toBeLessThan(text.indexOf("Lager 29"));
    expect(text).not.toContain("4,5 bar");
    expect(sichtbar()).toContain(
      i18n.t("pdfscan.teilweise", { name: "fiktiver-scan.pdf", fertig: 2, gesamt: 3 }),
    );
    expect(sichtbar()).not.toContain(i18n.t("capture.docEmpty", { name: "fiktiver-scan.pdf" }));
    // Nacharbeit 10: welche Seite gelesen ist und welche scheiterte, steht je Seite da.
    expect(seiten()).toEqual(["1:gelesen", "2:fehlgeschlagen", "3:gelesen"]);
  });

  it("T2 · keine Seite lesbar: ehrliche Meldung, nichts eingefügt", async () => {
    steuerung.pdf = {
      text: "",
      truncated: false,
      pageCount: 2,
      totalPages: 2,
      pages: ["", ""],
      pageImages: [true, true],
    };
    steuerung.ocrText = {};
    await waehle(pdfDatei("fiktiv-unlesbar.pdf"));

    expect(eingefuegt()).not.toContain("[fiktiv-unlesbar.pdf]");
    expect(sichtbar()).toContain(i18n.t("pdfscan.leer", { name: "fiktiv-unlesbar.pdf" }));
    // Nacharbeit 10: auch bei vollständig gescheiterter Erkennung bleibt der Stand je Seite.
    expect(seiten()).toEqual(["1:fehlgeschlagen", "2:fehlgeschlagen"]);
  });
});
