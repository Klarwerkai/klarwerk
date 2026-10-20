// @vitest-environment jsdom
// ================================================================================================
// OCR-E04 · Nacharbeit 8 (Ben) · „AUS DOKUMENT ERGÄNZEN“ LIEST GESCANNTE PDF-SEITEN — gemountet.
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-mehrseitige-scans, Revision 1. Bis hier reduzierte das Panel
// (`BodyExtractPanel`, im Erfassen UND im Editor des Wissensobjekts) eine PDF auf ihre Textebene: ein
// reiner Scan wurde als leer abgewiesen, Bildseiten einer gemischten PDF blieben ungelesen. Ersetzt
// sind allein das Lesen der PDF (`readPdfFileWithOriginal`), das Zeichnen der Seite
// (`pdfSeitenZeichner`) und die Texterkennung (`runImageOcr`); Panel, Analyse, Leerprüfung und
// Übernahmeweg sind die echten.
//
//   E1  Reiner Scan mit Fehler auf der mittleren Seite: nicht abgewiesen; gelesene Seiten gehen in die
//       Wissenssuche, der Fehler steht im Seitenstand; das Original reist unverändert zur Übernahme.
//   E2  Gemischte PDF: Textebene und Bildseite, ohne Doppel, in Seitenreihenfolge.
//   E3  Keine Seite lesbar: ehrliche Meldung statt „gescanntes PDF wird nicht unterstützt“.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrResult } from "../../apps/web/src/lib/ocr";
import type { PdfDocumentText } from "../../apps/web/src/lib/pdf";

const ORIGINAL = "data:application/pdf;base64,JVBERi0xLjQK";

const steuerung = vi.hoisted(() => ({
  pdf: { text: "", truncated: false, pageCount: 0 } as PdfDocumentText,
  zeichneFehler: new Set<number>(),
  ocrText: {} as Record<number, string>,
  extract: vi.fn(async (..._args: unknown[]) => ({
    points: [{ title: "Punkt", summary: "Zusammenfassung", sourceExcerpt: "Lager 29" }],
    note: null,
  })),
  onAppend: vi.fn(async (..._args: unknown[]) => true),
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    uploadLimits: {
      get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20_000_000 })),
    },
    reasoner: {
      status: vi.fn(async () => ({ active: false, mode: "off", reachable: "off" })),
      config: vi.fn(async () => null),
      extract: steuerung.extract,
    },
  },
}));

vi.mock("../../apps/web/src/lib/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/lib/files")>()),
  readPdfFileWithOriginal: async () => ({ pdf: steuerung.pdf, original: ORIGINAL }),
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

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { BodyExtractPanel } from "../../apps/web/src/components/BodyExtractPanel";
import i18n from "../../apps/web/src/i18n";
import { BODY_EXTRACT_TEXT } from "../../apps/web/src/lib/bodyExtract";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const panel = createElement(BodyExtractPanel, { onAppend: steuerung.onAppend, koId: "ko-1" });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(AuthProvider, null, createElement(RoleProvider, null, panel)),
      ),
    );
    await flush();
  });
  const aufklapper = container.querySelector<HTMLButtonElement>("button[aria-expanded]");
  if (!aufklapper) {
    throw new Error("Kein Aufklapper am Panel „Aus Dokument ergänzen“");
  }
  await act(async () => {
    aufklapper.click();
    await flush();
  });
}

