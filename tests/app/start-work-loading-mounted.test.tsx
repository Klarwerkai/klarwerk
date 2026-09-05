// @vitest-environment jsdom
// AUFTRAG-mega2 Block C (bens D9): die Startseite behauptet vor der Datenladung KEIN „nichts zu tun"
// (echte 0) mehr. Gemountet an der ECHTEN Start-Seite.
//
// ================================================================================================
// JOB 3064 H5 — DIESELBE ZUSAGE, DIE NEUE FLÄCHE.
// ================================================================================================
// Aus „Nächste Handlungen" ist die Karte „FÜR DICH" geworden (Zielbild `design/klarwerk/Main.dc.html`,
// Z.45–64), und §9 des Auftrags entscheidet die drei Lagen anders, als sie hier bisher gemessen
// wurden. Die ZUSAGE ist wörtlich dieselbe geblieben — keine erfundene Zahl, keine 0 aus fehlenden
// Daten, kein endloses „lädt", eine Störung sieht nicht wie Leere aus —, nur ihre SICHTBARE Form
// hat sich geändert (Pedi 04.09.: kein Erklärtext im Sichtfeld):
//
//   vorher                                  jetzt
//   ────────────────────────────────────────────────────────────────────────────────────────────
//   „Arbeitsübersicht wird geladen …"       die Karte bleibt LEER — keine Zeile, keine Pille
//   „Nichts offen. Gut gemacht."            EINE Zeile „Nichts offen."
//   „Konnte nicht geladen werden." + Knopf  keine Zeile, keine Pille, aber der Knopf „Erneut
//                                           versuchen" — die Störung bleibt sichtbar und
//                                           bedienbar, und eine Knopfbeschriftung ist kein
//                                           Erklärtext
//   „Veraltet – Aktualisierung …"           unverändert derselbe Wortlaut, als Zeile in der Karte
//
// Alles, was dieser Test darüber hinaus misst (genau ein Neulauf je Quelle, kein Selbstheilen ohne
// Klick, Abbau und isolierter Zweitlauf), ist unverändert geblieben.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// mega3 Block B: „channel"-Mock — jeder queryFn-Aufruf (auch Refetch) erhält ein frisches Promise;
// der Test steuert dessen Ausgang (resolve/reject). Ermöglicht pending→success, Initialfehler und Stale.
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
  // JOB 3064 H5: die Meldungen sind die dritte Quelle der Karte „FÜR DICH" (§5.2 des Auftrags) und
  // werden deshalb genauso gesteuert und gezählt wie die vier bisherigen — sonst hinge die Karte
  // an einer tragenden Quelle, über die dieser Test nichts aussagt.
  return { board: mk(), conflicts: mk(), pending: mk(), gaps: mk(), meldungen: mk() };
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
        overview: ok({ total: 0, byStatus: { offen: 0, validiert: 0 } }),
      },
      validation: { board: d.board.fn },
      conflicts: { list: d.conflicts.fn },
      lifecycle: { pending: d.pending.fn },
      gaps: { summary: d.gaps.fn },
      ko: { list: ok([]) },
      learningPaths: { byRole: ok(null), progress: ok(null) },
      livewall: { get: ok({ saved: [], helped: [], helpedToday: 0 }) },
      notifications: { list: d.meldungen.fn },
      duplicateSignal: { list: ok([]) },
      reasoner: { config: ok(null), assistPresets: ok([]), status: ok(null) },
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
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { markStartOrientationSeen } from "../../apps/web/src/lib/startOrientation";
import { Start } from "../../apps/web/src/pages/Start";

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
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(MemoryRouter, { initialEntries: ["/"] }, createElement(Start)),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

