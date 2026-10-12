// ================================================================================================
// produkt:20261012:klara-setup-shortcuts-umsetzung (AA-03) · DIE KLARA-KÜRZEL GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `tastenkuerzel-am-server.test.ts` misst an der Speicherfassung. Dass die Belegung einen NEUSTART
// übersteht, dass zwei Konten getrennte Stände haben und dass Profil, Eigeninitiative und Kürzel
// einander nicht überschreiben, ist erst hier belegt: dieselbe Ablage (`PgAssistenzProfilRepo`), das
// ausgeführte `migrate()`, ein neuer Pool je „Server“.
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
import {
  type KuerzelKombination,
  TastenkuerzelDienst,
  TastenkuerzelFehler,
  wirksameBelegung,
} from "../../services/app/src/assistenz-tastenkuerzel";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const ANNA = "u-pg-kuerzel-anna";
const BERT = "u-pg-kuerzel-bert";

const E: KuerzelKombination = {
  code: "KeyE",
  taste: "E",
  strg: true,
  alt: false,
  umschalt: true,
  meta: false,
};
const U: KuerzelKombination = {
  code: "KeyU",
  taste: "U",
  strg: false,
  alt: false,
  umschalt: true,
  meta: true,
};

describe("Klara-Tastenkürzel gegen echtes PostgreSQL", () => {
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
  function neuerDienst(): TastenkuerzelDienst {
    return new TastenkuerzelDienst({ repo: new PgAssistenzProfilRepo(neuePool()), jetzt });
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

  it("ab Werk unbelegt; eine Belegung übersteht den Neustart; kein Profil entsteht", async () => {
    expect(await neuerDienst().lies(ANNA)).toEqual({ belegungen: {}, geaendertAm: null });
    await neuerDienst().aendere(ANNA, { aktion: "oeffnen", belegung: E });
    await neuerDienst().aendere(ANNA, { aktion: "diktieren", belegung: U });
    const s = await neuerDienst().lies(ANNA);
    expect(wirksameBelegung(s, "oeffnen")).toEqual(E);
    expect(wirksameBelegung(s, "diktieren")).toEqual(U);
    expect(await neuesProfil().hole(ANNA)).toBeNull();
  });

  it("entfernt bleibt nach dem Neustart entfernt; Doppelbelegung ändert nichts", async () => {
    await neuerDienst().aendere(ANNA, { aktion: "oeffnen", belegung: null });
    const s = await neuerDienst().lies(ANNA);
    expect(s.belegungen.oeffnen).toBeNull();
    await expect(
      neuerDienst().aendere(ANNA, { aktion: "seitenhilfe", belegung: U }),
    ).rejects.toBeInstanceOf(TastenkuerzelFehler);
    expect(await neuerDienst().lies(ANNA)).toEqual(s);
    expect(await neuerDienst().lies(BERT)).toEqual({ belegungen: {}, geaendertAm: null });
  });

  it("Profil und Eigeninitiative schreiben lassen die Kürzel stehen — und umgekehrt", async () => {
    const p = await neuesProfil().aendere(ANNA, {
      name: "Mia",
      avatar: "eule",
      einrichtungAbschliessen: true,
      fassung: 0,
    });
    expect(p.fassung).toBe(1);
    await neuerDienst().aendere(ANNA, { aktion: "oeffnen", belegung: E });
    expect((await neuesProfil().hole(ANNA))?.fassung).toBe(1);
    await neuesProfil().aendere(ANNA, { name: "Mia 2", fassung: 1 });
    await new EigeninitiativeDienst({
      repo: new PgAssistenzProfilRepo(neuePool()),
      jetzt,
    }).setzeModus(ANNA, "hinweise");
    const s = await neuerDienst().lies(ANNA);
    expect(wirksameBelegung(s, "oeffnen")).toEqual(E);
    expect(wirksameBelegung(s, "diktieren")).toEqual(U);
    expect(await neuesProfil().hole(ANNA)).toMatchObject({ name: "Mia 2", fassung: 2 });
  });

  it("alle zurücksetzen übersteht den Neustart", async () => {
    await neuerDienst().aendere(ANNA, { alleZuruecksetzen: true });
    const s = await neuerDienst().lies(ANNA);
    expect(s.belegungen).toEqual({});
    expect(s.geaendertAm).not.toBeNull();
  });
});
