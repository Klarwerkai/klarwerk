// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega28 BLOCK B (bens M27-1) — DER ORDNER-SCHLÜSSEL KOLLIDIERT.
// ================================================================================================
//
// DER BEFUND. `importSelectView.toTreeGroup` übernahm jeden Pfad-Abschnitt UNVERÄNDERT als
// `group.key`; `ImportPreviewTree.FolderNode` baut daraus per Verkettung mit einem Schrägstrich den
// Auf-/Zu-Schlüssel. Ein EINZELNER Ordner namens „A/B" und die echte Verschachtelung „A" → „B"
// erhielten damit denselben Schlüssel. Kommen beide im selben Import vor, teilen sie ihren Zustand:
// das Aufklappen des einen schaltet das andere um. Auswahl und Daten sind nicht betroffen — es ist
// ein Anzeigefehler, aber bei Confluence-Titeln mit Schrägstrich ein völlig legaler Fall.
//
// WARUM DIE HEUTIGEN TESTS IHN NICHT BEMERKT HÄTTEN (Pedis ausdrückliche Auflage): sie prüfen den
// Schrägstrich nur im SEITENTITEL ohne Elternkette (import-folder-tree: „Titel mit / im Namen").
// Ein Titel wird nie zu einem Ordner-Segment — die Kollision entsteht erst, wenn ein Schrägstrich
// in der ELTERNKETTE steht UND die entsprechende echte Verschachtelung DANEBEN im selben Baum
// existiert. Genau diese Konstellation pinnt diese Datei, pur und gemountet.
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import type { ImportPreviewEntry } from "../../apps/web/src/api/types";
import { ImportPreviewTree } from "../../apps/web/src/components/ImportPreviewTree";
import {
  type PreviewRow,
  type PreviewTreeGroup,
  folderTree,
  folderTreeSegmentKey,
  groupCheckboxState,
} from "../../apps/web/src/lib/importSelectView";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | undefined;
let root: ReturnType<typeof createRoot> | undefined;

afterEach(() => {
  const mounted = root;
  if (mounted) {
    act(() => {
      mounted.unmount();
    });
  }
  container?.remove();
  root = undefined;
  container = undefined;
});

// DIE kollidierende Konstellation, BEIDE Strukturen im SELBEN Baum:
//   • ein einzelner Ordner, dessen Name einen Schrägstrich enthält: „A/B"
//   • die echte Verschachtelung „A" → „B"
// Vor mega28 ergaben beide den Anzeige-Schlüssel „folder:S/A/B".
const ENTRIES: ImportPreviewEntry[] = [
  {
    title: "Seite im Ordner A/B",
    sourceScope: "S",
    sourcePath: ["A/B"],
    hasImage: false,
    themes: [],
  },
  {
    title: "Seite in A → B",
    sourceScope: "S",
    sourcePath: ["A", "B"],
    hasImage: false,
    themes: [],
  },
];
const ROWS: PreviewRow[] = ENTRIES.map((entry, index) => ({ entry, index }));

// Der Anzeige-Schlüssel, EXAKT wie FolderNode ihn bildet (Eltern-Schlüssel + „/" + Kind-Schlüssel).
function nodeKeys(groups: readonly PreviewTreeGroup[], prefix = ""): string[] {
  return groups.flatMap((g) => {
    const key = prefix ? `${prefix}/${g.key}` : g.key;
    return [key, ...nodeKeys(g.children ?? [], key)];
  });
}

