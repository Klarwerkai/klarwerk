// @vitest-environment jsdom
// ================================================================================================
// PEDI 28.09.2026 · ERGÄNZUNG 1 — AUF DER ECHTEN FRAGENSEITE WEITERARBEITEN.
// ================================================================================================
//
// Die echte `Ask`-Seite, der echte Browserspeicher (jsdom), die echte Sitzungsabfrage
// `["auth", "me"]` im Query-Cache. Gemockt sind nur die Endpunkte — und genau darüber wird
// gezählt, dass beim Wiederkommen KEINE neue Modellanfrage hinausgeht.
//
// Was eine Wiederkehr ist, wird hier über das gemessen, was die Seite wirklich erlebt:
//   · Tutorial öffnen, Breite wechseln, weg- und zurücknavigieren: die Seite wird ABGEBAUT und neu
//     montiert (`AppShell` hat getrennte Rückgaben für schmal und breit) — derselbe Query-Cache.
//   · Neu laden: ein FRISCHER Query-Cache, nur der Browserspeicher bleibt.
//   · Ab- und wieder anmelden: der Cache wird geleert (`AuthContext` → `queryClient.clear()`),
//     danach meldet `/auth/me` dieselbe oder eine andere Kennung.
//
//   W1  Entwurf übersteht Abbau und Neuladen; der Hinweis sagt, wo es weitergeht.
//   W2  Die Antwort kommt mit ihren Quellen wieder — ohne zweite Modellanfrage, ohne Bildlauf.
//   W3  Nach erneuter Anmeldung nimmt DERSELBE Nutzer auf; ein ANDERER sieht nichts.
//   W4  Verworfen bleibt verworfen — per Knopf und per geleertem Feld.
//   W5  Wechselt das Konto bei stehender Seite, landet nichts unter der fremden Kennung.
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

let gescrollt = 0;
Element.prototype.scrollIntoView = () => {
  gescrollt += 1;
};

const FRAGE = "Wie oft wird Ventil V4 geprüft?";

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function neuerCache(konto: string | null): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  anmelden(client, konto);
  return client;
}

function anmelden(client: QueryClient, konto: string | null): void {
  if (konto !== null) {
    client.setQueryData(["auth", "me"], { id: konto, role: "experte" });
  }
}

interface Flaeche {
  container: HTMLElement;
  abbauen: () => void;
}

