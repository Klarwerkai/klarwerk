// @vitest-environment jsdom
// ================================================================================================
// JOB 3064 · KORREKTURPFLICHT 1+2 (Ben, Runde 9) — DER DECKUNGSRÜCKFALL BIS INS DOM.
// ================================================================================================
//
// BENS BEFUND an Runde 9, wörtlich:
//   „Eigener Gegenversuch mit echtem `ModelProvider` und `AntwortText`: ungedeckte Modellantwort mit
//    `[1]` fällt korrekt auf den Quellenwortlaut zurück; Ergebnis `answered=true`,
//    `citedSources=[\"ventil\"]`, aber DOM enthält 0 statt 1 `<sup data-fussnote>`."
// Und seine Prüflücke: „V9 beginnt mit bereits markierten Texten; erforderlich ist zusätzlich ein
// Lauf vom Provider-Ergebnis bis zum DOM."
//
// ------------------------------------------------------------------------------------------------
// WARUM DIE BISHERIGEN MESSUNGEN DAS NICHT SEHEN KONNTEN.
// ------------------------------------------------------------------------------------------------
// Alle Fussnotenfälle bis Runde 9 (`job3064-fussnoten-vertrag.test.tsx`, V1–V10) beginnen mit einem
// TEXT und fragen: markiert die Fläche darin dieselben Stellen wie der Reasoner? Das ist die halbe
// Kette. Der Reasoner hat aber zwei Ausgänge, und nur einer reicht den Modelltext durch:
//
//   NORMALWEG    Zitatdeckung hält  → `answer` = Modelltext MIT `[n]`   → Marke steht im Text.
//   RÜCKFALL     Zitatdeckung hält NICHT → `answer` = WORTLAUT der tragenden Quelle, ohne jede
//                Klammer — aber `answered:true` und `citedSources:[jene Quelle]`.
//
// Im Rückfall gibt es im Text nichts zu markieren. Ein Test, der beim Text anfängt, kann diesen Fall
// gar nicht erzeugen; er entsteht erst im Provider. Deshalb fängt DIESE Datei beim ECHTEN
// `ModelProvider` an (dieselbe Klasse, die der Ask-Dienst benutzt, mit einem Fake-Modellclient wie
// in `job2659-eine-marke-ist-kein-beleg.test.ts`) und misst am Ende das DOM.
//
// DIE ZUSAGE, die hier gemessen wird — und die ab jetzt der Vertrag ist:
//   Bei `answered:true` ist die Menge der sichtbaren Fussnotennummern GLEICH der Menge der
//   Positionen von `citedSources` in `sources` — und jede sichtbare Nummer löst sich zu genau dem
//   Quellen-Chip auf, der dieselbe Nummer trägt.
//
// GEMESSEN WIRD IN ZWEI TIEFEN, beide vom selben Provider-Ergebnis aus:
//   R1–R4  Provider → `AntwortText` (das Bauteil, das die Marke setzt).
//   R5–R6  Provider → die MONTIERTE Fragenfläche `pages/Ask.tsx` (der Weg, den der Mensch sieht):
//          dasselbe Ergebnisobjekt kommt über den gemockten Endpunkt herein, und gemessen wird an
//          der echten Antwortkarte samt ihren Chips.
//   R7     KALIBRIERUNG: genau Bens Aufbau ohne die Zuordnung — 0 Marken. Ohne diesen Fall wäre
//          nicht belegt, dass die neue Zusage überhaupt etwas trägt.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Das Provider-Ergebnis, das die montierte Fläche bekommt.
 *
 * `vi.hoisted`, weil `vi.mock` nach oben gezogen wird und die Fabrik keine gewöhnliche Variable des
 * Moduls sehen darf. Gefüllt wird es in `beforeAll` — vom ECHTEN Provider, nicht von Hand.
 */
const bestand = vi.hoisted(() => ({
  ergebnis: null as null | Record<string, unknown>,
}));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte" }),
}));
vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ko: { list: vi.fn(async () => []) },
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
        result: { ...bestand.ergebnis, captionSources: [] },
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
import { AntwortText } from "../../apps/web/src/components/start/AntwortText";
import i18n from "../../apps/web/src/i18n";
import { Ask } from "../../apps/web/src/pages/Ask";
import type { AnswerResult, KnowledgeRef, ModelClient } from "../../services/reasoner";
import { ModelProvider } from "../../services/reasoner/src/provider-model";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};

// ------------------------------------------------------------------------------------------------
// DIE LAGE — wörtlich die aus Bens Gegenversuch (`job2659-eine-marke-ist-kein-beleg.test.ts`).
// ------------------------------------------------------------------------------------------------
function ref(
  id: string,
  title: string,
  statement: string,
  status: KnowledgeRef["status"] = "validiert",
  trust = 90,
): KnowledgeRef {
  return { id, title, statement, status, trust };
}

