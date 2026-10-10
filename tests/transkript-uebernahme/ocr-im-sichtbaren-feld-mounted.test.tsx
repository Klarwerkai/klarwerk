// @vitest-environment jsdom
// ================================================================================================
// R-1688/R-1733 (Bens Befund 10.10., Nacharbeit 2) — „OCR übernommen" HEISST: ES STEHT IM FELD.
// ================================================================================================
//
// Bens Hilfsprobe (HILFE/985770a2544fccd85698/ocr-uebernahme-mounted.test.tsx) hat am Kandidaten
// abeb478d gemessen: 6 Fälle, die beiden Formularfälle rot — Erfolgsmeldung, aber die sichtbare
// Aussage blieb leer bzw. unverändert, weil `onOcr` nur in den Rohtext schrieb. Diese Datei ist
// dieselbe Probe im Produktbaum: dieselben Fälle und Sollwerte, relative Pfade, harte Erwartungen.
//
// Was sie ist: die montierte Originaloberfläche mit injiziertem OCR-Ergebnis (`runImageOcr`). Was
// sie nicht ist: eine Abnahme der echten OCR-Engine (die prüft tests/capture/ocr-extract.test.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ocr = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("../../apps/web/src/lib/files", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../apps/web/src/lib/files")>();
  return {
    ...original,
    runImageOcr: ocr.run,
    fileToThumbDataUrl: vi.fn(async () => {
      throw new Error("synthetic-thumbnail-fallback");
    }),
  };
});
const BILD =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    validation: { settings: ok({ defaultNeededValidations: 3 }) },
    external: { policy: vi.fn(async () => ({ stage: "off" })), search: vi.fn(async () => []) },
    uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
    directory: { list: arrFn() },
    gaps: { list: arrFn() },
    drafts: {
      list: arrFn(),
      get: vi.fn(async () => ({ id: "d1", payload: {} })),
      create: vi.fn(async () => ({ id: "d1" })),
      update: vi.fn(async () => ({})),
      remove: vi.fn(async () => {}),
      promote: vi.fn(async () => ({ id: "ko-1", title: "egal" })),
    },
    reasoner: {
      status: ok({ active: true, mode: "cloud", reachable: "active" }),
      config: ok(null),
      structure: vi.fn(async () => ({})),
      interview: vi.fn(async () => ({ question: "", done: true, demo: false })),
      assist: vi.fn(async () => ({ text: "" })),
      describeImage: vi.fn(async () => ({ text: "", demo: false })),
    },
    objects: { upload: vi.fn(async () => ({ id: "obj-1" })) },
    media: { analyze: vi.fn() },
    notifications: { list: arrFn(), markSeen: vi.fn(async () => ({})) },
  };
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => arrFn() });
    },
  });
  return { endpoints };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { mitOcrText } from "../../apps/web/src/lib/transkriptUebernahme";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const DATEI = "kuenstliche-pruefkarte.png";
