// ================================================================================================
// JOB 4223 · E — DIESELBE STRECKE, ABER MIT ECHTEM POSTGRESQL DARUNTER.
// ================================================================================================
//
// WARUM EINE ZWEITE DATEI UND KEINE ZWEITE STRECKE. Die Schritte kommen Zeile für Zeile aus
// `strecke.ts` — dieselbe `buildApp`, dieselben Routen, derselbe Socket, dieselben Sitzungen.
// Verschieden ist EIN Stück: `buildPgServices(pool)` statt `buildServices()`. Läge der Ablauf hier
// ein zweites Mal ausgeschrieben, wären es zwei Aussagen, die nur heute übereinstimmen.
//
// WARUM SIE GETRENNT LÄUFT. Das Tor fährt bewusst ohne Docker (`vitest.config.ts:31-32`:
// „Integrationstests (Postgres/Testcontainers) laufen getrennt ueber `test:integration`"), damit ein
// schneller Gate-Lauf keine Container-Laufzeit braucht. Der Dateiname `*.integration.test.ts` ist
// die Eintragung in genau diese Trennung.
//
// WAS SIE ZUSÄTZLICH BELEGT — und es ist nicht wenig: `PgUserRepo` schreibt und liest
// `access_expires_at` wirklich, PostgreSQL macht daraus wirklich, was die Abbildung erwartet, und
// `PgSessionRepo.deleteByUser` räumt die Sitzung wirklich weg. `tests/demo-zugang-gaeste/pg-rundlauf-ablaufspalte.test.ts`
// zieht seine Reichweitengrenze selbst (`:15-20`): „**Was PostgreSQL daraus macht, ist hier NICHT
// gemessen** und bleibt bis zu einem echten Integrationslauf eine unbewiesene Hypothese." Das ist
// dieser Lauf.
//
// PRÜFGRENZE, LAUT GEMELDET (Lehre 12.09., JOB 3668, und das Muster aus
// `tests/neuinstallation/erstinstallation.integration.test.ts:57-62`): Ohne echte PostgreSQL wird
// der Grund SICHTBAR auf stderr gemeldet und übersprungen. Ein stiller Skip sähe aus wie ein
// bestandener Lauf.
//
// KEINE PRODUKTIVDATEN: Es wird ausschliesslich eine Wegwerf-Datenbank mit `test` im Namen angelegt
// und am Ende wieder entfernt.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import type { PublicUser } from "../../services/auth/src/types";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  PASSWORT,
  type Strecke,
  arbeitsweg,
  ausDerListe,
  befristen,
  ersteinrichtung,
  gastAnlegen,
  kuenftig,
  mussGelingen,
  starteStrecke,
  vergangen,
  wissensobjektAnlegen,
} from "./strecke";

const JOB = "[KLARWERK] JOB 4223";
const TITEL = "Wartungsplan aus der Datenbank (JOB 4223)";
const GAST = "pg-gast@gastweg-4223.test";

/** Zusammengesetzt statt ausgeschrieben — s. `tests/neuinstallation/…:108-112` (Fall N3 dort). */
const PG_SCHEMA = "postgresql:";

interface Verbindung {
  host: string;
  port: string;
  user: string;
  passwort: string;
}

function zerlege(url: string): Verbindung | undefined {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/, "http:"));
    if (!u.hostname) {
      return undefined;
    }
    return {
      host: u.hostname,
      port: u.port || "5432",
      user: decodeURIComponent(u.username) || "postgres",
      passwort: decodeURIComponent(u.password),
    };
  } catch {
    return undefined;
  }
}