const QUELLE = ref(
  "ventil",
  "Ventil X bei Überdruck schließen",
  "Bei Überdruck über 6 bar Ventil X schließen",
);
const ZWEITE = ref(
  "wartung",
  "Ventil X Wartung",
  "Ventil X bei Überdruck einmal jährlich prüfen",
  "offen",
  40,
);
const KANDIDATEN = [QUELLE, ZWEITE];
const FRAGE = "Was tun bei Überdruck am Ventil X?";

function fake(text: string): ModelClient {
  return { name: "fake", complete: async () => text };
}

/** Ein Lauf durch den ECHTEN Provider — genau der Weg, den der Ask-Dienst nimmt. */
const laufe = (modelltext: string): Promise<AnswerResult> =>
  new ModelProvider(fake(modelltext)).answer(FRAGE, KANDIDATEN);

/** Die Zusage als Rechnung: welche Nummern MÜSSEN sichtbar sein? */
const sollNummern = (e: AnswerResult): number[] =>
  (e.citedSources ?? []).map((id) => e.sources.indexOf(id) + 1).filter((n) => n > 0);

const markenIn = (c: ParentNode): number[] =>
  [...c.querySelectorAll("sup[data-fussnote]")]
    .map((e) => Number(e.getAttribute("data-fussnote")))
    .sort((a, b) => a - b);

// ------------------------------------------------------------------------------------------------
// R1–R4 · PROVIDER → `AntwortText`.
// ------------------------------------------------------------------------------------------------
function zeichne(e: AnswerResult, mitZuordnung = true): HTMLDivElement {
  const container = document.createElement("div");
  document.body.appendChild(container);
  createRoot(container).render(
    createElement(AntwortText, {
      text: e.answer ?? "",
      quellen: e.sources.length,
      ...(mitZuordnung ? { tragend: sollNummern(e) } : {}),
    }),
  );
  return container;
}

const zeichneAkt = (e: AnswerResult, mitZuordnung = true): HTMLDivElement => {
  let c!: HTMLDivElement;
  act(() => {
    c = zeichne(e, mitZuordnung);
  });
  return c;
};

