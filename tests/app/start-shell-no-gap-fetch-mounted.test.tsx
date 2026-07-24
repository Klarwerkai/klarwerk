// @vitest-environment jsdom
// FUNKE-FIX3 P0 (bens Blocker A + Auflage 4): der bisherige Quelltext-Test gegen Start.tsx bewies
// NICHT den gemounteten Datenfluss — die global gerenderte Sidebar rief über useNavBadges weiter
// useGaps() (GET /api/gaps) auf jeder Seite auf. Hier wird der ECHTE Shell-Baum (AppShell mit
// Sidebar/Topbar/CommandPalette/Klara + Start) unter /start gemountet und per Endpoint-/Fetch-Spy
// belegt: es erfolgt KEIN Request an /api/gaps (oder einen anderen Gap-Volltext-Pfad) — nur die
// textfreie Summary (/api/gaps/summary) und der serverseitig redigierte Notifications-Feed.
// GEGENPROBE (nicht-vakuös): ein useGaps()-Probe-Mount feuert den Spy nachweislich.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../apps/web/src/api/auth")>();
  return {
    ...original,
    authApi: {
      ...original.authApi,
      status: vi.fn(async () => ({ needsSetup: false })),
      // Bewusst KEIN Admin: eine Detailrolle bekäme auf /api/gaps sogar Fragetexte — genau dieser
      // Pfad darf in der Shell gar nicht erst angefragt werden.
      me: vi.fn(async () => ({ id: "u-ex", name: "Erik", role: "experte" })),
    },
  };
});

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => []) },
    analytics: { overview: vi.fn(async () => ({ total: 0, byStatus: {} })) },
    conflicts: { list: vi.fn(async () => []) },
    duplicates: { list: vi.fn(async () => []) },
    validation: { board: vi.fn(async () => []) },
    lifecycle: { pending: vi.fn(async () => []) },
    learningPaths: { byRole: vi.fn(async () => null), progress: vi.fn(async () => []) },
    livewall: { get: vi.fn(async () => ({ fresh: [], helped: [], helpedToday: 0 })) },
    notifications: {
      // Serverseitig redigierter Feed: die redigierte Lücke trägt NIE einen Fragetext.
      list: vi.fn(async () => [
        {
          id: "gap-g1",
          kind: "gap",
          title: "",
          at: "2026-07-20T00:00:00Z",
          redacted: true,
          seen: false,
        },
      ]),
      markSeen: vi.fn(async () => ({ unseenCount: 0 })),
    },
    reasoner: {
      status: vi.fn(async () => ({ active: false, mode: "deterministic" })),
      config: vi.fn(async () => ({})),
    },
    external: { policy: vi.fn(async () => null) },
    help: { explain: vi.fn(async () => ({})) },
    gaps: {
      list: vi.fn(async () => []),
      summary: vi.fn(async () => ({ open: 2, byPriority: { hoch: 1, mittel: 1, niedrig: 0 } })),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { useGaps } from "../../apps/web/src/api/hooks";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Start } from "../../apps/web/src/pages/Start";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const gapsList = endpoints.gaps.list as unknown as ReturnType<typeof vi.fn>;
const gapsSummary = endpoints.gaps.summary as unknown as ReturnType<typeof vi.fn>;
const notificationsList = endpoints.notifications.list as unknown as ReturnType<typeof vi.fn>;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
// Letzte Auffanglinie unterhalb der gemockten Endpunkte: KEIN roher fetch() darf einen
// Gap-Volltext-Pfad ansprechen (fängt auch hypothetische Direkt-Fetches außerhalb von endpoints).
const fetchSpy = vi.fn(async (..._args: unknown[]) => {
  throw new Error("Echtes Netzwerk ist im Test verboten.");
});

function mountTree(children: ReturnType<typeof createElement>): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
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
                createElement(MemoryRouter, { initialEntries: ["/start"] }, children),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

async function settle(done: () => boolean): Promise<void> {
  for (let i = 0; i < 10 && !done(); i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 25));
    });
  }
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("FUNKE-FIX3 P0 (bens Blocker A): /start im ECHTEN Shell-Baum lädt keinen Gap-Volltext", () => {
  it("AppShell + Start: kein Request an /api/gaps — nur Summary (Zahlen) + redigierte Notifications", async () => {
    vi.stubGlobal("fetch", fetchSpy);
    mountTree(createElement(AppShell, null, createElement(Start)));
    // Session + Queries zur Ruhe kommen lassen (Summary ist der späteste erwartete Read).
    await settle(
      () => gapsSummary.mock.calls.length > 0 && notificationsList.mock.calls.length > 0,
    );

    // DIE Zusicherung: der Volltext-Pfad wird im gesamten Shell-Baum NIE angefragt.
    expect(gapsList).not.toHaveBeenCalled();
    // Nicht-vakuös: die Shell lebt — Summary (Sidebar-Badge) und Glocke haben wirklich geladen.
    expect(gapsSummary).toHaveBeenCalled();
    expect(notificationsList).toHaveBeenCalled();
    // Auffanglinie: auch kein roher fetch() an einen Gap-Volltext-Pfad (Summary wäre erlaubt).
    const rawGapCalls = fetchSpy.mock.calls
      .map((c) => String(c[0]))
      .filter((url) => url.includes("/api/gaps") && !url.includes("/api/gaps/summary"));
    expect(rawGapCalls).toEqual([]);

    // Die Glocke zeigt für die redigierte Lücke NUR die neutrale Bezeichnung, nie einen Fragetext.
    const bell = [...container.querySelectorAll("button")].find(
      (b) => b.getAttribute("aria-label") === i18n.t("topbar.notifications"),
    );
    expect(bell).toBeDefined();
    await act(async () => {
      bell?.click();
    });
    expect(container.textContent).toContain(i18n.getFixedT("de")("topbar.notifGapRedacted"));
  });

  it("GEGENPROBE: ein useGaps()-Mount feuert den Volltext-Spy — die 0 oben ist keine tote Zusicherung", async () => {
    function Probe(): null {
      useGaps();
      return null;
    }
    mountTree(createElement(Probe));
    await settle(() => gapsList.mock.calls.length > 0);
    expect(gapsList).toHaveBeenCalled();
  });

  it("Neutral-Titel der redigierten Lücke ist DE/EN/NL gepinnt", () => {
    expect(i18n.getFixedT("de")("topbar.notifGapRedacted")).toBe("Offene Wissenslücke");
    expect(i18n.getFixedT("en")("topbar.notifGapRedacted")).toBe("Open knowledge gap");
    expect(i18n.getFixedT("nl")("topbar.notifGapRedacted")).toBe("Openstaande kennislacune");
  });
});
