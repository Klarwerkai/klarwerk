// @vitest-environment jsdom
// ================================================================================================
// JOB 2064 · D2 — A18: DIE ALARMREGION DES ABRUFFEHLERS WIRD AM BAUM GEMESSEN (Register A2).
// ================================================================================================
//
// DIE LUECKE — `OFFEN.md`, Anker A18: „Die Browsermessungen prüfen Bedienbarkeit, Fokus und
// `inert`, nicht die Sprachausgabe."
//
// Eintrag A2 des A18-Registers (`tests/app/a18-ansagen-ereignisse.test.tsx:110-124`):
//
//   oberflaeche:     "Fragen"
//   aktion:          "Abruf schlaegt fehl"
//   ergebniszustand: "Fehlermeldung in einer Alarmregion"
//   kanal:           'role="alert"'        kanalart: "live"      hoeflichkeit: "assertive"
//   textschluessel:  "ask.error.title"
//   wiederholung:    "erneuter Fehlschlag ersetzt den Text"
//   negativfall:     "Erfolg → kein role=alert im Baum"
//   baumzustand:     "role=alert mit der Fehlermeldung als zugaenglichem Namen"
//   quellen:         ["pages/Ask.tsx:646-650"]   (heute `Ask.tsx:633-637`)
//
// Bis heute stand dieser Zustand nur IM REGISTER — und das Register ist eine QUELLTEXTPRUEFUNG
// (`readFileSync`, dort `:2`/`:263`), die nichts mountet.
//
// WARUM DIESER FALL — „wo steht ein Anwender am ehesten im Dunkeln":
// Bei den uebrigen offenen Ereignissen sieht der Anwender, dass etwas passiert ist: das Feld ist
// leer (F1), die Datei liegt sichtbar daneben (I1). HIER hat er eine Frage abgeschickt und wartet
// auf eine Antwort. Bleibt die Meldung stumm, wartet er auf etwas, das nie kommt — und es gibt
// kein zweites Signal, das ihn darauf stossen wuerde. Deshalb traegt dieser Kanal als einziger der
// zwoelf `hoeflichkeit: "assertive"`: er soll unterbrechen. Ob er es kann, hat bisher niemand
// gemessen.
//
// ABGRENZUNG ZU `mega39-fehler-ohne-fremde-antwort.test.tsx`: Jene Datei mountet denselben
// Fehlerzustand, prueft aber die INHALTLICHE Trennung (keine fremde Antwort, keine Export-Knoepfe)
// — `role="alert"` kommt darin nicht vor. Sie wird hier NICHT umgebaut; dies ist eine eigene
// Datei mit eigenem Gegenstand.
//
// ================================================================================================
// WAS DIESE DATEI AUSDRUECKLICH NICHT BEHAUPTET.
// ================================================================================================
//
// Sie belegt KEINE Screenreader-Ausgabe. Ein jsdom-Baum spricht nicht. Belegt wird: dass die
// Alarmregion nach dem Fehler existiert, dass es GENAU EINE ist, dass ihr Text nichtleer und aus
// dem Sprachkatalog stammt, dass sie im Erfolgsfall NICHT da ist und dass ein zweiter Fehlschlag
// sie nicht stapelt. Ob NVDA, JAWS oder VoiceOver sie vorlesen, haengt an ihrer Ansageheuristik
// und liegt ausserhalb jedes Testfalls — dieselbe Grenze zieht die Schwesterdatei fuer M2
// (`mobile-nav-live-status-mounted.test.tsx:19-28`) woertlich.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const steuer = vi.hoisted(() => ({
  offen: [] as { aufloesen: (w: unknown) => void; abweisen: (f: unknown) => void }[],
}));

// Feste Expertinnen-Rolle wie in mega39 — die Rollenlage ist nicht Gegenstand dieses Falls.
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
            steuer.offen.push({ aufloesen: resolve, abweisen: reject });
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
Element.prototype.scrollIntoView = (): void => {};

const ANTWORT = {
  result: {
    answered: true,
    answer: "Ventil V4 wird jaehrlich geprueft.",
    knowledgeClass: "gesichert",
    trust: 90,
    sources: [],
    steps: [],
    demo: false,
    captionSources: [],
  },
  gap: null,
  receipt: "r1",
};

const FRAGE = "Wie oft wird Ventil V4 geprueft?";

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

const alarmregionen = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>('[role="alert"]'));

