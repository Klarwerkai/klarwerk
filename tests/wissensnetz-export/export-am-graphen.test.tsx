// @vitest-environment jsdom
// ================================================================================================
// R-0711 · DER EXPORT AN DER ECHTEN SEITE `/graph` — WAS DIE PERSON HERUNTERLÄDT.
// ================================================================================================
//
// Gemountet wird `GraphView` mit einer `/api/graph`-Antwort aus 70 Knoten. Das Bild zeigt davon
// höchstens 60 (`MAX_GRAPH_NODES`); die Datei muss ALLE 70 tragen — sonst wäre der Export ein
// Bildausschnitt und nicht das Wissensnetz. Gelesen wird die heruntergeladene Datei mit dem
// XML-Parser des DOM: was er nicht lesen kann, liest auch kein fremdes Werkzeug.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Graph, GraphKuratierteKante } from "../../apps/web/src/api/types";
import { alsKo } from "../wissensgraph-anzeige/bestand";

const KNOTEN = Array.from({ length: 70 }, (_, i) => ({
  id: `n${String(i + 1).padStart(2, "0")}`,
  title: `Eintrag ${i + 1}${i === 4 ? " <Ventil & Dichtung>" : ""}`,
}));
// Eine Kette über alle Knoten — jeder ist verbunden, der Bilddeckel muss also wirklich kürzen.
const SCHLAGWORTKANTEN = KNOTEN.slice(1).map((n, i) => ({
  a: KNOTEN[i]?.id ?? "",
  b: n.id,
  via: `thema-${i % 5}`,
}));
const KURATIERT: GraphKuratierteKante[] = [
  {
    a: "n01",
    b: "n70",
    art: "ersetzt",
    richtung: "gerichtet",
    status: "aktiv",
    herkunft: "kuratiert",
  },
];

const stand: { graph: Graph } = { graph: { nodes: [], edges: [] } };

function antwort(ueber: Partial<Graph> = {}): Graph {
  return {
    nodes: [...KNOTEN],
    edges: [...SCHLAGWORTKANTEN],
    totalEdges: SCHLAGWORTKANTEN.length,
    truncated: false,
    edgeLimit: 5000,
    excludedTags: [],
    kuratierteKanten: [...KURATIERT],
    kuratierteKantenGesamt: KURATIERT.length,
    kuratierteKantenGekuerzt: false,
    ...ueber,
  };
}

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte", stufe2: true, setStufe2: () => {} }),
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    library: { graph: vi.fn(async () => stand.graph) },
    conflicts: { list: vi.fn(async () => []) },
    ko: {
      list: vi.fn(async () => KNOTEN.map((k) => alsKo({ id: k.id, title: k.title, version: 1 }))),
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
import i18n from "../../apps/web/src/i18n";
import { GraphView } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NS = "http://graphml.graphdrawing.org/xmlns";

const flush = async (): Promise<void> => {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

let aufraeumen: (() => void) | null = null;

async function montiere(): Promise<HTMLElement> {
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
  aufraeumen = () => {
    act(() => root.unmount());
    container.remove();
  };
  return container;
}

function knopf(container: HTMLElement): HTMLButtonElement {
  const b = [...container.querySelectorAll("button")].find(
    (el) => el.textContent?.trim() === i18n.t("netzexport.knopf"),
  );
  if (!b) {
    throw new Error("Exportknopf fehlt");
  }
  return b;
}

function lies(blob: Blob): Promise<string> {
  return new Promise((ok, fehler) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => fehler(r.error);
    r.readAsText(blob);
  });
}

/** Klickt den Knopf und liefert Dateiname, Medientyp und Inhalt der heruntergeladenen Datei. */
async function herunterladen(
  container: HTMLElement,
): Promise<{ name: string; typ: string; text: string }> {
  const blobs: Blob[] = [];
  URL.createObjectURL = vi.fn((b: Blob) => {
    blobs.push(b);
    return "blob:wissensnetz";
  });
  URL.revokeObjectURL = vi.fn();
  const namen: string[] = [];
  const klick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    namen.push(this.download);
  });
  await act(async () => {
    knopf(container).click();
    await flush();
  });
  klick.mockRestore();
  expect(blobs).toHaveLength(1);
  expect(namen).toHaveLength(1);
  const blob = blobs[0] as Blob;
  return { name: namen[0] ?? "", typ: blob.type, text: await lies(blob) };
}

function parse(text: string): Document {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  const fehler = doc.getElementsByTagName("parsererror");
  expect(fehler.length, fehler[0]?.textContent ?? "").toBe(0);
  return doc;
}

