// @vitest-environment jsdom
// ================================================================================================
// JOB 2687 · D1 — ZU LANG IST NICHT KAPUTT: gemessen an der Erfassen-Fläche.
// ================================================================================================
//
// Pedi importiert ein Deck mit Folien als Bilder. Antwortet der Server 422 (zu lang), liest er
// „Die Konvertierung dauerte zu lange …" und den Rat „kleineres Deck"; antwortet er 415 (kaputt),
// liest er „… beschädigt oder kein lesbares .pptx … andere Datei". Vorher stand in beiden Fällen
// „Die Folien konnten nicht in Bilder umgewandelt werden." — und der Mensch wusste nicht, was tun.
//
// Die echte CaptureArbeitsraum-Seite über die echte Dropzone, eine echte .pptx (fflate), der Folien-Schalter;
// nur der Konverter-Endpunkt ist gemockt und wirft die ECHTE `ApiError`-Form des Clients.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ablage = vi.hoisted(() => ({
  fehler: null as null | { status: number; code: string; message: string },
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pedi", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", async () => {
  const { ApiError } = await import("../../apps/web/src/api/client");
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: { settings: ok({ defaultNeededValidations: 3 }) },
      external: { policy: ok({ enabled: false }) },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      drafts: { list: ok([]), create: vi.fn(async () => ({ id: "d1" })) },
      slides: {
        availability: ok({ available: true }),
        convert: vi.fn(async () => {
          const f = ablage.fehler;
          if (f) {
            throw new ApiError(f.status, f.code, f.message);
          }
          return {
            slides: [],
            slideCount: 0,
            converted: 0,
            droppedOversize: 0,
            droppedByBudget: 0,
            truncated: false,
            truncatedByBudget: false,
            maxSlides: 30,
          };
        }),
      },
      reasoner: {
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        interview: vi.fn(async () => ({ question: "?", done: false })),
        extract: vi.fn(async () => ({ points: [], note: null })),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { zipSync } from "../../apps/web/node_modules/fflate";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { SLIDE_IMAGES_TEXT } from "../../apps/web/src/lib/slideImages";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

function pptxBytes(): Uint8Array {
  const slide = `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Quartalsziele</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  return zipSync({
    "[Content_Types].xml": enc("<Types/>"),
    "ppt/presentation.xml": enc(
      '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId1"/></p:sldIdLst></p:presentation>',
    ),
    "ppt/_rels/presentation.xml.rels": enc(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/></Relationships>',
    ),
    "ppt/slides/slide1.xml": enc(slide),
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// ==================================================================================================
// JOB 3062 · H3 — DER MODUS KOMMT ALS PROP, WEIL DIE MODUS-LEISTE GELÖSCHT IST.
// ==================================================================================================
// Bis hierher wählte dieser Test den Erzähl-Modus über die Knopfreihe auf `/erfassen`. Die Leiste
// ist mit dem Standardweg-Kasten gelöscht (Auftrag §5); im Produkt wählt der Mensch den Weg im
// Menü „Datei ▾" der Blatt-Werkzeugzeile, und das Blatt reicht ihn als `modus` an den Arbeitsraum.
// Der Test fährt GENAU DIESEN Weg: dieselbe Montage, neuer Prop — React behält den Zustand des
// Arbeitsraums, und `CaptureArbeitsraum` gleicht den Modus über `switchMode` ab (dieselbe Funktion,
// die vorher am Knopf hing).
let h3Modus: "freitext" | "diktat" | "interview" | "datei" | "formular" | undefined;
let h3Zeichnen: (() => Promise<void>) | null = null;

async function waehleModus(
  m: "freitext" | "diktat" | "interview" | "datei" | "formular",
): Promise<void> {
  h3Modus = m;
  if (!h3Zeichnen) {
    throw new Error("waehleModus vor mount() gerufen");
  }
  await h3Zeichnen();
}

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
                        element: createElement(CaptureArbeitsraum, { modus: h3Modus }),
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
  h3Zeichnen = zeichne;
  await zeichne();
  await act(flush);
}

async function warteBis(pruefung: () => boolean, runden = 60): Promise<void> {
  for (let i = 0; i < runden; i++) {
    if (pruefung()) return;
    await act(flush);
  }
}

/** Erfassen → Aus Datei → Folien als Bilder → echte .pptx über die echte Dropzone. */
async function importieren(): Promise<void> {
  await mount();
  // JOB 3062 · H3: Der Aufklapper „Weitere Wege anzeigen“ ist mit dem
  // Standardweg-Kasten gelöscht — der Arbeitsraum ist jetzt eine Ansicht
  // des Blattes und startet offen.
  await waehleModus("datei");
  const schalter = [
    ...container.querySelectorAll<HTMLInputElement>("label input[type=checkbox]"),
  ].find((el) =>
    (el.closest("label")?.textContent ?? "").includes(i18n.t(SLIDE_IMAGES_TEXT.toggle)),
  );
  expect(schalter, "Folien-Schalter nicht gefunden").toBeDefined();
  await act(async () => {
    (schalter as HTMLInputElement).click();
    await flush();
  });
  const zone = container.querySelector<HTMLElement>("[data-testid=capture-dropzone]");
  expect(zone).not.toBeNull();
  const bytes = pptxBytes().slice();
  const file = new File([bytes.buffer as ArrayBuffer], "quartal.pptx", { type: PPTX_MIME });
  const ev = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "dataTransfer", { value: { files: [file] } });
  await act(async () => {
    (zone as HTMLElement).dispatchEvent(ev);
    await flush();
  });
  await warteBis(() => (container.textContent ?? "").includes("quartal.pptx"));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  ablage.fehler = null;
});
afterEach(() => {
  h3Modus = undefined;
  h3Zeichnen = null;
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 2687 · die Erfassen-Fläche sagt, ob es zu lang war oder kaputt", () => {
  it("422 SLIDES_TIMEOUT → „Die Konvertierung dauerte zu lange …“ mit dem Rat „kleineres Deck“", async () => {
    ablage.fehler = { status: 422, code: "SLIDES_TIMEOUT", message: "vom Server" };
    await importieren();
    const text = container.textContent ?? "";
    expect(text).toContain(i18n.t(SLIDE_IMAGES_TEXT.serverTimeout));
    expect(text).toContain("dauerte zu lange");
    expect(text).toContain("kleineres Deck");
    expect(text).not.toContain(i18n.t(SLIDE_IMAGES_TEXT.failed));
    // Der Text-Import bleibt — der Dateiname steht, kein Fehlerzustand der Datei.
    expect(text).toContain("quartal.pptx");
  });

  it("415 SLIDES_INVALID → „… beschädigt oder kein lesbares .pptx … andere Datei“", async () => {
    ablage.fehler = { status: 415, code: "SLIDES_INVALID", message: "vom Server" };
    await importieren();
    const text = container.textContent ?? "";
    expect(text).toContain(i18n.t(SLIDE_IMAGES_TEXT.invalid));
    expect(text).toContain("andere Datei");
    expect(text).not.toContain("dauerte zu lange");
    expect(text).not.toContain(i18n.t(SLIDE_IMAGES_TEXT.failed));
  });

  it("GEGENPROBE: ein echter Serverfehler (500) sagt weiterhin „fehlgeschlagen“ — nichts erfunden", async () => {
    ablage.fehler = { status: 500, code: "SLIDES_FAILED", message: "vom Server" };
    await importieren();
    const text = container.textContent ?? "";
    expect(text).toContain(i18n.t(SLIDE_IMAGES_TEXT.failed));
    expect(text).not.toContain("dauerte zu lange");
    expect(text).not.toContain("andere Datei");
  });
});
