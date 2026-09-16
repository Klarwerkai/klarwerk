// ==================================================================================================
// JOB 4227 — DER ECHTE WIEDERHERSTELLUNGSBELEG FÜR BEIDE DUMPS EINES PARALLELLAUFS.
// ==================================================================================================
//
// DIE FRAGE, die `tests/backup-parallel/zwei-laeufe-zerstoeren-einander-nicht.test.ts` NICHT
// beantwortet: dort sind `pg_dump`/`pg_restore` Attrappen. Sie belegen, was das Skript ENTSCHEIDET
// — welchen Namen es reserviert, was es veröffentlicht, was es liegen lässt. Ob die beiden Dateien,
// die dabei entstehen, sich in eine echte Datenbank zurückspielen lassen, und ob dann wirklich
// JEDER Dump den Bestand SEINES Laufs trägt, sagen sie nicht.
//
// DIESE DATEI MISST GENAU DAS:
//   1. zwei eigene Wegwerf-Quelldatenbanken auf einer echten PostgreSQL 16, je über die ECHTE
//      Anwendung gefüllt — jede mit einem Wissensobjekt, dessen Titel nur in IHR vorkommt;
//   2. ZWEI GLEICHZEITIGE, echte `backup.sh`-Prozesse in EIN gemeinsames Zielverzeichnis, mit
//      derselben namensbildenden Sekunde (ein `date`-Vorschalter im PATH nagelt sie fest — das
//      Skript selbst bleibt unverändert);
//   3. für JEDEN der beiden Dumps der UNVERÄNDERTE Restore-Weg aus JOB 4097
//      (`scripts/backup/restore-drill.sh`) in eine EIGENE, LEERE Zieldatenbank;
//   4. und danach der Inhaltsbeleg: in jeder wiederhergestellten Datenbank steht der Titel des
//      EIGENEN Laufs — und der des anderen steht NICHT darin.
//
// KEINE PRODUKTIVDATEN: alle vier Datenbanken sind Wegwerfnamen mit `test` im Namen und werden am
// Ende wieder entfernt. Kein Compose, kein Hostsocket — entweder eine ausdrücklich angebotene
// Testinstanz (`KLARWERK_PG_TEST_URL`) oder ein eigener `postgres:16-alpine`-Container.
//
// PRÜFGRENZE, EHRLICH GEMELDET: Diese Suite braucht eine echte PostgreSQL 16 UND die
// PostgreSQL-Kommandozeilenwerkzeuge auf dem PATH. Fehlt eines davon, wird der Grund SICHTBAR auf
// stderr gemeldet und der Fall übersprungen. Ein stiller Skip sähe aus wie ein bestandener Lauf.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const root = resolve(import.meta.dirname, "../..");
const JOB = "[KLARWERK] JOB 4227";

/** Die Sekunde, die beide Läufe teilen. Ohne sie wäre die Namenskollision Glückssache. */
const STEMPEL = "20260916T044455Z";

const KONTEN = {
  a: { email: "parallel-a@example.test", passwort: "parallel-a-geheim-123" },
  b: { email: "parallel-b@example.test", passwort: "parallel-b-geheim-123" },
} as const;

/** Der Titel, an dem sich die Bestände der beiden Läufe unterscheiden lassen. */
const TITEL = {
  a: "JOB4227 Bestand von Lauf A",
  b: "JOB4227 Bestand von Lauf B",
} as const;

type Rolle = "a" | "b";

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
    if (!u.hostname) return undefined;
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

// Dieselbe Doktrin wie in `tests/backup-drill/echter-wiederanlauf.integration.test.ts`: die URLs
// werden zusammengesetzt, und `pgUrl` verbindet sich mit keinem Datenbanknamen ohne `test` darin.
// Diese Suite legt Datenbanken an und wirft sie mit `DROP … WITH (FORCE)` wieder weg.
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

