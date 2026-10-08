// ================================================================================================
// R-0466 · DAS INTERAKTIONSGEDÄCHTNIS GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `gedaechtnis-dienst.test.ts` und `gedaechtnis-am-server.test.ts` messen an der Speicherfassung.
// Dass ein Eintrag samt Herkunft, Frist und Vertraulichkeit einen NEUSTART übersteht und dass
// Löschen und Fristablauf die Zeile in der Datenbank wirklich ENTFERNEN, ist erst hier belegt:
// dieselbe Ablage (`PgGedaechtnisRepo`), das ausgeführte `migrate()` mit `GEDAECHTNIS_SCHEMA`, ein
// neuer Pool je „Server".
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import {
  type Gedaechtniseintrag,
  PgGedaechtnisRepo,
} from "../../services/app/src/interaktionsgedaechtnis";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const ANNA = "u-pg-gedaechtnis-anna";
const BERT = "u-pg-gedaechtnis-bert";

function eintrag(id: string, kontoId: string, angelegtAm: string, verfallAm: string) {
  return {
    id,
    kontoId,
    art: "frage_antwort",
    inhalt: `Frage ${id}`,
    antwort: `Antwort ${id}`,
    herkunft: { art: "antwort", antwortId: `ans-${id}`, antwortAm: "2026-10-07T09:30:00.000Z" },
    vertraulichkeit: "streng_vertraulich",
    aufbewahrungTage: 30,
    angelegtAm,
    verfallAm,
  } satisfies Gedaechtniseintrag;
}

describe("R-0466 · Interaktionsgedächtnis gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const pools: Pool[] = [];

  /** Ein frischer Pool — so sieht ein Neustart des Servers aus. */
  function neuePool(): Pool {
    const pool = createPool(url);
    pools.push(pool);
    return pool;
  }

  function neueAblage(): PgGedaechtnisRepo {
    return new PgGedaechtnisRepo(neuePool());
  }

  async function zeilen(kontoId: string): Promise<number> {
    const res = await neuePool().query<{ n: number }>(
      "SELECT count(*)::int AS n FROM interaktions_gedaechtnis WHERE konto_id = $1",
      [kontoId],
    );
    return res.rows[0]?.n ?? -1;
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
      const ablage = new PgGedaechtnisRepo(pool);
      await ablage.entferneAlle(ANNA);
      await ablage.entferneAlle(BERT);
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

  it("ein Eintrag übersteht den Neustart mit Herkunft, Frist und Vertraulichkeit", async () => {
    const e = eintrag("pg-1", ANNA, "2026-10-08T08:00:00.000Z", "2026-11-07T08:00:00.000Z");
    await neueAblage().lege(e);

    const nachNeustart = await neueAblage().eigene(ANNA, "2026-10-08T09:00:00.000Z");
    expect(nachNeustart).toEqual([e]);
    expect(await neueAblage().anzahl(ANNA, "2026-10-08T09:00:00.000Z")).toBe(1);
    // Ein anderes Konto sieht ihn nicht.
    expect(await neueAblage().eigene(BERT, "2026-10-08T09:00:00.000Z")).toEqual([]);
  });

  it("Löschen entfernt die Zeile — nur die eigene, und ein fremdes Löschen ist folgenlos", async () => {
    const ablage = neueAblage();
    const verfall = "2026-11-07T08:00:00.000Z";
    await ablage.lege(eintrag("pg-2", BERT, "2026-10-08T08:00:00.000Z", verfall));
    await ablage.lege(eintrag("pg-3", BERT, "2026-10-08T08:05:00.000Z", verfall));

    expect(await neueAblage().entferne(ANNA, "pg-2")).toBe(false);
    expect(await zeilen(BERT)).toBe(2);

    expect(await neueAblage().entferne(BERT, "pg-2")).toBe(true);
    expect(await zeilen(BERT)).toBe(1);

    expect(await neueAblage().entferneAlle(BERT)).toBe(1);
    expect(await zeilen(BERT)).toBe(0);
    // Annas Eintrag aus dem ersten Fall steht noch.
    expect(await zeilen(ANNA)).toBe(1);
  });

  it("der Fristablauf blendet aus und der Aufräumlauf LÖSCHT die Zeile in der Datenbank", async () => {
    const ablage = neueAblage();
    const frist = "2026-10-09T08:00:00.000Z";
    await ablage.lege(eintrag("pg-4", ANNA, "2026-10-08T08:10:00.000Z", frist));
    expect((await ablage.eigene(ANNA, "2026-10-09T07:59:59.000Z")).map((x) => x.id)).toEqual([
      "pg-4",
      "pg-1",
    ]);
    // Genau auf der Frist: nicht mehr geliefert, aber bis zum Aufräumlauf noch gespeichert.
    expect((await ablage.eigene(ANNA, "2026-10-09T08:00:00.000Z")).map((x) => x.id)).toEqual([
      "pg-1",
    ]);
    expect(await zeilen(ANNA)).toBe(2);

    expect(await neueAblage().entferneAbgelaufene("2026-10-09T08:00:00.000Z")).toBe(1);
    expect(await zeilen(ANNA)).toBe(1);
    expect(await neueAblage().entferneAbgelaufene("2026-10-09T08:00:00.000Z")).toBe(0);
  });
});
