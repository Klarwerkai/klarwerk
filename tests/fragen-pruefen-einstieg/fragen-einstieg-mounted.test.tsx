// @vitest-environment jsdom
// ================================================================================================
// produkt:20261010:fragen-pruefen-einstieg — DER EINSTIEG AUF DER ECHTEN FRAGEN-SEITE (K1, K2, K5).
// ================================================================================================
//
// Die echte `Ask`-Seite; gemockt sind nur die Endpunkte (Muster wie
// `tests/was-waere-wenn/bedingungswechsel-flaeche.test.tsx`).
//
//   M1  Leer: kurze Erklärung und ein erster Schritt stehen ÜBER dem Feld; das Fragefeld bleibt das
//       erste Eingabefeld; der Text-/Sprachweg ist genannt.
//   M2  „Fiktive Beispiele zeigen" öffnet DENSELBEN Beispielblock wie „Beispiele" im Feld — ohne
//       etwas zu senden; feste Beispiele tragen sichtbar „fiktiv".
//   M3  Ein Vorschlag aus dem validierten Bestand ist NICHT als fiktiv gekennzeichnet.
//   M4  Optionale Angaben stehen als benannte Gruppe; Auf-/Zuklappen beider Angaben erhält die
//       begonnene Frage und den gesetzten Kontext.
//   M5  Nach der Antwort ist der Einstieg weg (der Antwortvertrag trägt den nächsten Schritt), die
//       Frage steht weiter im Feld.
//   M6  Fehler: keine Erfolgsmeldung, die Frage bleibt im Feld, der Einstieg kehrt nicht zurück.
//   M7  Ben Nacharbeit 3 (K2): Eingeben → andere Ansicht → zurück — Frage, „Ich frage für" und die
//       Szenarioangaben stehen wieder da (zugeklappt sichtbar, aufgeklappt bearbeitbar).
//   M8  Die aktuelle Auswahl bleibt getrennt vom Kontext, mit dem die stehende Antwort gestellt wurde.
//   M9  Geleerte Angaben werden nicht abgelegt und kommen nicht zurück.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  return {
    endpoints: {
      ko: { list: vi.fn(async () => []) },
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
            answer: "Den Druck vor dem Anfahren am Ventil V7 prüfen [1].",
            knowledgeClass: "gesichert",
            trust: 90,
            sources: ["ko-ventil"],
            citedSources: ["ko-ventil"],
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
import { arbeitsstandLesen } from "../../apps/web/src/lib/fragenArbeitsstand";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

Element.prototype.scrollIntoView = () => undefined;

const askMock = endpoints.ask.ask as unknown as ReturnType<typeof vi.fn>;
const koListMock = endpoints.ko.list as unknown as ReturnType<typeof vi.fn>;

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

async function absenden(c: HTMLElement): Promise<void> {
  const form = c.querySelector("form");
  expect(form, "Frageformular fehlt").toBeTruthy();
  await act(async () => {
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });
  await act(flush);
}

const FELD = "form input";
const EINSTIEG = '[data-testid="ask-einstieg"]';
const BEISPIELE = '[data-testid="ask-beispiele"]';

function feldWert(c: HTMLElement): string {
  return c.querySelector<HTMLInputElement>(FELD)?.value ?? "";
}

/** Steht `a` im Dokument VOR `b`? */
function davor(a: Element | null, b: Element | null): boolean {
  return Boolean(a && b && a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
}

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage("de");
});

afterEach(() => {
  abbauen?.();
  abbauen = null;
  vi.clearAllMocks();
  // M3 setzt einen Bestand — der nächste Fall beginnt wieder ohne.
  koListMock.mockResolvedValue([]);
});

