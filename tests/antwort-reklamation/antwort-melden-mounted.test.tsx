// @vitest-environment jsdom
// ================================================================================================
// R-1089 / R-1721 · „ANTWORT MELDEN" AUF DER ECHTEN FRAGENSEITE.
// ================================================================================================
//
// Die echte `Ask`-Seite; gemockt sind die Endpunkte und die Rolle (Bauform wie
// `tests/fragen-arbeitsstand/ben-r1-gegenproben-mounted.test.tsx`).
//   U1  Nach einer Antwort mit belegter Quelle steht „Antwort melden"; das Formular schickt Quelle,
//       Beleg und gewählten Grund — und die Quittung des Servers steht danach an der Antwort.
//   U2  Bei mehreren belegten Quellen wird die gewählte gemeldet, nicht blind die erste.
//   U3  Ohne belegte Quelle gibt es keinen Meldeknopf (er liefe in 403).
//   U4  Eine abgewiesene Meldung zeigt keine Quittung.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lage = vi.hoisted(() => ({
  antwort: null as unknown,
  meldungScheitert: false,
}));

function ko(id: string, title: string) {
  return {
    id,
    title,
    statement: title,
    conditions: [],
    measures: [],
    type: "regel",
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
  };
}

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: {
      list: vi.fn(async () => [
        ko("ko-1", "Wartungsplan Ventil V4"),
        ko("ko-2", "Prüfintervall Ventil V4"),
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
      ask: vi.fn(async () => lage.antwort),
      helpful: vi.fn(async () => ({})),
      report: vi.fn(async (koId: string, _receipt: string, grund: string) => {
        if (lage.meldungScheitert) {
          throw new Error("403");
        }
        return {
          meldungId: "M-0A1B2C3D4E",
          koId,
          koTitle: koId === "ko-2" ? "Prüfintervall Ventil V4" : "Wartungsplan Ventil V4",
          grund,
          at: "2026-10-07T08:30:00.000Z",
          zugestelltAn: "owner",
          bereitsGemeldet: false,
        };
      }),
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
Element.prototype.scrollIntoView = () => {};

function antwortMit(cited: string[]): unknown {
  return {
    result: {
      answered: true,
      answer: "Ventil V4 wird jährlich geprüft [1].",
      knowledgeClass: "gesichert",
      trust: 90,
      sources: ["ko-1", "ko-2"],
      citedSources: cited,
      steps: [],
      demo: false,
    },
    gap: null,
    receipt: "beleg-1",
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

interface Flaeche {
  c: HTMLElement;
  abbauen: () => void;
}

async function gefragt(): Promise<Flaeche> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(["auth", "me"], { id: "u1", role: "experte" });
  const c = document.createElement("div");
  document.body.appendChild(c);
  const root = createRoot(c);
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
  const feld = c.querySelector<HTMLInputElement>("input");
  expect(feld, "Eingabefeld nicht gefunden").toBeTruthy();
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setzer.call(feld, "Wie oft wird Ventil V4 geprüft?");
    feld?.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(async () => {
    c.querySelector("form")?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
  });
  return {
    c,
    abbauen: () => {
      act(() => root.unmount());
      c.remove();
    },
  };
}

const q = (f: Flaeche, id: string): HTMLElement | null =>
  f.c.querySelector<HTMLElement>(`[data-testid="${id}"]`);

async function klick(el: HTMLElement | null): Promise<void> {
  expect(el).not.toBeNull();
  await act(async () => {
    el?.click();
    await flush();
  });
}

async function formularAbsenden(f: Flaeche): Promise<void> {
  await act(async () => {
    q(f, "antwortmeldung-formular")?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
  });
}

beforeEach(async () => {
  localStorage.clear();
  lage.antwort = antwortMit(["ko-1"]);
  lage.meldungScheitert = false;
  await i18n.changeLanguage("de");
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("R-1089 · Antwort melden auf der Fragenseite", () => {
  it("U1 · melden mit Grund — die Quittung des Servers steht an der Antwort", async () => {
    const f = await gefragt();
    expect(q(f, "ask-answer"), "Antwort nicht gerendert").not.toBeNull();
    expect(q(f, "antwortmeldung-quittung")).toBeNull();
    await klick(q(f, "antwortmeldung-oeffnen"));
    expect(q(f, "antwortmeldung-formular")?.textContent).toContain(
      i18n.t("antwortmeldung.hinweis"),
    );
    await klick(q(f, "antwortmeldung-grund-quelle-passt-nicht"));
    await formularAbsenden(f);

    expect(endpoints.ask.report).toHaveBeenCalledTimes(1);
    expect(endpoints.ask.report).toHaveBeenCalledWith("ko-1", "beleg-1", "quelle-passt-nicht");
    const quittung = q(f, "antwortmeldung-quittung");
    expect(quittung, "keine Quittung").not.toBeNull();
    // Statusregion über das semantische Element (`<output>` = implizit role="status").
    expect(quittung?.tagName).toBe("OUTPUT");
    expect(quittung?.getAttribute("data-zugestellt")).toBe("owner");
    expect(quittung?.textContent).toContain("M-0A1B2C3D4E");
    expect(quittung?.textContent).toContain("Wartungsplan Ventil V4");
    expect(quittung?.textContent).toContain("verantwortlichen Person");
    // Nach der Quittung gibt es kein offenes Formular und keinen zweiten Meldeknopf mehr.
    expect(q(f, "antwortmeldung-formular")).toBeNull();
    expect(q(f, "antwortmeldung-oeffnen")).toBeNull();
    f.abbauen();
  });

  it("U2 · mehrere belegte Quellen: die gewählte wird gemeldet", async () => {
    lage.antwort = antwortMit(["ko-1", "ko-2"]);
    const f = await gefragt();
    await klick(q(f, "antwortmeldung-oeffnen"));
    const auswahl = q(f, "antwortmeldung-quelle") as HTMLSelectElement | null;
    expect(auswahl, "keine Quellenwahl bei zwei Quellen").not.toBeNull();
    expect([...(auswahl?.options ?? [])].map((o) => o.value).sort()).toEqual(["ko-1", "ko-2"]);
    await act(async () => {
      if (auswahl) {
        auswahl.value = "ko-2";
        auswahl.dispatchEvent(new Event("change", { bubbles: true }));
      }
      await flush();
    });
    await formularAbsenden(f);
    expect(endpoints.ask.report).toHaveBeenCalledWith("ko-2", "beleg-1", "antwort-falsch");
    expect(q(f, "antwortmeldung-quittung")?.textContent).toContain("Prüfintervall Ventil V4");
    f.abbauen();
  });

  it("U3 · ohne belegte Quelle: kein Meldeknopf", async () => {
    lage.antwort = antwortMit([]);
    const f = await gefragt();
    expect(q(f, "ask-answer")).not.toBeNull();
    expect(q(f, "antwortmeldung-oeffnen")).toBeNull();
    f.abbauen();
  });

  it("U4 · abgewiesene Meldung: keine Quittung, das Formular bleibt", async () => {
    lage.meldungScheitert = true;
    const f = await gefragt();
    await klick(q(f, "antwortmeldung-oeffnen"));
    await formularAbsenden(f);
    expect(endpoints.ask.report).toHaveBeenCalledTimes(1);
    expect(q(f, "antwortmeldung-quittung")).toBeNull();
    expect(q(f, "antwortmeldung-formular")).not.toBeNull();
    f.abbauen();
  });
});
