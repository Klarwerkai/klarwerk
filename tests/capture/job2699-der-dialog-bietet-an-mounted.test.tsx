// @vitest-environment jsdom
// ================================================================================================
// JOB 2699 D1 — DER DIALOG BIETET AN, WAS DAS PROGRAMM ABLEHNT (Befund R2-27) — an der Seite
// ================================================================================================
//
// Gemountet an der ECHTEN CaptureArbeitsraum-Seite (Gerueste wie discard-reset-mounted). Gemessen wird an den
// Datei-Eingaengen, die der Mensch benutzt: was der Dialog „Text aus Datei einfuegen" anbietet, was
// er bei einer gewaehlten Datei tut — und dass der Anhang-Dialog daneben unveraendert bleibt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
        interview: vi.fn(async () => ({ question: "", done: true })),
        extract: vi.fn(async () => ({ points: [], note: null })),
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
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import {
  FILE_CAPTURE_ACCEPT,
  FILE_TEXT_INSERT_ACCEPT,
} from "../../apps/web/src/lib/captureFromFile";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

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
                      element: createElement(CaptureArbeitsraum),
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

beforeEach(async () => {
  await i18n.changeLanguage("de");
  (globalThis as unknown as { fetch: unknown }).fetch = vi.fn();
  await mount();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Der Datei-Eingang HINTER einem Knopf-Text — ueber das Label, wie der Mensch ihn findet. */
function eingang(labelText: string): HTMLInputElement {
  const label = [...container.querySelectorAll("label")].find((l) =>
    (l.textContent ?? "").includes(labelText),
  );
  const input = label?.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) {
    throw new Error(`Kein Datei-Eingang hinter „${labelText}“`);
  }
  return input;
}

async function waehle(input: HTMLInputElement, datei: File): Promise<void> {
  Object.defineProperty(input, "files", { value: [datei], configurable: true });
  await act(async () => {
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

function text(): string {
  return container.textContent ?? "";
}

describe("JOB 2699 D1 · am Dateidialog der Erfassung", () => {
  it("D1 · „Text aus Datei einfuegen“ bietet .pptx nicht mehr an; „beifuegen“ daneben weiterhin", () => {
    const einfuegen = eingang(i18n.t("capture.wizard.upload"));
    const beifuegen = eingang(i18n.t("capture.wizard.attach"));
    expect(einfuegen.accept).toBe(FILE_TEXT_INSERT_ACCEPT);
    expect(einfuegen.accept).not.toContain(".pptx");
    expect(einfuegen.accept).not.toContain(PPTX_MIME);
    expect(beifuegen.accept).toBe(FILE_CAPTURE_ACCEPT);
    expect(beifuegen.accept).toContain(".pptx");
  });

  it("D2 · die Art, die durchgeht: eine .txt wird gelesen und steht als Kontext im Freitext", async () => {
    const einfuegen = eingang(i18n.t("capture.wizard.upload"));
    await waehle(
      einfuegen,
      new File(["Das Ventil DP-4 klemmt nach dem Wochenende."], "notiz.txt", {
        type: "text/plain",
      }),
    );
    expect(text()).toContain(i18n.t("capture.docAdded", { name: "notiz.txt" }));
    const felder = [...container.querySelectorAll("textarea")].map((t) => t.value);
    expect(felder.some((v) => v.includes("[notiz.txt]") && v.includes("Ventil DP-4"))).toBe(true);
  });

  it("D3 · eine Datei wird an ihrem Inhalt erkannt: .pptx als text/plain wird NICHT als Text gelesen — „nicht unterstuetzt“", async () => {
    const einfuegen = eingang(i18n.t("capture.wizard.upload"));
    await waehle(einfuegen, new File(["PK kein Text"], "folien.pptx", { type: "text/plain" }));
    expect(text()).toContain(i18n.t("capture.docUnsupported", { name: "folien.pptx" }));
    const felder = [...container.querySelectorAll("textarea")].map((t) => t.value);
    expect(felder.some((v) => v.includes("[folien.pptx]"))).toBe(false);
  });

  it("D4 · dieselbe .pptx ueber „beifuegen“ wird als Anhang angenommen — der Weg, der sie kann", async () => {
    const beifuegen = eingang(i18n.t("capture.wizard.attach"));
    await waehle(beifuegen, new File(["PK"], "folien.pptx", { type: PPTX_MIME }));
    expect(text()).not.toContain(i18n.t("capture.docUnsupported", { name: "folien.pptx" }));
    // Der Anhang ist da — die Seite meldet ihn; der Dateiname selbst liegt in den zugeklappten
    // „Erweiterten Details".
    expect(text()).toContain(i18n.t("capture.wizard.attached", { count: 1 }));
  });
});
