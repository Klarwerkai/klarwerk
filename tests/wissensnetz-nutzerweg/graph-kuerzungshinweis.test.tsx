// @vitest-environment jsdom
// ================================================================================================
// JOB 4328 · LIEFERUNG 1 — DIE KUERZUNG ERREICHT DEN NUTZER (der Produktrest aus JOB 4155).
// ================================================================================================
//
// DER BEFUND, DEN DIESE DATEI SCHLIESST, ist nicht meiner. BEN hat ihn in JOB 4155 R3 wörtlich
// festgehalten (`archiv/4155/runde-3/ben.md:25`):
//
//     „Die neue Kürzungsauskunft ist SERVERINTERN/API-seitig: Stufe2.tsx:2130 liest weiterhin nur
//      die ausgelieferte Menge."
//
// und `:39` als Promptverbesserung: „Zeige die Kürzung im Graphen an." Der Server sendet die
// Auskunft seit 4155 (`services/library-analytics/src/service.ts:2530-2533`), der Client-Typ kennt
// sie und sagt selbst, was ohne sie nicht behauptet werden darf (`api/types.ts:904-912`: „Wer die
// Beziehungen zeichnet, darf ohne diese beiden Felder nicht behaupten, den ganzen Bestand zu
// zeigen") — nur die Fläche schwieg.
//
// ------------------------------------------------------------------------------------------------
// DER SATZ NENNT DIE LIEFERZAHL — UND NICHT DIE ZEICHENZAHL
// ------------------------------------------------------------------------------------------------
//
// Das ist die Korrektur, die Codex am Auftrag angebracht hat (17.09., `67e1d5b7`, Punkt 2), und sie
// ist der Kern dieser Datei. `GraphView` zeichnet `layout.kuratierteKanten` — die Menge NACH dem
// Knotendeckel (`limitGraph`, `lib/graphLayout.ts:558-581` behält 60 Knoten und wirft jede Kante
// weg, die daran nicht mehr hängt). `raw.kuratierteKanten.length` ist dagegen die Zahl, die der
// SERVER GELIEFERT hat. Über dem Knotendeckel sind das zwei verschiedene Zahlen, und „5.000
// gezeichnet" wäre deshalb schlicht falsch. Der Satz sagt „geladen" und benennt den Ausschnitt.
//
// Fall (i) unten baut genau diese Lage — mehr als 60 Knoten, damit gezeichnet < geliefert ist — und
// verlangt beides: die zwei Lieferzahlen IM Satz, und die Zeichenzahl NICHT darin.
//
// ------------------------------------------------------------------------------------------------
// DREI LAGEN, DIE NICHT ZUSAMMENFALLEN DÜRFEN
// ------------------------------------------------------------------------------------------------
//   (i)   gekürzt          → der Satz steht, mit Lieferzahl und Gesamtzahl.
//   (ii)  nicht gekürzt    → KEIN Satz. Ein „5 von 5 geladen" wäre eine Beruhigung ohne Anlass.
//   (iii) Felder fehlen    → KEIN Satz und kein Absturz (Antwortform R10, ein Server ohne die
//                            Erweiterung aus JOB 4151). Eine erfundene 0 wäre eine Zahl, die
//                            niemand gemessen hat.
// Dazu (iv) DE/EN/NL: der Satz ist in jeder Sprache ein eigener und nicht der deutsche.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sprachbestand } from "../support/i18nBestand";

/** Der Bestand, den der gemockte Endpunkt je Fall ausliefert. */
const stand: { antwort: () => Graph } = { antwort: () => gekuerzterGraph() };

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "admin", stufe2: true, setStufe2: () => {} }),
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    library: { graph: vi.fn(async () => stand.antwort()) },
    conflicts: { list: vi.fn(async () => []) },
    ko: {
      list: vi.fn(async () =>
        stand.antwort().nodes.map((n) => ({
          id: n.id,
          title: n.title,
          version: 1,
          status: "validiert",
          tags: [],
          trust: 80,
          confidence: 80,
          type: "regel",
          category: "Betrieb",
          conditions: [],
          measures: [],
          author: "a",
          originalAuthor: "a",
        })),
      ),
    },
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
import type { Graph, GraphKuratierteKante, KantenArt } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { limitGraph } from "../../apps/web/src/lib/graphLayout";
import { GraphView } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Derselbe Wert wie `MAX_GRAPH_NODES` (`Stufe2.tsx:2283`) und `GRAPH_EDGE_LIMIT` (`service.ts:84`). */
const KNOTENDECKEL = 60;
const KANTENDECKEL = 5_000;
const ARTEN: readonly KantenArt[] = [
  "ergaenzt",
  "ersetzt",
  "widerspricht",
  "gehoert_zu",
  "beispiel_fuer",
];

