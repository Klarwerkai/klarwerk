// ================================================================================================
// produkt:20261013:lagebild-reale-werte-eingabe — DER ECHTE SPEICHERWEG (PostgreSQL, LWE-03/06).
// ================================================================================================
//
// `lagebild-werte-api.test.ts` misst Rechte und Draht an der Speicherablage. Dass die Werte
// TATSÄCHLICH gespeichert sind, ist erst belegt, wenn sie eine echte Datenbank, einen neuen Pool und
// einen neuen Dienst überleben — und dass das bedingte Schreiben auch in SQL nur einmal gewinnt.
// Gemessen am ausgeführten `migrate()` (MANAGEMENT_PROFILE_SCHEMA samt `management_lagebild_werte`),
// an `PgManagementProfileRepo` und am echten `ManagementService`.
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import type { KoService } from "../../services/knowledge-object";
import {
  LagebildKonflikt,
  type LagebildWerte,
  ManagementService,
  PgManagementProfileRepo,
} from "../../services/management";

const BEREICH = "pg-probe-lagebild";

function dienst(pool: Pool): ManagementService {
  return new ManagementService({
    koService: { list: async () => [] } as unknown as KoService,
    listGaps: async () => [],
    countOpenConflicts: async () => 0,
    pendingRevalidation: async () => [],
    busFactor: async () => [],
    profiles: new PgManagementProfileRepo(pool),
  });
}

const EINGABE = {
  zeitraumVon: "2025-07-01",
  zeitraumBis: "2025-09-30",
  werte: {
    hourlyRate: { wert: 72.5, herkunft: "eigene_eingabe" },
    hoursSavedPerValidatedKo: {
      wert: -0.5,
      herkunft: "gemessen",
      beleg: "Zeiterfassung (erfunden)",
    },
    reuseFactor: null,
  },
  basisVersion: 0,
  anfrageId: "pg-anfrage-0001",
};

describe("Lagebild-Werte gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const pools: Pool[] = [];

  function neuerPool(): Pool {
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
      await pool.query("DELETE FROM management_lagebild_werte WHERE bereich LIKE 'pg-probe-%'");
    } finally {
      await pool.end();
    }
  }, 180_000);

  afterAll(async () => {
    for (const pool of pools.splice(0)) {
      await pool.end();
    }
    await container?.stop();
  });

  it("gespeichert, neuer Pool und neuer Dienst — derselbe Stand kommt zurück", async () => {
    const erst = await dienst(neuerPool()).setLagebildWerte(BEREICH, EINGABE, "u-lea");
    expect(erst.wiederholt).toBe(false);

    const neu = dienst(neuerPool());
    const [sicht] = await neu.lagebildUebersicht({
      sichtbar: () => true,
      bereiche: [{ bereich: BEREICH, name: "Probe", darfSchreiben: true }],
      betrachter: "u-lea",
    });
    expect(sicht?.vonMir).toBe(true);
    expect(sicht?.werte).toMatchObject({
      bereich: BEREICH,
      version: 1,
      zeitraumVon: "2025-07-01",
      zeitraumBis: "2025-09-30",
      werte: {
        hourlyRate: { wert: 72.5, herkunft: "eigene_eingabe", beleg: null },
        hoursSavedPerValidatedKo: {
          wert: -0.5,
          herkunft: "gemessen",
          beleg: "Zeiterfassung (erfunden)",
        },
        reuseFactor: null,
      },
      anfrageId: "pg-anfrage-0001",
      geaendertVon: "u-lea",
    });
    // Ein Bereich, der nicht übergeben wird, verlässt den Dienst nicht.
    const fremd = await neu.lagebildUebersicht({
      sichtbar: () => true,
      bereiche: [{ bereich: "pg-probe-anderer", name: "Andere", darfSchreiben: false }],
      betrachter: "u-fritz",
    });
    expect(JSON.stringify(fremd)).not.toContain("Zeiterfassung");
  });

  it("Wiederholung derselben Anfrage schreibt nicht doppelt; ein veralteter Stand schreibt nicht", async () => {
    const pool = neuerPool();
    const nochmal = await dienst(pool).setLagebildWerte(BEREICH, EINGABE, "u-lea");
    expect(nochmal).toMatchObject({ wiederholt: true, eintrag: { version: 1 } });

    await expect(
      dienst(pool).setLagebildWerte(
        BEREICH,
        { ...EINGABE, anfrageId: "pg-anfrage-0002" },
        "u-erik",
      ),
    ).rejects.toBeInstanceOf(LagebildKonflikt);
    const zeilen = await pool.query<{ version: number; geaendert_von: string }>(
      "SELECT version, geaendert_von FROM management_lagebild_werte WHERE bereich = $1",
      [BEREICH],
    );
    expect(zeilen.rows).toEqual([{ version: 1, geaendert_von: "u-lea" }]);
  });

  it("bedingtes Schreiben in SQL: von zwei gleichzeitigen Korrekturen gewinnt genau eine", async () => {
    const repo = new PgManagementProfileRepo(neuerPool());
    const andererRepo = new PgManagementProfileRepo(neuerPool());
    const [vorher] = (await repo.listLagebildWerte()).filter((w) => w.bereich === BEREICH);
    expect(vorher?.version).toBe(1);
    const korrektur = (anfrageId: string, wert: number): LagebildWerte => ({
      ...(vorher as LagebildWerte),
      version: 2,
      anfrageId,
      werte: {
        ...(vorher as LagebildWerte).werte,
        hourlyRate: { wert, herkunft: "eigene_eingabe", beleg: null },
      },
      geaendertAm: new Date().toISOString(),
    });
    const ergebnisse = await Promise.all([
      repo.setLagebildWerte(korrektur("pg-anfrage-000a", 80), 1),
      andererRepo.setLagebildWerte(korrektur("pg-anfrage-000b", 90), 1),
    ]);
    expect(ergebnisse.filter(Boolean)).toHaveLength(1);
    const [nachher] = (await repo.listLagebildWerte()).filter((w) => w.bereich === BEREICH);
    expect(nachher?.version).toBe(2);
    expect(nachher?.werte.hourlyRate?.wert).toBe(ergebnisse[0] ? 80 : 90);
  });
});
