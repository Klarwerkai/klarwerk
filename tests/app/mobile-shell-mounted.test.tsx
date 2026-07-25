// @vitest-environment jsdom
// AUFTRAG-mega1 Block F (E2E-017): Mobile/iPad-Layout. Gemountet an der ECHTEN AppShell:
//  - schmal (≤899px): die Sidebar ist NICHT im Fluss (kein <aside>), der Inhalt nutzt die volle
//    Breite; ein Hamburger öffnet die Sidebar als Drawer, ein Schließen entfernt sie wieder.
//  - Desktop (>899px): die Sidebar steht wie bisher im Fluss (<aside>), kein Hamburger.
//  - /mobile rendert OHNE Desktop-Shell (kein <aside>, kein <header>).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

// Breiter, robuster Endpoints-Mock: jede Namespace-Kette liefert eine Funktion, die [] auflöst.
vi.mock("../../apps/web/src/api/endpoints", () => {
  const make = (): unknown =>
    new Proxy(
      vi.fn(async () => []),
      {
        get(target, prop, recv) {
          if (prop in target || typeof prop === "symbol") {
            return Reflect.get(target, prop, recv);
          }
          return make();
        },
      },
    );
  return { endpoints: make() };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { type ReactNode, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

function setViewport(narrow: boolean): void {
  (globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
    ({
      matches: narrow,
      media: q,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(url: string, children: ReactNode): Promise<void> {
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
                  { initialEntries: [url] },
                  createElement(AppShell, null, children),
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

function byAria(label: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[aria-label="${label}"]`);
}

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
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

describe("Block F: Mobile/iPad-Shell", () => {
  it("schmal (390px): Sidebar nicht im Fluss, Drawer öffnet/schließt über den Hamburger", async () => {
    setViewport(true);
    await mount("/", createElement("div", null, "SHELL-CONTENT"));
    // Inhalt da, aber KEIN <aside> im Fluss (Sidebar aus dem Layout genommen).
    expect(container.textContent).toContain("SHELL-CONTENT");
    expect(container.querySelector("aside")).toBeNull();
    // Hamburger vorhanden → öffnet den Drawer (Sidebar erscheint).
    const burger = byAria(i18n.t("topbar.openMenu"));
    expect(burger).not.toBeNull();
    if (burger) {
      await click(burger);
    }
    expect(container.querySelector("aside")).not.toBeNull();
    // Schließen entfernt die Sidebar wieder.
    const close = byAria(i18n.t("topbar.closeMenu"));
    expect(close).not.toBeNull();
    if (close) {
      await click(close);
    }
    expect(container.querySelector("aside")).toBeNull();
  });

  it("Desktop (1280px): Sidebar im Fluss, kein Hamburger", async () => {
    setViewport(false);
    await mount("/", createElement("div", null, "SHELL-CONTENT"));
    expect(container.querySelector("aside")).not.toBeNull();
    expect(byAria(i18n.t("topbar.openMenu"))).toBeNull();
  });

  it("/mobile rendert ohne Desktop-Shell (kein <aside>, kein <header>)", async () => {
    setViewport(false);
    await mount("/mobile", createElement("div", null, "MOBILE-CONTENT"));
    expect(container.textContent).toContain("MOBILE-CONTENT");
    expect(container.querySelector("aside")).toBeNull();
    expect(container.querySelector("header")).toBeNull();
  });
});
