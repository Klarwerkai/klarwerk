// @vitest-environment jsdom
// ================================================================================================
// JOB 3060 · H1 (§9, Codex R5/R6) — DER PUNKT AM KONTO-KREIS STEHT NUR NACH FRISCHER BESTÄTIGUNG.
// ================================================================================================
//
// „Punkt nur nach frischem Abruf mit ungelesen > 0." Als ausführbare Bedingung (Codex R6):
//   Punkt ⇔ status === "success" ∧ fetchStatus === "idle" ∧ isStale === false ∧ online ∧ unread > 0.
// Ein alter Cache, an dem gerade eine Auffrischung läuft, ein gescheiterter Neuabruf, ein
// pausierter Abruf (offline) — alles KEIN Punkt. Und ein Erfolg ALTERT: nach Ablauf der Frischezeit
// verschwindet der Punkt ohne weitere Nutzeraktion, bis ein neuer ruhender Erfolg ihn bestätigt.
//
// Gemountet am ECHTEN Kopfband mit echtem React-Query und ENDLICHER Frischezeit (STALE_MS);
// die Endpunktgrenze ist ein Kanal, dessen Ausgang der Test steuert (auflösen, ablehnen, hängen
// lassen). Ein „alter Cache" ist hier wirklich alt: `setQueryData` mit `updatedAt` weit vor der
// Frischezeit — so, wie ein Bestand aus einer früheren Seite in der Ablage liegt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const kanal = vi.hoisted(() => {
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
    reject: (e: unknown) => state.reject(e),
  };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia Prüfer", email: "p@x.de", role: "viewer" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    validation: { board: vi.fn(async () => []) },
    conflicts: { list: vi.fn(async () => []) },
    duplicates: { list: vi.fn(async () => []) },
    gaps: { summary: vi.fn(async () => ({ open: 0, byPriority: {} })) },
    lifecycle: { pending: vi.fn(async () => []) },
    notifications: { list: kanal.fn, markSeen: vi.fn(async () => ({})) },
    features: { get: vi.fn(async () => ({ features: {} })) },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Die Frischezeit dieses Tests — endlich und kurz, damit ihr Ablauf messbar ist (Produkt: 30 s). */
const STALE_MS = 200;
const KEY = ["notifications"];

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

const UNGELESEN = [
  { id: "n1", kind: "conflict", title: "Widerspruch A", seen: false },
  { id: "n2", kind: "duplicate", title: "Dublette B", seen: false },
];
const GELESEN = UNGELESEN.map((n) => ({ ...n, seen: true }));

/**
 * Mountet das Kopfband. `alterCache` legt VOR dem Mount einen Bestand in die Ablage, der die
 * Frischezeit längst überschritten hat — react-query frischt ihn beim Mount sofort auf.
 */
async function mount(alterCache?: unknown[]): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: STALE_MS } } });
  if (alterCache) {
    qc.setQueryData(KEY, alterCache, { updatedAt: Date.now() - 10 * STALE_MS });
  }
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

const punkt = (): Element | null => container.querySelector('[data-testid="konto-punkt"]');
const kontoLabel = (): string =>
  container.querySelector('[data-testid="kopfband-konto"]')?.getAttribute("aria-label") ?? "";
/** Der Query-Zustand samt Frische — aus derselben Ablage, die das Kopfband liest. */
const lage = (): { status: string; fetchStatus: string; stale: boolean } => {
  const q = qc.getQueryCache().find({ queryKey: KEY });
  return {
    status: q?.state.status ?? "-",
    fetchStatus: q?.state.fetchStatus ?? "-",
    stale: q ? q.isStaleByTime(STALE_MS) : true,
  };
};
/** Lässt echte Zeit vergehen — die Frischezeit läuft ab, ohne dass irgendjemand etwas tut. */
async function warten(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
    await flush();
  });
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  onlineManager.setOnline(true);
});

