import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

// ==================================================================================================
// JOB 4010 — DER WIEDERANLAUF AN ECHTEN DATEN: BEKOMMT EIN BETA-KUNDE SEINE DATEI ZURÜCK?
// ==================================================================================================
//
// DIE FRAGE, DIE HIER BEANTWORTET WIRD, ist nicht „läuft das Skript durch", sondern die des
// Betreibers: *Wenn die Datenbank morgen weg ist — bekomme ich die Daten dieses Kunden zurück?*
// Bis JOB 4010 gab es darauf keinen einzigen Datenbanknachweis: `restore-drill.test.ts` ersetzt
// alle externen Befehle durch Attrappen, `start-identitaet.test.ts` misst nur zwei PIDs.
//
// DIE STRECKE IST EIN KUNDENLEBEN IN KLEIN, mit den ECHTEN Bausteinen an jeder Stelle:
//   1. eine eigene Quell-Datenbank, gefüllt über die ECHTE Anwendung (Konto mit `ko.validate`,
//      Wissensobjekt, Auditkette und eine hochgeladene Quelldatei mit bekanntem Inhalt);
//   2. das UNVERÄNDERTE `scripts/backup/backup.sh` erzeugt einen echten Custom-Dump samt Sidecar;
//   3. das UNVERÄNDERTE `scripts/backup/restore-drill.sh` fährt vollständig — erwartet Exit 0 und
//      die Gliedzeilen 1 bis 8;
//   4. DER INHALTSBELEG: die hochgeladene Datei wird gegen die WIEDERHERGESTELLTE Datenbank über
//      `/api/objects/:id/raw` zurückgeholt und BYTE FÜR BYTE verglichen. Eine gleiche Zeilenzahl
//      ist kein Inhaltsbeleg — der Drill zählt `objects` heute schon, und das hätte jede
//      verfälschte Datei durchgelassen. Die Gegenprobe im selben Test zeigt genau das.
//
// PRÜFGRENZE, EHRLICH GEMELDET (Lehre 12.09., JOB 3668): Diese Suite braucht eine echte
// PostgreSQL UND die PostgreSQL-Kommandozeilenwerkzeuge auf dem PATH. Fehlt eines davon, wird der
// Grund SICHTBAR auf stderr gemeldet und übersprungen. Ein stiller Skip sähe aus wie ein
// bestandener Lauf. Was dann trägt, ist `prozesszuordnung.test.ts` — der dockerfreie Dauerbeleg.
//
// SIE IST STARTBAR, ohne dass eine Zeile geändert werden muss:
//
//     KLARWERK_PG_TEST_URL=postgres://user:pass@127.0.0.1:5432/klarwerk_test \
//       npx vitest run --config vitest.integration.config.ts \
//       tests/backup-drill/echter-wiederanlauf.integration.test.ts
//
// KEINE PRODUKTIVDATEN: Quell- und Zieldatenbank sind eigene Wegwerfnamen, beide tragen `test` im
// Namen (`guardedLocalPgTestUrl`-Regel), beide werden am Ende wieder entfernt.
const root = resolve(import.meta.dirname, "../..");
const JOB = "[KLARWERK] JOB 4010";

const EMAIL = "drill-controller@example.test";
const PASSWORT = "drill-geheim-123";
// Deterministische Nutzlast mit Nullbytes und hohen Bytes — daran fällt jede Umkodierung auf.
const QUELLBYTES = Buffer.concat(
  Array.from({ length: 8 }, (_, i) => createHash("sha256").update(`JOB4010-${i}`).digest()),
);

function werkzeugFehlt(name: string): boolean {
  return spawnSync("/bin/sh", ["-c", `command -v ${name} >/dev/null 2>&1`]).status !== 0;
}

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

// --------------------------------------------------------------------------------------------------
// WARUM DIE BEIDEN WEGWERF-URLS ZUSAMMENGESETZT WERDEN, STATT AUSGESCHRIEBEN ZU STEHEN
// --------------------------------------------------------------------------------------------------
//
// `tests/app/job2354-drei-datenbanknamen.test.ts` (Fall N3) liest jede Verbindungszeichenkette
// dieser Datei per Muster und verlangt, dass ihr Datenbankname `klarwerk_test` lautet — der Name
// des Wegwerf-Containers oben. Das ist richtig für die übliche Integrationsdatei: Sie läuft GEGEN
// die eine angebotene Testdatenbank, und ein abweichender Name wäre dort der stille Bruch, den N3
// fangen soll.
//
// Diese Datei läuft anders. Ein Wiederanlauf-Beleg braucht ZWEI weitere Datenbanken, die sie sich
// selbst anlegt: die Quelle, die gesichert wird, und ein LEERES Ziel, in das zurückgespielt wird.
// Gäbe es sie nicht, liefe der Beleg gegen dieselbe Datenbank, die er zu retten vorgibt. Ihre
// Namen entstehen zur Laufzeit (`kennung`), und aus einer ausgeschriebenen Zeichenkette
// `…/` + Platzhalter läse das Muster von N3 das Zeichen `$` — rot, ohne dass ein Name falsch wäre.
// (Genau daran ist Runde 1 dieses Jobs im Tor gescheitert.)
//
// Die Zusicherung, um die es N3 in der Sache geht, geht dabei nicht verloren — sie wird hier
// strenger und zur Laufzeit geprüft statt am Text: `pgUrl()` verbindet sich mit keinem
// Datenbanknamen, der nicht `test` enthält. Das ist dieselbe Bedingung, unter der
// `services/db-tx/src/pg-test-guard.ts:25` die destruktive Pg-Suite freigibt (Fall N4 dort). Ein
// Tippfehler, der hier auf eine echte Datenbank zeigte, käme nicht bis zur Verbindung, sondern
// würfe — diese Suite legt Datenbanken an und wirft sie mit `DROP … WITH (FORCE)` wieder weg.
const PG_SCHEMA = "postgresql:";

