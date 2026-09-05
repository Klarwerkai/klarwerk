// @vitest-environment jsdom
// AUFTRAG-mega2 Block C / mega3 Block B (bens D9) → JOB 3060 · H1 (§9 Zustandsmodell des Zählers):
// der Zähler an „Prüfen“ im Kopfband und die Zahlen in „Weitere Bereiche“ zeigen eine Zahl NUR nach
// erfolgreichem frischem Abruf. Gemountet am ECHTEN Kopfband über die realen Lese-Hooks:
//   VOR Auflösung der Queries → KEIN Abzeichen (kein Ladepunkt, keine Zahl, kein 0-Badge)
//   NACH Auflösung mit Zahl > 0 → echtes Zahlen-Abzeichen mit Bedeutung (aria-label)
//   NACH Auflösung mit 0        → gar kein Abzeichen (echtes Nullergebnis)
//   dauerhaft GESCHEITERT       → KEIN Abzeichen, kein „!“-Marker (§9: Fehler = kein Badge)
// Was sich gegenüber mega2/mega3 ändert, ist ausschließlich die DARSTELLUNG der Zwischenzustände:
// Laden und Fehler sind weiterhin von einer echten 0 UNTERSCHEIDBAR — im Datenmodell (useNavBadges)
// — aber im Kopfband stehen sie als Abwesenheit der Zahl, nicht als eigener Marker (Pedi 04.09.).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// mega3 Block B: „channel“-Mock — jeder queryFn-Aufruf erhält ein frisches Promise; der Test steuert
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
  // JOB 690 D2: die FÜNFTE Badgequelle als sofort auflösender Stub — die Steuerung bleibt bei den
  // vier gesteuerten Kanälen.
  const sofortLeer = () => ({ fn: vi.fn(async () => [] as string[]) });
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

/** Das Zahnrad-Menü öffnen und „Weitere Bereiche“ aufklappen — dort stehen die übrigen Zähler. */
async function weitereBereicheOeffnen(): Promise<void> {
  await click(container.querySelector('[data-testid="kopfband-zahnrad"]'));
  await click(container.querySelector('[data-testid="zahnrad-weitere-bereiche"]'));
}

const pruefenZaehler = (): Element | null =>
  container.querySelector('header a[data-kopfband-punkt="validierung"] .kw-kopfband-zaehler');
const loadingBadges = (): Element[] => [
  ...container.querySelectorAll(`[aria-label="${i18n.t("nav.badge.loading")}"]`),
];
const errorBadges = (): Element[] => [
  ...container.querySelectorAll(`[aria-label="${i18n.t("nav.badge.error")}"]`),
];

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block C → H1: der Zähler unterscheidet Ladezustand von echter 0 — durch ABWESENHEIT, nicht durch einen Marker", () => {
  it("zeigt VOR Auflösung KEIN Abzeichen, NACH Auflösung die Zahl bzw. gar nichts", async () => {
    await mount();
    // VOR Auflösung: der Punkt „Prüfen“ steht, aber ohne Zahl — und ohne Ladepunkt (§9).
    expect(container.querySelector('header a[data-kopfband-punkt="validierung"]')).not.toBeNull();
    expect(pruefenZaehler()).toBeNull();
    expect(loadingBadges().length).toBe(0);
    expect(container.textContent).not.toContain("!");

    // NACH Auflösung: Board mit 2 offenen Prüfungen, alles andere 0.
    await act(async () => {
      d.board.resolve([{ id: "a" }, { id: "b" }]);
      d.conflicts.resolve([]);
      d.duplicates.resolve([]);
      d.gaps.resolve({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } });
      await flush();
    });

    // Der Zähler an „Prüfen“ zeigt jetzt die echte Zahl 2 — mit ihrer Bedeutung (SCRUM-486 E) …
    const validationLabel = i18n.t("nav.badge.validation", { count: 2 });
    expect(pruefenZaehler()?.textContent).toBe("2");
    expect(pruefenZaehler()?.getAttribute("aria-label")).toBe(validationLabel);
    // … und in „Weitere Bereiche“ gibt es für die echten Nullwerte (Konflikte/Dubletten) KEINE Zahl.
    await weitereBereicheOeffnen();
    expect(
      container.querySelector(`[aria-label="${i18n.t("nav.badge.conflicts", { count: 0 })}"]`),
    ).toBeNull();
    expect(container.querySelector('[data-testid="bereich-konflikte"] .kw-menue-wert')).toBeNull();
    expect(container.querySelector('[data-testid="bereich-duplikate"] .kw-menue-wert')).toBeNull();
    // Aufgaben zählt das Board mit (2 + 0 + 0 + 0).
    expect(
      container.querySelector('[data-testid="bereich-aufgaben"] .kw-menue-wert')?.textContent,
    ).toBe("2");
  });

  it("§9: dauerhaft gescheiterte Quelle → KEIN Abzeichen, kein „!“-Marker, keine erfundene 0", async () => {
    await mount();
    expect(pruefenZaehler()).toBeNull();

    await act(async () => {
      d.board.reject(new Error("kaputt"));
      d.conflicts.reject(new Error("kaputt"));
      d.duplicates.reject(new Error("kaputt"));
      d.gaps.reject(new Error("kaputt"));
      await flush();
    });

    // Kein Ladepunkt, kein Fehler-Marker — der Punkt steht ohne Zahl (Lieferung 6).
    expect(loadingBadges().length).toBe(0);
    expect(errorBadges().length).toBe(0);
    expect(pruefenZaehler()).toBeNull();
    expect(
      container.querySelector(`[aria-label="${i18n.t("nav.badge.validation", { count: 0 })}"]`),
    ).toBeNull();
    await weitereBereicheOeffnen();
    expect(container.querySelector('[data-testid="bereich-aufgaben"] .kw-menue-wert')).toBeNull();
    expect(container.textContent).not.toContain("!");
    // Und das Kopfband steht — der Absturzfall ist ausgeschlossen.
    expect(container.querySelector('header[data-testid="kopfband"]')).not.toBeNull();
  });
});
