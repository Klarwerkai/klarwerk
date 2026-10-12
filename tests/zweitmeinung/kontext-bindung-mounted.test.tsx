// @vitest-environment jsdom
// ================================================================================================
// R-0305/R-1099 · Ben, Nacharbeit 9 — DIE ZWEITMEINUNG BEZIEHT SICH AUF DIESELBE KONTEXTFRAGE.
// ================================================================================================
//
// Befund: Die normale Frage trägt Werk/Schicht/Rolle (R-1633, `fragekontext`), der
// Zweitmeinungsaufruf trug ihn nicht. Dann gewichtet die Gegenüberstellung andere Quellen als die
// stehende Antwort, auf die sie sich bezieht. Jetzt bindet die Seite den beim Absenden verwendeten
// Kontext an die stehende Antwort und reicht ihn bis zum API-Aufruf durch — auch wenn die Auswahl
// inzwischen geändert wurde.
//
// Die echte `Ask`-Seite; gemockt sind nur die Endpunkte (Drahtgrenze).
//
//   B1  Frühschicht gefragt, danach die Auswahl auf Spätschicht geändert, OHNE neu zu fragen —
//       die Zweitmeinung geht mit Frühschicht hinaus (dem Kontext der stehenden Antwort).
//   B2  Dieselbe Frage mit Spätschicht neu gestellt — dann gehört die stehende Antwort zu
//       Spätschicht, und die Zweitmeinung folgt ihr.
//   B3  Ohne Kontext gefragt — die Zweitmeinung trägt keinen Kontext (der bisherige Aufruf).
//
// Ben, Nacharbeit 10 — DIE WIEDERAUFNAHME (Neuladen, erneute Anmeldung desselben Kontos):
//   B4  Frühschicht gefragt → Seite neu montiert (gespeicherte Antwort, keine neue Frage) →
//       Auswahl Spätschicht → Zweitmeinung geht mit Frühschicht hinaus.
//   B5  Ohne Kontext gefragt → neu montiert → Zweitmeinung ohne Kontext (nicht „unbekannt").
//   B6  Altstand ohne gespeicherten Kontext → KEIN Zweitmeinungsknopf, sondern der Hinweis und
//       „Frage erneut stellen" — die neue Frage geht mit dem gewählten Kontext, danach folgt die
//       Zweitmeinung genau diesem Kontext.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));

