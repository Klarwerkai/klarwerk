// ================================================================================================
// AUFNAHME gesamt-sso · R-0556 / R-0571 — VERZEICHNISGRUPPEN UND SPERRE GEGEN ECHTES POSTGRESQL.
// ================================================================================================
//
// `repo-pg.ts` hat die Spalte `verzeichnis_gruppen` (additive Migration) und die schmale
// Schreibmethode `setzeVerzeichnisGruppen` bekommen; `AuthService.authenticate` prüft seit dieser
// Nacharbeit die Freigabe. Beides wird hier gegen eine echte Datenbank gefahren:
//   G1  Migration läuft, Anlage mit Gruppen, Wechsel, Leeren — gelesen, wie geschrieben.
//   G2  Austritt: das Sperren beendet die gespeicherte Sitzung, `authenticate` lässt niemanden herein.
//   G3  Prüfzuständigkeit aus den gespeicherten Gruppen.
//
// PRÜFGRENZE, LAUT GEMELDET (Muster aus `tests/gast-nutzerweg/durchgehender-gastweg…`): ohne
// PostgreSQL wird der Grund auf stderr genannt und übersprungen — ein stiller Skip sähe aus wie ein
// bestandener Lauf. Nur eine Wegwerf-Datenbank mit `test` im Namen wird angelegt und entfernt.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { PgSessionRepo, PgUserRepo } from "../../services/auth";
import { AuthService } from "../../services/auth/src/service";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { alsBefund, warteAufVerbindungsende } from "../gast-nutzerweg/verbindungsende";

const KENNUNG = "[KLARWERK] gesamt-sso Verzeichnisgruppen";

describe("R-0556 / R-0571 · Verzeichnisgruppen und Sperre in PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let adminPool: Pool | undefined;
  let pool: Pool | undefined;
  const datenbank = `klarwerk_verzeichnis_test_${`${Date.now()}`.slice(-9)}`;

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

  it("G1 Anlage mit Gruppen, Wechsel und Leeren — gelesen, wie geschrieben", async (ctx) => {
    if (!pool) {
      ctx.skip();
      return;
    }
    const service = dienst(pool);
    await service.register({ name: "Admin", email: "admin@vz.test", password: "geheim12345" });
    const konto = await service.verzeichnisAnlegen({
      email: "paula@vz.test",
      name: "Paula",
      aktiv: true,
      rolle: "controller",
      gruppen: ["QM-Pruefung", "Labor"],
    });
    expect((await service.kontoLesen(konto.id))?.verzeichnisGruppen).toEqual([
      "QM-Pruefung",
      "Labor",
    ]);
    await service.verzeichnisAendern(konto.id, { gruppen: ["Recht"], rolle: "viewer" });
    expect(await service.kontoLesen(konto.id)).toMatchObject({
      role: "viewer",
      verzeichnisGruppen: ["Recht"],
    });
    await service.verzeichnisAendern(konto.id, { gruppen: [] });
    expect((await service.kontoLesen(konto.id))?.verzeichnisGruppen).toEqual([]);
  });

  it("G2 Austritt: die gespeicherte Sitzung endet, authenticate lässt niemanden herein", async (ctx) => {
    if (!pool) {
      ctx.skip();
      return;
    }
    const service = dienst(pool);
    const konto = await service.verzeichnisAnlegen({
      email: "rita@vz.test",
      name: "Rita",
      aktiv: true,
    });
    const { token } = await service.loginWithOidc(
      {
        sub: "rita-sub",
        email: "rita@vz.test",
        name: "Rita",
        roles: [],
        iss: "https://idp.vz.test",
        emailVerified: true,
        rolesClaimPresent: false,
      },
      false,
    );
    expect((await service.authenticate(token))?.id).toBe(konto.id);
    await service.verzeichnisAendern(konto.id, { aktiv: false });
    expect(await service.authenticate(token)).toBeUndefined();
    const sitzungen = await pool.query("SELECT 1 FROM sessions WHERE user_id=$1", [konto.id]);
    expect(sitzungen.rowCount).toBe(0);
  });

  it("G3 die Prüfzuständigkeit folgt den gespeicherten Gruppen", async (ctx) => {
    if (!pool) {
      ctx.skip();
      return;
    }
    const service = dienst(pool);
    const konto = await service.verzeichnisAnlegen({
      email: "otto@vz.test",
      name: "Otto",
      aktiv: true,
      gruppen: ["Werkstatt"],
    });
    const zuordnung = new Map([["Werkstatt", ["space-nord"]]]);
    expect(await service.pruefzustaendigeFuer("space-nord", zuordnung)).toEqual([konto.id]);
  });
});
