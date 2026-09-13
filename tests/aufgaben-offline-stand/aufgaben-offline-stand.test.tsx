// @vitest-environment jsdom
// ================================================================================================
// JOB 3808 · O1–O5 — OHNE NETZ SAGT `/aufgaben` NICHT MEHR NUR „NICHTS OFFEN.".
// ================================================================================================
//
// DER MANGEL, den diese Datei zuerst rot gezeigt und dann festgehalten hat: Ein Mensch öffnet
// `/aufgaben`, verliert die Netzverbindung — und liest weiter den nackten Satz „Nichts offen.".
// Das ist eine Tatsachenaussage über JETZT, die aus einem Zwischenspeicher von vorhin stammt und
// gerade nicht nachprüfbar ist. `isGroupStale()` kennt nur `isError`; ohne Netz gibt es keinen
// gescheiterten Versuch, den man melden könnte — die Abfrage RUHT (`fetchStatus: "paused"`).
//
// Der Satz, der jetzt darüber steht, ist KEIN neuer: es sind die zwei vorhandenen Sätze der
// Startseite (`components/start/forYou.ts:216-229`), `kollision.lage.pausiert` mit sichtbarem Stand
// und `kollision.lage.pausiertOhneStand` ohne. Derselbe Mensch liest in derselben Lage denselben
// Satz — keine zweite Sprache für dieselbe Sache.
//
// ------------------------------------------------------------------------------------------------
// WARUM GEGEN `endpoints` UND NICHT GEGEN `api/hooks` GEMOCKT WIRD
// ------------------------------------------------------------------------------------------------
// Dieselbe Hausform wie `tests/demo-leerbestand/aufgaben-leerbestand.test.tsx` seit JOB 3762 R2
// (Codex' Prüfpunkt 3): ein gemockter Hook kennt weder `fetchStatus` noch einen Refetch — die
// Übergänge „geladen → Netz fort → gelesen" wären damit gar nicht darstellbar, und die Kette
// begänne hinter dem Ladevertrag statt an der Drahtantwort. Hier steht nur der Wire; echte Hooks,
// echter `QueryClient`, echter `onlineManager`, echte Lagen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Eine anliegende Validierungsaufgabe — so vollständig, wie die Zeile sie liest. */
const AUFGABE = {
  id: "ko-1",
  title: "Ventil V1 prüfen",
  status: "offen",
  author: "u1",
  originalAuthor: "u1",
};

const box = vi.hoisted(() => ({
  /** `GET /api/validation/board` — entscheidet, ob Zeilen dastehen (Stand sichtbar) oder nicht. */
  board: (async () => []) as () => Promise<unknown>,
  /** `GET /api/conflicts` — O3/O4 lassen sie scheitern. */
  conflicts: (async () => []) as () => Promise<unknown>,
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    endpoints: {
      validation: {
        board: vi.fn(() => box.board()),
        settings: ok({ defaultNeededValidations: 3 }),
      },
      conflicts: { list: vi.fn(() => box.conflicts()) },
      lifecycle: { pending: ok([]) },
      gaps: { list: ok([]), summary: ok({ open: 0, byPriority: {} }) },
      audit: { list: ok([]) },
      ko: { list: ok([]) },
      directory: { list: ok([{ id: "u1", name: "Pia", email: "p@x.de", role: "editor" }]) },
    },
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte", stufe2: false }),
}));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { MyTasks } from "../../apps/web/src/pages/MyTasks";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

async function mount(adresse = "/aufgaben"): Promise<QueryClient> {
  container = document.createElement("div");
  document.body.appendChild(container);
  const neu = createRoot(container);
  root = neu;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    neu.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(MemoryRouter, { initialEntries: [adresse] }, createElement(MyTasks)),
      ),
    );
    await flush();
  });
  await act(flush);
  return qc;
}

function abbauen(): void {
  act(() => root?.unmount());
  container.remove();
  root = null;
}

const text = (): string => (container.textContent ?? "").replace(/\s+/g, " ");
const zeilen = (): number => container.querySelectorAll('[data-testid="task-zeile"]').length;
/** Die Markierung des RUHENDEN Abrufs (JOB 3808). */
const ruhtHinweis = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="task-stand-pausiert"]');
/** Die Markierung des GESCHEITERTEN Nachlaufs (JOB 3762) — die andere, ältere Lage. */
const standHinweis = (): HTMLElement | null =>
  container.querySelector<HTMLElement>('[data-testid="task-stand-veraltet"]');
/** Wie viele Datenlage-Markierungen stehen insgesamt da? Die Zusage lautet: höchstens eine. */
const markierungen = (): number =>
  container.querySelectorAll(
    '[data-testid="task-stand-pausiert"],[data-testid="task-stand-veraltet"]',
  ).length;
const satzVon = (el: HTMLElement | null): string => (el?.textContent ?? "").trim();

