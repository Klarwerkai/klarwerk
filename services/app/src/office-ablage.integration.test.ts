import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../db-tx";
import { createPool, migrate } from "./db";
import { PgOfficeAblage } from "./office-ablage";

// produkt:20261007:office-artikel-editor (Nacharbeit 2, bens Befund) · die Office-Ablage gegen
// echtes PostgreSQL. Gemessen wird, was die Speicherfassung nicht zeigen kann: Editor-Sitzung,
// letzter Schreiber und gesicherte Konfliktstände überleben einen NEUSTART — hier ein neuer Pool
// und eine neue Ablageinstanz gegen dieselbe Datenbank. Die produktive Migration legt die Tabellen
// an (zweimal ohne Fehler). Datenbank wie `quellabgleich-ablage.integration.test.ts`: zuerst die
// abgesicherte Prüfinstanz aus `KLARWERK_PG_TEST_URL`, sonst ein Wegwerf-Container; sonst scheitert
// der Aufbau — kein Überspringen. Alle Zeilen tragen ein eigenes Präfix und werden danach entfernt.
describe("Office im Artikel · Ablage unter echtem Postgres", () => {
  let container: StartedTestContainer | undefined;
  let url: string;
  let pool: Pool;
  const praefix = `itest-${randomUUID()}`;
  const anhang = `${praefix}-anh`;

  beforeAll(async () => {
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      url = lokal;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      throw new Error(
        "Postgres-Aufbau: KLARWERK_PG_TEST_URL von der Testsicherung abgelehnt; keine Ablagemessung",
      );
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
      } catch (cause) {
        throw new Error("Postgres-Aufbau: Containerstart fehlgeschlagen; keine Ablagemessung", {
          cause,
        });
      }
      url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    }
    pool = createPool(url);
    await migrate(pool);
    await migrate(pool);
  });

  afterAll(async () => {
    try {
      await pool?.query("DELETE FROM office_sitzungen WHERE anhang_id LIKE $1", [`${praefix}-%`]);
      await pool?.query("DELETE FROM office_gesichert WHERE anhang_id LIKE $1", [`${praefix}-%`]);
      await pool?.end();
    } finally {
      await container?.stop();
    }
  });

  it("A1: Sitzung und Schreiber überleben einen Neustart; Fortschreiben behält den Schreiber", async () => {
    const vorher = new PgOfficeAblage(pool);
    const sitzung = {
      sperre: { kennung: "sperre-1", bis: Date.UTC(2026, 9, 10, 12) },
      basisFassung: 3,
      arbeitsstand: { objectId: `${praefix}-obj-a`, speichergroesse: 1234 },
    };
    await vorher.schreibe(anhang, sitzung);
    await vorher.merkeSchreiber(anhang, "bert");
    await vorher.schreibe(anhang, { ...sitzung, basisFassung: 4 });

    const neuerPool = createPool(url);
    try {
      const nachher = new PgOfficeAblage(neuerPool);
      expect(await nachher.lies(anhang)).toEqual({ ...sitzung, basisFassung: 4 });
      expect(await nachher.schreiber(anhang)).toBe("bert");
      await nachher.schreibe(anhang, undefined);
      expect(await nachher.lies(anhang)).toBeUndefined();
      expect(await nachher.schreiber(anhang)).toBeUndefined();
    } finally {
      await neuerPool.end();
    }
  });

  it("A2: gesicherte Konfliktstände überleben einen Neustart und lassen sich entfernen", async () => {
    const vorher = new PgOfficeAblage(pool);
    const stand = {
      koId: `${praefix}-ko`,
      anhangId: anhang,
      objectId: `${praefix}-obj-b`,
      nutzerId: "bert",
      at: "2026-10-10T08:00:00.000Z",
    };
    await vorher.sichere(stand);
    await vorher.sichere(stand); // idempotent

    const neuerPool = createPool(url);
    try {
      const nachher = new PgOfficeAblage(neuerPool);
      expect(await nachher.gesicherte(anhang)).toEqual([stand]);
      await nachher.entferneGesichert(anhang, stand.objectId);
      expect(await nachher.gesicherte(anhang)).toEqual([]);
    } finally {
      await neuerPool.end();
    }
  });
});
