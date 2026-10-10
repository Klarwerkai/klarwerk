// @vitest-environment jsdom
// ================================================================================================
// R-0287 / R-0286 — DIE EIGENTLICHE WARNUNG BLEIBT VOLLSTÄNDIG UND UNÜBERSEHBAR.
// ================================================================================================
//
// Seit JOB 3064 (H5) standen die Vorbehaltskästen einer Antwort nur im Blatt „…" → „Mehr". Ein
// Zählknopf (Nacharbeit 1) reichte nicht: Ben, Nacharbeit 2 — „die Warnung selbst" muss sichtbar
// sein. Dieser Test misst deshalb OHNE jede Interaktion den WARNINHALT in der Antwortkarte direkt
// hinter Antwort und KI-Kennzeichnung, und dass jeder Vorbehalt GENAU EINMAL auf der Seite steht
// (R-0287: „Derselbe Vorbehalt steht nicht mehr dreifach") — auch nach dem Öffnen von „Mehr".
// Dazu R-0286: das Fragefeld steht vor dem Ergebnis, ohne sichtbare Umstellung.
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
          // R-0604: eine Modellantwort trägt die Servermarke — erst sie trägt den KI-Satz.
          aiGenerated: {
            aiGenerated: true,
            task: "answer",
            mode: "model",
            at: "2026-10-08T00:00:00.000Z",
          },
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

/** Die Warnkästen, wie der Leser sie OHNE jede Interaktion bekommt: Text der Antwortkarte. */
function warnInhalt(container: HTMLElement): { karte: HTMLElement; block: HTMLElement | null } {
  const karte = container.querySelector<HTMLElement>('[data-testid="ask-answer"]');
  expect(karte, "die Antwortkarte wurde nicht montiert").not.toBeNull();
  return {
    karte: karte as HTMLElement,
    block: (karte as HTMLElement).querySelector<HTMLElement>('[data-testid="ask-warnungen"]'),
  };
}