describe("produkt:20261010:fragen-pruefen-einstieg · Fragen", () => {
  it("M1 · leer: Erklärung und erster Schritt über dem Feld, Feld bleibt erstes Eingabefeld", async () => {
    const c = await montiere();
    const einstieg = c.querySelector(EINSTIEG);
    expect(einstieg, "der Einstieg fehlt auf der leeren Fläche").toBeTruthy();
    expect(c.querySelector('[data-testid="ask-einstieg-erklaerung"]')?.textContent).toBe(
      i18n.t("fragenEinstieg.erklaerung"),
    );
    const schritt = c.querySelector('[data-testid="ask-einstieg-schritt"]')?.textContent ?? "";
    expect(schritt).toBe(i18n.t("fragenEinstieg.ersterSchritt"));
    // Text- und Sprachweg sind im ersten Schritt genannt — ohne „Nächster Schritt:".
    expect(schritt).toMatch(/schreiben/);
    expect(schritt).toMatch(/diktieren/);
    expect(schritt.startsWith("Nächster Schritt:")).toBe(false);
    // Über dem Feld, nicht zwischen Feld und Ergebnis (R-0286).
    expect(davor(einstieg, c.querySelector("form"))).toBe(true);
    // Das Fragefeld bleibt das erste Eingabefeld der Seite.
    expect(c.querySelector("input")).toBe(c.querySelector(FELD));
    expect(askMock).not.toHaveBeenCalled();
  });

  it("M2 · „Fiktive Beispiele zeigen“ öffnet denselben Block, sendet nichts, Beispiele sind fiktiv", async () => {
    const c = await montiere();
    const knopf = c.querySelector<HTMLButtonElement>('[data-testid="ask-einstieg-beispiele"]');
    expect(knopf?.textContent).toBe(i18n.t("fragenEinstieg.beispieleZeigen"));
    expect(knopf?.getAttribute("aria-expanded")).toBe("false");
    expect(knopf?.getAttribute("aria-controls")).toBe("ask-beispiele");
    expect(c.querySelector(BEISPIELE)?.hasAttribute("hidden")).toBe(true);

    await klicke(c, '[data-testid="ask-einstieg-beispiele"]');
    expect(c.querySelector(BEISPIELE)?.hasAttribute("hidden")).toBe(false);
    expect(c.querySelector(BEISPIELE)?.id).toBe("ask-beispiele");
    // Derselbe Zustand wie der Knopf im Feld.
    expect(
      c.querySelector('[data-testid="ask-beispiele-knopf"]')?.getAttribute("aria-expanded"),
    ).toBe("true");
    const chips = [...c.querySelectorAll<HTMLElement>('[data-testid="ask-beispiel"]')];
    expect(chips.length, "ohne Bestand fehlen die festen Beispiele").toBeGreaterThan(0);
    for (const chip of chips) {
      expect(chip.getAttribute("data-fiktiv")).toBe("1");
      expect(chip.querySelector('[data-testid="ask-beispiel-fiktiv"]')?.textContent).toBe(
        i18n.t("fragenEinstieg.fiktiv"),
      );
      expect(chip.getAttribute("title")).toContain(i18n.t("fragenEinstieg.fiktivTitel"));
      // Die Sofort-Zusage bleibt vor dem Klick lesbar (mega51 H).
      expect(chip.getAttribute("title")).toContain(i18n.t("ask.examplesSendHint"));
    }
    // Öffnen allein schickt nichts hinaus.
    expect(askMock).not.toHaveBeenCalled();

    await klicke(c, '[data-testid="ask-einstieg-beispiele"]');
    expect(c.querySelector(BEISPIELE)?.hasAttribute("hidden")).toBe(true);
  });

  it("M3 · ein Vorschlag aus dem validierten Bestand ist nicht als fiktiv gekennzeichnet", async () => {
    koListMock.mockResolvedValue([
      {
        id: "ko-ventil",
        title: "Druck am Ventil prüfen",
        statement: "Vor dem Anfahren den Druck am Ventil V7 prüfen.",
        conditions: [],
        measures: [],
        type: "best_practice",
        category: "Anlage",
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
    ]);
    const c = await montiere();
    await klicke(c, '[data-testid="ask-einstieg-beispiele"]');
    const chips = [...c.querySelectorAll<HTMLElement>('[data-testid="ask-beispiel"]')];
    const ausBestand = chips.filter((ch) => ch.textContent?.includes("Druck am Ventil prüfen"));
    expect(ausBestand).toHaveLength(1);
    expect(ausBestand[0]?.getAttribute("data-fiktiv")).toBe("0");
    expect(ausBestand[0]?.querySelector('[data-testid="ask-beispiel-fiktiv"]')).toBeNull();
    // Die bewusste Lücken-Frage bleibt ein festes, fiktives Beispiel.
    expect(chips.some((ch) => ch.getAttribute("data-fiktiv") === "1")).toBe(true);
  });

  it("M4 · optionale Angaben als Gruppe; Auf-/Zuklappen erhält Frage und Kontext", async () => {
    const c = await montiere();
    const gruppe = c.querySelector('[data-testid="ask-optionale-angaben"]');
    expect(gruppe?.tagName).toBe("FIELDSET");
    expect(gruppe?.querySelector("legend")?.textContent).toBe(
      i18n.t("fragenEinstieg.optionalTitel"),
    );
    expect(gruppe?.querySelector('[data-testid="ask-fragekontext"]')).toBeTruthy();
    expect(gruppe?.querySelector('[data-testid="bedingungswechsel"]')).toBeTruthy();
    // Zugeklappt: kein Eingabefeld in der Gruppe — die erste Frage wird nicht überladen.
    expect(gruppe?.querySelector("input")).toBeNull();

    await tippe(c, FELD, "Wie prüfe ich das Ventil V7 vor dem Anfahren?");
    await klicke(c, '[data-testid="ask-fragekontext-umschalten"]');
    await tippe(c, '[data-testid="ask-fragekontext-werk"]', "Werk Nord");
    await klicke(c, '[data-testid="ask-fragekontext-umschalten"]');
    await klicke(c, '[data-testid="bedingungswechsel-umschalten"]');
    await klicke(c, '[data-testid="bedingungswechsel-umschalten"]');

    expect(feldWert(c)).toBe("Wie prüfe ich das Ventil V7 vor dem Anfahren?");
    // Der gesetzte Kontext bleibt zugeklappt sichtbar — nichts fachlich Nötiges verschwindet.
    expect(c.querySelector('[data-testid="ask-fragekontext-zeile"]')?.textContent).toContain(
      "Werk Nord",
    );
    expect(askMock).not.toHaveBeenCalled();
  });

  it("M5 · nach der Antwort ist der Einstieg weg, die Frage steht weiter im Feld", async () => {
    const c = await montiere();
    await tippe(c, FELD, "Wie prüfe ich das Ventil V7?");
    await absenden(c);
    expect(askMock).toHaveBeenCalledTimes(1);
    expect(c.textContent).toContain("Den Druck vor dem Anfahren am Ventil V7 prüfen");
    expect(c.querySelector(EINSTIEG)).toBeNull();
    expect(feldWert(c)).toBe("Wie prüfe ich das Ventil V7?");
  });

  it("M6 · Fehler: keine Antwort, Frage bleibt, Einstieg kehrt nicht zurück", async () => {
    askMock.mockRejectedValueOnce(new Error("Netzfehler"));
    const c = await montiere();
    await tippe(c, FELD, "Was gilt bei Überdruck?");
    await absenden(c);
    expect(c.querySelector('[data-testid="ask-error"]')).toBeTruthy();
    expect(c.querySelector('[data-testid="ask-answer"]')).toBeNull();
    expect(feldWert(c)).toBe("Was gilt bei Überdruck?");
    expect(c.querySelector(EINSTIEG)).toBeNull();
  });

  it("M7 · Ansichtswechsel: Frage, „Ich frage für“ und Szenario sind beim Zurückkommen wieder da", async () => {
    const c1 = await montiere();
    await tippe(c1, FELD, "Wie prüfe ich das Ventil V7?");
    await klicke(c1, '[data-testid="ask-fragekontext-umschalten"]');
    await tippe(c1, '[data-testid="ask-fragekontext-werk"]', "Werk Nord");
    await tippe(c1, '[data-testid="ask-fragekontext-rolle"]', "Instandhaltung");
    await klicke(c1, '[data-testid="bedingungswechsel-umschalten"]');
    await tippe(c1, '[data-testid="bedingungswechsel-bisher"]', "5083-H111");
    await tippe(c1, '[data-testid="bedingungswechsel-neu"]', "6082-T6");
    await tippe(c1, '[data-testid="bedingungswechsel-thema"]', "Naht");
    // Andere Ansicht: die Seite wird abgebaut (wie Wegnavigieren, Breitenwechsel, Neuladen).
    abbauen?.();
    abbauen = null;

    const c2 = await montiere();
    expect(feldWert(c2)).toBe("Wie prüfe ich das Ventil V7?");
    // Zugeklappt sichtbar, ohne Eingabefeld vor dem Fragefeld.
    expect(c2.querySelector("input")).toBe(c2.querySelector(FELD));
    expect(c2.querySelector('[data-testid="ask-fragekontext-zeile"]')?.textContent).toBe(
      "Werk Nord · Instandhaltung",
    );
    expect(c2.querySelector('[data-testid="bedingungswechsel-zeile"]')?.textContent).toBe(
      "5083-H111 → 6082-T6 · Naht",
    );
    // Aufgeklappt stehen dieselben Werte in den Feldern — weiterbearbeitbar.
    await klicke(c2, '[data-testid="ask-fragekontext-umschalten"]');
    const wert = (s: string): string => c2.querySelector<HTMLInputElement>(s)?.value ?? "";
    expect(wert('[data-testid="ask-fragekontext-werk"]')).toBe("Werk Nord");
    expect(wert('[data-testid="ask-fragekontext-rolle"]')).toBe("Instandhaltung");
    await klicke(c2, '[data-testid="bedingungswechsel-umschalten"]');
    expect(wert('[data-testid="bedingungswechsel-bisher"]')).toBe("5083-H111");
    expect(wert('[data-testid="bedingungswechsel-neu"]')).toBe("6082-T6");
    expect(wert('[data-testid="bedingungswechsel-thema"]')).toBe("Naht");
    // Wiederherstellen fragt nichts.
    expect(askMock).not.toHaveBeenCalled();
  });

  it("M8 · die aktuelle Auswahl bleibt getrennt vom Kontext der stehenden Antwort", async () => {
    const c1 = await montiere();
    await klicke(c1, '[data-testid="ask-fragekontext-umschalten"]');
    await tippe(c1, '[data-testid="ask-fragekontext-werk"]', "Werk Nord");
    await tippe(c1, FELD, "Wie prüfe ich das Ventil V7?");
    await absenden(c1);
    expect(askMock).toHaveBeenCalledTimes(1);
    // Nach der Antwort eine andere Auswahl beginnen.
    await tippe(c1, '[data-testid="ask-fragekontext-werk"]', "Werk Süd");
    const stand = arbeitsstandLesen(localStorage, "u1");
    expect(stand?.antwort?.fragekontext).toEqual({ werk: "Werk Nord" });
    expect(stand?.fragekontext).toEqual({ werk: "Werk Süd" });
    abbauen?.();
    abbauen = null;

    const c2 = await montiere();
    expect(c2.querySelector('[data-testid="ask-fragekontext-zeile"]')?.textContent).toBe(
      "Werk Süd",
    );
    expect(arbeitsstandLesen(localStorage, "u1")?.antwort?.fragekontext).toEqual({
      werk: "Werk Nord",
    });
    expect(askMock).toHaveBeenCalledTimes(1);
  });

  it("M9 · geleerte Angaben werden nicht wiederhergestellt", async () => {
    const c1 = await montiere();
    await klicke(c1, '[data-testid="ask-fragekontext-umschalten"]');
    await tippe(c1, '[data-testid="ask-fragekontext-werk"]', "Werk Nord");
    await tippe(c1, '[data-testid="ask-fragekontext-werk"]', "");
    expect(arbeitsstandLesen(localStorage, "u1")).toBeNull();
    abbauen?.();
    abbauen = null;
    const c2 = await montiere();
    expect(c2.querySelector('[data-testid="ask-fragekontext-zeile"]')?.textContent).toBe(
      i18n.t("geltung.frage.leer"),
    );
    expect(c2.querySelector('[data-testid="bedingungswechsel-zeile"]')).toBeNull();
  });
});