describe("mega28 B · Ordner-Schluessel: Einzelordner A/B neben der Verschachtelung A -> B", () => {
  it("der Baum enthält BEIDE Strukturen — die Vorbedingung des Befunds ist echt", () => {
    const tree = folderTree(ROWS);
    const root0 = tree[0] as PreviewTreeGroup;
    const childValues = (root0.children ?? []).map((c) => c.value).sort();
    // Ein Ordner heißt wörtlich „A/B", ein zweiter heißt „A" und hat ein Kind „B".
    expect(childValues).toEqual(["A", "A/B"]);
    const a = (root0.children ?? []).find((c) => c.value === "A") as PreviewTreeGroup;
    expect((a.children ?? []).map((c) => c.value)).toEqual(["B"]);
  });

  it("die Anzeige-Schluessel sind PAARWEISE VERSCHIEDEN (vor mega28 kollidierten zwei)", () => {
    const keys = nodeKeys(folderTree(ROWS));
    expect(new Set(keys).size).toBe(keys.length);
    // Konkret: der Einzelordner ist kodiert, die Verschachtelung bleibt der echte Pfad.
    expect(keys).toContain("folder:S/A%2FB");
    expect(keys).toContain("folder:S/A/B");
  });

  it("die Segment-Kodierung ist injektiv — auch für ein Segment, das selbst ein Prozentzeichen trägt", () => {
    // encodeURIComponent maskiert „%" als %25; „A%2FB" (wörtlich) und „A/B" fallen deshalb ebenfalls
    // auseinander. Ohne diese Eigenschaft hätten wir die Kollision nur verschoben.
    expect(folderTreeSegmentKey("A/B")).toBe("A%2FB");
    expect(folderTreeSegmentKey("A%2FB")).toBe("A%252FB");
    expect(folderTreeSegmentKey("A")).toBe("A");
  });

  it("GEMOUNTET: das Aufklappen des einen Ordners schaltet den anderen NICHT um", () => {
    const opened: string[] = [];
    const host = document.createElement("div");
    document.body.appendChild(host);
    container = host;
    const tree = createRoot(host);
    root = tree;
    act(() => {
      tree.render(
        createElement(ImportPreviewTree, {
          groups: folderTree(ROWS),
          isOpen: () => true,
          setOpen: (key: string) => {
            opened.push(key);
          },
          checkStateOf: (rows: readonly PreviewRow[]) =>
            groupCheckboxState(
              ENTRIES.map(() => false),
              rows,
            ),
          onToggleGroup: () => undefined,
          labelOf: (group: PreviewTreeGroup) => group.value,
          countLabel: (n: number) => `${n}`,
          renderRow: ({ entry, index }: PreviewRow) =>
            createElement("li", { key: index, "data-index": String(index) }, entry.title),
        }),
      );
    });

    // Die zwei Knoten, die vorher denselben Schluessel trugen: der Einzelordner A/B und das Kind
    // B unter A. Sie werden ueber ihre Beschriftung gefunden - dieselbe, die der Nutzer sieht.
    const summaries = [...host.querySelectorAll("details > summary")];
    const labelOf = (s: Element): string =>
      s.querySelector("input[type=checkbox]")?.getAttribute("aria-label") ?? "";
    const single = summaries.find((s) => labelOf(s) === "A/B") as HTMLElement;
    const nested = summaries.find(
      (s) => labelOf(s) === "B" && s.closest("details")?.parentElement?.closest("details") !== null,
    ) as HTMLElement;
    expect(single).toBeDefined();
    expect(nested).toBeDefined();

    // Beide Knoten melden ihren Zustand unter EIGENEM Schluessel - kein geteilter Auf/Zu-Zustand.
    // `toggle` blubbert nativ nicht; genau so feuert es auch im Browser (je Knoten einmal).
    const detailsOf = (s: Element): HTMLDetailsElement =>
      s.closest("details") as HTMLDetailsElement;
    // Der Knoten selbst meldet zuerst; React reicht `toggle` danach an die Eltern-Knoten weiter
    // (die dabei ihren EIGENEN, unveraenderten Zustand melden). Uns interessiert die erste Meldung.
    const reportOf = (summary: HTMLElement): string => {
      const before = opened.length;
      act(() => {
        detailsOf(summary).open = false;
        detailsOf(summary).dispatchEvent(new Event("toggle"));
      });
      return opened[before] as string;
    };
    const singleKey = reportOf(single);
    const nestedKey = reportOf(nested);

    // VOR mega28 waren diese beiden Schluessel IDENTISCH ("folder:S/A/B") - ein Auf/Zu am einen
    // Knoten schaltete den anderen mit um. Jetzt sind es zwei verschiedene Schluessel.
    expect(singleKey).toBe("folder:S/A%2FB");
    expect(nestedKey).toBe("folder:S/A/B");
    expect(singleKey).not.toBe(nestedKey);
  });
});
