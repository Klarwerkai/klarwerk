// @vitest-environment jsdom
// ================================================================================================
// JOB 3098 (Q6b) — DIE DRITTE FLÄCHE: DIE KARTE „FÜR DICH" AUF `/start`.
// ================================================================================================
//
// JOB 3084 hat die Offline-Regel gebaut und an ZWEI Flächen gereicht (Lesefläche, Menüblatt „Eigene
// Objekte"). Der DRITTE Aufrufer, `pages/Start.tsx`, rief `eigeneKollisionStart` mit EINEM Argument
// und fiel damit auf den Vorgabewert `ONLINE_WENN_UNGEFRAGT = true` — die Kollisionszeile in „FÜR
// DICH" stand nach einer Netztrennung ohne jeden Vorbehalt da. Genau das ist Codex' Befund R-1585,
// nur an der dritten Fläche.
//
// ZWEI FEHLERRICHTUNGEN, UND BEIDE WERDEN HIER GEMESSEN:
//   · zu VIEL behaupten: die Karte gilt als frisch, obwohl das Gerät offline ist (S-1, S-2).
//   · zu WENIG zeigen: der bereits bekannte Befund verschwindet offline still (ebenfalls S-1, S-2,
//     die auf die Zeile bestehen). Das wäre A27 rückwärts — „eine Kollision, die der Autorin
//     verschwiegen wird" (`lib/eigeneKollision.ts:426-428`).
// Dazwischen liegt der kalte Einstieg (S-3): ohne früheren Stand entsteht KEINE Zeile und KEINE
// Zahl, sondern die Störung.
//
// UND DIE KARTE MUSS DIE QUELLEN KENNEN, AUS DENEN IHRE ZEILEN STAMMEN (S-4, S-5): die
// Kollisionszeile entsteht allein aus `duplicate-signal` und `ko.list`; standen die zwei nicht in
// `arbeitsQuellen`, behauptete die Karte Frische über eine Zeile, deren Quelle noch lud oder
// gescheitert war. Dieselbe Regel, aus der `eigeneKollision.ts:467-479` die KO-Liste in die
// Gesamtlage nimmt.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 3 — DER WEG AUS DER STÖRUNG HERAUS, UND WAS HIER AUSDRÜCKLICH NOCH NICHT STEHT.
// ------------------------------------------------------------------------------------------------
//
// Ben hat an Runde 1 einen zweiten Fehler gefunden, der nicht die Anzeige betrifft, sondern die
// HANDLUNG: die Karte war um zwei Quellen gewachsen, ihr Wiederholen-Weg nicht. Wörtlich: „Nach
// behobenem Serverfehler erzeugt der Klick jeweils null Abrufe der betroffenen Quelle." Ein Knopf,
// der die Störung nicht behebt, die er anbietet. Das ist in S-7/S-8 gemessen und behoben.
//
// WAS HIER NICHT STEHT, UND WARUM. Bens Korrekturpflichten 2 und 3 („Nichts offen." nur bei
// `frisch`; offline kein Wiederholen-Angebot) sitzen beide in `components/start/StartKarten.tsx`
// (`:113`, `:133-153`). Diese Datei liegt AUSSERHALB der Zielpfade von JOB 3098; Ben hat ihre
// Aufnahme ausdrücklich verlangt, die Vorprüfung des Tors hat Runde 2 genau daran rot gemacht
// (`ZIELPFAD-VERSTOSS`). Solange das nicht entschieden ist, halten S-1/S-3 den HEUTIGEN Stand fest,
// samt seiner Mängel — ein Test, der eine Behebung behauptet, die es nicht gibt, wäre schlimmer als
// der Mangel selbst. Der Befund und der genaue Griff stehen unter „RESTSCHULD" in `start/forYou.ts`.
//
// S-10 misst das Gegengewicht: bei einer wirklich GESCHEITERTEN Auffrischung bleibt alles, wie es
// war — die Werte verschwinden nicht (REGELN §7).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const box = vi.hoisted(() => ({
  kanal: {} as Record<"kos" | "conflicts" | "signal", () => Promise<unknown>>,
}));

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "experte" })),
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
import type { EigenerBefund } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { type ForYouQuelle, forYouLage } from "../../apps/web/src/components/start/forYou";
import i18n from "../../apps/web/src/i18n";
import { Start } from "../../apps/web/src/pages/Start";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

