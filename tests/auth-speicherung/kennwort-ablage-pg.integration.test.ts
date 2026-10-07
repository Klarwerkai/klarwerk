// ================================================================================================
// AUFNAHME gesamt-auth-speicherung · Nacharbeit 1 — DIE ECHTE DATENBANKABLAGE
// ================================================================================================
//
// BENS BEFUND: „Die tatsächliche Datenbankablage ausschließlich als Salt+Hash ist nicht
// nachgewiesen." Das traf: `kennwort-nur-salz-und-hash.test.ts` misst den In-Memory-Satz und den
// Schematext, `services/auth/src/repo-pg-kennwortbindung.test.ts` ein selbstgebautes Doppel. Ein
// vorhandener PostgreSQL-Test, der nach Registrierung und Kennwortänderung die Zeile zurückliest,
// war nicht da (`build-app.integration.test.ts` registriert, liest die Kennwortspalten aber nie).
//
// DIESE DATEI FÄHRT DEN WIRKLICHEN SPEICHERWEG: `buildApp(buildPgServices(pool))` gegen echtes
// PostgreSQL, alle vier Kennwortwege über die HTTP-Routen, danach die Zeilen per SQL gelesen.
//
// UND DER BETRIEBSREST VON R-0530 (I11, JOB 1946): `repo-pg.ts` führt als DEPLOY-VERTRAG, dass die
// Start-Migration `migrateAuthTokensAtRest` ohne parallelen Zweitprozess läuft — „nicht gemessen".
// Fall P3 misst, was bei zwei gleichzeitigen Läufen an der Ablage tatsächlich geschieht. Die
// Instanzzahl auf Coolify selbst bleibt eine Betreiberauskunft; kein Test kann sie ersetzen.
//
// DATENBANKHERKUNFT wörtlich nach der Hausform (`services/app/src/build-app.integration.test.ts`):
// lokale URL über die Sicherung mit Vorrang, sonst Testcontainers, sonst SICHTBARER Skip. Nach dem
// Verbindungsnachweis wird nichts mehr gefangen — ein kaputter Aufbau färbt rot.

import { pbkdf2Sync } from "node:crypto";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { TOKEN_HASH_PREFIX, migrateAuthTokensAtRest } from "../../services/auth";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { stelleTrigrammErweiterungSicher } from "../office-pg-abnahme/rueckweg-erwartung";

const EIGENES_SCHEMA = "auth_speicherung_pg";

const PW_ADMIN = "Admin-Kennwort-05";
const PW_REGISTRIERT = "Erst-Kennwort-17";
const PW_ADMIN_RESET = "Admin-Reset-Kennwort-29";
const PW_SELBST = "Selbst-Geaendert-Kennwort-41";
const PW_MAIL_RESET = "Mail-Reset-Kennwort-53";
const ALLE_PASSWOERTER = [PW_ADMIN, PW_REGISTRIERT, PW_ADMIN_RESET, PW_SELBST, PW_MAIL_RESET];

function erwarteKeinKlartext(text: string, ort: string): void {
  for (const pw of ALLE_PASSWOERTER) {
    const roh = Buffer.from(pw, "utf8");
    for (const form of [pw, pw.toLowerCase(), roh.toString("hex"), roh.toString("base64")]) {
      const meldung = `${ort} enthält das Passwort „${pw}" (Form „${form}")`;
      expect(text.includes(form), meldung).toBe(false);
    }
  }
}

interface Kennwortzeile {
  password_salt: string;
  password_hash: string;
}

/** Nachgerechnet mit den Parametern aus `password.ts` — PBKDF2-SHA256, 100 000 Runden, 32 Byte. */
function erwarteSalzUndHash(zeile: Kennwortzeile | undefined, passwort: string): string {
  if (!zeile) {
    throw new Error("Zeile nicht in der Datenbank");
  }
  expect(zeile.password_salt, "Salz in der DB ist kein 16-Byte-Hex").toMatch(/^[0-9a-f]{32}$/);
  expect(zeile.password_hash, "Hash in der DB ist kein 32-Byte-Hex").toMatch(/^[0-9a-f]{64}$/);
  const erwartet = pbkdf2Sync(passwort, zeile.password_salt, 100_000, 32, "sha256");
  const meldung = "DB-Hash ist nicht PBKDF2-SHA256/100 000";
  expect(zeile.password_hash, meldung).toBe(erwartet.toString("hex"));
  return zeile.password_salt;
}