/**
 * Das Netz fällt aus — und zwar so, wie es im Browser ausfällt: der `onlineManager` meldet es (die
 * EINE Quelle, aus der `lib/netzzustand.ts` liest und aus der react-query sein `paused` ableitet),
 * und die anliegenden Abrufe werden dadurch angehalten statt zu scheitern.
 */
async function netzFort(qc: QueryClient): Promise<void> {
  await act(async () => {
    onlineManager.setOnline(false);
    void qc.invalidateQueries();
    await flush();
  });
  await act(flush);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  box.board = async () => [];
  box.conflicts = async () => [];
});

afterEach(() => {
  onlineManager.setOnline(true);
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
});

describe("JOB 3808 · `/aufgaben` ohne Netz — der Stand wird eingeordnet, nicht behauptet", () => {
  it("VORBEDINGUNG: die Oberfläche läuft auf Deutsch", () => {
    expect(i18n.language).toBe("de");
  });

  // ----------------------------------------------------------------------------------------------
  // O1 — STAND SICHTBAR, NETZ FORT.
  // ----------------------------------------------------------------------------------------------
  it("O1 · geladene Zeilen, dann offline ⇒ „Stand von zuletzt“ darüber, die Zeilen bleiben", async () => {
    box.board = async () => [AUFGABE];
    const qc = await mount();
    expect(zeilen(), "Vorbedingung: es steht wirklich ein Stand da").toBe(1);
    expect(text()).toContain("Ventil V1 prüfen");
    expect(markierungen(), "Vorbedingung: mit Netz steht nichts darüber").toBe(0);

    await netzFort(qc);

    // KALIBRIERUNG: der Abruf RUHT wirklich, er ist nicht gescheitert.
    expect(qc.getQueryState(["conflicts"])?.fetchStatus).toBe("paused");
    expect(qc.getQueryState(["conflicts"])?.status).not.toBe("error");

    expect(ruhtHinweis(), "ohne sie stünde die Liste unmarkiert da").not.toBeNull();
    expect(satzVon(ruhtHinweis())).toBe(i18n.t("kollision.lage.pausiert"));
    expect(markierungen(), "genau EINE Markierung").toBe(1);
    // REGELN §7, erster Satz: die zuletzt geholten Werte bleiben SICHTBAR.
    expect(zeilen()).toBe(1);
    expect(text()).toContain("Ventil V1 prüfen");
    // Ehrlichkeit vor Optik: ein Wiederholen, das ohne Netz nichts bewirken kann, wird nicht
    // angeboten (`forYou.ts:232-239`).
    expect(ruhtHinweis()?.querySelectorAll("button").length).toBe(0);
    expect(text()).not.toContain(i18n.t("loadstate.error.retry"));
  });

  // ----------------------------------------------------------------------------------------------
  // O2 — KEIN STAND, NETZ FORT. Der eigentliche Fall dieses Auftrags.
  // ----------------------------------------------------------------------------------------------
  // Die Verneinung „Nichts offen." bleibt Zeichen für Zeichen an ihrer Stelle — sie wird nicht
  // ersetzt und nicht versteckt (REGELN §7: nichts leeren). Darüber steht, dass sie gerade nicht
  // nachprüfbar ist, und zwar mit dem Satz OHNE Stand: es sind keine Zeilen zu sehen, auf die sich
  // ein „Stand von zuletzt" beziehen könnte (`forYou.ts:212-215`).
  it("O2 · leer bestätigt, dann offline ⇒ „Nichts offen.“ bleibt, aber markiert", async () => {
    const qc = await mount();
    expect(text(), "Vorbedingung: der Stand ist bestätigt leer").toContain(i18n.t("task.none"));
    expect(markierungen(), "Vorbedingung").toBe(0);

    await netzFort(qc);

    expect(qc.getQueryState(["conflicts"])?.fetchStatus).toBe("paused");
    expect(ruhtHinweis(), "die nackte Verneinung war der Mangel").not.toBeNull();
    expect(satzVon(ruhtHinweis())).toBe(i18n.t("kollision.lage.pausiertOhneStand"));
    expect(markierungen()).toBe(1);
    expect(text(), "der Leersatz bleibt, er wird nur eingeordnet").toContain(i18n.t("task.none"));
    // Und der Weg dahinter bleibt unverändert derselbe Knopf.
    expect(container.querySelector('[data-testid="task-wie-weiter"]')).not.toBeNull();
    expect(ruhtHinweis()?.querySelectorAll("button").length).toBe(0);
  });

  // ----------------------------------------------------------------------------------------------
  // O3 — GENAU EINE MARKIERUNG, und es ist die stärkere.
  // ----------------------------------------------------------------------------------------------
  // Offline UND ein zuvor gescheiterter Nachlauf treffen zusammen: `isGroupStale()` ist wahr, der
  // `StaleMarker` wäre also fällig. Er darf trotzdem nicht dastehen — „Auffrischung fehlgeschlagen"
  // meldet einen Versuch, den es ohne Netz gar nicht gibt (die Lehre aus JOB 3118). Der
  // Offline-Satz sagt, WARUM gerade nichts geht, und ist damit die stärkere Auskunft
  // (`forYou.ts:220-224`).
  it("O3 · offline UND gescheiterter Nachlauf ⇒ NUR der Offline-Satz", async () => {
    box.board = async () => [AUFGABE];
    const qc = await mount();

    // Erst der gescheiterte Nachlauf, mit Netz — das ist der heutige, unveränderte Fall.
    box.conflicts = async () => {
      throw new Error("500");
    };
    await act(async () => {
      void qc.invalidateQueries({ queryKey: ["conflicts"] });
      await flush();
    });
    await act(flush);
    expect(qc.getQueryState(["conflicts"])?.status, "Kalibrierung").toBe("error");
    expect(standHinweis(), "Vorbedingung: mit Netz steht hier der Stale-Hinweis").not.toBeNull();
    expect(text()).toContain(i18n.t("loadstate.stale"));

    // Und jetzt fällt zusätzlich das Netz aus.
    await netzFort(qc);

    expect(qc.getQueryState(["conflicts"])?.status, "der Fehler steht weiter im Speicher").toBe(
      "error",
    );
    expect(ruhtHinweis()).not.toBeNull();
    expect(satzVon(ruhtHinweis())).toBe(i18n.t("kollision.lage.pausiert"));
    expect(standHinweis(), "zwei Sätze über dieselbe Sache wären einer zu viel").toBeNull();
    expect(text(), "„Auffrischung fehlgeschlagen“ ist offline die falsche Auskunft").not.toContain(
      i18n.t("loadstate.stale"),
    );
    expect(markierungen()).toBe(1);
  });

  // ----------------------------------------------------------------------------------------------
  // O4 — MIT NETZ ÄNDERT SICH NICHTS.
  // ----------------------------------------------------------------------------------------------
  it("O4 · online mit gescheitertem Nachlauf ⇒ der vorhandene StaleMarker samt Wiederholen-Knopf", async () => {
    box.board = async () => [AUFGABE];
    const qc = await mount();
    box.conflicts = async () => {
      throw new Error("500");
    };
    await act(async () => {
      void qc.invalidateQueries({ queryKey: ["conflicts"] });
      await flush();
    });
    await act(flush);

    expect(qc.getQueryState(["conflicts"])?.status).toBe("error");
    expect(standHinweis()).not.toBeNull();
    expect(ruhtHinweis(), "mit Netz ruht nichts").toBeNull();
    expect(markierungen()).toBe(1);
    expect(text()).toContain(i18n.t("loadstate.stale"));
    // Hier IST ein Versuch sinnvoll — der Knopf bleibt, wo er war.
    expect(standHinweis()?.querySelectorAll("button").length).toBe(1);
    expect(text()).toContain(i18n.t("loadstate.error.retry"));
  });

  // ----------------------------------------------------------------------------------------------
  // O5 — DE/EN/NL gegen die VORHANDENEN Schlüssel.
  // ----------------------------------------------------------------------------------------------
  // Kein Rohschlüssel im Text und kein neuer Eintrag in `i18n.ts`: die zwei Sätze liegen seit
  // JOB 3118 in allen drei Sprachen vor, weil die Startseite sie schon führt.
  it("O5 · O1 und O2 in allen drei Sprachen, ohne neuen Wortlaut", async () => {
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      const mitStand = i18n.t("kollision.lage.pausiert");
      const ohneStand = i18n.t("kollision.lage.pausiertOhneStand");
      expect(mitStand, `Schlüssel fehlt in ${sprache}`).not.toBe("kollision.lage.pausiert");
      expect(ohneStand, `Schlüssel fehlt in ${sprache}`).not.toBe(
        "kollision.lage.pausiertOhneStand",
      );

      // O1 in dieser Sprache: mit Zeilen.
      box.board = async () => [AUFGABE];
      const mitZeilen = await mount();
      await netzFort(mitZeilen);
      expect(satzVon(ruhtHinweis()), `O1/${sprache}`).toBe(mitStand);
      expect(zeilen(), `O1/${sprache}: die Zeile bleibt`).toBe(1);
      abbauen();
      // Das Netz kommt zurück, BEVOR der zweite Fall lädt: sonst begänne er kalt offline, die
      // Quellen blieben ohne Daten und die Fläche stünde in `state.loading` statt im bestätigten
      // Leerstand — ein anderer Fall als der gemessene (gemessen: „expected … to contain 'Nichts
      // offen.'", erhalten „Lädt …").
      onlineManager.setOnline(true);

      // O2 in dieser Sprache: ohne Zeilen.
      box.board = async () => [];
      const ohneZeilen = await mount();
      await netzFort(ohneZeilen);
      expect(satzVon(ruhtHinweis()), `O2/${sprache}`).toBe(ohneStand);
      expect(text(), `O2/${sprache}: der Leersatz bleibt`).toContain(i18n.t("task.none"));
      abbauen();
      onlineManager.setOnline(true);
    }
  });
});
