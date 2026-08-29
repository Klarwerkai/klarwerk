// @vitest-environment jsdom
// ================================================================================================
// JOB 2700 D1 — DAS HANDBUCH, DAS DEN TAB EINFRIERT: an der Stelle, wo Pedi handelt
// ================================================================================================
//
// Gemountet an der ECHTEN Capture-Seite (Geruest wie discard-reset-mounted). Pedi waehlt ein
// gescanntes Handbuch ueber der Kante — an BEIDEN Eingaengen, die eine PDF lesen: „Text aus Datei
// einfuegen" (onDocs) und der Datei-Import (CaptureFileImport). Erwartet: kein Parser, kein
// stehenbleibendes „wird gelesen", sondern die Meldung, dass es zu gross ist — mit Zahlen.
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
import { CAPTURE_FILE_TEXT, FILE_IMPORT_ACCEPT } from "../../apps/web/src/lib/captureFromFile";
import { Capture } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// Die Kante bei 20 MB Uebertragungsgrenze: 14.999.928 Rohbytes. Das Handbuch liegt knapp darueber —
// gross genug fuer die Kante, klein genug fuer den Testprozess (kein 50-MB-Puffer noetig: die Kante
// prueft `file.size`, bevor irgendetwas gelesen wird).
const KANTE = 14_999_928;
const HANDBUCH_BYTES = KANTE + 1;

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
                    createElement(Route, { path: "/erfassen", element: createElement(Capture) }),
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

function eingangHinter(labelText: string): HTMLInputElement {
  const label = [...container.querySelectorAll("label")].find((l) =>
    (l.textContent ?? "").includes(labelText),
  );
  const input = label?.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) {
    throw new Error(`Kein Datei-Eingang hinter „${labelText}“`);
  }
  return input;
}

function buttonByText(part: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(part),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${part}“ nicht gefunden`);
  }
  return btn;
}

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
    await flush();
  });
}

/** Der Hauptweg: Modus „Aus Datei" oeffnen — dann steht der Import-Eingang mit FILE_IMPORT_ACCEPT da. */
async function importEingang(): Promise<HTMLInputElement> {
  await click(buttonByText("Weitere Wege anzeigen"));
  await click(buttonByText(i18n.t("capture.mode.datei")));
  const input = container.querySelector<HTMLInputElement>(
    `input[type="file"][accept="${FILE_IMPORT_ACCEPT}"]`,
  );
  if (!input) {
    throw new Error("Kein Datei-Import-Eingang (FILE_IMPORT_ACCEPT) im Modus „Aus Datei“");
  }
  return input;
}

/** Das Handbuch: die Groesse zaehlt, der Inhalt nicht — ein Blob dieser Laenge. */
function handbuch(bytes = HANDBUCH_BYTES): File {
  return new File([new Uint8Array(bytes)], "BAADER-Handbuch-gescannt.pdf", {
    type: "application/pdf",
  });
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

const MELDUNG = () =>
  i18n.t("capture.file.pdfTooLarge", {
    name: "BAADER-Handbuch-gescannt.pdf",
    mb: (HANDBUCH_BYTES / 1_000_000).toFixed(1),
    limitMb: "14.9",
  });

describe("JOB 2700 D1 · Pedi waehlt ein gescanntes Handbuch ueber der Kante", () => {
  it("H1 · ueber „Text aus Datei einfuegen“: sofort „zu gross“ mit Zahlen — kein stehenbleibendes „wird gelesen“", async () => {
    const t0 = Date.now();
    await waehle(eingangHinter(i18n.t("capture.wizard.upload")), handbuch());
    expect(Date.now() - t0).toBeLessThan(3_000);
    expect(text()).toContain(MELDUNG());
    expect(text()).toContain("15.0 MB");
    expect(text()).toContain("14.9 MB");
    expect(text()).not.toContain(
      i18n.t("capture.docExtracting", { name: "BAADER-Handbuch-gescannt.pdf" }),
    );
    expect(text()).not.toContain(
      i18n.t("capture.docParseError", { name: "BAADER-Handbuch-gescannt.pdf" }),
    );
  });

  it("H2 · ueber den Datei-Import (Hauptweg): dieselbe Meldung, das Original bleibt unberuehrt, nichts haengt", async () => {
    await waehle(await importEingang(), handbuch());
    expect(text()).toContain(MELDUNG());
    // Die „wird gelesen"-Notiz des Hauptwegs (CAPTURE_FILE_TEXT.extracting) ist weg, nicht haengend.
    expect(text()).not.toContain(
      i18n.t(CAPTURE_FILE_TEXT.extracting, { name: "BAADER-Handbuch-gescannt.pdf" }),
    );
    expect(text()).not.toContain(
      i18n.t("capture.file.parseError", { name: "BAADER-Handbuch-gescannt.pdf" }),
    );
    // Der Import-Knopf ist wieder frei — kein haengender Lesezustand.
    const busy = [...container.querySelectorAll("[aria-busy='true']")];
    expect(busy).toHaveLength(0);
  });

  it("H3 · Gegenprobe: eine kleine PDF loest die Kante NICHT aus — sie geht weiter zum Parser", async () => {
    // Ohne pdfjs im Test: der Parser scheitert danach ehrlich (Stale-Bundle-/Parse-Meldung), aber die
    // Kante hat NICHT gemeldet. Was hier gemessen wird, ist die Kante, nicht der Parser.
    await waehle(eingangHinter(i18n.t("capture.wizard.upload")), handbuch(1_024));
    expect(text()).not.toContain("zu groß für den Import");
  });
});