// ------------------------------------------------------------------------------------------------
// T · OHNE MOUNT: `forYouLage` fragt das Netz
// ------------------------------------------------------------------------------------------------
//
// Die Lage der Karte entsteht aus Skalaren — genau wie `quellenlage()` in `eigeneKollision.ts`, und
// aus demselben Grund: eine Regel, die nur über einen Mount prüfbar ist, wird nicht in einer
// Tabelle geprüft. `isPaused` kannte die Funktion schon; der Onlinezustand fehlte ihr — dieselbe
// Lücke, die `quellenlage()` bis JOB 3084 hatte.
describe("JOB 3098 · T · forYouLage kennt den Onlinezustand", () => {
  const mitDaten: readonly ForYouQuelle[] = [
    { data: [], isError: false, isPaused: false },
    { data: [], isError: false, isPaused: false },
  ];

  it("T-1 · alle Quellen haben Daten, keine ist gestört, aber offline → `veraltet`", () => {
    expect(forYouLage(mitDaten, false)).toBe("veraltet");
    // Das Gegenstück in derselben Zeile: ohne die Netzfrage wäre T-1 auch dann grün, wenn die
    // Funktion IMMER `veraltet` sagte.
    expect(forYouLage(mitDaten, true)).toBe("frisch");
  });

  it("T-2 · eine Quelle ohne Daten und offline → `gescheitert`, nicht `laedt`", () => {
    const eineOhneDaten: readonly ForYouQuelle[] = [
      ...mitDaten,
      { data: undefined, isError: false, isPaused: false },
    ];
    expect(forYouLage(eineOhneDaten, false)).toBe("gescheitert");
    // Online ist derselbe Zustand ein laufender Erstabruf — und der darf NIE wie eine Störung
    // aussehen (dieselbe Unterscheidung wie `quellenlage()` zwischen `laedt` und `erstfehler`).
    expect(forYouLage(eineOhneDaten, true)).toBe("laedt");
  });
});

// ------------------------------------------------------------------------------------------------
// S · GEMOUNTET: die echte Startseite
// ------------------------------------------------------------------------------------------------
const DUBLETTE: EigenerBefund = {
  koId: "ko-1",
  dublette: true,
  konflikt: false,
  deckung: { lage: "kein_lauf", geprueft: null, bestand: null },
};

const leerAntwort = async (): Promise<unknown> => [];
const haengt = (): Promise<never> => new Promise<never>(() => {});
const scheitert = async (): Promise<never> => {
  throw new Error("Abruf gescheitert");
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | undefined;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  await act(async () => {
    neu.render(
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
}

/** Die Karte „FÜR DICH" — nicht das Menüblatt. Hier steht die Zeile, um die es geht. */
function karte(): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-testid="h5-fuerdich"]');
  if (!el) {
    throw new Error("Die Karte „FÜR DICH“ fehlt");
  }
  return el;
}

const kartenText = (): string => (karte().textContent ?? "").replace(/\s+/g, " ");
const zeilen = (): readonly string[] =>
  [...container.querySelectorAll('[data-testid="h5-fuerdich-zeile"]')].map((z) =>
    (z.textContent ?? "").replace(/\s+/g, " "),
  );
const pille = (): string | null =>
  container.querySelector('[data-testid="h5-fuerdich-pille"]')?.textContent ?? null;
const veraltetMarke = (): string | null =>
  container.querySelector('[data-testid="h5-fuerdich-veraltet"]')?.textContent ?? null;
const wiederholenKnopf = (): HTMLButtonElement | null =>
  container.querySelector<HTMLButtonElement>('[data-testid="h5-fuerdich-wiederholen"]');
const wiederholenDa = (): boolean => wiederholenKnopf() !== null;
/** Klickt den echten Knopf der echten Karte — keine Abkürzung über den Rückruf. */
async function wiederholenKlicken(): Promise<void> {
  const knopf = wiederholenKnopf();
  if (!knopf) {
    throw new Error("kein Wiederholen-Knopf in der Karte „FÜR DICH“");
  }
  await act(async () => {
    knopf.click();
    await flush();
  });
  await act(flush);
}

const DUBLETTEN_SATZ = (): string => i18n.t("kollision.start.dublette", { n: 1 });

async function netzTrennen(): Promise<void> {
  await act(async () => {
    onlineManager.setOnline(false);
    await flush();
  });
}

/** Die ganze Seite ab und neu — mit DEMSELBEN `QueryClient`, also mit erhaltenem Zwischenspeicher. */
async function neuBetreten(): Promise<void> {
  const alt = root;
  await act(async () => {
    alt?.unmount();
  });
  container.remove();
  await mount();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.kanal = { kos: leerAntwort, conflicts: leerAntwort, signal: leerAntwort };
  onlineManager.setOnline(true);
  window.localStorage.clear();
  // Dieselbe Frist wie im Betrieb (`main.tsx:21`) — sie ERZEUGT den Fall: innerhalb der 30 s will
  // beim Zurückkommen niemand einen Abruf, also gibt es kein `paused`, aus dem die Regel den
  // Offline-Zustand ablesen könnte.
  qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
});

