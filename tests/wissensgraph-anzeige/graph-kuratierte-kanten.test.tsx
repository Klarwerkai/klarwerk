// @vitest-environment jsdom
// ================================================================================================
// JOB 4153 (WG-ANZEIGE) — R9 UND R10: ZWEI KANTENMENGEN IM BILD, ZWEI ZAHLEN IM SATZ.
// ================================================================================================
//
// Fläche: /graph → `GraphView` (apps/web/src/pages/Stufe2.tsx), Layout: `lib/graphLayout.ts`.
// Die kuratierten Kanten kommen aus DERSELBEN `/api/graph`-Antwort (Nachtrag 2 §3) — dieser Test
// fährt beide Antwortformen: MIT der Menge (R9) und OHNE sie (R10, ein Server ohne die Erweiterung
// aus JOB 4151).
//
// DIE ZWEI FEHLER, GEGEN DIE DIESE DATEI STEHT:
//   1. Eine SUMME. Würden Schlagwort- und Fachkanten zu einer Zahl addiert, wäre die geteilte
//      Schlagwortnähe rechnerisch eine verantwortete Fachaussage — genau die Verwechslung, die der
//      durchgängige Vertrag Nr. 6 verbietet.
//   2. Ein PFLICHTFELD. Läse die Seite `kuratierteKanten` als Pflichtfeld, stürzte sie an jedem
//      Server ohne die Erweiterung ab — und sagte im besten Fall „keine Beziehungen vorhanden",
//      also eine Aussage über Daten, die niemand gelesen hat.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GRAPH_KNOTEN,
  GRAPH_KURATIERT,
  GRAPH_TAGKANTEN,
  graphKos,
  graphMitKuratierten,
  graphOhneKuratierte,
} from "./bestand";

const stand: { mitKuratierten: boolean } = { mitKuratierten: true };

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte", stufe2: true, setStufe2: () => {} }),
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    library: {
      graph: vi.fn(async () =>
        stand.mitKuratierten ? graphMitKuratierten() : graphOhneKuratierte(),
      ),
    },
    conflicts: { list: vi.fn(async () => []) },
    ko: { list: vi.fn(async () => graphKos()) },
  };
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => leer() });
    },
  });
  return { endpoints };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { Graph } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { layoutGraph, limitGraph } from "../../apps/web/src/lib/graphLayout";
import { GraphView } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

interface Buehne {
  container: HTMLElement;
  text: () => string;
  /** Die Schlagwortkanten: Linien MIT `<title>`, aber OHNE Herkunftsmarke. */
  tagLinien: () => HTMLElement[];
  kuratierteLinien: () => HTMLElement[];
  knotenGruppen: () => Element[];
  unmount: () => void;
}