// ── Die vier Lagen der Karte „FÜR DICH", an der gerenderten Karte abgelesen ─────────────────────
// Gemessen wird an der Karte SELBST (`h5-fuerdich`), nicht am ganzen Container: daneben steht die
// Karte „ZULETZT", und ihr eigener Leerzustand („Noch nichts erfasst.") würde eine Messung über
// den ganzen Text still verfälschen.
function karte(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-testid="h5-fuerdich"]');
  if (!el) {
    throw new Error("die Karte „FÜR DICH“ steht gar nicht im DOM");
  }
  return el;
}
const zeilen = (): number => container.querySelectorAll('[data-testid="h5-fuerdich-zeile"]').length;
const pille = (): Element | null => container.querySelector('[data-testid="h5-fuerdich-pille"]');
const wiederholen = (): Element | null =>
  container.querySelector('[data-testid="h5-fuerdich-wiederholen"]');
const veraltet = (): Element | null =>
  container.querySelector('[data-testid="h5-fuerdich-veraltet"]');

/** §9: „lädt" zeigt NICHTS — keine Zeile, keine Pille, kein Satz, kein Knopf. */
function erwarteLaedt(): void {
  expect(karte().textContent, "die Karte behauptet im Ladezustand etwas").toBe("");
  expect(zeilen()).toBe(0);
  expect(pille()).toBeNull();
  expect(wiederholen()).toBeNull();
}
/** §9: geladen und wirklich leer — EINE Zeile, keine Pille. */
function erwarteLeer(): void {
  expect(karte().textContent).toContain(i18n.t("task.none"));
  expect(zeilen()).toBe(0);
  expect(pille()).toBeNull();
  expect(wiederholen()).toBeNull();
}
/** §9 + REGELN §7: gescheitert — keine erfundene Zahl, aber die Störung ist sichtbar UND bedienbar. */
function erwarteGescheitert(): void {
  expect(wiederholen(), "die Störung sieht aus wie Leere — kein Wiederholen-Knopf").not.toBeNull();
  expect(karte().textContent).toContain(i18n.t("loadstate.error.retry"));
  expect(karte().textContent).not.toContain(i18n.t("task.none"));
  expect(zeilen()).toBe(0);
  expect(pille()).toBeNull();
}
/** REGELN §7: veraltet — der zuletzt geholte Stand bleibt SICHTBAR und wird markiert. */
function erwarteVeraltet(): void {
  expect(veraltet(), "die gescheiterte Auffrischung ist nicht markiert").not.toBeNull();
  expect(karte().textContent).toContain(i18n.t("loadstate.stale"));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  // JOB 3064 H5: die Startseite setzt einer Administratorin beim ERSTEN Besuch eine Zeile
  // „Ersteinrichtung" in „FÜR DICH" (§5a). Dieser Test misst die LADELAGEN der Arbeitsquellen —
  // gemessen wird deshalb die wiederkehrende Nutzerin, sonst trüge die Karte immer einen Eintrag
  // und der Leerzustand käme nie vor. Der Vermerk wird über die produktive Funktion gesetzt, nicht
  // über einen abgeschriebenen Speicherschlüssel.
  markStartOrientationSeen(window.localStorage);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Block C: Start-Arbeitsübersicht zeigt ehrlichen Ladezustand statt vorschneller 0", () => {
  it("VOR Auflösung Ladezustand, NACH Auflösung echter Leerzustand", async () => {
    await mount();
    // VOR: die Karte ist leer — kein „lädt", aber auch kein „nichts offen".
    erwarteLaedt();

    // NACH: alle tragenden Quellen leer aufgelöst → echter Leerzustand.
    await act(async () => {
      loeseAlleAuf();
      await flush();
    });

    erwarteLeer();
  });

  it("mega3 Block B: initial gescheiterte tragende Quelle → Störung mit Wiederholen, kein „lädt“, kein „nichts zu tun“", async () => {
    await mount();
    erwarteLaedt();

    await act(async () => {
      d.board.reject(new Error("kaputt"));
      loeseAlleAuf("board");
      await flush();
    });

    // Ehrliche Störung statt endlosem „lädt" oder vorschnellem Leerzustand.
    erwarteGescheitert();
  });

  it("mega3 Block B: Stale — Daten da, Refetch scheitert → Übersicht bleibt, Störungsmarkierung sichtbar", async () => {
    await mount();
    await act(async () => {
      loeseAlleAuf();
      await flush();
    });
    // Echter Leerzustand geladen.
    erwarteLeer();

    await act(async () => {
      void qc.invalidateQueries();
      await flush();
      d.board.reject(new Error("refetch kaputt"));
      d.conflicts.reject(new Error("refetch kaputt"));
      d.pending.reject(new Error("refetch kaputt"));
      d.gaps.reject(new Error("refetch kaputt"));
      d.meldungen.reject(new Error("refetch kaputt"));
      await flush();
    });

    // Der zuletzt geholte Stand bleibt sichtbar (kein Initialfehler-Sturz) …
    expect(karte().textContent).toContain(i18n.t("task.none"));
    // … aber als veraltet/gestört markiert.
    erwarteVeraltet();
  });
});

