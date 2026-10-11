import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  ANHANG,
  type Bestand,
  KENNWORT,
  KONTEN,
  NORD_TITEL,
  NORD_V1,
  NORD_V2,
  type Paket,
  type Wer,
  anmelden,
  legeFiktivenBestand,
  paketVon,
  vergleichsstand,
} from "./bestand";

// ==================================================================================================
// produkt:20261010:poc-wiederherstellung-export · PV-01-02 / 03 / 05 / 06 / 07 — DIE ZUSAMMENHÄNGENDE
// RESTORE-PROBE AN ECHTER POSTGRESQL.
// ==================================================================================================
//
// ADMIN-13 (`tests/backup-drill/echter-wiederanlauf.integration.test.ts`) belegt den Drill an einem
// kleinen Bestand: Pflichttabellen, Wiederanlauf, ein Objekt mit Anhang, Audit, eine Beziehung, zwei
// Rollen. Diese Probe wiederholt das NICHT, sie ergänzt, was dort fehlt — am fiktiven,
// zusammenhängenden Bestand aus `bestand.ts`:
//
//   R1  Versionen und Zuordnungen: jede Fassung jedes Beitrags (Aussage, Stufe), aktuelle Fassung,
//       Status, Space, Verantwortung, Konten mit Rollen, Anhangsbytes — Quelle gegen Ziel.
//       Persönliche Assistenzdaten: Profil (Name, Avatar) und Gespräch kommen dem RICHTIGEN Konto
//       zurück, ein anderes Konto erreicht sie nicht. Das Wissenspaket JEDER Rolle ist nach dem
//       Restore inhaltsgleich (Beiträge, Fassungen, Anhangs-Prüfsummen, Quellen, Beziehungen,
//       Rechte). Die Quelle bleibt unverändert. Gemessen wird die Dauer des Restore-Drills.
//       Die Verwaltungsauskunft am Ziel weist den Sicherungsumfang mit Beleg aus.
//   R2  Beschädigte (Prüfsumme passt nicht) und unvollständige (Assistenzprofile ohne Daten)
//       Sicherung: nachvollziehbarer Fehlbefund mit eigenem Exitcode und Protokoll; die Quelle bleibt
//       unverändert.
//
// LIEFERBELEG: Vergleichsbericht, Drillprotokoll und lesbare Exportstichproben gehen UNVERÄNDERT nach
// `test-results/poc-wiederherstellung-export/` und als Zeile `[PV-01 VERGLEICHSBERICHT]` in die
// Testausgabe — mit Kandidat (Commit), Zeitpunkt und SHA-256. Keine Zugangsdaten darin.
//
// PRÜFGRENZE, EHRLICH GEMELDET: braucht eine echte PostgreSQL UND die PostgreSQL-Werkzeuge auf dem
// PATH (wie ADMIN-13). Fehlt etwas, steht der Grund auf stderr und der Fall wird übersprungen.
// KEINE PRODUKTIVDATEN: Quelle und Ziele sind eigene Wegwerfdatenbanken mit `test` im Namen.
const root = resolve(import.meta.dirname, "../..");
const JOB = "[KLARWERK] PV-01";
const BERICHT = join(root, "test-results", "poc-wiederherstellung-export");
const ROLLEN: readonly Wer[] = ["admin", "anna", "bert", "vera", "carl"];
const PROFIL = {
  anna: { name: "Nora (fiktiv)", avatar: "eule" },
  bert: { name: "Sven (fiktiv)", avatar: "fuchs" },
} as const;
const BEZUG = { pfad: "/bibliothek", seitenName: "Bibliothek", objekt: NORD_TITEL };
const HILFEFRAGE = "Fiktive Hilfefrage: Wo liegt das Prüfprotokoll N-12?";

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

// Wie in ADMIN-13 zusammengesetzt (Begründung dort: Fall N3 von job2354 liest ausgeschriebene
// Verbindungszeichenketten): die Wegwerfnamen entstehen zur Laufzeit und müssen `test` tragen.
const PG_SCHEMA = "postgresql:";

