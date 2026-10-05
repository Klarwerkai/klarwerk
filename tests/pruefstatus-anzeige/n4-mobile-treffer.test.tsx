// @vitest-environment jsdom
// ================================================================================================
// PRÜFSTATUS-ANZEIGE (N4/R-1003, Ben R2 BEN-04) · DER MOBILE SUCHTREFFER ZEIGT DEN ECHTEN ZUSTAND.
// ================================================================================================
//
// Befund: die mobile Trefferliste rief `deriveStatus(k)` auf dem SUCHTREFFER — der trägt keinen
// Serverstatus (die Suchroute führt `anzeigestatus` nicht). Ein validiertes Objekt mit anstehender
// Re-Validierung hieß dort „Validiert". Jetzt gilt dieselbe Entscheidung wie in der Bibliothek
// (`anzeigestatusAus`): der Eintrag aus dem geladenen Bestand (`/api/kos`, mit Serverstatus), die
// bekannte Konfliktlage zuerst, und der Anker nennt die Herkunft.
//
// Aufbau wie `tests/app/mobile-lookup-exits-guarded-mounted.test.tsx`; Netz gibt es nicht.
import { afterEach, describe, expect, it, vi } from "vitest";

const lage = vi.hoisted(() => ({
  bestand: [] as unknown[],
  konflikte: [] as unknown[],
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "konto-pruefstand", name: "Prüfstand", role: "experte" })),
    logout: vi.fn(async () => undefined),
  },
}));

const TREFFER = {
  id: "k1",
  title: "Dichtungsnorm 4711",
  type: "best_practice",
  trust: 80,
  status: "validiert",
};

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    drafts: {
      list: vi.fn(async () => []),
      create: vi.fn(async () => ({ id: "d1" })),
      update: vi.fn(async () => ({})),
      remove: vi.fn(async () => ({})),
    },
    // Der SUCHTREFFER: ohne Serverstatus, wie die Suchroute ihn liefert.
    library: { search: vi.fn(async () => [TREFFER]) },
    // Der BESTAND (`/api/kos`): derselbe Eintrag MIT Serverstatus.
    ko: { list: vi.fn(async () => lage.bestand) },
    conflicts: { list: vi.fn(async () => lage.konflikte) },
    ask: { ask: vi.fn(async () => ({ answered: false })) },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
// JOB 4249: `Mobile` liest seit diesem Auftrag die Sitzung — die Offline-Warteschlange liegt am
// Gerät, gehört aber einem KONTO. Die Seite braucht damit denselben Rahmen wie im Betrieb
// (`App.tsx:97`). Ohne abrufbare Sitzung steht die Kontolage auf „unbekannt"; für diesen Fall
// ändert das nichts.
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Mobile } from "../../apps/web/src/pages/Mobile";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
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
          ToastProvider,
          null,
          createElement(
            NavGuardProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: ["/mobile"] },
              createElement(
                Routes,
                null,
                createElement(Route, {
                  path: "/mobile",
                  element: createElement(AuthProvider, null, createElement(Mobile)),
                }),
                createElement(Route, {
                  path: "/wissen/:id",
                  element: createElement("div", null, "WISSEN-SEITE"),
                }),
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

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

function pageText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
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

async function click(el: HTMLElement): Promise<void> {
  await act(async () => {
    el.click();
    await flush();
  });
}

async function trefferZustand(): Promise<HTMLElement> {
  await click(buttonByText(i18n.t("mob.tabLookup")));
  const search = container.querySelector<HTMLInputElement>("input");
  if (!search) {
    throw new Error("Suchfeld nicht gefunden");
  }
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(search) as object,
    "value",
  )?.set;
  setter?.call(search, "Dichtung");
  await act(async () => {
    search.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  for (let i = 0; i < 40 && !container.querySelector('[data-testid="mob-treffer-zustand"]'); i++) {
    await act(flush);
  }
  const el = container.querySelector<HTMLElement>('[data-testid="mob-treffer-zustand"]');
  if (!el) {
    throw new Error(`Trefferzustand fehlt: ${pageText().slice(0, 200)}`);
  }
  return el;
}

const HERKUNFT = {
  status: "geprueft",
  zuweisungen: "geprueft",
  bewertungen: "geprueft",
  konflikt: "geprueft",
  revalidierung: "geprueft",
  ungeprueft: {},
};

describe("N4 · mobiler Suchtreffer: Serverstatus statt Raten", () => {
  it("Re-Validierung aus dem Bestand erscheint am Treffer — nicht „Validiert“", async () => {
    lage.bestand = [
      { ...TREFFER, anzeigestatus: "revalidierung", anzeigestatusHerkunft: HERKUNFT },
    ];
    lage.konflikte = [];
    await mount();
    const zustand = await trefferZustand();
    expect((zustand.textContent ?? "").trim()).toBe(i18n.t("status.revalidierung"));
    expect(zustand.getAttribute("data-anzeigestatus-herkunft")).toBe("server");
  });

  it("Gegenprobe: ohne Bestandseintrag gilt der benannte Rückfall (Herkunft „bestand“)", async () => {
    lage.bestand = [];
    lage.konflikte = [];
    await mount();
    const zustand = await trefferZustand();
    expect((zustand.textContent ?? "").trim()).toBe(i18n.t("status.validiert"));
    expect(zustand.getAttribute("data-anzeigestatus-herkunft")).toBe("bestand");
  });

  it("ein bekannter offener Konflikt geht vor", async () => {
    lage.bestand = [{ ...TREFFER, anzeigestatus: "validiert", anzeigestatusHerkunft: HERKUNFT }];
    lage.konflikte = [{ id: "c1", koA: "k1", koB: "k9", type: "truth", status: "offen" }];
    await mount();
    const zustand = await trefferZustand();
    expect((zustand.textContent ?? "").trim()).toBe(i18n.t("status.konflikt"));
  });
});
