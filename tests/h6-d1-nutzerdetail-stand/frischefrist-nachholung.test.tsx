// @vitest-environment jsdom
// JOB 3180: echter NutzerDetail-/QueryClient-Weg mit produktiver Frischefrist.
// Nur Date ist virtuell: Abfrage- und React-Benachrichtigungen laufen normal. Gewartet wird
// auf Cache/DOM-Zustände; die lange Unterbrechung kostet keine echte Wartezeit.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { users: { list: vi.fn() } },
}));
vi.mock("../../apps/web/src/app/ToastContext", () => ({
  useToast: () => ({ push: () => {} }),
}));

import {
  QueryClient,
  QueryClientProvider,
  onlineManager,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { StrictMode, act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { endpoints } from "../../apps/web/src/api/endpoints";
import type { PublicUser } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { ZAEHLER_FRISCHE_MS } from "../../apps/web/src/lib/loadingState";
import { NutzerDetail } from "../../apps/web/src/pages/AdminKontenDetails";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NUTZER: PublicUser = {
  id: "u1",
  name: "Ada Admin",
  email: "ada@example.org",
  role: "admin",
  approved: true,
  createdAt: "2026-09-01T08:00:00.000Z",
};
const START = new Date("2026-09-07T08:00:00Z").getTime();
const liste = vi.mocked(endpoints.users.list);
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

async function bis(pruefen: () => void): Promise<void> {
  await vi.waitFor(async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    pruefen();
  });
}

function zeile(): HTMLElement | null {
  return container.querySelector('[data-einst="stand"]');
}

function knopf(): HTMLButtonElement {
  const el = zeile()?.querySelector("button");
  expect(el, "Wiederholen fehlt trotz nicht nachgeholtem Abruf").toBeInstanceOf(HTMLButtonElement);
  return el as HTMLButtonElement;
}

function stand(zeit: number): string {
  return new Date(zeit).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function markiert(zeit = START): void {
  const sprache = i18n.language;
  expect(zeile()?.querySelector("span")?.textContent).toBe(
    sprache === "en"
      ? `as of ${stand(zeit)} · not refreshed`
      : `Stand von ${stand(zeit)} · nicht aktualisiert`,
  );
  expect(knopf().textContent).toBe(sprache === "en" ? "Try again" : "Erneut versuchen");
  expect(knopf().disabled).toBe(false);
  expect(container.textContent).toContain(NUTZER.email);
  expect(container.querySelector("select")?.value).toBe("admin");
  expect(container.querySelector('[data-einst="abfrage-fehler"]')).toBeNull();
}

async function online(wert: boolean): Promise<void> {
  await act(async () => onlineManager.setOnline(wert));
}

async function sprache(wert: string): Promise<void> {
  await act(async () => {
    await i18n.changeLanguage(wert);
  });
}

async function kurzeUnterbrechung(): Promise<void> {
  await online(false);
  markiert();
  vi.setSystemTime(START + ZAEHLER_FRISCHE_MS / 2);
  await online(true);
  await bis(() => {
    expect(qc.isFetching()).toBe(0);
    expect(liste).toHaveBeenCalledTimes(1);
    markiert();
  });
}

function antwortOffen(): {
  resolve: (daten: PublicUser[]) => void;
  reject: (fehler: Error) => void;
} {
  let resolve!: (daten: PublicUser[]) => void;
  let reject!: (fehler: Error) => void;
  liste.mockReturnValueOnce(
    new Promise<PublicUser[]>((ok, nein) => {
      resolve = ok;
      reject = nein;
    }),
  );
  return { resolve, reject };
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(START);
  await i18n.changeLanguage("de");
  onlineManager.setOnline(true);
  liste.mockReset().mockResolvedValue([NUTZER]);
  qc = new QueryClient({
    defaultOptions: { queries: { staleTime: ZAEHLER_FRISCHE_MS, retry: false } },
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        StrictMode,
        null,
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(NutzerDetail, { nutzerId: NUTZER.id, onZurueck: () => {} }),
        ),
      ),
    );
  });
  await bis(() => {
    expect(container.querySelector("select")?.value).toBe("admin");
    expect(qc.getQueryState(["users"])?.dataUpdatedAt).toBe(START);
    expect(liste).toHaveBeenCalledTimes(1);
    expect(zeile()).toBeNull();
  });
});

afterEach(async () => {
  act(() => root.unmount());
  qc.clear();
  container.remove();
  onlineManager.setOnline(true);
  vi.useRealTimers();
  await i18n.changeLanguage("de");
});