describe("JOB 4227 · beide Dumps eines Parallellaufs, je in eine eigene leere Datenbank", () => {
  let container: StartedTestContainer | undefined;
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let arbeitsordner = "";
  let verfuegbar = false;

  const kennung = `${Date.now()}`.slice(-9);
  const quellDb: Record<Rolle, string> = {
    a: `klarwerk_quelle_a_test_${kennung}`,
    b: `klarwerk_quelle_b_test_${kennung}`,
  };
  const zielDb: Record<Rolle, string> = {
    a: `klarwerk_ziel_a_test_${kennung}`,
    b: `klarwerk_ziel_b_test_${kennung}`,
  };

  beforeAll(async () => {
    const fehlend = ["pg_dump", "pg_restore", "psql", "createdb", "ps"].filter(werkzeugFehlt);
    if (fehlend.length > 0) {
      process.stderr.write(
        `${JOB} ÜBERSPRUNGEN: Werkzeuge fehlen auf dem PATH: ${fehlend.join(", ")} — ohne sie kann der Drill nicht laufen.\n`,
      );
      return;
    }
    let url = guardedLocalPgTestUrl();
    if (!url && process.env.KLARWERK_PG_TEST_URL) return;
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
      process.stderr.write(`${JOB} ÜBERSPRUNGEN: die Test-URL nennt keinen Rechnernamen.\n`);
      return;
    }
    adminPool = new Pool({ connectionString: url });
    // WELCHE PostgreSQL das hier wirklich war, wird GEMESSEN und ausgegeben — nicht angenommen.
    // Ohne diese Zeile stünde in einem Bericht „PostgreSQL 16", und belegt wäre nur „irgendeine".
    const fassung = await adminPool.query("SHOW server_version");
    process.stderr.write(`${JOB} PostgreSQL-Fassung: ${String(fassung.rows[0].server_version)}\n`);
    for (const rolle of ["a", "b"] as const) {
      await adminPool.query(`CREATE DATABASE ${quellDb[rolle]}`);
    }
    arbeitsordner = mkdtempSync(join(tmpdir(), "klarwerk-4227-"));
    verfuegbar = true;
  }, 300_000);

  afterAll(async () => {
    if (adminPool) {
      for (const db of [quellDb.a, quellDb.b, zielDb.a, zielDb.b]) {
        await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      }
      await adminPool.end();
    }
    await container?.stop();
    if (arbeitsordner) rmSync(arbeitsordner, { recursive: true, force: true });
  }, 180_000);

  /** Füllt eine Quelldatenbank über die ECHTE Anwendung — ein Konto und ein Wissensobjekt. */
  async function fuelle(v: Verbindung, rolle: Rolle): Promise<void> {
    const pool = createPool(pgUrl(v, quellDb[rolle]));
    try {
      await migrate(pool);
      const app = buildApp(buildPgServices(pool));
      const konto = KONTEN[rolle];
      // Das erste Konto wird Admin (FR-AUTH-01) und trägt `ko.validate` — das braucht der Drill.
      const reg = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: `Parallel ${rolle}`, email: konto.email, password: konto.passwort },
      });
      expect(reg.statusCode, reg.body).toBe(201);
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: konto.email, password: konto.passwort },
      });
      expect(login.statusCode, login.body).toBe(200);
      const kopf = { authorization: `Bearer ${login.json().token}` };
      const ko = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers: kopf,
        payload: {
          confidentiality: "intern",
          title: TITEL[rolle],
          statement: `Dieser Satz steht nur im Bestand von Lauf ${rolle.toUpperCase()}.`,
          type: "best_practice",
          category: "Anlage 1",
        },
      });
      expect(ko.statusCode, ko.body).toBe(201);
    } finally {
      await pool.end();
    }
  }

  /**
   * Ein `date`-Vorschalter im PATH. Er nagelt die namensbildende Sekunde fest, damit beide Läufe
   * WIRKLICH auf denselben Endnamen zielen. Das Skript selbst bleibt unverändert — es ruft `date`
   * auf, wie es das immer tut, und findet diesen hier zuerst.
   */
  function baueDateVorschalter(): string {
    const ordner = join(arbeitsordner, "vorschalter");
    mkdirSync(ordner, { recursive: true });
    writeFileSync(join(ordner, "date"), `#!/bin/sh\nprintf '%s\\n' "${STEMPEL}"\n`, {
      mode: 0o755,
    });
    return ordner;
  }

  /** Ein echter, nebenläufiger `backup.sh`-Prozess gegen die Quelldatenbank dieser Rolle. */
  function starteSicherung(
    v: Verbindung,
    rolle: Rolle,
    ziel: string,
    vorschalter: string,
  ): Promise<{ code: number | null; ausgabe: string; name: string | undefined }> {
    const umgebung: NodeJS.ProcessEnv = {
      ...process.env,
      PATH: `${vorschalter}:${process.env.PATH ?? ""}`,
      DATABASE_URL: pgUrl(v, quellDb[rolle]),
      BACKUP_DIR: ziel,
    };
    umgebung.KLARWERK_DATABASE_URL = undefined;
    const kind: ChildProcess = spawn("bash", [join(root, "scripts/backup/backup.sh")], {
      cwd: root,
      env: umgebung,
    });
    return new Promise((fertig, scheitern) => {
      let ausgabe = "";
      kind.stdout?.on("data", (s: Buffer) => {
        ausgabe += s.toString("utf8");
      });
      kind.stderr?.on("data", (s: Buffer) => {
        ausgabe += s.toString("utf8");
      });
      kind.on("error", scheitern);
      kind.on("close", (code) => {
        const zeile = ausgabe.split("\n").find((z) => z.startsWith("[backup] Dump nach: "));
        const pfad = zeile?.slice("[backup] Dump nach: ".length).trim();
        fertig({ code, ausgabe, name: pfad?.split("/").pop() });
      });
    });
  }

  /** Der UNVERÄNDERTE Drill aus JOB 4097, gegen ein eigenes leeres Ziel. */
  function fahreDrill(v: Verbindung, dump: string, ziel: string, rolle: Rolle, port: string) {
    const drillEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PGHOST: v.host,
      PGPORT: v.port,
      PGUSER: v.user,
      PGPASSWORD: v.passwort,
      RESTORE_DB: ziel,
      DRILL_PORT: port,
      DRILL_WORKDIR: dump.slice(0, dump.lastIndexOf("/")),
      DRILL_LOGIN_EMAIL: KONTEN[rolle].email,
      DRILL_LOGIN_PASSWORT: KONTEN[rolle].passwort,
    };
    drillEnv.KLARWERK_DATABASE_URL = undefined;
    drillEnv.DATABASE_URL = undefined;
    const drill = spawnSync("bash", [join(root, "scripts/backup/restore-drill.sh"), dump], {
      cwd: root,
      encoding: "utf8",
      timeout: 900_000,
      env: drillEnv,
    });
    return { status: drill.status, ausgabe: `${drill.stdout ?? ""}${drill.stderr ?? ""}` };
  }

  it("R1 · zwei gleichzeitige Läufe, zwei Dumps — und jeder trägt den Bestand SEINES Laufs", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const v = verbindung;
    await fuelle(v, "a");
    await fuelle(v, "b");

    // ----------------------------------------------------------------------------------------
    // 1. ZWEI ECHTE, GLEICHZEITIGE SICHERUNGEN IN EIN VERZEICHNIS, gleiche Sekunde.
    // ----------------------------------------------------------------------------------------
    const ziel = join(arbeitsordner, "backups");
    mkdirSync(ziel, { recursive: true });
    const vorschalter = baueDateVorschalter();
    const [laufA, laufB] = await Promise.all([
      starteSicherung(v, "a", ziel, vorschalter),
      starteSicherung(v, "b", ziel, vorschalter),
    ]);
    expect(laufA.code, laufA.ausgabe).toBe(0);
    expect(laufB.code, laufB.ausgabe).toBe(0);
    expect(laufA.name, laufA.ausgabe).toBeDefined();
    expect(laufB.name, laufB.ausgabe).toBeDefined();
    // Zwei Läufe, zwei VERSCHIEDENE reservierte Namen — genau die Zusage dieses Auftrags.
    expect(laufA.name, `${laufA.ausgabe}\n---\n${laufB.ausgabe}`).not.toBe(laufB.name);

    const dumps = readdirSync(ziel)
      .filter((n) => n.endsWith(".dump"))
      .sort();
    expect(dumps.length, readdirSync(ziel).join(" ")).toBe(2);
    // Keine liegen gebliebene Reservierung, kein Arbeitsstand.
    expect(readdirSync(ziel).filter((n) => n.endsWith(".reserviert"))).toEqual([]);
    expect(readdirSync(ziel).filter((n) => n.endsWith(".partial"))).toEqual([]);

    // Jeder Sidecar nennt SEINEN eigenen Endnamen — kein Paar zeigt auf das andere.
    for (const name of dumps) {
      const sidecar = readFileSync(join(ziel, `${name}.sha256`), "utf8");
      expect(sidecar, `${name}: ${sidecar}`).toMatch(new RegExp(`^[0-9a-f]{64}  ${name}\\n$`));
    }

    // ----------------------------------------------------------------------------------------
    // 2. JEDER DUMP IN EINE EIGENE, LEERE DATENBANK — über den unveränderten Drill aus 4097.
    // ----------------------------------------------------------------------------------------
    const zuordnung: ReadonlyArray<readonly [Rolle, string, string]> = [
      ["a", String(laufA.name), "3227"],
      ["b", String(laufB.name), "3228"],
    ];
    for (const [rolle, name, port] of zuordnung) {
      const { status, ausgabe } = fahreDrill(v, join(ziel, name), zielDb[rolle], rolle, port);
      expect(status, `Drill für Lauf ${rolle} (${name}):\n${ausgabe}`).toBe(0);
      expect(ausgabe, `Drill für Lauf ${rolle}`).toContain("DRILL BESTANDEN");
    }

    // ----------------------------------------------------------------------------------------
    // 3. DER INHALTSBELEG. Gleiche Zeilenzahlen sind keiner: beide Bestände haben je EIN
    //    Wissensobjekt. Nur der TITEL sagt, welcher Lauf hier wiederhergestellt wurde.
    // ----------------------------------------------------------------------------------------
    for (const rolle of ["a", "b"] as const) {
      const andere: Rolle = rolle === "a" ? "b" : "a";
      const pool = new Pool({ connectionString: pgUrl(v, zielDb[rolle]) });
      try {
        const eigene = await pool.query(
          "SELECT count(*)::int AS n FROM public.kos WHERE data->>'title' = $1",
          [TITEL[rolle]],
        );
        const fremde = await pool.query(
          "SELECT count(*)::int AS n FROM public.kos WHERE data->>'title' = $1",
          [TITEL[andere]],
        );
        expect(eigene.rows[0].n, `Lauf ${rolle}: der eigene Bestand fehlt`).toBe(1);
        expect(fremde.rows[0].n, `Lauf ${rolle}: fremder Bestand im eigenen Dump`).toBe(0);
      } finally {
        await pool.end();
      }
    }
  }, 1_800_000);
});