/**
 * DIE GEKUERZTE ANTWORT — gebaut, nicht abgeschrieben.
 *
 * 107 Knoten (damit `limitGraph` wirklich schneidet), genau `KANTENDECKEL` gelieferte Fachkanten
 * und eine Gesamtzahl darüber. Die Paare sind so geordnet, dass ZUERST die kommen, bei denen
 * mindestens ein Endpunkt jenseits des Knotendeckels liegt: sie fallen bei `limitGraph` weg, und
 * damit ist „gezeichnet < geliefert" nicht behauptet, sondern gebaut.
 *
 * Ohne Schlagwortkanten (`edges: []`) haben alle Knoten den Grad 0; `limitGraph` behält dann die 60
 * ersten nach `id.localeCompare` (`graphLayout.ts:565-568`), also `ko-000` bis `ko-059`. Die
 * Kennungen sind deshalb auf gleiche Länge gepolstert — dieselbe Vorsicht wie in
 * `tests/wissensgraph-abnahme/graph-antwortbegrenzung.test.ts:51-55`.
 */
const KNOTEN_GESAMT = 107;
const GESAMT_KANTEN = 5_054;

function gekuerzterGraph(): Graph {
  const nodes = Array.from({ length: KNOTEN_GESAMT }, (_, i) => ({
    id: `ko-${String(i).padStart(3, "0")}`,
    title: `Grenzobjekt ${i}`,
  }));
  const weit: [number, number][] = [];
  const innen: [number, number][] = [];
  for (let a = 0; a < KNOTEN_GESAMT; a += 1) {
    for (let b = a + 1; b < KNOTEN_GESAMT; b += 1) {
      (a >= KNOTENDECKEL || b >= KNOTENDECKEL ? weit : innen).push([a, b]);
    }
  }
  const paare = [...weit, ...innen].slice(0, KANTENDECKEL);
  const kuratierteKanten: GraphKuratierteKante[] = paare.map(([a, b], i) => ({
    a: `ko-${String(a).padStart(3, "0")}`,
    b: `ko-${String(b).padStart(3, "0")}`,
    art: ARTEN[i % ARTEN.length] as KantenArt,
    richtung: "ungerichtet",
    status: "aktiv",
    herkunft: "kuratiert",
  }));
  return {
    nodes,
    edges: [],
    kuratierteKanten,
    kuratierteKantenGesamt: GESAMT_KANTEN,
    kuratierteKantenGekuerzt: true,
  };
}

/** Dieselben Knoten, aber UNTER dem Deckel: nichts ist gekürzt, und die Antwort sagt das auch. */
function ungekuerzterGraph(): Graph {
  const nodes = [
    { id: "ko-000", title: "Wartungsplan Halle 2" },
    { id: "ko-001", title: "Filterwechsel dokumentiert" },
    { id: "ko-002", title: "Dichtung sproede an Pumpe P2" },
  ];
  const kuratierteKanten: GraphKuratierteKante[] = [
    {
      a: "ko-000",
      b: "ko-001",
      art: "ergaenzt",
      richtung: "ungerichtet",
      status: "aktiv",
      herkunft: "kuratiert",
    },
    {
      a: "ko-001",
      b: "ko-002",
      art: "ersetzt",
      richtung: "gerichtet",
      status: "aktiv",
      herkunft: "kuratiert",
    },
  ];
  return {
    nodes,
    edges: [],
    kuratierteKanten,
    kuratierteKantenGesamt: kuratierteKanten.length,
    kuratierteKantenGekuerzt: false,
  };
}