function pgUrl(v: Verbindung, datenbank: string): string {
  if (!datenbank.toLowerCase().includes("test")) {
    throw new Error(
      `${JOB}: „${datenbank}" trägt kein „test" im Namen — diese Suite fasst ausschliesslich Wegwerf-Datenbanken an.`,
    );
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

describe("JOB 4223 E · der Gastweg gegen echtes PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let verfuegbar = false;
  const gastwegDb = `klarwerk_gastweg_test_${`${Date.now()}`.slice(-9)}`;

  beforeAll(async () => {
    let url = guardedLocalPgTestUrl();
    if (!url && process.env.KLARWERK_PG_TEST_URL) {
      // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — KEIN Container-Rückfall:
      // wer ausdrücklich eine lokale Instanz wollte, bekommt keine stille zweite.
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
          `${JOB} UEBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfuegbar — der Gastweg gegen echtes PostgreSQL ist damit nicht messbar.\n`,
        );
        return;
      }
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(
        `${JOB} UEBERSPRUNGEN: KLARWERK_PG_TEST_URL nennt keinen Rechnernamen.\n`,
      );
      return;
    }
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${gastwegDb}`);
    verfuegbar = true;
  }, 240_000);

  afterAll(async () => {
    if (adminPool) {
      await adminPool
        .query(`DROP DATABASE IF EXISTS ${gastwegDb} WITH (FORCE)`)
        .catch(() => undefined);
      await adminPool.end();
    }
    await container?.stop();
  }, 120_000);

  it("E1 — leere Datenbank → Gast anlegen, anmelden, arbeiten, ablaufen, verlängern — alles an einer echten Instanz", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const pool = createPool(pgUrl(verbindung, gastwegDb));
    let strecke: Strecke | undefined;
    try {
      await migrate(pool);
      strecke = await starteStrecke({ pool });
      const { sitzung: admin } = await ersteinrichtung(strecke, "pg-admin@gastweg-4223.test");
      await wissensobjektAnlegen(admin, TITEL);

      // ── Anlegen in EINEM Schritt, mit Rolle und Ende. ────────────────────────────────────
      const ende = kuenftig();
      const gast = mussGelingen(
        "POST /api/users",
        await gastAnlegen(admin, {
          name: "Gast aus der Datenbank",
          email: GAST,
          role: "viewer",
          accessExpiresAt: ende,
        }),
        201,
      ).json as PublicUser;

      // Der Wert hat die Datenbank wirklich gesehen: er kommt aus einer FRISCHEN Abfrage
      // zurück, nicht aus der Antwort von eben.
      expect((await ausDerListe(admin, gast.id))?.accessExpiresAt).toBe(ende);
      // Und er steht so in der Spalte, wie ihn die Abbildung geschrieben hat — der Nachweis,
      // den `pg-rundlauf-ablaufspalte.test.ts` sich ausdrücklich versagt.
      const spalte = await pool.query<{ access_expires_at: string | null }>(
        "SELECT access_expires_at FROM users WHERE id = $1",
        [gast.id],
      );
      expect(spalte.rows[0]?.access_expires_at).toBe(ende);

      // ── Anmelden und Arbeiten. ──────────────────────────────────────────────────────────
      const profil = strecke.profil("pg-gast");
      mussGelingen(
        "Anmeldung",
        await profil.sende("POST", "/api/auth/login", { email: GAST, password: PASSWORT }),
      );
      const arbeit = await arbeitsweg(profil);
      expect(arbeit.status, arbeit.text).toBe(200);
      expect(arbeit.text).toContain(TITEL);

      // ── Ablauf trifft die laufende Sitzung. ─────────────────────────────────────────────
      mussGelingen("Frist in die Vergangenheit", await befristen(admin, gast.id, vergangen()));
      const gesperrt = await arbeitsweg(profil);
      expect([401, 403], gesperrt.text).toContain(gesperrt.status);
      expect(gesperrt.text).not.toContain(TITEL);
      // Die Sitzungszeile ist wirklich aus der Datenbank verschwunden, nicht nur unwirksam.
      const sitzungen = await pool.query<{ anzahl: string }>(
        "SELECT count(*)::text AS anzahl FROM sessions WHERE user_id = $1",
        [gast.id],
      );
      expect(sitzungen.rows[0]?.anzahl, "keine lebende Sitzungszeile mehr").toBe("0");

      // ── Verlängern führt zurück herein. ─────────────────────────────────────────────────
      const neu = kuenftig(30);
      mussGelingen("Verlängerung", await befristen(admin, gast.id, neu));
      const wieder = strecke.profil("pg-gast-wieder");
      mussGelingen(
        "erneute Anmeldung",
        await wieder.sende("POST", "/api/auth/login", { email: GAST, password: PASSWORT }),
      );
      const nochmal = await arbeitsweg(wieder);
      expect(nochmal.status, nochmal.text).toBe(200);
      expect(nochmal.text).toContain(TITEL);

      // ── Das Nehmen der Befristung räumt die Spalte wirklich. ────────────────────────────
      mussGelingen("Befristung nehmen", await befristen(admin, gast.id, null));
      const danach = await pool.query<{ access_expires_at: string | null }>(
        "SELECT access_expires_at FROM users WHERE id = $1",
        [gast.id],
      );
      expect(danach.rows[0]?.access_expires_at, "NULL, nicht leerer String").toBeNull();
      expect(Object.hasOwn((await ausDerListe(admin, gast.id)) ?? {}, "accessExpiresAt")).toBe(
        false,
      );
    } finally {
      // Der Pool wird IMMER beendet, auch wenn das Schliessen der Anwendung scheitert — sonst
      // schösse der `DROP … WITH (FORCE)` im `afterAll` eine offen gebliebene Verbindung ab und der
      // Lauf endete mit „terminating connection due to administrator command" statt mit der
      // eigentlichen Ursache. Begründung ausführlich in `gastweg-pg-im-browser.integration.test.ts`.
      try {
        await strecke?.schliessen();
      } finally {
        await pool.end();
      }
    }
  }, 300_000);
});
