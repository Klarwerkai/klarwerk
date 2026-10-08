// @vitest-environment jsdom
// ================================================================================================
// R-1029 / R-1674 (FE-FND-08, N-3) — GETEILTE STÄNDE KOMMEN VON SELBST NACH, MIT BESTÄTIGTER SITZUNG.
// ================================================================================================
//
// `kopfzaehler-frische-mounted.test.tsx` misst die Frist am Kopfband OHNE Nachlader: nach 35 s ohne
// Abruf ist die Zahl weg. Diese Datei misst denselben Ort MIT `GeteilterStandNachlader`, wie ihn
// `App.tsx` hinter dem Tor montiert: die geteilten Stände werden im Takt nachgefragt, die Zahl bleibt
// bestätigt stehen — und ein ANDERSWO geänderter Stand erscheint ohne Zutun.
//
// Dazu die Grenzen, die der Nachlader zusagt: keine Abrufe ohne bestätigte Sitzung, keine während
// einer laufenden Änderung (die sofortige Rückmeldung wird nicht überholt), keine im verdeckten Tab
// und offline, und NUR die geteilten Stände — eine Volltextabfrage wie `["gaps"]` bleibt unberührt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => {
  const zustand = {
    board: [{ id: "a" }, { id: "b" }] as { id: string }[],
    me: { id: "u1", name: "Pia", email: "p@x.de", role: "admin" } as unknown,
  };
  return {
    zustand,
    board: vi.fn(async () => zustand.board),
    notifications: vi.fn(async () => [] as unknown[]),
    gapsList: vi.fn(async () => [] as unknown[]),
  };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => d.zustand.me),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    validation: { board: d.board },
    conflicts: { list: vi.fn(async () => []) },
    duplicates: { list: vi.fn(async () => []) },
    gaps: {
      summary: vi.fn(async () => ({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } })),
      list: d.gapsList,
    },
    lifecycle: { pending: vi.fn(async () => [] as string[]) },
    notifications: { list: d.notifications, markSeen: vi.fn(async () => ({})) },
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
  onlineManager,
  useMutation,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { Fragment, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { useGaps, useNotifications, useValidationBoard } from "../../apps/web/src/api/hooks";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import {
  GETEILTER_STAND_TAKT_MS,
  GeteilterStandNachlader,
  nachladenFaellig,
} from "../../apps/web/src/app/GeteilterStandNachlader";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { ZAEHLER_FRISCHE_MS } from "../../apps/web/src/lib/loadingState";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Nur die Fälle, die wirklich montieren, setzen beides; die reinen Regel-Fälle bleiben ohne Baum.
let container: HTMLDivElement | undefined;
let root: ReturnType<typeof createRoot> | undefined;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await vi.advanceTimersByTimeAsync(0);
  }
};

/** Zeit vergehen lassen — die fälligen Abrufe werden dabei zwischen den Takten beantwortet. */
async function vergehen(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    await flush();
  });
}

// Eine laufende Änderung, deren Ende der Test bestimmt.
const aenderung = { starten: () => {}, beenden: () => {} };

function Probe(): null {
  useValidationBoard();
  useNotifications();
  // Volltext der Lücken — KEIN geteilter Stand der Hülle; der Nachlader darf ihn nicht anfassen.
  useGaps();
  const m = useMutation({
    mutationFn: () =>
      new Promise<void>((fertig) => {
        aenderung.beenden = fertig;
      }),
  });
  aenderung.starten = () => m.mutate();
  return null;
}

