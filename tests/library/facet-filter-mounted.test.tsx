// @vitest-environment jsdom
// AUFTRAG-uxpol1 (PAKET 1) · fortgeschrieben in AUFTRAG-mega10 Block B: gemounteter Träger-Test der
// dynamischen Filterfläche. Echter React-Mount; eine kleine Harness spiegelt die Bibliothek-
// Verdrahtung (facetRailGroups + FacetFilter + FacetActiveBar + Auswahl-State).
//
// WAS SICH GEGENÜBER uxpol1 GEÄNDERT HAT — und was ausdrücklich NICHT:
// Geändert ist nur die DARSTELLUNG, die Pedi abgenommen hat: aus der Pillenwand wurde eine Schiene,
// die Optionen sind jetzt echte Checkboxen statt aria-pressed-Chips, die aktiven Pillen stehen im
// eigenen Bauteil FacetActiveBar über der Trefferliste, und die Trefferzeile ist der klebende
// Zähler am Fuß der Schiene. JEDE fachliche Zusicherung von uxpol1 steht unverändert hier drin und
// wird weiter geprüft: (a) Kontext-Zähler rechnen bei jeder Wahl neu, (b) aktive Auswahl erscheint
// als entfernbare Pille, (c) 0-Treffer-Optionen sind ausgegraut/deaktiviert (nicht verschwiegen),
// (d) Pille entfernen, (e) „Alle zurücksetzen“, (f) i18n DE/EN/NL, (g) Mehrfachauswahl = ODER.
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

const CONFIGS: readonly FacetGroupConfig[] = [
  { key: "category", labelKey: "lib.facet.category" },
  { key: "language", labelKey: "lib.facet.language" },
];
const ITEMS: FacetValues[] = [
  { category: ["A"], language: ["de"] },
  { category: ["A"], language: ["en"] },
  { category: ["B"], language: ["de"] },
];
const labelForValue = (_k: string, v: string): string => v;

// Harness: identische Verdrahtung wie die Bibliothek (kontrollierte Auswahl → neu berechnete Gruppen).
function Harness() {
  const [sel, setSel] = useState<FacetSelection>({});
  const groups = facetRailGroups(ITEMS, CONFIGS, sel, EMPTY_RAIL_UI, labelForValue);
  const faceted = applyFacetSelection(ITEMS, (v) => v, sel);
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
      total: ITEMS.length,
      shown: faceted.length,
      onToggle,
      onReset,
      labelForValue,
    }),
  );
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

// Eine Facetten-Option ist jetzt eine echte Checkbox in ihrem <label>: erster <span> = Wert,
// zweiter <span> = Kontext-Zähler. Der Zustand steht als `checked`/`disabled` UND als Text.
function optionRow(value: string): HTMLLabelElement {
  const row = [...container.querySelectorAll("label")].find(
    (l) => l.querySelectorAll("span")[0]?.textContent === value,
  );
  if (!(row instanceof HTMLLabelElement)) {
    throw new Error(`Option „${value}“ nicht gefunden; DOM: ${container.textContent}`);
  }
  return row;
}

function option(value: string): HTMLInputElement {
  const box = optionRow(value).querySelector("input[type=checkbox]");
  if (!(box instanceof HTMLInputElement)) {
    throw new Error(`Checkbox zu „${value}“ fehlt`);
  }
  return box;
}

// Der Kontext-Zähler dieser Option, als Text gelesen (nicht aus dem Modell).
function optionCount(value: string): string {
  return optionRow(value).querySelectorAll("span")[1]?.textContent ?? "";
}

// Ein Knopf (aktive Pille, Reset) über seinen sichtbaren Text.
function button(text: string): HTMLButtonElement {
  const btn = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(text),
  );
  if (!(btn instanceof HTMLButtonElement)) {
    throw new Error(`Knopf „${text}“ nicht gefunden; DOM: ${container.textContent}`);
  }
  return btn;
}

