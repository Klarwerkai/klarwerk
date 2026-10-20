// @vitest-environment jsdom
// ================================================================================================
// OCR-E04 · Nacharbeit 8 (Ben) · „FRAGEN AN EIN DOKUMENT“ LIEST GESCANNTE PDF-SEITEN — gemountet.
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-mehrseitige-scans, Revision 1. Bis hier übernahm die Fläche
// `/fragen/dokument` bei einer PDF nur die Textebene: Scanseiten fehlten in den Fundstellen. Ersetzt
// sind allein das Lesen der PDF (`readPdfFile`: bekannter Seiteninhalt), das Zeichnen der Seite
// (`pdfSeitenZeichner`) und die Texterkennung (`runImageOcr`).
//
//   D1  Gescannter Bericht mit drei Seiten, mittlere Seite scheitert: Fragen zur ersten und zur
//       letzten Seite nennen „Seite 1“ bzw. „Seite 3“; der Fehler von Seite 2 steht sichtbar da,
//       ihr Inhalt kommt in keiner Fundstelle vor.
//   D2  Gemischte PDF: Textebene und erkannte Seite stehen je Seite, ohne Doppel.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrResult } from "../../apps/web/src/lib/ocr";
import type { PdfDocumentText } from "../../apps/web/src/lib/pdf";

const steuerung = vi.hoisted(() => ({
  pdf: { text: "", truncated: false, pageCount: 0 } as PdfDocumentText,
  zeichneFehler: new Set<number>(),
  ocrText: {} as Record<number, string>,
  gezeichnet: [] as number[],
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
      steuerung.gezeichnet.push(seite);
      if (steuerung.zeichneFehler.has(seite)) {
        throw new Error(`seite-${seite}-defekt`);
      }
      return `data:image/png;base64,${btoa(`seite-${seite}`)}`;
    },
    schliessen: async () => undefined,
  }),
}));

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { Dokumentfragen } from "../../apps/web/src/pages/Dokumentfragen";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function q(id: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-testid=${id}]`);
}

async function waehle(datei: File): Promise<void> {
  const input = q("dokumentfragen-datei") as HTMLInputElement | null;
  if (!input) {
    throw new Error("Kein Datei-Eingang");
  }
  Object.defineProperty(input, "files", { value: [datei], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  for (let i = 0; i < 3; i += 1) {
    await act(flush);
  }
}

async function frage(text: string): Promise<string[]> {
  const feld = q("dokumentfragen-frage") as HTMLInputElement | null;
  if (!feld) {
    throw new Error("Kein Fragefeld");
  }
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(async () => {
    q("dokumentfragen-senden")?.click();
    await flush();
  });
  const marken = container.querySelectorAll<HTMLElement>("[data-testid=dokumentfragen-aussage]");
  return [...marken].map((el) => (el.textContent ?? "").replace(/\s+/g, " "));
}

function seiten(): string[] {
  const zeilen = container.querySelectorAll<HTMLElement>("[data-testid=pdf-seite]");
  return [...zeilen].map((el) => {
    const teil = el.getAttribute("data-seitenteil");
    return `${el.getAttribute("data-seite")}:${teil}:${el.getAttribute("data-status")}`;
  });
}

function pdfDatei(name: string): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type: "application/pdf" });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  steuerung.zeichneFehler = new Set();
  steuerung.gezeichnet = [];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(MemoryRouter, null, createElement(Dokumentfragen)));
    await flush();
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("OCR-E04 · Fragen an ein Dokument: gescannte PDF-Seiten", () => {
  it("D1 · erste und letzte Seite mit richtiger Seite; der Fehler der mittleren Seite steht da", async () => {
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

    expect(steuerung.gezeichnet).toEqual([1, 2, 3]);
    expect(seiten()).toEqual(["1:bild:gelesen", "2:bild:fehlgeschlagen", "3:bild:gelesen"]);
    expect(q("pdf-seiten")?.getAttribute("data-status")).toBe("teilweise");
    expect(q("dokumentfragen-seiten")?.textContent).toContain(
      i18n.t("pdfscan.quelle.teilweise", { name: "fiktiver-scan.pdf", fertig: 2, gesamt: 3 }),
    );
    // Fundstellen gibt es nur für die gelesenen Seiten.
    expect(q("dokumentfragen-geladen")?.textContent).toContain("2");

    const erste = await frage("Welche Pruefkarte wurde abgezeichnet?");
    expect(erste[0]).toContain("Pruefkarte 47");
    expect(erste[0]).toContain(i18n.t("dokumentfragen.ortSeite", { seite: 1, absatz: 1 }));
    const letzte = await frage("Welches Lager ist freigegeben?");
    expect(letzte[0]).toContain("Lager 29");
    expect(letzte[0]).toContain(i18n.t("dokumentfragen.ortSeite", { seite: 3, absatz: 1 }));
    // Der Inhalt der gescheiterten Seite wird nicht erfunden.
    const mitte = await frage("Wie hoch war der Druck?");
    expect(mitte.join(" ")).not.toContain("4,5 bar");
    // Der Seitenstand bleibt neben der Antwort sichtbar.
    expect(q("dokumentfragen-seiten")).not.toBeNull();
  });

  it("D2 · gemischt: Textebene und erkannte Seite je Seite, nichts doppelt", async () => {
    steuerung.pdf = {
      text: "Abschnitt Ventile\nDie Ventile wurden einzeln geprueft.",
      truncated: false,
      pageCount: 2,
      totalPages: 2,
      pages: ["", "Abschnitt Ventile\nDie Ventile wurden einzeln geprueft."],
      pageImages: [true, true],
    };
    steuerung.ocrText = {
      1: "Pruefkarte 47 wurde am Montag abgezeichnet.",
      2: "Abschnitt Ventile\n\nVentil V3 wurde getauscht.",
    };
    await waehle(pdfDatei("fiktiv-gemischt.pdf"));

    expect(seiten()).toEqual(["1:bild:gelesen", "2:textebene:gelesen", "2:bild:gelesen"]);
    const stellen = container.querySelectorAll("[data-testid=dokumentfragen-stelle]");
    const alle = [...stellen].map((el) => el.textContent ?? "").join("\n");
    expect(alle.split("Abschnitt Ventile").length - 1).toBe(1);
    const antwort = await frage("Welches Ventil wurde getauscht?");
    expect(antwort[0]).toContain("Ventil V3 wurde getauscht.");
    expect(antwort[0]).toContain(i18n.t("dokumentfragen.ortSeite", { seite: 2, absatz: 2 }));
  });
});
