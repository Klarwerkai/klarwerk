// @vitest-environment jsdom
// ==================================================================================================
// AUFTRAG PRO 381 · BÜNDEL 3 (Bewahrung) · `R-14` — DER BEWEIS FÜR „ADDITIV“.
// ==================================================================================================
//
// PLAN PRO 378 §8.4 `R-14`: „Bei INAKTIVER Ortsschicht (kein `raum`, überall `home` abwesend) ist
// das Bibliotheks-DOM gegenüber heute unverändert: zehn Achsen, `category → tag`, Bereichsfilter,
// Sortierung, Gruppierung, Fenster, gespeicherte Sichten, Leerzustände."
//
// WIE DAS ÜBERHAUPT MESSBAR IST — die Entwurfsfrage dieser Datei: Ein „unverändert gegenüber heute“
// lässt sich zur Laufzeit gegen nichts vergleichen; ein zweites „heute“ gibt es im Prozess nicht.
// Ein abgelegter DOM-Schnappschuss wäre die Antwort, die PLAN 378 §8 ausdrücklich VERBIETET
// („Snapshot-Großumschreibungen“ stehen auch im Auftrag PRO 381 unter „Verboten“) — und er wäre
// wertlos, weil ihn jede Formatierungsänderung rot macht und deshalb reflexhaft neu geschrieben
// würde. Stattdessen steht hier ein NAMENTLICHES INVENTAR: jede Fähigkeit, die die Bibliothek heute
// hat, wird an der ECHTEN gemounteten Seite einzeln nachgewiesen. Das ist strenger als ein
// Schnappschuss (es prüft Verhalten, nicht Markup) und überlebt jede Umgestaltung, die nichts kaputt
// macht.
//
// DIESE DATEI IST EIN BEWAHRUNGSANKER — HEUTE GRÜN, und sie muss es durch die ganze Umsetzungswelle
// bleiben. PLAN 378 §10 „Reihenfolge“ Punkt 6: beim Montieren der Ortszeile in `Library.tsx` müssen
// `R-14` bis `R-16` DURCHGEHEND grün bleiben.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { ORT_URL_PARAM } from "./support/wissensraum-ort-vertrag";

/** Veränderlicher Bestand — jeder Fall setzt ihn VOR dem Mounten (vi.mock wird hochgezogen). */
const bestand = vi.hoisted(() => ({ kos: [] as unknown[] }));

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(bestand.kos),
    useLibrarySearch: () => ok(bestand.kos),
    useDirectory: () => ok([]),
    useConflicts: () => ok([]),
  };
});
vi.mock("../../apps/web/src/app/AuthContext", () => ({
  useSession: () => ({ user: { id: "u1", role: "experte" } }),
}));
vi.mock("../../apps/web/src/app/RoleContext", () => ({ useRole: () => ({ role: "experte" }) }));
vi.mock("../../apps/web/src/app/ToastContext", () => ({ useToast: () => ({ push: () => {} }) }));

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, useLocation } from "../../apps/web/node_modules/react-router-dom";
import i18n from "../../apps/web/src/i18n";
import { LIBRARY_RESULT_LIMIT } from "../../apps/web/src/lib/libraryDisplay";
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko",
    title: "Titel",
    statement: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 50,
    trust: 50,
    status: "validiert",
    version: 1,
    originalAuthor: "u9",
    author: "u9",
    neededValidations: 2,
    assignments: [],
    asset: null,
    createdAt: "2026-07-20T00:00:00.000Z",
    history: [],
    ...overrides,
  } as unknown as KnowledgeObject;
}

/**
 * Ein Bestand, der ALLE ZEHN Achsen mit Werten füllt — sonst prüfte das Inventar Gruppen, die
 * mangels Optionen gar nicht gezeichnet werden, und wäre grün, ohne etwas zu belegen.
 */
