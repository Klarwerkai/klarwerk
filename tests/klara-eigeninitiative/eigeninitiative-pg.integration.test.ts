// ================================================================================================
// KLARA 12 (produkt:20261008:klara-eigeninitiative) · DER UNTERSTÜTZUNGSMODUS GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `eigeninitiative-am-server.test.ts` misst an der Speicherfassung. Dass Modus und ruhende Hinweise
// einen NEUSTART überstehen (am Server ist das „Neuladen, erneute Anmeldung, zweites Gerät"), dass
// zwei Konten getrennte Stände haben und dass Profil, Fähigkeitsaufträge und Eigeninitiative
// einander nicht überschreiben, ist erst hier belegt: dieselbe Ablage (`PgAssistenzProfilRepo`), das
// ausgeführte `migrate()`, ein neuer Pool je „Server".
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  EigeninitiativeDienst,
  EigeninitiativeFehler,
} from "../../services/app/src/assistenz-eigeninitiative";
import {
  AssistenzProfilDienst,
  PgAssistenzProfilRepo,
} from "../../services/app/src/assistenz-profil";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const ANNA = "u-pg-initiative-anna";
const BERT = "u-pg-initiative-bert";

describe("Unterstützungsmodus gegen echtes PostgreSQL", () => {
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
  function neuerDienst(): EigeninitiativeDienst {
    return new EigeninitiativeDienst({ repo: new PgAssistenzProfilRepo(neuePool()), jetzt });
  }

  function neuesProfil(): AssistenzProfilDienst {
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

  it("ohne Wahl still; der gewählte Modus übersteht den Neustart; kein Profil entsteht", async () => {
    expect(await neuerDienst().lies(ANNA)).toEqual({
      modus: "nachfrage",
      geaendertAm: null,
      hinweise: [],
    });
    await neuerDienst().setzeModus(ANNA, "auftraege");
    expect((await neuerDienst().lies(ANNA)).modus).toBe("auftraege");
    // Der Modus ist kein eingerichtetes Profil.
    expect(await neuesProfil().hole(ANNA)).toBeNull();
    await expect(neuerDienst().setzeModus(ANNA, "immer")).rejects.toBeInstanceOf(
      EigeninitiativeFehler,
    );
    expect((await neuerDienst().lies(ANNA)).modus).toBe("auftraege");
  });

  it("ruhende Hinweise überstehen den Neustart; ein zweites Konto bleibt unberührt", async () => {
    await neuerDienst().legeHinweisAb(ANNA, {
      schluessel: "tutorial:fragen",
      stand: "zurueckgestellt",
    });
    await neuerDienst().legeHinweisAb(ANNA, {
      schluessel: "seite:bibliothek",
      stand: "geschlossen",
    });
    const s = await neuerDienst().lies(ANNA);
    expect(s.modus).toBe("auftraege");
    expect(s.hinweise.map((h) => [h.schluessel, h.stand])).toEqual([
      ["tutorial:fragen", "zurueckgestellt"],
      ["seite:bibliothek", "geschlossen"],
    ]);
    expect(await neuerDienst().lies(BERT)).toMatchObject({ modus: "nachfrage", hinweise: [] });
  });

  it("Profil schreiben lässt Modus und Hinweise stehen; der Modus lässt die Profilfassung stehen", async () => {
    const p = await neuesProfil().aendere(ANNA, {
      name: "Mia",
      avatar: "eule",
      einrichtungAbschliessen: true,
      fassung: 0,
    });
    expect(p.fassung).toBe(1);
    await neuerDienst().setzeModus(ANNA, "hinweise");
    const gelesen = await neuesProfil().hole(ANNA);
    expect(gelesen?.fassung).toBe(1);
    await neuesProfil().aendere(ANNA, { name: "Mia 2", fassung: 1 });
    const s = await neuerDienst().lies(ANNA);
    expect(s.modus).toBe("hinweise");
    expect(s.hinweise).toHaveLength(2);
    expect(await neuesProfil().hole(ANNA)).toMatchObject({ name: "Mia 2", fassung: 2 });
  });

  it("zwei Geräte gleichzeitig: beide Ablagen bleiben, nichts geht verloren", async () => {
    await Promise.all([
      neuerDienst().legeHinweisAb(BERT, { schluessel: "seite:a", stand: "geschlossen" }),
      neuerDienst().legeHinweisAb(BERT, { schluessel: "seite:b", stand: "geschlossen" }),
    ]);
    const s = await neuerDienst().lies(BERT);
    expect(s.hinweise.map((h) => h.schluessel).sort()).toEqual(["seite:a", "seite:b"]);
  });
});
