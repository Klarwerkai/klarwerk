// Additive Bühne nach JOB 3196; der Bestand bleibt bytegleich.
import { afterAll, afterEach, beforeEach, expect, vi } from "vitest";

const draftSteuerung = vi.hoisted(() => ({
  wert: "d-42" as string | null,
  halten: false,
  loesen: null as null | (() => void),
}));

/**
 * JOB 3196 R2 — DIE BREMSE FÜR DAS EINLESEN.
 *
 * bens erste Gegenprobe braucht einen Zustand, den ein `.txt` von 240 Zeichen nie erreicht: eine
 * Extraktion, die LÄUFT, während der Mensch die Importart wechselt. Im Betrieb ist das der
 * Regelfall bei PDF, PPTX und grossen DOCX — dort vergehen Sekunden. Statt eine solche Datei
 * nachzubauen (und damit halb den Extraktor zu testen), wird der EINE Lesevorgang angehalten:
 * `readTextFile` ist die Stelle, an der `onExtractFile` auf die Datei wartet.
 *
 * Standardmässig ist die Bremse offen — alle übrigen Fälle laufen unverändert durch.
 */
const leseSteuerung = vi.hoisted(() => ({
  aktiv: false,
  fehler: false,
  loesen: null as null | (() => void),
}));

vi.mock("../../apps/web/src/lib/files", async (importActual) => {
  const echt = await importActual<typeof import("../../apps/web/src/lib/files")>();
  return {
    ...echt,
    readTextFile: async (f: File): Promise<string> => {
      if (leseSteuerung.aktiv) {
        await new Promise<void>((auf) => {
          leseSteuerung.loesen = auf;
        });
      }
      if (leseSteuerung.fehler) throw new Error("JOB3379 Lesefehler");
      return echt.readTextFile(f);
    },
  };
});

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
      external: {
        policy: vi.fn(async () => ({ stage: "search_on_click" })),
        search: vi.fn(async () => []),
      },
      uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
      directory: { list: ok([]) },
      gaps: { list: ok([]) },
      objects: {
        upload: vi.fn(async () => ({ id: "obj-1", name: "NUTZERPRUEFUNG.txt" })),
      },
      drafts: {
        list: ok([]),
        // Die Antwort hat die Form, die `draftTitle` (lib/draftForm.ts:41) liest: Titel im `payload`.
        create: vi.fn(async (payload: { title?: string; bodyHtml?: string }) => {
          if (draftSteuerung.halten)
            await new Promise<void>((resolve) => {
              draftSteuerung.loesen = resolve;
            });
          return {
            ...(draftSteuerung.wert === null ? {} : { id: draftSteuerung.wert }),
            payload: { title: payload.title ?? "NUTZERPRUEFUNG.txt", bodyHtml: payload.bodyHtml },
          };
        }),
        update: vi.fn(async () => ({})),
        remove: vi.fn(async () => {}),
        promote: vi.fn(async () => ({})),
      },
      reasoner: {
        status: ok({ active: false, mode: "cloud", reachable: "inactive" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        interview: vi.fn(async () => ({ question: "", done: true, demo: false })),
      },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { endpoints as gemockteEndpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};
// jsdom kennt `crypto.randomUUID` nicht (kein sicherer Kontext) — dieselbe Bühnen-Lücke, die
// `tests/design/h3-blatt-buehne.ts:41-43` beschreibt. Die Erfolgsmeldung des Speicherwegs
// (`app/ToastContext.tsx:36`) ruft sie; ohne diesen Ersatz stürbe JEDER Schreibweg an der Bühne,
// nicht am Produkt.
if (typeof (globalThis.crypto as { randomUUID?: unknown } | undefined)?.randomUUID !== "function") {
  let n = 0;
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    configurable: true,
    value: () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  });
}

export let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

export const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

export async function mount(): Promise<void> {
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
                      // Genau der Weg, den das Blatt geht: es öffnet den Arbeitsraum im Modus
                      // „Aus Datei“ (JOB 3062 · H3).
                      element: createElement(CaptureArbeitsraum, { modus: "datei" }),
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
  await act(flush);
}

