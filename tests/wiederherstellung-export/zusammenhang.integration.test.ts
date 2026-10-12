import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { type KlaraConsent, PgKlaraSessionRepo } from "../../services/reasoner";
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
// Nacharbeit 3 (Ben, PV-01-03): nicht leere, nicht abgelaufene Einträge JEDES privaten Bereichs.
const GEDAECHTNIS = {
  anna: { inhalt: "Fiktiv: Wie oft wird N-12 geprüft?", antwort: "Fiktiv: vor jedem Anfahren." },
  bert: { inhalt: "Fiktiv: Wer entlüftet Süd?", antwort: "Fiktiv: die Frühschicht." },
} as const;
interface GedaechtnisListe {
  eintraege: { id: string; inhalt: string; antwort: string | null }[];
}
const SITZUNG = {
  anna: { instanz: "pv01-inst-anna", dokument: "pv01-doc-anna" },
  bert: { instanz: "pv01-inst-bert", dokument: "pv01-doc-bert" },
} as const;

/**
 * DAUERHAFTE ARTEFAKTE (Nacharbeit 3, PV-01-07). Der Prüfserver wird nach dem Lauf samt Speicher
 * abgebaut; erhalten bleiben sein Protokoll und der Suite-Bericht. Jedes Abnahmeartefakt geht
 * deshalb ZUSÄTZLICH zur Datei unter `test-results/` vollständig und unverändert als eine Zeile
 * `[PV-01 ARTEFAKT]` in die Testausgabe — Text wörtlich, Binärdateien (ZIP, Anhang) als Base64,
 * jeweils mit SHA-256 und Byteanzahl der Originalbytes. Wiederherstellbar mit
 * `Buffer.from(inhalt, kodierung)`.
 */
