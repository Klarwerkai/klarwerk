// ================================================================================================
// GRAPH-BROWSER-RECHTE · DIESELBE STRECKE GEGEN POSTGRESQL — und der historische 500, minimal.
// ================================================================================================
//
// `strecke.ts` fährt hier unverändert, nur mit einem echten `Pool`: Setzen und Widerrufen per
// Tastatur bei 360 px, Neuladen, Gegenseite, Rechteentzug an offener Sitzung. Zusätzlich wird jede
// Station an der Tabelle `ko_kanten` nachgelesen — mit eigener Verbindung, nicht über die Anwendung.
//
// ------------------------------------------------------------------------------------------------
// DER HISTORISCHE 500 — ERST DIAGNOSTIZIERT AM AUSLÖSER, DANN MINIMAL REPRODUZIERT (B3, Ben R1/R2)
// ------------------------------------------------------------------------------------------------
//
// DER ALTBEFUND (JOB 4328 R1, Arbeitsprüfung 9b5f98b21ece44fea6340ee5410a6823, festgehalten in
// `tests/wissensnetz-nutzerweg/strecke.ts:1155-1171`): gegen PostgreSQL, in einem EIGENEN
// Serverprozess (`starteKlarwerk`), bei offener `/graph`-Seite, antwortete `POST /api/kos` beim
// dritten Grenzobjekt mit `500 {"error":"INTERNAL",…}`; ohne Browser liefen zwei Gegenproben mit je
// 8 × 201 durch. Ursache damals ungeklärt — das Serverprotokoll war nicht zugänglich
// (`starteKlarwerk` gab es nur beim Startfehler heraus).
//
// WAS EIN GLEICHER RUMPF NICHT BELEGT (Ben R2, Fall 13): `sendError` (`services/app/src/http.ts`)
// antwortet auf JEDE nicht als Domänencode geführte Ursache mit demselben `500 INTERNAL` — ob
// 23505 an `audit_pkey`, 23505 an einem anderen Schlüssel oder ein gewöhnlicher `Error`. Der Rumpf
// ordnet also nichts zu. Deshalb steht hier zuerst eine DIAGNOSE AM AUSLÖSER:
//
// HEUTIGER SERIALISIERTER NACHFOLGER: (1) behält die vollen 303 Anlagen bei offenem Graphen,
// Anmeldung/Stufe 2, Serverprozess und Treiberdiagnose. Jede Nicht201 bleibt rot; jede 201 muss
// genau EIN KO zur eigenen Titelkennung und genau EINEN passenden ko.created-Beleg tragen.
//
// (2) bindet EINEN echten Pending-POST an den öffentlichen Backend-PID seines eigenen App-Pools.
// Der unabhängige Halter schreibt über AuditService.record/withPgTx und hält damit die öffentliche
// AUDIT_KETTENSPERRE. Vor seiner Freigabe muss genau dieser POST-Backend an genau diesem Schlüssel
// auf genau diesen Halter warten (pg_stat_activity/pg_locks/pg_blocking_pids), ohne fertige Antwort.
// Nach tatsächlichem COMMIT folgen 201, KO+Beleg, gültige/lückenlose Kette und Halterbeleg VOR
// Anlegebeleg. Weitere legitime Schreiber dürfen dazwischen stehen. Die Gegenprobe bleibt.
//
// HISTORIE: f4571f58/.690 lieferte die damalige zugeordnete Diagnose/Reproduktion, keine damalige
// Reparatur. Die abgeschlossene Originalakte r7/History/Lieferung bleibt unverändert. Der interne
// Verlauf von 4328 R1 ist weiterhin unbelegt; diese heutigen Fälle ordnen ihn nicht rückwirkend zu.
// Konkreter heutiger Schutz: PgAuditRepo.appendNext nimmt die datenbankweite Kettensperre VOR
// last/insert; KoService.schreibeErstanlage bindet KO und Belege an denselben Transaktionsclient.
// Ein tatsächlicher neuer PG-Lauf muss diesen Nachfolger erst bestätigen.
//
// PRÜFGRENZE, SICHTBAR: ohne PostgreSQL (weder `KLARWERK_PG_TEST_URL` noch Container) oder ohne
// Chromium steht der Grund auf stderr, und der Zeuge sagt, dass nichts belegt ist.
//
// KEINE PRODUKTIVDATEN: die Datenbanken tragen `test` im Namen (`pgUrl`) und werden entfernt.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import {
  AUDIT_KETTENSPERRE,
  AuditService,
  type ChainInspection,
  PgAuditRepo,
  inspectChain,
} from "../../services/audit";
import {
  guardedLocalPgTestUrl,
  pgQueryable,
  vorratsKonfiguration,
  withPgTx,
} from "../../services/db-tx";
import {
  ADMIN as BESTAND_ADMIN,
  PASSWORT as BESTAND_PASSWORT,
  type Verbindung,
  baueBestandAuf,
  pgUrl,
  sende,
  starteKlarwerk,
  zerlege,
} from "../beziehungs-restore-nutzerweg/vorrichtung";
import { type Browser, fn, profil, starteChromium, warte } from "../gast-nutzerweg/browserweg";
import { type Antwort, PASSWORT, starteStrecke } from "../gast-nutzerweg/strecke";
import { stelleFlaecheBereit } from "../gesamtanweisung-nutzerweg/weg";
import {
  type Laufzustand,
  befundsatz,
  zaehltAlsBestanden,
} from "../wiki-gesamtanweisung-abnahme/laufzustand";
import { type PgVorfall, installiere } from "./pg-fehlerdiagnose";
import { MARKE, type Protokoll, baueAuf, fahreStrecke, protokollzeile } from "./strecke";

