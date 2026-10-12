// @vitest-environment jsdom
// ================================================================================================
// R-0348 — DER GESPRÄCHSFADEN AUF DER ECHTEN FRAGENSEITE.
// ================================================================================================
//
// Die echte `Ask`-Seite; gemockt sind nur die Endpunkte, und genau darüber wird gemessen, was eine
// Nachfrage mitschickt. Der Server-Teil (was der Faden bewirkt) steht in `nachfrage-im-faden.test.ts`.
//
//   M1  Die erste Frage geht ohne Faden hinaus — genau der bisherige Aufruf.
//   M2  Die Nachfrage trägt die vorige Frage als Faden; die Fläche zeigt, woran sie anknüpft.
//   M3  „Neues Thema beginnen" leert den Faden — die nächste Frage fängt bewusst neu an.
//   M4  Dieselbe Frage erneut ist eine Auffrischung, keine Nachfrage auf sich selbst.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: {
      list: vi.fn(async () => [
        {
          id: "ko-1",
          title: "Urlaubstage in Teilzeit",
          statement: "In Teilzeit werden die Urlaubstage anteilig berechnet.",
          conditions: [],
          measures: [],
          type: "regel",
          category: "Personal",
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
          answer: "In Teilzeit werden die Urlaubstage anteilig berechnet [1].",
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

const ERSTFRAGE = "Wie werden Urlaubstage berechnet?";
const NACHFRAGE = "Und in Teilzeit?";
const NEUES_THEMA = '[data-testid="ask-gespraechsfaden-neu"]';

const askMock = endpoints.ask.ask as unknown as ReturnType<typeof vi.fn>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

interface Flaeche {
  container: HTMLElement;
  abbauen: () => void;
}

let offen: Flaeche | null = null;

async function oeffnen(): Promise<Flaeche> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(["auth", "me"], { id: "u1", role: "experte" });
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
  offen = {
    container,
    abbauen: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
  return offen;
}

function feld(f: Flaeche): HTMLInputElement {
  const el = f.container.querySelector<HTMLInputElement>("input");
  expect(el, "Eingabefeld nicht gefunden").toBeTruthy();
  return el as HTMLInputElement;
}

async function fragen(f: Flaeche, text: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setzer.call(feld(f), text);
    feld(f).dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(async () => {
    f.container
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });
}

function faden(f: Flaeche): HTMLElement | null {
  return f.container.querySelector<HTMLElement>('[data-testid="ask-gespraechsfaden"]');
}

function fadenfragen(f: Flaeche): string[] {
  return [
    ...f.container.querySelectorAll<HTMLElement>('[data-testid="ask-gespraechsfaden-frage"]'),
  ].map((el) => el.textContent ?? "");
}

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("de");
});

afterEach(() => {
  offen?.abbauen();
  offen = null;
  vi.clearAllMocks();
});

describe("R-0348 · Gesprächsfaden auf der Fragenseite", () => {
  it("M1 · die erste Frage geht ohne Faden hinaus — danach lädt die Fläche zum Nachfragen ein", async () => {
    const f = await oeffnen();
    expect(faden(f)).toBeNull();
    await fragen(f, ERSTFRAGE);
    expect(askMock).toHaveBeenCalledTimes(1);
    expect(askMock.mock.calls[0]).toEqual([ERSTFRAGE, "de"]);
    expect(faden(f)?.textContent).toContain(i18n.t("fragenseite.fadenTitel"));
    // Die gestellte Frage steht in der Fragezeile — nicht ein zweites Mal im Faden.
    expect(fadenfragen(f)).toEqual([]);
  });

  it("M2 · die Nachfrage trägt die vorige Frage als Faden, und die Fläche zeigt, woran sie anknüpft", async () => {
    const f = await oeffnen();
    await fragen(f, ERSTFRAGE);
    await fragen(f, NACHFRAGE);
    expect(askMock).toHaveBeenCalledTimes(2);
    expect(askMock.mock.calls[1]).toEqual([NACHFRAGE, "de", [ERSTFRAGE]]);
    expect(f.container.querySelector('[data-testid="ask-fragezeile"]')?.textContent).toBe(
      NACHFRAGE,
    );
    expect(fadenfragen(f)).toEqual([ERSTFRAGE]);
  });

  it("M3 · „Neues Thema beginnen“ leert den Faden — die nächste Frage fängt neu an", async () => {
    const f = await oeffnen();
    await fragen(f, ERSTFRAGE);
    await act(async () => {
      f.container.querySelector<HTMLButtonElement>(NEUES_THEMA)?.click();
      await flush();
    });
    expect(faden(f)).toBeNull();
    await fragen(f, NACHFRAGE);
    expect(askMock.mock.calls[1]).toEqual([NACHFRAGE, "de"]);
  });

  it("M4 · dieselbe Frage erneut ist eine Auffrischung — sie schickt sich nicht selbst als Faden", async () => {
    const f = await oeffnen();
    await fragen(f, ERSTFRAGE);
    await fragen(f, ERSTFRAGE);
    expect(askMock).toHaveBeenCalledTimes(2);
    expect(askMock.mock.calls[1]).toEqual([ERSTFRAGE, "de"]);
  });

  it("M5 · Ben, Nacharbeit 2: „Neues Thema“ während einer laufenden Nachfrage — die späte Antwort bringt den alten Faden nicht zurück", async () => {
    const standard = askMock.getMockImplementation();
    const f = await oeffnen();
    await fragen(f, ERSTFRAGE);
    // Die Nachfrage bleibt in der Leitung, bis der Test sie freigibt.
    let freigeben: (wert: unknown) => void = () => undefined;
    askMock.mockImplementationOnce(
      () =>
        new Promise((aufloesen) => {
          freigeben = aufloesen;
        }),
    );
    await fragen(f, NACHFRAGE);
    expect(askMock.mock.calls[1]).toEqual([NACHFRAGE, "de", [ERSTFRAGE]]);
    await act(async () => {
      f.container.querySelector<HTMLButtonElement>(NEUES_THEMA)?.click();
      await flush();
    });
    expect(faden(f)).toBeNull();
    // Jetzt kommt die Antwort auf die alte Nachfrage an.
    const antwort = await standard?.();
    await act(async () => {
      freigeben(antwort);
      await flush();
    });
    expect(faden(f)).toBeNull();
    // Die nächste Frage fängt wirklich neu an — ohne alten Zusammenhang.
    await fragen(f, "Wie beantrage ich Sonderurlaub?");
    expect(askMock.mock.calls[2]).toEqual(["Wie beantrage ich Sonderurlaub?", "de"]);
  });
});