describe("FR-AUTH-05 / NFR-SEC-01 / R-0530 · Kennwortablage in echtem PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let url = "";
  let pool: Pool | undefined;
  let grund = "";

  const schemaPool = () =>
    new Pool({ connectionString: url, options: `-c search_path=${EIGENES_SCHEMA},public` });

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
        pool = schemaPool();
        await migrate(pool);
      }
    }
    if (!pool) {
      process.stderr.write(
        `[KLARWERK][auth-speicherung] PG-Ablagetest ÜBERSPRUNGEN — Grund: ${grund}\n`,
      );
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

  it("P1 · vier Kennwortwege über die Routen: die DB-Zeile trägt nur Salt+Hash", async (ctx) => {
    if (!pool) {
      ctx.skip();
      return;
    }
    const db = pool;
    const postfach: string[] = [];
    const app = buildApp({
      ...buildPgServices(db),
      mailer: {
        send: async (nachricht: { text: string }) => {
          postfach.push(nachricht.text);
        },
      },
    });
    const post = (pfad: string, payload: Record<string, unknown>, token?: string) =>
      app.inject({
        method: "POST",
        url: pfad,
        payload,
        ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
      });
    const status = async (pfad: string, payload: Record<string, unknown>, token?: string) =>
      (await post(pfad, payload, token)).statusCode;
    const abfrage = "SELECT password_salt, password_hash FROM users WHERE email=$1";
    const zeile = async (email: string): Promise<Kennwortzeile | undefined> => {
      const ergebnis = await db.query<Kennwortzeile>(abfrage, [email]);
      return ergebnis.rows[0];
    };

    try {
      const admin = { name: "Admin", email: "admin@x.de", password: PW_ADMIN };
      expect(await status("/api/auth/register", admin)).toBe(201);
      erwarteSalzUndHash(await zeile(admin.email), PW_ADMIN);
      const adminLogin = await post("/api/auth/login", { email: admin.email, password: PW_ADMIN });
      const adminToken = String(adminLogin.json().token);

      // Weg 1: Registrierung.
      const anna = { name: "Anna", email: "anna@x.de", password: PW_REGISTRIERT };
      const annaAnlage = await post("/api/auth/register", anna);
      expect(annaAnlage.statusCode).toBe(201);
      const annaId = String(annaAnlage.json().id);
      const salz1 = erwarteSalzUndHash(await zeile(anna.email), PW_REGISTRIERT);
      expect(await status(`/api/auth/users/${annaId}/approve`, {}, adminToken)).toBe(200);

      // Weg 2: Admin-Reset.
      const adminReset = { password: PW_ADMIN_RESET };
      expect(await status(`/api/auth/users/${annaId}/reset`, adminReset, adminToken)).toBe(204);
      const salz2 = erwarteSalzUndHash(await zeile(anna.email), PW_ADMIN_RESET);

      // Weg 3: Selbständerung — der von Ben ausdrücklich genannte Weg.
      const nachAdminReset = { email: anna.email, password: PW_ADMIN_RESET };
      const annaToken = String((await post("/api/auth/login", nachAdminReset)).json().token);
      const aenderung = { oldPassword: PW_ADMIN_RESET, newPassword: PW_SELBST };
      expect(await status("/api/auth/password", aenderung, annaToken)).toBe(204);
      const salz3 = erwarteSalzUndHash(await zeile(anna.email), PW_SELBST);

      // Weg 4: Reset per Mail.
      expect(await status("/api/auth/forgot", { email: anna.email })).toBe(204);
      const resetToken = /token=([0-9a-f]+)/.exec(postfach.join("\n"))?.[1];
      expect(resetToken, "keine Reset-Mail mit Token erhalten").toBeDefined();
      const einloesung = { token: resetToken, newPassword: PW_MAIL_RESET };
      expect(await status("/api/auth/reset", einloesung)).toBe(204);
      const salz4 = erwarteSalzUndHash(await zeile(anna.email), PW_MAIL_RESET);
      expect(new Set([salz1, salz2, salz3, salz4]).size).toBe(4);

      // Rundlauf: der zurückgelesene Stand meldet wirklich an — und nur mit dem neuesten Kennwort.
      const richtig = { email: anna.email, password: PW_MAIL_RESET };
      expect(await status("/api/auth/login", richtig)).toBe(200);
      const alt = { email: anna.email, password: PW_SELBST };
      expect(await status("/api/auth/login", alt)).toBe(401);

      // Die ganze Ablage, Zeile für Zeile als JSON gelesen: Konten, Sitzungen, Reset-Tokens und
      // Prüfprotokoll. Keine Form irgendeines Kennworts darin.
      for (const tabelle of ["users", "sessions", "password_resets", "audit"]) {
        const inhalt = await db.query(`SELECT row_to_json(t)::text AS j FROM ${tabelle} t`);
        erwarteKeinKlartext(inhalt.rows.map((r) => String(r.j)).join("\n"), `Tabelle ${tabelle}`);
      }
      // Sitzungen liegen nur als sha256:-Hash — der Bearer-Token selbst steht nicht in der Tabelle.
      const sitzungen = await db.query<{ token: string }>("SELECT token FROM sessions");
      expect(sitzungen.rowCount ?? 0).toBeGreaterThan(0);
      for (const s of sitzungen.rows) {
        expect(s.token.startsWith(TOKEN_HASH_PREFIX)).toBe(true);
      }
    } finally {
      await app.close();
    }
  });

  it("P2 · Kalibrierung: dieselbe Abfrage SIEHT einen Klartext in der Zeile", async (ctx) => {
    if (!pool) {
      ctx.skip();
      return;
    }
    // Ohne diesen Fall wäre P1 auch dann grün, wenn `row_to_json` die Spalten nie herausgäbe.
    const spalten = "id,name,email,password_salt,password_hash,role,approved,created_at";
    await pool.query(`INSERT INTO users(${spalten}) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [
      "kalib",
      "Kalib",
      "kalib@x.de",
      "s",
      PW_REGISTRIERT,
      "experte",
      false,
      "t",
    ]);
    try {
      const inhalt = await pool.query("SELECT row_to_json(t)::text AS j FROM users t");
      const text = inhalt.rows.map((r) => String(r.j)).join("\n");
      expect(text.includes(PW_REGISTRIERT)).toBe(true);
    } finally {
      await pool.query("DELETE FROM users WHERE id='kalib'");
    }
  });

  it("P3 · R-0530/I11: zwei parallele Start-Migrationen — nur Hashes, nichts weg", async (ctx) => {
    if (!pool) {
      ctx.skip();
      return;
    }
    // Der DEPLOY-VERTRAG in `repo-pg.ts` nimmt EINE Instanz an. Hier laufen zwei Migrationen über
    // zwei getrennte Pools gleichzeitig auf denselben Klartext-Altbestand.
    const kuenftig = Date.now() + 3_600_000;
    const klartextSitzungen = Array.from({ length: 20 }, (_, i) => `${i}`.padStart(64, "a"));
    const klartextResets = Array.from({ length: 5 }, (_, i) => `${i}`.padStart(64, "b"));
    for (const t of klartextSitzungen) {
      await pool.query("INSERT INTO sessions(token,user_id,expires_at) VALUES($1,$2,$3)", [
        t,
        "u-mig",
        kuenftig,
      ]);
    }
    for (const t of klartextResets) {
      await pool.query("INSERT INTO password_resets(token,user_id,expires_at) VALUES($1,$2,$3)", [
        t,
        "u-mig",
        kuenftig,
      ]);
    }

    const zweiter = schemaPool();
    try {
      // Wirft einer der beiden Läufe, fliegt der Fall hier rot heraus — ein Startabbruch.
      const laeufe = [migrateAuthTokensAtRest(pool), migrateAuthTokensAtRest(zweiter)];
      expect(await Promise.all(laeufe)).toHaveLength(2);
    } finally {
      await zweiter.end();
    }

    const sitzungen = await pool.query<{ token: string }>(
      "SELECT token FROM sessions WHERE user_id='u-mig'",
    );
    const resets = await pool.query<{ token: string }>(
      "SELECT token FROM password_resets WHERE user_id='u-mig'",
    );
    // Nichts verloren, nichts verdoppelt, alles gehasht.
    expect(sitzungen.rowCount).toBe(klartextSitzungen.length);
    expect(resets.rowCount).toBe(klartextResets.length);
    for (const r of [...sitzungen.rows, ...resets.rows]) {
      expect(r.token.startsWith(TOKEN_HASH_PREFIX), `Klartext übrig: ${r.token}`).toBe(true);
    }
    await pool.query("DELETE FROM sessions WHERE user_id='u-mig'");
    await pool.query("DELETE FROM password_resets WHERE user_id='u-mig'");
  });
});
