// ================================================================================================
// R-0562 (aufnahme:20260922:gesamt-zweifaktor) — DER ZWEITE FAKTOR IN ECHTEM POSTGRESQL.
// ================================================================================================
//
// `eigene-zweifaktor-anmeldung.test.ts` misst Dienst und Routen über die Speicherablage. Diese Datei
// fährt den WIRKLICHEN Speicherweg: `buildApp(buildPgServices(pool))` gegen echtes PostgreSQL.
//   G1  Einrichten über die Routen schreibt genau eine Zeile in `user_second_factors`.
//   G2  Neustart-Rundlauf: eine NEU aufgebaute App verlangt weiter den Code — der zweite Faktor
//       lebt in der Datenbank, nicht im Prozess.
//   G3  Ein Code trägt höchstens eine Anmeldung — auch bei zwei gleichzeitigen Verbräuchen.
//   G4  Admin-Rücksetzung löscht die Zeile; danach reicht wieder das Passwort.
//
// DATENBANKHERKUNFT wörtlich nach der Hausform (`tests/auth-speicherung/kennwort-ablage-pg…`):
// lokale URL über die Sicherung mit Vorrang, sonst Testcontainers, sonst SICHTBARER Skip.

import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { PgSecondFactorRepo, totpCode, totpSchritt } from "../../services/auth";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { stelleTrigrammErweiterungSicher } from "../office-pg-abnahme/rueckweg-erwartung";

const EIGENES_SCHEMA = "zweifaktor_pg";
const PW = "Zwei-Faktor-Kennwort-23";

