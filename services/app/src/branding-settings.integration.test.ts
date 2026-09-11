import { setTimeout as warte } from "node:timers/promises";
import { Pool, type PoolClient } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../db-tx";
import {
  BRANDING_SETTINGS_SCHEMA,
  BRANDING_VORGABE,
  type BrandingStand,
  type BrandingWahl,
  PgBrandingSettingsRepo,
} from "./branding-settings";

// JOB 3590 · echte Gleichzeitigkeit ergänzt die schnelle SQL-Formprüfung des Stellvertreters.
// Lauf: `KLARWERK_SKIP_KEYCHAIN=1 npx vitest run --config vitest.integration.config.ts services/app/src/branding-settings.integration.test.ts`
// Lokale Wegwerf-Testdatenbank (gesichert), sonst postgres:16-alpine, sonst ausdrücklich SKIP.
// Die Produktkonstante ist absichtlich privat; der Drahtschlüssel wird hier unabhängig geprüft.
const BRANDING_SCHLUESSEL = "branding_settings";
const SPERR_WARTEFRIST_MS = 250;
const SPERR_ANLAUF_FRIST_MS = 5_000;
const WAHL_A: BrandingWahl = { profil: "advisor", aktiv: true };
const WAHL_B: BrandingWahl = { profil: null, aktiv: false };
type Wechsel = Awaited<ReturnType<PgBrandingSettingsRepo["setze"]>>;

