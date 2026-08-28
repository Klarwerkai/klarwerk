// @vitest-environment jsdom
// ================================================================================================
// JOB 2600 · D1 — DIE THEMENKARTE AM ECHTEN RENDERER.
// ================================================================================================
//
// Die Regeln stehen in `tests/wissensnetz/themenkarte.test.ts` (DOM-frei). Diese Datei prueft den
// SICHTBAREN Vertrag: Erscheint die Karte? Traegt ein Knoten seine Groesse und seine Farbe?
// Fuehrt der Klick in die BESTEHENDE, gefilterte Bibliotheksliste?
//
// Bauform wie die Nachbarn (`nav-badges-sidebar-mounted.test.tsx:17-20`): jsdom, relative Importe
// ueber `../../apps/web/node_modules/…`, gehoisteter endpoints-Mock. Die Endpointgrenze ist die
// einzige Attrappe — Seite, i18n, React-Query und Router sind echt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const d = vi.hoisted(() => {
  const state = { resolve: (_v: unknown) => {} };
  const fn = vi.fn(
    () =>
      new Promise((resolve) => {
        state.resolve = resolve;
      }),
  );
  return { fn, resolve: (v: unknown) => state.resolve(v) };
});

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { wissensnetz: { luecken: d.fn } },
}));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { Wissensnetz, ringplaetze, themenHref } from "../../apps/web/src/pages/Wissensnetz";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
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
          MemoryRouter,
          { initialEntries: ["/wissensnetz"] },
          createElement(Wissensnetz),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
}

const KARTE = {
  objekteGesamt: 6,
  ohneThema: 0,
  sichtbareBeitragendeGesamt: 2,
  themen: [],
  themenkarte: {
    themen: [
      { thema: "pumpe", objekte: 4, farbe: "belegt", ohneKanten: false },
      { thema: "dichtung", objekte: 2, farbe: "freigegeben", ohneKanten: false },
      { thema: "pilot-demo", objekte: 6, farbe: "offen", ohneKanten: true },
    ],
    kanten: [{ a: "dichtung", b: "pumpe", gewicht: 2 }],
    weitere: ["randthema"],
    weitereAbgeschnitten: false,
    mindesthaeufigkeit: 1,
  },
};

function knoten(): Element[] {
  return [...container.querySelectorAll('[data-testid="themenknoten"]')];
}

function knotenFuer(thema: string): Element | null {
  return container.querySelector(`[data-testid="themenknoten"][data-thema="${thema}"]`);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("JOB 2600 D1: die Themenkarte auf der bestehenden Oberflaeche", () => {
  it("K1 · die Karte erscheint, mit einem Knoten je Thema", async () => {
    await mount();
    await act(async () => {
      d.resolve(KARTE);
      await flush();
    });

    expect(container.querySelector('[data-testid="themenkarte"]')).not.toBeNull();
    expect(knoten().length).toBe(3);
    expect(knotenFuer("pumpe")).not.toBeNull();
  });

  it("K2 · Knotengroesse folgt der Menge zugeordneten Wissens", async () => {
    await mount();
    await act(async () => {
      d.resolve(KARTE);
      await flush();
    });

    const gross = knotenFuer("pilot-demo")?.querySelector("circle");
    const mittel = knotenFuer("pumpe")?.querySelector("circle");
    const klein = knotenFuer("dichtung")?.querySelector("circle");
    const r = (el: Element | null | undefined) => Number(el?.getAttribute("r") ?? "0");
    // 6 > 4 > 2 Traeger ⇒ streng fallende Radien. Die Zahl steht am Knoten, nicht im Bild.
    expect(r(gross)).toBeGreaterThan(r(mittel));
    expect(r(mittel)).toBeGreaterThan(r(klein));
    expect(knotenFuer("pumpe")?.getAttribute("data-objekte")).toBe("4");
  });

  it("K3 · die Farbe traegt den Freigabe- und Quellenstatus — drei Werte, keine Prozente", async () => {
    await mount();
    await act(async () => {
      d.resolve(KARTE);
      await flush();
    });

    expect(knotenFuer("pumpe")?.getAttribute("data-farbe")).toBe("belegt");
    expect(knotenFuer("dichtung")?.getAttribute("data-farbe")).toBe("freigegeben");
    expect(knotenFuer("pilot-demo")?.getAttribute("data-farbe")).toBe("offen");
    // Keine Prozentanzeige irgendwo auf der Seite (§3 des Auftrags).
    expect(container.textContent ?? "").not.toMatch(/\d+\s*%/);
  });

  it("K4 · eine Kante wird gezeichnet — und nie an einem ubiquitaeren Thema", async () => {
    await mount();
    await act(async () => {
      d.resolve(KARTE);
      await flush();
    });

    const kanten = [...container.querySelectorAll('[data-testid="themenkante"]')];
    expect(kanten.length).toBe(1);
    expect(kanten[0]?.getAttribute("data-a")).toBe("dichtung");
    expect(kanten[0]?.getAttribute("data-b")).toBe("pumpe");
    expect(
      kanten.some((k) => k.getAttribute("data-a") === "pilot-demo"),
      "eine Kante haengt am ubiquitaeren Thema",
    ).toBe(false);
  });

  it("K5 · der Klick fuehrt in die BESTEHENDE, gefilterte Bibliotheksliste", async () => {
    await mount();
    await act(async () => {
      d.resolve(KARTE);
      await flush();
    });

    const link = knotenFuer("pumpe")?.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/bibliothek?tag=pumpe");
    // Der Name reist kodiert — ein Schlagwort mit Leerzeichen darf die URL nicht zerbrechen.
    expect(themenHref("dampf turbine")).toBe("/bibliothek?tag=dampf%20turbine");
  });

  it("K6 · „Alle Themen“ zeigt die uebrigen Namen, und erst auf Klick", async () => {
    await mount();
    await act(async () => {
      d.resolve(KARTE);
      await flush();
    });

    expect(container.querySelector('[data-testid="alle-themen-liste"]')).toBeNull();
    const schalter = container.querySelector('[data-testid="alle-themen-schalter"]');
    expect(schalter).not.toBeNull();
    await act(async () => {
      (schalter as HTMLButtonElement).click();
      await flush();
    });
    const liste = container.querySelector('[data-testid="alle-themen-liste"]');
    expect(liste?.textContent).toContain("randthema");
  });

  it("K7 · ohne Schlagwoerter sagt die Seite das, statt eine leere Karte zu zeigen", async () => {
    await mount();
    await act(async () => {
      d.resolve({ ...KARTE, themenkarte: { ...KARTE.themenkarte, themen: [], kanten: [] } });
      await flush();
    });

    expect(container.querySelector('[data-testid="themenkarte"]')).toBeNull();
    expect(container.textContent).toContain(i18n.t("wissensnetz.leer"));
  });

  it("K8 · das Ringlayout ist deterministisch und haengt nicht am Zufall", () => {
    const themen = [
      { thema: "a", objekte: 3, farbe: "offen" as const, ohneKanten: false },
      { thema: "b", objekte: 1, farbe: "offen" as const, ohneKanten: false },
    ];
    expect(ringplaetze(themen)).toEqual(ringplaetze(themen));
    expect(ringplaetze([])).toEqual([]);
    // Gleiche Groesse ⇒ gleicher Radius; eine Division durch null gibt es nicht.
    const gleich = ringplaetze([
      { thema: "a", objekte: 2, farbe: "offen" as const, ohneKanten: false },
      { thema: "b", objekte: 2, farbe: "offen" as const, ohneKanten: false },
    ]);
    expect(gleich[0]?.r).toBe(gleich[1]?.r);
  });
});