function vielfaeltigerBestand(): KnowledgeObject[] {
  return [
    ko({
      id: "a",
      title: "Alpha Ventil",
      category: "Anlage 1",
      tags: ["ventil"],
      author: "anna",
      confidentiality: "intern",
      type: "best_practice",
      trust: 90,
      createdAt: "2026-07-20T00:00:00.000Z",
    }),
    ko({
      id: "b",
      title: "Beta Pumpe",
      category: "Anlage 2",
      tags: ["pumpe"],
      author: "bert",
      confidentiality: "vertraulich",
      type: "technik",
      trust: 30,
      createdAt: "2019-03-01T00:00:00.000Z",
    }),
    ko({
      id: "c",
      title: "Gamma Reifen",
      category: "Fuhrpark",
      tags: ["reifen"],
      author: "clara",
      confidentiality: "intern",
      type: "best_practice",
      trust: 60,
      status: "offen",
      createdAt: "2026-01-05T00:00:00.000Z",
    }),
    // Der vierte Beitrag trägt die beiden Achsen, die sonst nur EINEN Wert hätten und deshalb gar
    // nicht gezeichnet würden: `origin` (Demo/Nicht-Demo über `demoSeed`) und `language` (die
    // Ableitung `languageFromTitle` macht aus einem englischen Titel „en"). Ohne ihn wäre das
    // Inventar unvollständig, ohne dass es auffiele — genau die Art stiller Lücke, die dieser
    // Anker verhindern soll.
    ko({
      id: "d",
      title: "Delta Tyre Change Procedure And Safety Notes",
      category: "Fuhrpark",
      tags: ["reifen"],
      author: "dave",
      confidentiality: "intern",
      type: "best_practice",
      trust: 0,
      demoSeed: true,
      createdAt: "2026-06-01T00:00:00.000Z",
    } as Partial<KnowledgeObject>),
  ];
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let currentUrl = "";

function UrlProbe(): null {
  const loc = useLocation();
  currentUrl = `${loc.pathname}${loc.search}`;
  return null;
}

function mount(entry = "/bibliothek"): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          MemoryRouter,
          { initialEntries: [entry] },
          createElement(UrlProbe),
          createElement(Library),
        ),
      ),
    );
  });
}

