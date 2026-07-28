// AUFTRAG-mega27 Block A: der ECHTE Quell-Ordnerbaum — von der Elternkette der Quelle bis in die
// Zeile. Pure Logik (kein DOM); die gemountete Gegenprobe steht in import-preview-tree-mounted.
//
// Der Befund, mit dem mega27 anfängt: bis mega26 gab es KEINE Struktur zu zeigen, nur abgeleitete
// Merkmale (Sprache/Thema). Diese Datei pinnt die Kette fest, die das behebt:
//   Confluence `ancestors` → mapper.sourcePath → ImportItem → toPreviewEntry → ImportPreviewEntry
//   → folderTree → PreviewTreeGroup.
import { describe, expect, it } from "vitest";
import type { ImportPreviewEntry } from "../../apps/web/src/api/types";
import {
  type PreviewRow,
  type PreviewTreeGroup,
  bulkSelectableRows,
  countFolderNodes,
  defaultGroupMode,
  folderModeUnavailableReason,
  folderTree,
  groupCheckboxState,
  groupModeOptions,
  groupRowsTree,
  setRowsSelected,
} from "../../apps/web/src/lib/importSelectView";
import { DEMO_CORPUS, DEMO_SPACE_KEY, corpusImportItems } from "../../services/app/src/demo-corpus";
import {
  confluenceSourcePath,
  mapConfluencePageToImportItem,
} from "../../services/confluence/src/mapper";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { toPreviewEntry } from "../../services/library-analytics/src/select";

function page(over: Partial<ConfluencePage> & { id: string; title: string }): ConfluencePage {
  return { ...over } as ConfluencePage;
}

function rowsOf(entries: readonly ImportPreviewEntry[]): PreviewRow[] {
  return entries.map((entry, index) => ({ entry, index }));
}

// Der Baum als lesbarer Pfad-Abdruck „Wurzel/Ordner/Unterordner (n)" — macht Tiefe und Zuordnung
// in einer Zeile prüfbar.
function flatten(groups: readonly PreviewTreeGroup[], prefix = ""): string[] {
  return groups.flatMap((g) => {
    const path = prefix ? `${prefix}/${g.value}` : g.value;
    return [`${path} (${g.rows.length})`, ...flatten(g.children ?? [], path)];
  });
}

describe("A1/A2 · Elternkette aus der Quelle → quellneutrales sourcePath", () => {
  it("mapper übernimmt die Elterntitel in Quell-Reihenfolge, Wurzel zuerst, OHNE die Seite selbst", () => {
    const item = mapConfluencePageToImportItem(
      page({
        id: "42",
        title: "Halle 7 — Farbvorgabe",
        ancestors: [
          { id: "1", title: "Betrieb" },
          { id: "2", title: "Arbeitssicherheit" },
        ],
      }),
      { baseUrl: "https://c.example/wiki", spaceKey: "KWDEMO" },
    );
    expect(item.sourcePath).toEqual(["Betrieb", "Arbeitssicherheit"]);
    // Die Seite selbst steht NICHT im Pfad.
    expect(item.sourcePath).not.toContain("Halle 7 — Farbvorgabe");
    // Der Container bleibt der Space (unverändert, SCRUM-510 R2b).
    expect(item.sourceScope).toBe("KWDEMO");
  });

  it("KEIN FELD OHNE ERZEUGER: ohne Elternkette fehlt das Feld — kein leeres Array, keine erfundene Wurzel", () => {
    // Kein ancestors-Expand geliefert.
    const noExpand = mapConfluencePageToImportItem(page({ id: "1", title: "Wurzelseite" }), {
      baseUrl: "https://c.example/wiki",
      spaceKey: "K",
    });
    expect(noExpand).not.toHaveProperty("sourcePath");
    // Wurzelseite: ancestors ist LEER.
    expect(confluenceSourcePath(page({ id: "1", title: "T", ancestors: [] }))).toBeUndefined();
    // Nur titellose Ahnen → ebenfalls nichts (kein Platzhalter-Ordner).
    expect(
      confluenceSourcePath(
        page({ id: "1", title: "T", ancestors: [{ id: "9" }, { title: "  " }] }),
      ),
    ).toBeUndefined();
    // Nichts wird aus dem Titel geraten.
    const dotted = mapConfluencePageToImportItem(page({ id: "1", title: "A / B / C" }), {
      baseUrl: "https://c.example/wiki",
      spaceKey: "K",
    });
    expect(dotted).not.toHaveProperty("sourcePath");
  });

  it("Elterntitel werden wie Titel/Autor EINMAL an der Quelle dekodiert (textCodec gilt mit)", () => {
    const item = mapConfluencePageToImportItem(
      page({ id: "1", title: "T", ancestors: [{ title: "K&uuml;che" }] }),
      { baseUrl: "https://c.example/wiki", spaceKey: "K" },
    );
    expect(item.sourcePath).toEqual(["Küche"]);
    expect(item.textCodec).toBe("decoded");
  });
});