describe("R-0562 · eigener zweiter Faktor in echtem PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let url = "";
  let pool: Pool | undefined;
  let grund = "";

  beforeAll(async () => {
    const lokal = guardedLocalPgTestUrl();
    if (lokal) {
      url = lokal;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      grund = "KLARWERK_PG_TEST_URL wurde von der Testdatenbank-Sicherung abgelehnt.";
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        const port = container.getMappedPort(5432);
        url = `postgresql://postgres:test@${container.getHost()}:${port}/klarwerk_test`;
      } catch (fehler) {
        grund = `weder KLARWERK_PG_TEST_URL noch Container-Laufzeit: ${String(fehler)}`;
      }
    }
    if (url) {
      verwaltung = createPool(url);
      let erreichbar = false;
      try {
        await verwaltung.query("SELECT 1");
        erreichbar = true;
      } catch (fehler) {
        grund = `Datenbank unter der genannten URL nicht erreichbar: ${String(fehler)}`;
      }
      if (erreichbar) {
        // Ab hier wird nichts mehr gefangen: ein Fehler ist eine Aussage über das Produkt.
        await stelleTrigrammErweiterungSicher(verwaltung);
        await verwaltung.query(`DROP SCHEMA IF EXISTS ${EIGENES_SCHEMA} CASCADE`);
        await verwaltung.query(`CREATE SCHEMA ${EIGENES_SCHEMA}`);
        pool = new Pool({
          connectionString: url,
          options: `-c search_path=${EIGENES_SCHEMA},public`,
        });
        await migrate(pool);
      }
    }
    if (!pool) {
      process.stderr.write(`[KLARWERK][zweifaktor] PG-Test ÜBERSPRUNGEN — Grund: ${grund}\n`);
    }
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await verwaltung
      ?.query(`DROP SCHEMA IF EXISTS ${EIGENES_SCHEMA} CASCADE`)
      .catch(() => undefined);
    await verwaltung?.end();
    await container?.stop();
  });

  it("G1–G4 · einrichten, neu starten, Code einmal verbrauchen, Admin setzt zurück", async (ctx) => {
    if (!pool) {
      ctx.skip();
      return;
    }
    const db = pool;
    const app = buildApp(buildPgServices(db));
    const post = (a: typeof app, pfad: string, payload: Record<string, unknown>, token?: string) =>
      a.inject({
        method: "POST",
        url: pfad,
        payload,
        ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
      });
    const zeile = async (userId: string) => {
      const res = await db.query<{ secret: string; last_step: string | null }>(
        "SELECT secret, last_step FROM user_second_factors WHERE user_id=$1",
        [userId],
      );
      return res.rows;
    };

    let neu: typeof app | undefined;
    try {
      const konto = { name: "Admin", email: "admin@x.de", password: PW };
      const anlage = await post(app, "/api/auth/register", konto);
      expect(anlage.statusCode, anlage.body).toBe(201);
      const userId = String(anlage.json().id);
      const erste = await post(app, "/api/auth/login", { email: konto.email, password: PW });
      const token = String(erste.json().token);

      // G1 · Einrichten über die Routen.
      const einrichtung = await post(app, "/api/auth/second-factor/setup", { password: PW }, token);
      expect(einrichtung.statusCode, einrichtung.body).toBe(200);
      const secret = String(einrichtung.json().secret);
      const schritt = totpSchritt(Date.now());
      const bestaetigt = await post(
        app,
        "/api/auth/second-factor/confirm",
        { code: totpCode(secret, schritt) },
        token,
      );
      expect(bestaetigt.statusCode, bestaetigt.body).toBe(200);
      const nachEinrichtung = await zeile(userId);
      expect(nachEinrichtung).toHaveLength(1);
      expect(nachEinrichtung[0]?.secret).toBe(secret);
      expect(Number(nachEinrichtung[0]?.last_step)).toBeGreaterThanOrEqual(schritt);

      // G3 · Anmelden mit dem Code des nächsten Schritts; derselbe Code ein zweites Mal ⇒ nein.
      const code = totpCode(secret, totpSchritt(Date.now()) + 1);
      const anfrage1 = await post(app, "/api/auth/login", { email: konto.email, password: PW });
      expect(anfrage1.json().secondFactorRequired).toBe(true);
      expect(anfrage1.json().token).toBeUndefined();
      const zweiter = await post(app, "/api/auth/login/second-factor", {
        challenge: anfrage1.json().challenge,
        code,
      });
      expect(zweiter.statusCode, zweiter.body).toBe(200);
      const anfrage2 = await post(app, "/api/auth/login", { email: konto.email, password: PW });
      const wiederholt = await post(app, "/api/auth/login/second-factor", {
        challenge: anfrage2.json().challenge,
        code,
      });
      expect(wiederholt.statusCode).toBe(401);
      // Und gleichzeitig an der Ablage selbst: zwei Verbräuche desselben Schritts, genau einer gewinnt.
      const ablage = new PgSecondFactorRepo(db);
      const spaeter = totpSchritt(Date.now()) + 100;
      const parallel = await Promise.all([
        ablage.claimStep(userId, spaeter),
        ablage.claimStep(userId, spaeter),
      ]);
      expect(parallel.filter(Boolean)).toHaveLength(1);
      expect(Number((await zeile(userId))[0]?.last_step)).toBe(spaeter);

      // G2 · Neustart-Rundlauf: ein frischer Aufbau über derselben Datenbank.
      neu = buildApp(buildPgServices(db));
      const nachNeustart = await post(neu, "/api/auth/login", { email: konto.email, password: PW });
      expect(nachNeustart.statusCode).toBe(200);
      expect(nachNeustart.json().secondFactorRequired).toBe(true);
      expect(nachNeustart.headers["set-cookie"]).toBeUndefined();

      // G4 · Admin-Rücksetzung (verlorenes Gerät) — mit der Sitzung von vor der Einrichtung.
      const ruecksetzung = await neu.inject({
        method: "DELETE",
        url: `/api/users/${userId}/second-factor`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(ruecksetzung.statusCode, ruecksetzung.body).toBe(204);
      expect(await zeile(userId)).toHaveLength(0);
      const ohneFaktor = await post(neu, "/api/auth/login", { email: konto.email, password: PW });
      expect(ohneFaktor.statusCode).toBe(200);
      expect(typeof ohneFaktor.json().token).toBe("string");

      // Das Geheimnis steht in keinem Prüfprotokolleintrag.
      const protokoll = await db.query("SELECT row_to_json(t)::text AS j FROM audit t");
      expect(protokoll.rows.map((r) => String(r.j)).join("\n")).not.toContain(secret);
    } finally {
      await neu?.close();
      await app.close();
    }
  });
});
