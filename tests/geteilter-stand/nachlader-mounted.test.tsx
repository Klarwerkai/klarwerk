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
//
// Nacharbeit 2 (Bens Befund): auch die geteilten LISTEN der Bibliothek — `useLibrarySearch` und
// `useKos`, dieselben Haken wie `BibliothekFlaeche.tsx:551/573` — übernehmen eine anderswo geänderte
// Liste ohne Fokuswechsel und ohne Neuladen. Lokale Bearbeitungen bleiben dabei erhalten: der Zustand
// der Fläche ohnehin, und ein örtlich geschriebener Listenstand, solange seine Änderung läuft.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Eintrag = { id: string; title: string };

const d = vi.hoisted(() => {
  const zustand = {
    board: [{ id: "a" }, { id: "b" }] as { id: string }[],
    me: { id: "u1", name: "Pia", email: "p@x.de", role: "admin" } as unknown,
    suche: [{ id: "k1", title: "Ventil F3 prüfen" }] as { id: string; title: string }[],
    bestand: [{ id: "k1", title: "Ventil F3 prüfen" }] as { id: string; title: string }[],
    luecken: [{ id: "g1" }, { id: "g2" }] as { id: string }[],
  };
  return {
    zustand,
    board: vi.fn(async () => zustand.board),
    notifications: vi.fn(async () => [] as unknown[]),
    gapsList: vi.fn(async () => zustand.luecken),
    dupSettings: vi.fn(async () => ({ schwelle: 0.8 })),
    suche: vi.fn(async () => zustand.suche),
    kosList: vi.fn(async () => zustand.bestand),
    koGet: vi.fn(async () => ({ id: "k1", title: "Ventil F3 prüfen" })),
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
    library: { search: d.suche },
    ko: { list: d.kosList, get: d.koGet },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
  useMutation,
  useQuery,
  useQueryClient,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { Fragment, act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import {
  useGaps,
  useKo,
  useKos,
  useLibrarySearch,
  useNotifications,
  useValidationBoard,
} from "../../apps/web/src/api/hooks";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import {
  GETEILTER_STAND_TAKT_MS,
  GETEILTE_LISTEN_TAKT_MS,
  GeteilterStandNachlader,
  keineEinstellung,
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

function Probe(): JSX.Element {
  useValidationBoard();
  useNotifications();
  // Die Lückenliste, wie Risiko- und Aufgabenfläche sie zeigen (`Risk.tsx`, `MyTasks.tsx`) — eine
  // geteilte LISTE, nachgeladen im Listentakt (Nacharbeit 3, Bens Befund).
  const luecken = useGaps();
  // Ein Einstellungsformular unter demselben Präfix wie die Dubletten — darf NIE nachgeladen werden.
  useQuery({ queryKey: ["duplicates", "settings"], queryFn: d.dupSettings });
  const m = useMutation({
    mutationFn: () =>
      new Promise<void>((fertig) => {
        aenderung.beenden = fertig;
      }),
  });
  aenderung.starten = () => m.mutate();
  return createElement(
    "p",
    { "data-testid": "luecken" },
    String((luecken.data as unknown[] | undefined)?.length ?? ""),
  );
}

// Örtliche Eingriffe der Listenprobe — ein ungespeicherter Text der Fläche und ein örtlich
// geschriebener Listenstand (die Bauform von `Validation.tsx` `removeDeletedKoFromCaches`).
const liste = { notizSetzen: (_t: string) => {}, lokalSchreiben: () => {} };

/** Die Bibliothek im Kleinen: dieselben Haken, die Liste als Text, daneben eine offene Eingabe. */
function ListenProbe(): JSX.Element {
  const qc = useQueryClient();
  const suche = useLibrarySearch({ q: "" });
  const bestand = useKos();
  // Die Lesefläche — eine Detailabfrage, KEIN geteilter Listenstand.
  useKo("k1");
  const [notiz, setNotiz] = useState("");
  const m = useMutation({
    mutationFn: () =>
      new Promise<void>((fertig) => {
        aenderung.beenden = fertig;
      }),
  });
  aenderung.starten = () => m.mutate();
  liste.notizSetzen = setNotiz;
  liste.lokalSchreiben = () => {
    qc.setQueriesData<Eintrag[]>({ queryKey: ["library", "search"] }, (alt) =>
      alt?.map((k) => (k.id === "k1" ? { ...k, title: "örtlich umbenannt" } : k)),
    );
  };
  const titel = ((suche.data ?? []) as Eintrag[]).map((k) => k.title).join(" | ");
  return createElement(
    "div",
    null,
    createElement("p", { "data-testid": "suche" }, titel),
    createElement("p", { "data-testid": "bestand" }, String(bestand.data?.length ?? "")),
    createElement("p", { "data-testid": "notiz" }, notiz),
  );
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
  d.zustand.suche = [{ id: "k1", title: "Ventil F3 prüfen" }];
  d.zustand.bestand = [{ id: "k1", title: "Ventil F3 prüfen" }];
  d.zustand.luecken = [{ id: "g1" }, { id: "g2" }];
});

const text = (testid: string): string | null | undefined =>
  container?.querySelector(`[data-testid="${testid}"]`)?.textContent;

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

  it("Hülle im Hüllentakt, Lückenliste im Listentakt — eine anderswo geschlossene Lücke verschwindet ohne Fokuswechsel", async () => {
    await mount(createElement(Probe));
    expect(text("luecken")).toBe("2");
    const board = d.board.mock.calls.length;
    const meldungen = d.notifications.mock.calls.length;
    const luecken = d.gapsList.mock.calls.length;
    const einstellungen = d.dupSettings.mock.calls.length;
    expect(luecken).toBeGreaterThan(0);

    // Eine andere Person schließt Lücke g2. Hier wird weder fokussiert noch neu geladen.
    d.zustand.luecken = [{ id: "g1" }];

    await vergehen(GETEILTER_STAND_TAKT_MS + 1_000);
    expect(d.board.mock.calls.length).toBe(board + 1);
    expect(d.notifications.mock.calls.length).toBe(meldungen + 1);

    await vergehen(GETEILTE_LISTEN_TAKT_MS);
    expect(d.gapsList.mock.calls.length).toBeGreaterThan(luecken);
    expect(text("luecken"), "die geschlossene Lücke ist von der offenen Fläche weg").toBe("1");
    // Das Einstellungsformular unter `["duplicates"]` blieb in beiden Takten unberührt.
    expect(d.dupSettings.mock.calls.length).toBe(einstellungen);
  });

  it("Einstellungsabfragen sind an jedem Präfix ausgenommen", () => {
    expect(keineEinstellung(["duplicates", "settings"])).toBe(false);
    expect(keineEinstellung(["validation", "settings"])).toBe(false);
    expect(keineEinstellung(["duplicates"])).toBe(true);
    expect(keineEinstellung(["gaps"])).toBe(true);
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

describe("Nacharbeit 2 · geteilte Listen der Bibliothek werden bei bestätigter Sitzung nachgeladen", () => {
  it("der Listentakt ist gesetzt und ruhiger als der Hüllentakt (große Antworten, NFR-PERF-01)", () => {
    expect(GETEILTE_LISTEN_TAKT_MS).toBeGreaterThan(GETEILTER_STAND_TAKT_MS);
  });

  it("eine anderswo geänderte Liste erscheint ohne Fokuswechsel und ohne Neuladen", async () => {
    await mount(createElement(ListenProbe));
    expect(text("suche")).toBe("Ventil F3 prüfen");
    expect(text("bestand")).toBe("1");
    const detailAbrufe = d.koGet.mock.calls.length;
    expect(detailAbrufe).toBeGreaterThan(0);

    // Eine Kollegin legt anderswo einen Eintrag an. Hier wird weder fokussiert noch neu geladen.
    d.zustand.suche = [
      { id: "k1", title: "Ventil F3 prüfen" },
      { id: "k2", title: "Pumpe P7 entlüften" },
    ];
    d.zustand.bestand = [...d.zustand.suche];

    await vergehen(GETEILTE_LISTEN_TAKT_MS + 1_000);
    expect(text("suche")).toBe("Ventil F3 prüfen | Pumpe P7 entlüften");
    expect(text("bestand")).toBe("2");
    // Die Lesefläche (Detailabfrage) ist kein geteilter Listenstand und bleibt unberührt.
    expect(d.koGet.mock.calls.length).toBe(detailAbrufe);
  });

  it("lokale Bearbeitungen bleiben erhalten — der Abgleich folgt erst nach der Änderung", async () => {
    await mount(createElement(ListenProbe));
    // (1) Ungespeicherter Text der Fläche und ein örtlich geschriebener Listenstand mit laufender
    //     Änderung.
    await act(async () => {
      liste.notizSetzen("noch nicht gespeichert");
      aenderung.starten();
      liste.lokalSchreiben();
      await flush();
    });
    expect(text("suche")).toBe("örtlich umbenannt");
    const vorher = d.suche.mock.calls.length;
    d.zustand.suche = [{ id: "k1", title: "Serverstand" }];

    // (2) Ein voller Listentakt vergeht — kein Abruf überholt die laufende Änderung.
    await vergehen(GETEILTE_LISTEN_TAKT_MS + 1_000);
    expect(d.suche.mock.calls.length, "kein Abruf während der Änderung").toBe(vorher);
    expect(text("suche")).toBe("örtlich umbenannt");
    expect(text("notiz")).toBe("noch nicht gespeichert");

    // (3) Die Änderung ist durch — der nächste Takt gleicht mit dem Server ab, der Text der Fläche
    //     bleibt unberührt.
    await act(async () => {
      aenderung.beenden();
      await flush();
    });
    await vergehen(GETEILTE_LISTEN_TAKT_MS);
    expect(d.suche.mock.calls.length).toBe(vorher + 1);
    expect(text("suche")).toBe("Serverstand");
    expect(text("notiz")).toBe("noch nicht gespeichert");
  });

  it("ohne bestätigte Sitzung bleibt auch die Liste ohne Nachlade-Abruf", async () => {
    d.zustand.me = null;
    await mount(createElement(ListenProbe));
    const vorher = d.suche.mock.calls.length;
    await vergehen(2 * GETEILTE_LISTEN_TAKT_MS);
    expect(d.suche.mock.calls.length).toBe(vorher);
  });
});
