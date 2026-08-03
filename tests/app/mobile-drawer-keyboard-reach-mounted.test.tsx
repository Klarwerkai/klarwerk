// @vitest-environment jsdom
// AUFTRAG-mega9 Block D-3 (KW-E2E-004): DIE LÜCKE, DIE DEN BEFUND DURCHGELASSEN HAT.
//
// Es gab drei Drawer-Tests — Modalität, Backdrop, Fokusvertrag. Sie beweisen, dass NICHTS AUSSERHALB
// des Dialogs erreichbar ist (mobile-drawer-backdrop-mounted / -modality-mounted) und dass Escape,
// Inert und die Fokus-Rückgabe stimmen. Aber KEIN EINZIGER prüfte die Gegenrichtung: dass die
// Menüpunkte INNERHALB des Panels per Tastatur überhaupt erreichbar sind. Genau in diese Lücke fiel
// der Prüferbefund „25× Tab, kein Menüpunkt erreichbar".
//
// EHRLICHE GRENZE DIESES TESTS: jsdom rechnet kein Layout und bewegt bei einem Tab-Tastendruck den
// Fokus NICHT von selbst (es gibt keine native Tab-Navigation). Ein Test, der hier „25× Tab" nachspielt
// und Menüpunkte erwartet, würde nichts über echte Browser aussagen. Deshalb prüft dieser Test genau
// die zwei Dinge, die in jsdom BEWEISBAR sind und die den Befund verursacht hätten:
//
//   1. Der Selektor der Fokusfalle (focusablesIn) findet die Navigationsziele WIRKLICH — nicht nur den
//      X-Knopf. Wäre das die Ursache gewesen (meine Erklärung 1), bräche dieser Test.
//   2. Der Tab-Handler kreist NICHT auf einem einzigen Element: er fängt Tab nur an den RÄNDERN ab
//      (letztes → erstes, erstes → letztes per Shift) und lässt ihn dazwischen unangetastet an den
//      Browser durch — sonst klebte der Fokus, egal wie oft man drückt.
//
// Das echte Tastaturverhalten im Browser ist mit einem separaten Playwright-Lauf gemessen worden
// (tests-smoke/mobile-drawer-focus-probe.spec.ts, Block D-1); der Befund reproduzierte dort NICHT.
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

// Exakt der Selektor aus MobileNavDrawer.focusablesIn — hier bewusst dupliziert, damit ein
// stillschweigendes Verengen des Originals hier auffällt statt mitzuwandern.
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

function dialog(): HTMLElement {
  const el = container.querySelector<HTMLElement>("dialog[aria-modal='true']");
  if (!el) {
    throw new Error("Drawer-Dialog nicht gefunden");
  }
  return el;
}

// Dieselbe Filterung wie focusablesIn im Bauteil.
function focusablesInPanel(): HTMLElement[] {
  return [...dialog().querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (el) => !el.hasAttribute("hidden") && el.closest("[hidden],[aria-hidden='true']") === null,
  );
}

// Gibt zurück, ob der Handler den Tastendruck abgefangen hat (preventDefault) — das unterscheidet
// „Rand der Fokusfalle" von „läuft normal weiter".
async function pressTab(on: HTMLElement, shiftKey = false): Promise<boolean> {
  const ev = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  await act(async () => {
    on.dispatchEvent(ev);
    await flush();
  });
  return ev.defaultPrevented;
}

