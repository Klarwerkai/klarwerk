// WP-IC-4 (Teil 2+3, pure Client-Logik): Vorab-Abwahl bereits Importierter, Gruppen-Entscheid als
// Vorgabe + Einzel-Override, laufender Zähler, Batches für ehrlichen Fortschritt und die ehrliche
// Bilanz (übernommen/übersprungen/ausgeschlossen/fehlgeschlagen inkl. not-found). Copy DE/EN/NL.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type GroupedCandidate,
  IMPORT_GROUPS_TEXT,
  aggregateBilanz,
  applyGroupToggle,
  buildBatches,
  groupLabelKey,
  hintLabelKey,
  includedIds,
  initialSelection,
  selectionCounts,
  toggleCandidate,
} from "../../apps/web/src/lib/importGroups";

const CANDIDATES: GroupedCandidate[] = [
  { id: "a", title: "Pumpe", alreadyImported: false, hints: [] },
  { id: "b", title: "Ventil", alreadyImported: true, hints: ["already-imported"] },
  { id: "c", title: "Fehler", alreadyImported: false, hints: ["short"] },
];
const GROUP = { title: "Wartung", ids: ["a", "b"] };

describe("WP-IC-4: Auswahl-Logik", () => {
  it("Vorab-Abwahl: bereits Importiertes startet ABGEWÄHLT (Dedupe-Vorgabe, Override möglich)", () => {
    const selection = initialSelection(CANDIDATES);
    expect(selection).toEqual({ a: true, b: false, c: true });
    expect(selectionCounts(selection)).toEqual({ selected: 2, total: 3 });
    // Einzel-Override: bewusstes Wieder-Anwählen bleibt möglich.
    const overridden = toggleCandidate(selection, "b");
    expect(overridden.b).toBe(true);
    expect(selectionCounts(overridden).selected).toBe(3);
  });

  it("Gruppen-Entscheid setzt die Vorgabe ALLER Gruppen-Kandidaten; Einzel-Override danach möglich", () => {
    let selection = initialSelection(CANDIDATES);
    selection = applyGroupToggle(selection, GROUP, false); // Gruppe ausschließen
    expect(selection).toEqual({ a: false, b: false, c: true });
    selection = applyGroupToggle(selection, GROUP, true); // Gruppe freigeben (inkl. b — bewusst)
    expect(selection).toEqual({ a: true, b: true, c: true });
    selection = toggleCandidate(selection, "a"); // Einzel-Override innerhalb der Gruppe
    expect(selection).toEqual({ a: false, b: true, c: true });
    expect(includedIds(selection).sort()).toEqual(["b", "c"]);
  });

  it("Batches für ehrlichen Fortschritt; markierte Gruppen/Hinweise haben lokalisierbare Keys", () => {
    expect(buildBatches(["1", "2", "3"], 2)).toEqual([["1", "2"], ["3"]]);
    expect(groupLabelKey({ title: "x", ids: [], kind: "catchall" })).toBe(
      IMPORT_GROUPS_TEXT.catchall,
    );
    expect(groupLabelKey({ title: "x", ids: [], kind: "no-theme" })).toBe(
      IMPORT_GROUPS_TEXT.noTheme,
    );
    expect(groupLabelKey({ title: "Wartung", ids: [] })).toBeNull();
    expect(hintLabelKey("already-imported")).toBe(IMPORT_GROUPS_TEXT.hintImported);
    expect(hintLabelKey("stale")).toBe(IMPORT_GROUPS_TEXT.hintStale);
    expect(hintLabelKey("short")).toBe(IMPORT_GROUPS_TEXT.hintShort);
  });

  it("BILANZ stimmt mit dem Fixture-Ausgang überein (inkl. Fehlschlag- und not-found-Pfad)", () => {
    // b bleibt vorab abgewählt (bereits importiert), c wird bewusst ausgeschlossen, a wird
    // übernommen — der Server meldet zusätzlich einen Fehlschlag und ein not-found.
    const selection = { a: true, b: false, c: false };
    const bilanz = aggregateBilanz(CANDIDATES, selection, [
      { imported: 1, failed: [{ id: "x", reason: "Error" }], notFound: ["weg"] },
    ]);
    expect(bilanz.imported).toBe(1);
    expect(bilanz.skippedAlreadyImported).toBe(1); // b
    expect(bilanz.excluded).toBe(1); // c
    expect(bilanz.failed).toEqual([
      { id: "x", reason: "Error" },
      { id: "weg", reason: "not-found" },
    ]);
  });

  it("die komplette Copy existiert in DE, EN und NL", () => {
    const i18n = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    for (const key of Object.values(IMPORT_GROUPS_TEXT)) {
      expect(`${key}:${i18n.split(`"${key}":`).length - 1}`).toBe(`${key}:3`);
    }
  });
});