async function waehle(datei: File): Promise<void> {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) {
    throw new Error("Kein Datei-Eingang im Panel");
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

async function klicke(beschriftung: string): Promise<void> {
  const b = [...container.querySelectorAll("button")].find((x) =>
    (x.textContent ?? "").includes(beschriftung),
  );
  if (!b) {
    throw new Error(`Kein Knopf „${beschriftung}“`);
  }
  await act(async () => {
    b.click();
    await flush();
  });
  await act(flush);
}

function seiten(): string[] {
  const zeilen = container.querySelectorAll<HTMLElement>("[data-testid=pdf-seite]");
  return [...zeilen].map((el) => {
    const teil = el.getAttribute("data-seitenteil");
    return `${el.getAttribute("data-seite")}:${teil}:${el.getAttribute("data-status")}`;
  });
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function pdfDatei(name: string): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], name, { type: "application/pdf" });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  steuerung.zeichneFehler = new Set();
  steuerung.extract.mockClear();
  steuerung.onAppend.mockClear();
  await mount();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("OCR-E04 · „Aus Dokument ergänzen“: gescannte und gemischte PDF", () => {
  it("E1 · reiner Scan, Fehler auf Seite 2: gelesen statt abgewiesen; Original und Übernahme bleiben", async () => {
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

    expect(seiten()).toEqual(["1:bild:gelesen", "2:bild:fehlgeschlagen", "3:bild:gelesen"]);
    expect(text()).toContain(
      i18n.t("pdfscan.quelle.teilweise", { name: "fiktiver-scan.pdf", fertig: 2, gesamt: 3 }),
    );
    expect(text()).not.toContain(i18n.t(CAPTURE_FILE_TEXT.emptyPdf, { name: "fiktiver-scan.pdf" }));

    await klicke(i18n.t(CAPTURE_FILE_TEXT.searchCta));
    const gesucht = String(steuerung.extract.mock.calls[0]?.[0] ?? "");
    expect(gesucht.indexOf("Pruefkarte 47")).toBeGreaterThanOrEqual(0);
    expect(gesucht.indexOf("Pruefkarte 47")).toBeLessThan(gesucht.indexOf("Lager 29"));
    expect(gesucht).not.toContain("4,5 bar");

    // Übernahme: das Original ist die gelesene Datei, unverändert.
    await klicke(i18n.t(BODY_EXTRACT_TEXT.applyCta));
    const original = steuerung.onAppend.mock.calls[0]?.[2] as { data?: string } | undefined;
    expect(original?.data).toBe(ORIGINAL);
  });

  it("E2 · gemischt: Textebene und Bildseite in Seitenreihenfolge, nichts doppelt", async () => {
    steuerung.pdf = {
      text: "Abschnitt Ventile\nDie Ventile wurden einzeln geprueft.",
      truncated: false,
      pageCount: 2,
      totalPages: 2,
      pages: ["Abschnitt Ventile\nDie Ventile wurden einzeln geprueft.", ""],
      pageImages: [true, true],
    };
    steuerung.ocrText = {
      1: "Abschnitt Ventile\n\nVentil V3 wurde getauscht.",
      2: "Lager 29 ist freigegeben.",
    };
    await waehle(pdfDatei("fiktiv-gemischt.pdf"));

    expect(seiten()).toEqual(["1:textebene:gelesen", "1:bild:gelesen", "2:bild:gelesen"]);
    await klicke(i18n.t(CAPTURE_FILE_TEXT.searchCta));
    const gesucht = String(steuerung.extract.mock.calls[0]?.[0] ?? "");
    expect(gesucht.split("Abschnitt Ventile").length - 1).toBe(1);
    expect(gesucht.indexOf("einzeln geprueft")).toBeLessThan(gesucht.indexOf("Ventil V3"));
    expect(gesucht.indexOf("Ventil V3")).toBeLessThan(gesucht.indexOf("Lager 29"));
  });

  it("E3 · keine Seite lesbar: ehrliche Meldung, keine Wissenssuche", async () => {
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

    expect(seiten()).toEqual(["1:bild:fehlgeschlagen", "2:bild:fehlgeschlagen"]);
    expect(text()).toContain(i18n.t("pdfscan.leer", { name: "fiktiv-unlesbar.pdf" }));
    expect(text()).not.toContain(i18n.t(CAPTURE_FILE_TEXT.searchCta));
  });
});
