import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ImportPreviewEntry, ImportSelectCriteria } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { summarizeSelectCriteria } from "../../apps/web/src/lib/importExplore";
// WP-SHIP9-S2 Paket 2 (D2–D7): reines Auswahl-/Filter-/Gruppen-View-Modell der Trefferliste.
import {
  bulkSelectableRows,
  chipMatches,
  clearAllSelected,
  groupRows,
  isBulkSelectable,
  previewLanguage,
  rowsAllChecked,
  selectionSummary,
  setRowsSelected,
  visibleRows,
} from "../../apps/web/src/lib/importSelectView";

// IC-3: pures Auswahl-Kriterien-View-Model + Verdrahtung (Source-Inspektion, Muster capture-from-file).

const LABELS = {
  themes: "Themen",
  authors: "Autoren",
  keywords: "Stichworte",
  years: "Jahre",
  limit: "Limit",
  // WP-IC-PAKET-1 (Teil 3): Space-Filter-Zeile.
  spaces: "Bereiche",
};

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("IC-3: summarizeSelectCriteria", () => {
  it("leere Kriterien → leere Liste (die Komponente zeigt alles)", () => {
    expect(summarizeSelectCriteria({}, LABELS)).toEqual([]);
  });

  it("bildet gesetzte Felder auf lesbare Zeilen ab", () => {
    const criteria: ImportSelectCriteria = {
      themes: ["wartung", "safety"],
      authors: ["Anna"],
      keywords: ["e5"],
      yearFrom: 2020,
      yearTo: 2026,
      limit: 50,
    };
    expect(summarizeSelectCriteria(criteria, LABELS)).toEqual([
      "Themen: wartung, safety",
      "Autoren: Anna",
      "Stichworte: e5",
      "Jahre: 2020–2026",
      "Limit: 50",
    ]);
  });

  it("WP-IC-PAKET-1 (Teil 3): Space-Filter erscheint als eigene Zeile", () => {
    expect(summarizeSelectCriteria({ spaces: ["OPS", "DOKU"] }, LABELS)).toEqual([
      "Bereiche: OPS, DOKU",
    ]);
  });

  it("offene Jahres-Grenze wird mit … dargestellt", () => {
    expect(summarizeSelectCriteria({ yearFrom: 2024 }, LABELS)).toEqual(["Jahre: 2024–…"]);
    expect(summarizeSelectCriteria({ yearTo: 2024 }, LABELS)).toEqual(["Jahre: …–2024"]);
  });
});

describe("IC-3: Verdrahtung im Import-Cockpit", () => {
  it("ImportExplore rendert die Auswahl-Komponente ImportSelect (Chips der Landkarte als Filter)", () => {
    const src = read("apps/web/src/components/ImportExplore.tsx");
    expect(src).toContain('import { ImportSelect } from "./ImportSelect"');
    // WP-IC-PAKET-1 (Teil 3): die Landkarten-Chips (Themen/Autoren/Spaces) speisen die Auswahl.
    expect(src).toContain(
      "<ImportSelect chip={{ themes: selThemes, authors: selAuthors, spaces: selSpaces }} />",
    );
  });

  it("ImportSelect verdrahtet den READ-ONLY select-Client und das View-Model", () => {
    const src = read("apps/web/src/components/ImportSelect.tsx");
    expect(src).toContain("endpoints.admin.import.select(");
    expect(src).toContain("summarizeSelectCriteria(");
    // Noch KEIN Übernahme-Button (das ist IC-4) und kein Schreib-/Kandidaten-Aufruf.
    expect(src).not.toContain("importCandidates");
    expect(src).not.toContain(".review(");
  });

  it("endpoints.ts stellt admin.import.select auf den READ-ONLY select-Pfad", () => {
    const src = read("apps/web/src/api/endpoints.ts");
    expect(src).toContain("/admin/import/confluence/select");
    expect(src).toContain("ImportSelectResponse");
  });

  it("die neuen imp.select-Texte sind in DE/EN/NL vorhanden", () => {
    const keys = [
      "imp.select.title",
      "imp.select.promptPlaceholder",
      "imp.select.previewCta",
      "imp.select.matched",
      "imp.select.critThemes",
      "imp.select.critAll",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en", "nl"]) {
        expect(
          String(i18n.getResource(lng, "translation", key) ?? "").length,
          `${lng}:${key}`,
        ).toBeGreaterThan(0);
      }
    }
    expect(String(i18n.getResource("en", "translation", "imp.select.matched"))).toContain(
      "{{matched}}",
    );
  });

  // WP-SHIP9-S2 (bens Folgeschnitt B4): der KI-Ausfall der Satz-Auswertung zeigt den WAHREN Grund —
  // vertraulichkeitsbedingter Cloud-Ausschluss ist etwas anderes als „KI nicht erreichbar".
  it("ImportSelect zeigt bei fallbackReason confidential den spezifischen Text (nicht generisch)", () => {
    const src = read("apps/web/src/components/ImportSelect.tsx");
    // Der confidential-Zweig ist gewählt und führt auf den eigenen Grund-Key.
    expect(src).toContain('preview.fallbackReason === "confidential"');
    expect(src).toContain('t("imp.select.aiConfidential")');
    // Der generische Text bleibt der Default für alle anderen Ausfall-Ursachen.
    expect(src).toContain('t("imp.select.aiUnavailable")');
  });

  it("imp.select.aiConfidential ist in DE/EN/NL vorhanden und benennt die Vertraulichkeit", () => {
    for (const lng of ["de", "en", "nl"]) {
      const text = String(i18n.getResource(lng, "translation", "imp.select.aiConfidential") ?? "");
      expect(text.length, `${lng}:imp.select.aiConfidential`).toBeGreaterThan(0);
    }
    // DE nennt „vertraulich" explizit (ehrlicher, spezifischer Grund).
    expect(String(i18n.getResource("de", "translation", "imp.select.aiConfidential"))).toContain(
      "vertraulich",
    );
  });
});