const ERKANNT = "Vor der Wartung Ventil V2 schließen und den Druck ablassen.";
const BLOCK = `[OCR: ${DATEI}]\n${ERKANNT}`;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(modus: "formular" | "freitext"): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Wie in tests/transkript-uebernahme/transkript-im-sichtbaren-feld-mounted.test.tsx: ohne
  // `modus` Freitext, das Formular mit `modus` wie aus dem Menü „Datei ▾".
  const arbeitsraum =
    modus === "formular"
      ? createElement(CaptureArbeitsraum, { modus: "formular" })
      : createElement(CaptureArbeitsraum);
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
                MemoryRouter,
                { initialEntries: ["/erfassen"] },
                createElement(
                  ImageDescribeProvider,
                  null,
                  createElement(
                    NavGuardProvider,
                    null,
                    createElement(
                      Routes,
                      null,
                      createElement(Route, { path: "/erfassen", element: arbeitsraum }),
                    ),
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
  await act(flush);
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function knopf(teil: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(teil),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${teil}" nicht gefunden`);
  }
  return btn;
}

async function klick(btn: HTMLElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

async function tippe(el: HTMLTextAreaElement, wert: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el) as object, "value")?.set;
  setter?.call(el, wert);
  await act(async () => {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
}

/** Das Formularfeld „Aussage" — an seiner sichtbaren Beschriftung gefunden. */
function aussage(): HTMLTextAreaElement {
  const label = [...container.querySelectorAll("label")].find(
    (l) => l.querySelector("span")?.textContent?.trim() === i18n.t("capture.fStatement"),
  );
  const feld = label?.querySelector("textarea");
  if (!(feld instanceof HTMLTextAreaElement)) {
    throw new Error("Feld „Aussage“ nicht gefunden");
  }
  return feld;
}

/** Das Schreibfeld des Freitexts — an seinem Platzhalter gefunden. */
function rohtext(): HTMLTextAreaElement {
  const feld = [...container.querySelectorAll("textarea")].find(
    (x) => x.getAttribute("placeholder") === i18n.t("capture.rawPlaceholder"),
  );
  if (!(feld instanceof HTMLTextAreaElement)) {
    throw new Error("Freitextfeld nicht gefunden");
  }
  return feld;
}

/** „Erweiterte Details" öffnen, Bild über „Bilder hochladen" geben, OCR-Knopf klicken. */
async function erkenne(): Promise<void> {
  const details = knopf(i18n.t("capture.advanced.title"));
  if (details.getAttribute("aria-expanded") !== "true") {
    await klick(details);
  }
  const label = [...container.querySelectorAll("label")].find((l) =>
    (l.textContent ?? "").includes(i18n.t("capture.imagesUpload")),
  );
  const eingabe = label?.querySelector('input[type="file"]');
  if (!(eingabe instanceof HTMLInputElement)) {
    throw new Error("Eingang „Bilder hochladen“ nicht gefunden");
  }
  const datei = new File([Uint8Array.from(atob(BILD), (v) => v.charCodeAt(0))], DATEI, {
    type: "image/png",
  });
  Object.defineProperty(eingabe, "files", { configurable: true, value: [datei] });
  await act(async () => {
    eingabe.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await klick(knopf(i18n.t("capture.ocr")));
}

const erfolg = (): string => i18n.t("capture.ocrDone", { name: DATEI });

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  ocr.run.mockResolvedValue({ status: "success", text: ERKANNT });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

for (const modus of ["formular", "freitext"] as const) {
  describe(`R-1688/R-1733 · OCR-Übernahme im ${modus}`, () => {
    for (const vorher of ["", "Bestehende synthetische Notiz"]) {
      it(`Text und Quellenname sichtbar übernehmen; vorher=${JSON.stringify(vorher)}`, async () => {
        await mount(modus);
        const feld = modus === "formular" ? aussage : rohtext;
        if (vorher) {
          await tippe(feld(), vorher);
        }
        await erkenne();
        expect(ocr.run).toHaveBeenCalledTimes(1);
        expect(feld().value).toBe(vorher ? `${vorher}\n\n${BLOCK}` : BLOCK);
        expect(text()).toContain(erfolg());
      });
    }

    it("nicht verfügbare OCR erhält den sichtbaren Inhalt ohne Erfolgsmeldung", async () => {
      ocr.run.mockResolvedValue({ status: "unavailable", text: "" });
      await mount(modus);
      const feld = modus === "formular" ? aussage : rohtext;
      await tippe(feld(), "Erhaltener synthetischer Inhalt");
      await erkenne();
      expect(ocr.run).toHaveBeenCalledTimes(1);
      expect(feld().value).toBe("Erhaltener synthetischer Inhalt");
      expect(text()).not.toContain(erfolg());
      expect(text()).toContain(i18n.t("capture.ocrUnavailable"));
    });
  });
}

describe("R-1688/R-1733 · der OCR-Vermerk", () => {
  it("leeres Feld beginnt mit dem Vermerk, vorhandener Text bleibt davor stehen", () => {
    expect(mitOcrText("", DATEI, ERKANNT)).toBe(BLOCK);
    expect(mitOcrText("Notiz", DATEI, ERKANNT)).toBe(`Notiz\n\n${BLOCK}`);
  });
});