function datenVon(el: Element, schluessel: string): string | undefined {
  const d = [...el.children].find(
    (c) => c.localName === "data" && c.getAttribute("key") === schluessel,
  );
  return d === undefined ? undefined : (d.textContent ?? "");
}

beforeEach(async () => {
  stand.graph = antwort();
  await i18n.changeLanguage("de");
});

afterEach(() => {
  aufraeumen?.();
  aufraeumen = null;
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("R-0711 · Wissensnetz-Export an /graph", () => {
  it("E1 · der Knopf steht an der Seite und erklärt Format und Weiterverwendung", async () => {
    const c = await montiere();
    knopf(c);
    const bereich = c.querySelector('[data-testid="wissensnetz-export"]');
    expect(bereich?.textContent).toContain(i18n.t("netzexport.erklaerung"));
    expect(bereich?.textContent).toContain("GraphML");
    expect(c.querySelector('[data-testid="wissensnetz-export-gekuerzt"]')).toBeNull();
  });

  it("E2 · die Datei ist lesbares GraphML und trägt ALLE 70 Knoten, nicht den Bildausschnitt", async () => {
    const c = await montiere();
    // Kalibrierung: das Bild zeigt wirklich weniger Knoten, als die Antwort hat.
    const gezeichnet = [...c.querySelectorAll("svg g")].filter(
      (g) => g.querySelector(":scope > circle") !== null,
    ).length;
    expect(gezeichnet).toBeLessThan(KNOTEN.length);

    const datei = await herunterladen(c);
    expect(datei.name).toBe("klarwerk-wissensnetz.graphml");
    expect(datei.typ.startsWith("application/graphml+xml")).toBe(true);

    const doc = parse(datei.text);
    expect(doc.documentElement.namespaceURI).toBe(NS);
    const knoten = [...doc.getElementsByTagNameNS(NS, "node")];
    expect(knoten.map((n) => n.getAttribute("id"))).toEqual(KNOTEN.map((k) => k.id));
    expect(knoten.map((n) => datenVon(n, "n_titel"))).toEqual(KNOTEN.map((k) => k.title));

    // Jede Kante zwischen vorhandenen Knoten, jeder benutzte Schlüssel deklariert.
    const ids = new Set(KNOTEN.map((k) => k.id));
    const kanten = [...doc.getElementsByTagNameNS(NS, "edge")];
    expect(kanten).toHaveLength(SCHLAGWORTKANTEN.length + KURATIERT.length);
    for (const e of kanten) {
      expect(ids.has(e.getAttribute("source") ?? "")).toBe(true);
      expect(ids.has(e.getAttribute("target") ?? "")).toBe(true);
    }
    const deklariert = new Set(
      [...doc.getElementsByTagNameNS(NS, "key")].map((k) => k.getAttribute("id")),
    );
    for (const d of [...doc.getElementsByTagNameNS(NS, "data")]) {
      expect(deklariert.has(d.getAttribute("key")), d.getAttribute("key") ?? "").toBe(true);
    }

    // Die gesetzte Fachbeziehung bleibt als solche erkennbar und gerichtet.
    const kuratiert = kanten.filter((e) => datenVon(e, "e_herkunft") === "kuratiert");
    expect(kuratiert).toHaveLength(1);
    expect(kuratiert[0]?.getAttribute("directed")).toBe("true");
    expect(datenVon(kuratiert[0] as Element, "e_art")).toBe("ersetzt");
    expect(kanten.filter((e) => datenVon(e, "e_herkunft") === "schlagwort")).toHaveLength(
      SCHLAGWORTKANTEN.length,
    );
  });

  it("E3 · eine gekürzte Antwort: die Seite sagt es, die Datei nennt die Gesamtzahl", async () => {
    stand.graph = antwort({ totalEdges: 7001, truncated: true });
    const c = await montiere();
    expect(c.querySelector('[data-testid="wissensnetz-export-gekuerzt"]')?.textContent).toBe(
      i18n.t("netzexport.gekuerzt"),
    );
    const doc = parse((await herunterladen(c)).text);
    const graph = doc.getElementsByTagNameNS(NS, "graph")[0] as Element;
    expect(datenVon(graph, "g_schlagwortkantenGesamt")).toBe("7001");
    expect(datenVon(graph, "g_schlagwortkantenGekuerzt")).toBe("true");
  });

  it("E4 · der Knopf ist in allen drei Sprachen beschriftet", async () => {
    for (const sprache of ["de", "en", "nl"]) {
      await i18n.changeLanguage(sprache);
      const text = i18n.t("netzexport.knopf");
      expect(text, sprache).not.toBe("netzexport.knopf");
      expect(text, sprache).toContain("GraphML");
    }
  });
});
