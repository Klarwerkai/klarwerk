// @vitest-environment jsdom
// AUFTRAG-uxpol5 · Punkt 2 (Pedis Höhe/Priorisierung): seltenere Facetten wandern hinter „Weitere
// Filter" (eingeklappt als Standard, Zustand pro Browser gemerkt). Gepinnt am ECHTEN FacetFilter:
//  (a) primäre Facetten sichtbar, sekundäre eingeklappt; „Weitere Filter“ öffnet sie.
//  (b) eine aktive Auswahl aus dem eingeklappten Bereich bleibt OBEN als Pille sichtbar (nichts
//      „versteckt aktiv“).
//  (c) der Auf-/Zu-Zustand überlebt einen „Reload“ (frischer Mount über denselben localStorage).
//
// AUFTRAG-mega10 Block B: unverändert in der Sache — nur die Darstellung einer Option ist jetzt eine
// echte Checkbox statt eines aria-pressed-Chips, und die aktiven Pillen liegen im eigenen Bauteil
// FacetActiveBar. Die Harness rendert deshalb beide; alle vier Zusicherungen bleiben wörtlich.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { FacetFilter } from "../../apps/web/src/components/FacetFilter";
import { FacetActiveBar } from "../../apps/web/src/components/facets/FacetActiveBar";
import i18n from "../../apps/web/src/i18n";
import type { FacetGroupConfig } from "../../apps/web/src/lib/facetFilter";
import { EMPTY_RAIL_UI, facetRailGroups } from "../../apps/web/src/lib/facetRail";
import type { FacetSelection, FacetValues } from "../../apps/web/src/lib/facets";
import { applyFacetSelection, toggleFacetValue } from "../../apps/web/src/lib/facets";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const STORAGE_KEY = "test.more.open";
const CONFIGS: readonly FacetGroupConfig[] = [
  { key: "category", labelKey: "lib.facet.category" },
  { key: "language", labelKey: "lib.facet.language" },
];
const ITEMS: FacetValues[] = [
  { category: ["A"], language: ["de"] },
  { category: ["B"], language: ["en"] },
];

const labelForValue = (_k: string, v: string): string => v;

function Harness({ items }: { items: FacetValues[] }) {
  const [sel, setSel] = useState<FacetSelection>({});
  const groups = facetRailGroups(items, CONFIGS, sel, EMPTY_RAIL_UI, labelForValue);
  const faceted = applyFacetSelection(items, (v) => v, sel);
  const onToggle = (k: string, v: string): void => setSel((s) => toggleFacetValue(s, k, v));
  const onReset = (): void => setSel({});
  return createElement(
    "div",
    null,
    createElement(FacetActiveBar, {
      configs: CONFIGS,
      selection: sel,
      onToggle,
      onReset,
      labelForValue,
    }),
    createElement(FacetFilter, {
      configs: CONFIGS,
      groups,
      selection: sel,
      total: items.length,
      shown: faceted.length,
      secondaryKeys: ["language"],
      moreStorageKey: STORAGE_KEY,
      onToggle,
      onReset,
      labelForValue,
    }),
  );
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(items: FacetValues[] = ITEMS): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Harness, { items }));
  });
}

function unmount(): void {
  act(() => {
    root.unmount();
  });
  container.remove();
}