async function mount(inhalt: ReturnType<typeof createElement>): Promise<void> {
  const neu = document.createElement("div");
  document.body.appendChild(neu);
  const wurzel = createRoot(neu);
  container = neu;
  root = wurzel;
  // Wie in `main.tsx`: dieselbe Frist als `staleTime`.
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: ZAEHLER_FRISCHE_MS } },
  });
  await act(async () => {
    wurzel.render(
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
                  { initialEntries: ["/"] },
                  createElement(Fragment, null, createElement(GeteilterStandNachlader), inhalt),
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

const kopfbandZaehler = (): Element | null | undefined =>
  container?.querySelector('header a[data-kopfband-punkt="validierung"] .kw-kopfband-zaehler');

beforeEach(async () => {
  vi.useFakeTimers();
  await i18n.changeLanguage("de");
  d.zustand.board = [{ id: "a" }, { id: "b" }];
  d.zustand.me = { id: "u1", name: "Pia", email: "p@x.de", role: "admin" };
});

afterEach(async () => {
  const montiert = root;
  if (montiert) {
    await act(async () => {
      montiert.unmount();
    });
  }
  container?.remove();
  root = undefined;
  container = undefined;
  Reflect.deleteProperty(document, "visibilityState");
  onlineManager.setOnline(true);
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("R-1029 / R-1674: geteilte Stände werden bei bestätigter Sitzung nachgeladen", () => {
  it("der Takt liegt unter der Frist der Zähler — eine Zahl wird bestätigt, bevor sie ungedeckt ist", () => {
    expect(GETEILTER_STAND_TAKT_MS).toBeGreaterThan(0);
    expect(GETEILTER_STAND_TAKT_MS).toBeLessThan(ZAEHLER_FRISCHE_MS);
  });

  it("die Regel: nur bestätigte Sitzung, online, sichtbar und ohne laufende Änderung", () => {
    const basis = { sitzungBestaetigt: true, online: true, sichtbar: true, laufendeAenderungen: 0 };
    expect(nachladenFaellig(basis)).toBe(true);
    expect(nachladenFaellig({ ...basis, sitzungBestaetigt: false })).toBe(false);
    expect(nachladenFaellig({ ...basis, online: false })).toBe(false);
    expect(nachladenFaellig({ ...basis, sichtbar: false })).toBe(false);
    expect(nachladenFaellig({ ...basis, laufendeAenderungen: 1 })).toBe(false);
  });

  it("am echten Kopfband: nach 35 s steht die Zahl bestätigt da, und ein anderswo geänderter Stand erscheint", async () => {
    await mount(createElement(Kopfband));
    expect(kopfbandZaehler()?.textContent).toBe("2");
    const vorher = d.board.mock.calls.length;

    // Ohne Nachlader wäre die Zahl hier weg (kopfzaehler-frische-mounted.test.tsx). Mit ihm wurde
    // sie im Takt neu beim Server bestätigt.
    await vergehen(35_000);
    expect(d.board.mock.calls.length).toBeGreaterThan(vorher);
    expect(kopfbandZaehler()?.textContent).toBe("2");

    // Jemand anderes legt eine weitere Prüfung an — die offene Seite zeigt sie nach einem Takt.
    d.zustand.board = [{ id: "a" }, { id: "b" }, { id: "c" }];
    await vergehen(GETEILTER_STAND_TAKT_MS);
    expect(kopfbandZaehler()?.textContent).toBe("3");
  });

  it("nur die geteilten Stände werden nachgefragt — die Volltextabfrage der Lücken nicht", async () => {
    await mount(createElement(Probe));
    const board = d.board.mock.calls.length;
    const meldungen = d.notifications.mock.calls.length;
    const luecken = d.gapsList.mock.calls.length;
    expect(luecken).toBeGreaterThan(0);

    await vergehen(GETEILTER_STAND_TAKT_MS + 1_000);
    expect(d.board.mock.calls.length).toBe(board + 1);
    expect(d.notifications.mock.calls.length).toBe(meldungen + 1);
    expect(d.gapsList.mock.calls.length, "Volltext bleibt unberührt").toBe(luecken);
  });

  it("ohne bestätigte Sitzung geht kein einziger Nachlade-Abruf ab", async () => {
    d.zustand.me = null;
    await mount(createElement(Probe));
    const vorher = d.board.mock.calls.length;
    await vergehen(3 * GETEILTER_STAND_TAKT_MS);
    expect(d.board.mock.calls.length).toBe(vorher);
  });

  it("eine laufende Änderung wird nicht überholt — danach gleicht der nächste Takt mit dem Server ab", async () => {
    await mount(createElement(Probe));
    const vorher = d.board.mock.calls.length;

    await act(async () => {
      aenderung.starten();
      await flush();
    });
    await vergehen(GETEILTER_STAND_TAKT_MS + 1_000);
    expect(d.board.mock.calls.length, "kein Abruf während der Änderung").toBe(vorher);

    await act(async () => {
      aenderung.beenden();
      await flush();
    });
    await vergehen(GETEILTER_STAND_TAKT_MS);
    expect(d.board.mock.calls.length).toBe(vorher + 1);
  });

  it("im verdeckten Tab ruht der Takt", async () => {
    await mount(createElement(Probe));
    const vorher = d.board.mock.calls.length;
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    await vergehen(3 * GETEILTER_STAND_TAKT_MS);
    expect(d.board.mock.calls.length).toBe(vorher);
  });

  it("offline ruht der Takt", async () => {
    await mount(createElement(Probe));
    const vorher = d.board.mock.calls.length;
    await act(async () => {
      onlineManager.setOnline(false);
      await flush();
    });
    await vergehen(3 * GETEILTER_STAND_TAKT_MS);
    expect(d.board.mock.calls.length).toBe(vorher);
  });
});
