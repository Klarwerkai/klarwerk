// ================================================================================================
// produkt:20261010:assistenz-name-avatar · DAS ASSISTENZPROFIL GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `profil-am-server.test.ts` misst an der Speicherfassung. Dass Name, Avatar-Kennung, Bewegung und
// der Abschluss der Ersteinrichtung einen NEUSTART überstehen (am Server ist das „Neuladen, erneute
// Anmeldung, zweites Gerät"), dass zwei Konten getrennte Zeilen haben und dass zwei gleichzeitige
// Schreiber einander nicht still überschreiben, ist erst hier belegt: dieselbe Ablage
// (`PgAssistenzProfilRepo`), das ausgeführte `migrate()` mit `ASSISTENZ_PROFIL_SCHEMA`, ein neuer
// Pool je „Server".
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AssistenzProfilDienst,
  AssistenzProfilFehler,
  PgAssistenzProfilRepo,
} from "../../services/app/src/assistenz-profil";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const ANNA = "u-pg-assistenz-anna";
const BERT = "u-pg-assistenz-bert";

describe("Assistenzprofil gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const pools: Pool[] = [];
  let uhr = Date.parse("2026-10-10T08:00:00.000Z");

  function neuePool(): Pool {
    const pool = createPool(url);
    pools.push(pool);
    return pool;
  }

  /** Ein frischer Dienst auf einem frischen Pool — so sieht ein Neustart des Servers aus. */
  function neuerDienst(): AssistenzProfilDienst {
    return new AssistenzProfilDienst({
      repo: new PgAssistenzProfilRepo(neuePool()),
      jetzt: () => {
        uhr += 1_000;
        return uhr;
      },
    });
  }

  async function zeilen(kontoId: string): Promise<number> {
    const res = await neuePool().query<{ n: number }>(
      "SELECT count(*)::int AS n FROM assistenz_profile WHERE konto_id = $1",
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
      await pool.query("DELETE FROM assistenz_profile WHERE konto_id = ANY($1)", [[ANNA, BERT]]);
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

  it("Ersteinrichtung, Name, Avatar und Bewegung überstehen den Neustart", async () => {
    expect(await neuerDienst().hole(ANNA)).toBeNull();
    const p = await neuerDienst().aendere(ANNA, {
      name: "Mia",
      avatar: "eule",
      bewegung: "reduziert",
      einrichtungAbschliessen: true,
      fassung: 0,
    });
    expect(p.eingerichtetAm).not.toBeNull();
    const gelesen = await neuerDienst().hole(ANNA);
    expect(gelesen).toMatchObject({
      kontoId: ANNA,
      name: "Mia",
      avatar: "eule",
      bewegung: "reduziert",
      eingerichtetAm: p.eingerichtetAm,
      fassung: 1,
    });
    expect(await zeilen(ANNA)).toBe(1);
  });

  it("ein zweites Konto hat seine eigene Zeile — Änderungen berühren das erste nicht", async () => {
    await neuerDienst().aendere(BERT, {
      name: "Nordlicht",
      avatar: "prisma",
      einrichtungAbschliessen: true,
      fassung: 0,
    });
    await neuerDienst().aendere(BERT, { name: "Polarlicht", fassung: 1 });
    expect(await neuerDienst().hole(BERT)).toMatchObject({ name: "Polarlicht", avatar: "prisma" });
    expect(await neuerDienst().hole(ANNA)).toMatchObject({ name: "Mia", avatar: "eule" });
    expect(await zeilen(BERT)).toBe(1);
  });

  it("zwei Geräte mit derselben Fassung: der zweite Schreiber wird abgewiesen, nichts geht verloren", async () => {
    const stand = await neuerDienst().hole(ANNA);
    const fassung = stand?.fassung ?? 0;
    const geraetA = neuerDienst();
    const geraetB = neuerDienst();
    await geraetA.aendere(ANNA, { avatar: "fuchs", fassung });
    await expect(geraetB.aendere(ANNA, { name: "Kai", fassung })).rejects.toBeInstanceOf(
      AssistenzProfilFehler,
    );
    expect(await neuerDienst().hole(ANNA)).toMatchObject({ name: "Mia", avatar: "fuchs" });
  });

  it("eine zweite Ersteinrichtung über ein vorhandenes Profil wird nicht still geschrieben", async () => {
    await expect(
      neuerDienst().aendere(ANNA, {
        name: "Überschrieben",
        avatar: "wolke",
        einrichtungAbschliessen: true,
        fassung: 0,
      }),
    ).rejects.toBeInstanceOf(AssistenzProfilFehler);
    expect((await neuerDienst().hole(ANNA))?.name).toBe("Mia");
  });
});
