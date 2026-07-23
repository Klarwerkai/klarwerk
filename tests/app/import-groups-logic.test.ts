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
    const bilanz = aggregateBilanz(CANDIDATES, selection, {
      results: [
        {
          imported: 1,
          updates: 0,
          alreadyQueued: 0,
          failed: [{ id: "x", reason: "Error" }],
          notFound: ["weg"],
        },
      ],
      attempted: ["a", "x", "weg"],
      transportFailed: [],
    });
    expect(bilanz.imported).toBe(1);
    expect(bilanz.updates).toBe(0);
    expect(bilanz.alreadyQueued).toBe(0);
    expect(bilanz.skippedAlreadyImported).toBe(1); // b
    expect(bilanz.excluded).toBe(1); // c
    expect(bilanz.failed).toEqual([
      { id: "x", reason: "Error" },
      { id: "weg", reason: "not-found" },
    ]);
    expect(bilanz.notAttempted).toEqual([]);
  });

  it("WP-SHIP7-FIX (Fix 3): BILANZ-INVARIANTE — Kandidaten == importiert + eingereiht + übersprungen + ausgeschlossen + fehlgeschlagen + nicht versucht", () => {
    const candidates: GroupedCandidate[] = [
      { id: "a", title: "A", alreadyImported: false, hints: [] },
      { id: "b", title: "B", alreadyImported: true, hints: ["already-imported"] }, // übersprungen
      { id: "c", title: "C", alreadyImported: false, hints: [] }, // ausgeschlossen
      { id: "d", title: "D", alreadyImported: false, hints: [] }, // Server-No-op (schon eingereiht)
      { id: "e", title: "E", alreadyImported: false, hints: [] }, // Batch scheitert (HTTP)
      { id: "f", title: "F", alreadyImported: false, hints: [] }, // nie versucht
      // WP-SHIP9-S1b: offener Kandidat, vorab abgewählt → eigener Bilanz-Posten (vorgemerkt).
      { id: "g", title: "G", alreadyImported: false, alreadyQueued: true, hints: [] },
    ];
    const selection = { a: true, b: false, c: false, d: true, e: true, f: true, g: false };
    // Lauf: Batch 1 [a,d] erfolgreich (a importiert, d bereits eingereiht); Batch 2 [e] scheitert
    // am HTTP-Aufruf → Abbruch; f wird nie versucht.
    const bilanz = aggregateBilanz(candidates, selection, {
      results: [{ imported: 1, updates: 1, alreadyQueued: 1, failed: [], notFound: [] }],
      attempted: ["a", "d", "e"],
      transportFailed: ["e"],
    });
    expect(bilanz.imported).toBe(1);
    // WP-IC-6b: Aktualisierungen sind eine informative TEILMENGE von imported — sie zählen in
    // der Invariante NICHT zusätzlich.
    expect(bilanz.updates).toBe(1);
    expect(bilanz.alreadyQueued).toBe(1);
    expect(bilanz.skippedAlreadyImported).toBe(1);
    // WP-SHIP9-S1b: der vorab abgewählte VORGEMERKTE Kandidat zählt getrennt — weder als
    // „übersprungen (importiert)" noch als bewusst ausgeschlossen.
    expect(bilanz.skippedAlreadyQueued).toBe(1);
    expect(bilanz.excluded).toBe(1);
    expect(bilanz.failed).toEqual([{ id: "e", reason: "http-error" }]);
    expect(bilanz.notAttempted).toEqual(["f"]);
    // Die INVARIANTE: alle Kandidaten der Gruppierung sind exakt einmal verbucht.
    const total =
      bilanz.imported +
      bilanz.alreadyQueued +
      bilanz.skippedAlreadyImported +
      bilanz.skippedAlreadyQueued +
      bilanz.excluded +
      bilanz.failed.length +
      bilanz.notAttempted.length;
    expect(total).toBe(candidates.length);
  });

  // WP-SHIP9-S1b (bens GELB): Vorgemerktes startet ABGEWÄHLT (Queue-Schutz wie bisher, ehrlich
  // benannt); eine neuere Quell-Version macht auch den vorgemerkten Kandidaten wieder wählbar
  // (Aktualisierung — gleiches Muster wie bei Importiertem, WP-IC-6b).
  it("S1b: Auswahl-Vorgabe — Vorgemerktes abgewählt, vorgemerkte Aktualisierung wählbar", () => {
    const candidates: GroupedCandidate[] = [
      { id: "neu", title: "Neu", alreadyImported: false, hints: [] },
      { id: "queued", title: "Vorgemerkt", alreadyImported: false, alreadyQueued: true, hints: [] },
      {
        id: "queuedUpdate",
        title: "Vorgemerkt, Quelle neuer",
        alreadyImported: false,
        alreadyQueued: true,
        sourceNewer: true,
        hints: [],
      },
    ];
    expect(initialSelection(candidates)).toEqual({
      neu: true,
      queued: false,
      queuedUpdate: true,
    });
  });

  it("WP-IC-6b: Auswahl-Vorgabe — Quelle-neuer-Kandidaten sind WÄHLBAR (nicht vorab abgewählt)", () => {
    const candidates: GroupedCandidate[] = [
      { id: "neu", title: "Neu", alreadyImported: false, hints: [] },
      { id: "dublette", title: "Unverändert", alreadyImported: true, hints: ["already-imported"] },
      {
        id: "update",
        title: "Aktualisiert",
        alreadyImported: true,
        sourceNewer: true,
        hints: ["already-imported"],
      },
    ];
    // Unveränderte Dublette bleibt vorab ABGEWÄHLT; die Aktualisierung startet AUSGEWÄHLT.
    expect(initialSelection(candidates)).toEqual({ neu: true, dublette: false, update: true });
  });

  it("die komplette Copy existiert in DE, EN und NL", () => {
    const i18n = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    for (const key of Object.values(IMPORT_GROUPS_TEXT)) {
      expect(`${key}:${i18n.split(`"${key}":`).length - 1}`).toBe(`${key}:3`);
    }
  });
});
