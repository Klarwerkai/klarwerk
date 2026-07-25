// @vitest-environment jsdom
// AUFTRAG-mega2 Block D (E2E-017 / bens Block F): der Navigations-Drawer ist ein ECHTES modales Panel.
// Gemountet an der ECHTEN AppShell im schmalen Modus — geprüft wird die vollständige Tastaturkette:
//   öffnen → Dialogsemantik (role=dialog, aria-modal) + Fokus liegt IM Panel
//   Tab läuft nicht hinaus (Fokusfalle), Hintergrund ist inert
//   Escape schließt → Fokus kehrt auf den Hamburger zurück
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
    logout: vi.fn(async () => ({})),
  },
}));

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
import { act, createElement } from "../../apps/web/node_modules/react";
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

function setNarrowViewport(): void {
  (globalThis as unknown as { matchMedia: (q: string) => MediaQueryList }).matchMedia = (q) =>
    ({
      matches: true,
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
                  { initialEntries: ["/"] },
                  createElement(AppShell, null, createElement("div", null, "INHALT")),
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

function dialog(): HTMLElement {
  const el = container.querySelector<HTMLElement>("dialog[aria-modal='true']");
  if (!el) {
    throw new Error("Drawer-Dialog nicht gefunden");
  }
  return el;
}

async function pressKey(el: HTMLElement, key: string, shiftKey = false): Promise<void> {
  await act(async () => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true }));
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

describe("Block D: Drawer — Tastatur- und Fokusvertrag", () => {
  it("öffnen → Dialog + Fokus im Panel; Tab-Falle; Escape schließt → Fokus zurück am Hamburger", async () => {
    setNarrowViewport();
    await mount();

    const burger = byAria(i18n.t("topbar.openMenu"));
    expect(burger).not.toBeNull();
    if (!burger) {
      return;
    }
    await click(burger);

    // Dialogsemantik: natives <dialog> (implizite Dialog-Rolle) + aria-modal + zugänglicher Name.
    const panel = dialog();
    expect(panel.tagName).toBe("DIALOG");
    expect(panel.getAttribute("aria-modal")).toBe("true");
    expect(panel.getAttribute("aria-label")).toBe(i18n.t("topbar.menuLabel"));

    // Fokus liegt IM Panel.
    expect(panel.contains(document.activeElement)).toBe(true);

    // Hintergrund ist inert (nicht fokussierbar).
    const background = container.querySelector("[inert]");
    expect(background).not.toBeNull();
    expect(background?.contains(burger)).toBe(true);

    // Fokusfalle: letztes fokussierbares Element fokussieren, Tab → Fokus bleibt im Panel (wrap).
    const focusables = [...panel.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
    const last = focusables[focusables.length - 1];
    const first = focusables[0];
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    last?.focus();
    await pressKey(panel, "Tab");
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(first);
    // Shift+Tab am Anfang → wrap ans Ende, immer noch im Panel.
    first?.focus();
    await pressKey(panel, "Tab", true);
    expect(panel.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(last);

    // Escape schließt.
    await pressKey(panel, "Escape");
    expect(container.querySelector("dialog[aria-modal='true']")).toBeNull();
    // Fokus zurück auf den Hamburger, Hintergrund nicht mehr inert.
    expect(document.activeElement).toBe(burger);
    expect(container.querySelector("[inert]")).toBeNull();
  });
});
