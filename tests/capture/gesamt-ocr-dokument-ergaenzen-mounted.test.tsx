// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-ocr` — „AUS DOKUMENT ERGAENZEN": die PDF-Kante und die Bild-Texterkennung
// ================================================================================================
//
// R-0138: JOB 2700 hat die Groessenkante vor dem PDF-Parser an den zwei Eingaengen des Erfassens
// gebaut (`job2700-handbuch-an-der-seite-mounted.test.tsx`). Der dritte Eingang, der eine PDF liest,
// ist das Panel „Aus Dokument ergaenzen" (`BodyExtractPanel`, im Erfassen UND im Editor des
// Wissensobjekts). Es rief `readPdfFile` OHNE Kante und las die Datei danach ein zweites Mal als
// Daten-URL. Hier wird das Panel ECHT gemountet und mit einem gescannten Handbuch ueber der Kante
// gefuettert.
//
// R-0151 / FR-CAP-05: Fotos werden nur auf ausdruecklichen Klick gelesen, und der erkannte Text ist
// danach der Text, den die Wissenssuche (Extraktion) bekommt. Die Engine selbst (tesseract.js) ist
// im Testprozess durch einen Zaehler ersetzt — geprueft wird der Ausloeser und der Weg des Textes,
// nicht die Erkennungsguete.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrResult } from "../../apps/web/src/lib/ocr";

const steuerung = vi.hoisted(() => ({
  maxAttachmentBytes: 20_000_000,
  ocr: vi.fn(async (_input: unknown): Promise<OcrResult> => ({ status: "success", text: "" })),
  extract: vi.fn(async (..._args: unknown[]) => ({ points: [], note: null })),
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
      get: vi.fn(async () => ({
        maxAttachments: 8,
        maxAttachmentBytes: steuerung.maxAttachmentBytes,
      })),
    },
    reasoner: {
      status: vi.fn(async () => ({ active: false, mode: "off", reachable: "off" })),
      config: vi.fn(async () => null),
      extract: steuerung.extract,
    },
  },
}));

// Nur die Bild-Engine wird ersetzt; Kante, Fehlerklassen und Leser bleiben die echten.
vi.mock("../../apps/web/src/lib/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/lib/files")>()),
  runImageOcr: steuerung.ocr,
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
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import { maxRawAttachmentBytes } from "../../apps/web/src/lib/uploadLimits";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NAME = "BAADER-Handbuch-gescannt.pdf";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(BodyExtractPanel, { onAppend: async () => true, koId: "ko-1" }),
          ),
        ),
      ),
    );
    await flush();
  });
  // Das Panel startet zugeklappt — aufklappen wie der Mensch.
  const aufklapper = container.querySelector<HTMLButtonElement>("button[aria-expanded]");
  if (!aufklapper) {
    throw new Error("Kein Aufklapper am Panel „Aus Dokument ergänzen“");
  }
  await act(async () => {
    aufklapper.click();
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  steuerung.maxAttachmentBytes = 20_000_000;
  steuerung.ocr.mockReset();
  steuerung.extract.mockReset();
  steuerung.extract.mockResolvedValue({ points: [], note: null });
  await mount();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function eingang(): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) {
    throw new Error("Kein Datei-Eingang im Panel");
  }
  return input;
}

