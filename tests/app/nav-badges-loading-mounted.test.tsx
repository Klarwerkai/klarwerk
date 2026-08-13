// @vitest-environment jsdom
// AUFTRAG-mega2 Block C (bens D9): die Sidebar-Badges unterscheiden „lädt" von „echte 0". Gemountet
// an der ECHTEN Sidebar über die realen Lese-Hooks:
//   VOR Auflösung der Queries → neutraler Ladepunkt (aria-label „lädt"), KEINE Zahl, KEIN 0-Badge
//   NACH Auflösung mit Zahl > 0 → echtes Zahlen-Badge, kein Ladepunkt
//   NACH Auflösung mit 0        → gar kein Badge (echtes Nullergebnis), kein Ladepunkt
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// mega3 Block B: „channel"-Mock — jeder queryFn-Aufruf erhält ein frisches Promise; der Test steuert
// dessen Ausgang (resolve/reject). So sind pending→success UND ein initialer Fehler abbildbar.
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
  // JOB 690 D2: die FÜNFTE Badgequelle (Lebenszyklus-Fällige). BEWUSST KEIN „channel"-Mock wie die
  // vier darüber, sondern ein SOFORT auflösender Stub — und das ist der ganze Trick dieser Ergänzung:
  // Der Aufgaben-Badge führt die neue Quelle in seiner LADEZUSTANDSLISTE. Ein Kanal, den keiner der
  // bestehenden Fälle auflöst, hielte `tasks` dauerhaft auf „loading" und würde genau die
  // Zusicherungen brechen, die diese Datei seit mega2/mega3 hält. Ein sofort auflösender Stub lässt
  // die Steuerung vollständig bei den vier vorhandenen Kanälen: die Gruppe ist geladen, sobald SIE
  // geladen sind, und sie ist gestört, sobald SIE stören. Damit bleibt es bei „nur die Mocks
  // ergänzen" — keine Zeile der bestehenden Fälle ändert sich.
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
    // JOB 690 D2: die Attrappe ist ABSCHLIESSEND — sie ersetzt das ganze endpoints-Modul. Ohne
    // diesen Eintrag greift useLifecyclePending auf `endpoints.lifecycle.pending` zu, findet
    // `undefined` und wirft (`Cannot read properties of undefined`). Genau daran sind die drei
    // Fälle dieser beiden Dateien in D1 gescheitert.
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

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
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

function loadingBadges(): Element[] {
  return [...container.querySelectorAll(`[aria-label="${i18n.t("nav.badge.loading")}"]`)];
}

function errorBadges(): Element[] {
  return [...container.querySelectorAll(`[aria-label="${i18n.t("nav.badge.error")}"]`)];
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block C: Nav-Badges unterscheiden Ladezustand von echter 0", () => {
  it("zeigt VOR Auflösung Ladepunkte, NACH Auflösung Zahl bzw. gar kein Badge", async () => {
    await mount();
    // VOR Auflösung: mindestens ein Ladepunkt, keine erfundene Zahl/0.
    expect(loadingBadges().length).toBeGreaterThan(0);

    // NACH Auflösung: Board mit 2 offenen Prüfungen, alles andere 0.
    await act(async () => {
      d.board.resolve([{ id: "a" }, { id: "b" }]);
      d.conflicts.resolve([]);
      d.duplicates.resolve([]);
      d.gaps.resolve({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } });
      await flush();
    });

    // Keine Ladepunkte mehr.
    expect(loadingBadges().length).toBe(0);
    // Das Validierungs-Badge zeigt jetzt die echte Zahl 2 …
    const validationLabel = i18n.t("nav.badge.validation", { count: 2 });
    const validationBadge = container.querySelector(`[aria-label="${validationLabel}"]`);
    expect(validationBadge?.textContent).toContain("2");
    // … und für die echten Nullwerte (Konflikte/Dubletten) gibt es KEIN Badge.
    expect(
      container.querySelector(`[aria-label="${i18n.t("nav.badge.conflicts", { count: 0 })}"]`),
    ).toBeNull();
  });

  it("mega3 Block B: dauerhaft gescheiterte Badge-Quelle → sichtbarer Fehler-Marker (kein Ladepunkt, keine Zahl/0)", async () => {
    await mount();
    expect(loadingBadges().length).toBeGreaterThan(0);

    await act(async () => {
      d.board.reject(new Error("kaputt"));
      d.conflicts.reject(new Error("kaputt"));
      d.duplicates.reject(new Error("kaputt"));
      d.gaps.reject(new Error("kaputt"));
      await flush();
    });

    // Kein endloser Ladepunkt mehr — stattdessen ein sichtbarer, übersetzter Fehler-Marker mit Wiederholen.
    expect(loadingBadges().length).toBe(0);
    expect(errorBadges().length).toBeGreaterThan(0);
    // Keine erfundene Zahl: das Validierungs-Badge zeigt weder eine Zahl noch eine 0.
    const validationBadge = container.querySelector(
      `[aria-label="${i18n.t("nav.badge.validation", { count: 0 })}"]`,
    );
    expect(validationBadge).toBeNull();
  });
});