afterEach(() => {
  onlineManager.setOnline(true);
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 3060 · H1 · §9 · der Punkt am Konto-Kreis", () => {
  it("(4) frischer Erfolg mit ungelesen > 0 → Punkt sofort; nach Ablauf der Frischezeit OHNE neuen Abruf → kein Punkt; neuer ruhender Erfolg → Punkt", async () => {
    await mount();
    // Erstladen: noch keine Bestätigung → kein Punkt.
    expect(lage().status).toBe("pending");
    expect(punkt()).toBeNull();
    await act(async () => {
      kanal.resolve(UNGELESEN);
      await flush();
    });
    expect(lage()).toEqual({ status: "success", fetchStatus: "idle", stale: false });
    expect(punkt(), "frischer Erfolg mit 2 ungelesenen — der Punkt fehlt").not.toBeNull();
    expect(kontoLabel()).toContain(i18n.t("kopfband.ungelesen", { count: 2 }));

    // DIE ALTERUNG (Codex R6): die Frischezeit läuft ab, kein Abruf, keine Nutzeraktion.
    const abrufeVorher = kanal.fn.mock.calls.length;
    await warten(STALE_MS + 100);
    expect(kanal.fn.mock.calls.length, "es gab einen neuen Abruf — der Fall misst nichts").toBe(
      abrufeVorher,
    );
    expect(lage()).toEqual({ status: "success", fetchStatus: "idle", stale: true });
    expect(punkt(), "der Punkt steht auf einem veralteten Erfolg").toBeNull();
    expect(kontoLabel()).toBe(i18n.t("kopfband.konto"));

    // Ein neuer, ruhender Erfolg bestätigt wieder → Punkt.
    await act(async () => {
      void qc.refetchQueries({ queryKey: KEY });
      await flush();
    });
    expect(lage().fetchStatus).toBe("fetching");
    expect(punkt(), "während der Auffrischung darf kein Punkt stehen").toBeNull();
    await act(async () => {
      kanal.resolve(UNGELESEN);
      await flush();
    });
    expect(lage()).toEqual({ status: "success", fetchStatus: "idle", stale: false });
    expect(punkt()).not.toBeNull();
  });

  it("KALIBRIERUNG: frischer Erfolg mit 0 ungelesen → kein Punkt", async () => {
    await mount();
    await act(async () => {
      kanal.resolve(GELESEN);
      await flush();
    });
    expect(lage()).toEqual({ status: "success", fetchStatus: "idle", stale: false });
    expect(punkt()).toBeNull();
    expect(kontoLabel()).toBe(i18n.t("kopfband.konto"));
  });

  it("(1) alter Cache mit Ungelesenen + laufende Auffrischung → KEIN Punkt, bis der Abruf ruht", async () => {
    await mount(UNGELESEN);
    // Der Cache liegt da (alt), die Auffrischung hängt: success + fetching — keine Bestätigung.
    expect(lage()).toEqual({ status: "success", fetchStatus: "fetching", stale: true });
    expect(punkt(), "der Punkt steht auf einem unbestätigten Cache").toBeNull();
    // Erst der ruhende, frische Erfolg trägt ihn.
    await act(async () => {
      kanal.resolve(UNGELESEN);
      await flush();
    });
    expect(lage()).toEqual({ status: "success", fetchStatus: "idle", stale: false });
    expect(punkt()).not.toBeNull();
  });

  it("(2) alter Cache, Neuabruf scheitert → KEIN Punkt (kein Signal aus unbestätigten Daten)", async () => {
    await mount(UNGELESEN);
    await act(async () => {
      kanal.reject(new Error("Netz weg"));
      await flush();
    });
    expect(lage().status).toBe("error");
    expect(lage().fetchStatus).toBe("idle");
    expect(punkt(), "der Punkt steht trotz gescheitertem Neuabruf").toBeNull();
    expect(kontoLabel()).toBe(i18n.t("kopfband.konto"));
  });

  it("(3) offline mit altem Cache → KEIN Punkt; wieder online und frisch bestätigt → Punkt", async () => {
    onlineManager.setOnline(false);
    await mount(UNGELESEN);
    // Offline pausiert react-query den Abruf — und der Browser ist nicht online: kein Punkt.
    expect(lage().fetchStatus).toBe("paused");
    expect(punkt(), "der Punkt steht offline auf einem alten Cache").toBeNull();
    // Zurück ins Netz: der Abruf läuft weiter und bestätigt → Punkt.
    await act(async () => {
      onlineManager.setOnline(true);
      await flush();
    });
    await act(async () => {
      kanal.resolve(UNGELESEN);
      await flush();
    });
    expect(lage()).toEqual({ status: "success", fetchStatus: "idle", stale: false });
    expect(punkt()).not.toBeNull();
  });
});