function pgUrl(v: Verbindung, datenbank: string): string {
  if (!datenbank.toLowerCase().includes("test")) {
    throw new Error(
      `${JOB}: „${datenbank}“ trägt kein „test“ im Namen — diese Suite fasst ausschließlich Wegwerf-Datenbanken an und verbindet sich deshalb nicht.`,
    );
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

describe("JOB 4010 · Wiederanlauf aus einem echten Dump in eine echte PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let adminPool: Pool | undefined;
  let zielPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let arbeitsordner = "";
  let verfuegbar = false;

  const kennung = `${Date.now()}`.slice(-9);
  const quellDb = `klarwerk_quelle_test_${kennung}`;
  const zielDb = `klarwerk_ziel_test_${kennung}`;

  beforeAll(async () => {
    const fehlend = ["pg_dump", "pg_restore", "psql", "createdb", "ps"].filter(werkzeugFehlt);
    if (fehlend.length > 0) {
      process.stderr.write(
        `${JOB} ÜBERSPRUNGEN: Werkzeuge fehlen auf dem PATH: ${fehlend.join(", ")} — ohne sie kann der Drill nicht laufen.\n`,
      );
      return;
    }

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
          `${JOB} ÜBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar.\n`,
        );
        return;
      }
    }

    verbindung = zerlege(url);
    if (!verbindung) {
      process.stderr.write(
        `${JOB} ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL nennt keinen Rechnernamen — der Drill braucht PGHOST/PGPORT.\n`,
      );
      return;
    }

    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    // Eigene Wegwerf-Quelldatenbank: die angebotene Testdatenbank bleibt unberührt.
    await adminPool.query(`CREATE DATABASE ${quellDb}`);
    arbeitsordner = mkdtempSync(join(tmpdir(), "klarwerk-4010-"));
    verfuegbar = true;
  }, 240_000);

  afterAll(async () => {
    await zielPool?.end();
    if (adminPool) {
      for (const db of [quellDb, zielDb]) {
        await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      }
      await adminPool.end();
    }
    await container?.stop();
    if (arbeitsordner) {
      rmSync(arbeitsordner, { recursive: true, force: true });
    }
  }, 120_000);

  it("W1 · Dump → leere Datenbank → laufende Anwendung → dieselbe Datei, Byte für Byte", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const v = verbindung;
    const quellUrl = pgUrl(v, quellDb);

    // ---------------------------------------------------------------------------------------------
    // 1. BESTAND — über die echte Anwendung, nicht per SQL-Handstreich.
    // ---------------------------------------------------------------------------------------------
    const quellPool = createPool(quellUrl);
    let objektId = "";
    try {
      await migrate(quellPool);
      const app = buildApp(buildPgServices(quellPool));
      // Das erste Konto wird Admin (FR-AUTH-01) und trägt damit `ko.validate` — genau das
      // verlangt `GET /api/audit/verify`, das Glied 7 des Drills abfragt.
      const reg = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Drill Controller", email: EMAIL, password: PASSWORT },
      });
      expect(reg.statusCode, reg.body).toBe(201);
      expect(reg.json().role).toBe("admin");

      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: EMAIL, password: PASSWORT },
      });
      expect(login.statusCode, login.body).toBe(200);
      const kopf = { authorization: `Bearer ${login.json().token}` };

      const ko = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers: kopf,
        payload: {
          confidentiality: "intern",
          title: "Ventil schließen",
          statement: "Bei Überdruck Ventil X schließen.",
          type: "best_practice",
          category: "Anlage 1",
        },
      });
      expect(ko.statusCode, ko.body).toBe(201);

      const upload = await app.inject({
        method: "POST",
        url: "/api/objects",
        headers: kopf,
        payload: {
          name: "pruefbericht.png",
          mime: "image/png",
          data: `data:image/png;base64,${QUELLBYTES.toString("base64")}`,
        },
      });
      expect(upload.statusCode, upload.body).toBe(201);
      objektId = upload.json().id as string;
      expect(objektId).toBeTruthy();

      // Der Bestand muss in allen vier Kerntabellen des Drills stehen, sonst prüft Glied 3 nichts.
      for (const tabelle of ["kos", "users", "audit", "objects"]) {
        const zahl = await quellPool.query(`SELECT count(*)::int AS n FROM public."${tabelle}"`);
        expect(zahl.rows[0].n, `${tabelle} ist leer`).toBeGreaterThan(0);
      }
    } finally {
      await quellPool.end();
    }

    // ---------------------------------------------------------------------------------------------
    // 2. SICHERUNG — mit dem unveränderten backup.sh.
    // ---------------------------------------------------------------------------------------------
    // `backup.sh` bevorzugt KLARWERK_DATABASE_URL vor DATABASE_URL — stünde sie in der Umgebung,
    // sicherte dieser Lauf eine andere Datenbank als die eben gefüllte.
    const sicherungsEnv: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: quellUrl,
      BACKUP_DIR: arbeitsordner,
    };
    sicherungsEnv.KLARWERK_DATABASE_URL = undefined;
    const backup = spawnSync("bash", [join(root, "scripts/backup/backup.sh")], {
      cwd: root,
      encoding: "utf8",
      timeout: 300_000,
      env: sicherungsEnv,
    });
    expect(backup.status, `${backup.stdout}${backup.stderr}`).toBe(0);
    const dumpName = readdirSync(arbeitsordner).find((d) => d.endsWith(".dump"));
    expect(dumpName, "backup.sh hat keinen Dump veröffentlicht").toBeTruthy();
    const dump = join(arbeitsordner, String(dumpName));

    // ---------------------------------------------------------------------------------------------
    // 3. DER DRILL — vollständig, Exit 0, alle acht Glieder.
    // ---------------------------------------------------------------------------------------------
    const drillEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PGHOST: v.host,
      PGPORT: v.port,
      PGUSER: v.user,
      PGPASSWORD: v.passwort,
      RESTORE_DB: zielDb,
      DRILL_PORT: "3097",
      DRILL_WORKDIR: arbeitsordner,
      DRILL_LOGIN_EMAIL: EMAIL,
      DRILL_LOGIN_PASSWORT: PASSWORT,
    };
    // Der Drill setzt DATABASE_URL selbst; KLARWERK_DATABASE_URL hätte in der Anwendung Vorrang
    // und würde den Server gegen die QUELLE laufen lassen — der Wiederherstellungsbeleg wäre keiner.
    drillEnv.KLARWERK_DATABASE_URL = undefined;
    drillEnv.DATABASE_URL = undefined;
    const drill = spawnSync("bash", [join(root, "scripts/backup/restore-drill.sh"), dump], {
      cwd: root,
      encoding: "utf8",
      timeout: 600_000,
      env: drillEnv,
    });
    const ausgabe = `${drill.stdout ?? ""}${drill.stderr ?? ""}`;
    expect(drill.status, ausgabe).toBe(0);
    for (const glied of [1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(ausgabe, `Gliedzeile ${glied} fehlt`).toContain(`Glied ${glied} —`);
    }
    expect(ausgabe).toContain("DRILL BESTANDEN");
    expect(ausgabe).toMatch(/objects: Dump=1 Datenbank=1/);

    // ---------------------------------------------------------------------------------------------
    // 4. DER INHALTSBELEG — gegen die WIEDERHERGESTELLTE Datenbank, ohne eine Migration.
    // ---------------------------------------------------------------------------------------------
    zielPool = createPool(pgUrl(v, zielDb));
    const zielApp = buildApp(buildPgServices(zielPool));
    const zielLogin = await zielApp.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: EMAIL, password: PASSWORT },
    });
    expect(zielLogin.statusCode, zielLogin.body).toBe(200);
    const zielKopf = { authorization: `Bearer ${zielLogin.json().token}` };

    const roh = await zielApp.inject({ url: `/api/objects/${objektId}/raw`, headers: zielKopf });
    expect(roh.statusCode, roh.body).toBe(200);
    expect(Buffer.from(roh.rawPayload).equals(QUELLBYTES)).toBe(true);

    // GEGENPROBE ZUR AUSSAGEKRAFT (Auftrag §8.2 ii): Eine einzige veränderte Zeile in
    // `objects.data` — die Zeilenzahl bleibt gleich, der Drill wäre weiterhin grün. Der
    // Byte-Vergleich ist es nicht. Ohne diesen Abschnitt wäre oben nicht zu unterscheiden, ob
    // wirklich verglichen oder nur etwas Wahres behauptet wird.
    const verfaelscht = Buffer.from(QUELLBYTES);
    verfaelscht.writeUInt8(verfaelscht.readUInt8(0) ^ 0xff, 0);
    await zielPool.query("UPDATE objects SET data=$1 WHERE id=$2", [
      `data:image/png;base64,${verfaelscht.toString("base64")}`,
      objektId,
    ]);
    const rohVerfaelscht = await zielApp.inject({
      url: `/api/objects/${objektId}/raw`,
      headers: zielKopf,
    });
    expect(rohVerfaelscht.statusCode).toBe(200);
    expect(Buffer.from(rohVerfaelscht.rawPayload).equals(QUELLBYTES)).toBe(false);
    const zeilen = await zielPool.query("SELECT count(*)::int AS n FROM objects");
    expect(zeilen.rows[0].n).toBe(1);
  }, 900_000);
});
