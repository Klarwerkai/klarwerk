// ================================================================================================
// PMO-FEA-0003 · DAS FREIWILLIGE FOTO GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `pmo-fea-0003-livewall-zustimmung.test.ts` misst Zustimmung, Sichtrechte und Widerruf an der
// Speicherfassung. Dass ein hinterlegtes Foto einen NEUSTART übersteht und ein Widerruf die
// Bilddaten in der Datenbank wirklich LÖSCHT, ist erst hier belegt: dieselbe Ablage
// (`PgLiveWallFotoRepo`), das ausgeführte `migrate()` mit `LIVEWALL_FOTO_SCHEMA`, ein neuer Pool je
// „Server".
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { PgLiveWallFotoRepo } from "../../services/app/src/livewall-fotos";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const FOTO_A = "data:image/png;base64,QUFB";
const FOTO_B = "data:image/jpeg;base64,QkJC";
const KONTO = "u-pg-livewall-foto";

describe("PMO-FEA-0003 · Live-Wand-Fotos gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const pools: Pool[] = [];

  /** Ein frischer Pool — so sieht ein Neustart des Servers aus. */
  function neueAblage(): PgLiveWallFotoRepo {
    const pool = createPool(url);
    pools.push(pool);
    return new PgLiveWallFotoRepo(pool);
  }

  beforeAll(async () => {
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      url = lokal;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      throw new Error(
        "KLARWERK_PG_TEST_URL abgelehnt (Grund auf stderr) — kein Container-Rückfall",
      );
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
      } catch (cause) {
        throw new Error("Weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar", {
          cause,
        });
      }
      url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    }
    const pool = createPool(url);
    try {
      // Zweimal: die Stufe ist wiederholbar und lässt den Bestand stehen.
      await migrate(pool);
      await migrate(pool);
      await new PgLiveWallFotoRepo(pool).entferne(KONTO);
    } finally {
      await pool.end();
    }
  }, 180_000);

  afterAll(async () => {
    for (const pool of pools) {
      await pool.end();
    }
    await container?.stop();
  });

  it("Foto übersteht den Neustart; Ersetzen überschreibt, Widerruf löscht", async () => {
    const erste = neueAblage();
    expect((await erste.lies([KONTO])).size).toBe(0);
    await erste.setze(KONTO, FOTO_A, "2026-10-08T08:00:00.000Z");

    // Neuer Pool = neuer Server: das Foto ist noch da.
    const zweite = neueAblage();
    expect((await zweite.lies([KONTO, "u-niemand"])).get(KONTO)).toBe(FOTO_A);
    expect((await zweite.lies([KONTO, "u-niemand"])).has("u-niemand")).toBe(false);

    await zweite.setze(KONTO, FOTO_B, "2026-10-08T09:00:00.000Z");
    expect((await neueAblage().lies([KONTO])).get(KONTO)).toBe(FOTO_B);

    // Widerruf: die ZEILE ist weg, nicht nur ausgeblendet.
    await zweite.entferne(KONTO);
    const pool = createPool(url);
    pools.push(pool);
    const rest = await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM livewall_fotos WHERE konto_id = $1",
      [KONTO],
    );
    expect(rest.rows[0]?.n).toBe(0);
    expect((await neueAblage().lies([KONTO])).size).toBe(0);
  });

  it("eine leere Anfrage fragt die Datenbank gar nicht erst", async () => {
    expect((await neueAblage().lies([])).size).toBe(0);
  });
});
