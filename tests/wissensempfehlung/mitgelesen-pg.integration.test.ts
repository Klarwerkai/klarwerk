// ================================================================================================
// R-1656 · DER CO-READING-ZÄHLER GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `bilden-und-lesespur.test.ts` und `empfehlung-am-server.test.ts` messen an der Speicherfassung.
// Dass die Paarzahl einen NEUSTART übersteht, ungeordnet zählt, die Schwelle in SQL gilt und die
// Tabelle keine Kontokennung trägt, ist erst hier belegt: dieselbe Ablage (`PgMitgelesenRepo`), das
// ausgeführte `migrate()` mit `MITGELESEN_SCHEMA`, ein neuer Pool je „Server".
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { PgMitgelesenRepo } from "../../services/app/src/wissensempfehlung";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

// Eigene Kennungen je Lauf: die Tabelle kennt bewusst keinen Löschweg je Konto (es gibt kein Konto).
const LAUF = randomUUID();
const A = `pg-mitgelesen-${LAUF}-a`;
const B = `pg-mitgelesen-${LAUF}-b`;
const C = `pg-mitgelesen-${LAUF}-c`;

describe("R-1656 · Co-Reading-Zähler gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const pools: Pool[] = [];

  /** Ein frischer Pool — so sieht ein Neustart des Servers aus. */
  function neuePool(): Pool {
    const pool = createPool(url);
    pools.push(pool);
    return pool;
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

  it("das Paar zählt ungeordnet und übersteht den Neustart; die Schwelle gilt in SQL", async () => {
    await new PgMitgelesenRepo(neuePool()).zaehle(A, B);
    await new PgMitgelesenRepo(neuePool()).zaehle(B, A);
    await new PgMitgelesenRepo(neuePool()).zaehle(A, C);
    expect(await new PgMitgelesenRepo(neuePool()).partner(A, 3, 10)).toEqual([]);
    await new PgMitgelesenRepo(neuePool()).zaehle(B, A);

    const nachNeustart = new PgMitgelesenRepo(neuePool());
    expect(await nachNeustart.partner(A, 3, 10)).toEqual([{ koId: B, anzahl: 3 }]);
    expect(await nachNeustart.partner(B, 3, 10)).toEqual([{ koId: A, anzahl: 3 }]);
    expect(await nachNeustart.partner(A, 1, 10)).toEqual([
      { koId: B, anzahl: 3 },
      { koId: C, anzahl: 1 },
    ]);
    expect(await nachNeustart.partner(A, 1, 1)).toEqual([{ koId: B, anzahl: 3 }]);
  });

  it("die angelegte Tabelle trägt Paar und Zahl — keine Kontokennung, keinen Zeitpunkt", async () => {
    const res = await neuePool().query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ko_mitgelesen'
        ORDER BY ordinal_position`,
    );
    expect(res.rows.map((z) => z.column_name)).toEqual(["ko_a", "ko_b", "anzahl"]);
  });
});
