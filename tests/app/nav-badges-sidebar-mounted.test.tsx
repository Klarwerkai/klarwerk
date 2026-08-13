// @vitest-environment jsdom
// ================================================================================================
// JOB 690 · D2 — DER AUFGABEN-ZÄHLER AN DER ECHTEN SEITENLEISTE.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. D1 hat die Zählregel korrekt gebaut und mit einem direkten Hookaufruf
// gepinnt — BENs Urteil dazu: „Gemounteter Test bedeutet Renderer plus reale Provider-/
// Endpointgrenze; ein direkter Hookaufruf mit Mocks ist kein Ersatz." Genau diese Grenze steht hier:
// die ECHTE `shell/Sidebar.tsx` wird gemountet (nur gemountet, nie geschrieben — sie gehört zum
// Schreibscope von JOB 689), mit echten Providern, echtem React-Query und der Endpointgrenze als
// einziger Attrappe.
//
// Der direkte Hooktest (`apps/web/src/app/useNavBadges.badges.test.ts`) bleibt daneben bestehen: er
// pinnt die RECHENREGEL feinkörnig, diese Datei den SICHTBAREN Vertrag. Beide zusammen, nicht eines
// statt des anderen.
//
// BAUFORM nach den zwei Nachbar-Vorbildern (`nav-badges-loading-mounted`, `nav-badges-stale-mounted`):
// jsdom, relative Importe über `../../apps/web/node_modules/…`, gehoisteter endpoints-Mock,
// `IS_REACT_ACT_ENVIRONMENT`. Adressiert wird über `aria-label` — dieselbe Naht, die auch die
// Nachbarn benutzen (Badges tragen ihre Bedeutung als Text, SCRUM-486 E).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// „channel"-Mock wie bei den Nachbarn: jeder queryFn-Aufruf bekommt ein frisches Promise, dessen
// Ausgang der Test steuert. Hier für ALLE FÜNF Quellen — anders als in den Nachbardateien, denn
// diese hier prüft gerade das Zusammenspiel der fünften mit den übrigen vier.
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
  return { board: mk(), conflicts: mk(), duplicates: mk(), gaps: mk(), lifecycle: mk() };
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

/** Das Badge einer Navigationszeile, adressiert über seine übersetzte Bedeutung samt Zahl. */
function badge(key: string, count: number): Element | null {
  return container.querySelector(`[aria-label="${i18n.t(`nav.badge.${key}`, { count })}"]`);
}

function loadingBadges(): Element[] {
  return [...container.querySelectorAll(`[aria-label="${i18n.t("nav.badge.loading")}"]`)];
}

function errorBadges(): Element[] {
  return [...container.querySelectorAll(`[aria-label="${i18n.t("nav.badge.error")}"]`)];
}

