// @vitest-environment jsdom
// JOB 3125 H1c: echter Löschweg → gemeinsame Query → echtes Kopfband.
// Nur die Servergrenze ist ersetzt; der Test schreibt die Zählquelle nie selbst.
// Frischer und abgelaufener Stand, Erfolg/404, Neubetreten und doppeltes Löschen.
// JOB 3136 H1e: Alias-unabhängiger Laufzeitbeleg ergänzt die literale Schlüssel-Erhebung.
// Die Anzeige wird gemessen; Cacheinhalt und Bauart des Bestätigungszeitpunkts bleiben frei.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => {
  const mk = () => {
    const state = { resolve: (_v: unknown) => {}, reject: (_e: unknown) => {} };
    const fn = vi.fn(
      () =>
        new Promise((resolve, reject) => {
          state.resolve = resolve;
          state.reject = reject;
        }),
    );
    return {
      fn,
      resolve: (v: unknown) => state.resolve(v),
      antwort: () => state.resolve,
      reject: (e: unknown) => state.reject(e),
    };
  };
  const sofortLeer = () => ({ fn: vi.fn(async () => [] as string[]) });
  return {
    board: mk(),
    remove: mk(),
    conflicts: mk(),
    duplicates: mk(),
    gaps: mk(),
    lifecycle: sofortLeer(),
  };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    validation: { board: d.board.fn },
    ko: { remove: d.remove.fn },
    directory: { list: vi.fn(async () => []) },
    conflicts: { list: d.conflicts.fn },
    duplicates: { list: d.duplicates.fn },
    gaps: { summary: d.gaps.fn },
    lifecycle: { pending: d.lifecycle.fn },
    notifications: { list: vi.fn(async () => []), markSeen: vi.fn(async () => ({})) },
    features: { get: vi.fn(async () => ({ features: {} })) },
    reasoner: {
      status: vi.fn(async () => ({ active: false, mode: "none", reachable: "unknown", tasks: {} })),
      config: vi.fn(async () => null),
    },
    external: { policy: vi.fn(async () => ({ stage: "blocked" })) },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { Fragment, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { ApiError } from "../../apps/web/src/api/client";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { ZAEHLER_FRISCHE_MS } from "../../apps/web/src/lib/loadingState";
import { Validation } from "../../apps/web/src/pages/Validation";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";
import { ToastViewport } from "../../apps/web/src/shell/ToastViewport";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

// Unter falscher Uhr: die Warteschleife arbeitet die fälligen 0-ms-Aufgaben ab, OHNE die Uhr
// weiterzustellen. Nur `advanceTimersByTime` bewegt die Zeit — sonst wäre nicht messbar, ob die
// Zahl an der FRIST verschwindet oder irgendwann nebenbei.
const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await vi.advanceTimersByTimeAsync(0);
  }
};

// Kopfband und Prüfen-Seite teilen den echten QueryClient.
async function mount(client?: QueryClient): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // Wie in `main.tsx`: dieselbe Frist als `staleTime` — react-query holt von sich aus nichts nach.
  qc =
    client ??
    new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: ZAEHLER_FRISCHE_MS } },
    });
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
                  { initialEntries: ["/validierung"] },
                  createElement(
                    Fragment,
                    null,
                    createElement(Kopfband),
                    createElement(Validation),
                    createElement(ToastViewport),
                  ),
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

const boardKey = ["validation", "board", undefined];
const badge = (): Element | null =>
  container.querySelector('header a[data-kopfband-punkt="validierung"] .kw-kopfband-zaehler');
const punkt = (): Element | null =>
  container.querySelector('header a[data-kopfband-punkt="validierung"]');
const zeilen = (): string[] =>
  [
    ...container.querySelectorAll(
      '[data-testid="pruefen-warteschlange-eintrag"] [data-text="titel"]',
    ),
  ].map((el) => el.textContent ?? "");
const karte = (): string | null | undefined =>
  container.querySelector('[data-testid="pruefen-karte"] [data-text="titel"]')?.textContent;

function ko(id: string): KnowledgeObject {
  return {
    id,
    title: `Eintrag ${id}`,
    statement: `Aussage ${id}`,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 50,
    trust: 50,
    status: "offen",
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-09-06T08:00:00.000Z",
    history: [],
  };
}

