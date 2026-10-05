// @vitest-environment jsdom
// ================================================================================================
// N-0011 / N-0024 — DIE FILTERBARE VOLLTITELLISTE AM WISSENSGRAPHEN, FUNKTION UND NAVIGATION.
// ================================================================================================
//
// Wortlaut N-0024: „Eine filterbare Liste mit vollständigen Titeln ergänzen; … auf schmalen Fenstern
// eine gut bedienbare Listenansicht anbieten." N-0011: „eine synchronisierte lesbare Objektliste als
// weiteren Einstieg anbieten." Fläche: /graph → `GraphView` (`apps/web/src/pages/Stufe2.tsx`),
// Bestand: die 28 Titel aus dem Beleg N-0011 (`tests/wissensgraph-lesbarkeit/bestand.ts`).
//
//   V1  jeder gezeichnete Knoten steht mit VOLLSTÄNDIGEM Titel in der Liste; ein Kontrollobjekt, das
//       der Bestand kennt, die Graphantwort aber nicht trägt, erscheint dort nicht
//   V2  ein unterscheidender Titelteil im Filter → genau die erwarteten Objekt-IDs; Zurücksetzen →
//       dieselbe Ausgangsmenge wie vorher
//   V3  Treffer per KLICK → die echte Router-Navigation erreicht /wissen/<erwartete-id>
//   V4  Treffer per TASTATUR (Enter, Leertaste) → ebenso
//   V5  kein Treffer → ehrlicher Satz statt leerer Liste; das Kontrollobjekt bleibt draußen
//   V6  ein Knoten, dessen Objekt der Bestand nicht kennt → in der Liste Text ohne Link (wie im Bild)
//
// WAS DIESE DATEI NICHT BELEGT: jsdom rechnet kein Layout. Ob die Liste auf 390 px geometrisch gut
// bedienbar ist, misst nur ein echter Browser (vorhandener Chromium-Prüfweg); hier geht es um
// Funktion und Navigation.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GRAPH, KNOTEN, KONFLIKTE, kosBestand } from "../wissensgraph-lesbarkeit/bestand";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte", stufe2: true, setStufe2: () => {} }),
}));

/** Im Bestand bekannt, in der Graphantwort NICHT enthalten. */
const KONTROLLE = {
  id: "kontrolle-1",
  title: "NUTZERPRUEFUNG Kontrollobjekt ausserhalb des Graphen",
};

const schalter: { ohneN28: boolean } = { ohneN28: false };

