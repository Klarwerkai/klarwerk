// @vitest-environment jsdom
// ================================================================================================
// produkt:20261009:referenzki-antwortstatus (REF-04, K5, Ben nacharbeit-3) — AUSSAGE → PASSAGE →
// ZURÜCK AUCH AN ZWEITMEINUNG UND STICHTAGSVERGLEICH.
// ================================================================================================
//
// Befund: beide Antwortwege reichten der Prüfungsanzeige keine Passage herein; die Detailansicht
// zeigte deshalb stets „Die Passage liegt dieser Ansicht nicht vor". Gemountet werden die echten
// Bausteine `Zweitmeinung` (Endpunkt als Drahtgrenze, dieselbe Form wie POST /api/ask mit
// `zweitmeinung`) und `WissensstandVergleichAnzeige` (Antwortkörper von POST /api/ask/vergleich).
// Fiktive Inhalte.
//   V1 · Stichtagsvergleich: je Seite die Passage DIESER Seite (damals ≠ heute), Fundstelle mit
//        Fassung, Begründung, Rückweg mit Fokus
//   Z1 · Zweitmeinung: je Antwort die Passage ihrer eigenen Bindung, Begründung, Rückweg
import { afterEach, describe, expect, it, vi } from "vitest";

const draht = vi.hoisted(() => ({ antwort: null as unknown }));

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: {
    ask: {
      zweitmeinung: vi.fn(async () => draht.antwort),
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
import type { ReferenzPruefung, WissensstandVergleich } from "../../apps/web/src/api/types";
import { WissensstandVergleichAnzeige } from "../../apps/web/src/components/fragen/WissensstandVergleich";
import { Zweitmeinung } from "../../apps/web/src/components/fragen/Zweitmeinung";
import i18n from "../../apps/web/src/i18n";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const PASSAGE_DAMALS = "Die fiktive Pumpe P7 fördert mit höchstens 2 bar.";
const PASSAGE_HEUTE = "Die fiktive Pumpe P7 fördert mit höchstens 3 bar.";

function pruefung(fundstelleId: string, version: number, begruendung: string): ReferenzPruefung {
  const fundstelle = {
    fundstelleId,
    koId: "ko-fiktiv-pumpe",
    koVersion: version,
    start: 0,
    ende: 40,
  };
  return {
    richtlinie: "referenzpruefung-v1",
    pruefId: `ref_${fundstelleId}`,
    status: "geprueft",
    rollen: { antwort: "cloud", pruefer: "local" },
    aussagen: [
      {
        aussageId: `aus_${fundstelleId}`,
        zustand: "belegt",
        teile: [{ teilId: `t_${fundstelleId}`, zustand: "belegt", fundstelle, begruendung }],
        fundstellen: [fundstelle],
        begruendung,
      },
    ],
    hinweise: [],
    globaleAktualitaet: "nicht_behauptet",
    ausCache: false,
    messung: { dauerMs: 1, modellaufrufe: 1 },
    versuch: { nummer: 1, hoechstens: 2 },
  };
}

function beleg(fundstelleId: string, text: string, auszug: string) {
  return {
    aussagen: [
      {
        aussageId: `aus_${fundstelleId}`,
        text,
        teile: [{ fundstellen: [{ fundstelleId, auszug }] }],
      },
    ],
  };
}

const ANTWORT = {
  answered: true,
  answer: "Die Pumpe P7 fördert mit höchstens 3 bar [1].",
  knowledgeClass: "gesichert",
  trust: 90,
  sources: ["ko-fiktiv-pumpe"],
  citedSources: ["ko-fiktiv-pumpe"],
  steps: [],
  demo: false,
};

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

let aufraeumen: (() => void) | null = null;

afterEach(() => {
  aufraeumen?.();
  aufraeumen = null;
});

async function montieren(element: ReturnType<typeof createElement>): Promise<HTMLElement> {
  await i18n.changeLanguage("de");
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, element)),
    );
  });
  aufraeumen = () => {
    act(() => root.unmount());
    container.remove();
  };
  return container;
}

const q = (c: ParentNode, sel: string): HTMLElement | null => c.querySelector<HTMLElement>(sel);

/** Öffnet in einer Prüfungsanzeige die erste Aussage und liest Passage, Link und Begründung. */
async function oeffneUndLies(bereich: HTMLElement) {
  const knopf = q(bereich, '[data-testid="referenzpruefung-zur-fundstelle"]') as HTMLButtonElement;
  await act(async () => {
    knopf.click();
  });
  const detail = q(bereich, '[data-testid="referenzpruefung-fundstelle-detail"]');
  const gelesen = {
    fokusImDetail: document.activeElement === detail,
    passage: q(bereich, '[data-testid="referenzpruefung-passage"]')?.textContent ?? null,
    href:
      detail?.querySelector('[data-testid="referenzpruefung-fundstelle"]')?.getAttribute("href") ??
      null,
    begruendung:
      q(bereich, '[data-testid="referenzpruefung-detail-begruendung"]')?.textContent ?? "",
  };
  await act(async () => {
    (q(bereich, '[data-testid="referenzpruefung-zurueck"]') as HTMLButtonElement).click();
  });
  return {
    ...gelesen,
    zu: q(bereich, '[data-testid="referenzpruefung-fundstelle-detail"]') === null,
    fokusZurueck: document.activeElement === knopf,
  };
}