function pgUrl(v: Verbindung, datenbank: string): string {
  if (!datenbank.toLowerCase().includes("test")) {
    throw new Error(`${JOB}: „${datenbank}“ trägt kein „test“ im Namen — keine Verbindung.`);
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

function pgEnv(v: Verbindung): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PGHOST: v.host,
    PGPORT: v.port,
    PGUSER: v.user,
    PGPASSWORD: v.passwort,
  };
  env.KLARWERK_DATABASE_URL = undefined;
  env.DATABASE_URL = undefined;
  return env;
}

function sha256(daten: Buffer | string): string {
  return createHash("sha256").update(daten).digest("hex");
}

function kandidat(): string {
  const git = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  const commit = git.stdout?.trim() ?? "";
  return git.status === 0 && /^[0-9a-f]{40}$/.test(commit) ? commit : "unbekannt";
}

/**
 * Der verglichene Bestand, per SQL gelesen — Quelle wie Ziel mit DERSELBEN Abfrage. Gelesen werden
 * Fassungen (Aussage, Stufe), Beiträge (Fassung, Status, Space, Verantwortung), Quellen und Anhänge
 * am Beitrag, Anhangsbytes (Prüfsumme), Konten mit Rolle, Spaces mit Mitgliedern, Beziehungen,
 * Assistenzprofile und Gespräche je Konto. Zugangsdaten (Adresse, Hash) werden NICHT gelesen.
 */
async function fakten(pool: Pool): Promise<Record<string, unknown[]>> {
  const q = async (sql: string) => (await pool.query(sql)).rows;
  return {
    fassungen: await q(
      `SELECT ko_id, version, snapshot->>'statement' AS aussage,
              coalesce(snapshot->>'confidentiality', 'intern') AS stufe
         FROM ko_versions ORDER BY ko_id, version`,
    ),
    beitraege: await q(
      `SELECT id, status, (data->>'version')::int AS fassung, data->>'statement' AS aussage,
              data->>'spaceId' AS space, data->'ownership'->>'owner' AS verantwortlich,
              data->'ownership'->>'ownerRole' AS rolle, data->>'author' AS autor,
              jsonb_array_length(coalesce(data->'sources', '[]'::jsonb)) AS quellen,
              jsonb_array_length(coalesce(data->'attachments', '[]'::jsonb)) AS anhaenge
         FROM kos ORDER BY id`,
    ),
    anhangsbytes: await q("SELECT id, md5(data) AS inhalt FROM objects ORDER BY id"),
    belege: await q("SELECT id, ko_id, kind FROM ko_evidence ORDER BY id"),
    konten: await q("SELECT id, name, role, approved FROM users ORDER BY id"),
    spaces: await q(
      `SELECT space_id, version, data->>'name' AS name, data->>'zugang' AS zugang,
              data->>'verantwortlich' AS verantwortlich, data->'mitglieder' AS mitglieder
         FROM spaces_fassungen ORDER BY space_id, version`,
    ),
    beziehungen: await q("SELECT * FROM ko_kanten ORDER BY 1"),
    assistenzprofile: await q(
      `SELECT konto_id, data->>'name' AS name, data->>'avatar' AS avatar, fassung
         FROM assistenz_profile ORDER BY konto_id`,
    ),
    gespraeche: await q(
      `SELECT id, konto_id, fassung, jsonb_array_length(data->'nachrichten') AS nachrichten
         FROM klara_gespraeche ORDER BY id`,
    ),
  };
}

