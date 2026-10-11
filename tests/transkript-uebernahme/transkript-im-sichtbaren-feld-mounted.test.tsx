// @vitest-environment jsdom
// ================================================================================================
// R-0165 (Bens Befund 10.10.) — „TRANSKRIPT ÜBERNOMMEN" HEISST: ES STEHT IM FELD, DAS MAN SIEHT.
// ================================================================================================
//
// DER BEFUND, mit echtem Anbieter gemessen: nach einer erfolgreichen WAV-Transkription meldete das
// Erfassen „Transkript von … übernommen", das Formularfeld „Aussage" blieb aber leer. `onTranscribe`
// schrieb ausschließlich in den Rohtext; das Formular zeigt `draft.statement`.
//
// DIESE PROBE baut den Weg so, wie ein Mensch ihn geht: Audiodatei über „Dateien hochladen" in der
// Karte „Dokumente", Klick auf „Transkribieren", dann wird das SICHTBARE Feld gelesen — im Formular
// die Aussage, im Freitext das Schreibfeld. Je Modus einmal leer und einmal mit vorhandenem Text,
// dazu die Gegenprobe ohne Dienst: dann wird nichts übernommen und auch nichts als übernommen
// gemeldet. Der Anbieter selbst ist hier eine Attrappe; die Probe gilt der Übernahme im Client.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const medien = vi.hoisted(() => ({
  analyze: vi.fn(),
  upload: vi.fn(async () => ({ id: "obj-1" })),
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
    objects: { upload: medien.upload },
    media: { analyze: medien.analyze },
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
import { mitTranskript, transkriptZiel } from "../../apps/web/src/lib/transkriptUebernahme";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const DATEI = "aufnahme.wav";
const TRANSKRIPT = "Vor der Wartung Ventil V2 schließen und den Druck ablassen.";
const BLOCK = `[Transkript: ${DATEI}]\n${TRANSKRIPT}`;

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
  // Ohne `modus` öffnet der Arbeitsraum im Freitext (so mountet ihn auch
  // tests/capture/draft-clear-cycle-mounted.test.tsx); das Formular setzt `modus` wie das Menü
  // „Datei ▾" des Blattes (tests/capture/dateizusage-mounted.test.tsx).
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

/** „Erweiterte Details" öffnen, die WAV über „Dateien hochladen" geben, „Transkribieren" klicken. */
async function transkribiere(): Promise<void> {
  const details = knopf(i18n.t("capture.advanced.title"));
  if (details.getAttribute("aria-expanded") !== "true") {
    await klick(details);
  }
  const label = [...container.querySelectorAll("label")].find((l) =>
    (l.textContent ?? "").includes(i18n.t("capture.documentsUpload")),
  );
  const eingabe = label?.querySelector('input[type="file"]');
  if (!(eingabe instanceof HTMLInputElement)) {
    throw new Error("Eingang „Dateien hochladen“ nicht gefunden");
  }
  const datei = new File([new Uint8Array([82, 73, 70, 70])], DATEI, { type: "audio/wav" });
  Object.defineProperty(eingabe, "files", { configurable: true, value: [datei] });
  await act(async () => {
    eingabe.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await klick(knopf(i18n.t("capture.videoTranscribe")));
}

const erfolg = (): string => i18n.t("capture.videoDone", { name: DATEI });

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  medien.analyze.mockResolvedValue({ engineActive: true, transcript: TRANSKRIPT, note: "" });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("R-0165 · Transkript im sichtbaren Feld — Formular", () => {
  it("F1 · leere Aussage: das Transkript steht mit Quellname darin, erst dann die Erfolgsmeldung", async () => {
    await mount("formular");
    expect(aussage().value).toBe("");
    await transkribiere();
    expect(medien.analyze).toHaveBeenCalledTimes(1);
    expect(aussage().value).toBe(BLOCK);
    expect(text()).toContain(erfolg());
  });

  it("F2 · vorhandene Aussage bleibt Zeichen für Zeichen stehen, das Transkript kommt dahinter", async () => {
    await mount("formular");
    await tippe(aussage(), "Bestehende Aussage zur Wartung");
    await transkribiere();
    expect(aussage().value).toBe(`Bestehende Aussage zur Wartung\n\n${BLOCK}`);
    expect(text()).toContain(erfolg());
  });

  it("F3 · GEGENPROBE ohne Dienst: Aussage unverändert, keine Erfolgsmeldung, der Hinweis steht da", async () => {
    medien.analyze.mockResolvedValue({
      engineActive: false,
      transcript: "",
      note: "Kein Transkriptionsdienst hinterlegt.",
    });
    await mount("formular");
    await tippe(aussage(), "Bleibt wie sie ist");
    await transkribiere();
    expect(aussage().value).toBe("Bleibt wie sie ist");
    expect(text()).not.toContain(erfolg());
    expect(text()).toContain("Kein Transkriptionsdienst hinterlegt.");
  });
});

describe("R-0165 · Transkript im sichtbaren Feld — Freitext", () => {
  it("R1 · leerer Freitext: das Transkript steht mit Quellname im Schreibfeld", async () => {
    await mount("freitext");
    expect(rohtext().value).toBe("");
    await transkribiere();
    expect(rohtext().value).toBe(BLOCK);
    expect(text()).toContain(erfolg());
  });

  it("R2 · vorhandener Freitext bleibt stehen, das Transkript kommt dahinter", async () => {
    await mount("freitext");
    await tippe(rohtext(), "Meine Notiz zur Anlage");
    await transkribiere();
    expect(rohtext().value).toBe(`Meine Notiz zur Anlage\n\n${BLOCK}`);
    expect(text()).toContain(erfolg());
  });
});

describe("R-0165 · die Regel an einer Stelle", () => {
  it("Formular → Aussage, jeder Erzählmodus → Rohtext", () => {
    expect(transkriptZiel("formular")).toBe("aussage");
    for (const m of ["freitext", "diktat", "interview", "datei"] as const) {
      expect(transkriptZiel(m), m).toBe("rohtext");
    }
  });

  it("anhängen erhält den vorhandenen Text; ein leeres Feld beginnt mit dem Quellvermerk", () => {
    expect(mitTranskript("", DATEI, TRANSKRIPT)).toBe(BLOCK);
    expect(mitTranskript("Text", DATEI, TRANSKRIPT)).toBe(`Text\n\n${BLOCK}`);
  });
});
