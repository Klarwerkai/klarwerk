// @vitest-environment jsdom
// ================================================================================================
// JOB 3084 (Q6) — CODEX' WEG, NACHGEBAUT: FRISCH LADEN → NETZ TRENNEN → WIEDER ANSEHEN.
// ================================================================================================
//
// Der Befund R-1585 (Codex, 05.09.2026, https://app.klarwerk.ai, 1.0.0-beta.1.92, Administrator)
// nennt genau diese Schrittfolge: „/wissen/… frisch laden; Netz trennen; Start; Browser zurück;
// 2s warten." Er ist NICHT über einen abgelehnten Abruf entstanden — es wurde gar keiner gewollt.
// Innerhalb der `staleTime` von 30 s (`apps/web/src/main.tsx:21`) meldet TanStack Query
// `fetchStatus: "idle"`, und daraus las die Regel „frisch".
//
// DESHALB WIRD HIER KEIN `refetchQueries` GEFAHREN. Die bestehenden Offline-Fälle in
// `tests/ko/job3025-a27-mounted.test.tsx` (R-g-*) stoßen immer einen Abruf an und messen damit den
// Fall `fetchStatus: "paused"` — genau den, den die Regel schon kannte. Hier bleibt der
// Zwischenspeicher RUHEND, und das ist der Unterschied zwischen dem alten Prüfstand und dem Befund.
// `zustandDerQuellen()` weist unten wörtlich nach, dass die drei Abfragen dabei wirklich `idle`
// stehen — sonst wäre diese Datei nur eine zweite Fassung von R-g-*.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  rolle: "experte" as "experte" | "controller" | "admin",
  kanal: {} as Record<"kos" | "conflicts" | "signal", () => Promise<unknown>>,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: box.rolle })),
    logout: vi.fn(async () => ({})),
  },
}));

const KO = {
  id: "ko-1",
  title: "Pumpe entlüften",
  statement: "Nach dem Anfahren 10 Sekunden warten.",
  conditions: [],
  measures: [],
  type: "best_practice",
  category: "Wartung",
  tags: [],
  confidence: 0,
  trust: 0,
  status: "validiert",
  version: 1,
  author: "u1",
  originalAuthor: "u1",
  neededValidations: 2,
  assignments: [],
  asset: null,
  history: [],
  createdAt: "2026-08-01T00:00:00.000Z",
};

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => KO),
        list: vi.fn(() => box.kanal.kos()),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async () => KO),
      },
      conflicts: { list: vi.fn(() => box.kanal.conflicts()) },
      duplicateSignal: { list: vi.fn(() => box.kanal.signal()) },
      audit: { list: leer },
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Eva" }]) },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({ text: "" })),
        assistPresets: leer,
        extract: vi.fn(async () => ({ points: [], note: null })),
        describeImage: vi.fn(async () => ({})),
      },
      aiCheck: { coverageSummary: vi.fn(async () => ({ total: 0 })) },
    },
  };
});

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import {
  MemoryRouter,
  Route,
  Routes,
  useNavigate,
} from "../../apps/web/node_modules/react-router-dom";
import type { Conflict, EigenerBefund } from "../../apps/web/src/api/types";
import { AuthProvider, useSession } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider, useRole } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { KnowledgeDetail } from "../../apps/web/src/pages/KnowledgeDetail";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

type QuellenName = "kos" | "conflicts" | "signal";
const QUELLEN: readonly QuellenName[] = ["kos", "conflicts", "signal"];

/** Die Query-Keys, wie die Hooks sie wirklich bilden (api/hooks.ts). */
const KEY: Record<QuellenName, readonly unknown[]> = {
  kos: ["kos", undefined],
  conflicts: ["conflicts"],
  signal: ["duplicate-signal"],
};

const BEIDES: EigenerBefund = {
  koId: "ko-1",
  dublette: true,
  konflikt: true,
  deckung: { lage: "vollstaendig", geprueft: 12, bestand: 40 },
};
const KONFLIKT_EINTRAG: Conflict = {
  id: "c-1",
  koA: "ko-1",
  koB: "ko-geheim-9",
  type: "truth",
  description: "Die Gegenseite behauptet 6 bar.",
  status: "offen",
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  createdAt: "2026-09-01T00:00:00Z",
};

