// @vitest-environment jsdom
// RT5a/RT5b (nacht24 Paket 5, Mounted): der echte Subfolder-Baum (Sprach-Ordner mit
// Themen-Unterordnern, auf-/zuklappbar, Tri-State-Gruppen-Haken) und die Sprach-Massenaktion
// („alle <Sprache> abwählen" je Sprache mit einem Klick; unter zwei Sprachen unsichtbar).
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { ImportPreviewEntry } from "../../apps/web/src/api/types";
import {
  ImportPreviewTree,
  LanguageDeselectChips,
} from "../../apps/web/src/components/ImportPreviewTree";
import {
  type PreviewLanguage,
  type PreviewRow,
  groupCheckboxState,
  groupRowsTree,
  languageCounts,
} from "../../apps/web/src/lib/importSelectView";

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

function entry(title: string, theme: string): ImportPreviewEntry {
  return { title, hasImage: false, themes: [theme] };
}

const ENTRIES: ImportPreviewEntry[] = [
  entry("[DE] Pumpe warten", "Pumpen"),
  entry("[DE] Ventil pruefen", "Ventile"),
  entry("[EN] Pump guide", "Pumpen"),
];
const ROWS: PreviewRow[] = ENTRIES.map((e, index) => ({ entry: e, index }));

describe("RT5a: ImportPreviewTree (Mounted)", () => {
  it("rendert Sprach-Ordner mit ECHTEN Themen-Unterordnern; Unterordner-Haken wählt genau seine Zeilen", () => {
    const checked = ENTRIES.map(() => false);
    let toggled: readonly PreviewRow[] = [];
    mount(
      createElement(ImportPreviewTree, {
        groups: groupRowsTree(ROWS, "language"),
        isOpen: () => true,
        setOpen: () => undefined,
        checkStateOf: (rows: readonly PreviewRow[]) => groupCheckboxState(checked, rows),
        onToggleGroup: (rows: readonly PreviewRow[]) => {
          toggled = rows;
        },
        labelOf: (group: { kind: string; value: string; language?: string }) =>
          group.kind === "language" ? `Sprache:${group.language}` : `Thema:${group.value}`,
        countLabel: (n: number) => `${n} Treffer`,
        renderRow: ({ entry: e, index }: PreviewRow) =>
          createElement("li", { key: index }, e.title),
      }),
    );
    // Baumstruktur: äußere details (Sprachen) enthalten INNERE details (Themen-Unterordner der DE-Gruppe).
    const outer = [...container.querySelectorAll(":scope > div > details")];
    expect(outer.length).toBe(2); // DE + EN
    const nested = container.querySelectorAll("details details");
    expect(nested.length).toBe(2); // DE → Pumpen + Ventile; EN bleibt flach (nur 1 Thema)
    expect(container.textContent).toContain("Sprache:de");
    expect(container.textContent).toContain("Thema:Pumpen");
    expect(container.textContent).toContain("Thema:Ventile");
    // Der Haken des Themen-Unterordners wählt GENAU die Zeilen dieses Unterordners.
    const pumpenCheckbox = [...(nested[0]?.querySelectorAll("input[type=checkbox]") ?? [])][0];
    expect(pumpenCheckbox).toBeDefined();
    act(() => {
      (pumpenCheckbox as HTMLInputElement).click();
    });
    expect(toggled.map((r) => r.index)).toEqual([0]); // nur „[DE] Pumpe warten"
  });
});

describe("RT5b: LanguageDeselectChips (Mounted)", () => {
  it("je Sprache EIN Abwahl-Knopf; Klick meldet die Sprache; unter zwei Sprachen unsichtbar", () => {
    let deselected: PreviewLanguage | null = null;
    mount(
      createElement(LanguageDeselectChips, {
        counts: languageCounts(ENTRIES),
        label: (lang: PreviewLanguage) => lang.toUpperCase(),
        buttonText: (lang: string, n: number) => `Alle ${lang} abwählen · ${n}`,
        onDeselect: (lang: PreviewLanguage) => {
          deselected = lang;
        },
      }),
    );
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Alle DE abwählen · 2",
      "Alle EN abwählen · 1",
    ]);
    act(() => {
      buttons[0]?.click();
    });
    expect(deselected).toBe("de");
  });

  it("nur eine Sprache im Bestand → keine Chips (wäre identisch mit Alle abwählen)", () => {
    mount(
      createElement(LanguageDeselectChips, {
        counts: languageCounts([entry("[DE] Nur Deutsch", "Pumpen")]),
        label: (lang: PreviewLanguage) => lang,
        buttonText: (lang: string, n: number) => `${lang}·${n}`,
        onDeselect: () => undefined,
      }),
    );
    expect(container.querySelectorAll("button").length).toBe(0);
  });
});
