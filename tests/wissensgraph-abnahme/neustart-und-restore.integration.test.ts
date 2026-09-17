// ================================================================================================
// JOB 4155 · WG-LUECKEN — L6 (G2) UND L7 (G9): DIE BEZIEHUNG ÜBERLEBT NEUSTART UND WIEDERANLAUF.
// ================================================================================================
//
// DIE LEHRE, DIE DIESE DATEI FORMT (JOB 4141 R1, wörtlich): „Ein `bestand`-Feld zählt erst als
// Nachweis, wenn seine Vorher-/Nachher-Werte tatsächlich VERGLICHEN werden." Ein Test, der nach
// dem Neustart eine Zahl VORZEIGT, belegt nichts — er belegt erst dann etwas, wenn dieselbe Zahl
// vorher erhoben und danach dagegen gehalten wurde. Beide Fälle hier tun genau das, und beide
// vergleichen ausserdem den INHALT, nicht nur die Menge: eine gleiche Zeilenzahl hätte jede
// verfälschte Beziehung durchgelassen.
//
//   L6 (G2) INSTANZWECHSEL · Die Beziehung wird über den ECHTEN HTTP-Weg gesetzt. Danach entsteht
//                        eine ZWEITE, vollständig eigene Anwendung auf derselben Datenbank —
//                        eigener Pool, eigene Dienste, eigene Fastify-Instanz. Sie teilt mit der
//                        ersten NICHTS ausser der Ablage, und das schliesst den InMemory-Schein
//                        aus: ein `Map`-Bestand wäre hier leer.
//
//                        WAS DIESER FALL NICHT IST, und er hat es in Runde 2 zu stark behauptet:
//                        ein PROZESSNEUSTART. BEN hat es benannt („belegt Persistenz zwischen
//                        Instanzen, keinen echten Serverprozess-Neustart"), die Steuerung hat es
//                        übernommen („Instanzwechsel nicht als Prozessneustart ausgeben",
//                        HINWEIS-Nachtrag 17.09.). Beide Anwendungen laufen im SELBEN Node-Prozess;
//                        was hier gemessen wird, ist die Unabhängigkeit von jedem Zustand IN der
//                        Anwendung, nicht das Überleben eines Prozessendes. Den echten Wiederanlauf
//                        aus einem beendeten Prozess fährt der Backupdrill
//                        (`tests/backup-drill/echter-wiederanlauf.integration.test.ts`); L7 unten
//                        geht mit Dump und Restore in eine FRISCHE Datenbank den härteren Weg.
//   L7 (G9) DUMP/RESTORE · `pg_dump` der Quelldatenbank, `pg_restore` in eine FRISCHE, LEERE
//                        Zieldatenbank, danach Vergleich. Verglichen werden KANTENZAHL UND
//                        KO-ZAHL gegen den Stand VOR dem Dump — und zusätzlich die Beziehung
//                        selbst, Feld für Feld. Keine Produktionswiederherstellung: beide
//                        Datenbanken sind Wegwerfnamen mit `test` im Namen und werden am Ende
//                        wieder entfernt.
//
// PRÜFGRENZE, EHRLICH GEMELDET: Diese Suite braucht eine echte PostgreSQL UND `pg_dump`/
// `pg_restore`/`psql` auf dem PATH. Fehlt etwas, wird der Grund SICHTBAR auf stderr gemeldet und
// der Fall übersprungen — ein STILLER Skip sähe aus wie ein bestandener Lauf, und das wäre hier
// die gefährlichste Antwort (Lehre JOB 4127 R2). Auf den Cloud-Prüfplätzen ist beides da
// (Steuerung, Nachtrag 15.09. 21:47); ein Skip zählt dort als ROT.
//
//     KLARWERK_PG_TEST_URL=postgres://user:pass@127.0.0.1:5432/klarwerk_test \
//       npx vitest run --config vitest.integration.config.ts \
//       tests/wissensgraph-abnahme/neustart-und-restore.integration.test.ts
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";

const JOB = "[KLARWERK] JOB 4155";
const PASSWORT = "Wiederanlauf-2026!";

interface Verbindung {
  host: string;
  port: string;
  user: string;
  passwort: string;
}