/** Zeilenzahlen jeder öffentlichen Tabelle — der Nachweis, dass eine Probe die Quelle nicht anfasst. */
async function zeilenzahlen(pool: Pool): Promise<Record<string, number>> {
  const tabellen = await pool.query<{ t: string }>(
    "SELECT table_name AS t FROM information_schema.tables WHERE table_schema='public' ORDER BY 1",
  );
  const raus: Record<string, number> = {};
  for (const { t } of tabellen.rows) {
    raus[t] = (await pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM public."${t}"`))
      .rows[0]?.n as number;
  }
  return raus;
}

describe("PV-01 · zusammenhängende Restore- und Exportprobe an echter PostgreSQL", () => {
  let container: StartedTestContainer | undefined;
  let adminPool: Pool | undefined;
  let quellPool: Pool | undefined;
  let zielPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let arbeitsordner = "";
  let verfuegbar = false;

  const kennung = `${Date.now()}`.slice(-9);
  const quellDb = `klarwerk_pv01_quelle_test_${kennung}`;
  const zielDb = `klarwerk_pv01_ziel_test_${kennung}`;
  const zielKaputt = `klarwerk_pv01_ziel_test_k_${kennung}`;
  const zielUnvollstaendig = `klarwerk_pv01_ziel_test_u_${kennung}`;

  let bestand: Bestand | undefined;
  let gespraechId = "";
  let quellZeilen: Record<string, number> = {};
  let dumpR1 = "";

  beforeAll(async () => {
    const fehlend = ["pg_dump", "pg_restore", "psql", "createdb", "ps"].filter(werkzeugFehlt);
    if (fehlend.length > 0) {
      process.stderr.write(
        `${JOB} ÜBERSPRUNGEN: Werkzeuge fehlen auf dem PATH: ${fehlend.join(", ")}.\n`,
      );
      return;
    }
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
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${quellDb}`);
    arbeitsordner = mkdtempSync(join(tmpdir(), "klarwerk-pv01-"));
    verfuegbar = true;
  }, 240_000);

  afterAll(async () => {
    await zielPool?.end();
    await quellPool?.end();
    if (adminPool) {
      for (const db of [quellDb, zielDb, zielKaputt, zielUnvollstaendig]) {
        await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      }
      await adminPool.end();
    }
    await container?.stop();
    if (arbeitsordner) {
      rmSync(arbeitsordner, { recursive: true, force: true });
    }
  }, 120_000);

  /** Ein Dump mit dem UNVERÄNDERTEN `backup.sh`, in einem eigenen Ordner. */
  function sichere(v: Verbindung, unterordner: string): string {
    const ordner = join(arbeitsordner, unterordner);
    mkdirSync(ordner, { recursive: true });
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: pgUrl(v, quellDb),
      BACKUP_DIR: ordner,
    };
    env.KLARWERK_DATABASE_URL = undefined;
    const lauf = spawnSync("bash", [join(root, "scripts/backup/backup.sh")], {
      cwd: root,
      encoding: "utf8",
      timeout: 300_000,
      env,
    });
    expect(lauf.status, `${lauf.stdout}${lauf.stderr}`).toBe(0);
    const name = readdirSync(ordner).find((d) => d.endsWith(".dump"));
    expect(name, "backup.sh hat keinen Dump veröffentlicht").toBeTruthy();
    return join(ordner, String(name));
  }

  /** Der Restore-Drill (`restore-drill.sh`) gegen ein eigenes leeres Ziel — mit gemessener Dauer. */
  function fahreDrill(v: Verbindung, dump: string, ziel: string) {
    const env = pgEnv(v);
    const arbeit = dump.slice(0, dump.lastIndexOf("/"));
    env.RESTORE_DB = ziel;
    env.DRILL_PORT = "3098";
    env.DRILL_WORKDIR = arbeit;
    env.DRILL_LOGIN_EMAIL = KONTEN.admin.email;
    env.DRILL_LOGIN_PASSWORT = KENNWORT;
    const start = Date.now();
    const drill = spawnSync("bash", [join(root, "scripts/backup/restore-drill.sh"), dump], {
      cwd: root,
      encoding: "utf8",
      timeout: 600_000,
      env,
    });
    return {
      status: drill.status,
      ausgabe: `${drill.stdout ?? ""}${drill.stderr ?? ""}`,
      dauerMs: Date.now() - start,
      protokoll: readFileSync(join(arbeit, "letzter-drill.json"), "utf8"),
    };
  }

  it("R1 · Fassungen, Zuordnungen, Privatdaten und Export kommen zusammenhängend zurück", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const v = verbindung;
    const datum = new Date().toISOString();

    // --------------------------------------------------------------------------------------------
    // 1. AUSGANGSBESTAND — über die echte Anwendung, an einer eigenen Quelldatenbank.
    // --------------------------------------------------------------------------------------------
    quellPool = createPool(pgUrl(v, quellDb));
    await migrate(quellPool);
    const quellServices = buildPgServices(quellPool);
    await quellServices.ko.activateSearchProjectionV2();
    const quellApp = buildApp(quellServices);
    const b = await legeFiktivenBestand(quellApp);
    bestand = b;
    for (const wer of ["anna", "bert"] as const) {
      const res = await quellApp.inject({
        method: "PUT",
        url: "/api/me/assistenz",
        headers: b.kopf[wer],
        payload: { ...PROFIL[wer], einrichtungAbschliessen: true },
      });
      expect(res.statusCode, res.body).toBe(200);
    }
    const g = await quellApp.inject({
      method: "POST",
      url: "/api/me/klara/gespraeche",
      headers: b.kopf.anna,
      payload: { objektbezug: BEZUG },
    });
    expect(g.statusCode, g.body).toBe(201);
    gespraechId = (g.json() as { gespraech: { id: string } }).gespraech.id;
    const n = await quellApp.inject({
      method: "POST",
      url: `/api/me/klara/gespraeche/${gespraechId}/nachrichten`,
      headers: b.kopf.anna,
      payload: { von: "du", modus: "hilfe", text: HILFEFRAGE, objektbezug: BEZUG },
    });
    expect(n.statusCode, n.body).toBe(201);

    const quellPakete = new Map<Wer, Paket>();
    for (const wer of ROLLEN) {
      quellPakete.set(wer, await paketVon(quellApp, b.kopf[wer]));
    }
    // Die Anwendung der Quelle wird geschlossen, bevor gesichert wird: keine Hintergrundläufe
    // schreiben danach mehr in die Quelle, Ausgangsbestand und Dump sind derselbe Stand.
    await quellApp.close();
    const vorher = await fakten(quellPool);
    expect(vorher.fassungen?.length, "Fassungen im Bestand").toBeGreaterThanOrEqual(8);
    expect(vorher.assistenzprofile).toHaveLength(2);
    expect(vorher.gespraeche).toHaveLength(1);
    quellZeilen = await zeilenzahlen(quellPool);

    // --------------------------------------------------------------------------------------------
    // 2. SICHERUNG UND RESTORE — die bestehende Sicherungssteuerung, unverändert aufgerufen.
    // --------------------------------------------------------------------------------------------
    dumpR1 = sichere(v, "r1");
    const drill = fahreDrill(v, dumpR1, zielDb);
    expect(drill.status, drill.ausgabe).toBe(0);
    expect(drill.ausgabe).toContain("DRILL BESTANDEN");
    const protokoll = JSON.parse(drill.protokoll) as {
      ergebnis: string;
      ziel: string;
      beginn: string;
      zeit: string;
      vergleich: Record<string, { zustand: string; tabellen: { tabelle: string; dump: number }[] }>;
    };
    expect(protokoll.ergebnis).toBe("erfolg");
    expect(protokoll.ziel).toBe(zielDb);
    for (const k of ["beitraege", "anhaenge", "beziehungen", "rechte", "assistenz"]) {
      expect(protokoll.vergleich[k]?.zustand, k).toBe("gleich");
    }
    const imDump = (t: string) =>
      protokoll.vergleich.assistenz?.tabellen.find((e) => e.tabelle === t)?.dump;
    expect(imDump("assistenz_profile")).toBe(2);
    expect(imDump("klara_gespraeche")).toBe(1);
    // Die Quelle hat die Probe nicht berührt.
    expect(await zeilenzahlen(quellPool)).toEqual(quellZeilen);

    // --------------------------------------------------------------------------------------------
    // 3. VERGLEICH — derselbe Bestand, gelesen am wiederhergestellten Ziel.
    // --------------------------------------------------------------------------------------------
    zielPool = createPool(pgUrl(v, zielDb));
    const nachher = await fakten(zielPool);
    const abweichend = Object.keys(vorher).filter(
      (k) => JSON.stringify(vorher[k]) !== JSON.stringify(nachher[k]),
    );
    expect(abweichend, "Bereiche, die nach dem Restore anders aussehen").toEqual([]);
    // Aktuelle und historische Fassung bleiben unterscheidbar.
    const nordFassungen = (nachher.fassungen as { ko_id: string; aussage: string }[]).filter(
      (f) => f.ko_id === b.nordId,
    );
    expect(nordFassungen.some((f) => f.aussage === NORD_V1)).toBe(true);
    expect(nordFassungen.at(-1)?.aussage).toBe(NORD_V2);

    const backupDirVorher = process.env.BACKUP_DIR;
    process.env.BACKUP_DIR = dumpR1.slice(0, dumpR1.lastIndexOf("/"));
    try {
      const zielApp = buildApp(buildPgServices(zielPool));
      const kopf = {} as Record<Wer, Record<string, string>>;
      for (const wer of ROLLEN) {
        kopf[wer] = await anmelden(zielApp, KONTEN[wer].email);
      }

      // Privatdaten: dem richtigen Konto zurück — und keinem anderen.
      for (const wer of ["anna", "bert"] as const) {
        const p = await zielApp.inject({ url: "/api/me/assistenz", headers: kopf[wer] });
        expect(p.statusCode, p.body).toBe(200);
        expect((p.json() as { profil: unknown }).profil).toMatchObject(PROFIL[wer]);
      }
      const veraProfil = await zielApp.inject({ url: "/api/me/assistenz", headers: kopf.vera });
      expect((veraProfil.json() as { profil: unknown }).profil).toBeNull();
      const fremdesProfil = await zielApp.inject({
        url: `/api/me/assistenz?kontoId=${b.kennung.anna}`,
        headers: kopf.bert,
      });
      expect(fremdesProfil.statusCode).toBe(403);
      expect(fremdesProfil.body).not.toContain(PROFIL.anna.name);
      const eigenesGespraech = await zielApp.inject({
        url: `/api/me/klara/gespraeche/${gespraechId}`,
        headers: kopf.anna,
      });
      expect(eigenesGespraech.statusCode, eigenesGespraech.body).toBe(200);
      expect(eigenesGespraech.body).toContain(HILFEFRAGE);
      for (const fremd of ["bert", "admin"] as const) {
        const res = await zielApp.inject({
          url: `/api/me/klara/gespraeche/${gespraechId}`,
          headers: kopf[fremd],
        });
        expect(res.statusCode, `${fremd} liest Annas Gespräch`).toBe(404);
        expect(res.body).not.toContain(HILFEFRAGE);
      }

      // Rechte nach dem Restore: Nord nur für Mitglieder, der Anhang Byte für Byte.
      expect(
        (await zielApp.inject({ url: `/api/kos/${b.nordId}`, headers: kopf.bert })).statusCode,
      ).toBe(404);
      expect(
        (await zielApp.inject({ url: `/api/kos/${b.nordId}`, headers: kopf.anna })).statusCode,
      ).toBe(200);
      const roh = await zielApp.inject({
        url: `/api/objects/${b.objektId}/raw`,
        headers: kopf.anna,
      });
      expect(roh.statusCode).toBe(200);
      expect(Buffer.from(roh.rawPayload).equals(ANHANG)).toBe(true);

      // Das Wissenspaket JEDER Rolle ist nach dem Restore inhaltsgleich.
      const zielPakete = new Map<Wer, Paket>();
      const paketVergleich: Record<string, { beitraege: number; gleich: boolean }> = {};
      for (const wer of ROLLEN) {
        const nach = await paketVon(zielApp, kopf[wer]);
        zielPakete.set(wer, nach);
        const vor = quellPakete.get(wer) as Paket;
        expect(vergleichsstand(nach), `Paket ${wer}`).toEqual(vergleichsstand(vor));
        paketVergleich[wer] = { beitraege: nach.manifest.beitraege.length, gleich: true };
      }

      // Die Verwaltung weist den Umfang je Bereich mit dem Beleg dieser Probe aus.
      const auskunft = await zielApp.inject({ url: "/api/admin/sicherungen", headers: kopf.admin });
      expect(auskunft.statusCode, auskunft.body).toBe(200);
      const umfang = (
        auskunft.json() as {
          umfang: {
            produkt: { version: string; commit: string };
            bereiche: { id: string; zustand: string; beleg: string }[];
          };
        }
      ).umfang;
      const beleg = (id: string) => umfang.bereiche.find((x) => x.id === id)?.beleg;
      for (const id of ["datenbank", "anhangsbytes", "assistenzprofil", "gespraeche"]) {
        expect(beleg(id), id).toBe("belegt");
      }
      for (const id of ["eigeneavatare", "aufgaben", "avatarmotive", "endgeraet"]) {
        expect(beleg(id), id).toBe("kein_beleg");
      }
      await zielApp.close();

      // ------------------------------------------------------------------------------------------
      // 4. LIEFERBELEG — Bericht, Protokoll, Stichproben; unverändert und ohne Zugangsdaten.
      // ------------------------------------------------------------------------------------------
      const stichproben = join(BERICHT, "stichproben");
      mkdirSync(stichproben, { recursive: true });
      const anna = zielPakete.get("anna") as Paket;
      const nord = anna.manifest.beitraege.find((x) => x.kennung === b.nordId);
      const historisch = nord?.fassungen.find((f) => !f.aktuell);
      const proben = [
        "LIESMICH.md",
        "MANIFEST.json",
        "zuordnungen.csv",
        `${nord?.ordner}/aktuell.md`,
        historisch?.datei ?? "",
        nord?.anhaenge[0]?.datei ?? "",
      ];
      const probenBelege: { datei: string; ablage: string; sha256: string }[] = [];
      for (const datei of proben) {
        const inhalt = await anna.zip.file(datei)?.async("nodebuffer");
        expect(inhalt, `Stichprobe ${datei}`).toBeTruthy();
        const ablage = datei.replace(/\//g, "__");
        writeFileSync(join(stichproben, ablage), inhalt as Buffer);
        probenBelege.push({ datei, ablage, sha256: sha256(inhalt as Buffer) });
      }
      const annaQuelle = quellPakete.get("anna") as Paket;
      writeFileSync(join(BERICHT, "export-anna-quelle.zip"), annaQuelle.roh);
      writeFileSync(join(BERICHT, "export-anna-wiederhergestellt.zip"), anna.roh);
      writeFileSync(join(BERICHT, "letzter-drill-pv01.json"), drill.protokoll, "utf8");

      const bericht = {
        auftrag: "produkt:20261010:poc-wiederherstellung-export",
        datum,
        kandidat: kandidat(),
        produkt: umfang.produkt,
        isoliert: {
          quelle: quellDb,
          ziel: zielDb,
          hinweis: "Wegwerfdatenbanken, nur fiktive Daten",
        },
        sicherung: {
          datei: dumpR1.slice(dumpR1.lastIndexOf("/") + 1),
          sha256: sha256(readFileSync(dumpR1)),
          werkzeug: "scripts/backup/backup.sh (unverändert aufgerufen)",
        },
        wiederherstellung: {
          werkzeug: "scripts/backup/restore-drill.sh",
          exitcode: drill.status,
          gemesseneDauerMs: drill.dauerMs,
          protokollBeginn: protokoll.beginn,
          protokollEnde: protokoll.zeit,
          protokollSha256: sha256(drill.protokoll),
        },
        vergleich: Object.fromEntries(
          Object.keys(vorher).map((k) => [
            k,
            { zeilen: (vorher[k] ?? []).length, gleich: !abweichend.includes(k) },
          ]),
        ),
        quelleUnveraendert: true,
        privatdaten: {
          profileZugeordnet: ["anna", "bert"],
          fremdesProfil: 403,
          fremdesGespraech: 404,
        },
        export: paketVergleich,
        sicherungsumfang: umfang.bereiche,
        stichproben: probenBelege,
      };
      const berichtText = `${JSON.stringify(bericht, null, 2)}\n`;
      // Keine Zugangsdaten: weder das Kennwort der Konten noch eine Adresse noch die Verbindung.
      for (const verboten of [KENNWORT, "@example.test", pgUrl(v, quellDb), pgUrl(v, zielDb)]) {
        expect(berichtText).not.toContain(verboten);
        expect(drill.protokoll).not.toContain(verboten);
      }
      writeFileSync(join(BERICHT, "vergleichsbericht.json"), berichtText, "utf8");
      process.stdout.write(`[PV-01 VERGLEICHSBERICHT] ${JSON.stringify(bericht)}\n`);
    } finally {
      if (backupDirVorher === undefined) {
        delete process.env.BACKUP_DIR;
      } else {
        process.env.BACKUP_DIR = backupDirVorher;
      }
    }
  }, 900_000);

  it("R2 · beschädigte und unvollständige Sicherungen liefern einen nachvollziehbaren Fehlbefund", async (ctx) => {
    if (!verfuegbar || !verbindung || !quellPool || !dumpR1 || !bestand) {
      ctx.skip();
      return;
    }
    const v = verbindung;

    // Beschädigt: die halbe Datei unter eigenem Namen, Prüfsumme der ganzen Sicherung daneben.
    const kaputtOrdner = join(arbeitsordner, "kaputt");
    mkdirSync(kaputtOrdner, { recursive: true });
    const ganz = readFileSync(dumpR1);
    const kaputt = join(kaputtOrdner, "klarwerk-20261010T000000Z.dump");
    writeFileSync(kaputt, ganz.subarray(0, Math.floor(ganz.length / 2)));
    writeFileSync(`${kaputt}.sha256`, `${sha256(ganz)}  klarwerk-20261010T000000Z.dump\n`);
    const k = fahreDrill(v, kaputt, zielKaputt);
    expect(k.status, k.ausgabe).toBe(11);
    expect(k.ausgabe).not.toContain("DRILL BESTANDEN");
    const kp = JSON.parse(k.protokoll) as {
      ergebnis: string;
      exitcode: number;
      grund: string;
      pruefsumme: { zustand: string };
      vergleich: Record<string, { zustand: string }>;
    };
    expect(kp.ergebnis).toBe("fehler");
    expect(kp.exitcode).toBe(11);
    expect(kp.pruefsumme.zustand).toBe("abweichend");
    expect(kp.grund).toContain("nichts wiederhergestellt");
    expect(kp.vergleich.assistenz?.zustand).toBe("nicht_gemessen");

    // Unvollständig: ein echter Dump OHNE die Daten der Assistenzprofile, mit passender Prüfsumme.
    const teilOrdner = join(arbeitsordner, "unvollstaendig");
    mkdirSync(teilOrdner, { recursive: true });
    const teil = join(teilOrdner, "klarwerk-20261010T000001Z.dump");
    const dump = spawnSync(
      "pg_dump",
      ["-Fc", "--exclude-table-data=public.assistenz_profile", "-f", teil, quellDb],
      { encoding: "utf8", env: pgEnv(v), timeout: 300_000 },
    );
    expect(dump.status, dump.stderr).toBe(0);
    const teilHash = sha256(readFileSync(teil));
    writeFileSync(`${teil}.sha256`, `${teilHash}  klarwerk-20261010T000001Z.dump\n`);
    const u = fahreDrill(v, teil, zielUnvollstaendig);
    expect(u.status, u.ausgabe).toBe(22);
    expect(u.ausgabe).toContain("der Dump fuehrt keinen Bestand fuer: assistenz_profile");
    const up = JSON.parse(u.protokoll) as {
      ergebnis: string;
      exitcode: number;
      vergleich: Record<string, { zustand: string }>;
    };
    expect(up.ergebnis).toBe("fehler");
    expect(up.exitcode).toBe(22);
    expect(up.vergleich.assistenz?.zustand).toBe("nicht_gemessen");

    // Die Quelle ist nach beiden Fehlproben unverändert.
    expect(await zeilenzahlen(quellPool)).toEqual(quellZeilen);

    mkdirSync(BERICHT, { recursive: true });
    copyFileSync(
      join(kaputtOrdner, "letzter-drill.json"),
      join(BERICHT, "letzter-drill-beschaedigt.json"),
    );
    copyFileSync(
      join(teilOrdner, "letzter-drill.json"),
      join(BERICHT, "letzter-drill-unvollstaendig.json"),
    );
    const fehlbefunde = {
      beschaedigt: { exitcode: k.status, pruefsumme: kp.pruefsumme.zustand, grund: kp.grund },
      unvollstaendig: { exitcode: u.status, fehlenderBestand: "assistenz_profile" },
      quelleUnveraendert: true,
    };
    writeFileSync(join(BERICHT, "fehlbefunde.json"), `${JSON.stringify(fehlbefunde, null, 2)}\n`);
    process.stdout.write(`[PV-01 FEHLBEFUNDE] ${JSON.stringify(fehlbefunde)}\n`);
  }, 900_000);
});
