// @vitest-environment jsdom
// SCHEIBE D-038 (Design-Lead, LIEFERUNG-20260814-BLOCK2 Z. 190-198) — VORSCHLAG (3):
// „Labels radial ausrichten statt zentriert, damit sie nach aussen laufen."
//
// Gemessener Befund vor dieser Datei: alle Knoten liegen auf EINEM Kreis (lib/graphLayout.ts:59-89),
// und jedes Label stand mit `textAnchor="middle"` 11 px ÜBER seinem Knoten (Stufe2.tsx:1561-1568).
// Auf einem Kreis heisst das: die Beschriftung des rechten Knotens laeuft nach links ins Bild
// hinein, ueber ihre Nachbarn hinweg. Radial ausgerichtet laeuft sie stattdessen nach aussen, wo
// der Platz ist.
//
// ==================================================================================================
// WAS DIESE DATEI NICHT BEWEIST — ausdruecklich benannt (Auftrag Z. 47-49).
// ==================================================================================================
// jsdom rechnet KEIN Layout: `getBBox`, `getComputedTextLength` und jede Pixelbreite sind hier nicht
// zu haben. Ob sich zwei Beschriftungen im Browser wirklich nicht mehr ueberlappen (ABNAHME 3), ist
// mit diesem Runner NICHT messbar und bleibt der optischen Endabnahme des Design-Leads.
//
// Messbar und deshalb hier festgehalten ist die ZUSICHERUNG, aus der die Wirkung folgt:
//   (a) kein Label steht mehr auf `middle` — jedes zeigt nach aussen (`start` rechts, `end` links),
//   (b) der Ankerpunkt jedes Labels liegt WEITER VOM MITTELPUNKT ENTFERNT als sein Knoten.
// Das ist eine geometrische Aussage ueber gesetzte Attribute, keine ueber gerenderte Pixel.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte", stufe2: true, setStufe2: () => {} }),
}));

// Ein bewusst kleiner, deterministischer Bestand: 6 Knoten auf dem Kreis, also drei rechts und
// drei links vom Mittelpunkt — beide Haelften kommen im Test vor.
const KNOTEN = ["ko-1", "ko-2", "ko-3", "ko-4", "ko-5", "ko-6"];

vi.mock("../../apps/web/src/api/endpoints", () => {
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    library: {
      graph: vi.fn(async () => ({
        nodes: KNOTEN.map((id, i) => ({ id, title: `Wissensobjekt Nummer ${i + 1}` })),
        edges: [
          { a: "ko-1", b: "ko-2", via: "ventil" },
          { a: "ko-3", b: "ko-4", via: "dosierung" },
        ],
      })),
    },
    ko: {
      list: vi.fn(async () =>
        KNOTEN.map((id, i) => ({
          id,
          title: `Wissensobjekt Nummer ${i + 1}`,
          status: "validiert",
          tags: ["ventil"],
          trust: 80,
          confidence: 80,
          type: "regel",
          category: "Betrieb",
          conditions: [],
          measures: [],
          version: 1,
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
      return new Proxy({}, { get: () => arrFn() });
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
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { GraphView } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function mount(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          ToastProvider,
          null,
          createElement(MemoryRouter, { initialEntries: ["/graph"] }, createElement(GraphView)),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

// Der Mittelpunkt kommt aus der viewBox des gerenderten SVG — nicht aus einer im Test wiederholten
// Konstante. Waere er hier nachgeschrieben, pruefte der Test seine eigene Annahme.
function mittelpunkt(): { cx: number; cy: number } {
  const svg = container.querySelector("svg");
  const box = (svg?.getAttribute("viewBox") ?? "").split(/\s+/).map(Number);
  const [, , w, h] = box;
  if (!w || !h) {
    throw new Error(`viewBox nicht lesbar: ${svg?.getAttribute("viewBox")}`);
  }
  return { cx: w / 2, cy: h / 2 };
}

interface Beschriftung {
  text: string;
  x: number;
  y: number;
  anchor: string;
  knotenX: number;
  knotenY: number;
}

// Jede Knotengruppe traegt genau einen Kreis und einen Text — beide werden zusammen erhoben, damit
// Label und Knoten sicher zueinander gehoeren.
function beschriftungen(): Beschriftung[] {
  const out: Beschriftung[] = [];
  for (const g of [...container.querySelectorAll("g")]) {
    const kreis = g.querySelector("circle");
    const text = g.querySelector("text");
    if (!kreis || !text) {
      continue;
    }
    out.push({
      text: text.textContent ?? "",
      x: Number(text.getAttribute("x")),
      y: Number(text.getAttribute("y")),
      anchor: text.getAttribute("text-anchor") ?? "",
      knotenX: Number(kreis.getAttribute("cx")),
      knotenY: Number(kreis.getAttribute("cy")),
    });
  }
  return out;
}

const abstand = (x: number, y: number, cx: number, cy: number): number =>
  Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("Scheibe D-038 (3): die Knotenbeschriftungen laufen nach aussen", () => {
  it("kein Label steht mehr zentriert — jedes zeigt von der Mitte weg", async () => {
    await mount();
    const labels = beschriftungen();
    // Kalibrierung: der Graph ist wirklich gezeichnet, mit allen sechs Knoten.
    expect(labels.length, "Kalibrierung: sechs beschriftete Knoten gerendert").toBe(KNOTEN.length);
    const { cx } = mittelpunkt();

    // Beide Kreishaelften kommen im Bestand vor — sonst pruefte der Fall nur eine Richtung.
    expect(
      labels.some((l) => l.knotenX > cx),
      "Kalibrierung: es gibt rechte Knoten",
    ).toBe(true);
    expect(
      labels.some((l) => l.knotenX < cx),
      "Kalibrierung: es gibt linke Knoten",
    ).toBe(true);

    const falsch = labels
      .filter((l) => {
        // Rechts von der Mitte laeuft die Schrift nach rechts (`start`), links nach links (`end`).
        const erwartet = l.knotenX > cx ? "start" : "end";
        return l.anchor !== erwartet;
      })
      .map((l) => `${l.text}: anchor=${l.anchor || "(keiner)"} bei x=${l.knotenX}`);
    expect(falsch, "Labels ohne radiale Ausrichtung").toEqual([]);
  });

  it("der Ankerpunkt liegt weiter aussen als der Knoten selbst", async () => {
    await mount();
    const { cx, cy } = mittelpunkt();
    const labels = beschriftungen();
    expect(labels.length).toBe(KNOTEN.length);

    const zuNah = labels
      .filter((l) => {
        const knoten = abstand(l.knotenX, l.knotenY, cx, cy);
        const label = abstand(l.x, l.y, cx, cy);
        return label <= knoten;
      })
      .map(
        (l) =>
          `${l.text}: Knoten ${abstand(l.knotenX, l.knotenY, cx, cy).toFixed(1)} → ` +
          `Label ${abstand(l.x, l.y, cx, cy).toFixed(1)}`,
      );
    expect(zuNah, "Labels, die nicht nach aussen versetzt sind").toEqual([]);
  });
});