describe("A3 · Durchreichen bis in die Vorschau", () => {
  it("toPreviewEntry trägt sourceScope + sourcePath, additiv und optional", () => {
    const entry = toPreviewEntry(
      mapConfluencePageToImportItem(
        page({ id: "1", title: "T", ancestors: [{ title: "Betrieb" }, { title: "IT" }] }),
        { baseUrl: "https://c.example/wiki", spaceKey: "KWDEMO" },
      ),
    );
    expect(entry.sourceScope).toBe("KWDEMO");
    expect(entry.sourcePath).toEqual(["Betrieb", "IT"]);
  });
});

describe("A4 · Ordnerbaum beliebiger Tiefe", () => {
  const entries: ImportPreviewEntry[] = [
    {
      title: "Blau",
      hasImage: false,
      themes: [],
      sourceScope: "KWDEMO",
      sourcePath: ["Betrieb", "Arbeitssicherheit", "Halle 7"],
    },
    {
      title: "Rot",
      hasImage: false,
      themes: [],
      sourceScope: "KWDEMO",
      sourcePath: ["Betrieb", "Arbeitssicherheit", "Halle 7"],
    },
    {
      title: "Backup",
      hasImage: false,
      themes: [],
      sourceScope: "KWDEMO",
      sourcePath: ["Betrieb", "IT-Betrieb"],
    },
    // Ohne Elternkette: hängt DIREKT unter der Wurzel — nicht in „Sonstiges".
    { title: "Lose Seite", hasImage: false, themes: [], sourceScope: "KWDEMO" },
  ];

  it("baut die volle Tiefe; die Wurzel ist der Quell-Container", () => {
    const tree = folderTree(rowsOf(entries));
    expect(flatten(tree)).toEqual([
      "KWDEMO (4)",
      "KWDEMO/Betrieb (3)",
      "KWDEMO/Betrieb/Arbeitssicherheit (2)",
      "KWDEMO/Betrieb/Arbeitssicherheit/Halle 7 (2)",
      "KWDEMO/Betrieb/IT-Betrieb (1)",
    ]);
    expect(countFolderNodes(tree)).toBe(5);
  });

  it("Einträge ohne Pfad hängen SICHTBAR direkt unter der Wurzel (kein erfundener Ordner)", () => {
    const [root] = folderTree(rowsOf(entries));
    expect(root?.ownRows?.map((r) => r.entry.title)).toEqual(["Lose Seite"]);
    // Es gibt keinen Sammel-Unterordner für sie.
    expect(root?.children?.map((c) => c.value)).toEqual(["Betrieb"]);
  });

  it("group.rows ist der GESAMTE Teilbaum — Grundlage für Dreizustand und Zähler", () => {
    const tree = folderTree(rowsOf(entries));
    const betrieb = tree[0]?.children?.[0];
    expect(betrieb?.value).toBe("Betrieb");
    expect(betrieb?.rows.map((r) => r.index).sort()).toEqual([0, 1, 2]);
    // Direkt an „Betrieb" hängt keine Zeile — alle liegen tiefer.
    expect(betrieb?.ownRows).toEqual([]);
  });

  it("groupRowsTree('folder') liefert denselben Baum; groupRows('folder') die oberste Ebene", () => {
    expect(flatten(groupRowsTree(rowsOf(entries), "folder"))).toEqual(
      flatten(folderTree(rowsOf(entries))),
    );
  });

  it("mehrere Quell-Container ergeben mehrere Wurzeln, alphabetisch", () => {
    const two: ImportPreviewEntry[] = [
      { title: "b", hasImage: false, themes: [], sourceScope: "ZWEI", sourcePath: ["X"] },
      { title: "a", hasImage: false, themes: [], sourceScope: "EINS", sourcePath: ["Y"] },
    ];
    expect(folderTree(rowsOf(two)).map((g) => g.value)).toEqual(["EINS", "ZWEI"]);
  });

  it("Ordner-Modus ist die VORGABE, sobald es Struktur gibt — sonst ehrlicher Rückfall mit Grund", () => {
    expect(defaultGroupMode(entries)).toBe("folder");
    expect(folderModeUnavailableReason(entries)).toBeNull();
    expect(groupModeOptions(entries)[1]).toEqual({ mode: "folder", count: 5 });

    // Kein Eintrag trägt einen Pfad → kein Ordner-Modus, benannter Grund, heutiges Verhalten.
    const flat: ImportPreviewEntry[] = [
      { title: "a", hasImage: false, themes: [], sourceScope: "K" },
      { title: "b", hasImage: false, themes: [], sourceScope: "K" },
    ];
    expect(defaultGroupMode(flat)).toBe("none");
    expect(folderModeUnavailableReason(flat)).toBe("no-path");
    expect(groupModeOptions(flat).some((o) => o.mode === "folder")).toBe(false);
  });

  it("Pfad vorhanden, aber nur EIN Ordner insgesamt → ehrlicher Rückfall (single-folder)", () => {
    // Wurzel ohne Namen (kein sourceScope) und ein Eintrag ohne Pfad: genau 1 Knoten.
    const oneNode: ImportPreviewEntry[] = [{ title: "a", hasImage: false, themes: [] }];
    expect(folderModeUnavailableReason(oneNode)).toBe("no-path");
    // Ein Pfad-Segment über einer namenlosen Wurzel ergibt 2 Knoten → verfügbar.
    const twoNodes: ImportPreviewEntry[] = [
      { title: "a", hasImage: false, themes: [], sourceScope: "K", sourcePath: ["Nur einer"] },
    ];
    expect(folderModeUnavailableReason(twoNodes)).toBeNull();
  });
});