vi.mock("../../apps/web/src/api/endpoints", () => {
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    library: { graph: vi.fn(async () => GRAPH) },
    conflicts: { list: vi.fn(async () => KONFLIKTE) },
    ko: {
      list: vi.fn(async () => {
        const vorlage = kosBestand()[0] as Record<string, unknown>;
        const alle = [...kosBestand(), { ...vorlage, ...KONTROLLE }];
        return schalter.ohneN28 ? alle.filter((k) => k.id !== "n28") : alle;
      }),
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
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { koDetailPath } from "../../apps/web/src/lib/graphNav";
import { GraphView } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let steht = false;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Die Sonde auf der Detailroute zeigt den ERREICHTEN Pfad — aus dem Router, nicht aus dem Link. */
function Sonde(): JSX.Element {
  const ort = useLocation();
  return createElement("div", { "data-testid": "sonde" }, ort.pathname);
}

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
          createElement(
            MemoryRouter,
            { initialEntries: ["/graph"] },
            createElement(
              Routes,
              null,
              createElement(Route, { path: "/graph", element: createElement(GraphView) }),
              createElement(Route, { path: "/wissen/:id", element: createElement(Sonde) }),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  steht = true;
}

function abbauen(): void {
  if (!steht) return;
  act(() => root.unmount());
  container.remove();
  steht = false;
}

const marke = (id: string): Element | null => container.querySelector(`[data-testid="${id}"]`);
const eintraege = (): Element[] => [...container.querySelectorAll('[data-testid="graph-objekt"]')];
const ids = (): string[] => eintraege().map((e) => e.getAttribute("data-id") ?? "?");
const link = (id: string): HTMLAnchorElement | null =>
  container.querySelector(`[data-testid="graph-objekt"][data-id="${id}"] a`);

async function filtere(wert: string): Promise<void> {
  const feld = marke("graph-objektliste-filter") as HTMLInputElement | null;
  expect(feld, "das Filterfeld der Liste").not.toBeNull();
  const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setzer?.call(feld, wert);
    feld?.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

const ALLE_IDS = KNOTEN.map((k) => k.id).sort();

beforeEach(async () => {
  schalter.ohneN28 = false;
  await i18n.changeLanguage("de");
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("N-0011 / N-0024 · die Volltitelliste am Graphen", () => {
  it("V1 · jeder gezeichnete Knoten steht mit vollständigem Titel in der Liste — das Kontrollobjekt nicht", async () => {
    await mount();
    expect(marke("graph-objektliste"), "die Liste steht auf /graph").not.toBeNull();
    expect([...ids()].sort()).toEqual(ALLE_IDS);
    for (const k of KNOTEN) {
      expect(link(k.id)?.textContent, `${k.id}: vollständiger Titel`).toBe(k.title);
      expect(link(k.id)?.getAttribute("href")).toBe(koDetailPath(k.id));
    }
    expect(ids()).not.toContain(KONTROLLE.id);
    expect(marke("graph-objektliste")?.textContent ?? "").not.toContain(KONTROLLE.title);
    // Die Liste ist bedienbar: ein beschriftetes Feld und Links in der Tab-Reihenfolge.
    const feld = marke("graph-objektliste-filter");
    expect(container.querySelector(`label[for="${feld?.getAttribute("id")}"]`)).not.toBeNull();
    expect(Number(link("n01")?.getAttribute("tabindex") ?? "0")).toBeGreaterThanOrEqual(0);
  });

  it("V2 · ein unterscheidender Titelteil trifft genau die erwarteten IDs; Zurücksetzen stellt die Ausgangsmenge her", async () => {
    await mount();
    const ausgang = [...ids()];
    // „Langtext" tragen zwei der im Beleg verwechselten „NUTZERPRUEFUNG …"-Titel.
    await filtere("langtext");
    expect([...ids()].sort()).toEqual(["n01", "n11"]);
    // Der unterscheidende Teil trennt sie.
    await filtere("Erfassen Langtext");
    expect(ids()).toEqual(["n11"]);
    expect(marke("graph-objektliste-anzahl")?.textContent).toBe(
      i18n.t("wissensgraph.liste.anzahl", { count: 1, gesamt: KNOTEN.length }),
    );
    await filtere("");
    expect(ids()).toEqual(ausgang);
  });

  it("V3 · Klick auf den Treffer erreicht /wissen/<id> über den Router", async () => {
    await mount();
    await filtere("Erfassen Langtext");
    const ziel = link("n11");
    expect(ziel).not.toBeNull();
    await act(async () => {
      ziel?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
      await flush();
    });
    expect(marke("sonde")?.textContent).toBe(koDetailPath("n11"));
  });

  it("V4 · Enter und Leertaste auf dem Treffer erreichen /wissen/<id> über den Router", async () => {
    await mount();
    await filtere("Bibliothek Langtext");
    expect(ids()).toEqual(["n01"]);
    await act(async () => {
      link("n01")?.focus();
      link("n01")?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
      await flush();
    });
    expect(marke("sonde")?.textContent).toBe(koDetailPath("n01"));
    abbauen();

    await mount();
    await filtere("Sturzprotokoll");
    expect(ids()).toEqual(["n28"]);
    await act(async () => {
      link("n28")?.dispatchEvent(
        new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }),
      );
      await flush();
    });
    expect(marke("sonde")?.textContent).toBe(koDetailPath("n28"));
  });

  it("V5 · kein Treffer: ehrlicher Satz; das Kontrollobjekt erscheint auch über den Filter nicht", async () => {
    await mount();
    await filtere("Kontrollobjekt");
    expect(ids()).toEqual([]);
    expect(marke("graph-objektliste-leer")?.textContent).toBe(i18n.t("wissensgraph.liste.keinTreffer"));
    expect(container.textContent ?? "").not.toContain(KONTROLLE.title);
  });

  it("V6 · ein im Bestand unbekannter Knoten steht als Text ohne Link — wie im Bild", async () => {
    schalter.ohneN28 = true;
    await mount();
    const eintrag = container.querySelector('[data-testid="graph-objekt"][data-id="n28"]');
    // Gelesen am Textelement: der Eintrag trägt daneben den Detailschalter (R-0744).
    expect(eintrag?.querySelector('[data-testid="graph-objekt-text"]')?.textContent).toBe(
      KNOTEN.find((k) => k.id === "n28")?.title,
    );
    expect(eintrag?.querySelector("a")).toBeNull();
    expect(link("n27")).not.toBeNull();
  });
});
