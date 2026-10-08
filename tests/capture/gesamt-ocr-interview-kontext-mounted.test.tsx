// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-ocr` (FR-CAP-05) — DER ERKANNTE BILDTEXT REIST INS GEFÜHRTE INTERVIEW
// ================================================================================================
//
// Bens Befund (Nacharbeit 2): Der auf Klick erkannte Bildtext floss über `onOcr` in den Rohtext
// und damit in die Strukturierung, aber nicht ins Interview — dessen Aufruf trug nur die Antworten.
// Gemountet an der ECHTEN Erfassungsseite (Gerüst wie job2700-handbuch-an-der-seite-mounted):
// Bild anhängen → „OCR → Text" klicken → Interview bewusst starten. Erwartet: der Interview-Aufruf
// trägt den erkannten Text als Kontext. Gegenprobe: ohne Klick auf die Erkennung kein Kontext.
// Die Bild-Engine und die Vorschau-Erzeugung (Canvas, in jsdom nicht vorhanden) sind ersetzt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OcrResult } from "../../apps/web/src/lib/ocr";

const steuerung = vi.hoisted(() => ({
  ocr: vi.fn(async (_input: unknown): Promise<OcrResult> => ({ status: "success", text: "" })),
  interview: vi.fn(async (..._args: unknown[]) => ({
    question: "Woran erkennst du den Druckabfall?",
    done: false,
    demo: true,
  })),
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ enabled: false }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: { list: ok([]) },
      reasoner: {
        status: ok({ active: false, mode: "off", reachable: "off" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        interview: steuerung.interview,
        extract: vi.fn(async () => ({ points: [], note: null })),
      },
    },
  };
});

// Nur Bild-Engine und Vorschau werden ersetzt; alles andere bleibt der echte Leser.
vi.mock("../../apps/web/src/lib/files", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/web/src/lib/files")>()),
  runImageOcr: steuerung.ocr,
  fileToThumbDataUrl: vi.fn(async () => "data:image/jpeg;base64,AAAA"),
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { ADVANCED_FIELDS_KEYS } from "../../apps/web/src/lib/captureAdvancedFields";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const ERKANNT = "Bei Druckabfall an P2 zuerst Ventil V3 prüfen.";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let modus: "freitext" | "interview" | undefined;
let zeichnen: (() => Promise<void>) | null = null;

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
  const zeichne = async (): Promise<void> => {
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
              createElement(
                ToastProvider,
                null,
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(
                    MemoryRouter,
                    { initialEntries: ["/erfassen"] },
                    createElement(
                      Routes,
                      null,
                      createElement(Route, {
                        path: "/erfassen",
                        element: createElement(CaptureArbeitsraum, { modus }),
                      }),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
      await flush();
    });
  };
  zeichnen = zeichne;
  await zeichne();
  await act(flush);
}

/** Der Modus kommt als Prop — wie im Produkt aus dem Menü „Datei ▾" des Blatts (JOB 3062 H3). */
async function waehleModus(m: "freitext" | "interview"): Promise<void> {
  modus = m;
  if (!zeichnen) {
    throw new Error("waehleModus vor mount() gerufen");
  }
  await zeichnen();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
  steuerung.ocr.mockReset();
  steuerung.interview.mockClear();
  await mount();
});

afterEach(() => {
  modus = undefined;
  zeichnen = null;
  act(() => root.unmount());
  container.remove();
});

async function haengeBildAn(): Promise<void> {
  // Die Bilder stehen in den erweiterten Feldern (SCRUM-375: standardmäßig eingeklappt).
  const titel = i18n.t(ADVANCED_FIELDS_KEYS.title);
  const aufklapper = [...container.querySelectorAll("button[aria-expanded]")].find((b) =>
    (b.textContent ?? "").includes(titel),
  );
  if (aufklapper?.getAttribute("aria-expanded") === "false") {
    await klicke(aufklapper as HTMLButtonElement);
  }
  const input = container.querySelector<HTMLInputElement>('input[type="file"][accept="image/*"]');
  if (!input) {
    throw new Error("Kein Bild-Eingang auf der Erfassungsseite");
  }
  const bild = new File([new Uint8Array(64)], "aushang.png", { type: "image/png" });
  Object.defineProperty(input, "files", { value: [bild], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

function knopf(beschriftung: string): HTMLButtonElement {
  // Genaue Gleichheit: „OCR → Text“ soll keinen anderen Knopf treffen, der „OCR“ nur enthält.
  const passt = (x: HTMLButtonElement): boolean => (x.textContent ?? "").trim() === beschriftung;
  const b = [...container.querySelectorAll("button")].find(passt);
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

describe("gesamt-ocr · FR-CAP-05 · erkannter Bildtext als Kontext des geführten Interviews", () => {
  it("I1 · nach dem Klick auf die Erkennung trägt der Interview-Aufruf den erkannten Text", async () => {
    steuerung.ocr.mockResolvedValue({ status: "success", text: ERKANNT });
    await haengeBildAn();
    // Das Anhängen allein erkennt nichts.
    expect(steuerung.ocr).not.toHaveBeenCalled();
    await klicke(knopf(i18n.t("capture.ocr")));
    expect(steuerung.ocr).toHaveBeenCalledTimes(1);

    await waehleModus("interview");
    // Der Moduswechsel allein sendet nichts (E2E-008).
    expect(steuerung.interview).not.toHaveBeenCalled();
    await klicke(knopf(i18n.t("capture.ivStart")));

    expect(steuerung.interview).toHaveBeenCalledTimes(1);
    const kontext = steuerung.interview.mock.calls[0]?.[3];
    expect(typeof kontext).toBe("string");
    expect(kontext as string).toContain(ERKANNT);
    expect(kontext as string).toContain("aushang.png");
  });

  it("I2 · Gegenprobe: ohne Klick auf die Erkennung reist kein Bildtext ins Interview", async () => {
    await haengeBildAn();
    await waehleModus("interview");
    await klicke(knopf(i18n.t("capture.ivStart")));

    expect(steuerung.ocr).not.toHaveBeenCalled();
    expect(steuerung.interview).toHaveBeenCalledTimes(1);
    expect(steuerung.interview.mock.calls[0]?.[3] ?? "").toBe("");
  });
});
