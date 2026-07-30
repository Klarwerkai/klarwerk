// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega38 BLOCK A — DIE ANTWORT MUSS ANKOMMEN.
// ================================================================================================
//
// Pedi hat es live gemessen: der Antwortblock beginnt bei Scrollposition 674 px in einem 678 px
// hohen Sichtbereich. Nach dem Klick auf „Fragen" passiert am Bildschirm NICHTS — der Knopf wird
// grau, sonst nichts. Pedi hat selbst zweimal geklickt, weil er dachte, der erste Klick sei
// verloren gegangen. Am Freitag sitzt dort eine Testerin ohne jedes Vorwissen.
//
// Bis mega37 hatte `Ask.tsx` weder einen Ergebnis-Ref noch `scrollIntoView`, `scrollTo` oder einen
// Fokuswechsel; `onSuccess` setzte nur Zustand (Ask.tsx:142-151). Am künftigen Ergebnisort stand
// kein Ladeblock — `ask.isPending` graute nur Absenden und Beispielchips aus. Und einen Fehlerfall
// zeigte die Seite ÜBERHAUPT NICHT an: eine abgewiesene Mutation hinterließ eine völlig
// unveränderte Seite.
//
// Dieser Test fährt die ECHTE Ask-Seite und pinnt die drei Zusagen:
//   A1  ein sichtbarer Ladezustand AN DER STELLE, an der die Antwort erscheinen wird
//   A2  nach Antwort UND nach Wissenslücke: kontrolliertes Scrollen/Fokussieren, Kopf oben
//   A3  dasselbe im Fehlerfall — eine Meldung unterhalb des Randes ist derselbe Mangel
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Der Ask-Aufruf wird von aussen gesteuert: erst bleibt er offen (Ladezustand beobachtbar), dann
// wird er bewusst aufgeloest oder abgewiesen.
const steuer = vi.hoisted(() => ({
  aufloesen: null as null | ((wert: unknown) => void),
  abweisen: null as null | ((fehler: unknown) => void),
}));

// AUFTRAG-mega71 Block E: Ask stellt die Rollenfrage jetzt am RoleLink-Tor (useRole). Diese Datei
// prüft NICHT die Rollen-Lage (das tun der mega70/71-Rohlink-Sammler und mega51-mounted am Tor
// selbst) — sie mountet die Fläche wie mega69-ask-kostenhinweis mit fester Expertinnen-Rolle.
vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
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
      ask: vi.fn(
        () =>
          new Promise((resolve, reject) => {
            steuer.aufloesen = resolve;
            steuer.abweisen = reject;
          }),
      ),
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
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom kennt `scrollIntoView` nicht — hier ist es der MESSPUNKT, nicht nur ein Platzhalter.
const gescrollt: { ziel: Element; optionen: unknown }[] = [];
Element.prototype.scrollIntoView = function (this: Element, optionen?: unknown) {
  gescrollt.push({ ziel: this, optionen });
};

const ANTWORT = {
  result: {
    answered: true,
    answer: "Ventil V4 wird jährlich geprüft.",
    knowledgeClass: "gesichert",
    trust: 90,
    sources: [],
    steps: [],
    demo: false,
    captionSources: [],
  },
  gap: null,
  receipt: "r",
};