function chip(text: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(text),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Chip „${text}“ nicht gefunden; DOM: ${container.textContent}`);
  }
  return btn;
}

// Eine Facetten-Option: echte Checkbox im <label> (erster <span> = Wert, zweiter = Zähler).
function optionRow(value: string): HTMLLabelElement | undefined {
  return [...container.querySelectorAll("label")].find(
    (l) => l.querySelectorAll("span")[0]?.textContent === value,
  );
}

function option(value: string): HTMLInputElement {
  const box = optionRow(value)?.querySelector("input[type=checkbox]");
  if (!(box instanceof HTMLInputElement)) {
    throw new Error(`Option „${value}“ nicht gefunden; DOM: ${container.textContent}`);
  }
  return box;
}

function hasOption(value: string): boolean {
  return optionRow(value) !== undefined;
}

function res(key: string): string {
  return String(i18n.getResource("de", "translation", key));
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.clear();
});

afterEach(() => {
  unmount();
  window.localStorage.clear();
});

describe("uxpol5: FacetFilter — „Weitere Filter“ (primär vs. sekundär, gemountet)", () => {
  it("(a) primäre Facette sichtbar, sekundäre eingeklappt; „Weitere Filter“ öffnet sie", () => {
    mount();
    // Primär: Kategorie-Chips sofort da.
    expect(hasOption("A")).toBe(true);
    // Sekundär (Sprache) eingeklappt: der Toggle steht, aber die Sprach-Chips noch nicht.
    expect(container.textContent).toContain(res("facet.moreFilters"));
    expect(hasOption("de")).toBe(false);
    // Öffnen → Sprach-Optionen erscheinen.
    act(() => {
      chip(res("facet.moreFilters")).click();
    });
    expect(hasOption("de")).toBe(true);
    expect(hasOption("en")).toBe(true);
  });

  it("(b) aktive Auswahl aus dem eingeklappten Bereich bleibt oben als Pille sichtbar", () => {
    mount();
    // Öffnen, Sprache de wählen …
    act(() => {
      chip(res("facet.moreFilters")).click();
    });
    act(() => {
      option("de").click();
    });
    const langLabel = res("lib.facet.language");
    expect(container.textContent).toContain(`${langLabel}: de`);
    // … wieder einklappen: der Sprach-Chip verschwindet, die Pille bleibt (nichts versteckt aktiv).
    act(() => {
      chip(res("facet.moreFilters")).click();
    });
    expect(hasOption("de")).toBe(false);
    expect(container.textContent).toContain(`${langLabel}: de`);
  });

  it("(c) Auf-/Zu-Zustand überlebt den „Reload“ (frischer Mount über denselben Speicher)", () => {
    mount();
    // Standard eingeklappt → öffnen (persistiert „offen“).
    act(() => {
      chip(res("facet.moreFilters")).click();
    });
    expect(hasOption("de")).toBe(true);
    unmount();
    // „Reload“: frischer Mount, derselbe localStorage → Bereich ist wieder offen (ohne Klick).
    mount();
    expect(hasOption("de")).toBe(true);
  });

  // AUFTRAG-uxpol6 (bens GELB 2.1): der stabile Storage-Key wird UNABHÄNGIG von der aktuellen
  // Gruppenanzahl an den Hook gegeben — Sekundärgruppen, die erst nach einem Datenwechsel in
  // DERSELBEN Instanz erscheinen, respektieren ein bereits gespeichertes „offen“.
  it("(d) Sekundärgruppe erscheint erst später: gespeichertes „offen“ wirkt trotzdem", () => {
    window.localStorage.setItem(STORAGE_KEY, "1");
    // Erst KEINE sichtbare Sekundärgruppe: Sprache hat nur eine Option (< minGroupOptions).
    const early: FacetValues[] = [
      { category: ["A"], language: ["de"] },
      { category: ["B"], language: ["de"] },
    ];
    mount(early);
    expect(container.textContent).not.toContain(res("facet.moreFilters"));
    // Datenwechsel in derselben Instanz: Sprache bekommt zwei Optionen → Sekundärbereich erscheint …
    act(() => {
      root.render(createElement(Harness, { items: ITEMS }));
    });
    // … und zwar OFFEN (gespeichertes "1", ohne Klick) — nicht fälschlich „zu“.
    expect(chip(res("facet.moreFilters")).getAttribute("aria-expanded")).toBe("true");
    expect(hasOption("de")).toBe(true);
    expect(hasOption("en")).toBe(true);
  });
});
