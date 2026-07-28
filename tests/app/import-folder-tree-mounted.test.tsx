// @vitest-environment jsdom
// AUFTRAG-mega27 A5 (Mounted): die REKURSIVE Ordner-Darstellung. Belegt am ECHTEN Demo-Bestand
// (services/app/src/demo-corpus.ts, seit A6 mit mehrstufiger Elternkette), dass
//   • der Baum tiefer als zwei Ebenen gezeichnet wird,
//   • der Haken eines Ordners den GESAMTEN Teilbaum erfasst (nicht nur die direkten Kinder),
//   • Einträge ohne Elternkette sichtbar direkt unter der Wurzel hängen,
//   • die Auswahl am ORIGINAL-Index in preview[] hängt.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { ImportPreviewEntry } from "../../apps/web/src/api/types";
import { ImportPreviewTree } from "../../apps/web/src/components/ImportPreviewTree";
import {
  type PreviewRow,
  type PreviewTreeGroup,
  bulkSelectableRows,
  groupCheckboxState,
  groupRowsTree,
  setRowsSelected,
} from "../../apps/web/src/lib/importSelectView";
import { corpusImportItems } from "../../services/app/src/demo-corpus";
import { toPreviewEntry } from "../../services/library-analytics/src/select";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function mount(node: JSX.Element): void {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root.render(node);
  });
}

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

// Der Demo-Bestand ALS Vorschau — genau der Weg, den die Auswahl-Route geht (toPreviewEntry).
const ENTRIES: ImportPreviewEntry[] = corpusImportItems("de").map((item) => toPreviewEntry(item));
const ROWS: PreviewRow[] = ENTRIES.map((entry, index) => ({ entry, index }));

function renderTree(
  checked: readonly boolean[],
  onToggleGroup: (rows: readonly PreviewRow[]) => void,
): void {
  mount(
    createElement(ImportPreviewTree, {
      groups: groupRowsTree(ROWS, "folder"),
      isOpen: () => true,
      setOpen: () => undefined,
      checkStateOf: (rows: readonly PreviewRow[]) => groupCheckboxState(checked, rows),
      onToggleGroup,
      labelOf: (group: PreviewTreeGroup) => (group.value === "" ? "—" : group.value),
      countLabel: (n: number) => `${n}`,
      renderRow: ({ entry, index }: PreviewRow) =>
        createElement("li", { key: index, "data-index": String(index) }, entry.title),
    }),
  );
}

describe("mega27 A5 · rekursive Ordner-Darstellung (Mounted, echter Demo-Bestand)", () => {
  it("zeichnet den Baum TIEFER als zwei Ebenen", () => {
    renderTree(
      ENTRIES.map(() => false),
      () => undefined,
    );
    // Wurzel (KWDEMO) → Betrieb → IT-Betrieb → Datensicherung = vier verschachtelte <details>.
    expect(container.querySelectorAll("details details details details").length).toBeGreaterThan(0);
    expect(container.textContent).toContain("KWDEMO");
    expect(container.textContent).toContain("Betrieb");
    expect(container.textContent).toContain("Datensicherung");
    expect(container.textContent).toContain("Halle 7");
  });

  it("Einträge ohne Elternkette stehen DIREKT unter der Wurzel — nicht in einem erfundenen Ordner", () => {
    renderTree(
      ENTRIES.map(() => false),
      () => undefined,
    );
    const rootDetails = container.querySelector(":scope > div > details") as HTMLElement;
    // Direkt am Wurzel-Knoten hängende <li> (nicht in einem tieferen <details>).
    const own = [...rootDetails.querySelectorAll(":scope > ul > li")].map((li) => li.textContent);
    expect(own).toEqual(["CRM-Tempo (Annahme)"]);
    // Es gibt keinen Sammel-Ordner „Sonstiges" o. ä.
    expect(container.textContent).not.toContain("Sonstiges");
  });

  it("der Haken eines Ordners erfasst den GESAMTEN Teilbaum und bindet an den Original-Index", () => {
    let toggled: readonly PreviewRow[] = [];
    renderTree(
      ENTRIES.map(() => false),
      (rows) => {
        toggled = rows;
      },
    );
    // Den Ordner „Betrieb" finden (zweite Ebene) und seinen Haken klicken.
    const betrieb = [...container.querySelectorAll("details")].find((d) => {
      const label = d.querySelector(":scope > summary input[type=checkbox]");
      return label?.getAttribute("aria-label") === "Betrieb";
    });
    expect(betrieb).toBeDefined();
    const box = betrieb?.querySelector(":scope > summary input[type=checkbox]") as HTMLInputElement;
    act(() => {
      box.click();
    });
    // „Betrieb" hat KEINE eigene Zeile — alle fünf liegen in Unterordnern (Tiefe 2 und 3).
    const expected = ENTRIES.flatMap((e, i) => (e.sourcePath?.[0] === "Betrieb" ? [i] : []));
    expect(expected.length).toBe(5);
    expect([...toggled].map((r) => r.index).sort((a, b) => a - b)).toEqual(expected);

    // Die Auswahl wird über GENAU diese Original-Indizes gesetzt (F1: bekannte Zeilen bleiben aus).
    const next = setRowsSelected(
      ENTRIES.map(() => false),
      bulkSelectableRows(toggled),
      true,
    );
    expect(next.flatMap((on, i) => (on ? [i] : []))).toEqual(expected);
  });

  it("Dreizustand: eine einzige tiefe Zeile macht den Wurzel-Haken gemischt, nicht voll", () => {
    const deepIndex = ENTRIES.findIndex((e) => e.sourcePath?.length === 3);
    expect(deepIndex).toBeGreaterThanOrEqual(0);
    const checked = ENTRIES.map((_, i) => i === deepIndex);
    renderTree(checked, () => undefined);
    const rootBox = container.querySelector(
      ":scope > div > details > summary input[type=checkbox]",
    ) as HTMLInputElement;
    expect(rootBox.checked).toBe(false);
    expect(rootBox.indeterminate).toBe(true);
  });
});