const LUECKE = {
  result: {
    answered: false,
    answer: null,
    knowledgeClass: "unbekannt",
    trust: 0,
    sources: [],
    steps: [],
    demo: false,
    captionSources: [],
  },
  gap: { id: "g1" },
  receipt: "r",
};

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mountAsk(): Promise<{ container: HTMLElement; unmount: () => void }> {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
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
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

// Frage eintippen und absenden — derselbe Weg, den ein Mensch nimmt (Formular, nicht mutate()).
async function frageAbsenden(container: HTMLElement, frage: string): Promise<void> {
  const feld = container.querySelector("input");
  expect(feld, "Eingabefeld nicht gefunden").toBeTruthy();
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  await act(async () => {
    setzer.call(feld, frage);
    feld?.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  const form = container.querySelector("form");
  await act(async () => {
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await flush();
  });
}

beforeEach(() => {
  gescrollt.length = 0;
  steuer.aufloesen = null;
  steuer.abweisen = null;
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("mega38 A · die Antwort kommt an, wo der Leser hinsieht", () => {
  it("A1 · während der Ask läuft, steht ein Ladeblock AN DER ERGEBNISSTELLE — nicht nur ein grauer Knopf", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountAsk();

    // Vorher gibt es dort nichts — sonst wäre die Zusage unten auch von einem Dauerblock erfüllt.
    expect(container.querySelector('[data-testid="ask-pending"]')).toBeNull();

    await frageAbsenden(container, "Wie oft wird Ventil V4 geprüft?");

    const laden = container.querySelector('[data-testid="ask-pending"]');
    expect(laden, "kein Ladeblock an der Ergebnisstelle").not.toBeNull();
    // Er trägt Höhe: die Seite verändert sich sichtbar, statt nur den Knopf auszugrauen.
    expect(laden?.className ?? "").toContain("min-h-");
    // Und er sitzt INNERHALB der Ergebnisfläche, nicht am Knopf.
    const anker = container.querySelector('[data-testid="ask-result-anchor"]');
    expect(anker, "keine Ergebnisfläche mit Anker").not.toBeNull();
    expect(anker?.contains(laden ?? null)).toBe(true);

    unmount();
  });

  it("A2 · nach der Antwort wird auf den KOPF der Ergebnisfläche gescrollt und fokussiert", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountAsk();
    await frageAbsenden(container, "Wie oft wird Ventil V4 geprüft?");

    gescrollt.length = 0;
    await act(async () => {
      steuer.aufloesen?.(ANTWORT);
      await flush();
    });

    const anker = container.querySelector('[data-testid="ask-result-anchor"]');
    expect(anker, "keine Ergebnisfläche mit Anker").not.toBeNull();
    const treffer = gescrollt.filter((g) => g.ziel === anker);
    expect(treffer.length, "nach onSuccess wurde nicht gescrollt").toBeGreaterThan(0);
    // Kein Sprung mitten in den Text: der Kopf der Ergebnisfläche steht oben.
    expect(treffer.some((g) => (g.optionen as { block?: string })?.block === "start")).toBe(true);
    // Und der Fokus steht dort, damit Tastatur und Screenreader mitkommen.
    expect(document.activeElement).toBe(anker);
    // Die Antwort ist da, der Ladeblock weg.
    expect(container.querySelector('[data-testid="ask-pending"]')).toBeNull();
    expect(container.textContent ?? "").toContain("Ventil V4 wird jährlich geprüft.");

    unmount();
  });

  it("A2 · dasselbe gilt für die WISSENSLÜCKE — sie ist ein Ergebnis, kein Nicht-Ereignis", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountAsk();
    await frageAbsenden(container, "Gibt es eine Regel für Ventil Z?");

    gescrollt.length = 0;
    await act(async () => {
      steuer.aufloesen?.(LUECKE);
      await flush();
    });

    const anker = container.querySelector('[data-testid="ask-result-anchor"]');
    expect(anker).not.toBeNull();
    expect(
      gescrollt.filter((g) => g.ziel === anker).length,
      "nach einer Wissenslücke wurde nicht gescrollt",
    ).toBeGreaterThan(0);
    expect(document.activeElement).toBe(anker);
    expect(container.textContent ?? "").toContain(i18n.t("ask.gapBadge"));

    unmount();
  });

  it("A3 · der Fehlerfall zeigt überhaupt eine Meldung — und sie steht nicht unterhalb des Randes", async () => {
    await i18n.changeLanguage("de");
    const { container, unmount } = await mountAsk();
    await frageAbsenden(container, "Wie oft wird Ventil V4 geprüft?");

    gescrollt.length = 0;
    await act(async () => {
      steuer.abweisen?.(new Error("network"));
      await flush();
    });

    const meldung = container.querySelector('[data-testid="ask-error"]');
    expect(meldung, "der Fehlerfall hinterlässt eine völlig unveränderte Seite").not.toBeNull();
    expect(container.textContent ?? "").toContain(i18n.t("ask.error.title"));

    const anker = container.querySelector('[data-testid="ask-result-anchor"]');
    expect(anker).not.toBeNull();
    expect(
      gescrollt.filter((g) => g.ziel === anker).length,
      "zur Fehlermeldung wurde nicht gescrollt",
    ).toBeGreaterThan(0);
    expect(document.activeElement).toBe(anker);
    // Und der Ladeblock ist weg — kein ewiger Spinner über einer toten Anfrage.
    expect(container.querySelector('[data-testid="ask-pending"]')).toBeNull();

    unmount();
  });
});
