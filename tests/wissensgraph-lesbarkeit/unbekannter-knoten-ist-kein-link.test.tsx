// @vitest-environment jsdom
// ================================================================================================
// JOB 3824 — DER UNBEKANNTE KNOTEN IST AN JEDER KANTE EHRLICH NICHT-NAVIGIERBAR
// ================================================================================================
// WARUM ES DIESE DATEI GIBT. Die Seitenhilfe `help.graph.body` (apps/web/src/i18n.ts:5063-5064)
// verspricht: „Ein Klick auf einen Knoten führt zu dem Wissensobjekt dahinter, und mit der Tastatur
// springst du von Knoten zu Knoten." Die Bahn, die diesen Satz gemessen hat, hat seine Bedingung
// als offenen Rest zurückgegeben — jobs/3795/runde-2/RUECKGABE.md:66, wörtlich:
//
//   „`help.graph.body` (`apps/web/src/i18n.ts:5063-5064`): „Ein Klick auf einen Knoten führt zu dem
//   Wissensobjekt dahinter, und mit der Tastatur springst du von Knoten zu Knoten." Beides gilt NUR
//   für Knoten, deren Objekt im aktuellen Bestand liegt (`isNavigableNode`,
//   `apps/web/src/lib/graphNav.ts:12`); ein unbekannter Knoten ist weder Link noch in der
//   Tastatur-Reihenfolge."
//
// und :67 nennt die Lücke, die derselbe Lauf ausdrücklich NICHT geschlossen hat, wörtlich:
//
//   „Nicht gemessen und offen: das vollständige `./tools/check` (Build, `tools/test` als Ganzes,
//   Chromium-UI-Smoke) — das fährt der Taktgeber. Ebenso außerhalb: Englisch und Niederländisch,
//   der echte Browser, Breiten unter 390 px, die Tabulator-Wanderung selbst, `/extern`,
//   `/analytics`, `/hilfe` (JOB 3796) und `/duplikate`."
//
// Gemessen wird hier die BEDINGUNG des Satzes, nicht der Satz: was der unbekannte Knoten NICHT tut.
// Fünf Kanten, fünf Fälle, jede an ihrer eigenen Stelle in apps/web/src/pages/Stufe2.tsx:
//   U1 kein Tabstopp     (:2159 tabIndex={navigable ? 0 : undefined})
//   U2 keine Taste       (:2162-2171 onKeyDown={navigable ? … : undefined}) — zwei Hälften: kein
//                        Ziel UND kein verschlucktes Ereignis (`defaultPrevented === false` an
//                        abbrechbaren Tasten). Der Handler ruft `preventDefault()` VOR `go()`
//                        (:2166-2167); ohne die zweite Hälfte bliebe der Fall grün, wenn nur die
//                        Bedingung an `onKeyDown` fiele — so gemessen von BEN in Runde 1.
//   U3 kein Klickziel    (:2137-2141 go() prüft `navigable`) — obwohl der Klick ankommt (:2208)
//   U4 kein Fokusring    (:2172-2175 onFocus/onBlur) → :2180-2192
//   U5 kein Zeigerkreuz  (:2160 className={navigable ? "cursor-pointer outline-none" : undefined})
// Das Produkt ändert sich durch diese Datei nicht; es verhält sich heute richtig, und genau das
// wird festgenagelt. Jeder Fall trägt im SELBEN Mount den bekannten Nachbarn als positive
// Gegenprobe — sonst würde eine kaputte Bühne (gar nichts gerendert, Bestand nie geladen) alle
// fünf Zusicherungen grün machen.
//
// WAS DIESE DATEI NICHT BEWEIST. jsdom führt die Tabulator-WANDERUNG des Browsers nicht aus: es
// kennt die Tabulator-Taste nicht und berechnet keine Fokusreihenfolge. U1 misst deshalb die
// VORAUSSETZUNG des Wanderns (das `tabindex`-Attribut am `<g>`), nicht das Wandern selbst. Mehr
// wird hier nicht behauptet. Ebenfalls nicht gedeckt: der echte Browser, Englisch und
// Niederländisch (die Fälle messen Verhalten, keinen Text), Breiten unter 390 px, und der Satz
// `help.graph.body` selbst — er wird zitiert und nicht geändert.
//
// WARUM NEBEN graph-lesbarkeit.test.tsx STATT DARIN. Jene Datei ist der UX-07-Wächter von JOB 3103
// mit eigener Bühne im Modus „bestand" (alle 28 Knoten bekannt); ihre `vi.mock`-Aufrufe hängen am
// Modulkopf und sind nicht importierbar. Sie misst am unbekannten Knoten genau zwei Dinge —
// `role === null` (:309) und `aria-label === null` (:310) — und bleibt unverändert; hier geht es um
// den Gegenfall an den fünf übrigen Kanten. Die Bühne unten ist dem Vorbild
// graph-lesbarkeit.test.tsx:15-160 nachgebaut und auf das Nötige gekürzt: zwei Knoten statt 28,
// keine Kanten, keine Konflikte, keine Trefferrechnung.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { kosBestand } from "./bestand";