const leerAntwort = async (): Promise<unknown> => [];
const haengt = (): Promise<never> => new Promise<never>(() => {});

function Probe(): JSX.Element {
  const { role } = useRole();
  const { user } = useSession();
  return createElement("span", { "data-probe": "1" }, `${role}/${user?.role ?? "kein-user"}`);
}

const wirksameRolle = (): string => container.querySelector("[data-probe]")?.textContent ?? "";

/**
 * DER WEG WEG UND ZURÜCK — zwei echte Knöpfe im Baum (Runde 2, Korrekturpflicht 1 von Ben).
 *
 * Runde 1 hat nach `netzTrennen()` denselben, durchgehend gemounteten Baum noch einmal gelesen. Das
 * misst, dass die Auskunft auf das Ereignis reagiert — aber NICHT den Weg aus dem Befund („Start;
 * Browser zurück"). Beim Zurückkommen wird die Lesefläche neu angebaut: `KnowledgeDetail` läuft von
 * vorn, die drei Abfragen werden NEU abonniert, und erst dann entscheidet sich, ob die Auskunft
 * wieder aus einem ruhenden Zwischenspeicher spricht. Genau das fahren `L-9`/`L-10` jetzt ab.
 *
 * `useNavigate` und nicht `initialEntries`: ein zweiter `MemoryRouter` wäre ein zweiter Baum, kein
 * Seitenwechsel. So wandert derselbe Router wirklich von der Lesefläche fort und wieder hin.
 */
function Weg(): JSX.Element {
  const navigate = useNavigate();
  return createElement("div", null, [
    createElement(
      "button",
      { key: "w", type: "button", "data-testid": "nav-weg", onClick: () => navigate("/anderswo") },
      "weg",
    ),
    createElement(
      "button",
      {
        key: "z",
        type: "button",
        "data-testid": "nav-zurueck",
        onClick: () => navigate("/wissen/ko-1"),
      },
      "zurück",
    ),
  ]);
}

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
                createElement(MemoryRouter, { initialEntries: ["/wissen/ko-1"] }, [
                  createElement(Weg, { key: "w" }),
                  createElement(Routes, { key: "r" }, [
                    createElement(Route, {
                      key: "detail",
                      path: "/wissen/:id",
                      element: createElement("div", null, [
                        createElement(Probe, { key: "p" }),
                        createElement(KnowledgeDetail, { key: "d" }),
                      ]),
                    }),
                    // Die Gegenseite des Seitenwechsels. Bewusst eine leere Marke und keine echte
                    // Seite: gemessen wird der WEG von der Lesefläche fort, nicht das Ziel.
                    createElement(Route, {
                      key: "anderswo",
                      path: "/anderswo",
                      element: createElement("div", { "data-testid": "anderswo" }, "anderswo"),
                    }),
                  ]),
                ]),
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

function bereich(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-testid="job3025-kollision"]');
  if (!el) {
    throw new Error("Der Kollisionsbereich fehlt auf der Lesefläche");
  }
  return el;
}

/** Anders als `bereich()` wirft das nicht — gebraucht für „die Fläche ist wirklich fort". */
const bereichVorhanden = (): boolean =>
  container.querySelector('[data-testid="job3025-kollision"]') !== null;

const text = (): string => (bereich().textContent ?? "").replace(/\s+/g, " ");

/** Einen echten Knopf im Baum drücken und den Baum ausrechnen lassen. */
async function klick(testId: string): Promise<void> {
  const knopf = container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
  if (!knopf) {
    throw new Error(`Knopf ${testId} fehlt im Baum`);
  }
  await act(async () => {
    knopf.click();
    await flush();
  });
  await act(flush);
}

/**
 * DER WIEDEREINSTIEG OHNE ROUTER: Baum ab, Baum neu — mit DEMSELBEN `QueryClient`.
 *
 * Das ist der zweite Weg zurück auf die Fläche, und er ist strenger als der Routenwechsel: hier
 * überlebt vom vorigen Besuch NICHTS außer dem Zwischenspeicher. Ein Rest im React-Zustand könnte
 * das Ergebnis also nicht mehr tragen — die Auskunft entsteht ausschließlich aus dem, was der
 * Speicher hergibt, plus dem Onlinezustand.
 */
async function neuBetreten(): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  await mount();
}

