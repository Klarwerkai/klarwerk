// @vitest-environment jsdom
// ================================================================================================
// aufnahme:20260922:gesamt-sprachfeedback · R-1649 — STIMM-ERKANNTES „NICHT HILFREICH" AUF DER
// ECHTEN FRAGENSEITE.
// ================================================================================================
//
// Die echte `Ask`-Seite; gemockt sind nur die Endpunkte und die Browser-Spracherkennung (dasselbe
// Rekorder-Doppel wie `tests/diktat-fragefeld/mikrofon-im-fragefeld.test.tsx`). Der Server-Teil
// steht in `nicht-hilfreich-route.test.ts`.
//
//   S1  Nach einer Antwort gesprochen: kein neuer Modelllauf, sondern die Bestätigung mit dem
//       erkannten Weg; bestätigt geht genau EINE Rückmeldung an die tragende Quelle samt Entwurf.
//   S2  „Doch als Frage stellen" stellt den Text als Frage — die Erkennung bevormundet nicht.
//   S3  Rolle ohne Entwurfsrecht: der Weg wird nicht still verworfen, die Fläche sagt es.
//   S4  Ohne stehende Antwort ist derselbe Satz eine gewöhnliche Frage.
//
// WAS HIER NICHT GEMESSEN WIRD: die echte Spracherkennung des Browsers (Mikrofon, Modell, Netz).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const zustand = vi.hoisted(() => ({ rolle: "experte" }));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: zustand.rolle }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: {
      list: vi.fn(async () => [
        {
          id: "ko-1",
          title: "Dichtungswechsel L4",
          statement: "Dichtung nach 500 h tauschen.",
          conditions: [],
          measures: [],
          type: "best_practice",
          category: "Instandhaltung",
          tags: [],
          confidence: 80,
          trust: 90,
          status: "validiert",
          version: 1,
          originalAuthor: "u9",
          author: "u9",
          neededValidations: 2,
          assignments: [],
          asset: null,
          createdAt: "2026-01-01T00:00:00.000Z",
          history: [],
        },
      ]),
    },
    conflicts: { list: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
    gaps: { list: vi.fn(async () => []) },
    reasoner: {
      status: vi.fn(async () => ({
        active: true,
        mode: "cloud",
        reachable: "active",
        tasks: { answer: true },
      })),
    },
    ask: {
      ask: vi.fn(async () => ({
        result: {
          answered: true,
          answer: "Dichtung nach 500 h tauschen [1].",
          knowledgeClass: "gesichert",
          trust: 90,
          sources: ["ko-1"],
          citedSources: ["ko-1"],
          steps: [],
          demo: false,
        },
        gap: null,
        receipt: "beleg-1",
      })),
      helpful: vi.fn(async () => ({})),
      notHelpful: vi.fn(async (body: { alternative?: string }) => ({
        vermerkt: true,
        entwurfId: body.alternative ? "entwurf-1" : null,
      })),
    },
  },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => undefined;

const askMock = endpoints.ask.ask as unknown as ReturnType<typeof vi.fn>;
const meldeMock = endpoints.ask.notHelpful as unknown as ReturnType<typeof vi.fn>;

const FRAGE = "Wann tausche ich die Dichtung an L4?";
const GESPROCHEN =
  "Das war nicht hilfreich, ich habe es so gemacht: Dichtung schon nach 300 h tauschen";
const WEG = "Dichtung schon nach 300 h tauschen";
const KARTE = '[data-testid="ask-nicht-hilfreich"]';

