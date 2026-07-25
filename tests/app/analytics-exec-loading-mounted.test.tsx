// @vitest-environment jsdom
// AUFTRAG-mega2 Block C (bens D9): die Executive-Kennzahlen von Analytics sind EINE atomare Gruppe.
// Gemountet an der ECHTEN Analytics-Seite über den gemeinsamen Ladezustand-Helfer:
//   VOR Auflösung (eine Quelle offen) → alle vier Kacheln zeigen „—" (unbekannt ≠ 0)
//   NACH Auflösung (leer)             → echte Zahl 0 statt „—"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// mega3 Block B: „channel"-Mock — JEDER queryFn-Aufruf (auch ein Refetch) erhält ein FRISCHES Promise;
// der Test steuert dessen Ausgang über resolve()/reject() der ZULETZT angeforderten Runde. So sind
// pending→success (Bestand), initialer Fehler UND ein gescheiterter Refetch (stale) abbildbar.
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
  return { kos: mk(), gaps: mk(), busFactor: mk() };
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
        overview: ok({
          total: 0,
          byStatus: { offen: 0, validiert: 0 },
          byType: {},
          byCategory: {},
        }),
        impact: ok({
          validatedByWeek: [],
          validatedTotal: 0,
          askTotal: 0,
          answeredWithoutGap: 0,
          answerRate: 0,
        }),
        busfactor: d.busFactor.fn,
      },
      audit: { list: ok([]) },
      ko: { list: d.kos.fn },
      validation: { overview: ok([]) },
      gaps: { list: d.gaps.fn },
      conflicts: { list: ok([]) },
      lifecycle: { pending: ok([]) },
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
import i18n from "../../apps/web/src/i18n";
import { Analytics } from "../../apps/web/src/pages/Analytics";

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
              MemoryRouter,
              { initialEntries: ["/analytics"] },
              createElement(Analytics),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

// Wert der „validiert"-Executive-Kachel: Label-Div finden, im selben Kachel-Container den großen Wert lesen.
function execValidatedValue(): string {
  const label = [...container.querySelectorAll("div")].find(
    (el) => el.textContent === i18n.t("ana.exec.validated"),
  );
  const value = label?.parentElement?.querySelector(".text-2xl");
  return value?.textContent ?? "";
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block C: Analytics-Executive-Kennzahlen — atomarer Ladezustand statt vorschneller 0", () => {
  it("VOR Auflösung Strich, NACH Auflösung echte 0", async () => {
    await mount();
    // VOR: eine Quelle (kos/gaps/busFactor) noch offen → „—".
    expect(execValidatedValue()).toBe("—");

    await act(async () => {
      d.kos.resolve([]);
      d.gaps.resolve([]);
      d.busFactor.resolve([]);
      await flush();
    });

    // NACH: echte Zahl 0, nicht mehr „—".
    expect(execValidatedValue()).toBe("0");
  });

  it("mega3 Block B: initial gescheiterte Quelle → sichtbarer, übersetzter Fehlerzustand mit Wiederholen (kein Strich, keine 0)", async () => {
    await mount();
    await act(async () => {
      // Eine tragende Exec-Quelle scheitert dauerhaft, die anderen liefern Daten.
      d.kos.reject(new Error("kaputt"));
      d.gaps.resolve([]);
      d.busFactor.resolve([]);
      await flush();
    });
    // Ehrlicher Fehlerzustand statt endlosem „—": übersetzter Text + Wiederholen-Knopf.
    expect(container.textContent).toContain(i18n.t("loadstate.error.title"));
    expect(container.textContent).toContain(i18n.t("loadstate.error.retry"));
    // KEINE erfundene 0 in der Kachel (die Kachel ist gar nicht gerendert, weil die Gruppe im Fehler ist).
    expect(execValidatedValue()).toBe("");
  });

  it("mega3 Block B: Stale — Daten da, Refetch scheitert → Daten bleiben, Störungsmarkierung sichtbar", async () => {
    await mount();
    await act(async () => {
      d.kos.resolve([{ id: "k1", status: "validiert" }]);
      d.gaps.resolve([]);
      d.busFactor.resolve([]);
      await flush();
    });
    // Erst echte Daten (validiert-Kachel = 1).
    expect(execValidatedValue()).toBe("1");

    // Refetch anstoßen und scheitern lassen (die zuletzt angeforderte Runde rejecten).
    await act(async () => {
      void qc.invalidateQueries();
      await flush();
      d.kos.reject(new Error("refetch kaputt"));
      d.gaps.reject(new Error("refetch kaputt"));
      d.busFactor.reject(new Error("refetch kaputt"));
      await flush();
    });

    // Daten BLEIBEN sichtbar (kein Sturz in den Initialfehler) …
    expect(execValidatedValue()).toBe("1");
    // … aber als veraltet/gestört markiert.
    expect(container.textContent).toContain(i18n.t("loadstate.stale"));
  });
});
