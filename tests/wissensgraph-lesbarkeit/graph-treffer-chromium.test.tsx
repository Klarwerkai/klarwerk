// ================================================================================================
// JOB 3103 (UX-07) — R1 UND R3 AN GERENDERTER SCHRIFT: Chromium misst, was jsdom nicht kann.
// ================================================================================================
// Die Zeichnung von GraphView wird ohne Browser-DOM zu Markup gerendert (react-dom/server, mit
// vorgefülltem Query-Cache) und in ein headless Chromium geladen. Dort gibt es echte
// Textrechtecke (`getBoundingClientRect`) und echten Treffertest (`elementFromPoint`) — genau die
// Messung, mit der die Nutzerprüfung N-0011 den Fehler fand („In der geometrischen Mitte der
// Linkfläche des eigenen Langtexts trifft elementFromPoint die Beschriftung des Sturzprotokolls").
//
// WAS DIESE DATEI NICHT BEWEIST: sie lädt nicht die gebaute App mit ihrem Stylesheet, sondern das
// SVG mit dem Schriftstapel der App (`IBM Plex Sans, system-ui, sans-serif`, tailwind.config) und
// der Schriftgröße der Beschriftung. Welche Schrift Chromium daraus auflöst, hängt vom Rechner ab;
// die Breitenschätzung des Layouts (textbreite, kalibriert auf Plex 600/700 mit 8 % Luft) muss
// jede davon abdecken — misst diese Datei rot, ist die Schätzung zu knapp, nicht der Test zu streng.
import { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GRAPH, ID_VON_TITEL, KNOTEN, KONFLIKTE, TITEL, kosBestand } from "./bestand";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte", stufe2: true, setStufe2: () => {} }),
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    library: { graph: vi.fn(async () => GRAPH) },
    conflicts: { list: vi.fn(async () => KONFLIKTE) },
    ko: { list: vi.fn(async () => kosBestand()) },
  };
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => arrFn() });
    },
  });
  return { endpoints };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { createElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { GraphView } from "../../apps/web/src/pages/Stufe2";

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
interface Messung {
  texte: { titel: string; label: string; rect: Rect }[];
  kreise: { titel: string; rect: Rect }[];
  treffer: { titel: string; mitte: [number, number]; getroffen: string | null; tag: string }[];
}

interface Browser {
  version(): string;
  newPage(o: Record<string, unknown>): Promise<Page>;
  close(): Promise<void>;
}
interface Page {
  setContent(html: string): Promise<void>;
  evaluate<T>(fn: () => T): Promise<T>;
}

let browser: Browser | null = null;
let messung: Messung;

function markup(): string {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["graph"], GRAPH);
  qc.setQueryData(["kos", undefined], kosBestand());
  qc.setQueryData(["conflicts"], KONFLIKTE);
  const html = renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(MemoryRouter, { initialEntries: ["/graph"] }, createElement(GraphView)),
    ),
  );
  const svg = html.match(/<svg[\s\S]*<\/svg>/)?.[0];
  if (!svg) {
    throw new Error(`kein <svg> im gerenderten Markup: ${html.slice(0, 400)}`);
  }
  return svg;
}

const eps = 0.5;
const schneidet = (a: Rect, b: Rect): boolean =>
  a.left < b.right - eps &&
  b.left < a.right - eps &&
  a.top < b.bottom - eps &&
  b.top < a.bottom - eps;

const idVon = (titel: string): string => ID_VON_TITEL.get(titel) ?? `?(${titel})`;

