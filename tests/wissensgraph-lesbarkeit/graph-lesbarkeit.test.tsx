// @vitest-environment jsdom
// ================================================================================================
// JOB 3103 (UX-07) — DER WISSENSGRAPH ZEIGT LESBARE, EINDEUTIGE NAMEN UND ÖFFNET DEN GEWOLLTEN KNOTEN
// ================================================================================================
// Fläche: /graph → GraphView (apps/web/src/pages/Stufe2.tsx). Bestand: die 28 Titel aus dem Beleg
// N-0011 (./bestand.ts). Vor dem Bau waren R2, R3 und R4 hier rot; R1 (Überlappung) misst die
// Chromium-Datei daneben (graph-treffer-chromium.test.tsx) an echten Textrechtecken und die
// DOM-freie Datei (layout-entzerrung.test.ts) an den Rechtecken des Layouts.
//
// WAS DIESE DATEI NICHT BEWEIST: jsdom rechnet kein Layout — keine Textbreite, kein
// elementFromPoint. Die „Linkfläche" ist hier die Vereinigung der ZEIGERFÄHIGEN Formen eines
// Knotens (Kreis und Trefferrechteck, deren Maße als Attribute lesbar sind); die Beschriftung
// selbst ist nach Lieferung 4 nicht zeigerfähig, und dass sie es nicht ist, prüft R3a. Der echte
// Treffer mit gerenderter Schrift steht in der Chromium-Datei.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GRAPH, ID_VON_TITEL, KNOTEN, KONFLIKTE, TITEL, kosBestand } from "./bestand";

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte", stufe2: true, setStufe2: () => {} }),
}));

// Der Bestand ist umschaltbar: „bestand" (alle 28 bekannt), „ohne-n28" (ein Knoten unbekannt →
// ehrlich nicht navigierbar), „haengt" (die Abfrage kommt nie zurück — Lieferung 6), „fehler".
type Modus = "bestand" | "ohne-n28" | "haengt" | "fehler";
// `knoten`: ein anderer Bestand als die 28 des Belegs (Runde 3: Bens Gegenbeispiele) — Graph und
// Bestand kommen dann aus dieser Liste, ohne Kanten.
const schalter: { modus: Modus; knoten: readonly { id: string; title: string }[] | null } = {
  modus: "bestand",
  knoten: null,
};