// DOM-Reste einschließlich aria-hidden: Abwesenheit beweist auch Zustandsräumung.
export function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}
// Für positive Sprachbehauptungen nur nicht verborgene Textknoten. jsdom misst keine Geometrie.
export function sichtbar(): string {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const teile: string[] = [];
  while (walker.nextNode()) {
    if (!walker.currentNode.parentElement?.closest('[aria-hidden="true"], [hidden], .hidden')) {
      teile.push(walker.currentNode.textContent ?? "");
    }
  }
  return teile.join(" ").replace(/\s+/g, " ").trim();
}
const nebenfehler: string[] = [];
export async function fehlerpin(befund: string, messen: () => Promise<boolean>): Promise<void> {
  try {
    if (await messen()) throw new Error(befund);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== befund) nebenfehler.push(String(error));
    throw error;
  }
}
export async function englisch(): Promise<void> {
  await act(async () => {
    await i18n.changeLanguage("en");
    await flush();
  });
}

export function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}“ nicht gefunden`);
  }
  return btn;
}

/** Die Auswahlkarte einer Importart — eine echte `aria-pressed`-Fläche (ChoiceCards). */
export function modusKarte(labelKey: string): HTMLButtonElement {
  const label = i18n.t(labelKey);
  const btn = [...container.querySelectorAll<HTMLButtonElement>("button[aria-pressed]")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(label),
  );
  if (!btn) {
    throw new Error(`Importart-Karte „${label}“ nicht gefunden`);
  }
  return btn;
}

export async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    // React verarbeitet den echten DOM-Ereignispfad; kein direkter Handleraufruf.
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }));
    }
    await flush();
  });
}

/** Datei über die bestehende Ablagefläche einlesen — derselbe Seam wie der versteckte Eingang. */
export async function dateiEinlesen(
  name = "NUTZERPRUEFUNG.txt",
  inhalt = "A".repeat(240),
): Promise<void> {
  const zone = container.querySelector<HTMLElement>("[data-testid=capture-dropzone]");
  if (!zone) {
    throw new Error("Ablagefläche nicht gefunden");
  }
  const file = new File([inhalt], name, {
    type: name.endsWith(".bin") ? "application/octet-stream" : "text/plain",
  });
  const ev = new Event("drop", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "dataTransfer", { value: { files: [file] } });
  await act(async () => {
    zone.dispatchEvent(ev);
    await flush();
  });
}

export function txt(key: string, params?: Record<string, unknown>): string {
  return String(i18n.t(key, params ?? {})).replace(/\s+/g, " ");
}

/** Startet das Einlesen, OHNE auf sein Ende zu warten — die Bremse hält es an. */
export async function dateiEinlesenStarten(name = "NUTZERPRUEFUNG.txt", inhalt = "A".repeat(240)) {
  leseSteuerung.aktiv = true;
  leseSteuerung.loesen = null;
  await dateiEinlesen(name, inhalt);
  if (leseSteuerung.loesen === null) {
    throw new Error("Die Bremse hat nicht gegriffen — das Einlesen war schon fertig.");
  }
}

/** Lässt das angehaltene Einlesen zu Ende laufen. */
export async function dateiEinlesenBeenden(): Promise<void> {
  const loesen = leseSteuerung.loesen;
  leseSteuerung.aktiv = false;
  leseSteuerung.loesen = null;
  await act(async () => {
    loesen?.();
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  draftSteuerung.wert = "d-42";
  draftSteuerung.halten = false;
  draftSteuerung.loesen = null;
  leseSteuerung.aktiv = false;
  leseSteuerung.fehler = false;
  leseSteuerung.loesen = null;
});

afterEach(() => {
  if (root && container?.isConnected) act(() => root.unmount());
  container?.remove();
  vi.clearAllMocks();
  leseSteuerung.aktiv = false;
  leseSteuerung.fehler = false;
  leseSteuerung.loesen = null;
});

export const endpoints = gemockteEndpoints;
export const draftId = draftSteuerung;
export const bremse = leseSteuerung;

// Vitest 2 zählt auch afterEach-Fehler zu it.fails. Die gesammelten Fremdfehler müssen
// deshalb AUẞERHALB aller Einzelfälle scheitern (Nebenfehlersicherung JOB 3299 R3).
afterAll(() => {
  expect(nebenfehler, "Abbruch außerhalb des gepinnten BEFUNDs").toEqual([]);
});