describe("FacetFilter — dynamische Filterschiene (gemountet)", () => {
  it("(a)(c) startet ohne Aktive-Leiste; Zähler stehen, nichts ausgegraut; Zähler zeigt N von GESAMT", () => {
    expect(container.textContent).not.toContain("Aktive Filter");
    expect(option("A").checked).toBe(false);
    expect(option("A").disabled).toBe(false);
    expect(optionCount("A")).toBe("2");
    expect(optionCount("de")).toBe("2");
    // Der klebende Zähler nennt Treffer UND Bezug — ohne Filter ist das der gesamte Bestand.
    expect(container.textContent).toContain("3 Treffer anzeigen");
    expect(container.textContent).toContain("gesamter Bestand");
  });

  it("(a) Wahl von Kategorie B aktualisiert die Kontext-Zähler (de 2→1) und den Trefferzähler", () => {
    act(() => {
      option("B").click();
    });
    // Sprach-Zähler rechnet sich im Kontext neu: nur B/de bleibt → de 1.
    expect(optionCount("de")).toBe("1");
    expect(container.textContent).toContain("1 Treffer anzeigen");
    expect(container.textContent).toContain("von 3 gefiltert");
  });

  it("(b) eine Aktive-Filter-Pille erscheint nach der Auswahl (Gruppen-Label: Wert)", () => {
    act(() => {
      option("A").click();
    });
    expect(container.textContent).toContain("Aktive Filter");
    const catLabel = String(i18n.getResource("de", "translation", "lib.facet.category"));
    expect(container.textContent).toContain(`${catLabel}: A`);
    // Der Zustand steht zusätzlich an der Option selbst (nicht nur in der Pille).
    expect(option("A").checked).toBe(true);
  });

  it("(c) eine 0-Treffer-Option ist ausgegraut/deaktiviert (nicht klickbar, nicht verschwiegen)", () => {
    act(() => {
      option("B").click();
    });
    expect(option("en").disabled).toBe(true);
    expect(optionCount("en")).toBe("0");
    // Sie bleibt SICHTBAR — das ist der uxpol-Vertrag „ausgegraut statt verschwiegen“.
    expect(container.textContent).toContain("en");
  });

  it("(g) MEHRFACHAUSWAHL (bens Blocker 1.1): zwei Werte EINER Gruppe → ODER (Vereinigung), zwei Pillen", () => {
    act(() => {
      option("A").click();
    });
    act(() => {
      option("B").click();
    });
    const catLabel = String(i18n.getResource("de", "translation", "lib.facet.category"));
    expect(container.textContent).toContain(`${catLabel}: A`);
    expect(container.textContent).toContain(`${catLabel}: B`);
    expect(container.textContent).toContain("3 Treffer anzeigen");
  });

  it("(d) Pille entfernen setzt genau diese Auswahl zurück (Aktive-Leiste verschwindet)", () => {
    act(() => {
      option("A").click();
    });
    const catLabel = String(i18n.getResource("de", "translation", "lib.facet.category"));
    act(() => {
      button(`${catLabel}: A`).click();
    });
    expect(container.textContent).not.toContain("Aktive Filter");
    expect(container.textContent).toContain("3 Treffer anzeigen");
  });

  it("(e) „Alle zurücksetzen“ leert die gesamte Auswahl", () => {
    act(() => {
      option("A").click();
    });
    const resetLabel = String(i18n.getResource("de", "translation", "facet.reset"));
    act(() => {
      button(resetLabel).click();
    });
    expect(container.textContent).not.toContain("Aktive Filter");
    expect(container.textContent).toContain("3 Treffer anzeigen");
  });

  it("(f) i18n DE/EN/NL: Aktive-Leiste + Trefferzähler folgen der Sprache", async () => {
    act(() => {
      option("A").click();
    });
    for (const [lng, active, result, bezug] of [
      ["en", "Active filters", "Show 2 results", "filtered from 3"],
      ["nl", "Actieve filters", "2 treffers tonen", "van 3 gefilterd"],
    ] as const) {
      await act(async () => {
        await i18n.changeLanguage(lng);
      });
      expect(container.textContent).toContain(active);
      expect(container.textContent).toContain(result);
      expect(container.textContent).toContain(bezug);
    }
  });
});