describe("JOB 3180 · Nachholung an der produktiven Frischefrist", () => {
  it.each(["de", "en"])(
    "F1 · %s: kurze Unterbrechung lässt Stand und Wiederholen online sichtbar",
    async (lang) => {
      await sprache(lang);
      await kurzeUnterbrechung();
    },
  );

  it.each(["de", "en"])(
    "F2 · %s: erst die erfolgreiche manuelle Antwort beendet die Warnung",
    async (lang) => {
      await sprache(lang);
      await kurzeUnterbrechung();
      const antwort = antwortOffen();
      await act(async () => knopf().click());
      await bis(() => expect(liste).toHaveBeenCalledTimes(2));
      markiert();
      expect(qc.isFetching()).toBe(1);
      const neuerStand = START + ZAEHLER_FRISCHE_MS * 4;
      vi.setSystemTime(neuerStand);
      await act(async () => antwort.resolve([{ ...NUTZER, email: "neu@example.org" }]));
      await bis(() => {
        expect(container.textContent).toContain("neu@example.org");
        expect(qc.getQueryState(["users"])?.dataUpdatedAt).toBeGreaterThan(START);
        expect(zeile()).toBeNull();
      });
      // Eine zweite Störung muss den NEUEN Stand merken, keine klebende alte Episode.
      await online(false);
      expect(zeile()?.textContent).toContain(stand(neuerStand));
      await online(true);
      expect(zeile()?.textContent).toContain(
        lang === "en" ? "not refreshed" : "nicht aktualisiert",
      );
      expect(liste).toHaveBeenCalledTimes(2);
    },
  );

  it.each(["de", "en"])(
    "F3 · %s: gescheiterter Klick bleibt markiert, weiterer Versuch gelingt",
    async (lang) => {
      await sprache(lang);
      await kurzeUnterbrechung();
      const antwort = antwortOffen();
      await act(async () => knopf().click());
      await bis(() => expect(liste).toHaveBeenCalledTimes(2));
      markiert();
      await act(async () => antwort.reject(new Error("Netzfehler")));
      await bis(() => {
        expect(qc.getQueryState(["users"])?.status).toBe("error");
        markiert();
      });
      expect(qc.getQueryState(["users"])?.dataUpdatedAt).toBe(START);
      await act(async () => knopf().click());
      await bis(() => {
        expect(liste).toHaveBeenCalledTimes(3);
        expect(zeile()).toBeNull();
      });
    },
  );

  it("F4 · lange Unterbrechung: automatischer Abruf bleibt bis zur Antwort markiert", async () => {
    await online(false);
    markiert();
    vi.setSystemTime(START + ZAEHLER_FRISCHE_MS + 1);
    const antwort = antwortOffen();
    await online(true);
    await bis(() => expect(liste).toHaveBeenCalledTimes(2));
    markiert();
    await act(async () => antwort.resolve([NUTZER]));
    await bis(() => {
      expect(qc.getQueryState(["users"])?.dataUpdatedAt).toBeGreaterThan(START);
      expect(qc.isFetching()).toBe(0);
      expect(zeile()).toBeNull();
    });
  });

  it("F5 · echter Sprachwechsel DE → EN → DE erhält denselben offenen Abrufzustand", async () => {
    await kurzeUnterbrechung();
    await sprache("en");
    markiert();
    await sprache("de");
    markiert();
    expect(liste).toHaveBeenCalledTimes(1);
  });

  it.each(["de", "en"])(
    "F6-Teilbeleg · %s: nativer Knopf fokussierbar, Fokus bleibt bei fehlgeschlagenem Klick",
    async (lang) => {
      // jsdom hat keine native Tab-Navigation/Enter-Aktivierung. Kein selbstgebauter
      // Tabulator oder keydown+click als angeblicher Tastaturbeleg: hier nur DOM-Fokus.
      // Den globalen Ringvertrag prüft der bestehende focus-visible-global-contract-Test.
      await sprache(lang);
      await kurzeUnterbrechung();
      const retry = knopf();
      expect(retry.tabIndex).toBe(0);
      retry.focus();
      expect(document.activeElement).toBe(retry);
      const antwort = antwortOffen();
      await act(async () => retry.click());
      await bis(() => expect(liste).toHaveBeenCalledTimes(2));
      expect(document.activeElement).toBe(retry);
      await act(async () => antwort.reject(new Error("Netzfehler")));
      await bis(() => {
        expect(qc.getQueryState(["users"])?.status).toBe("error");
        markiert();
        expect(document.activeElement).toBe(retry);
      });
    },
  );
});