/** Die Antwortform R10: ein Server ohne die Erweiterung aus JOB 4151 sendet die Felder nicht. */
function graphOhneGrenzauskunft(): Graph {
  const { nodes } = ungekuerzterGraph();
  return { nodes, edges: [] };
}

interface Buehne {
  text: () => string;
  hinweise: () => HTMLElement[];
  kuratierteLinien: () => HTMLElement[];
  knotenGruppen: () => Element[];
  unmount: () => void;
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i += 1) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

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
    // jsdom kennt kein `innerText`; die SICHTBARKEIT dieses Satzes ist ausdrücklich NICHT Sache
    // dieser Datei, sondern der Station (f) im echten Chromium (`strecke.ts`) und ihrer
    // Kalibrierung K1. Hier wird die AUSKUNFT geprüft: steht sie, mit welchen Zahlen, in welcher
    // Sprache — und wann sie NICHT steht.
    text: () => container.textContent ?? "",
    hinweise: () => [
      ...container.querySelectorAll<HTMLElement>('[data-testid="graph-kuratiert-gekuerzt"]'),
    ],
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

beforeEach(async () => {
  stand.antwort = () => gekuerzterGraph();
  await i18n.changeLanguage("de");
});

afterEach(async () => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
  await i18n.changeLanguage("de");
});