// `vi.hoisted`: die Mock-Fabrik unten wird vor jede Konstante gehoben.
//
// Nacharbeit 14: Die tragende Quelle steht im Bestand, und der Server meldet ihre Fassung
// (`quellenStand`, R-0338). Ohne das ist eine WIEDERAUFGENOMMENE Antwort nach dem Auffrischen-
// Vertrag (`antwortFrische`, Regel 4: Quelle fehlt im neu geladenen Bestand) zu Recht „überholt"
// und wird ausgeblendet — dann gibt es auch keine Zweitmeinung zu ihr. Das war die Ursache der
// roten Fälle B4–B6, nicht die Kontextbindung.
const { ANTWORT, QUELLE } = vi.hoisted(() => ({
  ANTWORT: {
    result: {
      answered: true,
      answer: "Das Werkzeug wird auf 60 Grad vorgewärmt [1].",
      knowledgeClass: "gesichert",
      trust: 90,
      sources: ["ko-1"],
      citedSources: ["ko-1"],
      steps: [],
      demo: false,
    },
    gap: null,
    receipt: "beleg-1",
    quellenStand: { "ko-1": 1 },
  },
  QUELLE: {
    id: "ko-1",
    title: "Presse anfahren",
    statement: "Beim Anfahren der Presse wird das Werkzeug auf 60 Grad vorgewärmt.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Presswerk",
    tags: [],
    confidence: 80,
    trust: 90,
    status: "validiert",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    history: [],
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => [QUELLE]) },
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
      ask: vi.fn(async () => ANTWORT),
      zweitmeinung: vi.fn(async () => ({
        ...ANTWORT,
        zweitmeinung: { status: "nicht_moeglich", grund: "nicht_eingerichtet" },
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
import {
  arbeitsstandLesen,
  arbeitsstandSchreiben,
} from "../../apps/web/src/lib/fragenArbeitsstand";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Element.prototype.scrollIntoView = () => undefined;

const FRAGE = "Wie wird das Werkzeug beim Anfahren vorgewärmt?";
const askMock = endpoints.ask.ask as unknown as ReturnType<typeof vi.fn>;
const zweitMock = endpoints.ask.zweitmeinung as unknown as ReturnType<typeof vi.fn>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

let abbauen: (() => void) | null = null;

async function montiere(): Promise<HTMLElement> {
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
  abbauen = () => {
    act(() => root.unmount());
    container.remove();
  };
  return container;
}

function setze(el: HTMLInputElement | HTMLSelectElement, wert: string): void {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
  const setzer = Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set as (
    v: string,
  ) => void;
  setzer.call(el, wert);
  el.dispatchEvent(
    new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }),
  );
}

async function tippe(c: HTMLElement, selektor: string, wert: string): Promise<void> {
  const el = c.querySelector<HTMLInputElement | HTMLSelectElement>(selektor);
  expect(el, `${selektor} nicht gefunden`).toBeTruthy();
  await act(async () => {
    setze(el as HTMLInputElement, wert);
    await flush();
  });
}

async function klicke(c: HTMLElement, selektor: string): Promise<void> {
  const el = c.querySelector<HTMLElement>(selektor);
  expect(el, `${selektor} nicht gefunden`).toBeTruthy();
  await act(async () => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flush();
  });
}

/** Kontext setzen und das Feld wieder zuklappen (dann ist das Fragefeld das erste Eingabefeld). */
async function kontext(c: HTMLElement, werk: string, schicht: string): Promise<void> {
  await klicke(c, '[data-testid="ask-fragekontext-umschalten"]');
  await tippe(c, '[data-testid="ask-fragekontext-werk"]', werk);
  await tippe(c, '[data-testid="ask-fragekontext-schicht"]', schicht);
  await klicke(c, '[data-testid="ask-fragekontext-umschalten"]');
}

async function frage(c: HTMLElement): Promise<void> {
  const feld = c.querySelector<HTMLInputElement>("input");
  expect(feld?.closest('[data-testid="ask-fragekontext"]')).toBeNull();
  await act(async () => {
    setze(feld as HTMLInputElement, FRAGE);
    await flush();
  });
  await act(async () => {
    c.querySelector("form")?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
  });
}

const FRUEH = { werk: "Werk Nord", schicht: "Frühschicht" };
const SPAET = { werk: "Werk Nord", schicht: "Spätschicht" };

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("de");
});

afterEach(() => {
  abbauen?.();
  abbauen = null;
  vi.clearAllMocks();
});

