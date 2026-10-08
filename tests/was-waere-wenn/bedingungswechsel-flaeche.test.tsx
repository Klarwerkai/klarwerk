// @vitest-environment jsdom
// ================================================================================================
// R-1628 — „WAS WÄRE, WENN …" AUF DER ECHTEN FRAGEN-SEITE.
// ================================================================================================
//
// Die echte `Ask`-Seite; gemockt sind nur die Endpunkte. Gemessen wird, was die Fläche aus dem
// geladenen Bestand zeigt — die Einordnung selbst fragt die KI nicht — und dass „Mit Klara
// durchspielen" den Wechsel über den bestehenden Frageweg stellt.
//
//   B1  Zugeklappt steht kein Eingabefeld der Gegenüberstellung im Baum; das Fragefeld bleibt vorn.
//   B2  Statt 5083-H111 jetzt 6082-T6: gebunden / ausgeschlossen / beide / nur neu mit Fundstelle,
//       Bewertung und Verweis aufs Objekt; was keine nennt, wird gezählt; die Einordnung allein
//       ruft die KI nicht. Unvollständig oder gleich: ein Satz.
//   B3  Mit Thema steht „nennt keine von beiden" einzeln da.
//   B4  „Mit Klara durchspielen": die Frage der Quelle mit beiden Bedingungen geht über `ask`
//       hinaus, steht im Fragefeld, und die Antwort erscheint mit ihrer Quelle.
//   B5  KI gesperrt: der Knopf ist aus, die Fläche sagt warum, nichts geht hinaus — die Einordnung
//       bleibt nutzbar.
//   Nacharbeit 2: in B2 stehen „sind untauglich" und „Vielleicht für …" unter „nicht eindeutig",
//   nicht unter „übertragbar belegt" bzw. „schon für 6082-T6 festgehalten".
//   Nacharbeit 3: ebenso „Für 6082-T6 liegen keine Erfahrungswerte vor" — nur `ko-neu` (eine
//   erkannte Anweisung) steht unter „schon für 6082-T6 festgehalten".
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  // In der Fabrik, nicht darüber: `vi.mock` wird an den Dateianfang gehoben.
  const ko = (id: string, title: string, statement: string, conditions: string[]) => ({
    id,
    title,
    statement,
    conditions,
    measures: [],
    type: "best_practice",
    category: "Schweißen",
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
  });
  return {
    endpoints: {
      ko: {
        list: vi.fn(async () => [
          ko("ko-gebunden", "Vorwärmen", "Auf 80 Grad vorwärmen.", ["Werkstoff 5083-H111"]),
          ko("ko-beide", "Schutzgas Argon", "Reines Argon verwenden.", ["5083-H111", "6082-T6"]),
          ko("ko-neu", "Nahtvorbereitung", "Bei 6082-T6 die Kanten entgraten.", []),
          ko("ko-ohne", "Schweißnaht reinigen", "Nach dem Schweißen die Naht bürsten.", []),
          // Bens Gegenfall (Nacharbeit 1): nennt beide — und schließt die neue aus.
          ko("ko-ausschluss", "Haltezeit", "Gilt für 5083-H111, nicht für 6082-T6.", []),
          // Bens Gegenfälle (Nacharbeit 2): Abwertung ohne positiven Beleg; Unsicherheit einseitig.
          ko("ko-untauglich", "Tauglichkeit", "5083-H111 und 6082-T6 sind untauglich.", []),
          ko("ko-vielleicht", "Eignung unklar", "Vielleicht für 6082-T6 geeignet.", []),
          // Bens Gegenfall (Nacharbeit 3): ausdrücklich fehlendes Wissen nach „für X".
          ko("ko-leer", "Lage", "Für 6082-T6 liegen keine Erfahrungswerte vor.", []),
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
            answer: "Das Schutzgas Argon gilt für beide Werkstoffe [1].",
            knowledgeClass: "gesichert",
            trust: 90,
            sources: ["ko-beide"],
            citedSources: ["ko-beide"],
            steps: [],
            demo: false,
          },
          gap: null,
          receipt: "beleg-1",
        })),
        helpful: vi.fn(async () => ({})),
      },
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
import { endpoints } from "../../apps/web/src/api/endpoints";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Element.prototype.scrollIntoView = () => undefined;

const askMock = endpoints.ask.ask as unknown as ReturnType<typeof vi.fn>;

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