// ================================================================================================
// JOB 989 · D22 — L1, L2, L3: DER LADEVERTRAG WIRD AM ECHTEN PRODUKTPFAD GEMESSEN.
// ================================================================================================
//
// Die drei Fälle oben prüfen ZUSTÄNDE. Was sie nicht prüfen, ist die HANDLUNG, die aus dem
// Fehlerzustand herausführt: der Knopf „Wiederholen". Er ist die einzige Zusage, die der
// Fehlerzustand dem Benutzer macht — ein Fehlerzustand mit einem Knopf, der nichts tut, ist
// schlimmer als gar keiner, weil er eine Handlung verspricht, die es nicht gibt.
//
// Gemessen wird gegen den echten Produktpfad:
//   `Start.tsx:218-223`  retryWork() → board/conflicts/pending/gapsSummary.refetch()
//   `Start.tsx:563-567`  workError → <LoadErrorState onRetry={retryWork} />
//   `LoadState.tsx:16-23` der Knopf, der onRetry auslöst
//   `lib/loadingState.ts` groupLoadPhase / isGroupStale — die Gruppenregel darunter
//
// KEINE QUELLTEXTKOPIE ALS ERSATZ FÜR LAUFZEITWIRKUNG (Pflicht 4): Der Knopf wird wirklich
// geklickt, und gezählt wird an den `queryFn`-Aufrufen des Mocks, nicht an einer Zusicherung über
// den Quelltext.

// Die vier tragenden Quellen der Arbeitsübersicht sind `workSources` (`Start.tsx:211`):
// board, conflicts, pending, gapsSummary. L1 misst `board`, L2 die übrigen drei einzeln.
//
// Die Nutzlast, die jede Quelle im Erfolgsfall liefert — leer, aber gültig. „Leer" und „nicht
// geladen" sind verschiedene Aussagen; genau das ist der Gegenstand dieses Tests.
function loeseAlleAuf(ausser?: string): void {
  if (ausser !== "board") {
    d.board.resolve([]);
  }
  if (ausser !== "conflicts") {
    d.conflicts.resolve([]);
  }
  if (ausser !== "pending") {
    d.pending.resolve([]);
  }
  if (ausser !== "gaps") {
    d.gaps.resolve({ open: 0, byPriority: { hoch: 0, mittel: 0, niedrig: 0 } });
  }
  if (ausser !== "meldungen") {
    d.meldungen.resolve([]);
  }
}

// Sucht den echten „Wiederholen"-Knopf im gerenderten DOM. Bewusst über den sichtbaren,
// übersetzten Text — nicht über eine Testkennung, die es im Produkt gar nicht gibt.
function wiederholenKnopf(): HTMLButtonElement {
  const beschriftung = i18n.t("loadstate.error.retry");
  const treffer = Array.from(container.querySelectorAll("button")).filter((b) =>
    (b.textContent ?? "").includes(beschriftung),
  );
  if (treffer.length === 0) {
    throw new Error(`kein Knopf mit der Beschriftung "${beschriftung}" im DOM`);
  }
  return treffer[0] as HTMLButtonElement;
}

// Zählt die tatsächlichen queryFn-Aufrufe je Quelle — die Messgröße für „exakt ein Neulauf".
// Fester Typ statt `Record<string, number>`: Der Web-Typprüfer läuft mit
// `noUncheckedIndexedAccess`, und ein Indexzugriff auf einen offenen Record wäre dort
// `number | undefined` — die Differenzrechnung unten würde nicht übersetzen.
interface Aufrufzaehler {
  board: number;
  conflicts: number;
  pending: number;
  gaps: number;
  meldungen: number;
}

