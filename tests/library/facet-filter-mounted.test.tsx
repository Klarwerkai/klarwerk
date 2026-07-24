// @vitest-environment jsdom
// AUFTRAG-uxpol1 (PAKET 1): gemounteter Bibliothek-Träger-Test der dynamischen Filterleiste. Echter
// React-Mount (Muster wie file-format-info-mounted): eine kleine Harness spiegelt die Bibliothek-
// Verdrahtung (buildFacetGroups + FacetFilter + Auswahl-State). Gepinnt: (a) Klick auf eine Facette
// aktualisiert die Kontext-Zähler, (b) eine Aktive-Filter-Pille erscheint, (c) eine 0-Treffer-Option
// wird ausgegraut/deaktiviert, (d) Pille entfernen und (e) „Alle zurücksetzen" wirken, (f) i18n DE/EN/NL.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement, useState } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { FacetFilter } from "../../apps/web/src/components/FacetFilter";
import i18n from "../../apps/web/src/i18n";
import { type FacetGroupConfig, buildFacetGroups } from "../../apps/web/src/lib/facetFilter";
import type { FacetSelection, FacetValues } from "../../apps/web/src/lib/facets";
import { applyFacetSelection, toggleFacetValue } from "../../apps/web/src/lib/facets";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const CONFIGS: readonly FacetGroupConfig[] = [
  { key: "category", labelKey: "lib.facet.category" },
  { key: "language", labelKey: "lib.facet.language" },
];
const ITEMS: FacetValues[] = [
  { category: ["A"], language: ["de"] },
  { category: ["A"], language: ["en"] },
  { category: ["B"], language: ["de"] },
];

// Harness: identische Verdrahtung wie die Bibliothek (kontrollierte Auswahl → neu berechnete Gruppen).
function Harness() {
  const [sel, setSel] = useState<FacetSelection>({});
  const groups = buildFacetGroups(ITEMS, CONFIGS, sel);
  const faceted = applyFacetSelection(ITEMS, (v) => v, sel);
  return createElement(FacetFilter, {
    configs: CONFIGS,
    groups,
    selection: sel,
    total: ITEMS.length,
    shown: faceted.length,
    onToggle: (k: string, v: string) => setSel((s) => toggleFacetValue(s, k, v)),
    onReset: () => setSel({}),
    labelForValue: (_k: string, v: string) => v,
  });
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(createElement(Harness));
  });
});

afterEach(async () => {
  act(() => {
    root.unmount();
  });
  container.remove();
  await i18n.changeLanguage("de");
});

// Alle Facetten-Chips (echte <button> mit „ · N"), ohne Aktive-Leiste/Reset.
function chip(text: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(text),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Chip „${text}" nicht gefunden; DOM: ${container.textContent}`);
  }
  return btn;
}

describe("FacetFilter — dynamische Bibliotheks-Filterleiste (gemountet)", () => {
  it("(a)(c) startet ohne Aktive-Leiste; Zähler stehen, nichts ausgegraut; Trefferzeile zeigt N von GESAMT", () => {
    expect(container.textContent).not.toContain("Aktive Filter");
    expect(chip("A · 2")).toBeTruthy();
    expect(chip("de · 2")).toBeTruthy();
    // Trefferzeile steht als Text (eigener Span, kein Button).
    expect(container.textContent).toContain("Treffer: 3 von 3");
  });

  it("(a) Klick auf Kategorie B aktualisiert die Kontext-Zähler (de 2→1) und die Trefferzeile", () => {
    act(() => {
      chip("B · 1").click();
    });
    // Sprach-Zähler rechnet sich im Kontext neu: nur B/de bleibt → de 1.
    expect(chip("de · 1")).toBeTruthy();
    expect(container.textContent).toContain("Treffer: 1 von 3");
    expect(container.textContent).toContain("gefiltert");
  });

  it("(b) eine Aktive-Filter-Pille erscheint nach der Auswahl (Gruppen-Label: Wert)", () => {
    act(() => {
      chip("A · 2").click();
    });
    expect(container.textContent).toContain("Aktive Filter");
    // Pille trägt das lokalisierte Gruppen-Label + Wert.
    const catLabel = String(i18n.getResource("de", "translation", "lib.facet.category"));
    expect(container.textContent).toContain(`${catLabel}: A`);
  });

  it("(c) eine 0-Treffer-Option ist ausgegraut/deaktiviert (nicht klickbar)", () => {
    act(() => {
      chip("B · 1").click();
    });
    const en = chip("en · 0");
    expect(en.disabled).toBe(true);
  });

  it("(g) MEHRFACHAUSWAHL (bens Blocker 1.1): zwei Werte EINER Gruppe → ODER (Vereinigung), zwei Pillen", () => {
    // Kategorie A wählen, dann B ergänzen — die eigene Facette bleibt beim Zählen ausgeklammert,
    // also steht „B · 1" weiter zur Verfügung. Ergebnis: Vereinigung A∪B = alle 3 Items.
    act(() => {
      chip("A · 2").click();
    });
    act(() => {
      chip("B · 1").click();
    });
    const catLabel = String(i18n.getResource("de", "translation", "lib.facet.category"));
    // Zwei aktive Pillen (je gewähltem Wert eine), Treffer = Vereinigung (3 von 3).
    expect(container.textContent).toContain(`${catLabel}: A`);
    expect(container.textContent).toContain(`${catLabel}: B`);
    expect(container.textContent).toContain("Treffer: 3 von 3");
  });

  it("(d) Pille entfernen setzt genau diese Auswahl zurück (Aktive-Leiste verschwindet)", () => {
    act(() => {
      chip("A · 2").click();
    });
    const catLabel = String(i18n.getResource("de", "translation", "lib.facet.category"));
    act(() => {
      chip(`${catLabel}: A`).click();
    });
    expect(container.textContent).not.toContain("Aktive Filter");
    expect(container.textContent).toContain("Treffer: 3 von 3");
  });

  it("(e) „Alle zurücksetzen“ leert die gesamte Auswahl", () => {
    act(() => {
      chip("A · 2").click();
    });
    const resetLabel = String(i18n.getResource("de", "translation", "facet.reset"));
    act(() => {
      chip(resetLabel).click();
    });
    expect(container.textContent).not.toContain("Aktive Filter");
    expect(container.textContent).toContain("Treffer: 3 von 3");
  });

  it("(f) i18n DE/EN/NL: Aktive-Leiste + Trefferzeile folgen der Sprache", async () => {
    act(() => {
      chip("A · 2").click();
    });
    for (const [lng, active, result] of [
      ["en", "Active filters", "Results: 2 of 3"],
      ["nl", "Actieve filters", "Treffers: 2 van 3"],
    ] as const) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await i18n.changeLanguage(lng);
      });
      expect(container.textContent).toContain(active);
      expect(container.textContent).toContain(result);
    }
  });
});
