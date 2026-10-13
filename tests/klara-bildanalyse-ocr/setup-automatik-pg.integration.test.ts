// ================================================================================================
// OCR-03 · K4 — „BILDER AUTOMATISCH ANALYSIEREN UND TEXT ERKENNEN“ GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `setup-automatik-am-server.test.ts` misst den Weg über HTTP an der Speicherablage. Dass die Wahl
// einen NEUSTART übersteht (am Server ist das „Neuladen, erneute Anmeldung, zweites Gerät“), dass
// andere Profilschreiber sie nicht still überschreiben und dass zwei Konten getrennt bleiben, ist erst
// hier belegt: dieselbe Ablage (`PgAssistenzProfilRepo`), das ausgeführte `migrate()`, ein neuer Pool
// je „Server“. Das Muster ist `tests/assistenz-profil/profil-pg.integration.test.ts`.
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EigeninitiativeDienst } from "../../services/app/src/assistenz-eigeninitiative";
import {
  AssistenzProfilDienst,
  PgAssistenzProfilRepo,
} from "../../services/app/src/assistenz-profil";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const CARLA = "u-pg-bildautomatik-carla";
const DORIS = "u-pg-bildautomatik-doris";

describe("OCR-03 · Bildautomatik im Assistenzprofil gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const pools: Pool[] = [];
  let uhr = Date.parse("2026-10-12T08:00:00.000Z");
  const jetzt = (): number => {
    uhr += 1_000;
    return uhr;
  };

  function neuePool(): Pool {
    const pool = createPool(url);
    pools.push(pool);
    return pool;
  }

  /** Ein frischer Dienst auf einem frischen Pool — so sieht ein Neustart des Servers aus. */
  function neuerDienst(): AssistenzProfilDienst {
    return new AssistenzProfilDienst({ repo: new PgAssistenzProfilRepo(neuePool()), jetzt });
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
      await migrate(pool);
      await pool.query("DELETE FROM assistenz_profile WHERE konto_id = ANY($1)", [[CARLA, DORIS]]);
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

  it("aus und wieder an überstehen den Neustart; andere Schreiber lassen die Wahl stehen", async () => {
    // Ohne Wahl: kein Profil, also gilt im Client die Voreinstellung „an“.
    expect(await neuerDienst().hole(CARLA)).toBeNull();

    const aus = await neuerDienst().aendere(CARLA, { bildAutomatik: false, fassung: 0 });
    expect(aus.bildAutomatik).toBe(false);
    expect((await neuerDienst().hole(CARLA))?.bildAutomatik).toBe(false);

    // Ein anderer Schreiber am selben Profil (Unterstützungsmodus) lässt die Wahl stehen …
    await new EigeninitiativeDienst({
      repo: new PgAssistenzProfilRepo(neuePool()),
      jetzt,
    }).setzeModus(CARLA, "hinweise");
    // … ebenso ein Profilschreiben ohne das Feld (Einrichtung mit Name und Motiv).
    const eingerichtet = await neuerDienst().aendere(CARLA, {
      name: "Mia",
      avatar: "eule",
      einrichtungAbschliessen: true,
      fassung: aus.fassung,
    });
    expect(eingerichtet.bildAutomatik).toBe(false);
    const nachNeustart = await neuerDienst().hole(CARLA);
    expect(nachNeustart).toMatchObject({ name: "Mia", bildAutomatik: false });
    expect(nachNeustart?.eigeninitiative?.modus).toBe("hinweise");

    const an = await neuerDienst().aendere(CARLA, {
      bildAutomatik: true,
      fassung: eingerichtet.fassung,
    });
    expect(an.bildAutomatik).toBe(true);
    expect((await neuerDienst().hole(CARLA))?.bildAutomatik).toBe(true);
  });

  it("die Wahl gehört dem Konto: zwei Konten, zwei getrennte Wahlen", async () => {
    await neuerDienst().aendere(DORIS, { bildAutomatik: false, fassung: 0 });
    expect((await neuerDienst().hole(DORIS))?.bildAutomatik).toBe(false);
    const carla = await neuerDienst().hole(CARLA);
    expect(carla?.bildAutomatik).toBe(true);
  });
});