// WP-SHIP9-S2 Paket 2 (D2–D7): Auswahllogik der Trefferliste als PURE Logik-Tests.
function entry(over: Partial<ImportPreviewEntry> & { title: string }): ImportPreviewEntry {
  return { hasImage: false, themes: [], ...over };
}

const ROWS: ImportPreviewEntry[] = [
  entry({ title: "DE: Wartungsplan", themes: ["wartung"], author: "Anna" }),
  entry({ title: "[EN] Safety guide", themes: ["safety"] }),
  entry({ title: "NL – Onderhoud", themes: ["wartung"], alreadyImported: true }),
  entry({ title: "Fehlercodes Übersicht", themes: [], alreadyQueued: true }),
];

describe("Paket 2 · previewLanguage (D5)", () => {
  it("erkennt DE/EN/NL-Präfixe (Klammer/Trenner-tolerant), sonst other", () => {
    expect(previewLanguage(entry({ title: "DE: Wartungsplan" }))).toBe("de");
    expect(previewLanguage(entry({ title: "[EN] Safety" }))).toBe("en");
    expect(previewLanguage(entry({ title: "NL – Onderhoud" }))).toBe("nl");
    expect(previewLanguage(entry({ title: "(deu) Handbuch" }))).toBe("de");
    expect(previewLanguage(entry({ title: "Fehlercodes" }))).toBe("other");
    // Kein Fehlgriff mitten im Wort (z. B. „Denver" beginnt mit „de", ist aber keine Sprache).
    expect(previewLanguage(entry({ title: "Denver Bericht" }))).toBe("other");
  });
});

describe("Paket 2 · chipMatches (D7)", () => {
  it("filtert nach Neu/Importiert/Vorgemerkt, all = alles", () => {
    expect(ROWS.filter((e) => chipMatches(e, "new")).map((e) => e.title)).toEqual([
      "DE: Wartungsplan",
      "[EN] Safety guide",
    ]);
    expect(ROWS.filter((e) => chipMatches(e, "imported")).map((e) => e.title)).toEqual([
      "NL – Onderhoud",
    ]);
    expect(ROWS.filter((e) => chipMatches(e, "queued")).map((e) => e.title)).toEqual([
      "Fehlercodes Übersicht",
    ]);
    expect(ROWS.filter((e) => chipMatches(e, "all"))).toHaveLength(4);
  });
});

describe("Paket 2 · visibleRows (D4/D7)", () => {
  it("Suche trifft Titel und Autor (case-insensitiv), Originalindex bleibt", () => {
    const found = visibleRows(ROWS, {
      query: "anna",
      chip: "all",
      hideImported: false,
      groupMode: "none",
    });
    expect(found.map((r) => r.index)).toEqual([0]);
  });

  it("hideImported blendet importierte UND vorgemerkte aus (D4)", () => {
    const found = visibleRows(ROWS, {
      query: "",
      chip: "all",
      hideImported: true,
      groupMode: "none",
    });
    expect(found.map((r) => r.entry.title)).toEqual(["DE: Wartungsplan", "[EN] Safety guide"]);
  });

  it("Chip + Suche kombinieren", () => {
    const found = visibleRows(ROWS, {
      query: "guide",
      chip: "new",
      hideImported: false,
      groupMode: "none",
    });
    expect(found.map((r) => r.entry.title)).toEqual(["[EN] Safety guide"]);
  });
});

