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

// R-0438 (K6, BEN NACHARBEIT 5): zwei Wissensobjekte für die echte Bibliotheksroute. Die Suche
// schneidet wie `GET /api/library/search` am Suchbegriff; der Detailabruf bleibt absichtlich im
// Laden — gemessen wird die Kette Kopfband → Adresse → Trefferliste, nicht die Lesefläche.
const daten = vi.hoisted(() => {
  const ko = (id: string, title: string) => ({
    id,
    title,
    statement: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "validiert",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-08-12T00:00:00.000Z",
    history: [],
  });
  return { kos: [ko("alpha", "Ventil Alpha"), ko("beta", "Pumpe Beta")], suche: [] as string[] };
});

vi.mock("../../apps/web/src/api/endpoints", () => {
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    reasoner: {
      status: vi.fn(async () => ({ active: true, mode: "cloud", reachable: "active" })),
      config: vi.fn(async () => null),
    },
    notifications: { list: vi.fn(async () => []) },
    library: new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === "search"
            ? async (params: { q?: string }) => {
                const q = (params.q ?? "").toLowerCase();
                daten.suche.push(params.q ?? "");
                return daten.kos.filter((k) => k.title.toLowerCase().includes(q));
              }
            : arrFn(),
      },
    ),
    ko: new Proxy(
      {},
      {
        get: (_t, prop) =>
          prop === "list"
            ? async () => daten.kos
            : prop === "get"
              ? () => new Promise(() => {})
              : arrFn(),
      },
    ),
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
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { LIBRARY_SEARCH_DEBOUNCE_MS } from "../../apps/web/src/lib/useDebouncedValue";
import { Library } from "../../apps/web/src/pages/Library";
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

async function mount(mitBibliothek = false): Promise<void> {
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
                  // K6: die ECHTE Bibliotheksroute hinter dem Kopfband (nur bei `mitBibliothek`).
                  mitBibliothek
                    ? createElement(
                        Routes,
                        null,
                        createElement(Route, {
                          path: "/bibliothek",
                          element: createElement(Library),
                        }),
                      )
                    : null,
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
  // FE-002 (Pedi, 26.09.2026): der Platzhalter sagt, WAS gesucht wird — „Wissen suchen" statt
  // „Suchen" (Mockup Z.29), damit das Feld von „Seite finden ⌘K" unterscheidbar ist.
  it("das Suchfeld trägt den Platzhalter „Wissen suchen“ — und keinen sichtbaren ⌘K-Chip", async () => {
    await mount();
    expect(searchInput().getAttribute("placeholder")).toBe(i18n.t("fe002.wissenSuchen"));
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

// ================================================================================================
// R-0438 (K6, BEN NACHARBEIT 5) — KOPFBAND-EINGABE BIS IN DIE GEFILTERTE BIBLIOTHEK.
// ================================================================================================
// Die Kette am Stück: Eingabe im Kopfband → Enter → Adresse → echte Bibliotheksroute → Suchfeld
// und Trefferliste. Danach DERSELBE Weg mit einem zweiten Begriff, während die Bibliothek schon
// montiert ist — dort muss die Fläche dem neuen Begriff folgen, nicht beim alten stehen bleiben.
describe("K6 · Kopfband-Suche führt in die gefilterte Bibliothek", () => {
  const kopfbandFeld = (): HTMLInputElement => {
    const el = container.querySelector<HTMLInputElement>("form.kw-kopfband-suche input");
    if (!el) {
      throw new Error("Kopfband-Suchfeld nicht gefunden");
    }
    return el;
  };
  const imKopfbandSuchen = async (text: string): Promise<void> => {
    const feld = kopfbandFeld();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(feld, text);
      feld.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });
    await act(async () => {
      feld.closest("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await flush();
    });
  };
  const entprellungAbwarten = async (): Promise<void> => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, LIBRARY_SEARCH_DEBOUNCE_MS + 60));
      await flush();
    });
    await act(flush);
  };
  const bibliotheksFeld = (): string =>
    container.querySelector<HTMLInputElement>('[data-testid="bib-suche"]')?.value ?? "<fehlt>";
  const treffer = (): (string | null)[] =>
    [...container.querySelectorAll('[data-testid="bib-zeile"]')].map((z) =>
      z.getAttribute("data-bib-id"),
    );

  beforeEach(() => {
    daten.suche = [];
  });

  it("K6.1 · „Ventil“ von /start, dann „Pumpe“ bei schon offener Bibliothek", async () => {
    await mount(true);
    expect(
      container.querySelector('[data-testid="bib-suche"]'),
      "Start: keine Bibliothek",
    ).toBeNull();

    await imKopfbandSuchen("Ventil");
    await entprellungAbwarten();
    expect(loc()).toBe("/bibliothek?q=Ventil");
    expect(bibliotheksFeld()).toBe("Ventil");
    expect(treffer()).toEqual(["alpha"]);
    expect(daten.suche, "die Suche lief mit dem Begriff").toContain("Ventil");

    await imKopfbandSuchen("Pumpe");
    await entprellungAbwarten();
    expect(loc()).toBe("/bibliothek?q=Pumpe");
    expect(bibliotheksFeld()).toBe("Pumpe");
    expect(treffer()).toEqual(["beta"]);
    expect(daten.suche).toContain("Pumpe");
  });
});
