// @vitest-environment jsdom
// AUFTRAG-mega10 Block C: die ECHTE, gemountete Bibliothek auf der neuen Schiene. Nur Netz-Hooks
// und Contexts sind Stubs — Filterlogik, URL-Fortschreibung und Anzeige sind das Original.
//
// Testpflichten Block C (wörtlich aus dem Auftrag):
//  (a) Ein Reload stellt den vollen Filterzustand wieder her (Regression auf mega9 E-2).
//  (b) Ein Deep-Link mit MEHREREN Werten je Dimension trifft dieselbe Menge wie die Klickfolge.
//  (c) Die Trefferzahl im klebenden Zähler stimmt mit der Liste überein.
// Dazu Block B Punkt 4: der Bereichsfilter wirkt additiv, steht in der URL und ist einzeln lösbar.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeObject } from "../../apps/web/src/api/types";

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
    confidence: 0,
    trust: 0,
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

// Drei Kategorien, zwei davon mit eigenen Schlagwörtern — Basis für Deep-Link UND Abhängigkeit.
const KO_A = ko({ id: "a", title: "Alpha Ventil", category: "Anlage 1", tags: ["ventil"] });
const KO_B = ko({ id: "b", title: "Beta Pumpe", category: "Anlage 2", tags: ["pumpe"] });
const KO_C = ko({
  id: "c",
  title: "Gamma Reifen",
  category: "Fuhrpark",
  tags: ["reifen", "firmenwagen"],
});
// Ein deutlich ÄLTERER Treffer — nur er fällt aus einem Zeitraum ab 2026 heraus.
const KO_D = ko({
  id: "d",
  title: "Delta Altbestand",
  category: "Anlage 1",
  tags: ["ventil"],
  createdAt: "2019-03-01T00:00:00.000Z",
});
const KOS = [KO_A, KO_B, KO_C, KO_D];