interface ErgebnisEreignis {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

/** Das Rekorder-Doppel — es spricht nur, wenn der Test es heißt. */
class RekorderDoppel {
  static letzter: RekorderDoppel | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: ((e: ErgebnisEreignis) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor() {
    RekorderDoppel.letzter = this;
  }
  start(): void {}
  stop(): void {
    this.onend?.();
  }
  spricht(text: string): void {
    this.onresult?.({ resultIndex: 0, results: [[{ transcript: text }]] });
  }
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

let abbauen: (() => void) | null = null;

async function oeffnen(): Promise<HTMLElement> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(["auth", "me"], { id: "u1", role: zustand.rolle });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          MemoryRouter,
          { initialEntries: ["/fragen"] },
          createElement(ToastProvider, null, createElement(Ask)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  abbauen = () => {
    act(() => root.unmount());
    container.remove();
  };
  return container;
}

function feld(c: HTMLElement): HTMLInputElement {
  const el = c.querySelector<HTMLInputElement>("input");
  expect(el, "Eingabefeld nicht gefunden").toBeTruthy();
  return el as HTMLInputElement;
}

async function tippen(c: HTMLElement, text: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setzer.call(feld(c), text);
    feld(c).dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function absenden(c: HTMLElement): Promise<void> {
  await act(async () => {
    c.querySelector("form")?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
  });
}

/** Spricht über das echte Diktat ins Fragefeld: Mikrofon an, Satz, Mikrofon aus. */
async function sprechen(c: HTMLElement, text: string): Promise<void> {
  const mikro = (label: string) =>
    Array.from(c.querySelectorAll("button")).find((b) => b.getAttribute("aria-label") === label);
  await act(async () => {
    mikro(i18n.t("ask.diktatStart"))?.click();
    await flush();
  });
  expect(RekorderDoppel.letzter, "Aufnahme nicht gestartet").toBeTruthy();
  await act(async () => {
    RekorderDoppel.letzter?.spricht(text);
    await flush();
  });
  await act(async () => {
    mikro(i18n.t("ask.diktatStop"))?.click();
    await flush();
  });
}

async function klicke(c: HTMLElement, testId: string): Promise<void> {
  const knopf = c.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  expect(knopf, `${testId} fehlt`).toBeTruthy();
  await act(async () => {
    knopf?.click();
    await flush();
  });
}

beforeEach(async () => {
  zustand.rolle = "experte";
  RekorderDoppel.letzter = null;
  (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = RekorderDoppel;
  window.localStorage.clear();
  await i18n.changeLanguage("de");
});

afterEach(() => {
  abbauen?.();
  abbauen = null;
  (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition = undefined;
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("R-1649 · stimm-erkanntes „nicht hilfreich“ auf /fragen", () => {
  it("S1 · gesprochen nach einer Antwort: Bestätigung, dann EINE Rückmeldung samt Entwurf", async () => {
    const c = await oeffnen();
    await tippen(c, FRAGE);
    await absenden(c);
    expect(askMock).toHaveBeenCalledTimes(1);

    // Das Diktat hängt an die stehende Frage an — so steht es im echten Gebrauch im Feld.
    await sprechen(c, GESPROCHEN);
    expect(feld(c).value).toBe(`${FRAGE} ${GESPROCHEN}`);
    await absenden(c);

    // Kein zweiter Modelllauf — der Satz ist eine Rückmeldung, keine Frage.
    expect(askMock).toHaveBeenCalledTimes(1);
    const karte = c.querySelector<HTMLElement>(KARTE);
    expect(karte, "keine Bestätigung nach dem gesprochenen Satz").toBeTruthy();
    expect(karte?.textContent).toContain("Dichtungswechsel L4");
    const weg = c.querySelector<HTMLTextAreaElement>('[data-testid="ask-nicht-hilfreich-weg"]');
    expect(weg?.value).toBe(WEG);
    // Vor der Bestätigung ist nichts gespeichert.
    expect(meldeMock).not.toHaveBeenCalled();

    await klicke(c, "ask-nicht-hilfreich-bestaetigen");
    expect(meldeMock).toHaveBeenCalledTimes(1);
    expect(meldeMock).toHaveBeenCalledWith({
      koId: "ko-1",
      receipt: "beleg-1",
      alternative: WEG,
      entwurfTitel: i18n.t("sprachfeedback.entwurfTitel", { titel: "Dichtungswechsel L4" }),
    });
    expect(c.querySelector(KARTE)).toBeNull();
    const erledigt = c.querySelector<HTMLElement>('[data-testid="ask-nicht-hilfreich-erledigt"]');
    expect(erledigt?.textContent).toContain(i18n.t("sprachfeedback.erledigtMitEntwurf"));
    const link = c.querySelector('[data-testid="ask-nicht-hilfreich-entwurf"]');
    expect(link?.getAttribute("href")).toBe("/erfassen?draft=entwurf-1");
    expect(feld(c).value).toBe("");
  });

  it("S2 · „Doch als Frage stellen“ stellt den Satz als Frage, ohne Rückmeldung", async () => {
    const c = await oeffnen();
    await tippen(c, FRAGE);
    await absenden(c);
    await sprechen(c, GESPROCHEN);
    await absenden(c);
    await klicke(c, "ask-nicht-hilfreich-als-frage");
    expect(askMock).toHaveBeenCalledTimes(2);
    expect(askMock.mock.calls[1]?.[0]).toBe(`${FRAGE} ${GESPROCHEN}`);
    expect(meldeMock).not.toHaveBeenCalled();
    expect(c.querySelector(KARTE)).toBeNull();
  });

  it("S3 · Leser: kein Entwurfsfeld, der Grund steht da, gemeldet wird nur der Vermerk", async () => {
    zustand.rolle = "viewer";
    const c = await oeffnen();
    await tippen(c, FRAGE);
    await absenden(c);
    await sprechen(c, GESPROCHEN);
    await absenden(c);
    expect(c.querySelector('[data-testid="ask-nicht-hilfreich-weg"]')).toBeNull();
    const grund = c.querySelector('[data-testid="ask-nicht-hilfreich-kein-entwurf"]');
    expect(grund?.textContent).toBe(i18n.t("sprachfeedback.keinEntwurfRecht"));
    await klicke(c, "ask-nicht-hilfreich-bestaetigen");
    expect(meldeMock).toHaveBeenCalledWith({ koId: "ko-1", receipt: "beleg-1" });
    const erledigt = c.querySelector('[data-testid="ask-nicht-hilfreich-erledigt"]');
    expect(erledigt?.textContent).toContain(i18n.t("sprachfeedback.erledigt"));
  });

  it("S4 · ohne stehende Antwort ist derselbe Satz eine gewöhnliche Frage", async () => {
    const c = await oeffnen();
    await sprechen(c, GESPROCHEN);
    await absenden(c);
    expect(askMock).toHaveBeenCalledTimes(1);
    expect(askMock.mock.calls[0]?.[0]).toBe(GESPROCHEN);
    expect(c.querySelector(KARTE)).toBeNull();
  });
});
