// @vitest-environment jsdom
// ================================================================================================
// JOB 3084 (Q6) — DIESELBE NETZTRENNUNG AUF DER STARTSEITE.
// ================================================================================================
//
// WARUM DIESE DATEI NEBEN `lesenflaeche-mounted.test.tsx` STEHT: die Auskunft erscheint auf ZWEI
// Flächen, und die naheliegende Halbheit ist, nur eine davon zu bedienen. Genau daran fiel JOB 3002
// in Runde 4 (die Startseite las noch `?? []`, während die Detailseite schon zählte); der
// Kopfkommentar von `apps/web/src/lib/eigeneKollision.ts:15-17` ist gegen diese Drift geschrieben.
// Die Regel ist dieselbe Funktion — dass sie den Onlinezustand auch hier WIRKLICH gereicht bekommt,
// misst nur ein Mount.
//
// Der Weg zur Fläche ist der echte: seit JOB 3064 H5 liegt die vollständige Auskunft hinter dem
// „…"-Menü unter „Eigene Objekte". Er wird hier über die echten Knöpfe geöffnet, nicht abgekürzt.
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

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: { list: vi.fn(() => box.kanal.kos()) },
      conflicts: { list: vi.fn(() => box.kanal.conflicts()) },
      duplicateSignal: { list: vi.fn(() => box.kanal.signal()) },
      validation: { board: leer },
      lifecycle: { pending: leer },
      gaps: { summary: vi.fn(async () => ({ open: 0, byPriority: { hoch: 0 } })) },
      learningPaths: { byRole: vi.fn(async () => null), progress: leer },
      livewall: { get: vi.fn(async () => ({ saved: [], helped: [], helpedToday: 0 })) },
      notifications: { list: vi.fn(async () => []) },
      admin: { demoStatus: vi.fn(async () => ({ present: false, count: 0 })) },
      analytics: { overview: vi.fn(async () => ({ total: 0, byStatus: {} })) },
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
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { Conflict, EigenerBefund } from "../../apps/web/src/api/types";
import { AuthProvider, useSession } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider, useRole } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Start } from "../../apps/web/src/pages/Start";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

type QuellenName = "kos" | "conflicts" | "signal";
const QUELLEN: readonly QuellenName[] = ["kos", "conflicts", "signal"];

const KEY: Record<QuellenName, readonly unknown[]> = {
  kos: ["kos", undefined],
  conflicts: ["conflicts"],
  signal: ["duplicate-signal"],
};

const BEIDES: EigenerBefund = {
  koId: "ko-1",
  dublette: true,
  konflikt: true,
  deckung: { lage: "kein_lauf", geprueft: null, bestand: null },
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

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * DAS MENÜBLATT „Eigene Objekte" — über die ECHTEN Knöpfe, nie über eine Abkürzung in den Zustand.
 *
 * Seit JOB 3064 H5 liegt die vollständige Auskunft hinter dem „…"-Menü. Ab Runde 2 ist das Öffnen
 * ein eigener Schritt und nicht mehr Teil von `mount()`: Ben hat für Runde 2 ausdrücklich einen Fall
 * verlangt, der das Blatt ERST NACH der Netztrennung öffnet (Prüflücke 6). Das ist der strengere
 * Weg — dort wird `StartPanelInhalt` überhaupt erst angebaut, während das Netz schon fehlt.
 */
async function oeffnePanel(): Promise<void> {
  await act(async () => {
    container.querySelector<HTMLButtonElement>('[data-testid="h5-start-menu"]')?.click();
    await flush();
  });
  await act(async () => {
    container
      .querySelector<HTMLButtonElement>('[data-testid="h5-start-menu-punkt-kollision"]')
      ?.click();
    await flush();
  });
  await act(flush);
}

async function mount({ oeffnen = true }: { oeffnen?: boolean } = {}): Promise<void> {
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
                createElement(MemoryRouter, { initialEntries: ["/start"] }, [
                  createElement(Probe, { key: "p" }),
                  createElement(Start, { key: "s" }),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  // Zwei Runden: die Sitzung löst in zwei Stufen auf (`/auth/status`, dann `/auth/me`).
  await act(flush);
  await act(flush);
  if (oeffnen) {
    await oeffnePanel();
  }
}

function bereich(): HTMLElement {
  // Das Seitenblatt wird nach `document.body` portaliert (JOB 3064 Runde 4) — deshalb an
  // `document` gebunden und nicht am Mount-Knoten.
  const el = document.querySelector<HTMLElement>('[data-testid="job3025-kollision-start"]');
  if (!el) {
    throw new Error("Der Kollisionsbereich fehlt — das Menüblatt „Eigene Objekte“ ist nicht offen");
  }
  return el;
}

/** Anders als `bereich()` wirft das nicht — gebraucht für „das Blatt ist wirklich zu". */
const bereichVorhanden = (): boolean =>
  document.querySelector('[data-testid="job3025-kollision-start"]') !== null;

const text = (): string => (bereich().textContent ?? "").replace(/\s+/g, " ");

/**
 * DER WIEDEREINSTIEG: die ganze Startseite ab, dann neu — mit DEMSELBEN `QueryClient`.
 *
 * Das Blatt wird danach über die echten Menüknöpfe erneut geöffnet. Vom vorigen Besuch überlebt
 * nichts außer dem Zwischenspeicher; die Auskunft entsteht also ausschließlich aus ihm und dem
 * Onlinezustand.
 */
async function neuBetreten(): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  await mount();
}

async function netzTrennen(): Promise<void> {
  await act(async () => {
    onlineManager.setOnline(false);
    await flush();
  });
}

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
  window.localStorage.clear();
  // Dieselbe Frist wie im Betrieb (`main.tsx:21`) — sie ERZEUGT den Fall (§2c des Auftrags).
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  qc.clear();
  onlineManager.setOnline(true);
  vi.clearAllMocks();
});

