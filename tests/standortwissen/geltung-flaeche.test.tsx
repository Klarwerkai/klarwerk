// @vitest-environment jsdom
// ================================================================================================
// R-1632 / R-1633 — „SICHTBAR IM UI": FRAGEKONTEXT UND GELTUNG AUF DEN ECHTEN FLÄCHEN.
// ================================================================================================
//
// Die echte `Ask`-Seite; gemockt sind nur die Endpunkte — darüber wird gemessen, was hinausgeht
// und was die Fläche aus der Antwort zeigt. Dazu das Geltungsfeld am Wissensobjekt als Bauteil.
//
//   U1  Zugeklappt steht kein Kontextfeld im Baum; ohne Angabe geht der bisherige Aufruf hinaus.
//   U2  „Ich frage für" Frühschicht → der Kontext reist mit, die Auskunft unter der Antwort nennt
//       Kontext, Geltung der Quelle und ihre Passung.
//   U3  Geltungsfeld: unvollständig ist nicht speicherbar; vollständig geht die Normalform hinaus;
//       „Keine Angabe" entfernt die Geltung (`null`).
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
          geltung: { ebene: "schicht", werk: "Werk Nord", schicht: "Frühschicht" },
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
      ask: vi.fn(async (_frage: string, _sprache: string, _faden?: unknown, kontext?: unknown) => ({
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
        ...(kontext
          ? {
              geltung: {
                fragekontext: kontext,
                quellen: [
                  {
                    id: "ko-1",
                    passung: "eigene_schicht",
                    geltung: { ebene: "schicht", werk: "Werk Nord", schicht: "Frühschicht" },
                  },
                ],
              },
            }
          : {}),
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
import type { KoGeltung } from "../../apps/web/src/api/types";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { GeltungFeld } from "../../apps/web/src/components/Geltung";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Element.prototype.scrollIntoView = () => undefined;

const FRAGE = "Wie wird das Werkzeug beim Anfahren vorgewärmt?";
const askMock = endpoints.ask.ask as unknown as ReturnType<typeof vi.fn>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

let abbauen: (() => void) | null = null;

async function montiere(element: ReturnType<typeof createElement>): Promise<HTMLElement> {
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
          createElement(ToastProvider, null, element),
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

async function frage(c: HTMLElement): Promise<void> {
  // Das Fragefeld ist das erste Eingabefeld der Seite (zugeklappt gibt es kein Kontextfeld davor).
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

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("de");
});

afterEach(() => {
  abbauen?.();
  abbauen = null;
  vi.clearAllMocks();
});

describe("R-1633 · Fragekontext auf der Fragen-Seite", () => {
  it("U1 · zugeklappt kein Kontextfeld, ohne Angabe der bisherige Aufruf und keine Auskunft", async () => {
    const c = await montiere(createElement(Ask));
    expect(c.querySelector('[data-testid="ask-fragekontext-zeile"]')?.textContent).toBe(
      i18n.t("geltung.frage.leer"),
    );
    expect(c.querySelector('[data-testid="ask-fragekontext-schicht"]')).toBeNull();
    await frage(c);
    expect(askMock).toHaveBeenCalledTimes(1);
    expect(askMock.mock.calls[0]).toEqual([FRAGE, "de"]);
    expect(c.querySelector('[data-testid="ask-geltung"]')).toBeNull();
  });

  it("U2 · Frühschicht angegeben: der Kontext reist mit, die Auskunft steht unter der Antwort", async () => {
    const c = await montiere(createElement(Ask));
    await klicke(c, '[data-testid="ask-fragekontext-umschalten"]');
    await tippe(c, '[data-testid="ask-fragekontext-werk"]', "Werk Nord");
    await tippe(c, '[data-testid="ask-fragekontext-schicht"]', " Frühschicht ");
    expect(c.querySelector('[data-testid="ask-fragekontext-zeile"]')?.textContent).toBe(
      "Werk Nord · Frühschicht",
    );
    // Wieder zuklappen: das Fragefeld ist wieder das erste Eingabefeld.
    await klicke(c, '[data-testid="ask-fragekontext-umschalten"]');
    await frage(c);
    expect(askMock).toHaveBeenCalledTimes(1);
    expect(askMock.mock.calls[0]).toEqual([
      FRAGE,
      "de",
      [],
      { werk: "Werk Nord", schicht: "Frühschicht" },
    ]);
    const auskunft = c.querySelector<HTMLElement>('[data-testid="ask-geltung"]');
    expect(auskunft?.textContent).toContain(
      i18n.t("geltung.frage.gewichtet", { kontext: "Werk Nord · Frühschicht" }),
    );
    const quelle = c.querySelector<HTMLElement>('[data-testid="ask-geltung-quelle"]');
    expect(quelle?.getAttribute("data-passung")).toBe("eigene_schicht");
    expect(quelle?.textContent).toContain("Presse anfahren");
    expect(quelle?.textContent).toContain("Schicht-spezifisch · Werk Nord · Frühschicht");
    expect(quelle?.textContent).toContain(i18n.t("geltung.passung.eigene_schicht"));
  });
});

describe("R-1632 · Geltungsfeld am Wissensobjekt", () => {
  it("U3 · unvollständig gesperrt, vollständig in Normalform, „Keine Angabe“ entfernt", async () => {
    const gespeichert: (KoGeltung | null)[] = [];
    const c = await montiere(
      createElement(GeltungFeld, {
        geltung: { ebene: "konzern" },
        darfAendern: true,
        wartet: false,
        onSpeichern: (g: KoGeltung | null) => gespeichert.push(g),
      }),
    );
    expect(c.querySelector('[data-testid="ko-geltung-wert"]')?.textContent).toBe(
      i18n.t("geltung.ebene.konzern"),
    );
    const speichern = (): HTMLButtonElement | null =>
      c.querySelector<HTMLButtonElement>('[data-testid="ko-geltung-speichern"]');
    // Unverändert: nichts zu speichern.
    expect(speichern()?.disabled).toBe(true);

    await tippe(c, '[data-testid="ko-geltung-ebene"]', "werk");
    // Werks-Praxis ohne Werk: gesperrt, und die Fläche sagt warum.
    expect(speichern()?.disabled).toBe(true);
    expect(c.textContent).toContain(i18n.t("geltung.unvollstaendig", { feld: "Werk" }));

    await tippe(c, '[data-testid="ko-geltung-werk"]', "  Werk Nord ");
    expect(speichern()?.disabled).toBe(false);
    await klicke(c, '[data-testid="ko-geltung-speichern"]');
    expect(gespeichert).toEqual([{ ebene: "werk", werk: "Werk Nord" }]);

    await tippe(c, '[data-testid="ko-geltung-ebene"]', "");
    await klicke(c, '[data-testid="ko-geltung-speichern"]');
    expect(gespeichert).toEqual([{ ebene: "werk", werk: "Werk Nord" }, null]);
  });

  it("U4 · ohne Bearbeitungsrecht nur die Anzeige", async () => {
    const c = await montiere(
      createElement(GeltungFeld, {
        geltung: undefined,
        darfAendern: false,
        wartet: false,
        onSpeichern: () => undefined,
      }),
    );
    expect(c.querySelector('[data-testid="ko-geltung-wert"]')?.textContent).toBe(
      i18n.t("geltung.keine"),
    );
    expect(c.querySelector('[data-testid="ko-geltung-ebene"]')).toBeNull();
  });
});
