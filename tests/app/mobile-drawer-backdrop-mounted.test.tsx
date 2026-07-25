// @vitest-environment jsdom
// AUFTRAG-mega4 Block C (bens Sammel-Review 4, Auflage F): der offene Drawer ist ECHT modal — es gibt
// KEINE fokussierbare Nicht-Drawer-Fläche außerhalb des inerten Hintergrunds. bens Blocker: der
// Backdrop war ein <button> und lag außerhalb sowohl des inerten Hintergrunds ALS AUCH des
// aria-modal-Dialogs → programmatisch/assistiv fokussierbar. Dieser Test sammelt bei offenem Drawer
// JEDES fokussierbare Element der Seite ein und beweist, dass es entweder IM Dialog oder IN einem
// inerten Container liegt (nicht nur die drei namentlich bekannten Flächen). Der Backdrop wird
// ausdrücklich als NICHT fokussierbar gepinnt; der Klick auf ihn schließt den Drawer weiterhin.
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

// Derselbe Fokus-Selektor wie im Drawer (MobileNavDrawer.FOCUSABLE_SELECTOR) — deckt genau die
// tastatur-/programmatisch erreichbaren Elemente ab.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block C: kein fokussierbares Nicht-Drawer-Element außerhalb des inerten Bereichs", () => {
  it("bei offenem Drawer liegt JEDES fokussierbare Element im Dialog oder in einem inerten Container", async () => {
    setNarrowViewport();
    await mount();

    const burger = byAria(i18n.t("topbar.openMenu"));
    expect(burger).not.toBeNull();
    if (!burger) {
      return;
    }
    await click(burger);

    const dialog = container.querySelector<HTMLElement>("dialog[aria-modal='true']");
    expect(dialog).not.toBeNull();

    // ALLE fokussierbaren Elemente der Seite einsammeln (nicht nur die drei namentlich bekannten).
    const focusables = [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
    expect(focusables.length, "es muss fokussierbare Elemente geben").toBeGreaterThan(0);

    for (const el of focusables) {
      const inDialog = dialog?.contains(el) ?? false;
      const inInert = el.closest("[inert]") !== null;
      expect(
        inDialog || inInert,
        `fokussierbares Element außerhalb von Dialog UND inertem Bereich: <${el.tagName.toLowerCase()} class="${el.className}">`,
      ).toBe(true);
    }
  });

  it("der Backdrop ist NICHT fokussierbar (kein Button, aria-hidden), schließt aber weiterhin per Klick", async () => {
    setNarrowViewport();
    await mount();
    const burger = byAria(i18n.t("topbar.openMenu"));
    if (!burger) {
      throw new Error("Hamburger nicht gefunden");
    }
    await click(burger);

    const backdrop = container.querySelector<HTMLElement>("[data-testid=drawer-backdrop]");
    expect(backdrop, "Backdrop erwartet").not.toBeNull();
    // Nicht fokussierbar: kein <button>, ausdrücklich aria-hidden, kein positiver tabindex, und er
    // taucht NICHT in der Fokus-Menge auf.
    expect(backdrop?.tagName.toLowerCase()).not.toBe("button");
    expect(backdrop?.getAttribute("aria-hidden")).toBe("true");
    expect(backdrop?.matches(FOCUSABLE_SELECTOR)).toBe(false);
    // Der Backdrop liegt außerhalb des Dialogs — genau deshalb darf er nicht fokussierbar sein.
    expect(container.querySelector("dialog[aria-modal='true']")?.contains(backdrop ?? null)).toBe(
      false,
    );

    // Klick auf den Backdrop schließt den Drawer weiterhin (unverändertes Maus-Verhalten).
    if (backdrop) {
      await click(backdrop);
    }
    expect(container.querySelector("dialog[aria-modal='true']")).toBeNull();
    // Kein hängendes inert nach dem Schließen.
    expect(container.querySelector("[inert]")).toBeNull();
  });
});