async function start(alter: number): Promise<number> {
  await mount();
  await act(async () => {
    d.board.resolve([ko("a"), ko("b"), ko("c")]);
    d.conflicts.resolve([]);
    d.duplicates.resolve([]);
    d.gaps.resolve({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } });
    // Bibliothekscache ist keine Zählquelle; sein bestätigter Löschschritt bleibt erhalten.
    qc.setQueryData(["kos"], [ko("a"), ko("b"), ko("c")]);
    await flush();
  });
  expect(badge()?.textContent).toBe("3");
  expect(zeilen()).toEqual(["Eintrag a", "Eintrag b", "Eintrag c"]);
  const stand = qc.getQueryState(boardKey)?.dataUpdatedAt;
  expect(stand).toBeGreaterThan(0);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(alter);
    await flush();
  });
  expect(d.board.fn).toHaveBeenCalledTimes(1);
  if (alter >= ZAEHLER_FRISCHE_MS) {
    keineZahl();
  } else {
    expect(badge()?.textContent).toBe("3");
  }
  return stand ?? 0;
}

function keineZahl(): void {
  expect(badge(), "keine unbestätigte Zahl im Kopfband").toBeNull();
  expect(punkt()?.textContent).toBe(i18n.t("kopfband.pruefen"));
  expect(punkt()?.textContent).not.toContain("!");
  for (const key of ["nav.badge.stale", "nav.badge.error", "nav.badge.loading"]) {
    expect(punkt()?.querySelector(`[aria-label="${i18n.t(key)}"]`)).toBeNull();
  }
}

function reiter(lage: "frisch" | "gedaempft" | "unbekannt", n?: number): void {
  const el = container.querySelector('[data-testid="pruefen-reiter-offen"]');
  expect(el?.getAttribute("data-lage")).toBe(lage);
  expect(el?.textContent).toBe(`Offen${n === undefined ? "" : ` · ${n}`}`);
}

async function knopf(key: string): Promise<void> {
  await click(
    [...container.querySelectorAll("button")].find((el) => el.textContent?.trim() === i18n.t(key)),
  );
}

async function loeschenStarten(id: "a" | "b" = "a"): Promise<void> {
  const nummer = id === "a" ? 1 : 2;
  const vorher = id === "a" ? ["Eintrag a", "Eintrag b", "Eintrag c"] : ["Eintrag b", "Eintrag c"];
  const menue = container.querySelector('[data-testid="pruefen-menue-karte"]');
  if (menue?.getAttribute("aria-expanded") !== "true") {
    await click(menue);
  }
  await knopf("ko.deleteButton");
  expect(d.remove.fn).toHaveBeenCalledTimes(nummer - 1);
  await knopf("ko.deleteYes");
  expect(d.remove.fn).toHaveBeenCalledTimes(nummer);
  expect(d.remove.fn).toHaveBeenNthCalledWith(nummer, id);
  // Ohne Bestätigung verschwindet noch nichts, auch nicht beim zweiten Löschen.
  expect(zeilen()).toEqual(vorher);
  expect(d.board.fn).toHaveBeenCalledTimes(nummer);
}

async function loeschenBestaetigen(weg: "erfolg" | "404", id: "a" | "b" = "a"): Promise<void> {
  await loeschenStarten(id);
  await act(async () => {
    if (weg === "404") {
      d.remove.reject(new ApiError(404, "not_found", "Bereits gelöscht"));
    } else {
      d.remove.resolve(undefined);
    }
    await flush();
  });
  expect(document.body.textContent).toContain(
    i18n.t(weg === "404" ? "ko.deleteAlreadyGone" : "ko.deleteDone"),
  );
  const rest = id === "a" ? ["b", "c"] : ["c"];
  expect(d.board.fn).toHaveBeenCalledTimes(id === "a" ? 2 : 3);
  expect(qc.getQueryState(boardKey)?.fetchStatus).toBe("fetching");
  expect(zeilen()).toEqual(rest.map((k) => `Eintrag ${k}`));
  expect(karte()).toBe(`Eintrag ${rest[0]}`);
  expect(qc.getQueryData<KnowledgeObject[]>(["kos"])?.map((k) => k.id)).toEqual(rest);
}