vi.mock("../../apps/web/src/api/hooks", () => {
  const ok = <T,>(data: T) => ({ data, isLoading: false, isError: false, error: null });
  return {
    useKos: () => ok(KOS),
    useLibrarySearch: () => ok(KOS),
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
import { Library } from "../../apps/web/src/pages/Library";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
// Die jeweils aktuelle Adresse — so wird die URL-Fortschreibung real beobachtbar (statt behauptet).
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

function unmount(): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

// Eine Facetten-Option in der Schiene: echte Checkbox im <label> (erster <span> = Wert).
function optionRow(value: string): HTMLLabelElement | undefined {
  return [...container.querySelectorAll("label")].find(
    (l) => l.querySelectorAll("span")[0]?.textContent === value,
  );
}

function option(value: string): HTMLInputElement {
  const box = optionRow(value)?.querySelector("input[type=checkbox]");
  if (!(box instanceof HTMLInputElement)) {
    throw new Error(`Option „${value}“ fehlt; DOM: ${container.textContent}`);
  }
  return box;
}

// Eine kontrollierte React-Eingabe treiben: der native value-Setter umgeht den Value-Tracker,
// sonst schluckt React die Änderung (Repo-Muster, s. caption-form-mounted).
function typeInto(el: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set as (
    v: string,
  ) => void;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function click(value: string): void {
  act(() => {
    option(value).click();
  });
}

// Die Titel der aktuell gezeigten Trefferliste — die WAHRHEIT, gegen die der Zähler geprüft wird.
function visibleTitles(): string[] {
  return [KO_A, KO_B, KO_C, KO_D]
    .map((k) => k.title)
    .filter((title) => (container.textContent ?? "").includes(title));
}

// Der klebende Trefferzähler, als Zahl aus seinem TEXT gelesen.
function stickyCount(): number {
  const text = container.textContent ?? "";
  const label = String(i18n.getResource("de", "translation", "lib.facet.showResults"));
  const pattern = new RegExp(label.replace("{{n}}", "(\\d+)"));
  const hit = pattern.exec(text);
  if (!hit?.[1]) {
    throw new Error(`Klebender Zähler nicht gefunden; DOM: ${text}`);
  }
  return Number(hit[1]);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
  currentUrl = "";
});

afterEach(() => {
  unmount();
  window.localStorage.clear();
});

describe("Block C: die Bibliothek auf der Schiene (echter Seam)", () => {
  it("(c) der klebende Zähler stimmt IMMER mit der Trefferliste überein", () => {
    mount();
    expect(stickyCount()).toBe(4);
    expect(visibleTitles()).toHaveLength(4);

    click("Anlage 1");
    expect(visibleTitles().sort()).toEqual(["Alpha Ventil", "Delta Altbestand"]);
    expect(stickyCount()).toBe(2);

    // Zweiter Wert derselben Gruppe → ODER (Vereinigung), der Zähler folgt.
    click("Fuhrpark");
    expect(stickyCount()).toBe(3);
    expect(visibleTitles()).toHaveLength(3);
  });

  it("(a) ein Reload stellt den VOLLEN Filterzustand wieder her (Regression mega9 E-2)", () => {
    mount();
    click("Anlage 1");
    click("Fuhrpark");
    const urlNachKlicks = currentUrl;
    // Die Auswahl steht in der Adresse — das ist die Voraussetzung dafür, dass sie den Reload übersteht.
    expect(urlNachKlicks).toContain("category=Anlage+1");
    expect(urlNachKlicks).toContain("category=Fuhrpark");
    const trefferVorher = visibleTitles().sort();

    // „Reload“: frischer Mount auf GENAU dieser Adresse.
    unmount();
    mount(urlNachKlicks);
    expect(visibleTitles().sort()).toEqual(trefferVorher);
    expect(stickyCount()).toBe(3);
    // Die Auswahl ist auch in der Schiene wieder angehakt (nicht nur in der Treffermenge).
    expect(option("Anlage 1").checked).toBe(true);
    expect(option("Fuhrpark").checked).toBe(true);
  });

  it("(b) ein Deep-Link mit MEHREREN Werten je Dimension trifft dieselbe Menge wie die Klickfolge", () => {
    // Weg 1: klicken.
    mount();
    click("Anlage 1");
    click("Anlage 2");
    const perKlick = visibleTitles().sort();
    const zaehlerPerKlick = stickyCount();
    unmount();

    // Weg 2: derselbe Zustand als wiederholter Parameter im Link (ohne jeden Klick).
    mount("/bibliothek?category=Anlage+1&category=Anlage+2");
    expect(visibleTitles().sort()).toEqual(perKlick);
    expect(stickyCount()).toBe(zaehlerPerKlick);
  });

  it("Block B Punkt 4: der Bereichsfilter wirkt additiv, steht in der URL und ist einzeln lösbar", () => {
    mount();
    const von = container.querySelector("#facet-rail-range-from");
    if (!(von instanceof HTMLInputElement)) {
      throw new Error(`Bereichs-Feld „von“ fehlt; DOM: ${container.textContent}`);
    }
    typeInto(von, "2026-01-01");
    // Nur der Altbestand (2019) fällt heraus — der Bereich filtert ZUSÄTZLICH zu den Facetten.
    expect(visibleTitles()).not.toContain("Delta Altbestand");
    expect(stickyCount()).toBe(3);
    // Er steht als EIGENER Parameter in der Adresse (nicht als Facettenwert).
    expect(currentUrl).toContain("von=2026-01-01");

    // Und er ist über seine eigene Pille einzeln lösbar.
    const pille = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").includes("ab 2026-01-01"),
    );
    expect(pille).toBeDefined();
    act(() => {
      pille?.click();
    });
    expect(stickyCount()).toBe(4);
    expect(currentUrl).not.toContain("von=");
  });

  it("Block B Punkt 2: die Kategoriewahl schneidet die Schlagwortliste (aus dem Bestand abgeleitet)", () => {
    mount();
    // Ohne Kategoriewahl sind alle drei Schlagwörter da.
    expect(optionRow("ventil")).toBeDefined();
    expect(optionRow("pumpe")).toBeDefined();
    expect(optionRow("reifen")).toBeDefined();

    click("Fuhrpark");
    // Jetzt nur noch das Schlagwort, das in dieser Kategorie tatsächlich vorkommt …
    expect(optionRow("reifen")).toBeDefined();
    expect(optionRow("ventil")).toBeUndefined();
    // … und die Einschränkung wird als TEXT ausgewiesen (nicht still verkürzt).
    expect(container.textContent).toContain(
      String(i18n.getResource("de", "translation", "facet.restricted")),
    );
  });

  it("der strukturelle No-Match taucht in KEINER Zeichenkette der Oberfläche oder der URL auf", () => {
    mount();
    click("Anlage 1");
    expect(container.textContent).not.toContain("noMatch");
    expect(currentUrl).not.toContain("noMatch");
  });
});
