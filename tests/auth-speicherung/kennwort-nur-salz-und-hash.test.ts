// ================================================================================================
// AUFNAHME gesamt-auth-speicherung — ANMELDEDATEN IM VORGESEHENEN SPEICHER
// ================================================================================================
//
// DIE DREI ORIGINALPUNKTE:
//   R-0530          Der Speicher, in dem Anmeldedaten liegen, entspricht dem, was für diesen
//                   Bereich festgelegt ist („bisher wurde nur die Lage gemessen").
//   FR-AUTH-05      Passwörter nur gehasht, kein Klartext, nichts Reversibles; die Datenbank
//                   enthält ausschließlich Salt+Hash.
//   NFR-SEC-01      Salt+Hash, etabliertes Verfahren, hohe Iteration; kein Klartext in DB/Logs.
//
// DER BESTAND (nicht neu gebaut): `services/auth/src/password.ts` (PBKDF2-HMAC-SHA256, 100 000
// Iterationen, 16 Byte Zufallssalz), `repo-pg.ts` (Spalten `password_salt`/`password_hash`),
// die Logger-Erlaubnisliste in `build-app.ts` (`baueLoggerOptionen`). Was bisher fehlte, war der
// Beleg ÜBER ALLE SCHREIBWEGE: `service.test.ts` prüft nur die Registrierung und nur, dass der
// Hash das Passwort nicht enthält. Die drei Rücksetz-/Änderungswege, das Prüfprotokoll, die
// Iterationszahl und das Log waren ohne Test.
//
// GRENZE, ausdrücklich: gemessen wird der In-Memory-Satz und der Schematext. Dass die Pg-Ablage
// die Werte in genau diese Spalten schreibt, belegt
// `services/auth/src/repo-pg-kennwortbindung.test.ts` am anwendenden Doppel — gegen eine echte
// PostgreSQL-Datenbank ist hier nichts gemessen.

import { pbkdf2Sync } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  AUTH_SCHEMA,
  AuthService,
  InMemoryPasswordResetRepo,
  InMemorySessionRepo,
  InMemoryUserRepo,
  type User,
} from "../../services/auth";
import { verifyPassword } from "../../services/auth/src/password";

/** Die Parameter, die `password.ts` festlegt — hier unabhängig noch einmal ausgeschrieben. */
const ITERATIONEN = 100_000;
const SCHLUESSELLAENGE = 32;
const DIGEST = "sha256";

// Unterscheidbare Passwörter je Weg: taucht eines irgendwo auf, ist klar, welcher Weg es war.
const PW_ADMIN = "Admin-Kennwort-05";
const PW_REGISTRIERT = "Erst-Kennwort-17";
const PW_ADMIN_RESET = "Admin-Reset-Kennwort-29";
const PW_SELBST = "Selbst-Geaendert-Kennwort-41";
const PW_MAIL_RESET = "Mail-Reset-Kennwort-53";
const ALLE_PASSWOERTER = [PW_ADMIN, PW_REGISTRIERT, PW_ADMIN_RESET, PW_SELBST, PW_MAIL_RESET];

/** Jede naheliegende umkehrbare Darstellung eines Passworts — keine davon darf abgelegt sein. */
function umkehrbareFormen(pw: string): string[] {
  const roh = Buffer.from(pw, "utf8");
  return [pw, pw.toLowerCase(), roh.toString("hex"), roh.toString("base64")];
}

function erwarteKeinKlartext(text: string, ort: string): void {
  for (const pw of ALLE_PASSWOERTER) {
    for (const form of umkehrbareFormen(pw)) {
      const meldung = `${ort} enthält das Passwort „${pw}" (Form „${form}")`;
      expect(text.includes(form), meldung).toBe(false);
    }
  }
}

function erwarteNurSalzUndHash(user: User | undefined, passwort: string): string {
  if (!user) {
    throw new Error("Konto nicht gespeichert");
  }
  // Salz: 16 Zufallsbytes als Hex. Hash: 32 Byte als Hex. Feste Gestalt, unabhängig vom Passwort.
  expect(user.passwordSalt, "Salz hat nicht die Gestalt von 16 Byte Hex").toMatch(/^[0-9a-f]{32}$/);
  expect(user.passwordHash, "Hash hat nicht die Gestalt von 32 Byte Hex").toMatch(/^[0-9a-f]{64}$/);
  // Etabliertes Verfahren mit hoher Iteration: der abgelegte Wert IST PBKDF2-SHA256 mit 100 000
  // Runden über genau dieses Salz — nachgerechnet, nicht aus dem Code abgelesen.
  const erwartet = pbkdf2Sync(passwort, user.passwordSalt, ITERATIONEN, SCHLUESSELLAENGE, DIGEST);
  const meldung = "Hash ist nicht PBKDF2-SHA256 mit 100 000 Runden";
  expect(user.passwordHash, meldung).toBe(erwartet.toString("hex"));
  // Gegenprobe zur Iterationszahl: mit weniger Runden käme ein anderer Wert heraus.
  const schwach = pbkdf2Sync(passwort, user.passwordSalt, 1_000, SCHLUESSELLAENGE, DIGEST);
  expect(user.passwordHash).not.toBe(schwach.toString("hex"));
  return user.passwordSalt;
}