/**
 * DER SCHRITT AUS DEM BEFUND: das Netz fällt weg, und sonst geschieht NICHTS. Kein `refetchQueries`,
 * kein `cancelQueries` — genau wie beim Zurückkommen auf die Seite innerhalb der `staleTime`.
 */
async function netzTrennen(): Promise<void> {
  await act(async () => {
    onlineManager.setOnline(false);
    await flush();
  });
}

/** Was TanStack Query in diesem Moment WIRKLICH meldet — die Kalibrierung dieser ganzen Datei. */
function zustandDerQuellen(): Record<QuellenName, string> {
  const aus: Partial<Record<QuellenName, string>> = {};
  for (const q of QUELLEN) {
    const s = qc.getQueryState(KEY[q]);
    aus[q] = `${s?.status}/${s?.fetchStatus}`;
  }
  return aus as Record<QuellenName, string>;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.rolle = "experte";
  box.kanal = { kos: leerAntwort, conflicts: leerAntwort, signal: leerAntwort };
  onlineManager.setOnline(true);
  // Dieselbe Frist wie im Betrieb (`main.tsx:21`) — und nicht `Infinity` wie in den Dateien von
  // JOB 3025. `Infinity` wäre hier keine Vereinfachung, sondern die Verfälschung des Befunds: die
  // 30 Sekunden SIND der Fall (§2c des Auftrags), innerhalb derer kein Abruf gewollt wird.
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  qc.clear();
  onlineManager.setOnline(true);
  vi.clearAllMocks();
});

// ------------------------------------------------------------------------------------------------
// (4b) — der gemessene Weg des Befunds, an der Lesefläche
// ------------------------------------------------------------------------------------------------

describe("JOB 3084 · Lesefläche: frisch geladen, dann Netz weg", () => {
  it("L-0 · KALIBRIERUNG: online steht die Verneinung — und die Abfragen ruhen wirklich", async () => {
    await mount();
    expect(zustandDerQuellen()).toEqual({
      kos: "success/idle",
      conflicts: "success/idle",
      signal: "success/idle",
    });
    expect(text()).toContain(i18n.t("kollision.detail.keine"));
  });

  // WAS DIESER FALL MISST, GENAU: die Fläche steht durchgehend offen, und das Netz fällt weg. Er
  // misst damit die REAKTION auf das Ereignis — nicht den Rückkehrweg des Befunds. Der Rückkehrweg
  // („Start; Browser zurück") wird ab L-9 gefahren, mit einem echten Seitenwechsel und einem echten
  // Wiedereinstieg. Runde 1 hatte hier nur diesen Fall und die Rückgabe nannte ihn irrtümlich den
  // gemessenen Weg des Befunds; Ben hat das aufgedeckt (Runde 1, Korrekturpflicht 1).
  it("L-1 · Netz fällt weg, während die Fläche offen steht → die Verneinung verstummt sofort", async () => {
    await mount();
    await netzTrennen();
    // Der Nachweis, dass hier NICHT der alte `paused`-Fall gemessen wird: die drei Abfragen ruhen.
    expect(
      zustandDerQuellen(),
      "kein Abruf ist gewollt — sonst wäre dies R-g-* von JOB 3025",
    ).toEqual({ kos: "success/idle", conflicts: "success/idle", signal: "success/idle" });
    expect(text()).not.toContain(i18n.t("kollision.detail.keine"));
    expect(text()).toContain(i18n.t("kollision.lage.pausiert"));
  });

  it("L-2 · offline gibt es keinen Wiederholen-Knopf — jeder Versuch müsste scheitern", async () => {
    await mount();
    await netzTrennen();
    expect(bereich().querySelector('[data-testid="bib-kollision-wiederholen"]')).toBeNull();
  });

  it("L-3 · offline steht auch keine Deckungszahl mehr da (sie hängt an derselben Regel)", async () => {
    box.kanal.signal = async () => [BEIDES];
    await mount();
    expect(bereich().querySelector('[data-testid="bib-deckungssatz"]')).not.toBeNull();
    expect(text()).toContain("12");
    await netzTrennen();
    expect(bereich().querySelector('[data-testid="bib-deckungssatz"]')).toBeNull();
    expect(text()).not.toContain("12");
  });

  it("L-4 · das Netz kehrt zurück → die Verneinung darf wieder dastehen", async () => {
    await mount();
    await netzTrennen();
    expect(text()).not.toContain(i18n.t("kollision.detail.keine"));
    await act(async () => {
      onlineManager.setOnline(true);
      await flush();
    });
    expect(text()).toContain(i18n.t("kollision.detail.keine"));
  });
});