async function oeffnen(client: QueryClient, adresse = "/fragen"): Promise<Flaeche> {
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
          { initialEntries: [adresse] },
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

function feld(f: Flaeche): HTMLInputElement {
  const el = f.container.querySelector<HTMLInputElement>("input");
  expect(el, "Eingabefeld nicht gefunden").toBeTruthy();
  return el as HTMLInputElement;
}

async function tippen(f: Flaeche, text: string): Promise<void> {
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setzer.call(feld(f), text);
    feld(f).dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

async function absenden(f: Flaeche): Promise<void> {
  await act(async () => {
    f.container
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });
}

function hinweis(f: Flaeche): HTMLElement | null {
  return f.container.querySelector<HTMLElement>('[data-testid="ask-wiederaufnahme"]');
}

function antwortkarte(f: Flaeche): HTMLElement | null {
  return f.container.querySelector<HTMLElement>('[data-testid="ask-answer"]');
}

beforeEach(async () => {
  localStorage.clear();
  gescrollt = 0;
  await i18n.changeLanguage("de");
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("Ergänzung 1 · auf der Fragenseite weiterarbeiten", () => {
  it("W1 · der Entwurf übersteht Abbau (Tutorial/Breite/Navigation) und Neuladen", async () => {
    const cache = neuerCache("u1");
    const erst = await oeffnen(cache);
    expect(hinweis(erst), "beim ersten Besuch gibt es nichts aufzunehmen").toBeNull();
    await tippen(erst, "Wie oft wird Pumpe P2");
    erst.abbauen();

    // Derselbe Cache: die Seite wurde nur neu montiert.
    const wieder = await oeffnen(cache);
    expect(feld(wieder).value).toBe("Wie oft wird Pumpe P2");
    expect(hinweis(wieder)?.textContent).toContain("noch nicht gesendeter Entwurf");
    wieder.abbauen();

    // Neu laden: frischer Cache, nur der Browserspeicher bleibt.
    const neu = await oeffnen(neuerCache("u1"));
    expect(feld(neu).value).toBe("Wie oft wird Pumpe P2");
    expect(hinweis(neu)).not.toBeNull();
    expect(endpoints.ask.ask).not.toHaveBeenCalled();
    neu.abbauen();
  });

  it("W2 · die Antwort kommt mit ihren Quellen zurück — ohne neue Modellanfrage, ohne Bildlauf", async () => {
    const erst = await oeffnen(neuerCache("u1"));
    await tippen(erst, FRAGE);
    await absenden(erst);
    expect(endpoints.ask.ask).toHaveBeenCalledTimes(1);
    expect(antwortkarte(erst)?.textContent).toContain("Ventil V4 wird jährlich geprüft");
    erst.abbauen();

    gescrollt = 0;
    const neu = await oeffnen(neuerCache("u1"));
    const karte = antwortkarte(neu);
    expect(karte, "die Antwortkarte steht wieder da").not.toBeNull();
    expect(karte?.textContent).toContain("Ventil V4 wird jährlich geprüft");
    // Die Quelle ist dieselbe — als lesbarer Titel am Quellen-Chip.
    const chips = [
      ...neu.container.querySelectorAll<HTMLElement>('[data-testid="ask-quellen-chip"]'),
    ];
    expect(chips.map((c) => c.textContent).join(" ")).toContain("Wartungsplan Ventil V4");
    expect(neu.container.querySelector('[data-testid="ask-fragezeile"]')?.textContent).toBe(FRAGE);
    // Keine zweite Modellanfrage, und die Seite springt nicht von selbst zur Antwort.
    expect(endpoints.ask.ask).toHaveBeenCalledTimes(1);
    expect(gescrollt).toBe(0);
    // Der Hinweis nennt die Antwort als NICHT neu erzeugt — und keinen Entwurf, denn im Feld
    // steht die beantwortete Frage.
    const text = hinweis(neu)?.textContent ?? "";
    expect(text).toContain("zuletzt angezeigte Antwort");
    expect(text).toContain("nicht neu erzeugt");
    expect(text).not.toContain("Entwurf steht wieder");
    expect(neu.container.querySelector('[data-testid="ask-entwurf-verwerfen"]')).toBeNull();

    // Eine NEUE Frage ersetzt den Stand: der Hinweis geht, die neue Antwort zählt.
    await tippen(neu, "Wer prüft Ventil V4?");
    await absenden(neu);
    expect(hinweis(neu)).toBeNull();
    neu.abbauen();
    const danach = await oeffnen(neuerCache("u1"));
    expect(danach.container.querySelector('[data-testid="ask-fragezeile"]')?.textContent).toBe(
      "Wer prüft Ventil V4?",
    );
    danach.abbauen();
  });

  it("W3 · nach erneuter Anmeldung nimmt derselbe Nutzer auf — ein anderer sieht nichts", async () => {
    const cache = neuerCache("u1");
    const erst = await oeffnen(cache);
    await tippen(erst, FRAGE);
    await absenden(erst);
    await tippen(erst, "Und wie oft Pumpe P2");
    erst.abbauen();

    // Abmelden: `AuthContext` leert den Cache.
    cache.clear();

    // Ein anderes Konto im selben Browser.
    anmelden(cache, "u2");
    const fremd = await oeffnen(cache);
    expect(feld(fremd).value).toBe("");
    expect(antwortkarte(fremd)).toBeNull();
    expect(hinweis(fremd)).toBeNull();
    expect(fremd.container.textContent).not.toContain("Ventil V4 wird jährlich geprüft");
    fremd.abbauen();
    cache.clear();

    // Wieder u1 — Entwurf UND Antwort sind da.
    anmelden(cache, "u1");
    const zurueck = await oeffnen(cache);
    expect(feld(zurueck).value).toBe("Und wie oft Pumpe P2");
    expect(antwortkarte(zurueck)?.textContent).toContain("Ventil V4 wird jährlich geprüft");
    expect(hinweis(zurueck)?.textContent).toContain("Entwurf");
    expect(endpoints.ask.ask).toHaveBeenCalledTimes(1);
    zurueck.abbauen();

    // Ohne bestätigtes Konto wird weder gelesen noch geschrieben.
    cache.clear();
    const niemand = await oeffnen(cache);
    expect(feld(niemand).value).toBe("");
    await tippen(niemand, "anonym");
    niemand.abbauen();
    expect(
      Object.keys(localStorage).some((k) => (localStorage.getItem(k) ?? "").includes("anonym")),
    ).toBe(false);
  });

  it("W4 · verworfen bleibt verworfen — per Knopf und per geleertem Feld", async () => {
    const erst = await oeffnen(neuerCache("u1"));
    await tippen(erst, "Halbe Frage");
    erst.abbauen();

    const wieder = await oeffnen(neuerCache("u1"));
    const knopf = wieder.container.querySelector<HTMLButtonElement>(
      '[data-testid="ask-entwurf-verwerfen"]',
    );
    expect(knopf?.textContent).toBe("Entwurf verwerfen");
    await act(async () => {
      knopf?.click();
      await flush();
    });
    expect(feld(wieder).value).toBe("");
    expect(hinweis(wieder)).toBeNull();
    wieder.abbauen();

    const danach = await oeffnen(neuerCache("u1"));
    expect(feld(danach).value).toBe("");
    expect(hinweis(danach)).toBeNull();

    // Ein von Hand geleertes Feld ist ebenso verworfen.
    await tippen(danach, "Noch eine halbe Frage");
    await tippen(danach, "");
    danach.abbauen();
    const zuletzt = await oeffnen(neuerCache("u1"));
    expect(feld(zuletzt).value).toBe("");
    expect(hinweis(zuletzt)).toBeNull();
    zuletzt.abbauen();
  });

  it("W5 · wechselt das Konto bei stehender Seite, landet nichts unter der fremden Kennung", async () => {
    const cache = neuerCache("u1");
    const f = await oeffnen(cache);
    await tippen(f, "Entwurf von u1");
    await act(async () => {
      cache.setQueryData(["auth", "me"], { id: "u2", role: "experte" });
      await flush();
    });
    expect(feld(f).value, "die Fläche zeigt nicht mehr den Stand von u1").toBe("");
    f.abbauen();

    const alsU2 = await oeffnen(neuerCache("u2"));
    expect(feld(alsU2).value).toBe("");
    alsU2.abbauen();
    const alsU1 = await oeffnen(neuerCache("u1"));
    expect(feld(alsU1).value).toBe("Entwurf von u1");
    alsU1.abbauen();
  });

  it("eine Startfrage aus der Adresse hat Vorrang vor dem Entwurf", async () => {
    const erst = await oeffnen(neuerCache("u1"));
    await tippen(erst, "Halbe Frage");
    erst.abbauen();
    const mitAdresse = await oeffnen(neuerCache("u1"), "/fragen?q=Frage%20aus%20der%20Suche");
    expect(feld(mitAdresse).value).toBe("Frage aus der Suche");
    expect(hinweis(mitAdresse)).toBeNull();
    mitAdresse.abbauen();
  });
});
