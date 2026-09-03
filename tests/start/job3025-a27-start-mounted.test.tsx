// @vitest-environment jsdom
// ================================================================================================
// JOB 3025 (A27, OFFEN.md:81) — DIESELBE AUSKUNFT AUF DER STARTSEITE, AM ECHTEN QueryClient.
// ================================================================================================
//
// Die Startseite ist die zweite Hälfte des Versprechens: wer sein Objekt gerade nicht offen hat,
// erfährt hier, dass etwas kollidiert — und in fünf von sechs Datenlagen erfährt er stattdessen,
// dass die Auskunft nicht belastbar ist. Die Ableitung ist DIESELBE Funktion wie auf der
// Detailseite (`eigeneKollisionStart` neben `eigeneKollisionDetail` in lib/eigeneKollision.ts);
// ein zweiter Ableitungsweg wäre genau die Drift, an der JOB 3002 R4 fiel.
//
// `primaryWorkItem(overview, role)` bleibt unangetastet: dort geht es um Arbeit, die die Rolle
// ausführen darf. Hier geht es um Auskunft über EIGENE Objekte — eine andere Frage.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  rolle: "experte" as "experte" | "controller",
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
  type: "prozess",
  status: "validiert",
  tags: [],
  conditions: [],
  measures: [],
  author: "u1",
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
};

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

const DUBLETTE: EigenerBefund = { koId: "ko-1", dublette: true, konflikt: false };
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

/**
 * KALIBRIERUNG DER ROLLENFÄLLE — ohne sie wäre S-h1 vakuös: „als experte kein Link" ist auch dann
 * grün, wenn die Sitzung noch gar nicht geladen hat und die Vorgaberolle zufällig `experte` ist.
 */
function Probe(): JSX.Element {
  const { role } = useRole();
  const { user } = useSession();
  return createElement("span", { "data-probe": "1" }, `${role}/${user?.role ?? "kein-user"}`);
}

function wirksameRolle(): string {
  return container.querySelector("[data-probe]")?.textContent ?? "";
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
  // ZWEI Runden: die Sitzung löst in zwei Stufen auf (`/auth/status`, dann `/auth/me`, das erst
  // danach `enabled` wird). Mit nur einer Runde stand die Rolle noch auf dem Vorgabewert `experte`
  // — die Rollenfälle wären dann grün gewesen, ohne je eine Session-Rolle gesehen zu haben.
  await act(flush);
  await act(flush);
}

function bereich(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-testid="job3025-kollision-start"]');
  if (!el) {
    throw new Error("Der Kollisionsbereich fehlt auf der Startseite");
  }
  return el;
}

const text = (): string => (bereich().textContent ?? "").replace(/\s+/g, " ");

function vorbefuellen(mitBefund: boolean): void {
  qc.setQueryData(KEY.kos, [KO]);
  qc.setQueryData(KEY.conflicts, [] as Conflict[]);
  qc.setQueryData(KEY.signal, mitBefund ? [DUBLETTE] : ([] as EigenerBefund[]));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.rolle = "experte";
  box.kanal = { kos: leerAntwort, conflicts: leerAntwort, signal: leerAntwort };
  onlineManager.setOnline(true);
  window.localStorage.clear();
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  qc.clear();
  onlineManager.setOnline(true);
  vi.clearAllMocks();
});

describe("JOB 3025 · Startseite, frisch geladen", () => {
  it("S-a · ein Befund an einem eigenen Objekt → Auskunft mit Satz", async () => {
    box.kanal.signal = async () => [DUBLETTE];
    await mount();
    expect(text()).toContain(i18n.t("kollision.start.dublette", { n: 1 }));
    expect(text()).not.toContain(i18n.t("kollision.start.keine"));
  });

  it("S-a2 · nichts über die Gegenseite (A28)", async () => {
    box.kanal.conflicts = async () => [KONFLIKT_EINTRAG];
    box.kanal.signal = async () => [{ koId: "ko-1", dublette: false, konflikt: true }];
    await mount();
    expect(JSON.stringify([KONFLIKT_EINTRAG])).toContain("ko-geheim-9");
    expect(bereich().innerHTML).not.toContain("ko-geheim-9");
    expect(text()).not.toContain("6 bar");
  });

  it("S-b · frisch und leer → die Verneinung, sonst nichts", async () => {
    await mount();
    expect(text()).toContain(i18n.t("kollision.start.keine"));
    expect(text()).not.toContain(i18n.t("kollision.lage.laedt"));
  });
});

describe("JOB 3025 · Startseite (c) laufender Erstabruf (Codex R3)", () => {
  for (const quelle of QUELLEN) {
    it(`S-c-${quelle} · ${quelle} hängt → Ladeauskunft, kein Fehlersatz`, async () => {
      box.kanal[quelle] = haengt;
      await mount();
      expect(text()).toContain(i18n.t("kollision.lage.laedt"));
      expect(text()).not.toContain(i18n.t("kollision.lage.erstfehler"));
      expect(text()).not.toContain(i18n.t("kollision.start.keine"));
    });
  }
});

describe("JOB 3025 · Startseite (d) Erstfehler (Codex R2)", () => {
  for (const quelle of QUELLEN) {
    it(`S-d-${quelle} · ${quelle} scheitert ohne je Daten → Fehlerlage`, async () => {
      box.kanal[quelle] = async () => {
        throw new Error("Netz weg");
      };
      await mount();
      expect(text()).toContain(i18n.t("kollision.lage.erstfehler"));
      expect(text()).not.toContain(i18n.t("kollision.start.keine"));
    });
  }
});