vi.mock("../../apps/web/src/api/endpoints", () => {
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    library: {
      graph: vi.fn(async () =>
        schalter.knoten ? { nodes: [...schalter.knoten], edges: [] } : GRAPH,
      ),
    },
    conflicts: {
      list: vi.fn(async () => KONFLIKTE),
    },
    ko: {
      list: vi.fn(async () => {
        if (schalter.modus === "haengt") {
          return new Promise<never>(() => undefined);
        }
        if (schalter.modus === "fehler") {
          throw new Error("Prüfstand: Bestand gestört");
        }
        const vorlage = kosBestand()[0] as Record<string, unknown>;
        const alle = schalter.knoten
          ? schalter.knoten.map((k) => ({ ...vorlage, ...k }))
          : kosBestand();
        return schalter.modus === "ohne-n28" ? alle.filter((k) => k.id !== "n28") : alle;
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
  useParams,
} from "../../apps/web/node_modules/react-router-dom";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { koDetailPath } from "../../apps/web/src/lib/graphNav";
import { GraphView } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

// Die Sonde steht auf der Detailroute: sie zeigt, WOHIN navigiert wurde (Pfad aus graphNav).
function Sonde(): JSX.Element {
  const { id } = useParams();
  return createElement("div", { "data-testid": "sonde" }, id ?? "");
}

async function mount(
  modus: Modus = "bestand",
  knoten: readonly { id: string; title: string }[] | null = null,
): Promise<void> {
  schalter.modus = modus;
  schalter.knoten = knoten;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
}

/** Die Knotengruppen: jedes `<g>` im SVG, das einen Kreis trägt. */
function knotenGruppen(): SVGGElement[] {
  return [...container.querySelectorAll("svg g")].filter((g) =>
    g.querySelector(":scope > circle"),
  ) as SVGGElement[];
}

function idVon(g: Element): string {
  const titel = g.querySelector(":scope > title")?.textContent ?? "";
  const id = ID_VON_TITEL.get(titel);
  if (id) {
    return id;
  }
  // Vor Lieferung 3 gab es kein <title>; dann trägt nur das aria-label den vollen Namen.
  const aria = g.getAttribute("aria-label") ?? "";
  for (const [t, i] of ID_VON_TITEL) {
    if (aria.endsWith(t)) {
      return i;
    }
  }
  return "?";
}

interface Rechteck {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Das Rechteck einer zeigerfähigen Form (Kreis oder Rechteck) aus ihren Attributen. */
function formRechteck(el: Element): Rechteck | null {
  const n = (a: string): number => Number(el.getAttribute(a));
  if (el.tagName === "circle") {
    return {
      x1: n("cx") - n("r"),
      y1: n("cy") - n("r"),
      x2: n("cx") + n("r"),
      y2: n("cy") + n("r"),
    };
  }
  if (el.tagName === "rect") {
    return { x1: n("x"), y1: n("y"), x2: n("x") + n("width"), y2: n("y") + n("height") };
  }
  return null;
}

function trifft(el: Element, px: number, py: number): boolean {
  const n = (a: string): number => Number(el.getAttribute(a));
  if (el.tagName === "circle") {
    return (px - n("cx")) ** 2 + (py - n("cy")) ** 2 <= n("r") ** 2;
  }
  const r = formRechteck(el);
  return r !== null && px >= r.x1 && px <= r.x2 && py >= r.y1 && py <= r.y2;
}

/**
 * Das Trefferbild von jsdom: die LETZTE zeigerfähige Form in Dokumentreihenfolge, die den Punkt
 * enthält (SVG malt in Dokumentreihenfolge, das Oberste gewinnt). Zeigerfähig ist, was kein
 * `pointer-events="none"` trägt.
 */
function elementAnPunkt(px: number, py: number): Element | null {
  const formen = [...container.querySelectorAll("svg circle, svg rect")].filter(
    (el) => el.getAttribute("pointer-events") !== "none",
  );
  let treffer: Element | null = null;
  for (const el of formen) {
    if (trifft(el, px, py)) {
      treffer = el;
    }
  }
  return treffer;
}

function mitte(g: Element): { x: number; y: number } {
  const rechtecke = [...g.querySelectorAll("circle, rect")]
    .filter((el) => el.getAttribute("pointer-events") !== "none")
    .map(formRechteck)
    .filter((r): r is Rechteck => r !== null);
  const x1 = Math.min(...rechtecke.map((r) => r.x1));
  const y1 = Math.min(...rechtecke.map((r) => r.y1));
  const x2 = Math.max(...rechtecke.map((r) => r.x2));
  const y2 = Math.max(...rechtecke.map((r) => r.y2));
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.clearAllMocks();
});

describe("UX-07 · R2: die sichtbaren Beschriftungen sind paarweise verschieden", () => {
  it("28 sichtbare Labels, keines doppelt — auch die drei mit gleichem Anfang", async () => {
    await mount();
    const texte = knotenGruppen().map((g) => g.querySelector("text")?.textContent ?? "");
    expect(texte.length, "Kalibrierung: 28 beschriftete Knoten").toBe(TITEL.length);
    const doppelt = texte.filter((t, i) => texte.indexOf(t) !== i);
    expect(doppelt, "sichtbare Labels, die ein zweites Mal vorkommen").toEqual([]);
    // Die Kalibrierung der Kürzung: der alte Schnitt `slice(0, 15)` machte aus beiden
    // NUTZERPRUEFUNG-Titeln dasselbe Label „NUTZERPRUEFUNG …".
    const np = texte.filter((t) => t.startsWith("NUTZERPRUEFUNG"));
    expect(np.length, "beide NUTZERPRUEFUNG-Titel sind beschriftet").toBe(2);
    expect(np[0]).not.toBe(np[1]);
  });

  // Runde 3 (BEN): die beiden Gegenbeispiele auch an der gezeichneten Fläche — zwei Familien mit
  // gleichen Endungen (Nord/Sued × Variante 1/2, einmal mit dem Familiennamen vorn wie bei Ben,
  // einmal weit hinten) und ein voller Titel, der wie die Kürzung eines anderen aussieht. Zehn
  // Knoten, zehn verschiedene sichtbare Labels; der volle Titel bleibt, wie er ist.
  it("Bens Gegenbeispiele: zehn Knoten, zehn verschiedene sichtbare Labels, der volle Titel bleibt", async () => {
    const voll = "Wartungsanweisung Produktion…";
    const knoten = [
      ...["Nord", "Sued"].flatMap((ort) =>
        [1, 2].map((v) => ({
          id: `a-${ort}-${v}`,
          title: `Produktionsanlage ${ort} gemeinsamer sehr langer Namensanfang Variante ${v}`,
        })),
      ),
      ...["Nord", "Sued"].flatMap((ort) =>
        [1, 2].map((v) => ({
          id: `b-${ort}-${v}`,
          title: `Wartungsanweisung für die Produktionsanlage im Werk ${ort}, gemeinsamer Namensteil, Variante ${v}`,
        })),
      ),
      { id: "b-lang", title: "Wartungsanweisung Produktionsanlage Nord mit weiteren Einzelheiten" },
      { id: "b-voll", title: voll },
    ];
    await mount("bestand", knoten);
    const gruppen = knotenGruppen();
    expect(gruppen.length).toBe(knoten.length);
    const texte = gruppen.map((g) => g.querySelector("text")?.textContent ?? "");
    expect(new Set(texte).size, texte.join(" | ")).toBe(knoten.length);
    const vollGruppe = gruppen.find((g) => g.querySelector(":scope > title")?.textContent === voll);
    expect(vollGruppe?.querySelector("text")?.textContent).toBe(voll);
  });

  // Runde 4 (BEN): die Unterscheidungsstelle darf beim Zusammensetzen nicht verschwinden — an
  // der gezeichneten Fläche: „A B" gegen „AB", langer Titel mit und ohne originales „…" am Ende.
  it("Bens Runde-4-Paare: vier Knoten, vier verschiedene sichtbare Labels", async () => {
    const lang = "Wartungsanweisung Produktionsanlage Nord mit weiteren Einzelheiten";
    const knoten = [
      { id: "c-ab-1", title: "Wartungsanweisung Produktionsanlage A B" },
      { id: "c-ab-2", title: "Wartungsanweisung Produktionsanlage AB" },
      { id: "c-lang-1", title: lang },
      { id: "c-lang-2", title: `${lang}…` },
    ];
    await mount("bestand", knoten);
    const texte = knotenGruppen().map((g) => g.querySelector("text")?.textContent ?? "");
    expect(texte.length).toBe(knoten.length);
    expect(new Set(texte).size, texte.join(" | ")).toBe(knoten.length);
  });
});

describe("UX-07 · Lieferung 3: der volle Name steht am Knoten — auch am nicht navigierbaren", () => {
  it("jedes Knoten-<g> trägt ein <title> mit dem ungekürzten Titel; das aria-label bleibt", async () => {
    await mount("ohne-n28");
    const gruppen = knotenGruppen();
    expect(gruppen.length).toBe(TITEL.length);
    const ohneTitel = gruppen
      .filter((g) => !TITEL.includes(g.querySelector(":scope > title")?.textContent ?? ""))
      .map((g) => g.querySelector("text")?.textContent);
    expect(ohneTitel, "Knoten ohne <title> mit vollem Namen").toEqual([]);
    const n28 = gruppen.find((g) => g.querySelector(":scope > title")?.textContent === TITEL[27]);
    expect(n28?.getAttribute("role"), "n28 ist nicht im Bestand → ehrlich kein Link").toBeNull();
    expect(n28?.getAttribute("aria-label")).toBeNull();
    const n01 = gruppen.find((g) => g.querySelector(":scope > title")?.textContent === TITEL[0]);
    expect(n01?.getAttribute("role")).toBe("link");
    expect(n01?.getAttribute("aria-label")).toBe(i18n.t("graph.openNode", { title: TITEL[0] }));
  });
});

describe("UX-07 · R3: der Klick trifft den Knoten, auf den gezeigt wird", () => {
  it("R3a · keine Beschriftung nimmt Zeigerereignisse an", async () => {
    await mount();
    const texte = knotenGruppen().map((g) => g.querySelector("text") as SVGTextElement);
    expect(texte.length).toBe(TITEL.length);
    const zeigerfaehig = texte
      .filter((t) => t.getAttribute("pointer-events") !== "none")
      .map((t) => t.textContent);
    expect(zeigerfaehig, "Beschriftungen, die Klicks fangen").toEqual([]);
  });

  it("R3b · die Mitte jeder Linkfläche liegt auf einer Form des eigenen Knotens", async () => {
    await mount();
    const gruppen = knotenGruppen();
    expect(gruppen.length).toBe(TITEL.length);
    const fehl: string[] = [];
    for (const g of gruppen) {
      const { x, y } = mitte(g);
      const el = elementAnPunkt(x, y);
      const eigentuemer = el?.closest("g[role='link']") ?? null;
      if (eigentuemer !== g) {
        fehl.push(
          `${idVon(g)} (${x.toFixed(1)}|${y.toFixed(1)}) → ${eigentuemer ? idVon(eigentuemer) : "nichts"}`,
        );
      }
    }
    expect(fehl, "Knoten, deren Mitte einen anderen oder keinen Knoten trifft").toEqual([]);
  });

  it("R3c · ein Klick auf diese Mitte öffnet genau diesen Knoten (alle 28, je eine Fläche)", async () => {
    for (const knoten of KNOTEN) {
      await mount();
      const g = knotenGruppen().find((k) => idVon(k) === knoten.id);
      expect(g, `Knoten ${knoten.id} gezeichnet`).toBeTruthy();
      const { x, y } = mitte(g as Element);
      const el = elementAnPunkt(x, y);
      expect(el, `${knoten.id}: an der Mitte liegt eine zeigerfähige Form`).not.toBeNull();
      await act(async () => {
        (el as Element).dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await flush();
      });
      const sonde = container.querySelector("[data-testid='sonde']")?.textContent;
      expect(`/wissen/${sonde}`, `${knoten.id}: Ziel des Klicks`).toBe(koDetailPath(knoten.id));
      act(() => root.unmount());
      container.remove();
    }
    // afterEach räumt noch einmal auf — dafür braucht es einen letzten gemounteten Baum.
    await mount();
  });
});

describe("UX-07 · Lieferung 5: der Tastaturfokus ist sichtbar, Enter öffnet den fokussierten Knoten", () => {
  it("Fokus zeichnet einen Ring am fokussierten Knoten; Enter navigiert zu ihm", async () => {
    await mount();
    const g = knotenGruppen().find((k) => idVon(k) === "n07") as SVGGElement;
    expect(g.getAttribute("tabindex")).toBe("0");
    // Der Browser-Umriss bleibt aus (wie in der Themenkarte); der Ersatz ist der eigene Ring, der
    // unten nach dem Fokus erscheinen muss — ohne Fokus ist keiner da.
    expect(container.querySelector("[data-testid='graph-knoten-fokus']")).toBeNull();
    await act(async () => {
      g.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      await flush();
    });
    const ring = container.querySelector("[data-testid='graph-knoten-fokus']");
    expect(ring, "Fokusring gezeichnet").not.toBeNull();
    expect(ring?.closest("g"), "der Ring gehört zum fokussierten Knoten").toBe(g);
    await act(async () => {
      g.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await flush();
    });
    expect(container.querySelector("[data-testid='sonde']")?.textContent).toBe("n07");
  });

  // Runde 3 (BEN, Prüflücke 6): die Leertaste öffnet denselben Knoten wie Enter.
  it("Leertaste auf dem fokussierten Knoten öffnet genau diesen Knoten", async () => {
    await mount();
    const g = knotenGruppen().find((k) => idVon(k) === "n08") as SVGGElement;
    await act(async () => {
      g.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      g.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      await flush();
    });
    expect(container.querySelector("[data-testid='sonde']")?.textContent).toBe("n08");
  });
});

describe("UX-07 · §9: Cache mit gescheiterter Auffrischung des Bestands", () => {
  // Runde 3 (BEN, Prüflücke 6): der Bestand ist einmal geladen, die Auffrischung scheitert —
  // die 28 Knoten bleiben stehen und bleiben Links; nichts wird leer geräumt, kein Rückfall auf
  // „Lädt …" oder den Fehlertext.
  it("nach gescheiterter Auffrischung bleiben alle 28 Knoten sichtbar und navigierbar", async () => {
    await mount();
    expect(knotenGruppen().filter((g) => g.getAttribute("role") === "link").length).toBe(28);
    schalter.modus = "fehler";
    await act(async () => {
      await qc.refetchQueries({ queryKey: ["kos"] });
      await flush();
    });
    const kos = qc.getQueryState(["kos", undefined]);
    expect(kos?.status, "die Auffrischung ist wirklich gescheitert").toBe("error");
    expect(kos?.data, "der alte Bestand liegt noch im Cache").toBeDefined();
    const links = knotenGruppen().filter((g) => g.getAttribute("role") === "link");
    expect(links.length, "alle Knoten bleiben Links").toBe(28);
    expect(container.textContent ?? "").not.toContain(i18n.t("state.error"));
    expect(container.textContent ?? "").not.toContain(i18n.t("state.loading"));
  });
});

describe("UX-07 · R4 / Lieferung 6: der Ladezustand des Bestands ist keine Datenlage", () => {
  it("graphQ fertig, kosQ läuft noch → Ladehinweis statt 28 stummer, nicht öffenbarer Knoten", async () => {
    await mount("haengt");
    const stumm = knotenGruppen().filter((g) => g.getAttribute("role") !== "link");
    expect(stumm.length, "stumm nicht navigierbare Knoten während des Ladens").toBe(0);
    expect(container.textContent ?? "").toContain(i18n.t("state.loading"));
  });

  it("kosQ gescheitert (ohne Cache) → der Fehler steht da, kein stummer Rückfall", async () => {
    await mount("fehler");
    const stumm = knotenGruppen().filter((g) => g.getAttribute("role") !== "link");
    expect(stumm.length).toBe(0);
    expect(container.textContent ?? "").toContain(i18n.t("state.error"));
  });

  it("Kalibrierung: mit Bestand sind alle 28 Knoten Links", async () => {
    await mount();
    const links = knotenGruppen().filter((g) => g.getAttribute("role") === "link");
    expect(links.length).toBe(TITEL.length);
  });
});