const STEMPEL = `${Date.now()}`.slice(-8);
const DATENBANK = `klarwerk_wbr_${STEMPEL}_test`;
const DATENBANK_500 = `klarwerk_wbr500_${STEMPEL}_test`;
const DATENBANK_AUSLOESER = `klarwerk_wbrausl_${STEMPEL}_test`;

/** Der Vorlader der Treiberdiagnose für den Serverprozess (absolut, als Datei-URL übergeben). */
const VORLADEN = resolve(
  process.cwd(),
  "tests/wissensbeziehungen-browser-rechte/pg-fehlerdiagnose-vorladen.ts",
);
/** Wie in 4328 R1 (`ZUSATZ_KOS`): 101 Grenzobjekte je Runde — und höchstens drei Runden. */
const AUSLOESER_ANLAGEN = 101;
const AUSLOESER_RUNDEN = 3;

/** Die Nutzlastform der Grenzobjekte aus 4328 R1 (`wissensnetz-nutzerweg/strecke.ts`). */
const grenzobjekt = (nr: string, schlagwort: string) => ({
  title: `Grenzobjekt ${nr}`,
  statement: `Belegsatz des Grenzobjekts ${nr} fuer die Lesegrenze.`,
  type: "best_practice",
  category: "Betrieb",
  confidentiality: "intern",
  tags: [`${schlagwort}-${nr}`],
});

/** Bis das Prüfprotokoll still ist — Nachläufer früherer Anlagen dürfen nicht mitschreiben. */
async function ruhe(pool: Pool): Promise<void> {
  let vorher = -1;
  for (let stabil = 0; stabil < 3; ) {
    await new Promise((weiter) => setTimeout(weiter, 500));
    const r = await pool.query<{ n: number }>("SELECT COALESCE(max(seq), 0)::int AS n FROM audit");
    const n = r.rows[0]?.n ?? 0;
    stabil = n === vorher ? stabil + 1 : 0;
    vorher = n;
  }
}

/** Jede tatsächliche 201 ist an ein KO und genau einen passenden Erstanlagebeleg gebunden. */
async function pruefeAnlagebeleg(pool: Pool, titel: string): Promise<void> {
  const kos = await pool.query<{ id: string }>("SELECT id FROM kos WHERE data->>'title' = $1", [
    titel,
  ]);
  expect(kos.rows, `genau ein KO zur eigenen Titelkennung ${titel}`).toHaveLength(1);
  const id = kos.rows[0]?.id;
  if (!id) throw new Error(`KO-Kennung fehlt: ${titel}`);
  const belege = await pool.query<{ event_id: string; action: string; target: string }>(
    "SELECT event_id,action,target FROM audit WHERE event_id=$1 OR (action='ko.created' AND target=$2)",
    [`ko.created:${id}`, id],
  );
  expect(belege.rows, `genau ein passender ko.created-Beleg zu ${titel}`).toEqual([
    { event_id: `ko.created:${id}`, action: "ko.created", target: id },
  ]);
}

/** Die Diagnose jedes Nicht201 aus (1); kein heutiger Fehler wird als Erfolg gezählt. */
interface Diagnose {
  nr: string;
  status: number;
  rumpf: string;
  koGespeichert: number;
  /** „<SQLSTATE> <constraint>" des gescheiterten Belegs `ko.created:<id>` — oder der Grund, warum keiner da ist. */
  ursache: string;
  seq?: number;
  /** Handlung des erfolgreichen Prüfprotokoll-Eintrags mit derselben `seq`. */
  zweiterSchreiber: string;
  /** Alle gescheiterten SQL-Anfragen im Zeitfenster dieser Anlage — auch die fremden. */
  imFenster: string[];
}