describe("JOB 3590 · Markenwahl unter echten Postgres-Zeilensperren", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;

  function oeffnePool(connectionString: string): Pool {
    // Sperrhalter, zwei Schreiber und Beobachter brauchen vier verschiedene Verbindungen.
    return new Pool({
      connectionString,
      max: 4,
      connectionTimeoutMillis: 5_000,
      statement_timeout: 15_000,
    });
  }

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = oeffnePool(localUrl);
        await pool.query("SELECT 1");
        available = true;
      } catch {
        process.stderr.write(
          "[KLARWERK] Pg-Integrationssuite ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
        );
      }
      return;
    }
    if (process.env.KLARWERK_PG_TEST_URL) {
      return; // Sicherung lehnt URL ab: kein Testcontainers-Fallback.
    }
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      pool = oeffnePool(
        `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
      );
      await pool.query("SELECT 1");
      available = true;
    } catch {
      process.stderr.write(
        "[KLARWERK] Pg-Integrationssuite ÜBERSPRUNGEN: kein Docker/Postgres verfügbar.\n",
      );
    }
  });

  afterAll(async () => {
    try {
      await pool?.end();
    } finally {
      await container?.stop();
    }
  });

  function requirePool(ctx: { skip: () => void }): Pool {
    if (!available || !pool) {
      ctx.skip();
      throw new Error("unreachable"); // ctx.skip() bricht ab; nur fürs Typing.
    }
    return pool;
  }

  async function reset(p: Pool): Promise<void> {
    await p.query("DROP TABLE IF EXISTS branding_settings");
    await p.query(BRANDING_SETTINGS_SCHEMA);
  }

  async function gespeicherterStand(p: Pool): Promise<BrandingStand> {
    const res = await p.query<BrandingStand & { key: string }>(
      "SELECT key, profil, aktiv, version FROM branding_settings",
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]?.key).toBe(BRANDING_SCHLUESSEL);
    const { key: _key, ...stand } = res.rows[0] as BrandingStand & { key: string };
    return stand;
  }

  async function warteAufBlockierte(p: Pool, halter: PoolClient, anzahl: number): Promise<void> {
    const pid = await halter.query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
    // PostgreSQL selbst meldet die Blockierung; eine bloß noch nicht erfüllte JS-Promise reicht
    // nicht, denn sie könnte noch im Pool warten. Auch indirekte Sperren zählen: der zweite
    // Schreiber kann hinter dem ersten warten, der wiederum auf unseren Halter wartet.
    await expect
      .poll(
        async () => {
          const res = await p.query<{ n: number }>(
            `WITH RECURSIVE sperrkette(pid) AS (
               SELECT $1::int
               UNION
               SELECT a.pid FROM pg_stat_activity a
               JOIN sperrkette s ON s.pid = ANY(pg_blocking_pids(a.pid))
               WHERE a.datname = current_database() AND a.wait_event_type = 'Lock'
             ) SELECT (count(*) - 1)::int AS n FROM sperrkette`,
            [pid.rows[0]?.pid],
          );
          return res.rows[0]?.n;
        },
        { timeout: SPERR_ANLAUF_FRIST_MS, interval: 20 },
      )
      .toBe(anzahl);
  }

  async function gleichzeitig(p: Pool, leer = false): Promise<[Wechsel, Wechsel]> {
    const halter = await p.connect();
    let vorgaenge: [Promise<Wechsel>, Promise<Wechsel>] | undefined;
    try {
      await halter.query("BEGIN");
      // Bei vorhandener Zeile entstehen beide Anweisungs-Schnappschüsse vor der Freigabe.
      // Auf leerer Tabelle gibt es noch keine Zeilensperre: SHARE hält dort beide Inserts an,
      // lässt aber auch bei G1/G2 ungesperrte Vorablesungen vor der ersten Änderung durch.
      // Das ist echte PG-Synchronisation, keine nachgebaute Antwort oder SQL-Ersetzung.
      if (leer) {
        await halter.query("LOCK TABLE branding_settings IN SHARE MODE");
      } else {
        await halter.query("SELECT * FROM branding_settings WHERE key=$1 FOR UPDATE", [
          BRANDING_SCHLUESSEL,
        ]);
      }
      vorgaenge = [
        new PgBrandingSettingsRepo(p).setze(WAHL_A),
        new PgBrandingSettingsRepo(p).setze(WAHL_B),
      ];
      const wechsel = Promise.all(vorgaenge);
      // Fehler sofort behandeln, aber nach dem Freigeben der Sperre unverändert weiterreichen.
      void wechsel.catch(() => undefined);
      await warteAufBlockierte(p, halter, 2);
      await halter.query("COMMIT");
      return await wechsel;
    } finally {
      try {
        await halter.query("ROLLBACK");
      } finally {
        halter.release();
        await Promise.allSettled(vorgaenge ?? []);
      }
    }
  }

  it("N1 · bestehende Zeile: zwei Schaltvorgänge liefern genau v+1 und v+2", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    await new PgBrandingSettingsRepo(p).setze({ profil: "advisor", aktiv: false });
    const vorher = await gespeicherterStand(p);

    const [a, b] = await gleichzeitig(p);

    expect(a.nachher.version).not.toBe(b.nachher.version);
    expect([a.nachher.version, b.nachher.version].sort((x, y) => x - y)).toEqual([
      vorher.version + 1,
      vorher.version + 2,
    ]);
    const letzter = a.nachher.version > b.nachher.version ? a.nachher : b.nachher;
    expect(await new PgBrandingSettingsRepo(p).lies()).toEqual(letzter);
    expect((await gespeicherterStand(p)).version).toBe(vorher.version + 2);
  });

  it("N2 · leere Tabelle: zwei erste Schaltvorgänge liefern 1 und 2, genau eine Zeile", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    expect(await new PgBrandingSettingsRepo(p).lies()).toEqual(BRANDING_VORGABE);

    const [a, b] = await gleichzeitig(p, true);

    expect([a.nachher.version, b.nachher.version].sort((x, y) => x - y)).toEqual([1, 2]);
    const letzter = a.nachher.version === 2 ? a.nachher : b.nachher;
    expect(await gespeicherterStand(p)).toEqual(letzter);
    expect(await new PgBrandingSettingsRepo(p).lies()).toEqual(letzter);
  });

  it("N3 · vorher darf einen Zwischenstand überspringen; nachher bleibt exakt", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    await new PgBrandingSettingsRepo(p).setze({ profil: "advisor", aktiv: false });
    const ursprung = await gespeicherterStand(p);
    const [a, b] = await gleichzeitig(p);
    const erster = a.nachher.version < b.nachher.version ? a : b;
    const zweiter = erster === a ? b : a;

    // Bewusst schwächer als „unmittelbarer Vorgänger“: vorher stammt aus dem Anweisungs-
    // schnappschuss, nachher aus der gesperrten Zeile. Die Barriere macht hier beide alten
    // Schnappschüsse sichtbar und belegt das erlaubte Überspringen im Audit tatsächlich.
    expect([ursprung]).toContainEqual(erster.vorher);
    expect([ursprung, erster.nachher]).toContainEqual(zweiter.vorher);
    expect(a.vorher).toEqual(ursprung);
    expect(b.vorher).toEqual(ursprung);
    expect(zweiter.vorher.version).toBeLessThan(zweiter.nachher.version - 1);
    expect(a.nachher).toEqual({ ...WAHL_A, version: a === erster ? 2 : 3 });
    expect(b.nachher).toEqual({ ...WAHL_B, version: b === erster ? 2 : 3 });
    expect(await gespeicherterStand(p)).toEqual(zweiter.nachher);
    expect(await new PgBrandingSettingsRepo(p).lies()).toEqual(zweiter.nachher);
  });

  it("N4 · wartet auf die Zeilensperre und zählt nach COMMIT vom gespeicherten Wert weiter", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const repo = new PgBrandingSettingsRepo(p);
    await repo.setze(WAHL_A);
    const vorher = await gespeicherterStand(p);
    const halter = await p.connect();
    let wechsel: Promise<Wechsel> | undefined;
    let beendet = false;
    try {
      await halter.query("BEGIN");
      await halter.query("SELECT * FROM branding_settings WHERE key=$1 FOR UPDATE", [
        BRANDING_SCHLUESSEL,
      ]);
      wechsel = new PgBrandingSettingsRepo(p).setze(WAHL_B);
      void wechsel.then(
        () => {
          beendet = true;
        },
        () => {
          beendet = true;
        },
      );
      await warteAufBlockierte(p, halter, 1);
      await warte(SPERR_WARTEFRIST_MS);
      expect(beendet, `nach ${SPERR_WARTEFRIST_MS} ms Zeilensperre noch nicht beendet`).toBe(false);

      // Erst NACH dem belegten Warten erhöhen: ein vorab in JS gemerkter Wert ist jetzt veraltet.
      const freigegebeneVersion = vorher.version + 7;
      await halter.query("UPDATE branding_settings SET version=$2 WHERE key=$1", [
        BRANDING_SCHLUESSEL,
        freigegebeneVersion,
      ]);
      await halter.query("COMMIT");
      const ergebnis = await wechsel;
      expect(beendet).toBe(true);
      expect(ergebnis.nachher).toEqual({ ...WAHL_B, version: freigegebeneVersion + 1 });
      expect(ergebnis.vorher).toEqual(vorher);
      expect(await gespeicherterStand(p)).toEqual(ergebnis.nachher);
      expect(await repo.lies()).toEqual(ergebnis.nachher);
    } finally {
      try {
        await halter.query("ROLLBACK");
      } finally {
        halter.release();
        await wechsel?.catch(() => undefined);
      }
    }
  });
});
