// ================================================================================================
// produkt:20261013:produktbudget-anwender-admin · DIE PRODUKTBUDGETS GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `produktbudget.test.ts` misst an der Speicherfassung. Dass Einstellung, Buchungen und Provenienz
// einen NEUSTART überstehen und dass zwei PROZESSE (zwei Pools, zwei Dienste) den Deckel nicht
// gemeinsam überschreiten, ist erst hier belegt: dieselbe Ablage (`PgProduktbudgetRepo`), das
// ausgeführte `migrate()` mit `PRODUKTBUDGET_SCHEMA`, ein neuer Pool je „Server". Fiktive Daten, je
// Lauf ein eigener Mandantenschlüssel.
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { PgProduktbudgetRepo, Produktbudget } from "../../services/app/src/produktbudget";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const ADMIN = "konto-pg-admin-fiktiv";

describe("Produktbudgets gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const pools: Pool[] = [];

  function neuePool(): Pool {
    const pool = createPool(url);
    pools.push(pool);
    return pool;
  }

  /** Ein frischer Dienst auf einem frischen Pool — so sieht ein Neustart oder zweiter Prozess aus. */
  function server(mandant: string): Produktbudget {
    return new Produktbudget({ repo: new PgProduktbudgetRepo(neuePool()), mandant });
  }

  function mandant(): string {
    return `pg-test-produktbudget-${randomUUID()}`;
  }

  async function bereich(d: Produktbudget, id: string) {
    const b = (await d.lies()).bereiche.find((x) => x.bereich === id);
    if (!b) {
      throw new Error(`Bereich ${id} fehlt`);
    }
    return b;
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
      const t = await pool.query("SELECT to_regclass('produktbudget') AS r");
      expect(t.rows[0]?.r).not.toBeNull();
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

  it("P1 · ohne Zeile gelten die Originalvorgaben; gelesen wird nichts geschrieben", async () => {
    const m = mandant();
    const d = server(m);
    expect((await bereich(d, "perplexity-poc")).betragCent).toBe(2000);
    expect((await bereich(d, "nr32-claude")).zeitraum).toBe("offen");
    const n = await neuePool().query<{ n: number }>(
      "SELECT count(*)::int AS n FROM produktbudget WHERE mandant = $1",
      [m],
    );
    expect(n.rows[0]?.n).toBe(0);
  });

  it("P2 · Einstellung, Buchung und Provenienz überstehen den Neustart", async () => {
    const m = mandant();
    await server(m).aendere(ADMIN, "perplexity-poc", {
      betrag: "19,99",
      waehrung: "EUR",
      zeitraum: "einmalig",
      fassung: 0,
      aenderungId: "pg-aenderung-0001",
      grund: "fiktiver Grund",
    });
    await server(m).kostenbuch().verbuche("perplexity-poc", 450, "pg-auftrag-1");
    const nach = await bereich(server(m), "perplexity-poc");
    expect(nach).toMatchObject({
      betragCent: 1999,
      fassung: 1,
      geaendertVon: ADMIN,
      verbrauchtCent: 450,
      verbleibendCent: 1549,
      buchungen: 1,
    });
    expect(nach.letzteAenderungen.map((a) => [a.aenderungId, a.grund])).toEqual([
      ["pg-aenderung-0001", "fiktiver Grund"],
    ]);
  });

  it("P3 · zwei Prozesse reservieren parallel: der Deckel hält (vier von zehn à 5 EUR)", async () => {
    const m = mandant();
    const a = server(m);
    const b = server(m);
    const ergebnisse = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        (i % 2 === 0 ? a : b).reserviere({
          zuordnung: "perplexity-poc",
          cent: 500,
          auftragId: `pg-parallel-${i}`,
          anbieter: "perplexity",
          waehrung: "EUR",
        }),
      ),
    );
    expect(ergebnisse.filter(Boolean)).toHaveLength(4);
    const p = await bereich(server(m), "perplexity-poc");
    expect(p).toMatchObject({ reserviertCent: 2000, verbleibendCent: 0, buchungen: 4 });
  });

  it("P4 · zwei Prozesse ändern dieselbe Fassung: genau einer gewinnt, der andere sieht 409", async () => {
    const m = mandant();
    const ergebnisse = await Promise.allSettled(
      ["16", "17"].map((betrag, i) =>
        server(m).aendere(`konto-${i}`, "perplexity-poc", {
          betrag,
          waehrung: "EUR",
          zeitraum: "einmalig",
          fassung: 0,
          aenderungId: `pg-konkurrenz-${i}-0001`,
        }),
      ),
    );
    expect(ergebnisse.filter((e) => e.status === "fulfilled")).toHaveLength(1);
    const abgelehnt = ergebnisse.find((e) => e.status === "rejected");
    expect((abgelehnt as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    const p = await bereich(server(m), "perplexity-poc");
    expect(p.fassung).toBe(1);
    expect(p.letzteAenderungen).toHaveLength(1);
  });

  it("P5 · dieselbe Änderung nach Neustart erneut gesendet: kein zweiter Eintrag", async () => {
    const m = mandant();
    const eingabe = {
      betrag: "21",
      waehrung: "EUR",
      zeitraum: "einmalig",
      fassung: 0,
      aenderungId: "pg-wiederholung-0001",
    };
    expect((await server(m).aendere(ADMIN, "perplexity-poc", eingabe)).geaendert).toBe(true);
    expect((await server(m).aendere(ADMIN, "perplexity-poc", eingabe)).wiederholt).toBe(true);
    expect((await bereich(server(m), "perplexity-poc")).letzteAenderungen).toHaveLength(1);
  });

  it("P6 · nach einer Buchung bleibt die Währung gebunden", async () => {
    const m = mandant();
    await server(m).kostenbuch().verbuche("perplexity-poc", 100, "pg-auftrag-w");
    await expect(
      server(m).aendere(ADMIN, "perplexity-poc", {
        betrag: "20",
        waehrung: "USD",
        zeitraum: "einmalig",
        fassung: 0,
        aenderungId: "pg-waehrung-0001",
      }),
    ).rejects.toMatchObject({ status: 409, grund: "waehrung_gebunden" });
    expect((await bereich(server(m), "perplexity-poc")).waehrung).toBe("EUR");
  });
});
