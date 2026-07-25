// @vitest-environment jsdom
// AUFTRAG-mega2 Block C (bens D9): die Startseite behauptet vor der Datenladung KEIN „nichts zu tun"
// (echte 0) mehr. Gemountet an der ECHTEN Start-Seite:
//   VOR Auflösung der tragenden Queries → ehrlicher Ladezustand (start.todoLoading), kein „todoEmpty"
//   NACH Auflösung (leer)               → echter Leerzustand (start.todoEmpty), kein Ladezustand
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// mega3 Block B: „channel"-Mock — jeder queryFn-Aufruf (auch Refetch) erhält ein frisches Promise;
// der Test steuert dessen Ausgang (resolve/reject). Ermöglicht pending→success, Initialfehler und Stale.
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
  return { board: mk(), conflicts: mk(), pending: mk(), gaps: mk() };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      analytics: {
        overview: ok({ total: 0, byStatus: { offen: 0, validiert: 0 } }),
      },
      validation: { board: d.board.fn },
      conflicts: { list: d.conflicts.fn },
      lifecycle: { pending: d.pending.fn },
      gaps: { summary: d.gaps.fn },
      ko: { list: ok([]) },
      learningPaths: { byRole: ok(null), progress: ok(null) },
      livewall: { get: ok({ saved: [], helped: [], helpedToday: 0 }) },
      reasoner: { config: ok(null), assistPresets: ok([]), status: ok(null) },
    },
  };
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
import { Start } from "../../apps/web/src/pages/Start";

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
                createElement(MemoryRouter, { initialEntries: ["/"] }, createElement(Start)),
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

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block C: Start-Arbeitsübersicht zeigt ehrlichen Ladezustand statt vorschneller 0", () => {
  it("VOR Auflösung Ladezustand, NACH Auflösung echter Leerzustand", async () => {
    await mount();
    // VOR: Ladezustand, KEIN „nichts offen".
    expect(container.textContent).toContain(i18n.t("start.todoLoading"));
    expect(container.textContent).not.toContain(i18n.t("start.todoEmpty"));

    // NACH: alle tragenden Quellen leer aufgelöst → echter Leerzustand.
    await act(async () => {
      d.board.resolve([]);
      d.conflicts.resolve([]);
      d.pending.resolve([]);
      d.gaps.resolve({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } });
      await flush();
    });

    expect(container.textContent).not.toContain(i18n.t("start.todoLoading"));
    expect(container.textContent).toContain(i18n.t("start.todoEmpty"));
  });

  it("mega3 Block B: initial gescheiterte tragende Quelle → Fehlerzustand mit Wiederholen, kein „lädt“, kein „nichts zu tun“", async () => {
    await mount();
    expect(container.textContent).toContain(i18n.t("start.todoLoading"));

    await act(async () => {
      d.board.reject(new Error("kaputt"));
      d.conflicts.resolve([]);
      d.pending.resolve([]);
      d.gaps.resolve({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } });
      await flush();
    });

    // Ehrlicher Fehlerzustand statt endlosem „lädt" oder vorschnellem Leerzustand.
    expect(container.textContent).toContain(i18n.t("loadstate.error.title"));
    expect(container.textContent).toContain(i18n.t("loadstate.error.retry"));
    expect(container.textContent).not.toContain(i18n.t("start.todoLoading"));
    expect(container.textContent).not.toContain(i18n.t("start.todoEmpty"));
  });

  it("mega3 Block B: Stale — Daten da, Refetch scheitert → Übersicht bleibt, Störungsmarkierung sichtbar", async () => {
    await mount();
    await act(async () => {
      d.board.resolve([]);
      d.conflicts.resolve([]);
      d.pending.resolve([]);
      d.gaps.resolve({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } });
      await flush();
    });
    // Echter Leerzustand geladen.
    expect(container.textContent).toContain(i18n.t("start.todoEmpty"));

    await act(async () => {
      void qc.invalidateQueries();
      await flush();
      d.board.reject(new Error("refetch kaputt"));
      d.conflicts.reject(new Error("refetch kaputt"));
      d.pending.reject(new Error("refetch kaputt"));
      d.gaps.reject(new Error("refetch kaputt"));
      await flush();
    });

    // Daten bleiben sichtbar (kein Initialfehler-Sturz) …
    expect(container.textContent).toContain(i18n.t("start.todoEmpty"));
    // … aber als veraltet/gestört markiert.
    expect(container.textContent).toContain(i18n.t("loadstate.stale"));
  });
});
