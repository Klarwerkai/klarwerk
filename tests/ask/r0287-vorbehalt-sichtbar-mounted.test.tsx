// @vitest-environment jsdom
// ================================================================================================
// R-0287 / R-0286 — DIE EIGENTLICHE WARNUNG BLEIBT VOLLSTÄNDIG UND UNÜBERSEHBAR.
// ================================================================================================
//
// Seit JOB 3064 (H5) stehen die Vorbehaltskästen einer Antwort nur im Blatt „…" → „Mehr".
// `ask-check-caveat-mounted.test.tsx` öffnet das Blatt und belegt dort „vollständig". Dieser Test
// belegt die andere Hälfte, OHNE den Griff zu betätigen: direkt unter der Antwort steht ein
// sichtbarer Vorbehaltsknopf, er öffnet genau dieses Blatt, und der Vorbehalt steht danach GENAU
// EINMAL auf der Seite (R-0287: „Derselbe Vorbehalt steht nicht mehr dreifach").
// Aufbau wie `ask-check-caveat-mounted.test.tsx` (echte `Ask`-Seite, gemockte Endpunkte).
import { afterEach, describe, expect, it, vi } from "vitest";

const bestand = vi.hoisted(() => ({
  kos: [] as unknown[],
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => bestand.kos) },
    conflicts: { list: vi.fn(async () => []) },
    directory: { list: vi.fn(async () => []) },
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
          answer: "Ventil V4 wird jährlich geprüft.",
          knowledgeClass: "gesichert",
          trust: 90,
          sources: ["k1"],
          citedSources: ["k1"],
          steps: [],
          demo: false,
          captionSources: [],
        },
        gap: null,
        receipt: "r",
      })),
      helpful: vi.fn(),
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
Element.prototype.scrollIntoView = () => {};

const PROVEN = {
  available: 4,
  selected: 4,
  alreadyOpen: 0,
  attempted: 4,
  completed: 4,
  skipped: 0,
  capped: false,
  aborted: false,
};
const CAPPED = {
  ...PROVEN,
  available: 12479,
  selected: 20,
  attempted: 20,
  completed: 20,
  capped: true,
};

function ko(aiCheck: unknown) {
  return {
    id: "k1",
    title: "Ventilprüfung",
    statement: "Ventil V4 wird jährlich geprüft.",
    type: "best_practice",
    category: "Betrieb",
    status: "validiert",
    trust: 90,
    author: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    aiCheck,
  };
}

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
          { initialEntries: ["/fragen?q=Ventil&ask=1"] },
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

function anzahl(heuhaufen: string, nadel: string): number {
  if (nadel.length === 0) {
    throw new Error("leerer Suchtext — die Zählung wäre bedeutungslos");
  }
  return heuhaufen.split(nadel).length - 1;
}

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("R-0287 · der Vorbehalt ist ohne Griff sichtbar und steht trotzdem nur einmal", () => {
  it("gedeckelte Quelle: der Vorbehaltsknopf steht in der Antwortkarte, hinter der Antwort", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [ko({ status: "done", coverage: CAPPED })];
    const { container, unmount } = await mountAsk();

    // Das Blatt ist zu — gemessen wird, was der Leser OHNE Griff sieht.
    expect(document.querySelector('[data-testid="ask-mehr"]')).toBeNull();
    const karte = container.querySelector<HTMLElement>('[data-testid="ask-answer"]');
    expect(karte, "die Antwortkarte wurde nicht montiert").not.toBeNull();
    const knopf = karte?.querySelector<HTMLButtonElement>('[data-testid="ask-vorbehalt"]');
    expect(knopf, "kein sichtbarer Vorbehalt unter der Antwort").not.toBeNull();
    expect(knopf?.tagName).toBe("BUTTON");
    // Gedeckelter Lauf: Prüfvorbehalt UND Review-Hinweis — zwei Vorbehalte, der Satz zählt sie.
    expect(knopf?.textContent).toBe(i18n.t("antwortvorbehalt.hinweis", { count: 2 }));
    // R-0286: die Antwort bleibt das ERSTE, der Vorbehalt folgt ihr.
    const kinder = [...(karte as HTMLElement).children];
    expect(kinder[0]?.className ?? "").toContain("ask-answer-body");
    expect(kinder.indexOf(knopf as HTMLElement)).toBeGreaterThan(0);
    unmount();
  });

  it("der Knopf öffnet das Blatt mit dem vollständigen Vorbehalt — und der steht genau einmal", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [ko({ status: "done", coverage: CAPPED })];
    const { container, unmount } = await mountAsk();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="ask-vorbehalt"]')?.click();
      await flush();
    });
    const blatt = document.querySelector<HTMLElement>('[data-testid="ask-mehr"]');
    expect(blatt, "der Vorbehaltsknopf öffnet kein Blatt").not.toBeNull();
    expect(blatt?.querySelector('[data-testid="ask-check-caveat"]')).not.toBeNull();
    const text = document.body.textContent ?? "";
    expect(anzahl(text, i18n.t("ask.checkCaveat.title"))).toBe(1);
    expect(anzahl(text, i18n.t("ask.reviewGuard.unverifiedLabel"))).toBe(1);
    expect(text).toContain("1 von 1");
    unmount();
  });

  it("GEGENPROBE: belegt vollständiger Lauf — kein Vorbehalt, kein Knopf", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [ko({ status: "done", coverage: PROVEN })];
    const { container, unmount } = await mountAsk();

    expect(container.querySelector('[data-testid="ask-answer"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ask-vorbehalt"]')).toBeNull();
    unmount();
  });

  it("EN: derselbe Knopf in englischer Oberfläche, kein deutscher Rückfall", async () => {
    await i18n.changeLanguage("en");
    bestand.kos = [ko({ status: "done", coverage: CAPPED })];
    const { container, unmount } = await mountAsk();

    const knopf = container.querySelector('[data-testid="ask-vorbehalt"]');
    expect(knopf?.textContent).toBe("2 caveats on this answer — read before using it");
    unmount();
    await i18n.changeLanguage("de");
  });
});