describe("JOB 3084 · Startseite: frisch geladen, dann Netz weg", () => {
  it("S-0 · KALIBRIERUNG: online steht die Verneinung — und die Abfragen ruhen wirklich", async () => {
    await mount();
    expect(zustandDerQuellen()).toEqual({
      kos: "success/idle",
      conflicts: "success/idle",
      signal: "success/idle",
    });
    expect(text()).toContain(i18n.t("kollision.start.keine"));
  });

  // Wie L-1 an der Lesefläche: dieser Fall misst die REAKTION am offen stehenden Blatt, nicht den
  // Rückkehrweg. Der Rückkehrweg wird ab S-6 gefahren (Ben, Runde 1, Korrekturpflicht 1).
  it("S-1 · Netz fällt weg, während das Blatt offen steht → die Verneinung verstummt sofort", async () => {
    await mount();
    await netzTrennen();
    expect(
      zustandDerQuellen(),
      "kein Abruf ist gewollt — sonst wäre dies S-g-* von JOB 3025",
    ).toEqual({ kos: "success/idle", conflicts: "success/idle", signal: "success/idle" });
    expect(text()).not.toContain(i18n.t("kollision.start.keine"));
    expect(text()).toContain(i18n.t("kollision.lage.pausiert"));
  });

  it("S-2 · offline gibt es auch hier keinen Wiederholen-Knopf", async () => {
    await mount();
    await netzTrennen();
    expect(bereich().querySelector("button")).toBeNull();
    expect(text()).not.toContain(i18n.t("kollision.wiederholen"));
  });

  it("S-3 · das Netz kehrt zurück → die Verneinung darf wieder dastehen", async () => {
    await mount();
    await netzTrennen();
    expect(text()).not.toContain(i18n.t("kollision.start.keine"));
    await act(async () => {
      onlineManager.setOnline(true);
      await flush();
    });
    expect(text()).toContain(i18n.t("kollision.start.keine"));
  });
});

describe("JOB 3084 · (4c/4e) Startseite: der Befund bleibt offline stehen", () => {
  for (const rolle of ["admin", "experte"] as const) {
    it(`S-4-${rolle} · Dublette UND Konflikt bleiben sichtbar, mit Vorbehalt daneben`, async () => {
      box.rolle = rolle;
      box.kanal.signal = async () => [BEIDES];
      box.kanal.conflicts = async () => [KONFLIKT_EINTRAG];
      await mount();
      expect(wirksameRolle()).toBe(`${rolle}/${rolle}`);
      await netzTrennen();
      expect(text()).toContain(i18n.t("kollision.start.beides", { n: 1 }));
      expect(text()).toContain(i18n.t("kollision.lage.pausiert"));
      expect(text()).not.toContain(i18n.t("kollision.start.keine"));
      expect(JSON.stringify([KONFLIKT_EINTRAG])).toContain("ko-geheim-9");
      expect(bereich().innerHTML).not.toContain("ko-geheim-9");
      expect(text()).not.toContain("6 bar");
    });
  }
});