beforeEach(async () => {
  vi.useFakeTimers();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => root.unmount());
  qc.clear();
  container.remove();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe.each([
  { lage: "frischem", alter: 1_000 },
  { lage: "abgelaufenem", alter: 35_000 },
])("JOB 3125 H1c: Löschen bei $lage Board-Stand", ({ alter }) => {
  it.each(["erfolg", "404"] as const)(
    "%s → Abruf hängt ohne Zahl → frische Serverzahl",
    async (weg) => {
      const stand = await start(alter);
      await loeschenBestaetigen(weg);
      keineZahl();
      reiter("gedaempft", zeilen().length);
      await act(async () => {
        // Server meldet zusätzlich einen neuen Eintrag: die Zahl darf nicht lokal 3 - 1 sein.
        d.board.resolve([ko("b"), ko("c"), ko("d"), ko("e")]);
        await flush();
      });
      expect(qc.getQueryState(boardKey)?.fetchStatus).toBe("idle");
      expect(badge()?.textContent).toBe("4");
      reiter("frisch", 4);
      expect(zeilen()).toEqual(["Eintrag b", "Eintrag c", "Eintrag d", "Eintrag e"]);
      expect(qc.getQueryState(boardKey)?.dataUpdatedAt).toBeGreaterThan(stand);
    },
  );

  it.each(["erfolg", "404"] as const)(
    "%s → Abruf scheitert: keine Zahl, Restliste und Fehlerhinweis bleiben",
    async (weg) => {
      await start(alter);
      await loeschenBestaetigen(weg);
      keineZahl();
      await act(async () => {
        d.board.reject(new Error("Auffrischung fehlgeschlagen"));
        await flush();
      });
      expect(qc.getQueryState(boardKey)?.status).toBe("error");
      expect(qc.getQueryState(boardKey)?.fetchStatus).toBe("idle");
      keineZahl();
      reiter("unbekannt");
      expect(zeilen()).toEqual(["Eintrag b", "Eintrag c"]);
      expect(karte()).toBe("Eintrag b");
      expect(container.querySelector('[data-testid="pruefen-nicht-frisch"]')?.textContent).toBe(
        i18n.t("pruefen.refreshFailed"),
      );
    },
  );

  it.each(["erfolg", "404"] as const)(
    "%s → Neubetreten nach Abruffehler: Gelöschtes bleibt aus Liste und Karte entfernt",
    async (weg) => {
      await start(alter);
      await loeschenBestaetigen(weg);
      await act(async () => {
        d.board.reject(new Error("Auffrischung fehlgeschlagen"));
        await flush();
      });
      expect(qc.getQueryState(boardKey)?.status).toBe("error");
      expect(qc.getQueryState(boardKey)?.fetchStatus).toBe("idle");
      const client = qc;
      await act(async () => root.unmount());
      container.remove();
      await mount(client);
      expect(qc).toBe(client);
      expect(d.board.fn).toHaveBeenCalledTimes(3);
      expect(qc.getQueryState(boardKey)?.fetchStatus).toBe("fetching");
      expect(zeilen(), "Gelöschtes kehrt beim Neubetreten nicht zurück").toEqual([
        "Eintrag b",
        "Eintrag c",
      ]);
      expect(karte()).toBe("Eintrag b");
      keineZahl();
      // Der vorherige Abruffehler gilt weiter, bis eine neue Antwort gelingt.
      reiter("unbekannt");
      await act(async () => {
        d.board.reject(new Error("Weiterhin offline"));
        await flush();
      });
      expect(zeilen()).toEqual(["Eintrag b", "Eintrag c"]);
      expect(karte()).toBe("Eintrag b");
      keineZahl();
      reiter("unbekannt");
      expect(container.querySelector('[data-testid="pruefen-nicht-frisch"]')?.textContent).toBe(
        i18n.t("pruefen.refreshFailed"),
      );
      console.info(`Liste= ${JSON.stringify(zeilen())}`);
    },
  );

  it("Doppeltes Löschen bei hängendem Abruf: keine Zahl bis zur gültigen Antwort", async () => {
    await start(alter);
    await loeschenBestaetigen("erfolg");
    keineZahl();
    const ersteAntwort = d.board.antwort();
    await loeschenBestaetigen("erfolg", "b");
    keineZahl();
    reiter("gedaempft", 1);
    expect(d.remove.fn.mock.calls).toEqual([["a"], ["b"]]);

    // Der durch das zweite Löschen überholte Abruf darf auch bei später Antwort keine Zahl
    // bestätigen. Erst die danach angeforderte Antwort trägt den neuen Gesamtstand.
    await act(async () => {
      ersteAntwort([ko("b"), ko("c")]);
      await flush();
    });
    expect(qc.getQueryState(boardKey)?.fetchStatus).toBe("fetching");
    expect(zeilen()).toEqual(["Eintrag c"]);
    keineZahl();
    await act(async () => {
      // Zwei neue Einträge: nicht die örtlich berechnete Restzahl 1.
      d.board.resolve([ko("c"), ko("d"), ko("e")]);
      await flush();
    });
    expect(qc.getQueryState(boardKey)?.fetchStatus).toBe("idle");
    expect(badge()?.textContent).toBe("3");
    expect(zeilen()).toEqual(["Eintrag c", "Eintrag d", "Eintrag e"]);
    reiter("frisch", 3);
  });

  it("bestätigter Leerstand zeigt ebenfalls kein Badge", async () => {
    await start(alter);
    await loeschenBestaetigen("erfolg");
    await act(async () => {
      d.board.resolve([]);
      await flush();
    });
    expect(qc.getQueryState(boardKey)?.status).toBe("success");
    expect(qc.getQueryData(boardKey)).toEqual([]);
    keineZahl();
    expect(zeilen()).toEqual([]);
    expect(karte()).toBeUndefined();
  });

  it("Löschen scheitert: ursprüngliche Liste, Bestätigung und Serverfehlermeldung bleiben", async () => {
    const stand = await start(alter);
    await loeschenStarten();
    await act(async () => {
      d.remove.reject(new ApiError(503, "unavailable", "Löschen derzeit nicht möglich"));
      await flush();
    });
    expect(document.body.textContent).toContain("Löschen derzeit nicht möglich");
    expect(container.textContent).toContain(i18n.t("ko.deleteQ"));
    expect(zeilen()).toEqual(["Eintrag a", "Eintrag b", "Eintrag c"]);
    expect(karte()).toBe("Eintrag a");
    expect(d.board.fn).toHaveBeenCalledTimes(1);
    expect(qc.getQueryState(boardKey)?.dataUpdatedAt).toBe(stand);
    expect(qc.getQueryData<KnowledgeObject[]>(["kos"])?.map((k) => k.id)).toEqual(["a", "b", "c"]);
    if (alter >= ZAEHLER_FRISCHE_MS) {
      keineZahl();
    } else {
      expect(badge()?.textContent).toBe("3");
    }
  });
});

it("Alias-unabhängig: Löschweg entwertet Prüfen und die geteilte Aufgaben-Zählquelle", async () => {
  await start(1_000);
  await click(container.querySelector('[data-testid="kopfband-zahnrad"]'));
  await click(container.querySelector('[data-testid="zahnrad-weitere-bereiche"]'));
  const aufgaben = (): Element | null =>
    container.querySelector('[data-testid="bereich-aufgaben"] .kw-menue-wert');
  expect(container.querySelector('[data-testid="bereich-aufgaben"]')).not.toBeNull();
  expect(aufgaben()?.textContent).toBe("3");
  // Servergrenze bleibt die einzige Attrappe. Derselbe Fall kippt auch, wenn der echte
  // Produktschreiber queryKey: BOARD_KEY statt des Literals verwendet (Gegenprobe H1e).
  await loeschenBestaetigen("erfolg");
  keineZahl();
  expect(aufgaben(), "auch die geteilte Aufgaben-Zahl ist unbestätigt").toBeNull();
  await act(async () => {
    d.board.resolve([ko("b"), ko("c"), ko("d"), ko("e")]);
    await flush();
  });
  expect(badge()?.textContent).toBe("4");
  expect(aufgaben()?.textContent).toBe("4");
});