function setze(el: HTMLInputElement, wert: string): void {
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  setzer.call(el, wert);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

async function tippe(c: HTMLElement, selektor: string, wert: string): Promise<void> {
  const el = c.querySelector<HTMLInputElement>(selektor);
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

const EINTRAG = '[data-testid="bedingungswechsel-eintrag"]';
const FUND_NEU = '[data-testid="bedingungswechsel-fund-neu"]';

function gruppe(c: HTMLElement, lage: string): HTMLElement | null {
  return c.querySelector<HTMLElement>(
    `[data-testid="bedingungswechsel-gruppe"][data-lage="${lage}"]`,
  );
}

function eintraege(c: HTMLElement, lage: string): string[] {
  const liste = gruppe(c, lage)?.querySelectorAll<HTMLElement>(EINTRAG) ?? [];
  return Array.from(liste, (e) => e.getAttribute("data-ko") ?? "");
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

describe("R-1628 · Was wäre, wenn … auf der Fragen-Seite", () => {
  it("B1 · zugeklappt kein Eingabefeld; das Fragefeld bleibt vorn", async () => {
    const c = await montiere();
    const flaeche = c.querySelector('[data-testid="bedingungswechsel"]');
    expect(flaeche?.textContent).toContain(i18n.t("bedingungswechsel.titel"));
    expect(flaeche?.querySelector("input")).toBeNull();
    expect(c.querySelector("input")?.closest('[data-testid="bedingungswechsel"]')).toBeNull();
  });

  it("B2 · statt 5083-H111 jetzt 6082-T6: Einordnung mit Fundstelle, ohne KI-Aufruf", async () => {
    const c = await montiere();
    await klicke(c, '[data-testid="bedingungswechsel-umschalten"]');
    await tippe(c, '[data-testid="bedingungswechsel-bisher"]', "5083-H111");
    expect(c.querySelector('[data-testid="bedingungswechsel-unvollstaendig"]')?.textContent).toBe(
      i18n.t("bedingungswechsel.unvollstaendig"),
    );
    await tippe(c, '[data-testid="bedingungswechsel-neu"]', "5083-h111");
    expect(c.querySelector('[data-testid="bedingungswechsel-unvollstaendig"]')?.textContent).toBe(
      i18n.t("bedingungswechsel.gleich"),
    );
    await tippe(c, '[data-testid="bedingungswechsel-neu"]', "6082-T6");

    const werte = { bisher: "5083-H111", neu: "6082-T6" };
    expect(eintraege(c, "nur_bisher")).toEqual(["ko-gebunden"]);
    expect(gruppe(c, "nur_bisher")?.querySelector("p")?.textContent).toBe(
      `${i18n.t("bedingungswechsel.lage.nur_bisher", werte)} (1)`,
    );
    const gebunden = gruppe(c, "nur_bisher")?.querySelector<HTMLElement>(EINTRAG);
    expect(gebunden?.querySelector("a")?.getAttribute("href")).toBe("/wissen/ko-gebunden");
    const fund = gebunden?.querySelector<HTMLElement>(
      '[data-testid="bedingungswechsel-fund-bisher"]',
    );
    expect(fund?.getAttribute("data-fundort")).toBe("bedingung");
    expect(fund?.textContent).toBe(
      `5083-H111 · ${i18n.t("bedingungswechsel.fundort.bedingung")}: Werkstoff 5083-H111`,
    );
    expect(gebunden?.querySelector('[data-testid="bedingungswechsel-fund-neu"]')).toBeNull();

    // Bens Gegenfall: nennt beide, schließt die neue aus — steht NICHT unter „übertragbar belegt".
    expect(eintraege(c, "neu_ausgeschlossen")).toEqual(["ko-ausschluss"]);
    const ausschluss = gruppe(c, "neu_ausgeschlossen")?.querySelector<HTMLElement>(
      '[data-testid="bedingungswechsel-fund-neu"]',
    );
    expect(ausschluss?.getAttribute("data-bewertung")).toBe("ausgeschlossen");
    expect(ausschluss?.textContent).toContain(i18n.t("bedingungswechsel.bewertung.ausgeschlossen"));
    expect(ausschluss?.textContent).toContain("Gilt für 5083-H111, nicht für 6082-T6.");

    // „Übertragbar belegt" und „Schon für 6082-T6 festgehalten" tragen nur belegte Geltung — Bens
    // Gegenfälle (Abwertung, Unsicherheit) stehen unter „nicht eindeutig".
    expect(eintraege(c, "beide")).toEqual(["ko-beide"]);
    expect(eintraege(c, "nur_neu")).toEqual(["ko-neu"]);
    // Nacharbeit 3: „Für 6082-T6 liegen keine Erfahrungswerte vor" ist fehlendes Wissen, nicht
    // „schon für 6082-T6 festgehalten".
    expect(eintraege(c, "ungeklaert")).toEqual(["ko-vielleicht", "ko-leer", "ko-untauglich"]);
    const funde = gruppe(c, "ungeklaert")?.querySelectorAll<HTMLElement>(FUND_NEU) ?? [];
    const bewertungen = Array.from(funde, (f) => f.getAttribute("data-bewertung"));
    expect(bewertungen).toEqual(["vorbehalt", "vorbehalt", "vorbehalt"]);
    expect(gruppe(c, "ungeklaert")?.textContent).toContain(
      i18n.t("bedingungswechsel.bewertung.vorbehalt"),
    );
    // Ohne Thema: keine Liste „nennt keine", sondern die Zahl samt Satz.
    expect(gruppe(c, "keine")).toBeNull();
    expect(c.querySelector('[data-testid="bedingungswechsel-ohne-nennung"]')?.textContent).toBe(
      i18n.t("bedingungswechsel.ohneNennung", { count: 1, neu: "6082-T6" }),
    );
    // Die Einordnung allein hat nichts an die KI geschickt.
    expect(askMock).not.toHaveBeenCalled();
  });

  it("B3 · mit Thema steht „nennt keine von beiden“ einzeln da", async () => {
    const c = await montiere();
    await klicke(c, '[data-testid="bedingungswechsel-umschalten"]');
    await tippe(c, '[data-testid="bedingungswechsel-bisher"]', "5083-H111");
    await tippe(c, '[data-testid="bedingungswechsel-neu"]', "6082-T6");
    await tippe(c, '[data-testid="bedingungswechsel-thema"]', "Naht");
    expect(eintraege(c, "keine")).toEqual(["ko-ohne"]);
    expect(eintraege(c, "nur_neu")).toEqual(["ko-neu"]);
    expect(eintraege(c, "nur_bisher")).toEqual([]);
    expect(gruppe(c, "nur_bisher")?.textContent).toContain(i18n.t("bedingungswechsel.leer"));
    expect(c.querySelector('[data-testid="bedingungswechsel-ohne-nennung"]')).toBeNull();
    expect(askMock).not.toHaveBeenCalled();
  });

  it("B4 · „Mit Klara durchspielen“ stellt den Wechsel über den Frageweg", async () => {
    const c = await montiere();
    await klicke(c, '[data-testid="bedingungswechsel-umschalten"]');
    await tippe(c, '[data-testid="bedingungswechsel-bisher"]', "5083-H111");
    await tippe(c, '[data-testid="bedingungswechsel-neu"]', "6082-T6");
    const knopf = c.querySelector<HTMLButtonElement>('[data-testid="bedingungswechsel-ki-knopf"]');
    expect(knopf?.disabled).toBe(false);
    expect(knopf?.textContent).toBe(i18n.t("bedingungswechsel.ki.knopf"));
    await klicke(c, '[data-testid="bedingungswechsel-ki-knopf"]');

    const frage = i18n.t("bedingungswechsel.ki.frage", { bisher: "5083-H111", neu: "6082-T6" });
    expect(frage).toContain("5083-H111");
    expect(frage).toContain("6082-T6");
    expect(askMock).toHaveBeenCalledTimes(1);
    expect(askMock.mock.calls[0]?.[0]).toBe(frage);
    // Die Frage steht im Fragefeld (dem Feld im Frageformular) — sichtbar, was gefragt wurde.
    expect(c.querySelector<HTMLInputElement>("form input")?.value).toBe(frage);
    // Die Antwort kommt über die übliche Antwortfläche, die Einordnung bleibt stehen.
    expect(c.textContent).toContain("Das Schutzgas Argon gilt für beide Werkstoffe");
    expect(eintraege(c, "neu_ausgeschlossen")).toEqual(["ko-ausschluss"]);
  });

  it("B5 · KI gesperrt: Knopf aus, Grund sichtbar, nichts geht hinaus", async () => {
    const statusMock = endpoints.reasoner.status as unknown as ReturnType<typeof vi.fn>;
    const aktiv = { active: true, mode: "cloud", reachable: "active", tasks: { answer: true } };
    statusMock.mockResolvedValue({ ...aktiv, tasks: { answer: false } });
    try {
      const c = await montiere();
      await klicke(c, '[data-testid="bedingungswechsel-umschalten"]');
      await tippe(c, '[data-testid="bedingungswechsel-bisher"]', "5083-H111");
      await tippe(c, '[data-testid="bedingungswechsel-neu"]', "6082-T6");
      // Die Einordnung ohne KI steht trotzdem.
      expect(eintraege(c, "nur_bisher")).toEqual(["ko-gebunden"]);
      const knopf = c.querySelector<HTMLButtonElement>(
        '[data-testid="bedingungswechsel-ki-knopf"]',
      );
      expect(knopf?.disabled).toBe(true);
      expect(c.querySelector('[data-testid="bedingungswechsel-ki-gesperrt"]')?.textContent).toBe(
        i18n.t("ai.unavailable.hint"),
      );
      await klicke(c, '[data-testid="bedingungswechsel-ki-knopf"]');
      expect(askMock).not.toHaveBeenCalled();
    } finally {
      statusMock.mockResolvedValue(aktiv);
    }
  });
});