describe("REF-04 · K5 — Passage auch an Stichtagsvergleich und Zweitmeinung", () => {
  it("V1 · Stichtagsvergleich: je Seite die eigene Passage, Fassung, Begründung und Rückweg", async () => {
    const vergleich = {
      stichtag: "2025-10-13",
      heute: ANTWORT,
      damals: { ...ANTWORT, answer: "Die Pumpe P7 fördert mit höchstens 2 bar [1]." },
      heuteAussagen: beleg("fs_heute", "Höchstens 3 bar.", PASSAGE_HEUTE),
      damalsAussagen: beleg("fs_damals", "Höchstens 2 bar.", PASSAGE_DAMALS),
      referenzpruefung: {
        heute: pruefung("fs_heute", 3, "Die heutige Fassung nennt 3 bar."),
        damals: pruefung("fs_damals", 2, "Die Fassung zum Stichtag nennt 2 bar."),
      },
      antwortGeaendert: true,
      quellen: [],
    } as unknown as WissensstandVergleich;
    const c = await montieren(
      createElement(WissensstandVergleichAnzeige, {
        vergleich,
        wissenHref: (id: string) => `/wissen/${id}`,
      }),
    );
    const damals = q(c, '[data-testid="ask-vergleich-referenz-damals"]') as HTMLElement;
    const heute = q(c, '[data-testid="ask-vergleich-referenz-heute"]') as HTMLElement;
    const d = await oeffneUndLies(damals);
    expect(d).toMatchObject({ fokusImDetail: true, passage: PASSAGE_DAMALS, zu: true });
    expect(d.href).toContain("fassung=2");
    expect(d.begruendung).toContain("Die Fassung zum Stichtag nennt 2 bar.");
    expect(d.fokusZurueck).toBe(true);
    const h = await oeffneUndLies(heute);
    expect(h).toMatchObject({ fokusImDetail: true, passage: PASSAGE_HEUTE, zu: true });
    expect(h.href).toContain("fassung=3");
    expect(h.begruendung).toContain("Die heutige Fassung nennt 3 bar.");
    expect(h.fokusZurueck).toBe(true);
    expect(c.textContent).not.toContain("Die Passage liegt dieser Ansicht nicht vor");
  });

  it("Z1 · Zweitmeinung: je Antwort die Passage ihrer eigenen Bindung, Begründung und Rückweg", async () => {
    const erste = {
      answered: true,
      answer: ANTWORT.answer,
      sources: ANTWORT.sources,
      citedSources: ANTWORT.citedSources,
      demo: false,
    };
    const zweite = { ...erste, answer: "Die Pumpe P7 fördert mit höchstens 2 bar [1]." };
    draht.antwort = {
      result: ANTWORT,
      gap: null,
      receipt: "beleg-fiktiv",
      zweitmeinung: {
        status: "verglichen",
        ersteStufe: "cloud",
        zweiteStufe: "local",
        erste,
        zweite,
        abweichend: true,
        abweichungen: ["zahlen"],
      },
      zweitmeinungAussagen: {
        erste: beleg("fs_a", "Die Pumpe P7 fördert mit höchstens 3 bar.", PASSAGE_HEUTE),
        zweite: beleg("fs_b", "Die Pumpe P7 fördert mit höchstens 2 bar.", PASSAGE_DAMALS),
      },
      referenzpruefungZweitmeinung: {
        erste: pruefung("fs_a", 3, "Die Fundstelle nennt 3 bar."),
        zweite: pruefung("fs_b", 2, "Die Fundstelle nennt 2 bar."),
      },
    };
    const c = await montieren(
      createElement(Zweitmeinung, {
        frage: "Mit welchem Druck fördert die Pumpe P7?",
        faden: [],
        billable: false,
        titelVon: () => "Pumpe P7",
      }),
    );
    await act(async () => {
      (q(c, '[data-testid="ask-zweitmeinung-knopf"]') as HTMLButtonElement).click();
      await flush();
    });
    const a = q(c, '[data-testid="ask-zweitmeinung-a-referenz"]') as HTMLElement;
    const b = q(c, '[data-testid="ask-zweitmeinung-b-referenz"]') as HTMLElement;
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    const ea = await oeffneUndLies(a);
    expect(ea).toMatchObject({ fokusImDetail: true, passage: PASSAGE_HEUTE, zu: true });
    expect(ea.begruendung).toContain("Die Fundstelle nennt 3 bar.");
    expect(ea.fokusZurueck).toBe(true);
    const eb = await oeffneUndLies(b);
    expect(eb).toMatchObject({ fokusImDetail: true, passage: PASSAGE_DAMALS, zu: true });
    expect(eb.href).toContain("fassung=2");
    expect(eb.begruendung).toContain("Die Fundstelle nennt 2 bar.");
    expect(eb.fokusZurueck).toBe(true);
  });
});
