import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "./db";
import {
  MAX_SOURCE_SYNC_IDS,
  PgQuellabgleichRepo,
  sourceSyncSnapshot,
} from "./quellabgleich-ablage";

// R-0162 (Confluence-Gesamtimport, Lauf 3) · die Quellabgleichsablage gegen echtes PostgreSQL.
// Lauf: `KLARWERK_SKIP_KEYCHAIN=1 npx vitest run --config vitest.integration.config.ts services/app/src/quellabgleich-ablage.integration.test.ts`
// Ausschließlich Wegwerf-Container: fehlendes Docker lässt den Aufbau scheitern, kein grüner Ersatz.
// Gemessen wird, was die In-Memory-Ablage nicht zeigen kann: die produktive Migration legt die
// Tabelle an (zweimal ohne Fehler), das Ergebnis überlebt eine NEUE Verbindung (Wiederanlauf), ein
// zweites Schreiben ersetzt, und ein Altbestand mit Fremdinhalt kommt nur als Kennungen zurück.
describe("R-0162 · Quellabgleich je Lauf unter echtem Postgres", () => {
  let container: StartedTestContainer | undefined;
  let url: string;
  let pool: Pool;

  beforeAll(async () => {
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
    } catch (cause) {
      throw new Error("Postgres-Aufbau: Containerstart fehlgeschlagen; keine Ablagemessung", {
        cause,
      });
    }
    url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    pool = createPool(url);
    await migrate(pool);
    // Wiederholbar: ein zweiter Migrationslauf ist folgenlos.
    await migrate(pool);
  });

  afterAll(async () => {
    try {
      await pool?.end();
    } finally {
      await container?.stop();
    }
  });

  it("überlebt eine neue Verbindung und ersetzt beim zweiten Schreiben", async () => {
    const repo = new PgQuellabgleichRepo(pool);
    expect(await repo.lies("lauf-1")).toBeUndefined();
    await repo.speichere(
      "lauf-1",
      sourceSyncSnapshot({
        checked: true,
        reason: null,
        removed: ["P-1"],
        restored: [],
        outsideScope: ["P-2"],
        unchecked: [],
        attachmentsUpdated: ["P-3"],
      }),
    );
    await repo.speichere(
      "lauf-1",
      sourceSyncSnapshot({
        checked: false,
        reason: "incomplete-read",
        removed: [],
        restored: ["P-4"],
        outsideScope: [],
        unchecked: ["P-5"],
        attachmentsUpdated: [],
        syncFailed: ["P-6"],
        attachmentsIncomplete: [],
        counts: { unchecked: 250 },
      }),
    );
    const zweiterProzess = createPool(url);
    try {
      expect(await new PgQuellabgleichRepo(zweiterProzess).lies("lauf-1")).toEqual({
        checked: false,
        reason: "incomplete-read",
        removed: [],
        restored: ["P-4"],
        outsideScope: [],
        unchecked: ["P-5"],
        attachmentsUpdated: [],
        restrictionsUpdated: [],
        syncFailed: ["P-6"],
        attachmentsIncomplete: [],
        counts: {
          removed: 0,
          restored: 1,
          outsideScope: 0,
          unchecked: 250,
          attachmentsUpdated: 0,
          restrictionsUpdated: 0,
          syncFailed: 1,
          attachmentsIncomplete: 0,
        },
        listsTruncated: true,
      });
    } finally {
      await zweiterProzess.end();
    }
    const zeilen = await pool.query("SELECT import_id FROM import_run_source_sync");
    expect(zeilen.rows).toEqual([{ import_id: "lauf-1" }]);
  });

  it("ein Altbestand mit Fremdinhalt kommt nur als gedeckelte Kennungen zurück", async () => {
    const viele = Array.from({ length: MAX_SOURCE_SYNC_IDS + 5 }, (_, i) => `P-${i}`);
    await pool.query(
      "INSERT INTO import_run_source_sync (import_id, data) VALUES ($1, $2::jsonb)",
      [
        "lauf-alt",
        JSON.stringify({
          checked: "ja",
          removed: [...viele, { titel: "Geheim" }],
          restored: "P-1",
          body: "<p>Seiteninhalt</p>",
        }),
      ],
    );
    const gelesen = await new PgQuellabgleichRepo(pool).lies("lauf-alt");
    expect(gelesen).toEqual({
      checked: false,
      reason: null,
      removed: viele.slice(0, MAX_SOURCE_SYNC_IDS),
      restored: [],
      outsideScope: [],
      unchecked: [],
      attachmentsUpdated: [],
      restrictionsUpdated: [],
      syncFailed: [],
      attachmentsIncomplete: [],
      counts: {
        removed: MAX_SOURCE_SYNC_IDS + 5,
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
  });
});
