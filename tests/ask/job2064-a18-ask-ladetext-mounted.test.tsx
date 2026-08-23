// @vitest-environment jsdom
// ================================================================================================
// JOB 2064 · D4 — A18: DER LADETEXT IM BUSY-TRAEGER WIRD AM BAUM GEMESSEN (Register A1).
// ================================================================================================
//
// DIE LUECKE — `OFFEN.md`, Anker A18: „Die Browsermessungen prüfen Bedienbarkeit, Fokus und
// `inert`, nicht die Sprachausgabe."
//
// Eintrag A1 des A18-Registers (`tests/app/a18-ansagen-ereignisse.test.tsx:95-109`):
//
//   oberflaeche:      "Fragen"
//   ausgangszustand:  "kein Abruf aktiv"
//   aktion:           "Frage absenden"
//   ergebniszustand:  'Ladezustand sichtbar, Traeger traegt `aria-busy="true"`'
//   kanal:            'aria-busy + aria-live="polite"'   kanalart: "live"   hoeflichkeit: "polite"
//   textschluessel:   "ask.pending.title"
//   wiederholung:     "zweiter Abruf setzt `aria-busy` erneut"
//   negativfall:      "kein Abruf → `aria-busy` fehlt"
//   baumzustand:      "busy-Traeger mit LADETEXT ALS ZUGAENGLICHEM NAMEN"
//
// WAS SCHON GEMESSEN WIRD — und was nicht:
// `tests/app/ask-fragt-zuerst-mounted.test.tsx:423-430` mountet dieselbe Flaeche und prueft am
// Traeger `[data-testid="ask-pending"]` drei Dinge: dass er existiert, dass er `aria-busy="true"`
// traegt und dass er `aria-live="polite"` traegt. Das sind die ATTRIBUTE des Kanals.
//
// UNGEMESSEN blieb der letzte Punkt des Registereintrags: der `baumzustand`, also WAS der Kanal
// ansagen wuerde. Ein `aria-live`-Bereich mit gesetzten Attributen und leerem oder falschem Inhalt
// ist fuer eine Vorlesehilfe eine Ankuendigung ohne Aussage. Genau diese Luecke schliesst diese
// Datei — und zwar als EIGENE Datei: `ask-fragt-zuerst-mounted.test.tsx` wird NICHT angefasst,
// weder umgebaut noch ergaenzt.
//
// WARUM DIESER FALL — die Begruendungspflicht aus §2 des Auftrags:
// Nach D3 ist A1 der EINZIGE verbliebene Punkt auf dieser Flaeche. Die drei uebrigen Eintraege
// des Registers (M1, N1, D1) haben `kanalart: "keiner"` — ihnen fehlt der Kanal IM PRODUKT, sie
// sind kein Testbau. D2 liegt mit `window.confirm` ausserhalb des Dokumentbaums. Es gab hier also
// keine Wahl zwischen Kandidaten mehr, sondern nur noch einen.
//
// ================================================================================================
// WAS DIESE DATEI AUSDRUECKLICH NICHT BEHAUPTET.
// ================================================================================================
//
// Sie belegt KEINE Screenreader-Ausgabe. Ein jsdom-Baum spricht nicht. Belegt wird: dass der
// busy-Traeger nach dem Absenden existiert, dass es GENAU EINEN gibt, dass sein Text nichtleer und
// aus dem Sprachkatalog ist, dass er ohne laufenden Abruf NICHT da ist und dass ein zweiter Abruf
// ihn erneut setzt. Ob NVDA, JAWS oder VoiceOver ihn vorlesen, liegt ausserhalb jedes Testfalls —
// dieselbe Grenze zieht die Schwesterdatei fuer M2
// (`mobile-nav-live-status-mounted.test.tsx:19-28`) woertlich.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const steuer = vi.hoisted(() => ({
  offen: [] as { aufloesen: (w: unknown) => void; abweisen: (f: unknown) => void }[],
}));

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