beforeAll(async () => {
  await i18n.changeLanguage("de");
  const svg = markup();
  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright") as {
    chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
  };
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  // Bühne wie im Beleg: Karte in `max-w-3xl` (768 px) bei 1440 px Fensterbreite → das SVG ist rund
  // 720 px breit. Die Beschriftungsklasse `text-[9px]` der alten Fassung wird nachgestellt, damit
  // die Messung VOR dem Bau die alte Schriftgröße trifft und nicht Chromiums 16-px-Vorgabe.
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0;font-family:"IBM Plex Sans",system-ui,sans-serif}
      .buehne{width:720px;padding:24px}
      svg{width:100%;display:block}
      .text-\\[9px\\]{font-size:9px}
    </style></head><body><div class="buehne">${svg}</div></body></html>`,
  );
  messung = await page.evaluate(() => {
    const r = (el: Element): Rect => {
      const b = el.getBoundingClientRect();
      return { left: b.left, top: b.top, right: b.right, bottom: b.bottom };
    };
    const titelVon = (g: Element): string => {
      const t = g.querySelector(":scope > title")?.textContent;
      if (t) {
        return t;
      }
      // Vor Lieferung 3 gab es kein <title>; das aria-label trägt „Wissensobjekt öffnen: <Titel>".
      const aria = g.getAttribute("aria-label") ?? "";
      return aria.replace(/^[^:]*:\s*/, "");
    };
    const gruppen = [...document.querySelectorAll("svg g")].filter((g) =>
      g.querySelector(":scope > circle"),
    );
    const texte = gruppen.map((g) => {
      const t = g.querySelector(":scope > text") as Element;
      return { titel: titelVon(g), label: t.textContent ?? "", rect: r(t) };
    });
    const kreise = gruppen.map((g) => ({
      titel: titelVon(g),
      rect: r(g.querySelector(":scope > circle") as Element),
    }));
    const treffer = gruppen.map((g) => {
      const b = g.getBoundingClientRect();
      const mx = b.left + b.width / 2;
      const my = b.top + b.height / 2;
      const el = document.elementFromPoint(mx, my);
      const eigentuemer = el?.closest("g[role='link']") ?? null;
      return {
        titel: titelVon(g),
        mitte: [mx, my] as [number, number],
        getroffen: eigentuemer ? titelVon(eigentuemer) : null,
        tag: el?.tagName ?? "nichts",
      };
    });
    return { texte, kreise, treffer };
  });
}, 90_000);

afterAll(async () => {
  await browser?.close();
}, 60_000);

describe("UX-07 · R1 (Chromium): kein Textrechteck schneidet ein anderes", () => {
  it("Kalibrierung: 28 Knoten, 28 gerenderte Beschriftungen mit Breite", () => {
    expect(messung.texte.length).toBe(TITEL.length);
    expect(messung.texte.every((t) => t.rect.right - t.rect.left > 5)).toBe(true);
    expect(new Set(messung.texte.map((t) => idVon(t.titel))).size).toBe(KNOTEN.length);
  });

  it("R1 · über alle 28 Beschriftungen: keine zwei überlappen einander", () => {
    const fehl: string[] = [];
    for (let i = 0; i < messung.texte.length; i++) {
      for (let j = i + 1; j < messung.texte.length; j++) {
        const a = messung.texte[i] as Messung["texte"][number];
        const b = messung.texte[j] as Messung["texte"][number];
        if (schneidet(a.rect, b.rect)) {
          fehl.push(`${idVon(a.titel)} „${a.label}" × ${idVon(b.titel)} „${b.label}"`);
        }
      }
    }
    expect(fehl, "überlappende Beschriftungspaare").toEqual([]);
  });

  it("keine Beschriftung liegt über dem Kreis eines anderen Knotens", () => {
    const fehl: string[] = [];
    for (const t of messung.texte) {
      for (const k of messung.kreise) {
        if (t.titel !== k.titel && schneidet(t.rect, k.rect)) {
          fehl.push(`„${t.label}" (${idVon(t.titel)}) über Kreis ${idVon(k.titel)}`);
        }
      }
    }
    expect(fehl).toEqual([]);
  });
});

describe("UX-07 · R3 (Chromium): die Mitte der Linkfläche trifft den eigenen Knoten", () => {
  it("R3 · elementFromPoint in der Mitte jeder Linkfläche liefert diesen Knoten — alle 28", () => {
    expect(messung.treffer.length).toBe(TITEL.length);
    const fehl = messung.treffer
      .filter((t) => t.getroffen !== t.titel)
      .map(
        (t) =>
          `${idVon(t.titel)} (${t.mitte[0].toFixed(1)}|${t.mitte[1].toFixed(1)}) → ${t.getroffen ? idVon(t.getroffen) : "nichts"} [${t.tag}]`,
      );
    expect(fehl, "Knoten, deren Linkflächen-Mitte einen anderen oder keinen Knoten trifft").toEqual(
      [],
    );
  });
});