async function waehle(datei: File): Promise<void> {
  const input = eingang();
  Object.defineProperty(input, "files", { value: [datei], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

function knopf(beschriftung: string): HTMLButtonElement {
  const b = [...container.querySelectorAll("button")].find((x) =>
    (x.textContent ?? "").includes(beschriftung),
  );
  if (!b) {
    throw new Error(`Kein Knopf „${beschriftung}“`);
  }
  return b;
}

async function klicke(b: HTMLButtonElement): Promise<void> {
  await act(async () => {
    b.click();
    await flush();
  });
  await act(flush);
}

/** Das Handbuch: die Groesse zaehlt, der Inhalt nicht. Ein Lesen der Datei wird mitgezaehlt. */
function handbuch(bytes: number) {
  const datei = new File([new Uint8Array(bytes)], NAME, { type: "application/pdf" });
  const gelesen = vi.fn(async () => new ArrayBuffer(0));
  Object.defineProperty(datei, "arrayBuffer", { value: gelesen, configurable: true });
  return { datei, gelesen };
}

function text(): string {
  return container.textContent ?? "";
}

describe("gesamt-ocr · R-0138 · das Panel „Aus Dokument ergänzen“ liest kein Handbuch über der Kante", () => {
  it("P1 · über der Kante: sofort „zu groß“ mit Zahlen — kein Lesen der Datei, kein „wird gelesen“", async () => {
    const kante = maxRawAttachmentBytes(20_000_000);
    const { datei, gelesen } = handbuch(kante + 1);
    const datenUrl = vi.spyOn(FileReader.prototype, "readAsDataURL");
    const t0 = Date.now();
    await waehle(datei);
    expect(Date.now() - t0).toBeLessThan(3_000);
    expect(text()).toContain(
      i18n.t("capture.file.pdfTooLarge", {
        name: NAME,
        mb: ((kante + 1) / 1_000_000).toFixed(1),
        limitMb: "14.9",
      }),
    );
    // Weder der Parser-Puffer noch die Daten-URL fuer das Original wurde angefasst.
    expect(gelesen).not.toHaveBeenCalled();
    expect(datenUrl).not.toHaveBeenCalled();
    datenUrl.mockRestore();
    expect(text()).not.toContain(i18n.t(CAPTURE_FILE_TEXT.extracting, { name: NAME }));
    expect(text()).not.toContain(i18n.t(CAPTURE_FILE_TEXT.parseError, { name: NAME }));
    // Kein Text, also auch keine Wissenssuche, die mit leerem Inhalt starten koennte.
    expect(text()).not.toContain(i18n.t(CAPTURE_FILE_TEXT.searchCta));
  });

  it("P2 · die Kante kommt aus der Servergrenze, nicht aus einer Konstante im Panel", async () => {
    act(() => root.unmount());
    container.remove();
    steuerung.maxAttachmentBytes = 2_000_000;
    await mount();
    const kante = maxRawAttachmentBytes(2_000_000);
    const { datei, gelesen } = handbuch(kante + 1);
    await waehle(datei);
    expect(text()).toContain(
      i18n.t("capture.file.pdfTooLarge", {
        name: NAME,
        mb: ((kante + 1) / 1_000_000).toFixed(1),
        limitMb: (Math.floor(kante / 100_000) / 10).toFixed(1),
      }),
    );
    expect(gelesen).not.toHaveBeenCalled();
  });

  it("P3 · Gegenprobe: eine kleine PDF löst die Kante NICHT aus — sie geht weiter zum Parser", async () => {
    // Ohne pdfjs im Testprozess scheitert der Parser danach ehrlich; gemessen wird die Kante.
    const { datei } = handbuch(1_024);
    await waehle(datei);
    expect(text()).not.toContain("zu groß für den Import");
  });
});

describe("gesamt-ocr · R-0151 / FR-CAP-05 · Texterkennung im Bild nur auf Klick, Text geht in die Wissenssuche", () => {
  it("O1 · ein Foto auswählen startet KEINE Erkennung — der Knopf steht bereit", async () => {
    await waehle(new File([new Uint8Array(64)], "aushang.png", { type: "image/png" }));
    expect(steuerung.ocr).not.toHaveBeenCalled();
    expect(knopf(i18n.t(CAPTURE_FILE_TEXT.ocrCta))).toBeTruthy();
  });

  it("O2 · erst der Klick liest den Text; die Wissenssuche bekommt genau diesen Text", async () => {
    const erkannt = "Druckabfall an P2: Ventil V3 prüfen";
    steuerung.ocr.mockResolvedValue({ status: "success", text: erkannt });
    await waehle(new File([new Uint8Array(64)], "aushang.png", { type: "image/png" }));
    await klicke(knopf(i18n.t(CAPTURE_FILE_TEXT.ocrCta)));
    expect(steuerung.ocr).toHaveBeenCalledTimes(1);
    expect(text()).toContain(i18n.t(CAPTURE_FILE_TEXT.loaded, { name: "aushang.png" }));
    await klicke(knopf(i18n.t(CAPTURE_FILE_TEXT.searchCta)));
    expect(steuerung.extract).toHaveBeenCalledTimes(1);
    expect(steuerung.extract.mock.calls[0]?.[0]).toBe(erkannt);
  });

  it("O3 · ohne ladbare Engine: ehrlicher Satz, kein erfundener Text, keine Wissenssuche", async () => {
    steuerung.ocr.mockResolvedValue({ status: "unavailable", text: "" });
    await waehle(new File([new Uint8Array(64)], "notiz.jpg", { type: "image/jpeg" }));
    await klicke(knopf(i18n.t(CAPTURE_FILE_TEXT.ocrCta)));
    expect(text()).toContain(i18n.t("capture.ocrUnavailable"));
    expect(text()).not.toContain(i18n.t(CAPTURE_FILE_TEXT.searchCta));
    expect(steuerung.extract).not.toHaveBeenCalled();
  });
});