async function montiere(): Promise<Buehne> {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/graph"] },
        createElement(QueryClientProvider, { client }, createElement(GraphView)),
      ),
    );
    await flush();
  });
  await act(flush);
  return {
    container,
    text: () => container.textContent ?? "",
    tagLinien: () =>
      [...container.querySelectorAll<HTMLElement>("svg line")].filter(
        (l) => l.querySelector("title") !== null && l.getAttribute("data-herkunft") === null,
      ),
    kuratierteLinien: () => [
      ...container.querySelectorAll<HTMLElement>('svg line[data-herkunft="kuratiert"]'),
    ],
    knotenGruppen: () =>
      [...container.querySelectorAll("svg g")].filter(
        (g) => g.querySelector(":scope > circle") !== null,
      ),
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

const titelVon = (el: Element): string => el.querySelector("title")?.textContent ?? "";

beforeEach(async () => {
  stand.mitKuratierten = true;
  await i18n.changeLanguage("de");
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("R9 · Beide Mengen gezeichnet, unterscheidbar beschriftet, getrennt gezählt", () => {
  it("die Schlagwortkanten bleiben, was sie sind — und daneben stehen die gesetzten", async () => {
    const b = await montiere();
    expect(b.tagLinien().length).toBe(GRAPH_TAGKANTEN.length);
    expect(b.tagLinien().map(titelVon).sort()).toEqual(GRAPH_TAGKANTEN.map((k) => k.via).sort());
    expect(b.kuratierteLinien().length).toBe(GRAPH_KURATIERT.length);
    b.unmount();
  });

  it("die Beschriftung der gesetzten Kante nennt die ART, nicht ein Schlagwort", async () => {
    const b = await montiere();
    const beschriftungen = b.kuratierteLinien().map(titelVon);
    expect(beschriftungen).toContain(
      i18n.t("graph.kuratiertKante", {
        art: i18n.t("wb.art.widerspricht"),
        richtung: i18n.t("wb.richtungKurz.gerichtet"),
      }),
    );
    expect(beschriftungen).toContain(
      i18n.t("graph.kuratiertKante", {
        art: i18n.t("wb.art.gehoert_zu"),
        richtung: i18n.t("wb.richtungKurz.ungerichtet"),
      }),
    );
    // Unterscheidbar: keine Beschriftung einer gesetzten Kante ist die einer Schlagwortkante.
    const tags = b.tagLinien().map(titelVon);
    for (const s of beschriftungen) {
      expect(tags, `„${s}" darf keine Schlagwortbeschriftung sein`).not.toContain(s);
    }
    b.unmount();
  });

  it("die Legende nennt beide Mengen in Worten — nicht nur in Farben", async () => {
    const b = await montiere();
    expect(b.text()).toContain(i18n.t("graph.legendTag"));
    expect(b.text()).toContain(i18n.t("graph.legendKuratiert"));
    expect(i18n.t("graph.legendTag")).not.toBe(i18n.t("graph.legendKuratiert"));
    b.unmount();
  });

  it("der Zählsatz nennt ZWEI getrennte Zahlen und bildet keine Summe", async () => {
    const b = await montiere();
    const text = b.text();
    expect(text).toContain(
      i18n.t("s2.graphCount", {
        nodes: GRAPH_KNOTEN.length,
        edges: GRAPH_TAGKANTEN.length,
      }),
    );
    expect(text).toContain(i18n.t("graph.kuratiertCount", { count: GRAPH_KURATIERT.length }));
    // Die Summe (2 + 2 = 4 Kanten) darf NICHT dastehen.
    expect(text).not.toContain(
      i18n.t("s2.graphCount", {
        nodes: GRAPH_KNOTEN.length,
        edges: GRAPH_TAGKANTEN.length + GRAPH_KURATIERT.length,
      }),
    );
    b.unmount();
  });
});

describe("R10 · Ohne die kuratierte Menge zeichnet die Seite wie heute — und behauptet nichts", () => {
  it("Knoten für Knoten und Kante für Kante unverändert, keine gesetzte Linie, kein Absturz", async () => {
    stand.mitKuratierten = false;
    const b = await montiere();
    expect(b.knotenGruppen().length).toBe(GRAPH_KNOTEN.length);
    expect(b.knotenGruppen().map(titelVon).sort()).toEqual(GRAPH_KNOTEN.map((k) => k.title).sort());
    expect(b.tagLinien().length).toBe(GRAPH_TAGKANTEN.length);
    expect(b.kuratierteLinien().length).toBe(0);
    b.unmount();
  });

  it("KEINE Leerbehauptung: weder eine Null-Zahl noch „geprüft konfliktfrei“", async () => {
    stand.mitKuratierten = false;
    const b = await montiere();
    const text = b.text();
    expect(text).not.toContain(i18n.t("graph.kuratiertCount", { count: 0 }));
    const klein = text.toLowerCase();
    for (const wort of ["konfliktfrei", "keine beziehungen", "aktuell geprüft"]) {
      expect(klein, `„${wort}" darf ohne gelieferte Menge nicht dastehen`).not.toContain(wort);
    }
    // Die Legende bleibt trotzdem vollständig: sie erklärt die Sprache des Bildes und ist keine
    // Bestandsaussage.
    expect(text).toContain(i18n.t("graph.legendKuratiert"));
    b.unmount();
  });
});

// ------------------------------------------------------------------------------------------------
// DIE ZUSAGE AM LAYOUT SELBST (DOM-frei) — „das heutige Ergebnis für Schlagwortkanten bleibt".
// ------------------------------------------------------------------------------------------------
// Das ist die Stelle, an der die Begrenzung großer Graphen kippen könnte: zählte `degrees()` die
// kuratierten Kanten mit, bekäme jeder Bestand mit gesetzten Beziehungen einen ANDEREN Ausschnitt —
// dieselben Daten, ein anderes Bild, ohne dass jemand darum gebeten hätte.
describe("Layout · die zweite Menge ist additiv und ändert die erste nicht", () => {
  /** 80 Knoten, damit `limitGraph` (Deckel 60 in GraphView) wirklich schneidet. */
  function grosserGraph(mitKuratierten: boolean): Graph {
    const nodes = Array.from({ length: 80 }, (_, i) => ({
      id: `n${String(i).padStart(2, "0")}`,
      title: `Knoten ${i}`,
    }));
    // Die ersten zehn Knoten sind über Schlagwörter stark verbunden, der Rest kaum.
    const edges = nodes.slice(0, 10).flatMap((a, i) =>
      nodes
        .slice(0, 10)
        .slice(i + 1)
        .map((c) => ({ a: a.id, b: c.id, via: "t" })),
    );
    const basis: Graph = { nodes, edges };
    if (!mitKuratierten) {
      return basis;
    }
    // ZWEI Gruppen, und die Aufteilung ist die Aussage des Falls:
    //   · 25 Kanten unter den SCHWACH verbundenen Knoten n70–n79. Zählten sie beim Grad mit,
    //     rutschten diese Knoten in den Ausschnitt und verdrängten andere.
    //   · 2 Kanten unter den stark verbundenen n00–n02, die der Deckel ohnehin behält. An ihnen
    //     hängt der Nachweis, dass die Menge MITGETRAGEN und nicht still weggelassen wird.
    const schwach = Array.from({ length: 25 }, (_, i) => ({
      a: "n70",
      b: `n${String(71 + (i % 9)).padStart(2, "0")}`,
      art: "ergaenzt" as const,
      richtung: "ungerichtet" as const,
      status: "aktiv" as const,
      herkunft: "kuratiert" as const,
    }));
    return {
      ...basis,
      kuratierteKanten: [
        ...schwach,
        {
          a: "n00",
          b: "n01",
          art: "ersetzt" as const,
          richtung: "gerichtet" as const,
          status: "aktiv" as const,
          herkunft: "kuratiert" as const,
        },
        {
          a: "n01",
          b: "n02",
          art: "gehoert_zu" as const,
          richtung: "ungerichtet" as const,
          status: "aktiv" as const,
          herkunft: "kuratiert" as const,
        },
      ],
    };
  }

  it("`limitGraph` behält dieselben Knoten und Schlagwortkanten wie ohne die zweite Menge", () => {
    const ohne = limitGraph(grosserGraph(false), 60);
    const mit = limitGraph(grosserGraph(true), 60);
    expect(mit.truncated).toBe(ohne.truncated);
    // DER KERN: die Knotenauswahl ist dieselbe, obwohl 25 kuratierte Kanten an n70–n79 hängen.
    expect(mit.graph.nodes.map((n) => n.id)).toEqual(ohne.graph.nodes.map((n) => n.id));
    expect(mit.graph.nodes.some((n) => n.id === "n70")).toBe(false);
    expect(mit.graph.edges).toEqual(ohne.graph.edges);
    // Die kuratierte Menge wird MITGETRAGEN — und nach derselben Regel beschnitten: übrig bleiben
    // genau die zwei Kanten, deren beide Knoten im Ausschnitt liegen.
    expect(mit.graph.kuratierteKanten?.map((k) => `${k.a}-${k.b}`)).toEqual(["n00-n01", "n01-n02"]);
    // Und „nicht geliefert" bleibt „nicht geliefert": kein leeres Feld, das Gelieferte vortäuscht.
    expect(ohne.graph.kuratierteKanten).toBeUndefined();
  });

  it("`limitGraph` beschneidet die zweite Menge nach derselben Regel wie die erste", () => {
    const wenige: Graph = {
      nodes: [{ id: "a", title: "A" }],
      edges: [],
      kuratierteKanten: [
        {
          a: "a",
          b: "weg",
          art: "ersetzt",
          richtung: "gerichtet",
          status: "aktiv",
          herkunft: "kuratiert",
        },
      ],
    };
    // Unter dem Deckel bleibt die Antwort unangetastet — auch die Kante auf den fehlenden Knoten,
    // denn `limitGraph` hat hier nichts entschieden. Das Layout lässt sie dann liegen.
    expect(limitGraph(wenige, 60).graph.kuratierteKanten?.length).toBe(1);
    expect(layoutGraph(wenige).kuratierteKanten.length).toBe(0);
  });

  it("`layoutGraph` bildet nur Paare ab, deren beide Knoten im Bild sind", () => {
    const g = graphMitKuratierten();
    const layout = layoutGraph(g);
    expect(layout.kuratierteKanten.length).toBe(GRAPH_KURATIERT.length);
    expect(layout.edges.length).toBe(GRAPH_TAGKANTEN.length);
    // Ohne das Feld ist die Liste leer — und keine der übrigen Zahlen verschiebt sich.
    const ohne = layoutGraph(graphOhneKuratierte());
    expect(ohne.kuratierteKanten).toEqual([]);
    expect(ohne.nodes).toEqual(layout.nodes);
    expect(ohne.edges).toEqual(layout.edges);
  });
});