describe("JOB 4328 L1 · Der Graph sagt, wie viele Fachbeziehungen GELADEN wurden", () => {
  it("(i) gekürzt: der Satz nennt Lieferzahl und Gesamtzahl — und nicht die Zeichenzahl", async () => {
    const antwort = gekuerzterGraph();
    const geliefert = antwort.kuratierteKanten?.length ?? -1;
    const gesamt = antwort.kuratierteKantenGesamt ?? -1;
    // Die Zahl der WIRKLICH gezeichneten Linien — gerechnet mit derselben Funktion, die die Seite
    // benutzt. Sie ist kleiner als die Lieferzahl, und genau darum darf sie nicht im Satz stehen.
    const gezeichnet = limitGraph(antwort, KNOTENDECKEL).graph.kuratierteKanten?.length ?? -1;
    expect(geliefert, "die Vorrichtung liefert nicht genau den Deckel").toBe(KANTENDECKEL);
    expect(gesamt, "die Gesamtzahl muss über dem Deckel liegen").toBeGreaterThan(geliefert);
    expect(
      gezeichnet,
      "die Vorrichtung erzeugt keine Lage mit gezeichnet < geliefert",
    ).toBeLessThan(geliefert);

    const b = await montiere();
    const hinweise = b.hinweise();
    expect(hinweise.length, "der Kürzungshinweis steht genau einmal").toBe(1);
    const satz = hinweise[0]?.textContent ?? "";
    expect(satz, "der gerenderte Satz").toBe(
      i18n.t("graph.kuratiertGeladen", { geladen: geliefert, gesamt }),
    );
    expect(satz, "der Satz nennt die Lieferzahl").toContain(String(geliefert));
    expect(satz, "der Satz nennt die Gesamtzahl").toContain(String(gesamt));
    // GEZEICHNET IST NICHT GELIEFERT — weder die Zahl noch das Wort.
    expect(b.kuratierteLinien().length, "gezeichnete Linien").toBe(gezeichnet);
    expect(satz, "der Satz darf die Zeichenzahl nicht nennen").not.toContain(String(gezeichnet));
    for (const wort of ["gezeichnet", "drawn", "getekend"]) {
      expect(satz.toLowerCase(), `„${wort}" darf im Satz nicht vorkommen`).not.toContain(wort);
    }
    // Der Zählsatz nennt weiterhin die Lieferzahl, und der Knotenhinweis steht als EIGENER Satz
    // daneben — nicht mit dem neuen zusammengelegt.
    const text = b.text();
    expect(text, "der Zählsatz").toContain(i18n.t("graph.kuratiertCount", { count: geliefert }));
    expect(text, "der Knotenhinweis steht eigenständig daneben").toContain(
      i18n.t("graph.truncated", { n: KNOTENDECKEL }),
    );
    expect(b.knotenGruppen().length, "gezeichnete Knoten (Knotendeckel)").toBe(KNOTENDECKEL);
    b.unmount();
  });

  it("(ii) nicht gekürzt: KEIN Hinweis — eine Beruhigung ohne Anlass wäre eine Aussage zu viel", async () => {
    stand.antwort = () => ungekuerzterGraph();
    const b = await montiere();
    expect(b.hinweise().length, "ohne Kürzung darf kein Hinweis stehen").toBe(0);
    const text = b.text();
    expect(text, "auch der Satz selbst darf nicht dastehen").not.toContain(
      i18n.t("graph.kuratiertGeladen", { geladen: 2, gesamt: 2 }),
    );
    expect(text, "der Zählsatz bleibt").toContain(i18n.t("graph.kuratiertCount", { count: 2 }));
    expect(text, "ohne Knotenkürzung auch kein Knotenhinweis").not.toContain(
      i18n.t("graph.truncated", { n: KNOTENDECKEL }),
    );
    b.unmount();
  });

  it("(iii) Antwortform R10: ohne die Felder kein Hinweis, keine erfundene 0, kein Absturz", async () => {
    stand.antwort = () => graphOhneGrenzauskunft();
    const b = await montiere();
    expect(b.hinweise().length, "ohne gelieferte Grenzauskunft darf kein Hinweis stehen").toBe(0);
    expect(b.kuratierteLinien().length, "ohne gelieferte Menge keine Fachkante").toBe(0);
    expect(b.knotenGruppen().length, "die Knoten werden weiter gezeichnet").toBe(3);
    const text = b.text();
    for (const zahl of [0, 3]) {
      expect(text, `„geladen ${zahl}" wäre eine Zahl, die niemand gemessen hat`).not.toContain(
        i18n.t("graph.kuratiertGeladen", { geladen: zahl, gesamt: zahl }),
      );
    }
    expect(text, "die Legende bleibt — sie erklärt die Sprache des Bildes").toContain(
      i18n.t("graph.legendKuratiert"),
    );
    b.unmount();
  });

  it("(iv) DE/EN/NL: jede Sprache hat ihren eigenen Satz, keiner ist der deutsche", async () => {
    const deutsch = i18n.t("graph.kuratiertGeladen", { geladen: 5_000, gesamt: 5_054 });
    for (const sprache of ["en", "nl"] as const) {
      await i18n.changeLanguage(sprache);
      const eigen = i18n.t("graph.kuratiertGeladen", { geladen: 5_000, gesamt: 5_054 });
      expect(eigen, `${sprache}: der Satz ist der deutsche`).not.toBe(deutsch);
      const b = await montiere();
      const satz = b.hinweise()[0]?.textContent ?? "";
      expect(satz, `${sprache}: der gerenderte Satz`).toBe(eigen);
      expect(satz, `${sprache}: die Lieferzahl fehlt`).toContain("5000");
      expect(satz, `${sprache}: die Gesamtzahl fehlt`).toContain("5054");
      b.unmount();
      document.body.innerHTML = "";
    }
  });
});