function aufrufe(): Aufrufzaehler {
  return {
    board: d.board.fn.mock.calls.length,
    conflicts: d.conflicts.fn.mock.calls.length,
    pending: d.pending.fn.mock.calls.length,
    gaps: d.gaps.fn.mock.calls.length,
    meldungen: d.meldungen.fn.mock.calls.length,
  };
}

const QUELLEN = ["board", "conflicts", "pending", "gaps", "meldungen"] as const;

describe("L1: der Wiederholen-Knopf loest einen ECHTEN Neulauf aus", () => {
  it("L1a: Klick im Fehlerzustand startet je Quelle GENAU EINEN neuen Abruf", async () => {
    await mount();
    await act(async () => {
      d.board.reject(new Error("kaputt"));
      loeseAlleAuf("board");
      await flush();
    });
    erwarteGescheitert();

    const vorher = aufrufe();
    await act(async () => {
      wiederholenKnopf().click();
      await flush();
    });
    const nachher = aufrufe();

    // Der Produktvertrag (`Start.tsx`, `wiederholen()`) refetcht ALLE tragenden Quellen — auch die
    // bereits erfolgreichen. Genau EIN zusaetzlicher Aufruf je Quelle, kein zweiter, keiner
    // ausgelassen.
    for (const name of QUELLEN) {
      expect(nachher[name] - vorher[name]).toBe(1);
    }
  });

  it("L1b: nach erfolgreichem Neulauf verschwindet der Fehlerzustand und der echte Leerzustand erscheint", async () => {
    await mount();
    await act(async () => {
      d.board.reject(new Error("kaputt"));
      loeseAlleAuf("board");
      await flush();
    });
    erwarteGescheitert();

    await act(async () => {
      wiederholenKnopf().click();
      await flush();
      // Der Neulauf gelingt diesmal.
      loeseAlleAuf();
      await flush();
    });

    erwarteLeer();
  });

  it("L1c: ohne Klick passiert NICHTS — der Fehlerzustand loest sich nicht von selbst auf", async () => {
    // Die Kalibrierung zu L1a/L1b: Ohne sie waere „nach dem Klick ist es besser" auch dann erfuellt,
    // wenn react-query im Hintergrund ohnehin neu laedt und der Knopf gar nichts beitraegt.
    await mount();
    await act(async () => {
      d.board.reject(new Error("kaputt"));
      loeseAlleAuf("board");
      await flush();
    });

    const vorher = aufrufe();
    await act(async () => {
      await flush();
      await flush();
    });

    expect(aufrufe()).toEqual(vorher);
    erwarteGescheitert();
  });
});

describe("L2: jede tragende Quelle einzeln — beide Uebergaenge und genau ein Neulauf", () => {
  // BEN4 D21, Pruefluecke 5, woertlich: „L2 fuer `conflicts`, `pending` und `gaps` am Produkt
  // messen und je Quelle beide Uebergaenge sowie exakt einen Retry-Neulauf testen."
  //
  // Gemessen wird JEDE Quelle als ALLEINIGE Fehlerursache. Das ist der Unterschied zu einem
  // Sammelfall: Faellt nur `board` aus, bliebe unbemerkt, ob die Gruppenregel die uebrigen drei
  // ueberhaupt beruecksichtigt (`loadingState.ts:38` prueft `sources.some(...)`).
  for (const quelle of ["conflicts", "pending", "gaps", "meldungen"] as const) {
    it(`L2-${quelle}: Fehlerzustand → Wiederholen → echter Leerzustand, mit genau einem Neulauf je Quelle`, async () => {
      await mount();

      // Uebergang 1: diese eine Quelle scheitert, alle anderen liefern.
      await act(async () => {
        d[quelle].reject(new Error(`${quelle} kaputt`));
        loeseAlleAuf(quelle);
        await flush();
      });
      erwarteGescheitert();

      // Genau ein Neulauf je Quelle.
      const vorher = aufrufe();
      await act(async () => {
        wiederholenKnopf().click();
        await flush();
      });
      const nachher = aufrufe();
      for (const name of QUELLEN) {
        expect(nachher[name] - vorher[name]).toBe(1);
      }

      // Uebergang 2: der Neulauf gelingt → echter Leerzustand.
      await act(async () => {
        loeseAlleAuf();
        await flush();
      });
      erwarteLeer();
    });
  }
});

