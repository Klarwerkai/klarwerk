// ================================================================================================
// KLARA 01 (produkt:20261008:klara-basis) · DAS KLARA-GESPRÄCH GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `gespraech-am-server.test.ts` misst an der Speicherfassung. Dass ein Gespräch samt Verlauf,
// Objektbezug, letztem Schritt und Einwilligung einen NEUSTART übersteht (das ist „Neuladen und
// erneute Anmeldung" am Server), dass ein fremdes Konto es nicht liest und nicht löscht und dass zwei
// gleichzeitige Schreiber einander nicht überschreiben, ist erst hier belegt: dieselbe Ablage
// (`PgKlaraGespraechRepo`), das ausgeführte `migrate()` mit `KLARA_GESPRAECH_SCHEMA`, ein neuer Pool
// je „Server".
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { KlaraGespraechDienst, PgKlaraGespraechRepo } from "../../services/app/src/klara-gespraech";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const ANNA = "u-pg-klara-anna";
const BERT = "u-pg-klara-bert";
const BEZUG = { pfad: "/erfassen", seitenName: "Erfassung", objekt: "Entwurf „Ölwechsel“" };

describe("Klara 01 · Gespräche gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const pools: Pool[] = [];
  let uhr = Date.parse("2026-10-08T08:00:00.000Z");

  function neuePool(): Pool {
    const pool = createPool(url);
    pools.push(pool);
    return pool;
  }

  /** Ein frischer Dienst auf einem frischen Pool — so sieht ein Neustart des Servers aus. */
  function neuerDienst(): KlaraGespraechDienst {
    return new KlaraGespraechDienst({
      repo: new PgKlaraGespraechRepo(neuePool()),
      jetzt: () => {
        uhr += 1_000;
        return uhr;
      },
    });
  }

  async function zeilen(kontoId: string): Promise<number> {
    const res = await neuePool().query<{ n: number }>(
      "SELECT count(*)::int AS n FROM klara_gespraeche WHERE konto_id = $1",
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
      await pool.query("DELETE FROM klara_gespraeche WHERE konto_id = ANY($1)", [[ANNA, BERT]]);
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

  it("Verlauf, Objektbezug, letzter Schritt und Einwilligung überstehen den Neustart", async () => {
    const g = await neuerDienst().beginne(ANNA, BEZUG);
    await neuerDienst().setzeEinwilligung(ANNA, g.id, true);
    await neuerDienst().setzeSchritt(ANNA, g.id, {
      art: "frage",
      text: "Wie lange dauert der Ölwechsel?",
      objektbezug: BEZUG,
      stand: "laeuft",
    });
    await neuerDienst().fuegeHinzu(ANNA, g.id, {
      von: "du",
      modus: "frage",
      text: "Wie lange dauert der Ölwechsel?",
      objektbezug: BEZUG,
    });
    await neuerDienst().fuegeHinzu(ANNA, g.id, {
      von: "klara",
      modus: "abgebrochen",
      text: "Anfrage gestoppt.",
      objektbezug: { pfad: "/fragen", seitenName: "Fragen", objekt: "Noch keine Frage" },
    });

    const nachNeustart = await neuerDienst().aktuelles(ANNA);
    expect(nachNeustart?.id).toBe(g.id);
    expect(nachNeustart?.objektbezug).toEqual(BEZUG);
    expect(nachNeustart?.einwilligungAm).not.toBeNull();
    expect(nachNeustart?.letzterSchritt).toMatchObject({ stand: "laeuft", objektbezug: BEZUG });
    expect(nachNeustart?.nachrichten.map((n) => [n.von, n.modus, n.objektbezug.pfad])).toEqual([
      ["du", "frage", "/erfassen"],
      ["klara", "abgebrochen", "/fragen"],
    ]);
    expect(nachNeustart?.fassung).toBe(5);
    expect(await zeilen(ANNA)).toBe(1);
  });

  it("ein fremdes Konto liest, ändert und löscht nichts — die Zeile bleibt", async () => {
    const g = await neuerDienst().beginne(BERT, BEZUG);
    expect(await neuerDienst().aktuelles(ANNA)).not.toBeNull();
    await expect(neuerDienst().hole(ANNA, g.id)).rejects.toMatchObject({ status: 404 });
    await expect(neuerDienst().setzeEinwilligung(ANNA, g.id, true)).rejects.toMatchObject({
      status: 404,
    });
    expect(await neuerDienst().loesche(ANNA, g.id)).toBe(false);
    expect(await zeilen(BERT)).toBe(1);
    expect((await neuerDienst().hole(BERT, g.id)).einwilligungAm).toBeNull();
  });

  it("zwei gleichzeitige Schreiber auf zwei Pools überschreiben einander nicht", async () => {
    const g = await neuerDienst().beginne(BERT, BEZUG);
    await neuerDienst().setzeEinwilligung(BERT, g.id, true);
    await Promise.all(
      ["Tab A", "Tab B", "Tab C"].map((tab) =>
        neuerDienst().fuegeHinzu(BERT, g.id, {
          von: "du",
          modus: "frage",
          text: `Frage aus ${tab}`,
          objektbezug: BEZUG,
        }),
      ),
    );
    const nachher = await neuerDienst().hole(BERT, g.id);
    expect(nachher.nachrichten.map((n) => n.text).sort()).toEqual([
      "Frage aus Tab A",
      "Frage aus Tab B",
      "Frage aus Tab C",
    ]);
  });

  it("Löschen entfernt die Zeile in der Datenbank — nur die eigene", async () => {
    const vorher = await zeilen(BERT);
    const g = await neuerDienst().beginne(BERT, BEZUG);
    expect(await zeilen(BERT)).toBe(vorher + 1);
    expect(await neuerDienst().loesche(BERT, g.id)).toBe(true);
    expect(await zeilen(BERT)).toBe(vorher);
    expect(await zeilen(ANNA)).toBe(1);
  });
});
