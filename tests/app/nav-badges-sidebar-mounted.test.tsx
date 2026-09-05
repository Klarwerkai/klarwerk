// @vitest-environment jsdom
// ================================================================================================
// JOB 690 · D2 — DER AUFGABEN-ZÄHLER AN DER ECHTEN HÜLLE (seit JOB 3060 · H1: im Zahnrad-Menü).
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. D1 hat die Zählregel korrekt gebaut und mit einem direkten Hookaufruf
// gepinnt — BENs Urteil dazu: „Gemounteter Test bedeutet Renderer plus reale Provider-/
// Endpointgrenze; ein direkter Hookaufruf mit Mocks ist kein Ersatz." Genau diese Grenze steht hier:
// das ECHTE Kopfband wird gemountet, mit echten Providern, echtem React-Query und der Endpoint-
// grenze als einziger Attrappe. Der Aufgaben-Zähler steht seit H1 als Zahl neben „Meine Aufgaben“
// im Untermenü „Weitere Bereiche“ des Zahnrad-Menüs; „Prüfen“ trägt seinen Zähler im Kopfband.
//
// Der direkte Hooktest (`apps/web/src/app/useNavBadges.badges.test.ts`) bleibt daneben bestehen: er
// pinnt die RECHENREGEL feinkörnig, diese Datei den SICHTBAREN Vertrag. Beide zusammen.
//
// H1 (§9): Laden und Fehler heißen im Bild ABWESENHEIT der Zahl — kein Ladepunkt, kein „!“.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// „channel“-Mock wie bei den Nachbarn: jeder queryFn-Aufruf bekommt ein frisches Promise, dessen
// Ausgang der Test steuert. Hier für ALLE FÜNF Quellen — diese Datei prüft gerade das
// Zusammenspiel der fünften mit den übrigen vier.
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
    notifications: { list: vi.fn(async () => []), markSeen: vi.fn(async () => ({})) },
    features: { get: vi.fn(async () => ({ features: {} })) },
    // Das Zahnrad-Menü (Admin) trägt die Status-Zeilen — ihre Quellen sind hier nicht Gegenstand.
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
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";

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
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(MemoryRouter, { initialEntries: ["/"] }, createElement(Kopfband)),
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

async function click(el: Element | null | undefined): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error("Element zum Klicken fehlt");
  }
  await act(async () => {
    el.click();
    await flush();
  });
}

/** Das Zahnrad-Menü öffnen und „Weitere Bereiche“ aufklappen — dort steht der Aufgaben-Zähler. */
async function weitereBereicheOeffnen(): Promise<void> {
  await click(container.querySelector('[data-testid="kopfband-zahnrad"]'));
  await click(container.querySelector('[data-testid="zahnrad-weitere-bereiche"]'));
}

/** Das Abzeichen einer Zeile, adressiert über seine übersetzte Bedeutung samt Zahl. */
function badge(key: string, count: number): Element | null {
  return container.querySelector(`[aria-label="${i18n.t(`nav.badge.${key}`, { count })}"]`);
}
const aufgabenZahl = (): string | null =>
  container.querySelector('[data-testid="bereich-aufgaben"] .kw-menue-wert')?.textContent ?? null;
const loadingBadges = (): Element[] => [
  ...container.querySelectorAll(`[aria-label="${i18n.t("nav.badge.loading")}"]`),
];
const errorBadges = (): Element[] => [
  ...container.querySelectorAll(`[aria-label="${i18n.t("nav.badge.error")}"]`),
];

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