describe("L3: Teardown und isolierter Zweitlauf", () => {
  // BEN4 D21, Pruefluecke 6: „L3 mit vollstaendigem QueryClient-/Observer-/Listener-/Timer-/
  // Cacheabbau und isoliertem Zweitlauf bauen und gegenmutieren."
  //
  // Warum das zaehlt: Bleibt nach dem Abbau ein Observer stehen, laeuft die naechste Montage auf
  // einem warmen Cache und einer fremden Subskription. Dann misst der Folgetest nicht mehr, was er
  // zu messen glaubt — und ein Leck dieser Art faellt erst auf, wenn ein anderer Test unerklaerlich
  // kippt.

  it("L3a: nach dem Abbau bleibt WEDER ein Observer NOCH ein Cacheeintrag stehen", async () => {
    await mount();
    await act(async () => {
      loeseAlleAuf();
      await flush();
    });
    // Vorbedingung: es gab ueberhaupt etwas abzubauen.
    expect(qc.getQueryCache().getAll().length).toBeGreaterThan(0);

    await act(() => root.unmount());
    // Nach dem Unmount haelt keine Komponente mehr eine Subskription.
    for (const eintrag of qc.getQueryCache().getAll()) {
      expect(eintrag.getObserversCount()).toBe(0);
    }

    // Und der Abbau des Clients raeumt den Cache vollstaendig ab.
    qc.clear();
    expect(qc.getQueryCache().getAll()).toHaveLength(0);
    expect(qc.getMutationCache().getAll()).toHaveLength(0);

    // Der afterEach-Abbau darf danach nicht erneut unmounten.
    container.remove();
    container = document.createElement("div");
    root = createRoot(container);
  });

  it("L3c: nach dem Abbau ruft NICHTS mehr die Quellen an — kein Timer, kein Listener ueberlebt", async () => {
    // Der beobachtbare Beleg fuer „Timer- und Listenerabbau": Eine abgebaute Seite darf die
    // Datenquellen nicht mehr anfassen. Ein Intervall oder eine Subskription ohne Aufraeumen faellt
    // genau hier auf — und sonst erst dann, wenn irgendwann ein fremder Test unerklaerlich kippt.
    await mount();
    await act(async () => {
      loeseAlleAuf();
      await flush();
    });

    await act(() => root.unmount());
    const nachAbbau = aufrufe();

    // Reichlich Gelegenheit fuer einen ueberlebenden Timer, sich zu melden.
    await act(async () => {
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 1));
      }
    });

    expect(aufrufe()).toEqual(nachAbbau);

    container.remove();
    container = document.createElement("div");
    root = createRoot(container);
  });

  it("L3b: der ZWEITE Lauf startet isoliert — frische Zaehler, frischer Ladezustand", async () => {
    // Erster Lauf, vollstaendig durchgefahren und abgebaut.
    await mount();
    await act(async () => {
      loeseAlleAuf();
      await flush();
    });
    erwarteLeer();
    const nachErstlauf = aufrufe();
    expect(nachErstlauf.board).toBeGreaterThan(0);

    await act(() => root.unmount());
    qc.clear();
    container.remove();
    vi.clearAllMocks();

    // Zweiter Lauf: eigener QueryClient, eigener Container, zurueckgesetzte Zaehler.
    await mount();

    // Der Zaehler beginnt wirklich neu — nicht bei den Aufrufen des ersten Laufs.
    expect(aufrufe().board).toBe(1);
    // Und der Ladezustand erscheint ERNEUT: kein warmer Cache traegt das Ergebnis herueber.
    erwarteLaedt();

    await act(async () => {
      loeseAlleAuf();
      await flush();
    });
    erwarteLeer();
  });
});