// ------------------------------------------------------------------------------------------------
// (4c) — VERSCHWIEGEN WIRD NIE ETWAS. Nur die Verneinung verstummt.
// ------------------------------------------------------------------------------------------------
//
// Das ist Pedis Ausgangsbefund A27, und er darf durch diese Änderung nicht kippen. Der Fall läuft
// unter BEIDEN Rollen: Codex' eigener Lauf belegte die Offline-Aussage nur unter Administrator
// (R-1585:27-28 — „Eigener Test unter Administrator belegt Offline-Aussage am eigenen Objekt, nicht
// Expertenberechtigung"). Die Expertin ist der engere Fall: sie darf `/konflikte` gar nicht öffnen.

describe("JOB 3084 · (4c/4e) ein vorliegender Befund wird auch offline genannt", () => {
  for (const rolle of ["admin", "experte"] as const) {
    it(`L-5-${rolle} · Dublette UND Konflikt bleiben offline sichtbar, mit Vorbehalt daneben`, async () => {
      box.rolle = rolle;
      box.kanal.signal = async () => [BEIDES];
      box.kanal.conflicts = async () => [KONFLIKT_EINTRAG];
      await mount();
      expect(wirksameRolle()).toBe(`${rolle}/${rolle}`);
      await netzTrennen();
      expect(text()).toContain(i18n.t("kollision.detail.beides"));
      expect(text()).toContain(i18n.t("kollision.lage.pausiert"));
      expect(text()).not.toContain(i18n.t("kollision.detail.keine"));
      // A28: kein fremder Inhalt, auch nicht offline.
      expect(JSON.stringify([KONFLIKT_EINTRAG])).toContain("ko-geheim-9");
      expect(bereich().innerHTML).not.toContain("ko-geheim-9");
      expect(text()).not.toContain("6 bar");
    });
  }

  it("L-6 · und die Expertin bekommt offline keinen Rohlink auf die gesperrte Fläche (Codex R1)", async () => {
    box.rolle = "experte";
    box.kanal.signal = async () => [BEIDES];
    await mount();
    await netzTrennen();
    expect(wirksameRolle()).toBe("experte/experte");
    expect(text()).toContain(i18n.t("kollision.detail.beides"));
    expect(container.querySelector('a[href="/konflikte"]')).toBeNull();
    expect(container.querySelector('a[href="/duplikate"]')).toBeNull();
  });

  it("L-7 · KALIBRIERUNG zu L-6: als admin steht der echte Link — sonst misst L-6 nichts", async () => {
    box.rolle = "admin";
    box.kanal.signal = async () => [BEIDES];
    await mount();
    await netzTrennen();
    expect(bereich().querySelector('a[href="/konflikte"]')).not.toBeNull();
  });
});

// ------------------------------------------------------------------------------------------------
// (4d) — der kalte Einstieg: offline OHNE jeden früheren Stand
// ------------------------------------------------------------------------------------------------

describe("JOB 3084 · (4d) offline ohne jeden Stand behauptet keinen Stand", () => {
  it("L-8 · nie eine Antwort, Netz weg → „nicht prüfbar“, kein „Stand von zuletzt“", async () => {
    box.kanal.kos = haengt;
    box.kanal.conflicts = haengt;
    box.kanal.signal = haengt;
    await mount();
    await netzTrennen();
    expect(text()).toContain(i18n.t("kollision.lage.pausiertOhneStand"));
    expect(text()).not.toContain(i18n.t("kollision.lage.pausiert"));
    expect(text()).not.toContain(i18n.t("kollision.detail.keine"));
  });
});