describe("Paket 2 · groupRows (D3/D5)", () => {
  it("Sprache: feste Ordnung DE/EN/NL/other, nur vorhandene Gruppen", () => {
    const rows = visibleRows(ROWS, {
      query: "",
      chip: "all",
      hideImported: false,
      groupMode: "language",
    });
    const groups = groupRows(rows, "language");
    expect(groups.map((g) => g.value)).toEqual(["de", "en", "nl", "other"]);
    expect(groups[3]?.rows.map((r) => r.entry.title)).toEqual(["Fehlercodes Übersicht"]);
  });

  it("Thema: alphabetisch, ohne-Thema zuletzt", () => {
    const rows = visibleRows(ROWS, {
      query: "",
      chip: "all",
      hideImported: false,
      groupMode: "theme",
    });
    const groups = groupRows(rows, "theme");
    expect(groups.map((g) => g.value)).toEqual(["safety", "wartung", ""]);
  });

  it("none → keine Gruppen", () => {
    const rows = visibleRows(ROWS, {
      query: "",
      chip: "all",
      hideImported: false,
      groupMode: "none",
    });
    expect(groupRows(rows, "none")).toEqual([]);
  });
});

describe("Paket 2 · Auswahl (D2/D3)", () => {
  it("setRowsSelected setzt genau die übergebenen Originalindizes", () => {
    const checked = [false, false, false, false];
    const rows = visibleRows(ROWS, {
      query: "",
      chip: "new",
      hideImported: false,
      groupMode: "none",
    });
    const next = setRowsSelected(checked, rows, true);
    expect(next).toEqual([true, true, false, false]);
    expect(rowsAllChecked(next, rows)).toBe(true);
    // Die importierte Zeile (Index 2) blieb abgewählt → Gruppe „importiert" ist NICHT voll gewählt.
    const importedRows = visibleRows(ROWS, {
      query: "",
      chip: "imported",
      hideImported: false,
      groupMode: "none",
    });
    expect(rowsAllChecked(next, importedRows)).toBe(false);
  });

  it("selectionSummary zählt gewählt/gesamt", () => {
    expect(selectionSummary([true, false, true, false])).toEqual({ selected: 2, total: 4 });
  });
});

// WP-SHIP9-S2c (bens ROT F1): Bulk-Aktionen (Alle wählen, Themen-/Sprach-Gruppen-Checkbox) dürfen
// bereits importierte ODER vorgemerkte Einträge NIE mit-anwählen; die Haken-Anzeige spiegelt nur die
// bulk-wählbare Teilmenge. (ROWS = neu, neu, importiert, vorgemerkt.)
describe("Paket 2 · F1: Bulk-Auswahl lässt bekannte Einträge aus", () => {
  it("isBulkSelectable: nur neue Einträge sind bulk-wählbar", () => {
    expect(ROWS.map(isBulkSelectable)).toEqual([true, true, false, false]);
  });

  it("gemischte Gruppe: Bulk-Anwahl fasst NUR die neuen Einträge an, bekannte bleiben abgewählt", () => {
    const rows = visibleRows(ROWS, {
      query: "",
      chip: "all",
      hideImported: false,
      groupMode: "none",
    });
    const bulk = bulkSelectableRows(rows);
    expect(bulk.map((r) => r.entry.title)).toEqual(["DE: Wartungsplan", "[EN] Safety guide"]);
    // Bulk-Setzen über die bulk-wählbare Teilmenge: der importierte (Index 2) und der vorgemerkte
    // (Index 3) Eintrag bleiben aus — genau die S2-Bedingung.
    const next = setRowsSelected([false, false, false, false], bulk, true);
    expect(next).toEqual([true, true, false, false]);
    // Haken-Anzeige konsistent: über die bulk-wählbare Menge ist alles gewählt → Haken voll.
    expect(rowsAllChecked(next, bulk)).toBe(true);
    // Gegenprobe: über die volle Zeilenmenge wäre der Haken NICHT voll (bekannte sind aus) — der
    // alte Bug hätte hier „alles gewählt" gemeldet und die bekannten mit-angewählt.
    expect(rowsAllChecked(next, rows)).toBe(false);
  });

  it("Gruppe mit nur bekannten Einträgen: keine bulk-wählbare Zeile → Bulk fasst nichts an", () => {
    const knownOnly = [ROWS[2] as ImportPreviewEntry, ROWS[3] as ImportPreviewEntry];
    const rows = visibleRows(knownOnly, {
      query: "",
      chip: "all",
      hideImported: false,
      groupMode: "none",
    });
    const bulk = bulkSelectableRows(rows);
    expect(bulk).toHaveLength(0);
    const next = setRowsSelected([false, false], bulk, true);
    expect(next).toEqual([false, false]);
    expect(rowsAllChecked(next, bulk)).toBe(false);
  });
});