describe("JOB 3084 · (4d) Startseite: offline ohne jeden Stand behauptet keinen Stand", () => {
  it("S-5 · nie eine Antwort, Netz weg → „nicht prüfbar“, kein „Stand von zuletzt“", async () => {
    box.kanal.kos = haengt;
    box.kanal.conflicts = haengt;
    box.kanal.signal = haengt;
    await mount();
    await netzTrennen();
    expect(text()).toContain(i18n.t("kollision.lage.pausiertOhneStand"));
    expect(text()).not.toContain(i18n.t("kollision.lage.pausiert"));
    expect(text()).not.toContain(i18n.t("kollision.start.keine"));
  });
});

// ------------------------------------------------------------------------------------------------
// (4b, RUNDE 2) — DER RÜCKKEHRWEG AUF DER STARTSEITE, WIRKLICH GEFAHREN
// ------------------------------------------------------------------------------------------------
//
// Zwei Wege, beide von Ben für Runde 2 verlangt:
//   · S-6: die Startseite steht, das Blatt ist ZU, das Netz fällt weg — und erst DANN wird das
//     Blatt geöffnet. `StartPanelInhalt` wird also erstmals angebaut, während das Netz schon fehlt.
//     Das ist der strengste Fall: ein Onlinezustand, der nur auf ein Ereignis am stehenden Baum
//     reagierte, käme hier gar nicht an.
//   · S-7: die ganze Seite ab, offline, Seite neu am selben `QueryClient`, Blatt über die echten
//     Menüknöpfe erneut geöffnet — der vollständige Wiedereinstieg mit erhaltenem Zwischenspeicher.

describe("JOB 3084 · Rückkehr auf die Startseite bei erhaltenem frischem Zwischenspeicher", () => {
  it("S-6 · Blatt erst NACH der Netztrennung geöffnet → Datenlagesatz statt Verneinung", async () => {
    await mount({ oeffnen: false });
    // KALIBRIERUNG 1: das Blatt ist wirklich zu — sonst misst der Fall dasselbe wie S-1.
    expect(bereichVorhanden(), "das Blatt darf noch nicht offen sein").toBe(false);
    // KALIBRIERUNG 2: die drei Quellen sind trotzdem schon geladen (die Startseite selbst liest
    // sie). Ohne diesen Nachweis könnte der Fall den kalten Einstieg messen statt den ruhenden
    // frischen Zwischenspeicher.
    expect(zustandDerQuellen()).toEqual({
      kos: "success/idle",
      conflicts: "success/idle",
      signal: "success/idle",
    });

    await netzTrennen();
    await oeffnePanel();

    expect(zustandDerQuellen()).toEqual({
      kos: "success/idle",
      conflicts: "success/idle",
      signal: "success/idle",
    });
    expect(text()).not.toContain(i18n.t("kollision.start.keine"));
    expect(text()).toContain(i18n.t("kollision.lage.pausiert"));
    expect(text()).not.toContain(i18n.t("kollision.wiederholen"));
  });

  it("S-7 · Seite ab, offline, Seite neu am selben QueryClient → dasselbe Ergebnis", async () => {
    box.kanal.signal = async () => [BEIDES];
    await mount();
    expect(text()).toContain(i18n.t("kollision.start.beides", { n: 1 }));
    expect(text()).not.toContain(i18n.t("kollision.lage.pausiert"));

    await netzTrennen();
    await neuBetreten();

    expect(zustandDerQuellen()).toEqual({
      kos: "success/idle",
      conflicts: "success/idle",
      signal: "success/idle",
    });
    // Der Befund wird auch nach dem Wiedereinstieg GENANNT, mit dem Vorbehalt daneben.
    expect(text()).toContain(i18n.t("kollision.start.beides", { n: 1 }));
    expect(text()).toContain(i18n.t("kollision.lage.pausiert"));
    expect(text()).not.toContain(i18n.t("kollision.start.keine"));
  });

  it("S-8 · KALIBRIERUNG zu S-6/S-7: derselbe Weg ONLINE lässt die Verneinung stehen", async () => {
    // Ohne diesen Fall wären S-6 und S-7 auch dann grün, wenn ein spät geöffnetes Blatt oder ein
    // Wiedereinstieg die Auskunft GRUNDSÄTZLICH verstummen ließe.
    await mount({ oeffnen: false });
    expect(bereichVorhanden()).toBe(false);
    await oeffnePanel();
    expect(text()).toContain(i18n.t("kollision.start.keine"));
    expect(text()).not.toContain(i18n.t("kollision.lage.pausiert"));

    await neuBetreten();
    expect(text()).toContain(i18n.t("kollision.start.keine"));
    expect(text()).not.toContain(i18n.t("kollision.lage.pausiert"));
  });
});
