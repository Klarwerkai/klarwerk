import { setTimeout as warte } from "node:timers/promises";
import type { Pool, PoolClient } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BRANDING_VORGABE,
  type BrandingStand,
  type BrandingWahl,
  PgBrandingSettingsRepo,
} from "./branding-settings";
import { createPool, migrate } from "./db";

// JOB 3595 · echte Gleichzeitigkeit ergänzt die schnelle SQL-Formprüfung des Stellvertreters.
// Lauf: `KLARWERK_SKIP_KEYCHAIN=1 npx vitest run --config vitest.integration.config.ts services/app/src/branding-settings.integration.test.ts`
// Ausschließlich Wegwerf-Container: fehlendes Docker lässt den Aufbau scheitern, kein grüner Ersatz.
// vitest.integration.config.ts sammelt diese Datei; vitest.config.ts schließt *.integration.test.ts aus.
// Die Produktkonstante ist absichtlich privat; der Drahtschlüssel wird hier unabhängig geprüft.
const BRANDING_SCHLUESSEL = "branding_settings";
const SPERR_WARTEFRIST_MS = 250;
const SPERR_ANLAUF_FRIST_MS = 5_000;
const WAHL_A: BrandingWahl = { profil: "advisor", aktiv: true };
const WAHL_B: BrandingWahl = { profil: null, aktiv: false };
type Wechsel = Awaited<ReturnType<PgBrandingSettingsRepo["setze"]>>;

