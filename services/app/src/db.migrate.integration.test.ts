import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "./db";

// SCRUM-496 (die Lehre): migrate() brach auf der Beta beim Boot mit "42601 syntax error at or near
// overlaps" ab — OVERLAPS ist ein reserviertes Postgres-Keyword, das unquotierte CREATE TABLE war
// ungültig. Der statische Migrate-Test prüft nur REFERENZEN, nicht die SQL-Gültigkeit. Dieser Test
// fährt das GESAMTE migrate()-DDL einmal gegen ein echtes Postgres — ein Syntaxfehler in irgendeinem
// Modul-Schema fällt damit im CI-Gate auf, nicht erst im Prod-Deploy. Braucht Docker (Testcontainers);
// läuft unter `npm run test:integration` (CI-Job "integration"), nicht im schnellen Root-Gate.
describe("SCRUM-496: migrate() ist gültiges SQL gegen echtes Postgres", () => {
  let container: StartedTestContainer;

  beforeAll(async () => {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
      .start();
  });

  afterAll(async () => {
    await container?.stop();
  });

  it("migrate() legt alle Modul-Tabellen ohne Syntaxfehler an (idempotent)", async () => {
    const url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk`;
    const pool = createPool(url);
    try {
      // Der eigentliche Test: würde ein Modul-DDL ungültige Syntax tragen (z. B. ein reservierter
      // Tabellenname), wirft dieser Aufruf — genau der Boot-Abbruch, den die Beta zeigte.
      await expect(migrate(pool)).resolves.toBeUndefined();
      // Zweiter Lauf beweist die Idempotenz (CREATE TABLE IF NOT EXISTS).
      await expect(migrate(pool)).resolves.toBeUndefined();

      // Die zuvor kaputte Tabelle existiert jetzt unter unkritischem Namen und ist abfragbar.
      const overlaps = await pool.query("SELECT id, data FROM ko_overlaps");
      expect(overlaps.rowCount).toBe(0);
      const settings = await pool.query("SELECT key, min_confidence FROM overlap_settings");
      expect(settings.rowCount).toBe(0);
    } finally {
      await pool.end();
    }
  });
});
