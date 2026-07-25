// @vitest-environment jsdom
// AUFTRAG-mega3 Block C (bens Sammel-Review 3, Auflage F): der offene Drawer ist ECHT modal — ALLE
// Nicht-Drawer-Shellflächen (Klara-Schalter, Toast-Aktionen, Command Palette) liegen INNERHALB des
// inert geschalteten Hintergrunds und sind damit unzugänglich. bens Blocker war, dass diese
// Geschwister VOR mega3 außerhalb des inerten Bereichs lagen und `aria-modal="true"` daher stärker war
// als die tatsächliche Modalität. Gemountet an der ECHTEN AppShell im schmalen Modus.
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
import { ToastProvider, useToast } from "../../apps/web/src/app/ToastContext";
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

// Sonde: erzeugt über den ECHTEN Toast-Bus einen Toast (mit fokussierbarem Schließen-Knopf).
function ToastProbe(): JSX.Element {
  const { push } = useToast();
  return createElement(
    "button",
    {
      type: "button",
      "data-testid": "toastprobe",
      onClick: () => push("info", "Test-Toast Nachricht"),
    },
    "toast",
  );
}

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
                  createElement(ToastProbe),
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

describe("Block C: offener Drawer ist ECHT modal — Klara, Toast, Command Palette unzugänglich", () => {
  it("Klara-Schalter, Toast-Schließen-Knopf und Command Palette liegen im inerten Hintergrund", async () => {
    setNarrowViewport();
    await mount();

    // Einen Toast erzeugen (fokussierbarer Schließen-Knopf), BEVOR der Drawer öffnet.
    await click(container.querySelector<HTMLElement>("[data-testid=toastprobe]") as HTMLElement);
    expect(byAria(i18n.t("toast.dismiss"))).not.toBeNull();

    // Drawer öffnen.
    const burger = byAria(i18n.t("topbar.openMenu"));
    expect(burger).not.toBeNull();
    if (!burger) {
      return;
    }
    await click(burger);

    const panel = container.querySelector<HTMLElement>("dialog[aria-modal='true']");
    expect(panel).not.toBeNull();
    const background = container.querySelector<HTMLElement>("[inert]");
    expect(background).not.toBeNull();

    // (1) Klara-Schalter: im inerten Hintergrund, NICHT im Drawer → programmatischer/assistiver Fokus
    // ist im echten Browser wirkungslos.
    const klara = byAria(i18n.t("klara.open"));
    expect(klara).not.toBeNull();
    expect(klara?.closest("[inert]")).not.toBeNull();
    expect(panel?.contains(klara ?? null)).toBe(false);

    // (2) Toast-Aktion (Schließen): ebenfalls im inerten Hintergrund → nicht fokussierbar/auslösbar.
    const toastClose = byAria(i18n.t("toast.dismiss"));
    expect(toastClose).not.toBeNull();
    expect(toastClose?.closest("[inert]")).not.toBeNull();
    expect(panel?.contains(toastClose ?? null)).toBe(false);

    // (3) Command Palette: Öffnungs-Versuch bei offenem Drawer. Der globale Öffnen-Trigger feuert zwar,
    // die Palette rendert aber INNERHALB des inerten Hintergrunds → ihr Eingabefeld ist unzugänglich.
    await act(async () => {
      window.dispatchEvent(new Event("open-command-palette"));
      await flush();
    });
    const paletteInput = container.querySelector<HTMLInputElement>("input");
    expect(paletteInput, "Command-Palette-Eingabe erwartet").not.toBeNull();
    expect(paletteInput?.closest("[inert]")).not.toBeNull();
    expect(panel?.contains(paletteInput ?? null)).toBe(false);
  });

  it("nach dem Schließen ist der Hintergrund wieder aktiv (kein hängendes inert)", async () => {
    setNarrowViewport();
    await mount();
    const burger = byAria(i18n.t("topbar.openMenu"));
    if (!burger) {
      throw new Error("Hamburger nicht gefunden");
    }
    await click(burger);
    expect(container.querySelector("[inert]")).not.toBeNull();

    // Backdrop-Klick schließt → inert entfernt, Klara wieder außerhalb jedes inerten Bereichs.
    const closeMenu = byAria(i18n.t("topbar.closeMenu"));
    if (closeMenu) {
      await click(closeMenu);
    }
    expect(container.querySelector("[inert]")).toBeNull();
    expect(byAria(i18n.t("klara.open"))?.closest("[inert]")).toBeNull();
  });
});
