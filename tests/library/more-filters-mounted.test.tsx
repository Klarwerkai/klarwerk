// @vitest-environment jsdom
// AUFTRAG-uxpol5 · Punkt 2 (Pedis Höhe/Priorisierung): seltenere Facetten wandern hinter „Weitere
// Filter" (eingeklappt als Standard, Zustand pro Browser gemerkt). Gepinnt am ECHTEN FacetFilter:
//  (a) primäre Facetten sichtbar, sekundäre eingeklappt; „Weitere Filter" öffnet sie.
//  (b) eine aktive Auswahl aus dem eingeklappten Bereich bleibt OBEN als Pille sichtbar (nichts
//      „versteckt aktiv").
//  (c) der Auf-/Zu-Zustand überlebt einen „Reload" (frischer Mount über denselben localStorage).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { FacetFilter } from "../../apps/web/src/components/FacetFilter";
import i18n from "../../apps/web/src/i18n";
import { type FacetGroupConfig, buildFacetGroups } from "../../apps/web/src/lib/facetFilter";
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

function Harness({ items }: { items: FacetValues[] }) {
  const [sel, setSel] = useState<FacetSelection>({});
  const groups = buildFacetGroups(items, CONFIGS, sel);
  const faceted = applyFacetSelection(items, (v) => v, sel);
  return createElement(FacetFilter, {
    configs: CONFIGS,
    groups,
    selection: sel,
    total: items.length,
    shown: faceted.length,
    secondaryKeys: ["language"],
    moreStorageKey: STORAGE_KEY,
    onToggle: (k: string, v: string) => setSel((s) => toggleFacetValue(s, k, v)),
    onReset: () => setSel({}),
    labelForValue: (_k: string, v: string) => v,
  });
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
    throw new Error(`Chip „${text}" nicht gefunden; DOM: ${container.textContent}`);
  }
  return btn;
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
    expect(chip("A · 1")).toBeTruthy();
    // Sekundär (Sprache) eingeklappt: der Toggle steht, aber die Sprach-Chips noch nicht.
    expect(container.textContent).toContain(res("facet.moreFilters"));
    expect(container.textContent).not.toContain("de · 1");
    // Öffnen → Sprach-Chips erscheinen.
    act(() => {
      chip(res("facet.moreFilters")).click();
    });
    expect(chip("de · 1")).toBeTruthy();
    expect(chip("en · 1")).toBeTruthy();
  });

  it("(b) aktive Auswahl aus dem eingeklappten Bereich bleibt oben als Pille sichtbar", () => {
    mount();
    // Öffnen, Sprache de wählen …
    act(() => {
      chip(res("facet.moreFilters")).click();
    });
    act(() => {
      chip("de · 1").click();
    });
    const langLabel = res("lib.facet.language");
    expect(container.textContent).toContain(`${langLabel}: de`);
    // … wieder einklappen: der Sprach-Chip verschwindet, die Pille bleibt (nichts versteckt aktiv).
    act(() => {
      chip(res("facet.moreFilters")).click();
    });
    expect(container.textContent).not.toContain("de · 1");
    expect(container.textContent).toContain(`${langLabel}: de`);
  });

  it("(c) Auf-/Zu-Zustand überlebt den „Reload“ (frischer Mount über denselben Speicher)", () => {
    mount();
    // Standard eingeklappt → öffnen (persistiert „offen").
    act(() => {
      chip(res("facet.moreFilters")).click();
    });
    expect(chip("de · 1")).toBeTruthy();
    unmount();
    // „Reload": frischer Mount, derselbe localStorage → Bereich ist wieder offen (ohne Klick).
    mount();
    expect(chip("de · 1")).toBeTruthy();
  });

  // AUFTRAG-uxpol6 (bens GELB 2.1): der stabile Storage-Key wird UNABHÄNGIG von der aktuellen
  // Gruppenanzahl an den Hook gegeben — Sekundärgruppen, die erst nach einem Datenwechsel in
  // DERSELBEN Instanz erscheinen, respektieren ein bereits gespeichertes „offen".
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
    // … und zwar OFFEN (gespeichertes "1", ohne Klick) — nicht fälschlich „zu".
    expect(chip(res("facet.moreFilters")).getAttribute("aria-expanded")).toBe("true");
    expect(chip("de · 1")).toBeTruthy();
    expect(chip("en · 1")).toBeTruthy();
  });
});