describe("JOB 690 D-019 → H1: die echte Hülle zählt alle fünf Aufgabenquellen", () => {
  it("(a) der Aufgaben-Zähler zählt Lebenszyklus-Fällige und ungelöste Konflikte mit", async () => {
    await mount();
    await act(async () => {
      d.board.resolve([{ id: "k1" }, { id: "k2" }]);
      d.gaps.resolve({ open: 1, byPriority: { hoch: 1, mittel: 0, niedrig: 0 } });
      d.conflicts.resolve(KONFLIKTE);
      d.lifecycle.resolve(["l1", "l2", "l3"]);
      d.duplicates.resolve([]);
      await flush();
    });
    await weitereBereicheOeffnen();

    // Board 2 + offene Lücken 1 + ungelöste Konflikte 2 + Lebenszyklus-Fällige 3 = 8.
    expect(
      badge("tasks", 8),
      "Der Aufgaben-Zähler zeigt nicht die Summe aller Quellen",
    ).not.toBeNull();
    expect(aufgabenZahl()).toBe("8");
    // Die zu kleine Zahl der Zwei-Quellen-Zählung darf NICHT dastehen.
    expect(badge("tasks", 3)).toBeNull();
    expect(loadingBadges().length).toBe(0);
    // Und „Prüfen“ im Kopfband zählt das Board allein (2).
    expect(badge("validation", 2)).not.toBeNull();
    expect(badge("conflicts", 2)).not.toBeNull();
  });

  it("(b) ein GELÖSTER Konflikt zählt nirgends — weder im Konflikte- noch im Aufgaben-Zähler", async () => {
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
    await weitereBereicheOeffnen();

    // Echte Null ⇒ GAR KEINE Zahl (mega2 Block C, §9).
    expect(
      badge("conflicts", 1),
      "Der Konflikte-Zähler zählt den gelösten Konflikt c3 mit",
    ).toBeNull();
    expect(badge("tasks", 1), "Der Aufgaben-Zähler zählt den gelösten Konflikt c3 mit").toBeNull();
    expect(badge("conflicts", 0)).toBeNull();
    expect(badge("tasks", 0)).toBeNull();
    expect(aufgabenZahl()).toBeNull();
    expect(container.querySelector('[data-testid="bereich-konflikte"] .kw-menue-wert')).toBeNull();
  });

  it("(c) Lade- und Fehlerzustand der neuen Quelle: kein Absturz, keine Zahl — weder Teilsumme noch Marker", async () => {
    await mount();
    // Die vier alten Quellen sind da, die FÜNFTE lädt noch.
    await act(async () => {
      d.board.resolve([{ id: "k1" }, { id: "k2" }]);
      d.gaps.resolve({ open: 1, byPriority: { hoch: 1, mittel: 0, niedrig: 0 } });
      d.conflicts.resolve(KONFLIKTE);
      d.duplicates.resolve([]);
      await flush();
    });
    await weitereBereicheOeffnen();

    // Solange die Lebenszyklus-Quelle lädt, behauptet der Aufgaben-Zähler KEINE Zahl — weder die
    // alte Zwei-Quellen-Summe 3 noch die Teilsumme 5. Und (§9) auch keinen Ladepunkt.
    expect(badge("tasks", 3), "alte Zwei-Quellen-Summe trotz ladender Quelle").toBeNull();
    expect(badge("tasks", 5), "Teilsumme trotz ladender Quelle").toBeNull();
    expect(aufgabenZahl()).toBeNull();
    expect(loadingBadges().length).toBe(0);
    // Die anderen Zeilen, deren Quellen fertig sind, zeigen ihre Zahl — das Laden EINER Quelle
    // nimmt den übrigen nichts.
    expect(badge("conflicts", 2)).not.toBeNull();
    expect(badge("validation", 2)).not.toBeNull();

    // Und wenn sie dauerhaft scheitert: weiterhin keine Zahl, kein Fehler-Marker (§9) — vor allem:
    // die Hülle stürzt nicht ab (D1-Regression war ein TypeError aus useLifecyclePending).
    await act(async () => {
      d.lifecycle.reject(new Error("kaputt"));
      await flush();
    });
    expect(errorBadges().length).toBe(0);
    expect(badge("tasks", 3)).toBeNull();
    expect(aufgabenZahl()).toBeNull();
    expect(container.querySelector('[data-testid="bereich-aufgaben"]')).not.toBeNull();
    expect(container.querySelector('header[data-testid="kopfband"]')).not.toBeNull();
  });
});
