// @vitest-environment jsdom
// AUFTRAG-mega1 Block F (E2E-017): Mobile/iPad-Layout. Gemountet an der ECHTEN AppShell:
//  - schmal (≤899px): der Inhalt nutzt die volle Breite; ein Hamburger öffnet den Drawer
//    (JOB 3060 · H1: Kopfband-Punkte, Zahnrad- und Konto-Einträge), ein Schließen entfernt ihn.
//  - Desktop (>899px): das Kopfband steht, kein Hamburger — und seit H1 auf keiner Breite ein <aside>.
//  - /mobile rendert OHNE Desktop-Shell (kein <aside>, kein <header>).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    // JOB 3060 · H1: „editor" ist keine Rolle des Produkts (navigation.ts ROLES) — mit ihr sah
    // schon die alte Seitenleiste keinen Gruppenpunkt; nur das Logo trug damals „/start". Die
    // kleinste echte Rolle sieht Start · Fragen · Bibliothek.
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "viewer" })),
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

// JOB 3060 · H1: die Seitenleiste gibt es nicht mehr — auf KEINER Breite ein <aside>. Schmal
// öffnet der Hamburger den Drawer (dialog[aria-modal]) mit den Kopfband-Punkten; breit steht das
// Kopfband allein, ohne Hamburger.
describe("Block F: Mobile/iPad-Shell", () => {
  it("schmal (390px): kein <aside>, Drawer öffnet/schließt über den Hamburger", async () => {
    setViewport(true);
    await mount("/", createElement("div", null, "SHELL-CONTENT"));
    expect(container.textContent).toContain("SHELL-CONTENT");
    expect(container.querySelector("aside")).toBeNull();
    expect(container.querySelector("dialog[aria-modal='true']")).toBeNull();
    // Hamburger vorhanden → öffnet den Drawer (die Kopfband-Punkte erscheinen als Liste).
    const burger = byAria(i18n.t("topbar.openMenu"));
    expect(burger).not.toBeNull();
    if (burger) {
      await click(burger);
    }
    const drawer = container.querySelector("dialog[aria-modal='true']");
    expect(drawer).not.toBeNull();
    expect(drawer?.querySelector('a[href="/start"]')).not.toBeNull();
    // Schließen entfernt den Drawer wieder.
    const close = byAria(i18n.t("topbar.closeMenu"));
    expect(close).not.toBeNull();
    if (close) {
      await click(close);
    }
    expect(container.querySelector("dialog[aria-modal='true']")).toBeNull();
    expect(container.querySelector("aside")).toBeNull();
  });

  it("Desktop (1280px): das Kopfband steht, kein <aside>, kein Hamburger", async () => {
    setViewport(false);
    await mount("/", createElement("div", null, "SHELL-CONTENT"));
    expect(container.querySelector("aside")).toBeNull();
    expect(container.querySelector('header[data-testid="kopfband"]')).not.toBeNull();
    expect(container.querySelector('header a[href="/start"]')).not.toBeNull();
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