async function openDrawer(): Promise<void> {
  setNarrowViewport();
  await mount();
  const burger = byAria(i18n.t("topbar.openMenu"));
  if (!burger) {
    throw new Error("Hamburger nicht gefunden");
  }
  await click(burger);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("AUFTRAG-mega9 Block D-3: die Menüpunkte im Drawer sind per Tastatur erreichbar", () => {
  it("die Fokusfalle sieht die Navigationsziele — nicht nur den Schließen-Knopf", async () => {
    await openDrawer();
    const focusables = focusablesInPanel();

    // Was DIESER Test beweist: das Panel-DOM stellt mehr als den X-Knopf tastaturerreichbar bereit —
    // die Sidebar-Links fallen nicht durch `hidden`, `aria-hidden` oder `tabindex="-1"`. Das war die
    // Vorbedingung von Erklärung 1 für den Prüferbefund.
    //
    // Was er NICHT beweist (bewusst benannt): dass die Fokusfalle im Bauteil denselben Selektor
    // benutzt — dieser Test misst mit seiner eigenen Kopie. Ein VERENGTER Selektor im Bauteil fällt
    // im zweiten Test dieser Datei auf, wo der echte Tab-Handler befragt wird.
    expect(focusables.length).toBeGreaterThan(1);

    // Die echten Navigationsziele sind darunter, mit ihren Routen.
    // Bewusst die Routen, die in JEDER Rolle im Menü stehen — welche Punkte eine Rolle zusätzlich
    // sieht, ist Sache der Rollenlogik und nicht Gegenstand dieses Tastatur-Tests.
    const hrefs = focusables
      .filter((el): el is HTMLAnchorElement => el instanceof HTMLAnchorElement)
      .map((a) => a.getAttribute("href"));
    for (const route of ["/start", "/hilfe", "/profil"]) {
      expect(hrefs).toContain(route);
    }

    // Und der Schließen-Knopf ist NUR das erste Element, nicht das einzige.
    expect(focusables[0]?.getAttribute("aria-label")).toBe(i18n.t("topbar.closeMenu"));
  });

  it("Tab kreist nicht auf einem Element: er wandert Station für Station und schließt sich an den Rändern", async () => {
    await openDrawer();
    const focusables = focusablesInPanel();
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const middleIndex = Math.floor(focusables.length / 2);
    const middle = focusables[middleIndex];
    const afterMiddle = focusables[middleIndex + 1];
    if (!first || !last || !middle || !afterMiddle) {
      throw new Error("Zu wenige fokussierbare Elemente im Panel");
    }

    // ============================================================================================
    // AUFTRAG-smoketor BLOCK B — HIER STAND EINE MECHANIK ALS STELLVERTRETER FÜR EIN VERHALTEN.
    // ============================================================================================
    //
    // Bis smoketor sicherte diese Stelle `expect(await pressTab(middle)).toBe(false)` zu, also: der
    // Handler ruft in der Mitte KEIN preventDefault. Die Begründung daneben lautete „würde er hier
    // abfangen, bliebe der Fokus stehen". Genau diese Gleichsetzung war der Fehler — abfangen und
    // stehenbleiben sind nicht dasselbe. Ein Handler darf abfangen UND den Fokus selbst
    // weitersetzen; das Verhalten ist dann besser, die zugesicherte Mechanik aber verletzt.
    //
    // Und sie musste verletzt werden: im echten WebKit ist genau dieses „der Browser wandert schon
    // weiter" falsch. Links und Knöpfe stehen dort standardmäßig nicht in der Tab-Reihenfolge, der
    // Fokus fiel beim ersten Tab aus dem Dialog auf `body` und kam nie zurück — gemessen 25× von 25
    // (`_relay/messung/smoketor-B-rot-webkit.log`). Der Drawer setzt den nächsten Fokus deshalb bei
    // JEDEM Tab selbst (`MobileNavDrawer.tsx`).
    //
    // Die Zusicherung prüft jetzt, was sie immer meinte: nach einem Tab in der Mitte steht der Fokus
    // auf der NÄCHSTEN Station. Das ist strenger als vorher — die alte Fassung sagte über den
    // tatsächlichen Verbleib des Fokus in der Mitte gar nichts (jsdom bewegt ihn von sich aus nicht).
    middle.focus();
    expect(await pressTab(middle)).toBe(true);
    expect(document.activeElement).toBe(afterMiddle);

    // Rand vorwärts: vom letzten Element springt Tab zurück auf das erste (Falle schließt sich).
    last.focus();
    expect(await pressTab(last)).toBe(true);
    expect(document.activeElement).toBe(first);

    // Rand rückwärts: vom ersten Element springt Shift+Tab ans Ende.
    first.focus();
    expect(await pressTab(first, true)).toBe(true);
    expect(document.activeElement).toBe(last);

    // In beide Richtungen bleibt der Fokus im Panel — die Falle hält, ohne zu kleben.
    expect(dialog().contains(document.activeElement)).toBe(true);
  });

  it("ein Menüziel lässt sich fokussieren und per Tastatur auslösen", async () => {
    await openDrawer();
    const target = focusablesInPanel().find(
      (el) => el instanceof HTMLAnchorElement && el.getAttribute("href") === "/hilfe",
    );
    if (!target) {
      throw new Error("Menüpunkt „Hilfe“ nicht gefunden");
    }

    target.focus();
    // Erreichbar heißt: er nimmt den Fokus wirklich an (kein tabindex=-1, nicht aria-hidden).
    expect(document.activeElement).toBe(target);
    expect(target.getAttribute("tabindex")).not.toBe("-1");
  });
});
