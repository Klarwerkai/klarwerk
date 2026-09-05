// @vitest-environment jsdom
// AUFTRAG-mega1 Block E (E2E-008): Das geführte Interview startet den Cloud-ModelRun ERST nach einer
// bewussten Aktion. Gemountet an der ECHTEN CaptureArbeitsraum-Seite:
//  - Tab „Geführtes Interview" öffnen → KEIN endpoints.reasoner.interview-Aufruf (kein ModelRun).
//  - Erst der Klick auf „Interview starten" löst genau EINEN Lauf aus.
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
        status: ok({ active: true, mode: "cloud", reachable: "active" }),
        config: ok(null),
        structure: vi.fn(async () => ({})),
        interview: vi.fn(async () => ({ question: "Was war die Ausgangslage?", done: false })),
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
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureArbeitsraum } from "../../apps/web/src/pages/Capture";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom kennt scrollIntoView/scrollTo nicht — die Seite ruft sie in setTimeout auf. Stubben, damit
// kein „unhandled error" nach dem Test entsteht.
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const interviewMock = endpoints.reasoner.interview as unknown as ReturnType<typeof vi.fn>;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
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

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  h3Modus = undefined;
  h3Zeichnen = null;
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block E: geführtes Interview startet Cloud-KI erst nach bewusster Aktion", () => {
  it("Tab öffnen löst KEINEN ModelRun aus; erst „Interview starten“ ruft reasoner.interview", async () => {
    await mount();
    // Arbeitsraum aufklappen (Erzähl-Modi + Schritt-Leiste werden sichtbar).
    // JOB 3062 · H3: Der Aufklapper „Weitere Wege anzeigen“ ist mit dem
    // Standardweg-Kasten gelöscht — der Arbeitsraum ist jetzt eine Ansicht
    // des Blattes und startet offen.
    // Zum Interview-Tab wechseln — DARF noch keinen Lauf auslösen.
    await waehleModus("interview");
    expect(interviewMock).not.toHaveBeenCalled();
    // Der bewusste Start-Knopf ist da; Klick löst genau EINEN Lauf aus.
    await click(buttonByText(i18n.t("capture.ivStart")));
    expect(interviewMock).toHaveBeenCalledTimes(1);
  });
});