function res(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

function text(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function buttonMitText(gesucht: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(gesucht),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Schaltfläche „${gesucht}“ fehlt; DOM: ${text()}`);
  }
  return btn;
}

/** Eine Facetten-Option der Schiene: echte Checkbox im <label> (erster <span> = Wert). */
function optionRow(value: string): HTMLLabelElement | undefined {
  return [...container.querySelectorAll("label")].find(
    (l) => l.querySelectorAll("span")[0]?.textContent === value,
  );
}

function clickOption(value: string): void {
  const box = optionRow(value)?.querySelector("input[type=checkbox]");
  if (!(box instanceof HTMLInputElement)) {
    throw new Error(`Option „${value}“ fehlt; DOM: ${text()}`);
  }
  act(() => {
    box.click();
  });
}

function setDateInput(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Die ZEHN Achsen, wörtlich aus `Library.tsx` `LIBRARY_FILTER_CONFIGS` (`:116-127`). */
const PRIMAER = [
  "lib.facet.maturity",
  "lib.facet.category",
  "lib.facet.tag",
  "lib.facet.confidentiality",
  "lib.facet.author",
];
const SEKUNDAER = [
  "lib.facet.origin",
  "lib.facet.type",
  "lib.facet.language",
  "lib.facet.age",
  "lib.facet.trust",
];

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  bestand.kos = vielfaeltigerBestand();
  currentUrl = "";
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  window.localStorage.clear();
});

describe("PRO 381 · R-14 — bei inaktiver Ortsschicht ist die Bibliothek unverändert", () => {
  it("R-14 (a) BEWAHRUNGSANKER: zehn Achsen — fünf primär sichtbar, fünf hinter „Weitere Filter“", () => {
    mount();
    // Fünf primäre stehen sofort (PLAN 378 §2.2 korrigiert hier PRO 359: fünf, nicht sechs).
    for (const key of PRIMAER) {
      expect(text(), `primäre Achse „${key}“ fehlt`).toContain(res(key));
    }
    // Die fünf sekundären liegen eingeklappt — der Standard ist zu, das ist Bestandsverhalten.
    act(() => {
      buttonMitText(res("facet.moreFilters")).click();
    });
    for (const key of SEKUNDAER) {
      expect(text(), `sekundäre Achse „${key}“ fehlt`).toContain(res(key));
    }
    expect(PRIMAER.length + SEKUNDAER.length).toBe(10);
  });

  it("R-14 (b) BEWAHRUNGSANKER: die Abhängigkeit `category → tag` trägt weiter", () => {
    mount();
    // Ohne Auswahl stehen die Schlagwörter beider Kategorien zur Verfügung.
    expect(optionRow("ventil")).toBeTruthy();
    expect(optionRow("pumpe")).toBeTruthy();
    // Kategorie „Anlage 1“ wählen → nur deren Schlagwort bleibt (die EINZIGE modellierte
    // Abhängigkeit der Schiene, `Library.tsx:137`).
    clickOption("Anlage 1");
    expect(optionRow("ventil")).toBeTruthy();
    expect(optionRow("pumpe")).toBeFalsy();
  });

  it("R-14 (c) BEWAHRUNGSANKER: der Bereichsfilter läuft weiter über EIGENE URL-Parameter", () => {
    mount();
    expect(text()).toContain(res("lib.facet.rangeLabel"));
    const felder = [...container.querySelectorAll('input[type="date"]')];
    expect(felder, "der Bereichsfilter hat keine zwei Datumsfelder mehr").toHaveLength(2);

    const von = felder[0];
    if (!(von instanceof HTMLInputElement)) {
      throw new Error("Bereichsfeld „von“ fehlt");
    }
    setDateInput(von, "2026-01-01");
    // Der Präzedenzfall des ganzen Vertrags: ein Bereich ist kein Facettenwert, er hat einen
    // EIGENEN Parameter neben der Facettenauswahl (`Library.tsx:142-145`). Der Ort folgt ihm.
    expect(currentUrl).toContain("von=2026-01-01");
    expect(currentUrl).not.toContain("category=");
    // Der ALTE Bestand fällt heraus, der neue bleibt — der Filter wirkt wirklich.
    expect(text()).not.toContain("Beta Pumpe");
    expect(text()).toContain("Alpha Ventil");
  });

  it("R-14 (d) BEWAHRUNGSANKER: Sortierung, Gruppierung und gemerkte Suchen stehen", () => {
    mount();
    expect(text()).toContain(res("lib.sort.label"));
    expect(container.querySelector("select"), "die Sortier-Auswahl fehlt").toBeTruthy();
    expect(text()).toContain(res("lib.groupBy.label"));
    // Die Gruppierung ist eine Reihe aus `aria-pressed`-Schaltflächen — dasselbe Muster, dem der
    // spätere Ortsumschalter folgt (`A-2`). Sie muss unverändert bleiben.
    expect(
      [...container.querySelectorAll("button[aria-pressed]")].length,
      "die Gruppierungs-Schaltflächen fehlen",
    ).toBeGreaterThanOrEqual(5);
    expect(text()).toContain(res("lib.views.savedLabel"));
  });

  it("R-14 (e) BEWAHRUNGSANKER: das aufziehbare Fenster der Trefferliste bleibt aufziehbar", () => {
    bestand.kos = Array.from({ length: LIBRARY_RESULT_LIMIT + 20 }, (_unused, i) =>
      ko({ id: `k${i}`, title: `Treffer ${i}` }),
    );
    mount();
    expect(LIBRARY_RESULT_LIMIT).toBe(200);
    expect(text()).toContain(res("lib.showingFirst").replace("{{shown}}", "200").split("{{")[0]);
    const mehr = buttonMitText(res("lib.loadMore").split("{{")[0] ?? "");
    act(() => {
      mehr.click();
    });
    expect(text()).toContain("Treffer 210");
  });

  it("R-14 (f) BEWAHRUNGSANKER: der ehrliche Leerzustand bleibt", () => {
    bestand.kos = [];
    mount();
    expect(text()).toContain(res("lib.empty").slice(0, 30));
  });

  it("R-14 (g) BEWAHRUNGSANKER: heute existiert KEINE Ortsschicht — kein Pfad, kein Umschalter", () => {
    // Der Iststand, gegen den „additiv“ behauptet wird (PLAN 378 §2.1 `I-1`, §3): es gibt im
    // ganzen Web-Bestand kein Ortsfeld und kein Breadcrumb-Bauteil. Diese Zeile hält den Nullpunkt
    // fest — sie wird GRÜN BLEIBEN, solange PRO 381 gilt, und ist genau die Zeile, die eine
    // spätere Welle bewusst ändern muss, wenn sie die Ortszeile montiert.
    mount(`/bibliothek?${ORT_URL_PARAM}=raum-1`);
    expect(container.querySelectorAll("nav[aria-label]")).toHaveLength(0);
    expect(container.querySelectorAll('[aria-current="page"]')).toHaveLength(0);
    // Und der Fremdparameter in der Adresse ändert die Treffermenge nicht — „kein Raum“ heisst
    // „gesamtes Unternehmen“, nie „leerer Raum“.
    expect(text()).toContain("Alpha Ventil");
    expect(text()).toContain("Beta Pumpe");
    expect(text()).toContain("Gamma Reifen");
    expect(text()).toContain("Delta Tyre Change");
  });
});