const katalog = (schluessel: string): string =>
  String(i18n.getResource("de", "translation", schluessel));

beforeEach(() => {
  steuer.offen.length = 0;
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

// ------------------------------------------------------------------------------------------------
describe("JOB 2064 · A18/A2 · der Abruffehler steht in genau einer Alarmregion", () => {
  // DER TRAGENDE FALL. Das Register verlangt „Fehlermeldung in einer Alarmregion". Zwei Regionen
  // waeren bei `assertive` zwei Unterbrechungen desselben Sachverhalts.
  it("C1 · nach dem Fehlschlag steht GENAU EINE Alarmregion im Baum", async () => {
    const { container, unmount } = await mountAsk();
    await frageAbsenden(container, FRAGE);
    await act(async () => {
      steuer.offen[0]?.abweisen(new Error("network"));
      await flush();
    });
    expect(alarmregionen(container)).toHaveLength(1);
    unmount();
  });

  // DIE GEGENPROBE, woertlich der `negativfall` des Registereintrags: „Erfolg → kein role=alert im
  // Baum". Ohne sie bliebe C1 auch dann gruen, wenn die Region dauerhaft stuende — eine
  // Alarmregion, die immer da ist, meldet kein Ereignis mehr, sondern ist Einrichtung.
  it("C2 · nach einer erfolgreichen Antwort steht KEINE Alarmregion im Baum", async () => {
    const { container, unmount } = await mountAsk();
    await frageAbsenden(container, FRAGE);
    await act(async () => {
      steuer.offen[0]?.aufloesen(ANTWORT);
      await flush();
    });
    expect(alarmregionen(container)).toHaveLength(0);
    unmount();
  });
});

describe("JOB 2064 · A18/A2 · was die Region ansagen wuerde", () => {
  // Eine leere Alarmregion ist der schlimmste Fall: der Baum behauptet eine Meldung, und die
  // Vorlesehilfe sagt nichts oder nur „Warnung". Deshalb wird der Inhalt gemessen.
  it("C3 · der Text der Region ist nichtleer und ist der Katalogtext `ask.error.title`", async () => {
    const { container, unmount } = await mountAsk();
    await frageAbsenden(container, FRAGE);
    await act(async () => {
      steuer.offen[0]?.abweisen(new Error("network"));
      await flush();
    });
    const text = alarmregionen(container)[0]?.textContent?.trim() ?? "";
    expect(text.length, "die Alarmregion ist leer — sie meldet nichts").toBeGreaterThan(0);
    const erwartet = katalog("ask.error.title");
    expect(erwartet.length, "Vorbedingung: der Schluessel existiert im Katalog").toBeGreaterThan(0);
    expect(text).toContain(erwartet);
    unmount();
  });

  // Eine Alarmregion unter `aria-hidden` ist sichtbar und fuer Hilfsmittel nicht vorhanden — genau
  // diese Kombination faellt bei einer Sichtpruefung nie auf.
  it("C4 · die Alarmregion ist nicht vor Hilfsmitteln verborgen", async () => {
    const { container, unmount } = await mountAsk();
    await frageAbsenden(container, FRAGE);
    await act(async () => {
      steuer.offen[0]?.abweisen(new Error("network"));
      await flush();
    });
    expect(alarmregionen(container)[0]?.closest("[aria-hidden='true']")).toBeNull();
    unmount();
  });
});

describe("JOB 2064 · A18/A2 · Wiederholung", () => {
  // Der `wiederholung`-Vertrag des Registers: „erneuter Fehlschlag ersetzt den Text". Ersetzen,
  // nicht stapeln — zwei Regionen waeren zwei Unterbrechungen fuer denselben Vorgang.
  it("C5 · ein zweiter Fehlschlag ersetzt die Meldung und stapelt sie nicht", async () => {
    const { container, unmount } = await mountAsk();
    await frageAbsenden(container, FRAGE);
    await act(async () => {
      steuer.offen[0]?.abweisen(new Error("network"));
      await flush();
    });
    expect(
      alarmregionen(container),
      "Vorbedingung: eine Region nach dem ersten Fehler",
    ).toHaveLength(1);

    await frageAbsenden(container, FRAGE);
    await act(async () => {
      steuer.offen[1]?.abweisen(new Error("network"));
      await flush();
    });
    expect(alarmregionen(container), "der zweite Fehlschlag hat gestapelt").toHaveLength(1);
    unmount();
  });
});