describe("A5 · Dreizustand über den Teilbaum + unveränderte Original-Index-Bindung", () => {
  const entries: ImportPreviewEntry[] = [
    { title: "tief-1", hasImage: false, themes: [], sourceScope: "K", sourcePath: ["A", "B"] },
    { title: "tief-2", hasImage: false, themes: [], sourceScope: "K", sourcePath: ["A", "B"] },
    { title: "flach", hasImage: false, themes: [], sourceScope: "K", sourcePath: ["A"] },
    // Bereits importiert → F1: ein Bulk fasst ihn NIE an.
    {
      title: "bekannt",
      hasImage: false,
      themes: [],
      sourceScope: "K",
      sourcePath: ["A", "B"],
      alreadyImported: true,
    },
  ];
  const tree = folderTree(rowsOf(entries));
  const a = tree[0]?.children?.[0] as PreviewTreeGroup;

  it("der Haken eines Ordners aggregiert über ALLE Ebenen darunter, nicht nur die direkten Kinder", () => {
    expect(a.value).toBe("A");
    // „A" hat eine eigene Zeile (flach) UND einen Unterordner „B" mit drei Zeilen.
    expect(a.rows.map((r) => r.index).sort()).toEqual([0, 1, 2, 3]);
    expect(a.ownRows?.map((r) => r.index)).toEqual([2]);

    expect(groupCheckboxState([false, false, false, false], a.rows)).toBe("off");
    // Nur die tiefe Zeile 0 gewählt → gemischt (obwohl das direkte Kind „flach" unberührt ist).
    expect(groupCheckboxState([true, false, false, false], a.rows)).toBe("mixed");
    // Alle BULK-WÄHLBAREN (0,1,2) an; die bekannte Zeile 3 bleibt aus → trotzdem "on" (F1).
    expect(groupCheckboxState([true, true, true, false], a.rows)).toBe("on");
  });

  it("die Auswahl bleibt an den ORIGINAL-Index gebunden — quer über alle Ebenen", () => {
    const next = setRowsSelected([false, false, false, false], bulkSelectableRows(a.rows), true);
    // Genau die bulk-wählbaren Original-Indizes 0,1,2; die bekannte Zeile 3 bleibt aus (F1).
    expect(next).toEqual([true, true, true, false]);
    // Der Baum kennt keine eigene Nummerierung: jede Zeile trägt ihren Originalindex weiter.
    expect(a.rows.map((r) => r.index)).toEqual(a.rows.map((r) => entries.indexOf(r.entry)));
  });
});