describe("JOB 3025 · Startseite (e) Cache plus hängender Auffrischung (Codex R4)", () => {
  for (const quelle of QUELLEN) {
    it(`S-e-${quelle} · ${quelle} frischt auf → markiert, keine Verneinung`, async () => {
      vorbefuellen(false);
      box.kanal[quelle] = haengt;
      await mount();
      await act(async () => {
        void qc.refetchQueries({ queryKey: KEY[quelle] });
        await flush();
      });
      expect(text()).toContain(i18n.t("kollision.lage.auffrischungLaeuft"));
      expect(text()).not.toContain(i18n.t("kollision.start.keine"));
    });
  }
});

describe("JOB 3025 · Startseite (f) Cache plus ABGELEHNTER Auffrischung (Codex R4)", () => {
  for (const quelle of QUELLEN) {
    it(`S-f-${quelle} · ${quelle} lehnt ab → leerer Cache verneint NICHT`, async () => {
      vorbefuellen(false);
      box.kanal[quelle] = async () => {
        throw new Error("Auffrischung abgelehnt");
      };
      await mount();
      await act(async () => {
        await qc.refetchQueries({ queryKey: KEY[quelle] }).catch(() => {});
        await flush();
      });
      expect(text()).toContain(i18n.t("kollision.lage.auffrischungGescheitert"));
      expect(text()).not.toContain(i18n.t("kollision.start.keine"));
    });
  }
});

describe("JOB 3025 · Startseite (g) offline pausiert (Codex R5)", () => {
  for (const quelle of QUELLEN) {
    it(`S-g-${quelle} · ${quelle} pausiert → Offline-Grund, keine Verneinung`, async () => {
      vorbefuellen(false);
      await mount();
      await act(async () => {
        onlineManager.setOnline(false);
        void qc.refetchQueries({ queryKey: KEY[quelle] });
        await flush();
      });
      expect(text()).toContain(i18n.t("kollision.lage.pausiert"));
      expect(text()).not.toContain(i18n.t("kollision.start.keine"));
    });
  }

  it("S-g-befund · ein pausierter Befund steht nie unmarkiert als aktueller da", async () => {
    vorbefuellen(true);
    await mount();
    await act(async () => {
      onlineManager.setOnline(false);
      void qc.refetchQueries({ queryKey: KEY.signal });
      await flush();
    });
    expect(text()).toContain(i18n.t("kollision.start.dublette", { n: 1 }));
    expect(text()).toContain(i18n.t("kollision.lage.pausiert"));
  });
});

// ------------------------------------------------------------------------------------------------
// (j) — KALTER OFFLINE-EINSTIEG OHNE JEDEN STAND (Ben, Runde 2, Korrekturpflicht 2)
// ------------------------------------------------------------------------------------------------
//
// Dieselbe Lücke wie am Detail: JEDER Offline-Fall oben beginnt mit `vorbefuellen(...)`. Ohne
// Zwischenspeicher behauptete die Startseite trotzdem einen „Stand von zuletzt".

describe("JOB 3025 · Startseite (j) offline OHNE Zwischenspeicher", () => {
  it("S-j1 · kalter Einstieg offline → nur „nicht prüfbar“, kein „Stand von zuletzt“", async () => {
    onlineManager.setOnline(false);
    box.kanal.kos = haengt;
    box.kanal.conflicts = haengt;
    box.kanal.signal = haengt;
    await mount();
    expect(text()).toContain(i18n.t("kollision.lage.pausiertOhneStand"));
    expect(text()).not.toContain(i18n.t("kollision.lage.pausiert"));
    expect(text()).not.toContain(i18n.t("kollision.start.keine"));
  });

  it("S-j2 · MIT Zwischenspeicher bleibt „Stand von zuletzt“ stehen — die Grenze ist gemessen", async () => {
    vorbefuellen(true);
    await mount();
    await act(async () => {
      onlineManager.setOnline(false);
      void qc.refetchQueries({ queryKey: KEY.signal });
      await flush();
    });
    expect(text()).toContain(i18n.t("kollision.lage.pausiert"));
    expect(text()).not.toContain(i18n.t("kollision.lage.pausiertOhneStand"));
  });

  it("S-j3 · und ohne Stand wird auch keine Zahl behauptet", async () => {
    onlineManager.setOnline(false);
    box.kanal.kos = haengt;
    box.kanal.conflicts = haengt;
    box.kanal.signal = haengt;
    await mount();
    expect(text()).not.toContain(i18n.t("kollision.start.dublette", { n: 0 }));
    expect(text()).not.toContain(i18n.t("kollision.start.konflikt", { n: 0 }));
    expect(text()).not.toContain(i18n.t("kollision.start.beides", { n: 0 }));
  });
});

describe("JOB 3025 · Startseite (h) die Rollenbindung des Weges (Codex R1)", () => {
  it("S-h1 · als experte: Text sichtbar, KEIN a[href=„/konflikte“] im Bereich", async () => {
    box.rolle = "experte";
    box.kanal.signal = async () => [{ koId: "ko-1", dublette: false, konflikt: true }];
    await mount();
    expect(wirksameRolle()).toBe("experte/experte");
    expect(text()).toContain(i18n.t("kollision.start.konflikt", { n: 1 }));
    expect(bereich().querySelector('a[href="/konflikte"]')).toBeNull();
  });

  it("S-h2 · als controller: der echte Link bleibt", async () => {
    box.rolle = "controller";
    box.kanal.signal = async () => [{ koId: "ko-1", dublette: false, konflikt: true }];
    await mount();
    expect(wirksameRolle()).toBe("controller/controller");
    expect(bereich().querySelector('a[href="/konflikte"]')).not.toBeNull();
  });
});