// ------------------------------------------------------------------------------------------------
// DER KATALOG-ZEUGE — der neue Schlüssel ist in allen drei Sprachen da, die alten sind unberührt
// ------------------------------------------------------------------------------------------------
//
// WARUM DIE BESTEHENDEN VIER SCHLÜSSEL HIER MIT IHREM WORTLAUT STEHEN: der Auftrag erlaubt
// ausschliesslich ADDITIVE Katalogänderungen (`takt/schritte.py:6505-6517` führt `i18n.ts` als
// geteilten additiven Pfad). Ein Pin ist die einzige Form, die eine stille Umformulierung oder
// Umsortierung der Nachbarn auffallen lässt, ohne in diesem Lauf eine Fremdquelle (git) zu
// brauchen — dieselbe Bauform wie der Inhalts-Pin des Wortfensters
// (`tests/app/mega69-klara-waechter.test.ts`).
//
// JOB 4328 RUNDE 2 · WARUM HIER DER DATEINAME DES GEPINNTEN DOKUMENTS NICHT MEHR STEHT. Bis
// Runde 1 nannte diese Zeile das Vorbild mit seinem Dateinamen. Das Klara-Regressionsinventar
// (`tests/app/klara-regressionsinventar.test.ts`) sammelt seine Menge über INHALTSachsen, und seine
// zweite Achse (`:73-80`) sucht schlicht nach dem Namen der ausgelieferten Fensterdatei — ohne
// Rücksicht darauf, ob er in Code oder in einem Kommentar steht. Damit zog ein einzelnes Wort diese
// Datei in die Klara-Regressionsmenge, und K2 wurde zu Recht rot: „neu im Baum, aber nicht im
// gepinnten Inventar". Aus demselben Grund steht auch der Name jener Achse hier nicht: er ist
// zeichengleich mit dem gesuchten Wort, und diese Erklärung hätte sich sonst selbst eingefangen.
//
// DIE EHRLICHE KORREKTUR IST DIESE UND NICHT DIE NACHFÜHRUNG DES INVENTARS. Diese Datei misst den
// Kürzungshinweis des Wissensgraphen; sie lädt kein Aufgabenfenster, prüft keine Auslieferung und
// deckt an Klara nichts ab. Stünde sie im Inventar, liefe sie bei jeder Klara-Regression mit und
// behauptete eine Abdeckung, die sie nicht hat — genau die Verwässerung, vor der das Inventar bei
// seiner siebten Achse selbst warnt („Das ist keine Klara-Regressionsmenge mehr, sondern die halbe
// Web-App", `:124-126`). Der Verweis bleibt vollständig: der Testpfad steht eine Zeile höher.
const NEU = "graph.kuratiertGeladen";
const UNBERUEHRT: Record<string, Record<string, string>> = {
  de: {
    "graph.legendKuratiert": "gesetzte Fachbeziehung",
    "graph.kuratiertCount_one": "{{count}} gesetzte Fachbeziehung",
    "graph.kuratiertCount_other": "{{count}} gesetzte Fachbeziehungen",
    "graph.kuratiertKante": "gesetzt: {{art}} · {{richtung}}",
  },
  en: {
    "graph.legendKuratiert": "curated subject-matter relation",
    "graph.kuratiertCount_one": "{{count}} curated subject-matter relation",
    "graph.kuratiertCount_other": "{{count}} curated subject-matter relations",
    "graph.kuratiertKante": "curated: {{art}} · {{richtung}}",
  },
  nl: {
    "graph.legendKuratiert": "gezette vakrelatie",
    "graph.kuratiertCount_one": "{{count}} gezette vakrelatie",
    "graph.kuratiertCount_other": "{{count}} gezette vakrelaties",
    "graph.kuratiertKante": "gezet: {{art}} · {{richtung}}",
  },
};

describe("JOB 4328 L1 · Der Katalog trägt den neuen Satz — additiv, in allen drei Sprachen", () => {
  for (const sprache of ["de", "en", "nl"] as const) {
    it(`${sprache}: der neue Schlüssel ist da, nennt beide Werte und verspricht keine Zeichnung`, () => {
      const bestand = sprachbestand(sprache);
      const satz = bestand[NEU];
      expect(satz, `${sprache}: ${NEU} fehlt im Katalog`).toBeTruthy();
      expect(satz, `${sprache}: der Satz nennt die Lieferzahl nicht`).toContain("{{geladen}}");
      expect(satz, `${sprache}: der Satz nennt die Gesamtzahl nicht`).toContain("{{gesamt}}");
      for (const wort of ["gezeichnet", "drawn", "getekend"]) {
        expect(
          String(satz).toLowerCase(),
          `${sprache}: „${wort}" behauptet eine Zeichenzahl, die der Satz nicht kennt`,
        ).not.toContain(wort);
      }
    });

    it(`${sprache}: die vier bestehenden graph.kuratiert*-Sätze sind unverändert`, () => {
      const bestand = sprachbestand(sprache);
      for (const [schluessel, wortlaut] of Object.entries(UNBERUEHRT[sprache] ?? {})) {
        expect(bestand[schluessel], `${sprache}: ${schluessel} wurde verändert`).toBe(wortlaut);
      }
    });
  }
});