// Zwei Knoten aus dem dokumentierten Bestand (./bestand.ts, Beleg N-0011). Der Graph zeichnet
// beide; `ko.list` kennt nur den ersten — das ist der Zustand „erfolgreich geladen, Bestand kennt
// den Knoten nicht", nicht „lädt" und nicht „Fehler".
const BEKANNT = {
  id: "n21",
  title: "Wartung am Förderband: monatliche Sichtprüfung der Tragrollen",
} as const;
const UNBEKANNT = {
  id: "n28",
  title: "Sturzprotokoll noch am selben Tag anlegen.",
} as const;

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: "experte", stufe2: true, setStufe2: () => {} }),
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    library: {
      // Der Graph zeigt BEIDE Knoten — er kommt aus der Analytik, nicht aus dem Bestand.
      graph: vi.fn(async () => ({ nodes: [{ ...BEKANNT }, { ...UNBEKANNT }], edges: [] })),
    },
    conflicts: { list: vi.fn(async () => []) },
    ko: {
      // Der Bestand kennt NUR den bekannten Knoten. Die Felder stammen aus der Vorlage des
      // dokumentierten Bestands, damit der Datensatz die Form hat, die die Seite erwartet.
      list: vi.fn(async () => {
        const vorlage = kosBestand()[0] as Record<string, unknown>;
        return [{ ...vorlage, ...BEKANNT }];
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
import { GraphView } from "../../apps/web/src/pages/Stufe2";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/**
 * Die Sonde steht auf der Detailroute /wissen/:id. Sie zeigt, WOHIN navigiert wurde — und sie
 * existiert überhaupt nur, wenn die Route erreicht wurde. Der Sollwert ist die Kennung aus dem
 * Prüfstandsbestand oben, nicht der Rückgabewert der produktiven `koDetailPath` (BENs Korrektur an
 * JOB 3795 R1: die produktive Pfadfunktion darf nicht zugleich Weg und Erwartung liefern).
 */
function Sonde(): JSX.Element {
  const { id } = useParams();
  return createElement("div", { "data-testid": "sonde" }, id ?? "");
}

function abbauen(): void {
  if (root && container) {
    const r = root;
    act(() => r.unmount());
    container.remove();
  }
  root = null;
  container = null;
}

async function mount(): Promise<void> {
  abbauen();
  const c = document.createElement("div");
  document.body.appendChild(c);
  container = c;
  const r = createRoot(c);
  root = r;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    r.render(
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
  // Erst nach diesem zweiten Durchlauf ist der Bestand da; vorher misst man den Ladezustand.
  await act(flush);
}

function wurzel(): HTMLDivElement {
  if (!container) {
    throw new Error("Prüfstand: nicht gemountet");
  }
  return container;
}

/** Die Knotengruppen: jedes `<g>` im SVG, das einen eigenen Kreis trägt. */
function knotenGruppen(): SVGGElement[] {
  return [...wurzel().querySelectorAll("svg g")].filter((g) =>
    g.querySelector(":scope > circle"),
  ) as SVGGElement[];
}

/** Der Knoten mit diesem vollen Namen — erkannt am `<title>`, das JEDER Knoten trägt. */
function gruppe(knoten: { title: string }): SVGGElement {
  const g = knotenGruppen().find(
    (k) => k.querySelector(":scope > title")?.textContent === knoten.title,
  );
  if (!g) {
    throw new Error(`Prüfstand: Knoten „${knoten.title}" nicht gezeichnet`);
  }
  return g;
}

/** Das Trefferrechteck eines Knotens — die Fläche, auf der ein Klick wirklich ankommt. */
function trefferflaeche(g: SVGGElement): SVGRectElement {
  const r = g.querySelector(":scope > rect");
  if (!r) {
    throw new Error("Prüfstand: Knoten ohne Trefferrechteck");
  }
  return r as SVGRectElement;
}

/** Die Kennung, auf der die Navigation gelandet ist — oder null, wenn nirgendwo. */
function ziel(): string | null {
  return wurzel().querySelector("[data-testid='sonde']")?.textContent ?? null;
}

function fokusringe(): Element[] {
  return [...wurzel().querySelectorAll("[data-testid='graph-knoten-fokus']")];
}

/**
 * Ein Tastendruck auf einen Knoten — ABBRECHBAR (`cancelable: true`), und das Ereignis kommt
 * zurück. Ohne `cancelable` wäre `defaultPrevented` immer `false`, und U2 könnte gar nicht sehen,
 * ob der Knoten die Taste an sich genommen hat (BENs Korrektur an Runde 1, Korrekturpflicht 1).
 */
async function taste(g: SVGGElement, key: string): Promise<KeyboardEvent> {
  const ereignis = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  await act(async () => {
    g.dispatchEvent(ereignis);
    await flush();
  });
  return ereignis;
}

/** Kalibrierung für JEDEN Fall: geladener Bestand, beide Knoten da, noch nicht navigiert. */
function kalibrierung(): void {
  expect(knotenGruppen().length, "beide Knoten sind gezeichnet").toBe(2);
  expect(wurzel().textContent ?? "", "kein Ladezustand").not.toContain(i18n.t("state.loading"));
  expect(wurzel().textContent ?? "", "kein Fehlerzustand").not.toContain(i18n.t("state.error"));
  expect(gruppe(BEKANNT).getAttribute("role"), "der bekannte Knoten IST ein Link").toBe("link");
  expect(gruppe(UNBEKANNT).getAttribute("role"), "der unbekannte ist kein Link").toBeNull();
  expect(ziel(), "vor dem Handgriff ist nirgendwo navigiert").toBeNull();
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

afterEach(() => {
  abbauen();
  vi.clearAllMocks();
});

describe("JOB 3824 · der unbekannte Graph-Knoten ist an jeder Kante ehrlich kein Link", () => {
  it("U1 · kein Tabstopp: der unbekannte Knoten trägt gar kein tabindex, der bekannte trägt 0", async () => {
    await mount();
    kalibrierung();
    // Kein Attribut — nicht `-1`. Ein `tabindex="-1"` wäre programmatisch fokussierbar und damit
    // eine andere, schwächere Zusage als „gar nicht in der Reihenfolge".
    expect(
      gruppe(UNBEKANNT).getAttribute("tabindex"),
      "der unbekannte Knoten trägt kein tabindex-Attribut",
    ).toBeNull();
    expect(gruppe(BEKANNT).getAttribute("tabindex"), "der bekannte Knoten ist erreichbar").toBe(
      "0",
    );
    // Die Tabulator-Reihenfolge, soweit jsdom sie hergibt: die Liste der Knoten MIT Tabstopp
    // besteht genau aus den bekannten. Ein zusätzlicher Name hier hieße: ein Nutzer mit der
    // Tastatur landet auf einem Knoten, der ins Leere führt.
    const mitTabstopp = knotenGruppen()
      .filter((g) => g.getAttribute("tabindex") !== null)
      .map((g) => g.querySelector(":scope > title")?.textContent ?? "?");
    expect(mitTabstopp, "Knoten, die einen Tabstopp nehmen").toEqual([BEKANNT.title]);
  });

  it("U2 · keine Taste: Enter und Leertaste lassen den unbekannten Knoten unberührt — kein Ziel UND kein verschlucktes Ereignis", async () => {
    await mount();
    kalibrierung();
    // „Keine Taste" ist mehr als „führt nirgendwo hin". Der produktive Handler ruft
    // `e.preventDefault()` VOR `go()` (Stufe2.tsx:2166-2167). Wäre er am unbekannten Knoten
    // verdrahtet, bliebe die Navigation zwar aus (go() prüft `navigable`), aber der Knoten nähme
    // die Taste an sich: die Leertaste blättert dann nicht mehr, Enter löst nichts Umgebendes mehr
    // aus. Beide Hälften werden deshalb gemessen — das Ziel UND `defaultPrevented`. Ohne die
    // zweite Hälfte bleibt dieser Fall grün, wenn nur die Bedingung an `onKeyDown` fällt
    // (BEN, Runde 1: „ausschließlich `onKeyDown` unbedingt verdrahtet → U2 bleibt grün").
    const unbekannt = gruppe(UNBEKANNT);
    for (const key of ["Enter", " "]) {
      const ereignis = await taste(unbekannt, key);
      expect(ziel(), `Taste „${key}" auf dem unbekannten Knoten führt nirgendwo hin`).toBeNull();
      expect(
        ereignis.defaultPrevented,
        `Taste „${key}": der unbekannte Knoten nimmt das Ereignis nicht an sich`,
      ).toBe(false);
      expect(knotenGruppen().length, `nach „${key}" steht der Graph noch`).toBe(2);
    }
    // Positive Gegenprobe im selben Mount: derselbe Handgriff am bekannten Nachbarn wirkt — er
    // führt zu SEINEM Objekt UND nimmt das Ereignis an sich. Sonst wäre oben auch eine tote Bühne
    // grün, und `defaultPrevented === false` wäre keine Aussage über den Knoten. Enter zuerst —
    // die Navigation baut den Graphen ab.
    const enterBekannt = await taste(gruppe(BEKANNT), "Enter");
    expect(ziel(), "Enter auf dem bekannten Knoten öffnet SEIN Objekt").toBe(BEKANNT.id);
    expect(enterBekannt.defaultPrevented, "und nimmt Enter an sich").toBe(true);

    // Und die Leertaste ebenso — dafür ein frischer Mount, der alte hat die Route verlassen.
    await mount();
    kalibrierung();
    const leerBekannt = await taste(gruppe(BEKANNT), " ");
    expect(ziel(), "die Leertaste auf dem bekannten Knoten öffnet SEIN Objekt").toBe(BEKANNT.id);
    expect(leerBekannt.defaultPrevented, "und wird von ihm an sich genommen").toBe(true);
  });

  it("U3 · kein Klickziel, obwohl der Klick ankommt: das Trefferrechteck fängt ihn und er wirkt nicht", async () => {
    await mount();
    kalibrierung();
    const unbekannt = gruppe(UNBEKANNT);
    const flaeche = trefferflaeche(unbekannt);
    // Zuerst der Beleg, dass der Klick wirklich ANKOMMT (Stufe2.tsx:2208): auch der unbekannte
    // Knoten trägt `pointer-events="all"`. Genau darum ist diese Kante die leiseste — sie bricht,
    // ohne dass am Bildschirm etwas fehlt.
    expect(
      flaeche.getAttribute("pointer-events"),
      "das Trefferrechteck des unbekannten Knotens nimmt Zeigerereignisse an",
    ).toBe("all");
    await act(async () => {
      flaeche.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });
    expect(ziel(), "der Klick kam an und führte nirgendwo hin").toBeNull();
    expect(knotenGruppen().length, "die Seite steht noch, es wurde nicht navigiert").toBe(2);
    // Positive Gegenprobe im selben Mount: dieselbe Form am bekannten Nachbarn führt zu SEINEM
    // Objekt. Der Sollwert ist die Kennung aus dem Prüfstandsbestand.
    const flaecheBekannt = trefferflaeche(gruppe(BEKANNT));
    expect(flaecheBekannt.getAttribute("pointer-events")).toBe("all");
    await act(async () => {
      flaecheBekannt.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });
    expect(ziel(), "derselbe Klick am bekannten Knoten öffnet SEIN Objekt").toBe(BEKANNT.id);
  });

  it("U4 · kein Fokusring: focusin auf dem unbekannten Knoten zeichnet keinen, auf dem bekannten genau einen", async () => {
    await mount();
    kalibrierung();
    expect(fokusringe().length, "ohne Fokus ist kein Ring da").toBe(0);
    await act(async () => {
      gruppe(UNBEKANNT).dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      await flush();
    });
    expect(fokusringe().length, "der unbekannte Knoten bekommt keinen Fokusring").toBe(0);
    // Positive Gegenprobe im selben Mount: der bekannte Nachbar bekommt genau einen, und er
    // gehört zu SEINEM `<g>`.
    const bekannt = gruppe(BEKANNT);
    await act(async () => {
      bekannt.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
      await flush();
    });
    const ringe = fokusringe();
    expect(ringe.length, "genau ein Fokusring im ganzen Baum").toBe(1);
    expect(ringe[0]?.closest("g"), "der Ring gehört zum bekannten Knoten").toBe(bekannt);
  });

  it("U5 · kein Zeigerkreuz, aber der volle Name bleibt", async () => {
    await mount();
    kalibrierung();
    const unbekannt = gruppe(UNBEKANNT);
    expect(
      unbekannt.getAttribute("class") ?? "",
      "der unbekannte Knoten sieht nicht aus wie ein Link",
    ).not.toContain("cursor-pointer");
    expect(gruppe(BEKANNT).getAttribute("class") ?? "", "der bekannte Knoten schon").toContain(
      "cursor-pointer",
    );
    // Randbedingung dieses Aufbaus, kein zweiter Wächter: die Ehrlichkeit nimmt dem Knoten den
    // Link, nicht den Namen (Stufe2.tsx:2179). Dass JEDER Knoten sein `<title>` mit dem
    // ungekürzten Namen trägt, ist bereits gedeckt — graph-lesbarkeit.test.tsx:299-315.
    expect(
      unbekannt.querySelector(":scope > title")?.textContent,
      "der volle Name steht am unbekannten Knoten",
    ).toBe(UNBEKANNT.title);
  });
});