// ------------------------------------------------------------------------------------------------
// (4b, RUNDE 2) — DER RÜCKKEHRWEG, WIRKLICH GEFAHREN
// ------------------------------------------------------------------------------------------------
//
// BENS KORREKTURPFLICHT AUS RUNDE 1, wörtlich: „Ein erneutes Lesen desselben gemounteten DOM gilt
// nicht als Rückkehrtest. Der Test muss die Zielansicht verlassen und anschließend offline erneut
// betreten; QueryClient und frischer Cache bleiben erhalten."
//
// Warum der Unterschied trägt und nicht bloß Form ist: beim Wiederbetreten läuft `BibliothekLesen`
// von vorn, `useNetzOnline` wird NEU abonniert und die drei Abfragen werden NEU beobachtet. Genau
// hier entscheidet sich, ob der Onlinezustand auch aus dem kalten Start der Komponente heraus in
// die Regel kommt — ein Hook, der nur auf ein Ereignis am stehenden Baum reagierte, wäre in L-1
// grün und hier rot. Der Weg wird deshalb ZWEIMAL gefahren: als Seitenwechsel im selben Router
// (L-9) und als vollständiger Neuaufbau des Baums am selben `QueryClient` (L-10).

describe("JOB 3084 · Rückkehr auf die Lesefläche bei erhaltenem frischem Zwischenspeicher", () => {
  it("L-9 · Seitenwechsel weg, offline, zurück → Datenlagesatz statt Verneinung", async () => {
    await mount();
    // KALIBRIERUNG 1: online steht die Verneinung, bevor überhaupt etwas geschieht.
    expect(text()).toContain(i18n.t("kollision.detail.keine"));

    await klick("nav-weg");
    // KALIBRIERUNG 2: die Lesefläche ist WIRKLICH verlassen — sonst misst der Fall keinen Rückweg.
    expect(container.querySelector('[data-testid="anderswo"]')).not.toBeNull();
    expect(bereichVorhanden(), "die Lesefläche muss den Baum verlassen haben").toBe(false);

    await netzTrennen();
    await klick("nav-zurueck");

    // KALIBRIERUNG 3: der Zwischenspeicher hat den Weg überlebt und ruht weiterhin — es wird also
    // wirklich aus einem formal frischen Stand heraus gesprochen und nicht neu geladen.
    expect(
      zustandDerQuellen(),
      "der Cache muss erhalten und ruhend sein, sonst misst der Fall den Ladeweg",
    ).toEqual({ kos: "success/idle", conflicts: "success/idle", signal: "success/idle" });
    expect(bereichVorhanden(), "die Lesefläche muss wieder dastehen").toBe(true);
    expect(text()).not.toContain(i18n.t("kollision.detail.keine"));
    expect(text()).toContain(i18n.t("kollision.lage.pausiert"));
    expect(bereich().querySelector('[data-testid="bib-kollision-wiederholen"]')).toBeNull();
  });

  it("L-10 · Baum ab, offline, Baum neu am selben QueryClient → dasselbe Ergebnis", async () => {
    box.kanal.signal = async () => [BEIDES];
    await mount();
    expect(text()).toContain(i18n.t("kollision.detail.beides"));
    expect(bereich().querySelector('[data-testid="bib-deckungssatz"]')).not.toBeNull();
    expect(text()).toContain("12");

    await netzTrennen();
    await neuBetreten();

    expect(zustandDerQuellen()).toEqual({
      kos: "success/idle",
      conflicts: "success/idle",
      signal: "success/idle",
    });
    // Der Befund wird auch nach dem Wiedereinstieg GENANNT — verschwiegen wird nie etwas …
    expect(text()).toContain(i18n.t("kollision.detail.beides"));
    // … aber der Vorbehalt steht daneben, und die Deckungszahl ist fort.
    expect(text()).toContain(i18n.t("kollision.lage.pausiert"));
    expect(bereich().querySelector('[data-testid="bib-deckungssatz"]')).toBeNull();
    expect(text()).not.toContain("12");
  });

  it("L-11 · KALIBRIERUNG zu L-9/L-10: derselbe Rückweg ONLINE lässt die Verneinung stehen", async () => {
    // Ohne diesen Fall wären L-9 und L-10 auch dann grün, wenn ein Wiedereinstieg die Auskunft
    // GRUNDSÄTZLICH verstummen ließe — etwa weil der Zwischenspeicher den Weg gar nicht überlebt.
    await mount();
    await klick("nav-weg");
    expect(bereichVorhanden()).toBe(false);
    await klick("nav-zurueck");
    expect(zustandDerQuellen()).toEqual({
      kos: "success/idle",
      conflicts: "success/idle",
      signal: "success/idle",
    });
    expect(text()).toContain(i18n.t("kollision.detail.keine"));
    expect(text()).not.toContain(i18n.t("kollision.lage.pausiert"));
  });
});
