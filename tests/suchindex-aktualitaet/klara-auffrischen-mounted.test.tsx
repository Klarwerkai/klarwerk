// @vitest-environment jsdom
// ================================================================================================
// R-0338 (Aufnahme gesamt-suchindex-aktualitaet) — KLARA ZEIGT NACH ÄNDERUNGEN NICHT DEN ALTEN STAND.
// ================================================================================================
//
// Die echte `Ask`-Seite mit echtem Browserspeicher (jsdom); gemockt sind nur die Endpunkte, und der
// Bestand (`ko.list`) liefert die Fassung, die der Fall gerade braucht. Dieselbe Vorrichtung wie
// `tests/fragen-arbeitsstand/weiterarbeiten-mounted.test.tsx`.
//
//   K1  Unverändertes Wissen: die aufgenommene Antwort steht wieder da (Kalibrierung).
//   K2  Neue Fassung einer Quelle: die Antwort steht NICHT mehr da, der Satz sagt warum, und es
//       geht dafür keine Modellanfrage hinaus.
//   K3  „Neu fragen" stellt genau die gespeicherte Frage — danach steht die neue Antwort da.
//   K4  Eine Quelle ist aus dem Bestand verschwunden (Papierkorb, nicht mehr sichtbar): ebenso.
// Ben, Nacharbeit 3 — der Stand kommt vom SERVER (`quellenStand` der Antwort), und die Restfälle:
//   K5  Eine Altantwort OHNE Quellenstand, deren Quelle sich seither geändert hat, steht nicht mehr
//       da (Kalibrierung: ohne spätere Änderung steht sie, wie bisher, mit Zeitpunkt).
//   K6  Antwort- und Browserfassung laufen auseinander: der Server las Fassung 2, der Browser
//       kennt noch Fassung 1 — die Antwort ist die neuere und bleibt stehen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lage = vi.hoisted(() => ({
  fassung: 1,
  vorhanden: true,
  // Die Fassung, die der Server zu einer Antwort meldet (`quellenStand`); `null` = meldet keine.
  serverFassung: 1 as number | null,
  verlauf: [] as { version: number; at: string; author: string; note: string }[],
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: {
      list: vi.fn(async () =>
        lage.vorhanden
          ? [
              {
                id: "ko-1",
                title: "Wartungsplan Ventil V4",
                statement: "Wartungsplan Ventil V4",
                conditions: [],
                measures: [],
                type: "regel",
                category: "Instandhaltung",
                tags: [],
                confidence: 80,
                trust: 90,
                status: "validiert",
                version: lage.fassung,
                originalAuthor: "u9",
                author: "u9",
                neededValidations: 2,
                assignments: [],
                asset: null,
                createdAt: "2026-01-01T00:00:00.000Z",
                history: lage.verlauf,
              },
            ]
          : [],
      ),
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
          answer: "Ventil V4 wird jährlich geprüft [1].",
          knowledgeClass: "gesichert",
          trust: 90,
          sources: ["ko-1"],
          citedSources: ["ko-1"],
          steps: [],
          demo: false,
        },
        gap: null,
        receipt: "beleg-1",
        ...(lage.serverFassung === null ? {} : { quellenStand: { "ko-1": lage.serverFassung } }),
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

const FRAGE = "Wie oft wird Ventil V4 geprüft?";

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function neuerCache(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(["auth", "me"], { id: "u1", role: "experte" });
  return client;
}

interface Flaeche {
  container: HTMLElement;
  abbauen: () => void;
}