function aufbau() {
  const users = new InMemoryUserRepo();
  const audit = new AuditService({ repo: new InMemoryAuditRepo() });
  const auth = new AuthService({
    users,
    sessions: new InMemorySessionRepo(),
    resetTokens: new InMemoryPasswordResetRepo(),
    audit,
  });
  return { users, audit, auth };
}

/** Alle vier Kennwort-Schreibwege nacheinander am Dienst. */
async function alleSchreibwege(auth: AuthService): Promise<string> {
  const admin = await auth.register({ name: "Admin", email: "admin@x.de", password: PW_ADMIN });
  const anna = await auth.register({ name: "Anna", email: "anna@x.de", password: PW_REGISTRIERT });
  await auth.resetPassword(anna.id, PW_ADMIN_RESET, admin.id);
  await auth.changePassword(anna.id, PW_ADMIN_RESET, PW_SELBST);
  const anfrage = await auth.requestPasswordReset("anna@x.de");
  if (!anfrage) {
    throw new Error("Reset-Anforderung ohne Ergebnis");
  }
  await auth.resetPasswordWithToken(anfrage.token, PW_MAIL_RESET);
  return anna.id;
}

describe("R-0530 · der Speicher für Anmeldedaten entspricht dem festgelegten Datenmodell", () => {
  /** Spalten von `users` aus `CREATE TABLE` und den additiven `ALTER TABLE … ADD COLUMN`. */
  function usersSpalten(): string[] {
    const block = /CREATE TABLE IF NOT EXISTS users \(([\s\S]*?)\n\);/.exec(AUTH_SCHEMA)?.[1] ?? "";
    const ausCreate = block
      .split("\n")
      .map((z) => z.trim())
      .filter((z) => z.length > 0 && !z.startsWith("--"))
      .map((z) => z.split(/\s+/)[0] ?? "");
    const ausAlter = [...AUTH_SCHEMA.matchAll(/ALTER TABLE users ADD COLUMN IF NOT EXISTS (\w+)/g)];
    const alle = [...ausCreate, ...ausAlter.map((t) => t[1] ?? "")];
    return [...new Set(alle)].filter((s) => s.length > 0);
  }

  it("jede Spalte aus dem Datenmodell in specs/stories/auth.md steht in der Tabelle users", () => {
    const spec = readFileSync(new URL("../../specs/stories/auth.md", import.meta.url), "utf8");
    const festgelegt = /`users\(([^)]*)\)`/.exec(spec)?.[1];
    expect(festgelegt, "Datenmodell-Zeile in specs/stories/auth.md nicht gefunden").toBeDefined();
    const vorhanden = usersSpalten();
    for (const spalte of (festgelegt ?? "").split(",").map((s) => s.trim())) {
      expect(vorhanden, `Spalte ${spalte} fehlt im AUTH_SCHEMA`).toContain(spalte);
    }
  });

  it("das Kennwort hat genau zwei Spalten — Salz und Hash — und keine dritte Ablage", () => {
    const kennwortSpalten = usersSpalten().filter((s) => /pass|pw|kennwort/i.test(s));
    expect(kennwortSpalten.sort()).toEqual(["password_hash", "password_salt"]);
  });
});

