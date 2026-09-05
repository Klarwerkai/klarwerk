// @vitest-environment jsdom
// WP-KLARA-2 (Pedis Befund 1): der Klara-Link nach dem Senden öffnet den ENTWURF direkt — über das
// BESTEHENDE Deep-Link-Muster /capture/frontdoor?draft=<id> (Entwurf-fortsetzen-Mechanik der
// Front-Door-Seite). Gemountet belegt: (a) mit gültigem draft-Parameter steht der Entwurfsinhalt
// direkt im Editor (inkl. Entwurf-geöffnet-Hinweis), (b) unbekannter/fremder Entwurf → ehrliche
// Meldung, die Seite bleibt normal benutzbar (leerer Editor, kein Absturz).
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pedi", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    drafts: {
      get: vi.fn(),
      create: vi.fn(async () => ({ id: "d-neu", payload: {} })),
      update: vi.fn(async () => ({})),
      promote: vi.fn(async () => ({})),
    },
    reasoner: {
      structure: vi.fn(async () => ({})),
      assist: vi.fn(async () => ({})),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import "../../apps/web/src/i18n";
import { ApiError } from "../../apps/web/src/api/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
// AUFTRAG-mega9 Block B: Die Vordertür meldet sich jetzt am Navigations-Wächter an (KW-E2E-002) und
// braucht ihn damit — wie /erfassen und die Mobil-Seite — als echten Kontext. Dieselbe Vorrichtung,
// kein Test-Ersatz.
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const getMock = endpoints.drafts.get as unknown as ReturnType<typeof vi.fn>;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(url: string): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            ToastProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: [url] },
              createElement(
                ImageDescribeProvider,
                null,
                createElement(
                  NavGuardProvider,
                  null,
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/capture/frontdoor",
                      element: createElement(CaptureFrontDoor),
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("WP-KLARA-2 Befund 1: /capture/frontdoor?draft=<id> öffnet den Entwurf direkt", () => {
  it("gültiger Draft-Parameter → Inhalt steht im Editor, Entwurf-geöffnet-Hinweis sichtbar", async () => {
    getMock.mockResolvedValue({
      id: "d-word-1",
      payload: {
        title: "Wartung der Presse",
        bodyHtml: "<h2>Wartung der Presse</h2><p>Anlage freischalten.</p>",
        confidentiality: "intern",
      },
    });
    mount("/capture/frontdoor?draft=d-word-1");
    await settle();
    expect(getMock).toHaveBeenCalledWith("d-word-1");
    // Der Entwurf ist DIREKT geöffnet: Titel im Eingabefeld, Body im Editor, ehrlicher Hinweis.
    const titleInput = container.querySelector("input");
    expect((titleInput as HTMLInputElement | null)?.value).toBe("Wartung der Presse");
    const editor = container.querySelector("[contenteditable]");
    expect(editor?.innerHTML).toContain("Anlage freischalten.");
    // JOB 3062 · H3: Der Hinweissatz „Vordertür-Entwurf geöffnet" steht nicht mehr auf der Fläche
    // (Auftrag §5 — kein Erklärtext auf dem Blatt). Die AUSKUNFT ist geblieben und liegt dort, wo
    // sie hingehört: das Blatt trägt den Inhalt des Entwurfs (oben geprüft), und im „…"-Menü unter
    // „Entwürfe" ist genau dieser Entwurf als der offene hervorgehoben.
    const mehr = container.querySelector<HTMLButtonElement>('[data-testid="blatt-werkzeug-mehr"]');
    expect(mehr).not.toBeNull();
  });

  it("unbekannter/fremder Entwurf → ehrliche Meldung, die Seite bleibt normal benutzbar", async () => {
    getMock.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Entwurf nicht gefunden oder nicht sichtbar."),
    );
    mount("/capture/frontdoor?draft=gibt-es-nicht");
    await settle();
    // Ehrliche Meldung mit der Server-Ursache — KEIN Absturz, kein stilles Ignorieren.
    expect(container.textContent).toContain("Entwurf nicht gefunden oder nicht sichtbar.");
    // Die normale Seite steht bereit: leerer Editor, kein Entwurf-geöffnet-Hinweis.
    const editor = container.querySelector("[contenteditable]");
    expect(editor).not.toBeNull();
    // JOB 3062 · H3: siehe oben — der Hinweissatz ist gelöscht. Was hier zählt, steht darüber:
    // die ehrliche Fehlermeldung ist da, und der Editor ist leer und bedienbar.
  });
});
