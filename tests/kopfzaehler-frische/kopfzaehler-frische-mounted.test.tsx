// @vitest-environment jsdom
// ================================================================================================
// JOB 3113 · H1b — DIE ZAHL ALTERT AM ECHTEN KOPFBAND, OHNE DASS JEMAND NACHFRAGT.
// ================================================================================================
//
// Der Fall, den bis heute NICHTS gemessen hat: die Seite liegt offen, niemand wechselt, niemand
// fokussiert — es geht KEIN Abruf mehr ab. Die Zahl neben „Prüfen" stand trotzdem weiter und
// behauptete damit etwas über JETZT, was nur über DAMALS belegt war (§9: „Cache ohne frische
// Bestätigung = kein Badge").
//
// Gemountet am ECHTEN Kopfband über die realen Lese-Hooks, mit gemockten `endpoints` und
// `vi.useFakeTimers({ shouldAdvanceTime: true })`: erfolgreich laden → Zahl steht → 35 s vorspulen
// OHNE einen einzigen weiteren queryFn-Aufruf (mit `toHaveBeenCalledTimes` belegt) → die Zahl ist
// an ALLEN DREI Orten weg (Kopfband, Drawer-Liste, „Weitere Bereiche"), ohne Ersatzzeichen, der
// Punkt „Prüfen" steht weiter → ein Abruf gelingt → die Zahl steht wieder.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { Fragment, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { ZAEHLER_FRISCHE_MS } from "../../apps/web/src/lib/loadingState";
import { Kopfband } from "../../apps/web/src/shell/Kopfband";
import { KopfbandPunkteListe } from "../../apps/web/src/shell/KopfbandPunkte";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

// Unter falscher Uhr: die Warteschleife arbeitet die fälligen 0-ms-Aufgaben ab, OHNE die Uhr
// weiterzustellen. Nur `advanceTimersByTime` bewegt die Zeit — sonst wäre nicht messbar, ob die
// Zahl an der FRIST verschwindet oder irgendwann nebenbei.
const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await vi.advanceTimersByTimeAsync(0);
  }
};

// Der Drawer trägt dieselben fünf Punkte als Zeilenliste — er wird hier NEBEN dem Kopfband
// gerendert, damit beide Anzeigeorte in EINEM Lauf gemessen werden (die dritte Stelle, „Weitere
// Bereiche", sitzt im Zahnrad-Menü des Kopfbandes).
async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // Wie in `main.tsx`: dieselbe Frist als `staleTime` — react-query holt von sich aus nichts nach.
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: ZAEHLER_FRISCHE_MS } },
  });
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
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/"] },
                  createElement(
                    Fragment,
                    null,
                    createElement(Kopfband),
                    createElement(KopfbandPunkteListe),
                  ),
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

async function click(el: Element | null | undefined): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error("Element zum Klicken fehlt");
  }
  await act(async () => {
    el.click();
    await flush();
  });
}

/** Das Zahnrad-Menü öffnen und „Weitere Bereiche" aufklappen — der dritte Anzeigeort. */
async function weitereBereicheOeffnen(): Promise<void> {
  await click(container.querySelector('[data-testid="kopfband-zahnrad"]'));
  await click(container.querySelector('[data-testid="zahnrad-weitere-bereiche"]'));
}

const kopfbandZaehler = (): Element | null =>
  container.querySelector('header a[data-kopfband-punkt="validierung"] .kw-kopfband-zaehler');
const kopfbandPunkt = (): Element | null =>
  container.querySelector('header a[data-kopfband-punkt="validierung"]');
const drawerZaehler = (): Element | null =>
  container.querySelector('[data-testid="drawer-punkt-validierung"] .kw-menue-wert');
const bereichZaehler = (): Element | null =>
  container.querySelector('[data-testid="bereich-aufgaben"] .kw-menue-wert');
const byAria = (label: string): Element | null =>
  container.querySelector(`[aria-label="${label}"]`);