describe("JOB 3064 · R · vom Provider-Ergebnis bis zur sichtbaren Fussnote", () => {
  it("R1 · RÜCKFALL: die ungedeckte markierte Antwort zeigt die Marke ihrer tragenden Quelle", async () => {
    // Bens Aufbau: das Modell markiert [1], die Aussage hält der Zitatprüfung NICHT stand.
    const e = await laufe(
      "Ventil bei Überdruck sofort demontieren und den Schichtleiter informieren [1].",
    );
    // KALIBRIERUNG DER LAGE: das ist wirklich der Rückfall, nicht der Normalweg.
    expect(e.answered, "der Fall ist nicht mehr der Rückfall").toBe(true);
    expect(e.answer, "hinaus geht nicht mehr der Quellenwortlaut").toBe(QUELLE.statement);
    expect(e.citedSources).toEqual(["ventil"]);
    expect(e.answer ?? "", "der Antworttext trägt entgegen der Annahme eine Klammer").not.toMatch(
      /\[\d/,
    );

    // DIE MESSUNG: Anzahl UND Nummern der DOM-Marken sind die Stellen der `citedSources`.
    expect(markenIn(zeichneAkt(e))).toEqual(sollNummern(e));
    expect(sollNummern(e), "die Sollrechnung ist leer — dann misst R1 nichts").toEqual([1]);
  });

  it("R2 · RÜCKFALL auf die ZWEITE Quelle: die Marke trägt deren Chip-Nummer, nicht die 1", async () => {
    // Das Modell markiert nur Quelle 2 und erfindet dazu; tragend ist damit „wartung" (Stelle 2).
    const e = await laufe("Ventil X wird alle zwei Wochen vom Hersteller getauscht [2].");
    expect(e.answered).toBe(true);
    expect(e.answer).toBe(ZWEITE.statement);
    expect(e.citedSources).toEqual(["wartung"]);
    expect(sollNummern(e), "die tragende Quelle steht nicht an zweiter Stelle").toEqual([2]);
    // Die Probe auf die Rechnung: es erscheint die 2, nicht die 1. Eine Marke, die immer „1" sagt,
    // wäre eine Erfindung — sie zeigte auf den falschen Chip.
    expect(markenIn(zeichneAkt(e))).toEqual([2]);
  });

  it("R3 · NORMALWEG: die gedeckte Antwort behält ihre Marken — nichts wird doppelt gesetzt", async () => {
    const e = await laufe("Bei Überdruck über 6 bar Ventil X schließen [1].");
    expect(e.answered).toBe(true);
    expect(e.answer, "der gedeckte Modelltext ging nicht hinaus").toContain("[1]");
    expect(e.citedSources).toEqual(["ventil"]);
    // Genau EINE Marke: die aus dem Text. Nicht zusätzlich eine angehängte.
    const c = zeichneAkt(e);
    expect(markenIn(c)).toEqual([1]);
    expect(c.querySelectorAll("sup[data-fussnote]")).toHaveLength(1);
    expect(c.textContent ?? "", "die rohe Klammer steht noch im Satz").not.toContain("[1]");
  });

  it("R4 · NORMALWEG mit ZWEI tragenden Quellen: beide Nummern stehen im Text", async () => {
    const e = await laufe(
      "Bei Überdruck über 6 bar Ventil X schließen [1]. Ventil X bei Überdruck einmal jährlich prüfen [2].",
    );
    expect(e.answered).toBe(true);
    expect(e.citedSources).toEqual(["ventil", "wartung"]);
    expect(markenIn(zeichneAkt(e))).toEqual([1, 2]);
  });

  it("R7 · KALIBRIERUNG: ohne die Zuordnung des Servers ist genau Bens Befund wieder da", async () => {
    // Derselbe Rückfall, aber `AntwortText` bekommt die tragenden Stellen NICHT. Dann kann es die
    // Marke nicht kennen — 0 statt 1, wörtlich Bens Messung. Das ist der Beleg, dass R1 an der
    // neuen Zusage hängt und nicht an einer Nebenwirkung.
    const e = await laufe(
      "Ventil bei Überdruck sofort demontieren und den Schichtleiter informieren [1].",
    );
    expect(markenIn(zeichneAkt(e, false))).toEqual([]);
  });

  it("R8 · KEINE ERFINDUNG: eine Zahl, die der Server nicht gebunden hat, wird keine Marke", async () => {
    // Der Rückfallwortlaut könnte selbst eine Klammer tragen (Quelltext ist beliebiger Text). Sie
    // ist dann KEINE Zitierung — der Server hat sie nie gebunden. Sie bleibt wörtlich stehen, und
    // sichtbar ist trotzdem genau die tragende Nummer.
    const e = await laufe(
      "Ventil bei Überdruck sofort demontieren und den Schichtleiter informieren [1].",
    );
    const c = zeichneAkt({ ...e, answer: `Siehe Anhang [2]. ${QUELLE.statement}` });
    expect(markenIn(c), "eine ungebundene Zahl wurde zur Marke").toEqual([1]);
    expect(c.textContent ?? "", "die ungebundene 2 verschwand aus dem Satz").toContain("[2]");
  });
});

// ------------------------------------------------------------------------------------------------
// R5–R6 · PROVIDER → DIE MONTIERTE FRAGENFLÄCHE.
// ------------------------------------------------------------------------------------------------
const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

interface Flaeche {
  container: HTMLElement;
  unmount: () => void;
}

async function mount(): Promise<Flaeche> {
  await i18n.changeLanguage("de");
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

/** Fragt über das ECHTE Formular — kein Hineinschreiben in den Zustand. */
async function fragen(f: Flaeche): Promise<void> {
  const feld = f.container.querySelector("input") as HTMLInputElement;
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(feld, FRAGE);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(async () => {
    (f.container.querySelector("form") as HTMLFormElement).dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flush();
  });
}

describe("JOB 3064 · R5/R6 · die montierte Fragenfläche im Deckungsrückfall", () => {
  let rueckfall: AnswerResult;
  const offen: Flaeche[] = [];

  beforeAll(async () => {
    rueckfall = await laufe(
      "Ventil bei Überdruck sofort demontieren und den Schichtleiter informieren [1].",
    );
    bestand.ergebnis = rueckfall as unknown as Record<string, unknown>;
  });

  afterEach(() => {
    for (const f of offen.splice(0)) {
      f.unmount();
    }
  });

  it("R5 · die Antwortkarte zeigt genau die Marken der tragenden Quellen", async () => {
    const f = await mount();
    offen.push(f);
    await fragen(f);
    const karte = f.container.querySelector('[data-testid="ask-answer"]');
    expect(karte, "es gibt keine Antwortkarte").not.toBeNull();
    expect(
      markenIn(karte as Element),
      `die Karte zeigt nicht die Stellen von ${JSON.stringify(rueckfall.citedSources)}`,
    ).toEqual(sollNummern(rueckfall));
  });

  it("R6 · jede sichtbare Marke löst sich zu dem Chip auf, der dieselbe Nummer trägt", async () => {
    const f = await mount();
    offen.push(f);
    await fragen(f);
    const karte = f.container.querySelector('[data-testid="ask-answer"]') as Element;
    const chips = [...karte.querySelectorAll('[data-testid="ask-quellen-chip"]')].map((e) =>
      (e.textContent ?? "").trim(),
    );
    expect(chips.length, "die Karte hat keine Quellen-Chips").toBeGreaterThan(0);
    for (const nummer of markenIn(karte)) {
      expect(
        chips.some((c) => c.startsWith(`${nummer} ·`)),
        `zur Marke ${nummer} gibt es keinen Chip: ${JSON.stringify(chips)}`,
      ).toBe(true);
    }
  });
});