describe("R-0287 · die Warnung selbst steht vollständig hinter der Antwort — ohne Griff, genau einmal", () => {
  it("gedeckelte Quelle: Prüfvorbehalt und Review-Hinweis stehen MIT WORTLAUT in der Karte, das Blatt ist zu", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [ko({ status: "done", coverage: CAPPED })];
    const { container, unmount } = await mountAsk();

    // KEINE Interaktion: das Blatt „Mehr" ist nicht im Baum.
    expect(document.querySelector('[data-testid="ask-mehr"]')).toBeNull();
    const { karte, block } = warnInhalt(container);
    expect(block, "kein Warnblock in der Antwortkarte").not.toBeNull();
    const text = (block as HTMLElement).textContent ?? "";
    // Der Prüfvorbehalt VOLLSTÄNDIG: Titel UND sein Bezug (1 von 1, Ursache) …
    expect(block?.querySelector('[data-testid="ask-check-caveat"]')).not.toBeNull();
    expect(text).toContain(i18n.t("ask.checkCaveat.title"));
    expect(text).toContain("1 von 1");
    expect(text).toContain("nicht vollständig gelaufen");
    // … und der Review-Hinweis mit Etikett UND Erläuterung.
    expect(text).toContain(i18n.t("ask.reviewGuard.unverifiedLabel"));
    expect(text).toContain(i18n.t("ask.reviewGuard.unverifiedHint"));
    // Kein Ersatz durch einen Zählknopf: der Inhalt ist Text, nicht nur eine Beschriftung.
    expect(block?.querySelector("button")).toBeNull();
    // R-0286: Antwort → KI-Kennzeichnung → Warnung → Quellen.
    const kinder = [...karte.children];
    const idx = (el: Element | null): number => {
      let k: Element | null = el;
      while (k && k.parentElement !== karte) k = k.parentElement;
      return k ? kinder.indexOf(k) : -1;
    };
    expect(kinder[0]?.className ?? "").toContain("ask-answer-body");
    expect(idx(karte.querySelector('[data-testid="ai-generated-notice"]'))).toBe(1);
    expect(idx(block)).toBe(2);
    const chips = karte.querySelector('[data-testid="ask-quellen-chips"]');
    if (chips) {
      expect(idx(chips)).toBeGreaterThan(idx(block));
    }
    unmount();
  });

  it("jeder Vorbehalt steht GENAU EINMAL — auch wenn das Blatt „Mehr“ danach geöffnet wird", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [ko({ status: "done", coverage: CAPPED })];
    const { container, unmount } = await mountAsk();

    const vorher = document.body.textContent ?? "";
    expect(anzahl(vorher, i18n.t("ask.checkCaveat.title"))).toBe(1);
    expect(anzahl(vorher, i18n.t("ask.reviewGuard.unverifiedLabel"))).toBe(1);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="ask-menu"]')?.click();
      await flush();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="ask-menu-punkt-mehr"]')?.click();
      await flush();
    });
    const blatt = document.querySelector<HTMLElement>('[data-testid="ask-mehr"]');
    expect(blatt, "„Mehr“ öffnet kein Blatt").not.toBeNull();
    // Das Blatt wiederholt keinen Vorbehalt — er steht schon an der Antwort.
    expect(blatt?.querySelector('[data-testid="ask-check-caveat"]')).toBeNull();
    const nachher = document.body.textContent ?? "";
    expect(anzahl(nachher, i18n.t("ask.checkCaveat.title"))).toBe(1);
    expect(anzahl(nachher, i18n.t("ask.reviewGuard.unverifiedLabel"))).toBe(1);
    unmount();
  });

  it("GEGENPROBE: belegt vollständiger Lauf — kein Warnblock, keine erfundene Warnung", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [ko({ status: "done", coverage: PROVEN })];
    const { container, unmount } = await mountAsk();

    const { block } = warnInhalt(container);
    expect(block).toBeNull();
    expect(container.textContent ?? "").not.toContain(i18n.t("ask.checkCaveat.title"));
    unmount();
  });

  it("EN: dieselben Warnungen im englischen Wortlaut, kein deutscher Rückfall", async () => {
    await i18n.changeLanguage("en");
    bestand.kos = [ko({ status: "done", coverage: CAPPED })];
    const { container, unmount } = await mountAsk();

    const { block } = warnInhalt(container);
    const text = block?.textContent ?? "";
    expect(text).toContain("This answer is not evidenced as free of conflicts.");
    expect(text).toContain("Answer is not verified yet");
    expect(text).not.toContain("Diese Antwort ist nicht als konfliktfrei belegt.");
    unmount();
    await i18n.changeLanguage("de");
  });

  it("R-0286: das Fragefeld steht VOR dem Ergebnis — ohne `order`-Umstellung auf dem Bildschirm", async () => {
    await i18n.changeLanguage("de");
    bestand.kos = [ko({ status: "done", coverage: CAPPED })];
    const { container, unmount } = await mountAsk();

    const seite = container.querySelector<HTMLElement>('[data-testid="page-fragen"]');
    const feld = seite?.querySelector("form") ?? null;
    const ergebnis = container.querySelector<HTMLElement>('[data-testid="ask-result-anchor"]');
    expect(feld).not.toBeNull();
    expect(ergebnis).not.toBeNull();
    // Im Quelltext: Feld vor dem Ergebnis …
    expect(
      ((feld as HTMLElement).compareDocumentPosition(ergebnis as HTMLElement) &
        Node.DOCUMENT_POSITION_FOLLOWING) !==
        0,
    ).toBe(true);
    // … und keine Flex-`order`, die das auf dem Bildschirm umdrehen könnte. Die Geometrie selbst
    // misst `tests/design/zielbild-h5-fragen.test.ts` V16 in Chromium.
    const mitOrder = [...(seite as HTMLElement).querySelectorAll("*")].filter((e) =>
      /(^|\s)order-\d/.test(e.getAttribute("class") ?? ""),
    );
    expect(mitOrder.map((e) => e.getAttribute("class"))).toEqual([]);
    expect(feld?.className ?? "").not.toContain("mt-auto");
    unmount();
  });
});
