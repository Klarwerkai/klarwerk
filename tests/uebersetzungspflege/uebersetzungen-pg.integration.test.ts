// ================================================================================================
// R-1034 / FR-I18N-02 · GEPFLEGTE TEXTE UND ANGELEGTE SPRACHEN GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `pflege-am-draht.test.ts` misst die Wege an der Speicherfassung. „Im laufenden Betrieb" heißt
// aber auch: eine Anpassung übersteht den nächsten Neustart und das nächste Deploy. Belegt ist das
// erst hier — dieselbe Ablage (`PgUebersetzungRepo`), das ausgeführte `migrate()` mit
// `UEBERSETZUNGEN_SCHEMA`, ein neuer Pool je „Server".
//
// INFRASTRUKTUR: `KLARWERK_PG_TEST_URL` (Datenbankname mit `test`, s. `guardedLocalPgTestUrl`),
// sonst ein Wegwerf-Container. Fehlt beides, SCHEITERT der Lauf — kein stiller Skip.
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { PgUebersetzungRepo } from "../../services/app/src/uebersetzungen";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const SCHLUESSEL = "pg-probe.uebersetzung.titel";
const SPRACHE = "pgx";
const AM = "2026-10-08T08:00:00.000Z";

describe("R-1034 · Übersetzungspflege gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let url = "";
  const pools: Pool[] = [];

  /** Ein frischer Pool — so sieht ein Neustart des Servers aus. */
  function neueAblage(): PgUebersetzungRepo {
    const pool = createPool(url);
    pools.push(pool);
    return new PgUebersetzungRepo(pool);
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
      await pool.query("DELETE FROM ui_uebersetzungen WHERE schluessel = $1", [SCHLUESSEL]);
      await pool.query("DELETE FROM ui_sprachen WHERE kennung = $1", [SPRACHE]);
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

  it("ein gepflegter Text übersteht den Neustart; Ersetzen überschreibt, Zurücksetzen löscht", async () => {
    const erste = neueAblage();
    expect(await erste.texte("de")).not.toHaveProperty(SCHLUESSEL);
    await erste.setzeText("de", SCHLUESSEL, "Datensicherung", "u-admin", AM);

    // Neuer Pool = neuer Server: der Text ist noch da.
    expect((await neueAblage().texte("de"))[SCHLUESSEL]).toBe("Datensicherung");

    await neueAblage().setzeText("de", SCHLUESSEL, "Sicherungen", "u-admin", AM);
    expect((await neueAblage().texte("de"))[SCHLUESSEL]).toBe("Sicherungen");

    expect(await neueAblage().entferneText("de", SCHLUESSEL)).toBe(true);
    expect(await neueAblage().entferneText("de", SCHLUESSEL)).toBe(false);
    expect(await neueAblage().texte("de")).not.toHaveProperty(SCHLUESSEL);
  });

  it("eine angelegte Sprache und ihre Texte überstehen den Neustart", async () => {
    await neueAblage().setzeSprache({ kennung: SPRACHE, name: "Probe" }, "u-admin", AM);
    await neueAblage().setzeSprache({ kennung: SPRACHE, name: "Probesprache" }, "u-admin", AM);
    await neueAblage().setzeText(SPRACHE, SCHLUESSEL, "Probetext", "u-admin", AM);

    const danach = neueAblage();
    expect(await danach.zusatzSprachen()).toContainEqual({
      kennung: SPRACHE,
      name: "Probesprache",
    });
    expect(await danach.texte(SPRACHE)).toEqual({ [SCHLUESSEL]: "Probetext" });
  });
});
