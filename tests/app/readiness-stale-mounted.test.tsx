// @vitest-environment jsdom
// AUFTRAG-mega4 Block B (bens Sammel-Review 4, Auflage D9): der GEMOUNTETE Stale-Fall für Admin/
// Bereitschaft, den ben zusätzlich verlangt (die Stale-Anzeige war implementiert, aber nicht durch
// einen gemounteten Refetch-Fehler belegt). Gemountet an der ECHTEN Admin-Seite, Bereich
// „Bereitschaft":
//   1) alle tragenden Quellen laden → Zeilen sichtbar, KEIN Stale-Hinweis,
//   2) Refetch einer bereits geladenen Quelle scheitern lassen → Daten bleiben sichtbar, dazu ein
//      übersetzter Stale-Hinweis mit Wiederholen (KEIN Initialfehler, kein stilles loaded),
//   3) Klick auf Wiederholen ruft den Refetch wirklich erneut auf.
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
  return { aiConfig: mk(), analytics: mk(), board: mk(), upload: mk(), extPolicy: mk() };
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
      admin: { factoryResetStatus: ok({ pending: false }) },
      users: { list: ok([]) },
      analytics: { overview: d.analytics.fn },
      audit: { list: ok([]), verify: ok({ ok: true }) },
      validation: {
        board: d.board.fn,
        settings: ok({ defaultNeededValidations: 3 }),
        saveSettings: ok({}),
      },
      reasoner: {
        status: ok({ active: false, mode: "deterministic", reachable: "unreachable" }),
        config: d.aiConfig.fn,
        assistPresets: ok([]),
      },
      ko: { trash: ok([]) },
      uploadLimits: { get: d.upload.fn },
      external: { policy: d.extPolicy.fn },
      duplicates: { settings: ok({ minConfidence: 0.8 }) },
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
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Admin } from "../../apps/web/src/pages/Admin";

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
              createElement(MemoryRouter, { initialEntries: ["/admin"] }, createElement(Admin)),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
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

async function click(btn: HTMLButtonElement): Promise<void> {
  await act(async () => {
    btn.click();
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

describe("Block B: Bereitschaft — gescheiterter Refetch bleibt sichtbar als Stale (nicht still loaded)", () => {
  it("Daten bleiben stehen, Stale-Hinweis + Wiederholen erscheint, Retry wird aufgerufen", async () => {
    await mount();
    await click(buttonByText(i18n.t("adm.sec.bereitschaft")));

    // (1) Alle tragenden Quellen laden → ehrliche Zeilen, KEIN Stale-Hinweis, KEIN Initialfehler.
    await act(async () => {
      d.aiConfig.resolve({
        cloudConfigured: true,
        localConfigured: false,
        taskConfig: { global: "auto", perTask: {} },
      });
      d.analytics.resolve({ total: 3, byStatus: { offen: 1, validiert: 2 } });
      d.board.resolve([]);
      d.upload.resolve({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 });
      d.extPolicy.resolve({ enabled: false, stage: "blocked" });
      await flush();
    });
    expect(container.textContent).not.toContain(i18n.t("adm.ready.loading"));
    expect(container.textContent).not.toContain(i18n.t("loadstate.stale"));
    expect(container.textContent).not.toContain(i18n.t("loadstate.error.title"));

    // (2) Refetch einer bereits geladenen Quelle anstoßen und scheitern lassen.
    const before = d.aiConfig.fn.mock.calls.length;
    await act(async () => {
      void qc.refetchQueries({ queryKey: ["reasonerConfig"] });
      await flush();
    });
    expect(d.aiConfig.fn.mock.calls.length).toBe(before + 1);
    await act(async () => {
      d.aiConfig.reject(new Error("Refetch kaputt"));
      await flush();
    });

    // Daten bleiben sichtbar (kein Initialfehlerzustand), aber als veraltet markiert, mit Wiederholen.
    expect(container.textContent).toContain(i18n.t("loadstate.stale"));
    expect(container.textContent).toContain(i18n.t("loadstate.error.retry"));
    expect(container.textContent).not.toContain(i18n.t("loadstate.error.title"));
    expect(container.textContent).not.toContain(i18n.t("adm.ready.loading"));

    // (3) Wiederholen ruft den Refetch der tragenden Quellen wirklich erneut auf.
    const beforeRetry = d.aiConfig.fn.mock.calls.length;
    await click(buttonByText(i18n.t("loadstate.error.retry")));
    expect(d.aiConfig.fn.mock.calls.length).toBe(beforeRetry + 1);
  });
});