function werkzeugFehlt(name: string): boolean {
  return spawnSync("/bin/sh", ["-c", `command -v ${name} >/dev/null 2>&1`]).status !== 0;
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

const PG_SCHEMA = "postgresql:";

/**
 * Die Wegwerf-URL. Dieselbe Sicherung wie in `tests/backup-drill/echter-wiederanlauf`: ein Name
 * ohne `test` führt zu KEINER Verbindung — diese Suite legt Datenbanken an und wirft sie weg.
 */
function pgUrl(v: Verbindung, datenbank: string): string {
  if (!datenbank.toLowerCase().includes("test")) {
    throw new Error(`${JOB}: „${datenbank}" trägt kein „test" im Namen — keine Verbindung.`);
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

/** Der vergleichbare Abdruck EINER Beziehung — Inhalt, nicht nur Menge. */
interface Kantenabdruck {
  id: string;
  quelle_id: string;
  ziel_id: string;
  art: string;
  richtung: string;
  urheber: string;
  status: string;
  version: number;
}

/** Zahlen UND Inhalt in einem Griff: genau das, was vorher und nachher verglichen wird. */
interface Bestandsabdruck {
  kanten: number;
  kos: number;
  beziehungen: Kantenabdruck[];
}

async function abdruck(pool: Pool): Promise<Bestandsabdruck> {
  const kanten = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM ko_kanten");
  const kos = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM kos");
  const zeilen = await pool.query<Kantenabdruck>(
    `SELECT id, quelle_id, ziel_id, art, richtung, urheber, status, version
       FROM ko_kanten ORDER BY id`,
  );
  return {
    kanten: Number(kanten.rows[0]?.n ?? "-1"),
    kos: Number(kos.rows[0]?.n ?? "-1"),
    beziehungen: zeilen.rows,
  };
}

describe("JOB 4155 · G2/G9 — Neustart und Wiederanlauf am echten Postgres", () => {
  let container: StartedTestContainer | undefined;
  let adminPool: Pool | undefined;
  let quellPool: Pool | undefined;
  let zielPool: Pool | undefined;
  let app: FastifyInstance | undefined;
  let zweiteApp: FastifyInstance | undefined;
  let zweiterPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let ordner = "";
  let verfuegbar = false;
  let grundDerAuslassung = "";

  const kennung = `${Date.now()}`.slice(-9);
  const quellDb = `klarwerk_wg_quelle_test_${kennung}`;
  const zielDb = `klarwerk_wg_ziel_test_${kennung}`;

  /** Die Kennungen des Nutzennachweises — L6 legt sie an, L7 misst auf demselben Bestand weiter. */
  let quelleId = "";
  let zielId = "";
  let token = "";
  /** Der Stand VOR dem Dump. `null` heisst: L6 ist nicht gelaufen, L7 hat nichts zu vergleichen. */
  let vorDemDump: Bestandsabdruck | null = null;

  const nichtVerfuegbar = (): boolean => !verfuegbar;

  beforeAll(async () => {
    const fehlend = ["pg_dump", "pg_restore", "psql"].filter(werkzeugFehlt);
    if (fehlend.length > 0) {
      grundDerAuslassung = `Werkzeuge fehlen auf dem PATH: ${fehlend.join(", ")}`;
      process.stderr.write(`${JOB} ÜBERSPRUNGEN: ${grundDerAuslassung}\n`);
      return;
    }
    let url = guardedLocalPgTestUrl();
    if (!url && process.env.KLARWERK_PG_TEST_URL) {
      // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — KEIN Container-Rückfall.
      grundDerAuslassung = "KLARWERK_PG_TEST_URL wurde von der Sicherung abgelehnt";
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
        grundDerAuslassung = "weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar";
        process.stderr.write(`${JOB} ÜBERSPRUNGEN: ${grundDerAuslassung}\n`);
        return;
      }
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      grundDerAuslassung = "die Test-URL nennt keinen Rechnernamen";
      process.stderr.write(`${JOB} ÜBERSPRUNGEN: ${grundDerAuslassung}\n`);
      return;
    }
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${quellDb}`);
    ordner = mkdtempSync(join(tmpdir(), "klarwerk-4155-"));
    verfuegbar = true;
  }, 240_000);

  afterAll(async () => {
    await app?.close();
    await zweiteApp?.close();
    await quellPool?.end();
    await zweiterPool?.end();
    await zielPool?.end();
    if (adminPool) {
      for (const db of [quellDb, zielDb]) {
        await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      }
      await adminPool.end();
    }
    await container?.stop();
    if (ordner) {
      rmSync(ordner, { recursive: true, force: true });
    }
  }, 120_000);

  // ==============================================================================================
  // L6 · G2 — DIE BEZIEHUNG ÜBERLEBT DEN WECHSEL DER ANWENDUNGSINSTANZ (nicht: den Prozess).
  // ==============================================================================================
  it("L6 · eine zweite, eigene Anwendung auf derselben Datenbank findet denselben Bestand", async (ctx) => {
    if (nichtVerfuegbar()) {
      ctx.skip();
      return;
    }
    const v = verbindung as Verbindung;
    quellPool = new Pool({ connectionString: pgUrl(v, quellDb) });
    await migrate(quellPool);

    const dienste = buildPgServices(quellPool);
    app = buildApp(dienste);
    await app.ready();

    const admin = await dienste.auth.register({
      name: "Wiederanlauf Admin",
      email: "wg-admin@wissensgraph.test",
      password: PASSWORT,
    });
    const anmeldung = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: admin.email, password: PASSWORT },
    });
    expect(anmeldung.statusCode, anmeldung.body).toBe(200);
    token = (anmeldung.json() as { token: string }).token;

    const a = await dienste.ko.create({
      title: "Wartungsplan Halle 2",
      statement: "Halle 2 wird monatlich gewartet.",
      type: "best_practice",
      category: "Betrieb",
      author: admin.id,
      tags: ["wartung"],
    });
    const b = await dienste.ko.create({
      title: "Filterwechsel dokumentiert",
      statement: "Der Filterwechsel wird protokolliert.",
      type: "best_practice",
      category: "Betrieb",
      author: admin.id,
      tags: ["wartung"],
    });
    quelleId = a.id;
    zielId = b.id;

    // DER STAND VORHER — erhoben, bevor irgendetwas gesetzt wird.
    const leer = await abdruck(quellPool);
    expect(leer.kanten, "die Ablage ist nicht leer — der Vergleich unten sagte dann nichts").toBe(
      0,
    );

    const gesetzt = await app.inject({
      method: "POST",
      url: `/api/kos/${quelleId}/beziehungen`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        zielId,
        art: "ergaenzt",
        richtung: "ungerichtet",
        beitragSchluessel: "g2-neustart",
        gesehen: { quelleVersion: a.version, zielVersion: b.version },
      },
    });
    expect([200, 201], gesetzt.body).toContain(gesetzt.statusCode);

    const vorher = await abdruck(quellPool);
    expect(vorher.kanten, "die Beziehung ist gar nicht in der Datenbank angekommen").toBe(1);
    expect(vorher.kos).toBe(2);

    // ------------------------------------------------------------------------------------------
    // DER INSTANZWECHSEL. Eigener Pool, eigene Dienste, eigene Fastify-Instanz — sie teilt mit der
    // ersten NICHTS ausser der Ablage. Ein `Map`-Bestand wäre hier leer. DERSELBE Node-Prozess:
    // das ist kein Prozessneustart und wird hier auch nicht als einer ausgegeben (s. Dateikopf).
    // ------------------------------------------------------------------------------------------
    zweiterPool = new Pool({ connectionString: pgUrl(v, quellDb) });
    const zweiteDienste = buildPgServices(zweiterPool);
    zweiteApp = buildApp(zweiteDienste);
    await zweiteApp.ready();

    const nachher = await abdruck(zweiterPool);
    // DER VERGLEICH, nicht das Vorzeigen: Zahl UND Inhalt, gegen den Stand von vorher.
    expect(nachher.kanten).toBe(vorher.kanten);
    expect(nachher.kos).toBe(vorher.kos);
    expect(nachher.beziehungen).toEqual(vorher.beziehungen);

    // Und sie ist über den LESEWEG der neuen Anwendung erreichbar, nicht nur als Zeile im Tabellen-
    // abdruck: die Anmeldung von vorhin gilt weiter (auch die Sitzung liegt in der Datenbank).
    const gelesen = await zweiteApp.inject({
      method: "GET",
      url: `/api/kos/${quelleId}/beziehungen`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(gelesen.statusCode, gelesen.body).toBe(200);
    const antwort = gelesen.json() as { total: number; kanten: { gegenstueck: { id: string } }[] };
    expect(antwort.total).toBe(1);
    expect(antwort.kanten[0]?.gegenstueck.id).toBe(zielId);

    vorDemDump = vorher;
  }, 240_000);

  // ==============================================================================================
  // L7 · G9 — DUMP UND RESTORE: KANTENZAHL UND KO-ZAHL SIND IDENTISCH ZUM STAND VOR DEM DUMP.
  // ==============================================================================================
  it("L7 · nach `pg_restore` in eine frische Datenbank stimmen Kantenzahl, KO-Zahl und Inhalt", async (ctx) => {
    if (nichtVerfuegbar()) {
      ctx.skip();
      return;
    }
    expect(vorDemDump, "L6 ist nicht gelaufen — L7 hätte nichts zu vergleichen").not.toBeNull();
    const v = verbindung as Verbindung;
    const vorher = vorDemDump as Bestandsabdruck;

    const umgebung: NodeJS.ProcessEnv = {
      ...process.env,
      PGHOST: v.host,
      PGPORT: v.port,
      PGUSER: v.user,
      PGPASSWORD: v.passwort,
    };
    const datei = join(ordner, "kanten.dump");

    // GLIED 1 — der Dump. Custom-Format, wie das Sicherungsskript des Hauses ihn erzeugt.
    const dump = spawnSync(
      "pg_dump",
      ["--format=custom", "--no-owner", "--no-privileges", "--file", datei, quellDb],
      { encoding: "utf8", env: umgebung, timeout: 300_000 },
    );
    expect(dump.status, `pg_dump: ${dump.stderr}`).toBe(0);

    // GLIED 2 — eine FRISCHE, LEERE Zieldatenbank. In dieselbe zurückzuspielen bewiese nichts.
    await (adminPool as Pool).query(`CREATE DATABASE ${zielDb}`);
    const restore = spawnSync("pg_restore", ["--no-owner", "--dbname", zielDb, datei], {
      encoding: "utf8",
      env: umgebung,
      timeout: 300_000,
    });
    expect(restore.status, `pg_restore: ${restore.stderr}`).toBe(0);

    // GLIED 3 — der Vergleich. Nicht „es sind Zeilen da", sondern: DIESELBEN wie vor dem Dump.
    zielPool = new Pool({ connectionString: pgUrl(v, zielDb) });
    const wiederhergestellt = await abdruck(zielPool);

    expect(wiederhergestellt.kanten, "die Kantenzahl weicht ab").toBe(vorher.kanten);
    expect(wiederhergestellt.kos, "die bestehenden Daten sind beschädigt").toBe(vorher.kos);
    // Und Feld für Feld dieselbe Beziehung — eine gleiche Zeilenzahl ist kein Inhaltsbeleg.
    expect(wiederhergestellt.beziehungen).toEqual(vorher.beziehungen);

    // KALIBRIERUNG: Der Vergleich oben wäre auch bei zwei leeren Beständen grün. Er ist es nicht,
    // weil hier wirklich etwas steht — ohne diese Zeile prüften die drei darüber nichts.
    expect(wiederhergestellt.kanten).toBeGreaterThan(0);
    expect(wiederhergestellt.beziehungen[0]?.status).toBe("aktiv");

    // Auch die Bindung des Wiederholschlüssels hat den Wiederanlauf überlebt — ohne sie wäre die
    // Idempotenzzusage nach einer Wiederherstellung weg, und genau dann wird sie gebraucht.
    const schluessel = await zielPool.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM ko_kanten_beitrag",
    );
    expect(Number(schluessel.rows[0]?.n ?? "0")).toBeGreaterThan(0);
  }, 300_000);
});
