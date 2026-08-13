// @vitest-environment jsdom
// AUFTRAG-mega4 Block B (bens Sammel-Review 4, Auflage D9): die Navigation zeigt einen gestörten
// Refetch als gestört. bens Blocker: hatte ein Badge bereits eine Zahl und scheiterte dann der
// Refetch, blieb die alte Zahl STILL stehen (groupLoadPhase → loaded), ohne jeden Hinweis. Jetzt
// trägt NavBadge zusätzlich `stale`; die Sidebar zeigt die alte Zahl WEITER und daneben einen
// übersetzten, bedienbaren Störungshinweis mit Wiederholen. Gemountet an der ECHTEN Sidebar:
//   1) Zahl laden (loaded, Badge zeigt „2"),
//   2) Refetch scheitern lassen → alte Zahl „2" bleibt PLUS Stale-Hinweis (weder Initialfehler
//      noch stilles loaded),
//   3) Klick auf den Stale-Hinweis ruft den Refetch wirklich erneut auf.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// „channel"-Mock: jeder queryFn-Aufruf erhält ein frisches Promise; der Test steuert dessen Ausgang.
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
  // JOB 690 D2: eine Quelle, die sich SELBST auflöst (leere Id-Liste). Kein resolve/reject nach
  // außen — genau deshalb kann sie den Zustand der vier gesteuerten Kanäle nicht überschreiben.
  const sofortLeer = () => ({ fn: vi.fn(async () => [] as string[]) });
  // JOB 690 D2: die FÜNFTE Badgequelle (Lebenszyklus-Fällige). BEWUSST KEIN „channel"-Mock: der
  // Aufgaben-Badge führt sie in seiner LADEZUSTANDSLISTE, und ein Kanal, den dieser Fall nicht
  // auflöst, hielte `tasks` dauerhaft auf „loading" — die Stale-Zusicherung („alte Zahl bleibt
  // PLUS Störungshinweis") wäre dann nicht mehr erreichbar. Ein sofort auflösender Stub lässt die
  // Steuerung vollständig bei den vier vorhandenen Kanälen.
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
    // JOB 690 D2: die Attrappe ist ABSCHLIESSEND — ohne diesen Eintrag wirft useLifecyclePending
    // auf `endpoints.lifecycle.pending` (`Cannot read properties of undefined`). D1-Regression.
    lifecycle: { pending: d.lifecycle.fn },
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
import i18n from "../../apps/web/src/i18n";
import { Sidebar } from "../../apps/web/src/shell/Sidebar";

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
              NavGuardProvider,
              null,
              createElement(MemoryRouter, { initialEntries: ["/"] }, createElement(Sidebar)),
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

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block B: Navigation zeigt einen gestörten Refetch (Stale), nicht still die alte Zahl", () => {
  it("alte Zahl bleibt PLUS Störungshinweis; Retry wird wirklich aufgerufen", async () => {
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
    expect(container.querySelector(`[aria-label="${validationLabel}"]`)?.textContent).toContain(
      "2",
    );
    // Vor dem Refetch: KEIN Stale-Hinweis.
    expect(byAria(i18n.t("nav.badge.stale"))).toBeNull();

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

    // Die ALTE Zahl „2" steht weiter …
    expect(container.querySelector(`[aria-label="${validationLabel}"]`)?.textContent).toContain(
      "2",
    );
    // … UND ein übersetzter, bedienbarer Störungshinweis erscheint (kein Initialfehler, kein stilles loaded).
    const staleMarker = byAria(i18n.t("nav.badge.stale"));
    expect(staleMarker).not.toBeNull();
    expect(staleMarker?.tagName.toLowerCase()).toBe("button");
    // Kein Initialfehler-Marker (der stünde OHNE Zahl).
    expect(byAria(i18n.t("nav.badge.error"))).toBeNull();

    // (3) Klick auf den Störungshinweis ruft den Refetch wirklich erneut auf.
    const beforeRetry = d.board.fn.mock.calls.length;
    await act(async () => {
      staleMarker?.click();
      await flush();
    });
    expect(
      d.board.fn.mock.calls.length,
      "Klick auf den Stale-Hinweis stößt einen erneuten Abruf an",
    ).toBe(beforeRetry + 1);
  });
});
