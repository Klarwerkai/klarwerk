// ================================================================================================
// R-1863 · ANTWORT 18 (Ben, Nacharbeit 9) — DIE WEISUNGSBEFUGNIS AM KONTO GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `repo-pg.ts` hat die Spalte `weisungsbefugnis` (additive Migration) und die schmale Schreibmethode
// `setzeWeisungsbefugnis` bekommen; `update` schreibt die Spalte bewusst NICHT. Gefahren wird:
//   P1  Vergabe, Lesen, Entzug — gelesen, wie geschrieben; der Vermerk-Weg ist derselbe Dienst.
//   P2  Ein anderer Schreibweg am Konto (Rollenwechsel) lässt die Befugnis stehen.
//   P3  Eine unlesbare Spalte gibt KEINE Befugnis (fail-closed).
//
// PRÜFGRENZE, LAUT GEMELDET (Muster aus `tests/firmenanmeldung/verzeichnisgruppen-pg…`): ohne
// PostgreSQL wird der Grund auf stderr genannt und übersprungen. Nur eine Wegwerf-Datenbank mit
// `test` im Namen wird angelegt und entfernt.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { PgSessionRepo, PgUserRepo } from "../../services/auth";
import { AuthService } from "../../services/auth/src/service";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { alsBefund, warteAufVerbindungsende } from "../gast-nutzerweg/verbindungsende";

const KENNUNG = "[KLARWERK] gesamt-peer-validierung Weisungsbefugnis";

describe("R-1863 · Antwort 18 — Weisungsbefugnis in PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let adminPool: Pool | undefined;
  let pool: Pool | undefined;
  const datenbank = `klarwerk_weisung_test_${`${Date.now()}`.slice(-9)}`;

  beforeAll(async () => {
    let url = guardedLocalPgTestUrl();
    if (!url && process.env.KLARWERK_PG_TEST_URL) {
      return;
    }
    if (!url) {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
      } catch {
        process.stderr.write(
          `${KENNUNG} UEBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfuegbar.\n`,
        );
        return;
      }
    }
    adminPool = new Pool({ connectionString: url });
    await adminPool.query(`CREATE DATABASE ${datenbank}`);
    const ziel = new URL(url);
    ziel.pathname = `/${datenbank}`;
    pool = createPool(ziel.toString());
    await migrate(pool);
  }, 240_000);

  afterAll(async () => {
    await pool?.end();
    let rest: Awaited<ReturnType<typeof warteAufVerbindungsende>>["rest"] = [];
    if (adminPool) {
      rest = (await warteAufVerbindungsende(adminPool, datenbank)).rest;
      await adminPool
        .query(`DROP DATABASE IF EXISTS ${datenbank} WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end();
    }
    await container?.stop();
    expect(rest, `offene Verbindungen beim DROP:\n  ${alsBefund(rest)}`).toEqual([]);
  }, 120_000);

  function dienst(p: Pool): AuthService {
    return new AuthService({ users: new PgUserRepo(p), sessions: new PgSessionRepo(p) });
  }

  it("P1 · Vergabe, Lesen, Entzug — gelesen, wie geschrieben", async (ctx) => {
    if (!pool) {
      ctx.skip();
      return;
    }
    const service = dienst(pool);
    const admin = await service.register({
      name: "Admin",
      email: "admin@wb-pg.test",
      password: "geheim12345",
    });
    const konto = await service.verzeichnisAnlegen({
      email: "lea@wb-pg.test",
      name: "Lea",
      aktiv: true,
      rolle: "experte",
    });
    expect((await service.kontoLesen(konto.id))?.weisungsbefugnis).toBeUndefined();
    await service.setWeisungsbefugnis(konto.id, [" Anlage 1 ", "Personal", "Anlage 1"], admin.id);
    expect((await service.kontoLesen(konto.id))?.weisungsbefugnis).toMatchObject({
      bereiche: ["Anlage 1", "Personal"],
      erteiltVon: admin.id,
    });
    await service.setWeisungsbefugnis(konto.id, undefined, admin.id);
    expect((await service.kontoLesen(konto.id))?.weisungsbefugnis).toBeUndefined();
  });

  it("P2 · ein Rollenwechsel am Konto lässt die Befugnis stehen", async (ctx) => {
    if (!pool) {
      ctx.skip();
      return;
    }
    const service = dienst(pool);
    const admin = await service.register({
      name: "Admin 2",
      email: "admin2@wb-pg.test",
      password: "geheim12345",
    });
    const konto = await service.verzeichnisAnlegen({
      email: "gf@wb-pg.test",
      name: "Geschäftsführung",
      aktiv: true,
      rolle: "experte",
    });
    await service.setWeisungsbefugnis(konto.id, ["*"], admin.id);
    await service.verzeichnisAendern(konto.id, { rolle: "controller" });
    expect(await service.kontoLesen(konto.id)).toMatchObject({
      role: "controller",
      weisungsbefugnis: { bereiche: ["*"] },
    });
  });

  it("P3 · eine unlesbare Spalte gibt keine Befugnis", async (ctx) => {
    if (!pool) {
      ctx.skip();
      return;
    }
    const service = dienst(pool);
    const konto = await service.verzeichnisAnlegen({
      email: "kaputt@wb-pg.test",
      name: "Kaputt",
      aktiv: true,
    });
    await pool.query("UPDATE users SET weisungsbefugnis=$2 WHERE id=$1", [konto.id, "{kein json"]);
    expect((await service.kontoLesen(konto.id))?.weisungsbefugnis).toBeUndefined();
    await pool.query("UPDATE users SET weisungsbefugnis=$2 WHERE id=$1", [
      konto.id,
      JSON.stringify({ bereiche: [], erteiltVon: "x", erteiltAm: "y" }),
    ]);
    expect((await service.kontoLesen(konto.id))?.weisungsbefugnis).toBeUndefined();
  });
});
