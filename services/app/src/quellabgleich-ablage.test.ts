import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  IMPORT_RUN_SOURCE_SYNC_SCHEMA,
  InMemoryQuellabgleichRepo,
  MAX_SOURCE_SYNC_IDS,
  sourceSyncSnapshot,
} from "./quellabgleich-ablage";

// R-0162 (Confluence-Gesamtimport, Lauf 3): die Ablage, die das Abgleichsergebnis eines Laufs
// neben der eingefrorenen Laufablage hält. Die PostgreSQL-Seite misst
// `quellabgleich-ablage.integration.test.ts` (Wegwerf-Container, Serverweg).
describe("R-0162 · Quellabgleichsablage", () => {
  it("hält je Lauf genau ein Ergebnis; ein zweites Schreiben ersetzt", async () => {
    const repo = new InMemoryQuellabgleichRepo();
    expect(await repo.lies("L-1")).toBeUndefined();
    await repo.speichere("L-1", sourceSyncSnapshot({ checked: true, removed: ["P-1"] }));
    await repo.speichere("L-1", sourceSyncSnapshot({ checked: true, removed: ["P-2"] }));
    expect((await repo.lies("L-1"))?.removed).toEqual(["P-2"]);
    expect(await repo.lies("L-2")).toBeUndefined();
  });

  it("gibt keine Referenz heraus, über die ein Leser die Ablage verändert", async () => {
    const repo = new InMemoryQuellabgleichRepo();
    await repo.speichere("L-1", sourceSyncSnapshot({ checked: true, removed: ["P-1"] }));
    const gelesen = await repo.lies("L-1");
    (gelesen?.removed as string[]).push("P-X");
    expect((await repo.lies("L-1"))?.removed).toEqual(["P-1"]);
  });

  it("baut Feld für Feld: nur Kennungen, gedeckelt, kein mitgereister Inhalt", () => {
    const viele = Array.from({ length: MAX_SOURCE_SYNC_IDS + 1 }, (_, i) => `P-${i}`);
    const roh = {
      checked: "true",
      reason: "x".repeat(100),
      removed: [...viele, 7, "", "y".repeat(513)],
      restored: null,
      titel: "Geheimer Seitentitel",
    };
    const sauber = sourceSyncSnapshot(roh);
    expect(sauber).toEqual({
      checked: false,
      reason: "x".repeat(64),
      removed: viele.slice(0, MAX_SOURCE_SYNC_IDS),
      restored: [],
      outsideScope: [],
      unchecked: [],
      attachmentsUpdated: [],
      restrictionsUpdated: [],
      syncFailed: [],
      attachmentsIncomplete: [],
      // Lauf 3 R2 (Bens B6): die Zahl zählt die gültigen Kennungen VOR dem Deckel.
      counts: {
        removed: MAX_SOURCE_SYNC_IDS + 1,
        restored: 0,
        outsideScope: 0,
        unchecked: 0,
        attachmentsUpdated: 0,
        restrictionsUpdated: 0,
        syncFailed: 0,
        attachmentsIncomplete: 0,
      },
      listsTruncated: true,
    });
    expect(JSON.stringify(sauber)).not.toContain("Geheim");
  });

  it("die Tabelle ist rein additiv und steht in Migration, Migrationsbeleg und Backup-Drill", () => {
    expect(IMPORT_RUN_SOURCE_SYNC_SCHEMA).toMatch(
      /CREATE TABLE IF NOT EXISTS import_run_source_sync/,
    );
    expect(IMPORT_RUN_SOURCE_SYNC_SCHEMA).not.toMatch(/DROP|DELETE|UPDATE|TRUNCATE|REFERENCES/i);
    expect(readFileSync("services/app/src/db.ts", "utf8")).toContain(
      "  IMPORT_RUN_SOURCE_SYNC_SCHEMA,\n];",
    );
    expect(readFileSync("services/app/src/migrationsbeleg.ts", "utf8")).toContain(
      '{ stufe: "IMPORT_RUN_SOURCE_SYNC_SCHEMA", risiko: "ADDITIV" }',
    );
    expect(readFileSync("scripts/backup/restore-drill.sh", "utf8")).toMatch(
      /\n {2}import_run_source_sync\n/,
    );
  });
});