describe("FR-AUTH-05 / NFR-SEC-01 · jeder Schreibweg legt ausschließlich Salt+Hash ab", () => {
  it("alle vier Kennwortwege: PBKDF2-SHA256 mit 100 000 Runden, je ein neues Salz", async () => {
    const { users, auth } = aufbau();
    const admin = await auth.register({ name: "Admin", email: "admin@x.de", password: PW_ADMIN });
    erwarteNurSalzUndHash(await users.findById(admin.id), PW_ADMIN);
    const anna = await auth.register({
      name: "Anna",
      email: "anna@x.de",
      password: PW_REGISTRIERT,
    });
    const salz1 = erwarteNurSalzUndHash(await users.findById(anna.id), PW_REGISTRIERT);

    await auth.resetPassword(anna.id, PW_ADMIN_RESET, admin.id);
    const salz2 = erwarteNurSalzUndHash(await users.findById(anna.id), PW_ADMIN_RESET);

    await auth.changePassword(anna.id, PW_ADMIN_RESET, PW_SELBST);
    const salz3 = erwarteNurSalzUndHash(await users.findById(anna.id), PW_SELBST);

    const anfrage = await auth.requestPasswordReset("anna@x.de");
    if (!anfrage) {
      throw new Error("Reset-Anforderung ohne Ergebnis");
    }
    await auth.resetPasswordWithToken(anfrage.token, PW_MAIL_RESET);
    const salz4 = erwarteNurSalzUndHash(await users.findById(anna.id), PW_MAIL_RESET);

    // Jedes neue Passwort bekommt ein neues Salz.
    expect(new Set([salz1, salz2, salz3, salz4]).size).toBe(4);
    // Der ganze Kontobestand, wie er abgelegt ist — keine Form irgendeines Passworts darin.
    erwarteKeinKlartext(JSON.stringify(await users.list()), "Kontobestand");
  });

  it("das Prüfprotokoll vermerkt die Wege, aber weder Kennwort noch Salz noch Hash", async () => {
    const { users, audit, auth } = aufbau();
    const annaId = await alleSchreibwege(auth);

    const eintraege = await audit.list();
    // Kalibrierung: die Wege sind wirklich protokolliert — sonst wäre „kein Klartext" trivial.
    expect(eintraege.map((e) => e.action)).toEqual(
      expect.arrayContaining([
        "user.created",
        "user.password-reset",
        "user.password-changed",
        "user.password-reset-email",
      ]),
    );
    const roh = JSON.stringify(eintraege);
    erwarteKeinKlartext(roh, "Prüfprotokoll");
    // Das Protokoll ist kein zweiter Kennwortspeicher: auch Salz und Hash stehen nicht darin.
    const anna = await users.findById(annaId);
    expect(anna).toBeDefined();
    expect(roh).not.toContain(anna?.passwordSalt);
    expect(roh).not.toContain(anna?.passwordHash);
  });

  it("ein SSO-Konto ohne Passwort (leere Felder) lässt keine Passwortanmeldung zu", async () => {
    // `loginWithOidc` ist der einzige Anlageweg ohne Salt+Hash: er legt leere Felder ab. Das darf
    // kein Schlupfloch sein — weder ein leeres noch ein beliebiges Passwort passt dagegen.
    expect(await verifyPassword("", "", "")).toBe(false);
    expect(await verifyPassword("irgendwas", "", "")).toBe(false);
  });
});

describe("NFR-SEC-01 · kein Klartext im Log — an den echten Routen", () => {
  it("alle Kennwortwege samt Fehlversuch: kein Passwort im Log, auch auf `trace`", async () => {
    const stuecke: string[] = [];
    const postfach: string[] = [];
    const app = buildApp(
      {
        ...buildServices(),
        mailer: {
          send: async (nachricht: { text: string }) => {
            postfach.push(nachricht.text);
          },
        },
      },
      {
        log: {
          senke: {
            write(zeile: string): void {
              stuecke.push(zeile);
            },
          },
          stufe: "trace",
        },
      },
    );
    const post = (url: string, payload: Record<string, unknown>, token?: string) =>
      app.inject({
        method: "POST",
        url,
        payload,
        ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
      });

    const status = async (url: string, payload: Record<string, unknown>, token?: string) =>
      (await post(url, payload, token)).statusCode;

    const admin = { name: "Admin", email: "admin@x.de", password: PW_ADMIN };
    expect(await status("/api/auth/register", admin)).toBe(201);
    const adminLogin = await post("/api/auth/login", { email: admin.email, password: PW_ADMIN });
    const adminToken = String(adminLogin.json().token);

    const anna = { name: "Anna", email: "anna@x.de", password: PW_REGISTRIERT };
    const annaAnlage = await post("/api/auth/register", anna);
    expect(annaAnlage.statusCode).toBe(201);
    const annaId = String(annaAnlage.json().id);
    expect(await status(`/api/auth/users/${annaId}/approve`, {}, adminToken)).toBe(200);
    const adminReset = { password: PW_ADMIN_RESET };
    expect(await status(`/api/auth/users/${annaId}/reset`, adminReset, adminToken)).toBe(204);

    const nachAdminReset = { email: anna.email, password: PW_ADMIN_RESET };
    const annaLogin = await post("/api/auth/login", nachAdminReset);
    expect(annaLogin.statusCode).toBe(200);
    const aenderung = { oldPassword: PW_ADMIN_RESET, newPassword: PW_SELBST };
    const annaToken = String(annaLogin.json().token);
    expect(await status("/api/auth/password", aenderung, annaToken)).toBe(204);

    expect(await status("/api/auth/forgot", { email: anna.email })).toBe(204);
    const resetToken = /token=([0-9a-f]+)/.exec(postfach.join("\n"))?.[1];
    expect(resetToken, "keine Reset-Mail mit Token erhalten").toBeDefined();
    const einloesung = { token: resetToken, newPassword: PW_MAIL_RESET };
    expect(await status("/api/auth/reset", einloesung)).toBe(204);

    // Auch der Fehlerweg darf das Eingegebene nicht protokollieren.
    const falsch = { email: anna.email, password: PW_REGISTRIERT };
    expect(await status("/api/auth/login", falsch)).toBe(401);
    const richtig = { email: anna.email, password: PW_MAIL_RESET };
    expect(await status("/api/auth/login", richtig)).toBe(200);
    await app.close();

    const log = stuecke.join("");
    // Kalibrierung: das Log hat wirklich mitgeschrieben — ein leerer Puffer bewiese nichts.
    expect(log).toContain("/api/auth/login");
    expect(log).toContain("/api/auth/password");
    erwarteKeinKlartext(log, "Log");
  });
});