afterEach(() => {
  // Die T-Fälle oben montieren nichts — sie prüfen die Regel als Funktion. Ohne diese Abfrage
  // scheiterte der Abbau an ihnen und ihre echte Aussage ginge in einem zweiten Fehler unter.
  const alt = root;
  if (alt !== undefined) {
    act(() => alt.unmount());
    container.remove();
  }
  root = undefined;
  qc.clear();
  onlineManager.setOnline(true);
  vi.clearAllMocks();
});

describe("JOB 3098 · der Befund bleibt, die Frischebehauptung geht", () => {
  it("S-0 · KALIBRIERUNG: online steht die Zeile OHNE Veraltet-Markierung", async () => {
    box.kanal.signal = async () => [DUBLETTE];
    await mount();
    expect(zeilen()).toEqual([expect.stringContaining(DUBLETTEN_SATZ())]);
    expect(pille()).toBe("1");
    expect(veraltetMarke()).toBeNull();
  });

  it("S-1 · Netz fällt weg, während die Seite offen steht → Zeile bleibt, Karte ist markiert", async () => {
    box.kanal.signal = async () => [DUBLETTE];
    await mount();
    await netzTrennen();

    // A27 rückwärts wäre der zweite Fehler: der bekannte Befund darf NICHT still verschwinden.
    expect(zeilen()).toEqual([expect.stringContaining(DUBLETTEN_SATZ())]);
    // …und die Karte behauptet nicht länger, sie sei frisch.
    expect(veraltetMarke()).toBe(i18n.t("loadstate.stale"));
    expect(kartenText()).not.toContain(i18n.t("task.none"));
    // OFFENE RESTSCHULD (Ben, Runde 1, Korrekturpflicht 3): der Wortlaut nennt hier eine
    // „Aktualisierung", die es offline nie gab, und daneben steht ein Wiederholen-Knopf, der ohne
    // Netz nichts bewirken kann. Beides sitzt in `components/start/StartKarten.tsx:133-153` und
    // damit außerhalb der Zielpfade dieses Auftrags — s. „RESTSCHULD" in `start/forYou.ts`. Dieser
    // Fall hält den heutigen Stand fest, statt ihn zu beschönigen.
    expect(wiederholenDa()).toBe(true);
  });

  it("S-2 · Seite ab, offline, Seite neu am selben QueryClient → dasselbe Ergebnis", async () => {
    // DER SCHÄRFERE WEG (Codex' Korrekturpflicht 1 an JOB 3084 R1): der Baum läuft von vorn an,
    // der Hook wird neu abonniert, und der Onlinezustand muss aus dem KALTEN Start der Komponente
    // in die Karte finden — nicht aus einem Ereignis am stehenden Baum.
    box.kanal.signal = async () => [DUBLETTE];
    await mount();
    expect(veraltetMarke()).toBeNull();

    await netzTrennen();
    await neuBetreten();

    // KALIBRIERUNG: die Abfragen RUHEN wirklich (kein `paused`) — sonst misst der Fall den Weg,
    // den JOB 3084 schon abgedeckt hat, statt den Weg des Befunds R-1585.
    expect(qc.getQueryState(["duplicate-signal"])?.fetchStatus).toBe("idle");
    expect(qc.getQueryState(["duplicate-signal"])?.status).toBe("success");

    expect(zeilen()).toEqual([expect.stringContaining(DUBLETTEN_SATZ())]);
    expect(veraltetMarke()).toBe(i18n.t("loadstate.stale"));
  });

  it("S-3 · kalt offline, kein früherer Stand → keine Zeile, keine Zahl, die Störung", async () => {
    onlineManager.setOnline(false);
    await mount();

    expect(zeilen()).toEqual([]);
    expect(pille()).toBeNull();
    // Keine Verneinung aus dem Nichts: „Nichts offen." ist eine Aussage über den Bestand.
    expect(kartenText()).not.toContain(i18n.t("task.none"));
    // Eine Störung darf nicht wie Leere aussehen (REGELN §7).
    expect(wiederholenDa()).toBe(true);
  });

  it("S-10 · GEGENGEWICHT: eine wirklich gescheiterte Auffrischung bleibt, wie sie war", async () => {
    // Ohne diesen Fall wäre der ganze Auftrag mit „offline sagt die Karte nichts mehr" erfüllbar —
    // und mit ihm ginge die Zusage aus REGELN §7 verloren: bei einem gescheiterten Versuch bleiben
    // die Werte sichtbar, der Satz nennt den Fehlschlag, und der Knopf wirkt weiterhin.
    box.kanal.signal = async () => [DUBLETTE];
    await mount();

    await act(async () => {
      box.kanal.signal = scheitert;
      void qc.invalidateQueries({ queryKey: ["duplicate-signal"] });
      await flush();
    });

    expect(zeilen()).toEqual([expect.stringContaining(DUBLETTEN_SATZ())]);
    expect(veraltetMarke()).toBe(i18n.t("loadstate.stale"));
    expect(wiederholenDa()).toBe(true);
    expect(kartenText()).not.toContain(i18n.t("task.none"));
  });
});