function artefakt(datei: string, inhalt: Buffer | string): { datei: string; sha256: string } {
  const bytes = typeof inhalt === "string" ? Buffer.from(inhalt, "utf8") : inhalt;
  const ziel = join(BERICHT, datei);
  mkdirSync(ziel.slice(0, ziel.lastIndexOf("/")), { recursive: true });
  writeFileSync(ziel, bytes);
  const text = typeof inhalt === "string";
  const zeile = {
    datei,
    sha256: sha256(bytes),
    bytes: bytes.length,
    kodierung: text ? "utf8" : "base64",
    inhalt: text ? inhalt : bytes.toString("base64"),
  };
  process.stdout.write(`[PV-01 ARTEFAKT] ${JSON.stringify(zeile)}\n`);
  return { datei, sha256: zeile.sha256 };
}

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
    // Nacharbeit 3: Inhalt UND Kontozuordnung der übrigen privaten Bereiche, nicht nur ihre Zahl.
    gedaechtnis: await q(
      `SELECT id, konto_id, art, inhalt, antwort, vertraulichkeit, aufbewahrung_tage, verfall_am
         FROM interaktions_gedaechtnis ORDER BY id`,
    ),
    klaraSitzungen: await q(
      `SELECT session_id, actor_id, addin_instance_id, document_context_id, consent_state,
              expires_at, closed_at
         FROM klara_sessions ORDER BY session_id`,
    ),
    klaraZustimmungen: await q(
      `SELECT consent_id, session_id, actor_id, document_context_id, status, provider_class,
              provider_reference, model_reference, allowed_payload_classes, expires_at
         FROM klara_session_consents ORDER BY consent_id`,
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

    // Nacharbeit 3 (Ben, PV-01-03): Interaktionsgedächtnis, Klara-Sitzung und Zustimmung je Konto —
    // nicht leer, nicht abgelaufen, damit der Vergleich Inhalt und Kontozuordnung trägt statt 0 = 0.
    const gedaechtnisId = {} as Record<"anna" | "bert", string>;
    const sitzungId = {} as Record<"anna" | "bert", string>;
    const dokumentId = {} as Record<"anna" | "bert", string>;
    const sitzungsRepoQuelle = new PgKlaraSessionRepo(quellPool);
    for (const wer of ["anna", "bert"] as const) {
      const merk = await quellApp.inject({
        method: "POST",
        url: "/api/me/gedaechtnis",
        headers: b.kopf[wer],
        payload: { art: "frage_antwort", ...GEDAECHTNIS[wer], aufbewahrungTage: 365 },
      });
      expect(merk.statusCode, merk.body).toBe(201);
      gedaechtnisId[wer] = (merk.json() as { eintrag: { id: string } }).eintrag.id;

      // Die Sitzung über die echte Route — der Server vergibt Sitzungs- und Dokumentkennung.
      const s = await quellApp.inject({
        method: "POST",
        url: "/api/klara/sessions",
        headers: { ...b.kopf[wer], "x-klara-instance": SITZUNG[wer].instanz },
        payload: {
          addinInstanceId: SITZUNG[wer].instanz,
          documentDescriptor: { kind: "saved", hostDocumentId: SITZUNG[wer].dokument },
        },
      });
      expect(s.statusCode, s.body).toBe(201);
      const sicht = s.json() as {
        sessionId?: string;
        documentContextId?: string;
        session?: { sessionId?: string; documentContextId?: string };
      };
      sitzungId[wer] = String(sicht.sessionId ?? sicht.session?.sessionId ?? "");
      dokumentId[wer] = String(sicht.documentContextId ?? sicht.session?.documentContextId ?? "");
      expect(sitzungId[wer].length, `${wer}: Sitzungskennung`).toBeGreaterThan(0);

      // DIE ZUSTIMMUNG — über den Übergang der Produktablage (`grantConsent`, dieselbe Transaktion
      // wie der Dienst), NICHT über HTTP: `POST …/consent` verlangt eine konfigurierte externe KI
      // samt zentraler Freigabe; ohne sie antwortet der Server ehrlich 409 („nur für externe KI
      // möglich“, `ask-routes-ka4-einwilligung.test.ts` KA4-I0). Der Prüfserver hat keine Cloud.
      // Anbieter und Modell sind fiktiv; die Zeile trägt die echte Sitzungs- und Kontobindung.
      const gelesen = await sitzungsRepoQuelle.findSession(sitzungId[wer]);
      expect(gelesen, `${wer}: Sitzung in der Ablage`).toBeTruthy();
      if (!gelesen) {
        return;
      }
      const zustimmung: KlaraConsent = {
        consentId: `pv01-zustimmung-${wer}`,
        sessionId: gelesen.sessionId,
        tenantId: gelesen.tenantId,
        actorId: gelesen.actorId,
        documentContextId: gelesen.documentContextId,
        consentScope: "fiktiv-pv01",
        allowedPayloadClasses: ["frage"],
        providerClass: "external",
        providerBindingId: "fiktiv-anbieter-pv01",
        modelReference: "fiktiv-modell-pv01",
        providerReference: "fiktiv-anbieter-pv01",
        addinInstanceId: gelesen.addinInstanceId,
        policyVersion: gelesen.policyVersion,
        configurationVersion: gelesen.configurationVersion,
        grantedAt: new Date().toISOString(),
        expiresAt: gelesen.expiresAt,
        revokedAt: null,
        status: "granted",
        resolutionId: gelesen.resolutionId,
      };
      expect(
        await sitzungsRepoQuelle.grantConsent(gelesen.sessionId, gelesen.revision, zustimmung),
        `${wer}: Zustimmung angelegt`,
      ).toBe(true);
    }

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
    expect(vorher.gedaechtnis).toHaveLength(2);
    expect(vorher.klaraSitzungen).toHaveLength(2);
    expect(vorher.klaraZustimmungen).toHaveLength(2);
    // Die Sitzungen und Zustimmungen der Quelle, wie die Produktablage sie je Konto liefert.
    const sitzungenVorher = {
      anna: await sitzungsRepoQuelle.sitzungenVon(b.kennung.anna),
      bert: await sitzungsRepoQuelle.sitzungenVon(b.kennung.bert),
    };
    const zustimmungenVorher = {
      anna: await sitzungsRepoQuelle.consentsVon(b.kennung.anna),
      bert: await sitzungsRepoQuelle.consentsVon(b.kennung.bert),
    };
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
    expect(imDump("interaktions_gedaechtnis")).toBe(2);
    expect(imDump("klara_sessions")).toBe(2);
    expect(imDump("klara_session_consents")).toBe(2);
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

      // Nacharbeit 3 (Ben, PV-01-03) — INTERAKTIONSGEDÄCHTNIS: Inhalt je Konto über die Anwendung
      // zurückgelesen; das andere Konto sieht es nicht und kann es nicht löschen.
      const inhaltsprobe: Record<string, Record<string, unknown>> = {};
      for (const [wer, anderer] of [
        ["anna", "bert"],
        ["bert", "anna"],
      ] as const) {
        const liste = await zielApp.inject({ url: "/api/me/gedaechtnis", headers: kopf[wer] });
        expect(liste.statusCode, liste.body).toBe(200);
        const eintraege = (liste.json() as GedaechtnisListe).eintraege;
        expect(
          eintraege.map((e) => [e.id, e.inhalt, e.antwort]),
          wer,
        ).toEqual([[gedaechtnisId[wer], GEDAECHTNIS[wer].inhalt, GEDAECHTNIS[wer].antwort]]);
        expect(liste.body, `${wer} sieht fremdes Gedächtnis`).not.toContain(
          GEDAECHTNIS[anderer].inhalt,
        );
        const fremdLoeschen = await zielApp.inject({
          method: "DELETE",
          url: `/api/me/gedaechtnis/${gedaechtnisId[anderer]}`,
          headers: kopf[wer],
        });
        expect(fremdLoeschen.statusCode, `${wer} löscht fremdes Gedächtnis`).toBe(404);
      }
      const nachFremdversuch = await zielPool.query<{ n: number }>(
        "SELECT count(*)::int AS n FROM interaktions_gedaechtnis",
      );
      expect(nachFremdversuch.rows[0]?.n, "ein Fremdversuch hat etwas gelöscht").toBe(2);
      inhaltsprobe.gedaechtnis = {
        inhaltJeKontoZurueckgelesen: true,
        fremdesLesen: "nicht enthalten",
        fremdesLoeschen: 404,
      };

      // KLARA-SITZUNGEN UND ZUSTIMMUNGEN: je Konto aus der Produktablage gelesen, Quelle gegen Ziel
      // (Bindung an Konto, Instanz, Dokument, Zustimmungsstatus, Anbieter, Modell).
      const sitzungsRepoZiel = new PgKlaraSessionRepo(zielPool);
      for (const wer of ["anna", "bert"] as const) {
        const sitzungen = await sitzungsRepoZiel.sitzungenVon(b.kennung[wer]);
        expect(sitzungen, `${wer}: Sitzungen nach Restore`).toEqual(sitzungenVorher[wer]);
        expect(sitzungen.map((s) => s.sessionId)).toEqual([sitzungId[wer]]);
        const zustimmungen = await sitzungsRepoZiel.consentsVon(b.kennung[wer]);
        expect(zustimmungen, `${wer}: Zustimmungen nach Restore`).toEqual(zustimmungenVorher[wer]);
        expect(zustimmungen.map((z) => [z.consentId, z.actorId, z.status])).toEqual([
          [`pv01-zustimmung-${wer}`, b.kennung[wer], "granted"],
        ]);
      }
      // Fremdzugriff über die Anwendung: Bert mit Annas vollständiger Bindung — dieselbe Absage wie
      // für eine unbekannte Sitzung.
      const annaBindung = {
        "x-klara-session": sitzungId.anna,
        "x-klara-instance": SITZUNG.anna.instanz,
        "x-klara-document": dokumentId.anna,
      };
      const fremdeSitzung = await zielApp.inject({
        url: `/api/klara/sessions/${sitzungId.anna}`,
        headers: { ...kopf.bert, ...annaBindung },
      });
      expect(fremdeSitzung.statusCode, "Bert liest Annas Klara-Sitzung").toBe(404);
      expect(fremdeSitzung.body).not.toContain(dokumentId.anna);
      // Der Eigentümer liest seine Sitzung über die Anwendung zurück — solange ihre
      // Inaktivitätsfrist (15 min) seit der Anlage nicht abgelaufen ist. Danach ist 404 die
      // richtige Antwort des Produkts; der Inhaltsvergleich oben gilt unabhängig davon.
      const sitzungAnna = sitzungenVorher.anna[0];
      const nochGueltig = sitzungAnna ? Date.parse(sitzungAnna.expiresAt) > Date.now() : false;
      let eigentuemerLesung: number | "frist_abgelaufen" = "frist_abgelaufen";
      if (nochGueltig) {
        const eigene = await zielApp.inject({
          url: `/api/klara/sessions/${sitzungId.anna}`,
          headers: { ...kopf.anna, ...annaBindung },
        });
        expect(eigene.statusCode, eigene.body).toBe(200);
        expect(eigene.body).toContain(sitzungId.anna);
        eigentuemerLesung = eigene.statusCode;
      }
      inhaltsprobe.klaraSitzungen = {
        jeKontoGleich: true,
        fremdeSitzung: 404,
        eigentuemerLesungUeberAnwendung: eigentuemerLesung,
      };
      inhaltsprobe.klaraZustimmungen = { jeKontoGleich: true, status: "granted" };
      inhaltsprobe.assistenzprofil = { jeKontoZurueckgelesen: true, fremdesProfil: 403 };
      inhaltsprobe.gespraeche = { eigentuemer: 200, fremd: 404 };

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
      for (const id of ["datenbank", "anhangsbytes"]) {
        expect(beleg(id), id).toBe("belegt");
      }
      // Die Verwaltung kennt für private Bereiche nur den Tabellenvergleich des Drills — sie darf
      // daraus keinen inhaltlichen Wiederherstellungsbeleg machen (Nacharbeit 3).
      for (const id of ["assistenzprofil", "gespraeche", "gedaechtnis", "sitzungen"]) {
        expect(beleg(id), id).toBe("zeilen_gleich");
      }
      for (const id of ["eigeneavatare", "aufgaben", "avatarmotive", "endgeraet"]) {
        expect(beleg(id), id).toBe("kein_beleg");
      }
      await zielApp.close();

      // ------------------------------------------------------------------------------------------
      // 4. LIEFERBELEG — Bericht, Protokoll, Stichproben; unverändert und ohne Zugangsdaten.
      // ------------------------------------------------------------------------------------------
      // Nacharbeit 3 (PV-01-07): jedes Artefakt geht vollständig in die Testausgabe (`artefakt`),
      // weil der Prüfserver samt Speicher nach dem Lauf abgebaut wird.
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
        const ablage = `stichproben/${datei.replace(/\//g, "__")}`;
        const bytes = Buffer.from(inhalt ?? Buffer.alloc(0));
        const lesbar = !datei.includes("/anhaenge/");
        const abgelegt = artefakt(ablage, lesbar ? bytes.toString("utf8") : bytes);
        probenBelege.push({ datei, ablage, sha256: abgelegt.sha256 });
      }
      // Das vollständige Exportmanifest JEDER Rolle nach dem Restore.
      for (const wer of ROLLEN) {
        const m = (zielPakete.get(wer) as Paket).texte.get("MANIFEST.json") ?? "";
        artefakt(`manifeste/MANIFEST-${wer}-wiederhergestellt.json`, m);
      }
      const annaQuelle = quellPakete.get("anna") as Paket;
      artefakt("export-anna-quelle.zip", annaQuelle.roh);
      artefakt("export-anna-wiederhergestellt.zip", anna.roh);
      artefakt("letzter-drill-pv01.json", drill.protokoll);

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
        // Zwei getrennte Aussagen (Nacharbeit 3): was der Drill nur ZÄHLT, und was diese Probe je
        // Konto INHALTLICH zurückgelesen und gegen Fremdzugriff geprüft hat.
        privatdaten: {
          tabellenvergleichDesDrills: protokoll.vergleich.assistenz,
          inhaltsprobeJeKonto: inhaltsprobe,
        },
        export: paketVergleich,
        sicherungsumfangLautVerwaltung: umfang.bereiche,
        stichproben: probenBelege,
      };
      const berichtText = `${JSON.stringify(bericht, null, 2)}\n`;
      // Keine Zugangsdaten: weder das Kennwort der Konten noch eine Adresse noch die Verbindung.
      for (const verboten of [KENNWORT, "@example.test", pgUrl(v, quellDb), pgUrl(v, zielDb)]) {
        expect(berichtText).not.toContain(verboten);
        expect(drill.protokoll).not.toContain(verboten);
      }
      for (const [, text] of [...anna.texte, ...annaQuelle.texte]) {
        expect(text).not.toContain(KENNWORT);
      }
      artefakt("vergleichsbericht.json", berichtText);
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

    // Nacharbeit 3 (PV-01-07): die Originalprotokolle beider Fehlproben dauerhaft in der Ausgabe.
    artefakt("letzter-drill-beschaedigt.json", k.protokoll);
    artefakt("letzter-drill-unvollstaendig.json", u.protokoll);
    const fehlbefunde = {
      beschaedigt: { exitcode: k.status, pruefsumme: kp.pruefsumme.zustand, grund: kp.grund },
      unvollstaendig: { exitcode: u.status, fehlenderBestand: "assistenz_profile" },
      quelleUnveraendert: true,
    };
    artefakt("fehlbefunde.json", `${JSON.stringify(fehlbefunde, null, 2)}\n`);
    process.stdout.write(`[PV-01 FEHLBEFUNDE] ${JSON.stringify(fehlbefunde)}\n`);
  }, 900_000);
});
