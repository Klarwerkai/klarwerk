// RT5a-c (nacht24 Paket 5): pure Logik des Subfolder-Baums und der Sprach-Massenaktion.
import { describe, expect, it } from "vitest";
import type { ImportPreviewEntry } from "../../apps/web/src/api/types";
import {
  type PreviewRow,
  deselectLanguage,
  groupRowsTree,
  languageCounts,
  previewLanguage,
} from "../../apps/web/src/lib/importSelectView";

function entry(title: string, theme = ""): ImportPreviewEntry {
  return { title, hasImage: false, themes: theme ? [theme] : [] };
}

function rowsOf(entries: readonly ImportPreviewEntry[]): PreviewRow[] {
  return entries.map((e, index) => ({ entry: e, index }));
}

const ENTRIES: ImportPreviewEntry[] = [
  entry("[DE] Pumpe warten", "Pumpen"),
  entry("[DE] Ventil pruefen", "Ventile"),
  entry("[DE] Pumpe entlueften", "Pumpen"),
  entry("[EN] Pump guide", "Pumpen"),
  entry("Ohne Kennzeichnung", "Normen"),
];

describe("RT5a: echter Subfolder-Baum (Sprache → Themen-Unterordner)", () => {
  it("Sprach-Ordner mit ≥2 Themen bekommt Themen-Unterordner; mit nur einem Thema bleibt er flach", () => {
    const tree = groupRowsTree(rowsOf(ENTRIES), "language");
    const de = tree.find((g) => g.language === "de");
    expect(de).toBeDefined();
    // DE hat 2 Themen (Pumpen, Ventile) → echte Unterordner.
    expect(de?.children?.map((c) => c.value)).toEqual(["Pumpen", "Ventile"]);
    expect(de?.children?.flatMap((c) => c.rows.map((r) => r.index)).sort()).toEqual([0, 1, 2]);
    // EN hat nur 1 Thema → ehrlich KEIN Unterordner (ein einzelner wäre nur Klickweg).
    const en = tree.find((g) => g.language === "en");
    expect(en?.children).toBeUndefined();
    // Themen-Modus bleibt bewusst einstufig.
    const themeTree = groupRowsTree(rowsOf(ENTRIES), "theme");
    expect(themeTree.every((g) => g.children === undefined)).toBe(true);
    // "none" liefert weiter keine Gruppen.
    expect(groupRowsTree(rowsOf(ENTRIES), "none")).toEqual([]);
  });
});

describe("RT5b: Sprach-Massenaktion (alle <Sprache> abwählen)", () => {
  it("languageCounts: nur vorkommende Sprachen, feste Ordnung DE/EN/NL/übrige", () => {
    expect(languageCounts(ENTRIES)).toEqual([
      { language: "de", count: 3 },
      { language: "en", count: 1 },
      { language: "other", count: 1 },
    ]);
    expect(languageCounts([])).toEqual([]);
  });

  it("deselectLanguage: wählt ALLE Einträge der Sprache ab — global, unabhängig von Sichtbarkeit; nie eine Anwahl", () => {
    const checked = ENTRIES.map(() => true);
    const next = deselectLanguage(checked, ENTRIES, "de");
    expect(next).toEqual([false, false, false, true, true]);
    // Idempotent + keine versteckte Anwahl: bereits abgewählte bleiben abgewählt.
    const again = deselectLanguage(next, ENTRIES, "de");
    expect(again).toEqual(next);
    // Kontrolle: die Sprach-Erkennung ist die geteilte Titel-Präfix-Logik.
    expect(previewLanguage(ENTRIES[3] as ImportPreviewEntry)).toBe("en");
  });
});