/** Wie oft jede der fünf Zählquellen bisher wirklich beim Server war. */
const abrufe = (): number[] => [
  d.board.fn.mock.calls.length,
  d.conflicts.fn.mock.calls.length,
  d.duplicates.fn.mock.calls.length,
  d.gaps.fn.mock.calls.length,
  d.lifecycle.fn.mock.calls.length,
];

/** Alle fünf Quellen erfolgreich beantworten: Board mit 2 offenen Prüfungen, sonst leer. */
async function alleQuellenBeantworten(): Promise<void> {
  await act(async () => {
    d.board.resolve([{ id: "a" }, { id: "b" }]);
    d.conflicts.resolve([]);
    d.duplicates.resolve([]);
    d.gaps.resolve({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } });
    await flush();
  });
}

beforeEach(async () => {
  // Die Uhr steht still, bis der Test sie stellt: nur so ist „35 Sekunden ohne Abruf" eine Messung
  // und keine Wette auf die Laufzeit der Testmaschine.
  vi.useFakeTimers();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("JOB 3113 H1b: die Zahl im Kopfband verschwindet, wenn sie niemand mehr bestätigt", () => {
  it("Zahl → 35 s ohne jeden Abruf → keine Zahl an allen drei Orten → Abruf gelingt → Zahl wieder da", async () => {
    await mount();
    await alleQuellenBeantworten();
    await weitereBereicheOeffnen();

    // (1) Frisch bestätigt: die Zahl steht an allen drei Orten.
    const validationLabel = i18n.t("nav.badge.validation", { count: 2 });
    expect(kopfbandZaehler()?.textContent).toBe("2");
    expect(drawerZaehler()?.textContent).toBe("2");
    expect(bereichZaehler()?.textContent).toBe("2");
    expect(byAria(validationLabel)).not.toBeNull();

    // (2) 35 Sekunden vergehen — OHNE dass irgendjemand nachfragt.
    const vorher = abrufe();
    await act(async () => {
      vi.advanceTimersByTime(35_000);
      await flush();
    });
    expect(abrufe(), "in diesen 35 s ging KEIN einziger Abruf ab").toEqual(vorher);

    // … die Zahl ist an allen drei Orten weg.
    expect(kopfbandZaehler()).toBeNull();
    expect(drawerZaehler()).toBeNull();
    expect(bereichZaehler()).toBeNull();
    expect(byAria(validationLabel)).toBeNull();

    // … und es steht KEIN Ersatzzeichen an ihrer Stelle: kein „!", kein Ladepunkt, keine graue
    // Zahl, kein Störungs-/Fehlermarker, kein `title`.
    expect(container.querySelectorAll(".kw-kopfband-zaehler").length).toBe(0);
    expect(byAria(i18n.t("nav.badge.stale"))).toBeNull();
    expect(byAria(i18n.t("nav.badge.error"))).toBeNull();
    expect(byAria(i18n.t("nav.badge.loading"))).toBeNull();
    expect(container.querySelector(".kw-kopfband-punkte")?.textContent).not.toContain("!");
    expect(container.querySelector(".kw-kopfband-punkte [title]")).toBeNull();

    // … der Punkt „Prüfen" selbst steht unverändert da (Text, Ziel, Fokusweg).
    expect(kopfbandPunkt()).not.toBeNull();
    expect(kopfbandPunkt()?.textContent).toBe(i18n.t("kopfband.pruefen"));
    expect(kopfbandPunkt()?.getAttribute("href")).toBe("/validierung");
    expect(container.querySelector('[data-testid="drawer-punkt-validierung"]')).not.toBeNull();

    // (3) Ein erneuter Abruf gelingt → die Zahl steht sofort wieder, frisch bestätigt.
    await act(async () => {
      void qc.refetchQueries({ queryKey: ["validation", "board"] });
      await flush();
    });
    await act(async () => {
      d.board.resolve([{ id: "a" }, { id: "b" }, { id: "c" }]);
      await flush();
    });
    expect(kopfbandZaehler()?.textContent).toBe("3");
    expect(drawerZaehler()?.textContent).toBe("3");
    expect(byAria(i18n.t("nav.badge.validation", { count: 3 }))).not.toBeNull();
  });

  it("kurz VOR der Frist steht die Zahl noch — sie verschwindet nicht irgendwann, sondern genau dann", async () => {
    await mount();
    await alleQuellenBeantworten();
    expect(kopfbandZaehler()?.textContent).toBe("2");

    // Eine Sekunde vor Ablauf: die Zahl ist noch gedeckt.
    await act(async () => {
      vi.advanceTimersByTime(ZAEHLER_FRISCHE_MS - 1_000);
      await flush();
    });
    expect(kopfbandZaehler()?.textContent).toBe("2");

    // Über die Frist hinaus: weg.
    await act(async () => {
      vi.advanceTimersByTime(2_000);
      await flush();
    });
    expect(kopfbandZaehler()).toBeNull();
  });

  // Alle DREI Orte auch auf Englisch (Ben an Runde 3, Prüflücke 6: gemessen war nur das Kopfband).
  // Lieferung 7 verlangt Sprachgleichheit an jedem Anzeigeort, nicht nur am obersten.
  it("auf Englisch gilt dasselbe an allen drei Orten — es verschwindet die Zahl, nicht der Punkt", async () => {
    await i18n.changeLanguage("en");
    await mount();
    await alleQuellenBeantworten();
    await weitereBereicheOeffnen();
    expect(kopfbandZaehler()?.textContent).toBe("2");
    expect(drawerZaehler()?.textContent).toBe("2");
    expect(bereichZaehler()?.textContent).toBe("2");
    expect(byAria(i18n.t("nav.badge.validation", { count: 2 }))).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(35_000);
      await flush();
    });
    expect(kopfbandZaehler()).toBeNull();
    expect(drawerZaehler()).toBeNull();
    expect(bereichZaehler()).toBeNull();
    expect(byAria(i18n.t("nav.badge.validation", { count: 2 }))).toBeNull();
    // Kein Ersatzzeichen, und der Punkt selbst steht in beiden Sprachen unverändert da.
    expect(container.querySelectorAll(".kw-kopfband-zaehler").length).toBe(0);
    expect(kopfbandPunkt()?.textContent).toBe(i18n.t("kopfband.pruefen"));
    expect(container.querySelector('[data-testid="drawer-punkt-validierung"]')).not.toBeNull();
  });

  // ==============================================================================================
  // MECHANIK-PROBE (react-query), NICHT der Produkt-Schreiber
  // ==============================================================================================
  // WAS DIESER FALL IST: die Vorführung des Mechanismus hinter dem bekannten offenen Rest.
  // `setQueryData` setzt `dataUpdatedAt` auf JETZT, also gilt eine nur ÖRTLICH veränderte Liste
  // für `gruppeVeraltet` wieder als frisch bestätigt — Codex' Befund an Runde 1, wörtlich: „Eine
  // lokale Cache-Änderung lässt die abgelaufene Zahl ohne erfolgreichen neuen Listenabruf wieder
  // erscheinen." Der Cache wird hier vom TEST geschrieben, mit einem gewöhnlichen Aufruf.
  //
  // WAS DIESER FALL NICHT IST — Ben an Runde 3, Korrekturpflicht 2: er misst NICHT den Löschweg
  // der Prüfen-Seite. Runde 3 behauptete, er werde rot, sobald H1c den Produkt-Schreiber umstellt;
  // Bens Gegenprobe hat das widerlegt (Schreiber umgestellt → dieser Fall unverändert grün), denn
  // er schreibt seinen Cache selbst. Diese Behauptung ist hiermit zurückgenommen.
  //
  // WER H1c BEMERKT: `kein-frischer-cache-eingriff.test.ts`. Der liest den wirklichen Quelltext;
  // sobald der bekannte Zugriff in `pages/Validation.tsx` einen erhaltenen `updatedAt` mitgibt,
  // fällt er dort aus der Erhebung und der Fall „der bekannte Zugriff steht noch" wird rot und
  // verlangt das Streichen des Eintrags.
  //
  // Warum der Rest überhaupt offen ist: zu schliessen ist er nur beim SCHREIBER — react-query gibt
  // am Ergebnis kein Feld heraus, das ausschliesslich echte Abrufe zählt. Der eine bekannte
  // Schreiber steht in `pages/Validation.tsx`; diese Datei hält zur Laufzeit JOB 3112 (Q3d), und
  // zwei Bahnen an derselben Produktdatei sind verboten. Die Umstellung ist H1c.
  it("MECHANIK: ein gewöhnliches setQueryData lässt die abgelaufene Zahl wieder erscheinen", async () => {
    await mount();
    await alleQuellenBeantworten();
    await act(async () => {
      vi.advanceTimersByTime(35_000);
      await flush();
    });
    expect(kopfbandZaehler()).toBeNull();

    const vorEingriff = d.board.fn.mock.calls.length;
    await act(async () => {
      qc.setQueriesData<{ id: string }[]>({ queryKey: ["validation", "board"] }, (items) =>
        items?.filter((k) => k.id !== "a"),
      );
      await flush();
    });
    // Kein einziger neuer Abruf — die Zahl kommt allein aus dem örtlichen Schreiben zurück.
    expect(d.board.fn.mock.calls.length, "es wurde nichts nachgefragt").toBe(vorEingriff);
    expect(
      kopfbandZaehler()?.textContent,
      "Mechanik von react-query: `setQueryData` setzt `dataUpdatedAt` auf jetzt, die Zahl gilt " +
        "danach wieder als bestätigt. Diese Probe schreibt selbst und sagt daher NICHTS über den " +
        "Löschweg der Prüfen-Seite aus; dessen Umstellung bemerkt " +
        "`kein-frischer-cache-eingriff.test.ts` am Quelltext.",
    ).toBe("1");
  });

  it("zwei Zahlen unterschiedlichen Alters laufen NACHEINANDER ab — die zweite bleibt nicht hängen", async () => {
    await mount();
    // (1) Nur das Board antwortet — Stand t0.
    await act(async () => {
      d.board.resolve([{ id: "a" }, { id: "b" }]);
      await flush();
    });
    // (2) Zehn Sekunden später antworten die übrigen Quellen — Stand t0+10 s.
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await flush();
    });
    await act(async () => {
      d.conflicts.resolve([
        { id: "c-1", status: "offen" },
        { id: "c-2", status: "offen" },
      ]);
      d.duplicates.resolve([]);
      d.gaps.resolve({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } });
      await flush();
    });
    await weitereBereicheOeffnen();
    const konflikteZaehler = (): Element | null =>
      container.querySelector('[data-testid="bereich-konflikte"] .kw-menue-wert');
    expect(kopfbandZaehler()?.textContent).toBe("2");
    expect(konflikteZaehler()?.textContent).toBe("2");

    // (3) t0+31 s: die Prüf-Zahl ist ungedeckt, die 21 s alte Konflikt-Zahl noch gedeckt.
    await act(async () => {
      vi.advanceTimersByTime(21_000);
      await flush();
    });
    expect(kopfbandZaehler()).toBeNull();
    expect(konflikteZaehler()?.textContent).toBe("2");

    // (4) t0+41 s: auch die Konflikt-Zahl ist ungedeckt. Ohne einen ZWEITEN Ablaufzeitpunkt bliebe
    // sie für immer stehen — der erste Ablauf hat die Oberfläche schon einmal neu gezeichnet.
    await act(async () => {
      vi.advanceTimersByTime(10_000);
      await flush();
    });
    expect(konflikteZaehler()).toBeNull();
  });
});