async function oeffnen(client: QueryClient): Promise<Flaeche> {
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
  return {
    container,
    abbauen: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

async function fragen(f: Flaeche, text: string): Promise<void> {
  const feld = f.container.querySelector<HTMLInputElement>("input");
  expect(feld, "Eingabefeld nicht gefunden").toBeTruthy();
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setzer.call(feld, text);
    feld?.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(async () => {
    f.container
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });
}

const antwortkarte = (f: Flaeche) => f.container.querySelector('[data-testid="ask-answer"]');
const ueberholt = (f: Flaeche) =>
  f.container.querySelector<HTMLElement>('[data-testid="ask-antwort-ueberholt"]');

/** Eine Antwort bei Fassung 1 erzeugen und die Seite abbauen — der Stand liegt im Speicher. */
async function antwortBeiFassungEins(): Promise<void> {
  const erst = await oeffnen(neuerCache());
  await fragen(erst, FRAGE);
  expect(antwortkarte(erst), "Vorbedingung: die Antwort ist angekommen").toBeTruthy();
  erst.abbauen();
}

beforeEach(async () => {
  localStorage.clear();
  lage.fassung = 1;
  lage.vorhanden = true;
  lage.serverFassung = 1;
  lage.verlauf = [];
  await i18n.changeLanguage("de");
});

const ANTWORT_AM = "2026-10-01T08:00:00.000Z";

/** Eine Altantwort im Speicher, wie sie ein Stand OHNE Quellenstand abgelegt hat. */
function altantwortAblegen(): void {
  localStorage.setItem(
    "kw.fragen.arbeitsstand.v1:u1",
    JSON.stringify({
      entwurf: "",
      antwort: {
        frage: FRAGE,
        result: {
          answered: true,
          answer: "Ventil V4 wird jährlich geprüft [1].",
          knowledgeClass: "gesichert",
          trust: 90,
          sources: ["ko-1"],
          citedSources: ["ko-1"],
          steps: [],
          demo: false,
        },
        receipt: "beleg-1",
        verschlossen: [],
        gapId: null,
        angezeigtAm: ANTWORT_AM,
      },
      startadressen: [],
    }),
  );
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("R-0338 · Klara zeigt nach Änderungen den neuen Stand", () => {
  it("K1 · KALIBRIERUNG: unverändertes Wissen — die aufgenommene Antwort steht wieder da", async () => {
    await antwortBeiFassungEins();
    vi.mocked(endpoints.ask.ask).mockClear();

    const wieder = await oeffnen(neuerCache());

    expect(antwortkarte(wieder)).toBeTruthy();
    expect(ueberholt(wieder)).toBeNull();
    expect(endpoints.ask.ask).not.toHaveBeenCalled();
  });

  it("K2 · neue Fassung der Quelle: die alte Antwort steht nicht mehr da, ohne Modellanfrage", async () => {
    await antwortBeiFassungEins();
    vi.mocked(endpoints.ask.ask).mockClear();
    lage.fassung = 2;

    const wieder = await oeffnen(neuerCache());

    expect(antwortkarte(wieder)).toBeNull();
    expect(wieder.container.textContent).not.toContain("Ventil V4 wird jährlich geprüft");
    expect(ueberholt(wieder)?.textContent).toContain("hat sich seitdem geändert");
    expect(endpoints.ask.ask).not.toHaveBeenCalled();
  });

  it("K3 · „Neu fragen“ stellt die gespeicherte Frage, danach steht die neue Antwort da", async () => {
    await antwortBeiFassungEins();
    vi.mocked(endpoints.ask.ask).mockClear();
    lage.fassung = 2;
    // Die neue Antwort liest die neue Fassung — und der Server sagt das.
    lage.serverFassung = 2;
    const wieder = await oeffnen(neuerCache());
    const knopf = wieder.container.querySelector<HTMLButtonElement>(
      '[data-testid="ask-neu-fragen"]',
    );
    expect(knopf).toBeTruthy();

    await act(async () => {
      knopf?.click();
      await flush();
    });

    expect(endpoints.ask.ask).toHaveBeenCalledTimes(1);
    expect(vi.mocked(endpoints.ask.ask).mock.calls[0]?.[0]).toBe(FRAGE);
    expect(antwortkarte(wieder)).toBeTruthy();
    expect(ueberholt(wieder)).toBeNull();
  });

  it("K4 · eine Quelle ist aus dem Bestand verschwunden: auch dann keine alte Antwort", async () => {
    await antwortBeiFassungEins();
    lage.vorhanden = false;

    const wieder = await oeffnen(neuerCache());

    expect(antwortkarte(wieder)).toBeNull();
    expect(ueberholt(wieder)).toBeTruthy();
  });

  it("K5 · Altantwort ohne Quellenstand: nach einer späteren Änderung der Quelle steht sie nicht mehr da", async () => {
    // Kalibrierung: die Quelle wurde VOR der Antwort geändert — die Antwort steht wie bisher.
    altantwortAblegen();
    lage.fassung = 2;
    lage.verlauf = [
      { version: 2, at: "2026-09-30T08:00:00.000Z", author: "u9", note: "vor der Antwort" },
    ];
    const vorher = await oeffnen(neuerCache());
    expect(antwortkarte(vorher)).toBeTruthy();
    expect(ueberholt(vorher)).toBeNull();
    vorher.abbauen();

    // Dieselbe Altantwort, die Quelle wurde NACH der Antwort geändert.
    altantwortAblegen();
    lage.fassung = 3;
    lage.verlauf = [
      ...lage.verlauf,
      { version: 3, at: "2026-10-02T08:00:00.000Z", author: "u9", note: "nach der Antwort" },
    ];
    const nachher = await oeffnen(neuerCache());

    expect(antwortkarte(nachher)).toBeNull();
    expect(ueberholt(nachher)).toBeTruthy();
    expect(endpoints.ask.ask).not.toHaveBeenCalled();
  });

  it("K6 · der Server las eine neuere Fassung als der Browser kennt: die Antwort bleibt stehen", async () => {
    lage.fassung = 1;
    lage.serverFassung = 2;
    const erst = await oeffnen(neuerCache());
    await fragen(erst, FRAGE);

    // Die Antwort ist neuer als der Browserbestand — kein Grund, sie als überholt zu verstecken.
    expect(antwortkarte(erst)).toBeTruthy();
    expect(ueberholt(erst)).toBeNull();
    erst.abbauen();

    // Erst eine Fassung NACH der gelesenen macht sie überholt.
    lage.fassung = 3;
    const wieder = await oeffnen(neuerCache());
    expect(antwortkarte(wieder)).toBeNull();
    expect(ueberholt(wieder)).toBeTruthy();
  });
});
