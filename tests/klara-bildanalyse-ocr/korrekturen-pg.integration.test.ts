// ================================================================================================
// OCR-E02 · K6 — BERICHTIGTER BILDTEXT GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `korrekturen-am-server.test.ts` misst den Weg über HTTP an der Speicherablage. Dass eine
// Berichtigung einen NEUSTART übersteht (am Server ist das „Neuladen, erneute Anmeldung, zweites
// Gerät“), dass andere Profilschreiber (Einrichtung, Einstellung, Kürzel) sie nicht still
// überschreiben und dass zwei Konten getrennt bleiben, ist erst hier belegt: dieselbe Ablage
// (`PgAssistenzProfilRepo`), das ausgeführte `migrate()`, ein neuer Pool je „Server“. Das Muster ist
// `setup-automatik-pg.integration.test.ts`.
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BildKorrekturDienst } from "../../services/app/src/assistenz-bildkorrekturen";
import {
  AssistenzProfilDienst,
  PgAssistenzProfilRepo,
} from "../../services/app/src/assistenz-profil";
import { TastenkuerzelDienst } from "../../services/app/src/assistenz-tastenkuerzel";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const CARLA = "u-pg-bildkorrektur-carla";
const DORIS = "u-pg-bildkorrektur-doris";
const BILD = `sha256:${"c".repeat(64)}`;
const QUELLE = "datei:fiktive-rechnung.png|fiktive-rechnung.png";

describe("OCR-E02 · Bildberichtigungen im Assistenzprofil gegen echtes PostgreSQL", () => {
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
  function korrekturen(): BildKorrekturDienst {
    return new BildKorrekturDienst({ repo: new PgAssistenzProfilRepo(neuePool()), jetzt });
  }

  function profil(): AssistenzProfilDienst {
    return new AssistenzProfilDienst({ repo: new PgAssistenzProfilRepo(neuePool()), jetzt });
  }

  function kuerzel(): TastenkuerzelDienst {
    return new TastenkuerzelDienst({ repo: new PgAssistenzProfilRepo(neuePool()), jetzt });
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

  it("setzen übersteht Neustart und andere Profilschreiber; rückgängig und zurücksetzen", async () => {
    expect((await korrekturen().lies(CARLA)).eintraege).toEqual([]);
    await korrekturen().aendere(CARLA, {
      aktion: "setzen",
      quelle: QUELLE,
      inhaltskennung: BILD,
      ort: "b1",
      text: "Herr Müller zahlt 4.250 EUR",
    });
    expect((await korrekturen().lies(CARLA)).eintraege.map((e) => e.text)).toEqual([
      "Herr Müller zahlt 4.250 EUR",
    ]);

    // Andere Schreiber am selben Profil: Einrichtung samt Einstellung, dann ein Kürzel.
    const eingerichtet = await profil().aendere(CARLA, {
      name: "Mia",
      avatar: "eule",
      einrichtungAbschliessen: true,
      bildAutomatik: false,
      fassung: 0,
    });
    await profil().aendere(CARLA, { name: "Nora", fassung: eingerichtet.fassung });
    await kuerzel().aendere(CARLA, { alleZuruecksetzen: true });
    const nachNeustart = await korrekturen().lies(CARLA);
    expect(nachNeustart.eintraege).toMatchObject([
      { quelle: QUELLE, inhaltskennung: BILD, ort: "b1", text: "Herr Müller zahlt 4.250 EUR" },
    ]);

    // Eine zweite Berichtigung, dann rückgängig (frühere), dann zurücksetzen (Rohbefund).
    await korrekturen().aendere(CARLA, {
      aktion: "setzen",
      quelle: QUELLE,
      inhaltskennung: BILD,
      text: "Herr Müller zahlt 4.520 EUR",
    });
    const zurueck = await korrekturen().aendere(CARLA, {
      aktion: "rueckgaengig",
      quelle: QUELLE,
      inhaltskennung: BILD,
    });
    expect(zurueck.eintraege.map((e) => e.text)).toEqual(["Herr Müller zahlt 4.250 EUR"]);
    await korrekturen().aendere(CARLA, {
      aktion: "zuruecksetzen",
      quelle: QUELLE,
      inhaltskennung: BILD,
    });
    expect((await korrekturen().lies(CARLA)).eintraege).toEqual([]);
    // Das Profil selbst blieb unberührt.
    expect(await profil().hole(CARLA)).toMatchObject({ name: "Nora", bildAutomatik: false });
  });

  it("zwei Konten, zwei getrennte Bestände", async () => {
    await korrekturen().aendere(DORIS, {
      aktion: "setzen",
      quelle: QUELLE,
      inhaltskennung: BILD,
      text: "Frau Schmidt",
    });
    expect((await korrekturen().lies(DORIS)).eintraege.map((e) => e.text)).toEqual([
      "Frau Schmidt",
    ]);
    expect((await korrekturen().lies(CARLA)).eintraege).toEqual([]);
  });
});