describe("JOB 3595 · Markenwahl unter echten Postgres-Zeilensperren", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool;

  beforeAll(async () => {
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
    } catch (cause) {
      throw new Error(
        "Postgres-Aufbau: Containerstart fehlgeschlagen; keine Nebenläufigkeitsmessung",
        {
          cause,
        },
      );
    }
    pool = createPool(
      `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
    );
    // Drei Schreiber, Sperrhalter und Beobachter müssen gleichzeitig verbunden sein können.
    pool.options.max = 5;
    pool.options.connectionTimeoutMillis = 5_000;
    pool.options.statement_timeout = 15_000;
    await migrate(pool);
  });

  afterAll(async () => {
    try {
      await pool?.end();
    } finally {
      await container?.stop();
    }
  });

  async function reset(p: Pool): Promise<void> {
    // Die produktive Migration erzeugt die Tabelle; jeder Fall setzt nur seine Testdaten zurück.
    await p.query("DELETE FROM branding_settings");
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
                 AND a.state = 'active' AND a.query LIKE '%INSERT INTO branding_settings%'
             ) SELECT (count(*) - 1)::int AS n FROM sperrkette`,
            [pid.rows[0]?.pid],
          );
          return res.rows[0]?.n;
        },
        {
          timeout: SPERR_ANLAUF_FRIST_MS,
          interval: 20,
          message: `Sperrüberlappung vor COMMIT: ${anzahl} aktive Postgres-Schreiber erwartet`,
        },
      )
      .toBe(anzahl);
  }

  async function gleichzeitig(
    p: Pool,
    wahlen: readonly BrandingWahl[],
    leer = false,
  ): Promise<Wechsel[]> {
    expect(p.options.max).toBeGreaterThanOrEqual(wahlen.length + 2);
    const halter = await p.connect();
    let vorgaenge: Promise<Wechsel>[] = [];
    try {
      await halter.query("BEGIN");
      // Bei vorhandener Zeile entstehen alle Anweisungs-Schnappschüsse vor der Freigabe.
      // Auf leerer Tabelle gibt es noch keine Zeilensperre: SHARE hält dort alle Inserts an,
      // lässt aber auch beim Erst-Insert ungesperrte Vorablesungen vor der ersten Änderung durch.
      // Das ist echte PG-Synchronisation, keine nachgebaute Antwort oder SQL-Ersetzung.
      if (leer) {
        await halter.query("LOCK TABLE branding_settings IN SHARE MODE");
      } else {
        await halter.query("SELECT * FROM branding_settings WHERE key=$1 FOR UPDATE", [
          BRANDING_SCHLUESSEL,
        ]);
      }
      vorgaenge = wahlen.map(async (wahl, index) => {
        try {
          return await new PgBrandingSettingsRepo(p).setze(wahl);
        } catch (cause) {
          const code =
            cause && typeof cause === "object" && "code" in cause ? cause.code : "unbekannt";
          throw new Error(`setze-Aufruf ${index + 1}: Postgres-Fehlercode ${code}`, { cause });
        }
      });
      const wechsel = Promise.all(vorgaenge);
      // Beide Zweige werden sofort behandelt; nach Freigabe werden ALLE Fehler berichtet.
      const ergebnis = wechsel.then(
        (werte) => ({ werte }),
        () => ({ werte: undefined }),
      );
      await warteAufBlockierte(p, halter, wahlen.length);
      await halter.query("COMMIT");
      const { werte } = await ergebnis;
      if (!werte) {
        const alle = await Promise.allSettled(vorgaenge);
        const fehler = alle.flatMap((r) => (r.status === "rejected" ? [r.reason] : []));
        throw new AggregateError(fehler, fehler.map((e: Error) => e.message).join("; "));
      }
      return werte;
    } finally {
      try {
        await halter.query("ROLLBACK");
      } finally {
        halter.release();
        await Promise.allSettled(vorgaenge);
      }
    }
  }

  // Drei verschiedene Eingaben; jede Rückgabe wird ihrer Eingabe zugeordnet, damit auch ein
  // zusammengemischtes profil/aktiv-Paar beim letzten Schreiber nicht als gültig durchgeht.
  const wahlen: readonly BrandingWahl[] = [WAHL_A, WAHL_B, { profil: "advisor", aktiv: false }];

  async function pruefeVersionen(k: number, wechsel: Wechsel[]): Promise<void> {
    expect(wechsel).toHaveLength(wahlen.length);
    expect(wechsel.map((w) => w.nachher.version).sort((a, b) => a - b)).toEqual([
      k + 1,
      k + 2,
      k + 3,
    ]);
    expect(new Set(wechsel.map((w) => w.nachher.version)).size).toBe(3);
    for (const [index, w] of wechsel.entries()) {
      expect(w.nachher).toEqual({ ...wahlen[index], version: w.nachher.version });
    }
    const letzter = wechsel.find((w) => w.nachher.version === k + 3);
    expect(letzter).toBeDefined();
    expect(await gespeicherterStand(pool)).toEqual(letzter?.nachher);
    expect(await new PgBrandingSettingsRepo(pool).lies()).toEqual(letzter?.nachher);
  }

  it("G1 · leere Tabelle: drei gleichzeitige Erst-Inserts liefern exakt 1, 2, 3", async () => {
    await reset(pool);
    expect(await new PgBrandingSettingsRepo(pool).lies()).toEqual(BRANDING_VORGABE);
    const wechsel = await gleichzeitig(pool, wahlen, true);
    await pruefeVersionen(0, wechsel);
    expect(wechsel.find((w) => w.nachher.version === 1)?.vorher).toEqual(BRANDING_VORGABE);
  });

  it("G2 · bestehende Zeile: drei gleichzeitige Schreiber liefern exakt k+1, k+2, k+3", async () => {
    await reset(pool);
    const k = 17;
    await pool.query("INSERT INTO branding_settings VALUES ($1, $2, $3, $4)", [
      BRANDING_SCHLUESSEL,
      null,
      true,
      k,
    ]);
    expect(await gespeicherterStand(pool)).toEqual({ profil: null, aktiv: true, version: k });
    await pruefeVersionen(k, await gleichzeitig(pool, wahlen));
  });

  it("G3 · vorher darf einen Zwischenstand überspringen; nachher bleibt exakt", async () => {
    const p = pool;
    await reset(p);
    await new PgBrandingSettingsRepo(p).setze({ profil: "advisor", aktiv: false });
    const ursprung = await gespeicherterStand(p);
    const wechsel = await gleichzeitig(p, [WAHL_A, WAHL_B]);
    const a = wechsel[0];
    const b = wechsel[1];
    if (!a || !b) throw new Error("Zwei vollständige Schreibergebnisse erwartet");
    const erster = a.nachher.version < b.nachher.version ? a : b;
    const zweiter = erster === a ? b : a;

    // Bewusst schwächer als „unmittelbarer Vorgänger“: vorher stammt aus dem Anweisungs-
    // schnappschuss, nachher aus der gesperrten Zeile. Die Barriere macht hier beide alten
    // Schnappschüsse sichtbar und belegt das erlaubte Überspringen im Audit tatsächlich.
    expect(a.vorher).toEqual(ursprung);
    expect(b.vorher).toEqual(ursprung);
    expect(zweiter.vorher.version).toBeLessThan(zweiter.nachher.version - 1);
    expect(a.nachher).toEqual({ ...WAHL_A, version: a === erster ? 2 : 3 });
    expect(b.nachher).toEqual({ ...WAHL_B, version: b === erster ? 2 : 3 });
    expect(await gespeicherterStand(p)).toEqual(zweiter.nachher);
    expect(await new PgBrandingSettingsRepo(p).lies()).toEqual(zweiter.nachher);
  });

  it("G4 · wartet auf die Zeilensperre und zählt nach COMMIT vom gespeicherten Wert weiter", async () => {
    const p = pool;
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