const busytraeger = (container: HTMLElement): HTMLElement[] =>
  Array.from(container.querySelectorAll<HTMLElement>('[aria-busy="true"]'));

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
describe("JOB 2064 · A18/A1 · der Ausgangszustand", () => {
  // Woertlich der `negativfall` des Registereintrags: „kein Abruf → `aria-busy` fehlt". Ohne
  // diesen Fall bliebe G1 auch dann gruen, wenn der Traeger dauerhaft im Baum stuende — dann waere
  // er Einrichtung und meldete keinen Vorgang mehr.
  it("G0 · ohne laufenden Abruf gibt es KEINEN busy-Traeger", async () => {
    const { container, unmount } = await mountAsk();
    expect(busytraeger(container)).toHaveLength(0);
    unmount();
  });
});

describe("JOB 2064 · A18/A1 · waehrend der Abruf laeuft", () => {
  // Genau einer. Zwei gleichzeitige busy-Traeger waeren zwei Ankuendigungen desselben Vorgangs.
  it("G1 · nach dem Absenden steht GENAU EIN busy-Traeger im Baum", async () => {
    const { container, unmount } = await mountAsk();
    await frageAbsenden(container, FRAGE);
    expect(busytraeger(container)).toHaveLength(1);
    unmount();
  });

  // DER TRAGENDE FALL — der `baumzustand` des Registers, und der einzige Punkt des Eintrags, den
  // die bestehende Messung nicht abdeckt. Ein `aria-live`-Bereich mit gesetzten Attributen und
  // leerem Inhalt ist eine Ankuendigung ohne Aussage.
  it("G2 · der busy-Traeger traegt den Katalog-Ladetext `ask.pending.title`", async () => {
    const { container, unmount } = await mountAsk();
    await frageAbsenden(container, FRAGE);
    const erwartet = katalog("ask.pending.title");
    expect(erwartet.length, "Vorbedingung: der Schluessel existiert im Katalog").toBeGreaterThan(0);
    const text = busytraeger(container)[0]?.textContent ?? "";
    expect(text.trim().length, "der busy-Traeger ist leer — er sagt nichts an").toBeGreaterThan(0);
    expect(text).toContain(erwartet);
    unmount();
  });

  // Ein busy-Traeger unter `aria-hidden` ist sichtbar und fuer Hilfsmittel nicht vorhanden — genau
  // diese Kombination faellt bei einer Sichtpruefung nie auf.
  it("G3 · der busy-Traeger ist nicht vor Hilfsmitteln verborgen", async () => {
    const { container, unmount } = await mountAsk();
    await frageAbsenden(container, FRAGE);
    expect(busytraeger(container)[0]?.closest("[aria-hidden='true']")).toBeNull();
    unmount();
  });
});

describe("JOB 2064 · A18/A1 · Ende und Wiederholung", () => {
  // Der Vorgang endet: die Ankuendigung muss mit ihm verschwinden. Ein busy-Traeger, der nach der
  // Antwort stehen bleibt, meldet dauerhaft einen Vorgang, den es nicht mehr gibt.
  it("G4 · nach der Antwort ist der busy-Traeger wieder weg", async () => {
    const { container, unmount } = await mountAsk();
    await frageAbsenden(container, FRAGE);
    expect(busytraeger(container), "Vorbedingung: ein Traeger waehrend des Abrufs").toHaveLength(1);

    await act(async () => {
      steuer.offen[0]?.aufloesen(ANTWORT);
      await flush();
    });
    expect(busytraeger(container)).toHaveLength(0);
    unmount();
  });

  // Woertlich die `wiederholung` des Registereintrags: „zweiter Abruf setzt `aria-busy` erneut".
  it("G5 · eine zweite Frage setzt den busy-Traeger erneut — mit demselben Ladetext", async () => {
    const { container, unmount } = await mountAsk();
    await frageAbsenden(container, FRAGE);
    await act(async () => {
      steuer.offen[0]?.aufloesen(ANTWORT);
      await flush();
    });
    expect(busytraeger(container), "Vorbedingung: nach der Antwort kein Traeger").toHaveLength(0);

    await frageAbsenden(container, FRAGE);
    expect(busytraeger(container), "der zweite Abruf kuendigt sich nicht an").toHaveLength(1);
    expect(busytraeger(container)[0]?.textContent ?? "").toContain(katalog("ask.pending.title"));
    unmount();
  });
});
