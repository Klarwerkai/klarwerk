// @vitest-environment jsdom
// AUFTRAG-mega1 Block D1 (E2E-007): Die globale Suche ist ein echtes <form> — Enter (Submit) öffnet
// dieselbe /bibliothek?q=…-Suche wie der Klick auf den Such-Knopf. Gemountet am echten Kopfband
// (JOB 3060 · H1: die Kopfzeile heißt Kopfband, das Suchfeld ist 260 px breit, Platzhalter „Suchen“).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    reasoner: {
      status: vi.fn(async () => ({ active: true, mode: "cloud", reachable: "active" })),
      config: vi.fn(async () => null),
    },
    notifications: { list: vi.fn(async () => []) },
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
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function LocationProbe(): JSX.Element {
  const loc = useLocation();
  return createElement("span", { "data-testid": "loc" }, `${loc.pathname}${loc.search}`);
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
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
                  { initialEntries: ["/start"] },
                  createElement(Kopfband),
                  createElement(LocationProbe),
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

function loc(): string {
  return container.querySelector("[data-testid=loc]")?.textContent ?? "";
}

function searchInput(): HTMLInputElement {
  const el = container.querySelector<HTMLInputElement>("input[type=search]");
  if (!el) {
    throw new Error("Suchfeld nicht gefunden");
  }
  return el;
}

async function typeQuery(text: string): Promise<void> {
  const input = searchInput();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block D1: globale Suche — Enter navigiert wie der Klick", () => {
  it("das Suchfeld trägt den Platzhalter „Suchen“ (Mockup Z.29) — und keinen sichtbaren ⌘K-Chip", async () => {
    await mount();
    expect(searchInput().getAttribute("placeholder")).toBe(i18n.t("kopfband.suchen"));
    expect(searchInput().closest("form")?.textContent).not.toContain("⌘K");
  });

  it("Enter (Formular-Submit) öffnet /bibliothek?q=…", async () => {
    await mount();
    await typeQuery("Ventil");
    await act(async () => {
      searchInput()
        .closest("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flush();
    });
    expect(loc()).toBe("/bibliothek?q=Ventil");
  });

  it("Klick auf den Such-Knopf öffnet dieselbe Route", async () => {
    await mount();
    await typeQuery("Ventil");
    const submitBtn = searchInput()
      .closest("form")
      ?.querySelector<HTMLButtonElement>("button[type=submit]");
    await act(async () => {
      submitBtn?.click();
      await flush();
    });
    expect(loc()).toBe("/bibliothek?q=Ventil");
  });
});