/** Was (1) gemessen hat. */
interface Ausloeser {
  anlagen: number;
  status: Record<string, number>;
  diagnoseZeilen: number;
  auditEintraegeOk: number;
  koMitBeleg: number;
  diagnosen: Diagnose[];
}

interface SperrBeobachtung {
  app_pid: number;
  halter_pid: number;
  datenbank: string;
  lock_key: string;
  waiter_granted: boolean;
  holder_granted: boolean;
  blocker: number[];
  query: string;
}

/** Tatsächlicher heutiger Serialisierungs-/Belegnachweis, kein historisch erzwungener 500. */
interface Alt500 {
  gegenprobe: number;
  ursache: string;
  wartend?: SperrBeobachtung;
  vorFreigabe?: { postImHandler: boolean; antwortBeendet: boolean };
  halterCommit: boolean;
  halterSeq: number | null;
  anlageSeq: number | null;
  status: number;
  rumpf: string;
  koGespeichert: number;
  koCreatedBelege: number;
  folge: number[];
  kettenPruefung: ChainInspection;
}

describe(`${MARKE} · PostgreSQL im echten Chromium`, () => {
  let zustand: Laufzustand | undefined;
  let container: StartedTestContainer | undefined;
  let verwaltung: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let browser: Browser | undefined;
  let pgFassung = "";
  let protokoll: Protokoll | undefined;
  let alt500: Alt500 | undefined;
  let ausloeser: Ausloeser | undefined;

  beforeAll(async () => {
    let url = guardedLocalPgTestUrl() ?? "";
    let quelle = url ? "lokale Testinstanz" : "";
    let grund = "";
    if (!url && process.env.KLARWERK_PG_TEST_URL) {
      grund = "KLARWERK_PG_TEST_URL wurde von der Testdatenbank-Sicherung abgelehnt";
    } else if (!url) {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
        quelle = "Testcontainer postgres:16-alpine";
      } catch (fehler) {
        grund = `weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar (${String(fehler)})`;
      }
    }
    if (url) {
      verbindung = zerlege(url);
      if (!verbindung) {
        grund = "die Test-URL nennt keinen Rechnernamen";
      } else {
        // AB HIER WIRD NICHTS MEHR GEFANGEN: jeder Aufbaufehler färbt rot.
        verwaltung = new Pool({ connectionString: url });
        const v = await verwaltung.query<{ version: string }>("SELECT version() AS version");
        pgFassung = (v.rows[0]?.version ?? "unbekannt").split(" ").slice(0, 2).join(" ");
        await verwaltung.query(`CREATE DATABASE ${DATENBANK}`);
        await verwaltung.query(`CREATE DATABASE ${DATENBANK_500}`);
        await verwaltung.query(`CREATE DATABASE ${DATENBANK_AUSLOESER}`);
        process.stderr.write(`${MARKE}: gebaute Fläche — ${stelleFlaecheBereit()}\n`);
        browser = await starteChromium();
        zustand = { gelaufen: true, quelle: `${quelle}, ${pgFassung}, Datenbank ${DATENBANK}` };
      }
    }
    zustand ??= { gelaufen: false, grund };
    process.stderr.write(befundsatz(`${MARKE.replace("[KLARWERK] ", "")} PG`, zustand));
  }, 900_000);

  afterAll(async () => {
    await browser?.close().catch(() => undefined);
    for (const db of [DATENBANK, DATENBANK_500, DATENBANK_AUSLOESER]) {
      await verwaltung?.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
    }
    await verwaltung?.end().catch(() => undefined);
    await container?.stop().catch(() => undefined);
    process.stderr.write(befundsatz(`${MARKE.replace("[KLARWERK] ", "")} PG`, zustand));
    if (protokoll) {
      process.stderr.write(`${protokollzeile(protokoll)} PostgreSQL=${pgFassung}\n`);
    }
    if (ausloeser) {
      process.stderr.write(`${MARKE} ALT-500-AUSLOESER: ${JSON.stringify(ausloeser)}\n`);
    }
    if (alt500) {
      process.stderr.write(`${MARKE} ALT-500: ${JSON.stringify(alt500)}\n`);
    }
  }, 300_000);

  it("Tastatur, 360 px, Neuladen, Widerruf und Rechteentzug gegen PostgreSQL — nachgelesen an ko_kanten", async () => {
    if (!zaehltAlsBestanden(zustand) || !verbindung || !browser) {
      process.stderr.write(befundsatz(`${MARKE.replace("[KLARWERK] ", "")} PG`, zustand));
      return;
    }
    const pool = createPool(pgUrl(verbindung, DATENBANK));
    pool.on("error", (fehler) => {
      process.stderr.write(`${MARKE} HINWEIS: Verbindung endete — ${String(fehler)}\n`);
    });
    await migrate(pool);
    const aufbau = await baueAuf(pool);
    try {
      protokoll = await fahreStrecke({ browser, aufbau, pool });
      expect(protokoll.pgStatus, "ko_kanten: gesetzt → widerrufen; verborgen bleibt aktiv").toEqual(
        ["aktiv", "widerrufen", "aktiv"],
      );
      expect(protokoll.kachelnAnker).toEqual([2, 2, 1]);
      expect(protokoll.controllerFlaeche).toEqual([1, 0]);
      expect(protokoll.controllerApi).toEqual([1, 0]);
      expect(aufbau.serverfehler, "Serverfehler während der ganzen Strecke").toEqual([]);
    } finally {
      await aufbau.strecke.schliessen();
      await pool.end().catch(() => undefined);
    }
  }, 1_200_000);

  it("ALT-500-AUSLÖSER · heutiger Nachfolger: 303 Anlagen mit offenem Graphen, jede 201 mit genau einem KO und ko.created-Beleg", async () => {
    if (!zaehltAlsBestanden(zustand) || !verbindung || !browser) {
      process.stderr.write(
        befundsatz(`${MARKE.replace("[KLARWERK] ", "")} PG ALT-500-AUSLOESER`, zustand),
      );
      return;
    }
    const url = pgUrl(verbindung, DATENBANK_AUSLOESER);
    const ordner = mkdtempSync(join(tmpdir(), "wbr-alt500-"));
    const protokolldatei = join(ordner, "pg-vorfaelle.jsonl");
    writeFileSync(protokolldatei, "");
    const instanz = await starteKlarwerk({
      datenbankUrl: url,
      was: "ALT-500-Auslöser",
      zusatz: {
        importe: [pathToFileURL(VORLADEN).href],
        env: { KLARWERK_TEST_PG_DIAGNOSE: protokolldatei },
      },
    });
    const lese = new Pool({ connectionString: url, max: 2 });
    const { kontext, seite } = await profil(browser, { width: 1280, height: 900 });
    try {
      const bestand = await baueBestandAuf(instanz.basis);
      const token = bestand.adminToken;

      // Anmeldung und Stufe 2 über die Fläche, dann /graph offen — wie in 4328 (Stationen a, f).
      await seite.goto(`${instanz.basis}/`, { waitUntil: "domcontentloaded" });
      await warte(seite, `() => !!document.querySelector("#auth-email")`, "die Anmeldemaske steht");
      await seite.fill("#auth-email", BESTAND_ADMIN.email);
      await seite.fill("#auth-password", BESTAND_PASSWORT);
      await seite.keyboard.press("Enter");
      await warte(
        seite,
        '() => !document.querySelector("#auth-email")',
        "die Anmeldung des Admins trägt",
        undefined,
        45_000,
      );
      await seite.goto(`${instanz.basis}/admin?bereich=system`, { waitUntil: "domcontentloaded" });
      const schalter = '[data-testid="zeile-stufe2"] input[type="checkbox"]';
      await warte(
        seite,
        "(s) => !!document.querySelector(s)",
        "Stufe-2-Schalter",
        schalter,
        45_000,
      );
      if (
        !(await seite.evaluate<boolean>(fn("(s) => document.querySelector(s).checked"), schalter))
      ) {
        await seite.click(schalter);
      }
      await warte(
        seite,
        `() => { try { return localStorage.getItem("kw.stufe2.v1") === "1"; } catch (e) { return false; } }`,
        "Stufe 2 ist eingeschaltet",
      );
      const graphSteht = async (): Promise<void> =>
        warte(
          seite,
          `() => document.querySelectorAll('[data-testid="graph-kante-kuratiert"]').length >= 1`,
          "die /graph-Seite zeigt Fachkanten",
          undefined,
          90_000,
        );
      await seite.goto(`${instanz.basis}/graph`, { waitUntil: "domcontentloaded" });
      await graphSteht();

      const anlagen: { nr: string; status: number; text: string; von: number; bis: number }[] = [];
      for (let runde = 0; runde < AUSLOESER_RUNDEN; runde += 1) {
        if (runde > 0) {
          await seite.reload({ waitUntil: "domcontentloaded" });
          await graphSteht();
        }
        for (let i = 0; i < AUSLOESER_ANLAGEN; i += 1) {
          const nr = String(runde * 1000 + i).padStart(4, "0");
          const von = Date.now();
          const r = await sende(
            instanz.basis,
            "POST",
            "/api/kos",
            token,
            grenzobjekt(nr, "wbr-ausloeser"),
          );
          anlagen.push({ nr, status: r.status, text: r.text.slice(0, 200), von, bis: Date.now() });
        }
      }
      await ruhe(lese);

      const vorfaelle = readFileSync(protokolldatei, "utf8")
        .split("\n")
        .filter((z) => z.trim() !== "")
        .map((z) => JSON.parse(z) as PgVorfall);
      const diagnosen: Diagnose[] = [];
      for (const a of anlagen.filter((x) => x.status !== 201)) {
        const ids = (
          await lese.query<{ id: string }>("SELECT id FROM kos WHERE data->>'title' = $1", [
            `Grenzobjekt ${a.nr}`,
          ])
        ).rows.map((z) => z.id);
        const eigen = vorfaelle.find(
          (v) => !v.ok && ids.some((id) => v.eventId === `ko.created:${id}`),
        );
        const zweiter = eigen
          ? vorfaelle.find((v) => v.ok && v.seq === eigen.seq && v.handlung !== undefined)
          : undefined;
        diagnosen.push({
          nr: a.nr,
          status: a.status,
          rumpf: a.text,
          koGespeichert: ids.length,
          ursache: eigen
            ? `${eigen.code ?? "?"} ${eigen.constraint ?? "?"}`
            : ids.length === 0
              ? "kein Eintrag in kos — gescheitert VOR dem Einfügen, nicht am Beleg"
              : "kein gescheiterter Beleg ko.created dieser Anlage — Ursache ausserhalb dieses Schritts",
          ...(eigen?.seq !== undefined ? { seq: eigen.seq } : {}),
          zweiterSchreiber: zweiter?.handlung ?? "(nicht gefunden)",
          imFenster: vorfaelle
            .filter((v) => !v.ok && v.t >= a.von && v.t <= a.bis)
            .map((v) => `${v.code ?? "?"} ${v.constraint ?? ""} ${v.sql.slice(0, 60)}`),
        });
      }
      const status: Record<string, number> = {};
      for (const a of anlagen) {
        status[String(a.status)] = (status[String(a.status)] ?? 0) + 1;
      }
      ausloeser = {
        anlagen: anlagen.length,
        status,
        diagnoseZeilen: vorfaelle.length,
        auditEintraegeOk: vorfaelle.filter((v) => v.ok && v.seq !== undefined).length,
        koMitBeleg: 0,
        diagnosen,
      };

      // DER ZEUGE DER DIAGNOSE: ohne Zeilen war sie nicht aktiv — dann sagte ihr Schweigen nichts.
      expect(
        ausloeser.auditEintraegeOk,
        "die Treiberdiagnose im Serverprozess hat keinen einzigen Prüfprotokoll-Eintrag gesehen — sie war nicht aktiv",
      ).toBeGreaterThan(0);
      for (const a of anlagen.filter((a) => a.status === 201)) {
        await pruefeAnlagebeleg(lese, `Grenzobjekt ${a.nr}`);
        ausloeser.koMitBeleg += 1;
      }
      expect(anlagen).toHaveLength(AUSLOESER_RUNDEN * AUSLOESER_ANLAGEN);
      expect(status, `${MARKE}: jede Nicht201 bleibt rot: ${JSON.stringify(diagnosen)}`).toEqual({
        "201": AUSLOESER_RUNDEN * AUSLOESER_ANLAGEN,
      });
      expect(ausloeser.koMitBeleg, "jede 201 mit genau einem KO und passendem Beleg").toBe(
        anlagen.length,
      );
      expect(
        diagnosen,
        "keine heutige Anlage fehlgeschlagen; historische Diagnose bleibt erhalten",
      ).toEqual([]);
    } finally {
      await kontext.close().catch(() => undefined);
      await instanz.beende();
      await lese.end().catch(() => undefined);
      rmSync(ordner, { recursive: true, force: true });
    }
  }, 1_800_000);

  it("ALT-500 · serialisierter Nachfolger: echter POST wartet am Halter der Kettensperre, danach 201 und vollständiger Beleg", async () => {
    if (!zaehltAlsBestanden(zustand) || !verbindung || !verwaltung) {
      process.stderr.write(befundsatz(`${MARKE.replace("[KLARWERK] ", "")} PG ALT-500`, zustand));
      return;
    }
    const v = verwaltung;
    const url = pgUrl(verbindung, DATENBANK_500);
    // Gelesener Caller: Auth vor der Erstanlage; Insert/Snapshot/Projektion/Audit verwenden
    // denselben tx. Nur dieser App-Pool hat Größe 1, die normalen Warte-/Idlegrenzen bleiben.
    const pool = new Pool({ ...vorratsKonfiguration(url), max: 1 });
    pool.on("error", (fehler) => {
      process.stderr.write(`${MARKE} HINWEIS: Verbindung endete — ${String(fehler)}\n`);
    });
    const halterPool = new Pool({ ...vorratsKonfiguration(url), max: 1 });
    let strecke: Awaited<ReturnType<typeof starteStrecke>> | undefined;
    let antwort: Promise<Antwort> | undefined;
    let entferne: (() => void) | undefined;
    let wartend: SperrBeobachtung | undefined;
    let vorFreigabe: { postImHandler: boolean; antwortBeendet: boolean } | undefined;
    let halterSeq: number | undefined;
    let halterCommit = false;
    let postImHandler = false;
    let antwortBeendet = false;
    const vorfaelle: PgVorfall[] = [];
    const fehler: unknown[] = [];
    try {
      await migrate(pool);
      strecke = await starteStrecke({
        pool,
        vorListen: async (app) => {
          // Öffentlicher Hook: nur der Eintritt DIESER echten Anfrage wird beobachtet.
          app.addHook("preHandler", (request, _reply, done) => {
            if (
              request.method === "POST" &&
              request.url === "/api/kos" &&
              (request.body as { title?: unknown } | undefined)?.title === "Grenzobjekt 0002"
            ) {
              postImHandler = true;
            }
            done();
          });
        },
      });
      entferne = installiere((x) => vorfaelle.push(x));
      const admin = strecke.profil("admin");
      const setup = await admin.sende("POST", "/api/auth/setup", {
        name: "Alt500 Admin",
        email: "wbr-alt500@graph-browser-rechte.test",
        password: PASSWORT,
      });
      expect(setup.status, setup.text).toBe(201);
      const koIdZuTitel = async (titel: string): Promise<string[]> =>
        (
          await pool.query<{ id: string }>("SELECT id FROM kos WHERE data->>'title' = $1", [titel])
        ).rows.map((r) => r.id);

      // Gegenprobe und alle App-Abfragen VOR der Sperrphase.
      const frei = await admin.sende("POST", "/api/kos", grenzobjekt("0000", "wbr-alt500"));
      expect(frei.status, frei.text.slice(0, 300)).toBe(201);
      const freiId = (frei.json as { id: string }).id;
      await pruefeAnlagebeleg(pool, "Grenzobjekt 0000");
      expect(await koIdZuTitel("Grenzobjekt 0000")).toEqual([freiId]);
      await ruhe(pool);

      const appClient = await pool.connect();
      let appBackendId: number;
      try {
        const pid = await appClient.query<{ pid: number; datenbank: string }>(
          "SELECT pg_backend_pid() AS pid,current_database() AS datenbank",
        );
        expect(pid.rows[0]?.datenbank).toBe(DATENBANK_500);
        const id = pid.rows[0]?.pid;
        if (!id) throw new Error("App-Backend-PID fehlt.");
        appBackendId = id;
      } finally {
        appClient.release();
      }
      expect(pool.totalCount).toBe(1);
      expect(pool.idleCount).toBe(1);
      expect(pool.waitingCount).toBe(0);

      const halter = new AuditService({ repo: new PgAuditRepo(halterPool) });
      await withPgTx(halterPool, async (tx) => {
        const pid = await pgQueryable(tx).query<{ pid: number; datenbank: string }>(
          "SELECT pg_backend_pid() AS pid,current_database() AS datenbank",
        );
        expect(pid.rows[0]?.datenbank).toBe(DATENBANK_500);
        const halterBackendId = pid.rows[0]?.pid;
        if (!halterBackendId) throw new Error("Halter-Backend-PID fehlt.");
        expect(halterBackendId).not.toBe(appBackendId);
        const eintrag = await halter.record(
          { actor: "wbr-alt500-halter", action: "alt500.gleichzeitig", target: "audit" },
          tx,
        );
        halterSeq = eintrag.seq;
        antwort = admin.sende("POST", "/api/kos", grenzobjekt("0002", "wbr-alt500"));
        // Nur den realen Promise beobachten; das Original wird nach Commit und im finally erwartet.
        void antwort.then(
          () => {
            antwortBeendet = true;
          },
          () => {
            antwortBeendet = true;
          },
        );
        const frist = Date.now() + 30_000;
        while (Date.now() < frist && !wartend) {
          expect(antwortBeendet, "POST darf unter gehaltenem Halterlock nicht fertig sein").toBe(
            false,
          );
          // Ausschließlich der unabhängige Verwaltungsleser, niemals der blockierte App-Pool.
          const r = await v.query<SperrBeobachtung>(
            `SELECT w.pid AS app_pid,h.pid AS halter_pid,w.datname AS datenbank,
                    wl.objid::text AS lock_key,wl.granted AS waiter_granted,
                    hl.granted AS holder_granted,pg_blocking_pids(w.pid) AS blocker,w.query
               FROM pg_stat_activity w
               JOIN pg_stat_activity h ON h.pid=$2 AND h.datid=w.datid
               JOIN pg_locks wl ON wl.pid=w.pid AND wl.locktype='advisory'
               JOIN pg_locks hl ON hl.pid=h.pid AND hl.locktype=wl.locktype
                AND hl.database=wl.database AND hl.classid=wl.classid AND hl.objid=wl.objid
                AND hl.objsubid=wl.objsubid AND hl.mode=wl.mode
              WHERE w.pid=$1 AND w.datname=$3 AND h.datname=$3
                AND wl.database=w.datid AND wl.classid=0 AND wl.objid=$4::oid AND wl.objsubid=1
                AND wl.mode='ExclusiveLock' AND NOT wl.granted AND hl.granted
                AND w.state='active' AND w.wait_event_type='Lock' AND w.query=$5
                AND h.pid=ANY(pg_blocking_pids(w.pid))`,
            [
              appBackendId,
              halterBackendId,
              DATENBANK_500,
              AUDIT_KETTENSPERRE,
              `SELECT pg_advisory_xact_lock(${AUDIT_KETTENSPERRE})`,
            ],
          );
          // Mit Größe 1 und eingetretenem POST darf keine Anfrage hinter einem Hintergrundclient
          // am Pool warten; der belegte Backend muss DIESER Anfrage gehören.
          if (
            postImHandler &&
            pool.waitingCount === 0 &&
            pool.idleCount === 0 &&
            r.rows.length === 1
          ) {
            wartend = r.rows[0];
          }
          if (!wartend) await new Promise((weiter) => setTimeout(weiter, 50));
        }
        expect(
          wartend,
          `kein exakter Pending-POST/Halter an ${DATENBANK_500}/${AUDIT_KETTENSPERRE}, App=${appBackendId}, Halter=${halterBackendId}`,
        ).toBeDefined();
        expect(wartend).toMatchObject({
          app_pid: appBackendId,
          halter_pid: halterBackendId,
          datenbank: DATENBANK_500,
          lock_key: String(AUDIT_KETTENSPERRE),
          waiter_granted: false,
          holder_granted: true,
          query: `SELECT pg_advisory_xact_lock(${AUDIT_KETTENSPERRE})`,
        });
        expect(wartend?.blocker).toContain(halterBackendId);
        vorFreigabe = { postImHandler, antwortBeendet };
        expect(vorFreigabe).toEqual({ postImHandler: true, antwortBeendet: false });
      });
      halterCommit = true; // withPgTx hat sein tatsächliches COMMIT abgewartet.
      if (!antwort) throw new Error("Der echte POST wurde nicht gestartet.");
      const r = await antwort;
      await ruhe(pool);
      const ids = await koIdZuTitel("Grenzobjekt 0002");
      const eigen = vorfaelle.find(
        (x) => !x.ok && ids.some((id) => x.eventId === `ko.created:${id}`),
      );
      const eintraege = await new PgAuditRepo(pool).all();
      const belege = eintraege.filter((e) =>
        ids.some(
          (id) =>
            e.eventId === `ko.created:${id}` || (e.action === "ko.created" && e.target === id),
        ),
      );
      const folge = eintraege.map((e) => e.seq);
      const kettenPruefung = inspectChain(eintraege);
      alt500 = {
        gegenprobe: frei.status,
        ursache: eigen
          ? `${eigen.code ?? "?"} ${eigen.constraint ?? "?"}`
          : "(kein gescheiterter Beleg)",
        ...(wartend ? { wartend } : {}),
        ...(vorFreigabe ? { vorFreigabe } : {}),
        halterCommit,
        halterSeq: halterSeq ?? null,
        anlageSeq: belege[0]?.seq ?? null,
        status: r.status,
        rumpf: r.text.slice(0, 200),
        koGespeichert: ids.length,
        koCreatedBelege: belege.length,
        folge,
        kettenPruefung,
      };
      expect(r.status, `${MARKE} ALT-500: ${JSON.stringify(alt500)}`).toBe(201);
      await pruefeAnlagebeleg(pool, "Grenzobjekt 0002");
      expect(ids).toEqual([(r.json as { id: string }).id]);
      expect(belege).toHaveLength(1);
      expect(
        vorfaelle.some((x) => x.ok && x.seq !== undefined),
        "Treiberdiagnose war aktiv",
      ).toBe(true);
      expect(eigen, "kein fehlgeschlagener Beleg der erfolgreichen Anlage").toBeUndefined();
      expect(new Set(folge).size, "keine doppelte seq").toBe(folge.length);
      expect(folge, "die Folge bleibt lückenlos").toEqual(folge.map((_, i) => i + 1));
      expect(kettenPruefung.ok, JSON.stringify(kettenPruefung)).toBe(true);
      expect(kettenPruefung.linkageBreaks, "öffentliche inspectChain-Linkageprüfung").toBe(0);
      const halterBelege = eintraege.filter(
        (e) =>
          e.actor === "wbr-alt500-halter" &&
          e.action === "alt500.gleichzeitig" &&
          e.target === "audit",
      );
      expect(halterBelege).toHaveLength(1);
      expect(halterBelege[0]?.seq).toBe(halterSeq);
      if (halterSeq === undefined || !belege[0]) throw new Error("Halter-/Anlagebeleg fehlt.");
      expect(
        halterSeq,
        "Halter tatsächlich vor Anlage, ohne direkte Nachbarschaft zu erzwingen",
      ).toBeLessThan(belege[0].seq);
    } catch (error) {
      fehler.push(error);
    } finally {
      if (antwort) {
        try {
          const r = await antwort;
          if (!alt500) {
            process.stderr.write(
              `${MARKE} ALT-500-Abbruch: ${JSON.stringify({
                status: r.status,
                rumpf: r.text.slice(0, 200),
                wartend,
                vorFreigabe,
                sqlFehler: vorfaelle.filter((x) => !x.ok),
              })}\n`,
            );
          }
        } catch (error) {
          if (!fehler.includes(error)) fehler.push(error);
        }
      }
      try {
        entferne?.();
      } catch (error) {
        fehler.push(error);
      }
      try {
        await strecke?.schliessen();
      } catch (error) {
        fehler.push(error);
      }
      for (const p of [halterPool, pool]) {
        try {
          await p.end();
        } catch (error) {
          fehler.push(error);
        }
      }
    }
    if (fehler.length)
      throw new AggregateError(fehler, "ALT-500-Nachfolger oder Abschluss fehlgeschlagen.", {
        cause: fehler[0],
      });
  }, 300_000);

  it("Zeuge: der Lauf sagt selbst, ob er gelaufen ist — ein Skip ist kein Grün", () => {
    process.stderr.write(befundsatz(`${MARKE.replace("[KLARWERK] ", "")} PG ZEUGE`, zustand));
    expect(zustand, "beforeAll hat keinen Laufzustand hinterlassen").toBeDefined();
    if (!zaehltAlsBestanden(zustand)) {
      expect(protokoll, "ohne Voraussetzungen darf kein Protokoll entstanden sein").toBeUndefined();
      expect(ausloeser, "ohne Voraussetzungen keine Auslöser-Messung").toBeUndefined();
      expect(alt500, "ohne Voraussetzungen keine ALT-500-Messung").toBeUndefined();
      return;
    }
    expect(
      protokoll,
      "die Voraussetzungen lagen vor — dann MUSS die Strecke gefahren sein",
    ).toBeDefined();
    expect(protokoll?.ablage).toBe("PostgreSQL");
    expect(
      ausloeser,
      "die Voraussetzungen lagen vor — dann MUSS ALT-500-AUSLÖSER gemessen haben",
    ).toBeDefined();
    expect(
      alt500,
      "die Voraussetzungen lagen vor — dann MUSS ALT-500 gemessen haben",
    ).toBeDefined();
  });
});