// Drei Konflikte, EINER gelöst → zwei ungelöste. Dieselbe Menge wie im Hooktest.
const KONFLIKTE = [
  { id: "c1", status: "offen" },
  { id: "c2", status: "eskaliert" },
  { id: "c3", status: "geloest" },
];

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 690 D-019: die echte Seitenleiste zählt alle fünf Aufgabenquellen", () => {
  it("(a) der Aufgaben-Badge zählt Lebenszyklus-Fällige und ungelöste Konflikte mit", async () => {
    await mount();
    await act(async () => {
      d.board.resolve([{ id: "k1" }, { id: "k2" }]);
      d.gaps.resolve({ open: 1, byPriority: { hoch: 1, mittel: 0, niedrig: 0 } });
      d.conflicts.resolve(KONFLIKTE);
      d.lifecycle.resolve(["l1", "l2", "l3"]);
      d.duplicates.resolve([]);
      await flush();
    });

    // Board 2 + offene Lücken 1 + ungelöste Konflikte 2 + Lebenszyklus-Fällige 3 = 8.
    // Auf der unveränderten Base zählt der Badge nur Board + Lücken = 3 — dieses Badge gibt es
    // dort nicht, und der Test fällt genau daran (nicht an einer fehlenden Datei).
    const aufgaben = badge("tasks", 8);
    expect(aufgaben, "Der Aufgaben-Badge zeigt nicht die Summe aller vier Quellen (erwartet 8)").not.toBeNull();
    expect(aufgaben?.textContent).toContain("8");
    // Die zu kleine Zahl der Zwei-Quellen-Zählung darf NICHT dastehen.
    expect(badge("tasks", 3), "Der Badge zeigt weiterhin die alte Zwei-Quellen-Summe 3").toBeNull();
    expect(loadingBadges().length).toBe(0);
  });

  it("(b) ein GELÖSTER Konflikt zählt nirgends — weder im Konflikte- noch im Aufgaben-Badge", async () => {
    await mount();
    await act(async () => {
      d.board.resolve([]);
      d.gaps.resolve({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } });
      // NUR ein gelöster Konflikt: er ist keine offene Arbeit und darf nirgends erscheinen.
      d.conflicts.resolve([{ id: "c3", status: "geloest" }]);
      d.lifecycle.resolve([]);
      d.duplicates.resolve([]);
      await flush();
    });

    // Echte Null ⇒ GAR KEIN Badge (mega2 Block C). Auf der Base zählt der Konflikte-Badge die
    // Länge der Liste und zeigt deshalb eine 1 — daran fällt der Test.
    expect(badge("conflicts", 1), "Der Konflikte-Badge zählt den gelösten Konflikt c3 mit").toBeNull();
    expect(badge("tasks", 1), "Der Aufgaben-Badge zählt den gelösten Konflikt c3 mit").toBeNull();
    expect(badge("conflicts", 0)).toBeNull();
    expect(badge("tasks", 0)).toBeNull();
  });

  it("(c) Lade- und Fehlerzustand der neuen Quelle: kein Absturz, kein falsches Badge", async () => {
    await mount();
    // Die vier alten Quellen sind da, die FÜNFTE lädt noch.
    await act(async () => {
      d.board.resolve([{ id: "k1" }, { id: "k2" }]);
      d.gaps.resolve({ open: 1, byPriority: { hoch: 1, mittel: 0, niedrig: 0 } });
      d.conflicts.resolve(KONFLIKTE);
      d.duplicates.resolve([]);
      await flush();
    });

    // Solange die Lebenszyklus-Quelle lädt, darf der Aufgaben-Badge KEINE Zahl behaupten — weder
    // die alte Zwei-Quellen-Summe 3 noch die Teilsumme 5 ohne Lebenszyklus. Er zeigt den
    // Ladepunkt. Auf der Base steht dort die 3, und genau daran fällt dieser Fall.
    expect(badge("tasks", 3), "Der Aufgaben-Badge zeigt die alte Zwei-Quellen-Summe, obwohl eine Quelle noch lädt").toBeNull();
    expect(badge("tasks", 5), "Der Aufgaben-Badge zeigt eine Teilsumme, obwohl eine Quelle noch lädt").toBeNull();
    expect(loadingBadges().length, "Kein Ladepunkt, obwohl die Lebenszyklus-Quelle noch lädt").toBeGreaterThan(0);

    // Und wenn sie dauerhaft scheitert: ehrlicher Fehler-Marker statt endlosem Ladepunkt oder
    // erfundener Zahl. Vor allem: die Seitenleiste stürzt nicht ab (D1-Regression war ein
    // TypeError aus useLifecyclePending).
    await act(async () => {
      d.lifecycle.reject(new Error("kaputt"));
      await flush();
    });
    expect(errorBadges().length, "Kein Fehler-Marker, obwohl die Lebenszyklus-Quelle gescheitert ist").toBeGreaterThan(0);
    expect(badge("tasks", 3)).toBeNull();
    // Die Seitenleiste steht noch — der Absturzfall ist damit ausgeschlossen.
    expect(container.querySelector("nav")).not.toBeNull();
  });
});