describe("A6 · Der Demo-Bestand hat eine echte, mehrstufige Struktur", () => {
  it("corpusImportItems trägt die Elternkette; eine Seite ist bewusst Wurzelseite", () => {
    const items = corpusImportItems("de");
    expect(items).toHaveLength(DEMO_CORPUS.length);
    const withPath = items.filter((i) => (i.sourcePath?.length ?? 0) > 0);
    expect(withPath.length).toBe(items.length - 1);
    // Kein leeres Array für die Wurzelseite — das Feld FEHLT.
    expect(items.filter((i) => !i.sourcePath)).toHaveLength(1);
    expect(items.every((i) => i.sourceScope === DEMO_SPACE_KEY)).toBe(true);
  });

  it("daraus entsteht ein Baum mit mehreren Ebenen — nicht ein einziger flacher Ordner", () => {
    const entries = corpusImportItems("de").map((item) => toPreviewEntry(item));
    const tree = folderTree(rowsOf(entries));
    expect(flatten(tree)).toEqual([
      "KWDEMO (8)",
      "KWDEMO/Betrieb (5)",
      "KWDEMO/Betrieb/Arbeitssicherheit (2)",
      "KWDEMO/Betrieb/Arbeitssicherheit/Halle 7 (2)",
      "KWDEMO/Betrieb/IT-Betrieb (3)",
      "KWDEMO/Betrieb/IT-Betrieb/Datensicherung (2)",
      "KWDEMO/Betrieb/IT-Betrieb/Netzzugang (1)",
      "KWDEMO/Vertrieb (1)",
      "KWDEMO/Verwaltung (1)",
      "KWDEMO/Verwaltung/Reisekosten (1)",
    ]);
    // Der Ordner-Modus ist damit im Demo-Bestand die Vorgabe.
    expect(defaultGroupMode(entries)).toBe("folder");
    // Die Wurzelseite hängt sichtbar direkt unter dem Container.
    expect(tree[0]?.ownRows?.map((r) => r.entry.title)).toEqual(["CRM-Tempo (Annahme)"]);
  });

  it("die Struktur ist sprach-neutral — derselbe Baum in DE/EN/NL", () => {
    const shape = (locale: "de" | "en" | "nl"): string[] =>
      flatten(folderTree(rowsOf(corpusImportItems(locale).map((i) => toPreviewEntry(i))))).map(
        (line) => line.replace(/ \(\d+\)$/, ""),
      );
    expect(shape("en")).toEqual(shape("de"));
    expect(shape("nl")).toEqual(shape("de"));
  });
});
