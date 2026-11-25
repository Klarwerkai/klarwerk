import { GenericContainer, Wait } from "testcontainers";
import { expect, it } from "vitest";
import { buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { poolAbschluss } from "../audit-gesamt/pool-abschluss";
import { pruefeArtikelBuchung } from "./wissensartikel-fixture";

it("rollt Artikel, Herkunft, Prüfnachweis und Suchprojektion bei einer gescheiterten Entscheidung gemeinsam zurück", async () => {
  const container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({ POSTGRES_PASSWORD: "workflow-synthetic", POSTGRES_DB: "wissen" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  const pool = createPool(
    `postgresql://postgres:workflow-synthetic@${container.getHost()}:${container.getMappedPort(5432)}/wissen`,
  );
  const schliessen = poolAbschluss(pool);
  try {
    await migrate(pool);
    const id = await pruefeArtikelBuchung(buildPgServices(pool));
    const rest = await pool.query(
      `SELECT 1 FROM ko_search_projections WHERE ko_id=$1
                                  UNION ALL SELECT 1 FROM ko_evidence WHERE ko_id=$1
                                  UNION ALL SELECT 1 FROM ko_versions WHERE ko_id=$1`,
      [id],
    );
    expect(rest.rows).toEqual([]);
  } finally {
    await schliessen();
    await container.stop();
  }
});
