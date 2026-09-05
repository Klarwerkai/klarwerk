// @vitest-environment jsdom
// AUFTRAG-mega4 Block B (bens Sammel-Review 4) → JOB 3060 · H1 (§9 Zustandsmodell des Zählers).
// Bis H1 zeigte die Seitenleiste nach einem gescheiterten Refetch die ALTE Zahl weiter, daneben
// einen „!“-Störungshinweis mit Wiederholen. Pedis Vorgabe für das Kopfband (Lieferung 6): der
// Zähler zeigt NIE eine veraltete Zahl — Fehler/Cache ohne frische Bestätigung = KEIN Badge. Der
// Punkt „Prüfen“ steht dann ohne Zahl; sobald ein Neuabruf gelingt, steht sie wieder.
//
// Gemountet am ECHTEN Kopfband über die realen Lese-Hooks: laden → Zahl → Refetch scheitert →
// keine Zahl (auch keine alte, kein „!“) → Refetch gelingt → Zahl wieder da.
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
      reject: (e: unknown) => state.reject(e),
    };
  };
  const sofortLeer = () => ({ fn: vi.fn(async () => [] as string[]) });
  return { board: mk(), conflicts: mk(), duplicates: mk(), gaps: mk(), lifecycle: sofortLeer() };
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

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
                createElement(MemoryRouter, { initialEntries: ["/"] }, createElement(Kopfband)),
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

const pruefenZaehler = (): Element | null =>
  container.querySelector('header a[data-kopfband-punkt="validierung"] .kw-kopfband-zaehler');
const byAria = (label: string): Element | null =>
  container.querySelector(`[aria-label="${label}"]`);

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block B → H1: ein gestörter Refetch zeigt KEINE alte Zahl — der Zähler verschwindet, bis ein Abruf wieder gelingt", () => {
  it("Zahl → Refetch scheitert → keine Zahl, kein „!“ → Refetch gelingt → Zahl wieder da", async () => {
    await mount();

    // (1) Zahlen laden: Board mit 2 offenen Prüfungen.
    await act(async () => {
      d.board.resolve([{ id: "a" }, { id: "b" }]);
      d.conflicts.resolve([]);
      d.duplicates.resolve([]);
      d.gaps.resolve({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } });
      await flush();
    });
    const validationLabel = i18n.t("nav.badge.validation", { count: 2 });
    expect(pruefenZaehler()?.textContent).toBe("2");
    expect(byAria(validationLabel)).not.toBeNull();

    // (2) Refetch anstoßen und scheitern lassen — die Daten sind schon da, der Refetch bricht.
    const before = d.board.fn.mock.calls.length;
    await act(async () => {
      void qc.refetchQueries({ queryKey: ["validation", "board"] });
      await flush();
    });
    expect(d.board.fn.mock.calls.length, "Refetch löst einen neuen queryFn-Aufruf aus").toBe(
      before + 1,
    );
    await act(async () => {
      d.board.reject(new Error("Refetch kaputt"));
      await flush();
    });

    // §9: die ALTE Zahl „2“ steht NICHT mehr — keine veraltete Zahl im Kopfband …
    expect(pruefenZaehler()).toBeNull();
    expect(byAria(validationLabel)).toBeNull();
    // … und kein Störungs- oder Fehlermarker an ihrer Stelle.
    expect(byAria(i18n.t("nav.badge.stale"))).toBeNull();
    expect(byAria(i18n.t("nav.badge.error"))).toBeNull();
    expect(container.querySelector("header")?.textContent).not.toContain("!");
    // Der Punkt selbst steht weiter.
    expect(container.querySelector('header a[data-kopfband-punkt="validierung"]')).not.toBeNull();

    // (3) Ein erneuter Abruf gelingt → die Zahl steht wieder (frisch bestätigt).
    await act(async () => {
      void qc.refetchQueries({ queryKey: ["validation", "board"] });
      await flush();
    });
    await act(async () => {
      d.board.resolve([{ id: "a" }, { id: "b" }, { id: "c" }]);
      await flush();
    });
    expect(pruefenZaehler()?.textContent).toBe("3");
    expect(byAria(i18n.t("nav.badge.validation", { count: 3 }))).not.toBeNull();
  });
});
