// @vitest-environment jsdom
// ================================================================================================
// JOB 3060 · H1 — HILFE-TIPPS AUS DEM SICHTFELD, NICHT AUS DEM PRODUKT (Lieferung 5).
// ================================================================================================
//
// `HelpTip` rendert im Seitenfluss NICHTS mehr (kein „?“-Knopf, keine Sprechblase), meldet aber
// Titel und Text bei der Seitenhilfe an; das Zahnrad-Menü listet unter „Seitenhilfe“ alle Tipps der
// aktuellen Seite. Gemessen an der ECHTEN AppShell mit einer Seite, die drei Tipps trägt — und in
// beide Richtungen: ein Tipp, der aus dem Baum geht, verschwindet auch aus der Liste; ein HelpTip
// ohne Anbieter (Seiten in Tests ohne Hülle) rendert nichts und stürzt nicht ab.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
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
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { HelpTip } from "../../apps/web/src/components/HelpTip";
import i18n from "../../apps/web/src/i18n";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let dritterAus: (() => void) | undefined;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

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

/** Eine Seite mit drei Tipps — der dritte lässt sich von außen aus dem Baum nehmen. */
function SeiteMitTipps(): JSX.Element {
  const [dritter, setDritter] = useState(true);
  dritterAus = () => setDritter(false);
  return createElement(
    "div",
    null,
    createElement("h1", null, "Erfassen"),
    createElement(HelpTip, { title: "Titel des Feldes", body: "Erklärung zu Feld eins." }),
    createElement(HelpTip, { title: "Zweiter Tipp", body: "Erklärung zu Feld zwei." }),
    dritter
      ? createElement(HelpTip, { title: "Dritter Tipp", body: "Erklärung zu Feld drei." })
      : null,
  );
}

async function mount(url: string, kind: ReturnType<typeof createElement>): Promise<void> {
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
                createElement(MemoryRouter, { initialEntries: [url] }, kind),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await act(flush);
}

async function click(el: Element | null | undefined): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error("Element zum Klicken fehlt");
  }
  await act(async () => {
    el.click();
    await flush();
  });
}

async function seitenhilfeOeffnen(): Promise<string> {
  await click(container.querySelector('[data-testid="kopfband-zahnrad"]'));
  await click(container.querySelector('[data-testid="zahnrad-seitenhilfe"]'));
  return (container.querySelector('[data-testid="zahnrad-menue"]')?.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  setViewport(false);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 3060 · H1 · die Seitenhilfe sammelt die HelpTips der Seite", () => {
  it("im Sichtfeld rendert HelpTip NICHTS — kein Knopf, keine Sprechblase, kein Text", async () => {
    await mount("/erfassen", createElement(AppShell, null, createElement(SeiteMitTipps)));
    const main = container.querySelector("main");
    expect(main).not.toBeNull();
    expect(main?.querySelectorAll("button").length).toBe(0);
    expect(main?.textContent).not.toContain("Erklärung zu Feld eins.");
    expect(main?.textContent).not.toContain("Titel des Feldes");
    expect(container.querySelector(`[aria-label="${i18n.t("help.open")}"]`)).toBeNull();
  });

  it("das Zahnrad-Menü listet unter „Seitenhilfe“ Titel UND Text jedes Tipps — in Reihenfolge der Seite", async () => {
    await mount("/erfassen", createElement(AppShell, null, createElement(SeiteMitTipps)));
    const text = await seitenhilfeOeffnen();
    const liste = container.querySelector('[data-testid="seitenhilfe-liste"]');
    expect(liste).not.toBeNull();
    const eintraege = [...(liste?.querySelectorAll("li") ?? [])].map((li) =>
      (li.textContent ?? "").replace(/\s+/g, " ").trim(),
    );
    // Zuerst der Nav-Erklärsatz der Seite (/erfassen hat das Kapitel „capture“), dann die Tipps —
    // jeder mit Titel UND Text, in der Reihenfolge der Seite.
    expect(eintraege).toHaveLength(4);
    expect(eintraege[0]).toContain(i18n.t("help.capture.title"));
    expect(eintraege[0]).toContain(i18n.t("help.capture.body"));
    expect(eintraege[1]).toContain("Titel des Feldes");
    expect(eintraege[1]).toContain("Erklärung zu Feld eins.");
    expect(eintraege[2]).toContain("Zweiter Tipp");
    expect(eintraege[2]).toContain("Erklärung zu Feld zwei.");
    expect(eintraege[3]).toContain("Dritter Tipp");
    expect(eintraege[3]).toContain("Erklärung zu Feld drei.");
    expect(text).toContain("Erklärung zu Feld eins.");
  });

  it("ein Tipp, der die Seite verlässt, verlässt auch die Liste (Abmeldung beim Unmount)", async () => {
    await mount("/erfassen", createElement(AppShell, null, createElement(SeiteMitTipps)));
    await seitenhilfeOeffnen();
    expect(container.querySelector('[data-testid="seitenhilfe-liste"]')?.textContent).toContain(
      "Dritter Tipp",
    );
    await act(async () => {
      dritterAus?.();
      await flush();
    });
    expect(container.querySelector('[data-testid="seitenhilfe-liste"]')?.textContent).not.toContain(
      "Dritter Tipp",
    );
    expect(container.querySelector('[data-testid="seitenhilfe-liste"]')?.textContent).toContain(
      "Zweiter Tipp",
    );
  });

  it("ohne Anbieter (Seite ohne Hülle) rendert HelpTip nichts und stürzt nicht ab", async () => {
    await mount(
      "/erfassen",
      createElement(
        "div",
        { "data-testid": "ohne-huelle" },
        createElement(HelpTip, { title: "Allein", body: "Kein Sammler da." }),
      ),
    );
    const wurzel = container.querySelector('[data-testid="ohne-huelle"]');
    expect(wurzel).not.toBeNull();
    expect(wurzel?.childElementCount).toBe(0);
    expect(wurzel?.textContent).toBe("");
  });

  it("auch der Drawer (≤ 899 px) zeigt die Seitenhilfe mit denselben Tipps", async () => {
    setViewport(true);
    await mount("/erfassen", createElement(AppShell, null, createElement(SeiteMitTipps)));
    await click(container.querySelector(`[aria-label="${i18n.t("topbar.openMenu")}"]`));
    const dialog = container.querySelector("dialog[aria-modal='true']");
    expect(dialog).not.toBeNull();
    await click(dialog?.querySelector('[data-testid="zahnrad-seitenhilfe"]'));
    expect(dialog?.querySelector('[data-testid="seitenhilfe-liste"]')?.textContent).toContain(
      "Erklärung zu Feld zwei.",
    );
  });
});