// WP-SHIP9-S2c (bens ROT F2): „Alle abwählen" leert GLOBAL — auch gewählte, aber durch Suche/Filter/
// Ausblenden versteckte Treffer.
describe("Paket 2 · F2: Alle abwählen leert die gesamte Auswahl", () => {
  it("ein gewählter, dann weggefilterter Treffer wird durch clearAllSelected trotzdem abgewählt", () => {
    // Index 0 ist gewählt; durch Suche „safety" ist er unsichtbar (nur Index 1 sichtbar).
    const checked = [true, false, false, false];
    const visible = visibleRows(ROWS, {
      query: "safety",
      chip: "all",
      hideImported: false,
      groupMode: "none",
    });
    expect(visible.map((r) => r.index)).toEqual([1]);
    // „Alle wählen" über die sichtbare Reichweite ließe Index 0 unberührt (weiterhin gewählt) …
    const onlyVisible = setRowsSelected(checked, bulkSelectableRows(visible), false);
    expect(onlyVisible[0]).toBe(true);
    // … „Alle abwählen" dagegen leert GLOBAL: keine Zeile bleibt gewählt.
    expect(clearAllSelected(checked)).toEqual([false, false, false, false]);
    expect(selectionSummary(clearAllSelected(checked)).selected).toBe(0);
  });
});

// WP-SHIP9-S2c: die Komponente verdrahtet die zentralen Regeln (Quelle-Inspektion, Repo-Muster).
describe("Paket 2 · F1/F2/F3: Verdrahtung in ImportSelect/ImportGroups", () => {
  it("ImportSelect nutzt bulkSelectableRows für Bulk-Setzen UND Haken, clearAllSelected für Abwählen", () => {
    const src = read("apps/web/src/components/ImportSelect.tsx");
    expect(src).toContain("bulkSelectableRows(");
    expect(src).toContain("clearAllSelected(");
    // „Alle abwählen" leert global; „Alle wählen" wirkt auf die bulk-wählbare sichtbare Menge.
    expect(src).toContain("clearAllSelected(prev)");
    expect(src).toContain("setRowsSelected(prev, bulkRows, true)");
    // Der Gruppen-Haken spiegelt die bulk-wählbare Teilmenge der Gruppe.
    expect(src).toContain("bulkSelectableRows(group.rows)");
  });

  it("ImportSelect reicht die gewählten Kandidaten-IDs an ImportGroups weiter (F3)", () => {
    const src = read("apps/web/src/components/ImportSelect.tsx");
    expect(src).toContain("selectedCandidateIds");
    expect(src).toContain("selectedCandidateIds={selectedCandidateIds}");
  });

  it("ImportGroups gibt selectedCandidateIds an group UND apply und deaktiviert den Weiter-Knopf bei leerer Auswahl", () => {
    const src = read("apps/web/src/components/ImportGroups.tsx");
    expect(src).toContain("selectedCandidateIds");
    expect(src).toContain("hasSelection");
    expect(src).toContain('disabled={busy === "group" || !hasSelection}');
    expect(src).toContain("IMPORT_GROUPS_TEXT.needSelection");
  });

  it("imp.groups.needSelection ist in DE/EN/NL vorhanden", () => {
    for (const lng of ["de", "en", "nl"]) {
      const text = String(i18n.getResource(lng, "translation", "imp.groups.needSelection") ?? "");
      expect(text.length, `${lng}:imp.groups.needSelection`).toBeGreaterThan(0);
    }
  });
});

describe("Paket 2 · Verdrahtung ImportSelect", () => {
  it("ImportSelect nutzt das View-Modul und rendert die Steuerungen (Suche/Chips/Alle/Gruppen)", () => {
    const src = read("apps/web/src/components/ImportSelect.tsx");
    expect(src).toContain('from "../lib/importSelectView"');
    expect(src).toContain("visibleRows(");
    expect(src).toContain("groupRows(");
    expect(src).toContain('t("imp.select.searchPlaceholder")');
    expect(src).toContain('t("imp.select.selectAll")');
    expect(src).toContain('t("imp.select.summary"');
  });

  it("die neuen Paket-2-Texte sind in DE/EN/NL vorhanden", () => {
    const keys = [
      "imp.select.searchPlaceholder",
      "imp.select.selectAll",
      "imp.select.hideImported",
      "imp.select.groupLanguage",
      "imp.select.chipNew",
      "imp.select.summary",
      "imp.select.emptyFiltered",
    ];
    for (const key of keys) {
      for (const lng of ["de", "en", "nl"]) {
        expect(
          String(i18n.getResource(lng, "translation", key) ?? "").length,
          `${lng}:${key}`,
        ).toBeGreaterThan(0);
      }
    }
    expect(String(i18n.getResource("en", "translation", "imp.select.summary"))).toContain(
      "{{selected}}",
    );
  });
});