describe("R-0305/R-1099 · die Zweitmeinung trägt den Kontext der stehenden Antwort", () => {
  it("B1 · Auswahl nach der Antwort geändert: die Zweitmeinung geht mit dem ursprünglichen Kontext", async () => {
    const c = await montiere();
    await kontext(c, "Werk Nord", "Frühschicht");
    await frage(c);
    expect(askMock.mock.calls).toEqual([[FRAGE, "de", [], FRUEH]]);

    // Die Auswahl ändert sich — es wird NICHT neu gefragt.
    await kontext(c, "Werk Nord", "Spätschicht");
    expect(askMock).toHaveBeenCalledTimes(1);

    await klicke(c, '[data-testid="ask-zweitmeinung-knopf"]');
    expect(zweitMock).toHaveBeenCalledTimes(1);
    expect(zweitMock.mock.calls[0]?.[0]).toBe(FRAGE);
    expect(zweitMock.mock.calls[0]?.[3]).toEqual(FRUEH);
  });

  it("B2 · dieselbe Frage im neuen Kontext gestellt: die Zweitmeinung folgt der neuen Antwort", async () => {
    const c = await montiere();
    await kontext(c, "Werk Nord", "Frühschicht");
    await frage(c);
    await kontext(c, "Werk Nord", "Spätschicht");
    await frage(c);
    expect(askMock.mock.calls[1]?.[3]).toEqual(SPAET);

    await klicke(c, '[data-testid="ask-zweitmeinung-knopf"]');
    expect(zweitMock.mock.calls[0]?.[3]).toEqual(SPAET);
  });

  it("B4 · Frage mit Kontext → Wiederaufnahme → Zweitmeinung mit dem ursprünglichen Kontext", async () => {
    const c1 = await montiere();
    await kontext(c1, "Werk Nord", "Frühschicht");
    await frage(c1);
    expect(arbeitsstandLesen(localStorage, "u1")?.antwort?.fragekontext).toEqual(FRUEH);
    abbauen?.();
    abbauen = null;

    // Neu montiert: die gespeicherte Antwort steht wieder da, es geht keine neue Frage hinaus.
    const c2 = await montiere();
    expect(askMock).toHaveBeenCalledTimes(1);
    expect(c2.querySelector('[data-testid="ask-zweitmeinung-kontext-unbekannt"]')).toBeNull();
    await kontext(c2, "Werk Nord", "Spätschicht");
    await klicke(c2, '[data-testid="ask-zweitmeinung-knopf"]');
    expect(zweitMock).toHaveBeenCalledTimes(1);
    expect(zweitMock.mock.calls[0]?.[3]).toEqual(FRUEH);
  });

  it("B5 · ohne Kontext gefragt → Wiederaufnahme → Zweitmeinung ohne Kontext", async () => {
    const c1 = await montiere();
    await frage(c1);
    expect(arbeitsstandLesen(localStorage, "u1")?.antwort?.fragekontext).toBeNull();
    abbauen?.();
    abbauen = null;

    const c2 = await montiere();
    expect(c2.querySelector('[data-testid="ask-zweitmeinung-kontext-unbekannt"]')).toBeNull();
    await klicke(c2, '[data-testid="ask-zweitmeinung-knopf"]');
    expect(zweitMock.mock.calls[0]?.[3]).toBeUndefined();
  });

  it("B6 · Altstand mit unbekanntem Kontext: keine kontextgleiche Zweitmeinung, erneut fragen", async () => {
    arbeitsstandSchreiben(localStorage, "u1", {
      entwurf: "",
      antwort: {
        frage: FRAGE,
        result: ANTWORT.result as never,
        receipt: "beleg-1",
        verschlossen: [],
        gapId: null,
        angezeigtAm: "2026-10-01T08:00:00.000Z",
      },
      startadressen: [],
    });
    const c = await montiere();
    expect(askMock).not.toHaveBeenCalled();
    expect(c.querySelector('[data-testid="ask-zweitmeinung-knopf"]')).toBeNull();
    expect(c.querySelector('[data-testid="ask-zweitmeinung-kontext-unbekannt"]')?.textContent).toBe(
      i18n.t("zweitmeinung.kontextUnbekannt"),
    );

    // Den Kontext wählen und die Frage damit erneut stellen.
    await kontext(c, "Werk Nord", "Spätschicht");
    await klicke(c, '[data-testid="ask-zweitmeinung-neu-fragen"]');
    expect(askMock).toHaveBeenCalledTimes(1);
    expect(askMock.mock.calls[0]?.[3]).toEqual(SPAET);
    expect(arbeitsstandLesen(localStorage, "u1")?.antwort?.fragekontext).toEqual(SPAET);

    // Jetzt ist der Kontext der stehenden Antwort bekannt — die Zweitmeinung folgt ihm.
    expect(c.querySelector('[data-testid="ask-zweitmeinung-kontext-unbekannt"]')).toBeNull();
    await klicke(c, '[data-testid="ask-zweitmeinung-knopf"]');
    expect(zweitMock.mock.calls[0]?.[3]).toEqual(SPAET);
  });

  it("B3 · ohne Kontext gefragt: die Zweitmeinung trägt keinen", async () => {
    const c = await montiere();
    await frage(c);
    expect(askMock.mock.calls).toEqual([[FRAGE, "de"]]);
    await klicke(c, '[data-testid="ask-zweitmeinung-knopf"]');
    expect(zweitMock).toHaveBeenCalledTimes(1);
    expect(zweitMock.mock.calls[0]?.[3]).toBeUndefined();
  });
});