describe("JOB 3098 · die Karte kennt die Quellen, aus denen ihre Zeilen stammen", () => {
  it("S-4 · alle Quellen frisch, nur `ko.list` lädt → Karte leer, keine Pille, kein „lädt“-Text", async () => {
    box.kanal.signal = async () => [DUBLETTE];
    box.kanal.kos = haengt;
    await mount();

    expect(zeilen()).toEqual([]);
    expect(pille()).toBeNull();
    expect(kartenText()).toBe("");
    expect(wiederholenDa()).toBe(false);
  });

  it("S-5 · alle Quellen frisch, nur `duplicate-signal` scheitert → Karte leer, Störung sichtbar", async () => {
    box.kanal.signal = scheitert;
    await mount();

    expect(zeilen()).toEqual([]);
    expect(pille()).toBeNull();
    expect(kartenText()).not.toContain(i18n.t("task.none"));
    expect(wiederholenDa()).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// S-7/S-8 · DER WEG AUS DER STÖRUNG HERAUS (Bens Korrekturpflicht 1)
// ------------------------------------------------------------------------------------------------
//
// S-4/S-5 messen, dass die zwei neuen Quellen die Karte in eine Störung bringen KÖNNEN. Was Runde 1
// nicht gemessen hat: ob der Knopf, den die Karte daraufhin anbietet, sie auch wieder herausbringt.
// Er tat es nicht — `wiederholen()` refetchte fünf andere Quellen. Ben, wörtlich: „Nach behobenem
// Serverfehler erzeugt der Klick jeweils null Abrufe der betroffenen Quelle."
//
// GEMESSEN WIRD AN DER WIRKUNG, NICHT AM QUELLTEXT: der echte Knopf wird geklickt, die Antwort des
// Servers ist inzwischen gesund, und danach muss die Kollisionszeile dastehen. Eine Zusicherung
// über die Zeile `for (const quelle of arbeitsQuellen)` wäre eine Quelltextkopie, keine Messung.
describe("JOB 3098 · Wiederholen erreicht JEDE Quelle, die die Störung ausgelöst hat", () => {
  for (const fall of [
    { name: "duplicate-signal", kanal: "signal" as const },
    { name: "ko.list", kanal: "kos" as const },
  ]) {
    it(`S-7/8 · Erstfehler in \`${fall.name}\` → Server gesund → Klick → der Befund steht`, async () => {
      let abrufe = 0;
      const gesund: Record<"signal" | "kos", () => Promise<unknown>> = {
        signal: async () => [DUBLETTE],
        kos: leerAntwort,
      };
      box.kanal.signal = gesund.signal;
      box.kanal.kos = gesund.kos;
      box.kanal[fall.kanal] = async () => {
        abrufe += 1;
        throw new Error(`${fall.name} kaputt`);
      };

      await mount();
      expect(abrufe, "die Quelle wurde beim Aufbau überhaupt gefragt").toBe(1);
      expect(zeilen()).toEqual([]);
      expect(wiederholenDa()).toBe(true);

      // Der Server ist wieder gesund — allein davon ändert sich nichts (react-query holt von sich
      // aus nichts nach). Erst der Klick darf es richten.
      box.kanal[fall.kanal] = () => {
        abrufe += 1;
        return gesund[fall.kanal]();
      };
      await wiederholenKlicken();

      expect(abrufe, "der Klick hat diese Quelle gar nicht erreicht").toBe(2);
      expect(zeilen()).toEqual([expect.stringContaining(DUBLETTEN_SATZ())]);
      expect(pille()).toBe("1");
      expect(veraltetMarke()).toBeNull();
      expect(wiederholenDa()).toBe(false);
    });
  }
});
