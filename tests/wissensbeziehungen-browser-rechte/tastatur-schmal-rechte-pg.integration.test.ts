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
// (1) ALT-500-AUSLÖSER — der historische Ablauf, so nah wie ausführbar: eigener Serverprozess über
//     `starteKlarwerk`, derselbe Bestand (`baueBestandAuf`), Anmeldung und Stufe 2 im Browser,
//     `/graph` offen, dann Grenzobjekte NACHEINANDER in der Nutzlastform von 4328 (bis zu
//     `AUSLOESER_RUNDEN` × `AUSLOESER_ANLAGEN`). IM Serverprozess liegt die Treiberdiagnose
//     (`pg-fehlerdiagnose-vorladen.ts`): jede gescheiterte SQL-Anfrage mit SQLSTATE und
//     Constraint, jedes `INSERT INTO audit` mit `seq`, Handlung und Ereigniskennung. Für JEDEN 500
//     wird daraus die Ursache gelesen: der gescheiterte Prüfprotokoll-Eintrag `ko.created:<id>`
//     GENAU DIESER Anlage (Kennung über den Titel in `kos`), und der erfolgreiche Eintrag mit
//     derselben `seq` benennt den zweiten Schreiber. Tritt kein 500 auf, ist der Fall ROT mit
//     „nicht reproduziert — Zuordnung offen"; eine andere Ursache macht ihn ROT mit dieser Ursache.
//     Nur „jeder 500 = 23505 an audit_pkey im Beleg dieser Anlage" ist grün.
//
// (2) ALT-500 — die MINIMALE Reproduktion des in (1) diagnostizierten Mechanismus: EIN
//     `POST /api/kos` über HTTP, ohne Browser, deterministisch (Technik aus
//     `tests/pg-erstaufbau-konkurrenz/erstaufbau-konkurrenz.integration.test.ts`, Fall E3):
//       (a) ein zweiter Schreiber legt in OFFENER Transaktion einen Prüfprotokoll-Eintrag an
//           (`AuditService.record`, seq = n+1, noch nicht festgeschrieben);
//       (b) die Anlage liest `last()` (sieht den offenen Eintrag nicht, MVCC), rechnet ebenfalls
//           n+1, und ihr INSERT wartet am Primärschlüssel — gemessen in `pg_stat_activity`;
//       (c) der zweite Schreiber schreibt fest → die Anlage scheitert.
//     Belegt wird dieselbe INTERNE Ursache wie in (1) — per Treiberdiagnose im Testprozess:
//     23505 an `audit_pkey` am Eintrag `ko.created:<id>` dieser Anlage —, dazu der Fingerabdruck
//     (Eintrag in `kos`, Beleg fehlt) und die Gegenprobe ohne zweiten Schreiber (201 samt Beleg).
//
// DIE ZUORDNUNG ENTSTEHT ERST AUS BEIDEN: (1) verbindet den historischen Auslöser mit der inneren
// Ursache, (2) reproduziert genau diese Ursache minimal. Ohne ein grünes (1) ist die
// Prüfprotokoll-Kollision nur ein KANDIDAT — so steht es dann auch in der Rückgabe. Was auch ein
// grünes (1) nicht belegt: dass der Lauf von 4328 R1 selbst genau diesen Verlauf hatte; belegt ist,
// dass sein Ablauf HEUTE diese Ursache auslöst.
//
// DER CODE, an dem die Ursache hängt: `AuditService.record`/`recordOnce`
// (`services/audit/src/service.ts`) vergeben `seq` als `last()` → `seq + 1` ohne Serialisierung;
// `audit.seq` ist Primärschlüssel, `appendOnce` fängt nur `event_id` ab. Auf Dienstebene steht die
// Kollision seit `ad4c957d` (JOB 4271 Befund 3, Fall E3) als „REPRODUZIERTER REST, NICHT BEHOBEN".
// Ein schliessender Nachfolger existiert im Stand dieses Zweigs nicht.
//
// WENN (2) ROT WIRD, WEIL DIE ANLAGE 201 LIEFERT: dann ist die Folge serialisiert (z. B.
// `pg_advisory_xact_lock` in `PgAuditRepo` oder `seq` aus der Datenbank). Das ist der schliessende
// Nachfolger — dann beide Fälle auf „geschlossen durch <Commit>" umstellen, nicht abschwächen.
// (Eine rein prozessinterne Warteschlange schliesst (2) NICHT: der zweite Schreiber ist ein
// eigener Client, wie eine zweite Instanz.)
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
import { AuditService, PgAuditRepo } from "../../services/audit";
import { guardedLocalPgTestUrl, withPgTx } from "../../services/db-tx";
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
import { PASSWORT, starteStrecke } from "../gast-nutzerweg/strecke";
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
/** Die einzige Ursache, die (1) grün macht. */
const AUDIT_KOLLISION = "23505 audit_pkey";

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

/** Die Diagnose eines einzelnen 500 aus (1). */
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
  diagnosen: Diagnose[];
}

/** Was Fall ALT-500 gemessen hat — steht als Zeile auf stderr und im Zeugen. */
interface Alt500 {
  gegenprobe: number;
  /** Die interne Ursache laut Treiberdiagnose im Testprozess. */
  ursache: string;
  wartend: string;
  status: number;
  rumpf: string;
  koGespeichert: number;
  belegFehlt: boolean;
  folge: number[];
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

  it("ALT-500-AUSLÖSER · der historische Ablauf mit interner Diagnose: eigener Serverprozess, /graph offen, Grenzobjekte nacheinander — jeder 500 mit SQLSTATE, Constraint und zweitem Schreiber", async () => {
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
      for (
        let runde = 0;
        runde < AUSLOESER_RUNDEN && !anlagen.some((a) => a.status >= 500);
        runde += 1
      ) {
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
      for (const a of anlagen.filter((x) => x.status >= 500)) {
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
        diagnosen,
      };

      // DER ZEUGE DER DIAGNOSE: ohne Zeilen war sie nicht aktiv — dann sagte ihr Schweigen nichts.
      expect(
        ausloeser.auditEintraegeOk,
        "die Treiberdiagnose im Serverprozess hat keinen einzigen Prüfprotokoll-Eintrag gesehen — sie war nicht aktiv",
      ).toBeGreaterThan(0);
      expect(
        diagnosen.length,
        `${MARKE} ALT-500-AUSLÖSER: in ${anlagen.length} Anlagen bei offener /graph-Seite kein 500 (${JSON.stringify(status)}). Der historische Fall ist damit NICHT reproduziert und NICHT zugeordnet — die Prüfprotokoll-Kollision bleibt ein Kandidat; das ist auch kein Beleg einer Schliessung.`,
      ).toBeGreaterThan(0);
      expect(
        diagnosen.map((d) => d.ursache),
        `${MARKE} ALT-500-AUSLÖSER: mindestens ein 500 hat eine ANDERE innere Ursache als die Prüfprotokoll-Kollision — das ist ein eigener, belegter Befund: ${JSON.stringify(diagnosen)}`,
      ).toEqual(diagnosen.map(() => AUDIT_KOLLISION));
    } finally {
      await kontext.close().catch(() => undefined);
      await instanz.beende();
      await lese.end().catch(() => undefined);
      rmSync(ordner, { recursive: true, force: true });
    }
  }, 1_800_000);

  it("ALT-500 · minimal reproduziert: EIN POST /api/kos scheitert an 23505 audit_pkey (intern diagnostiziert), wenn ein gleichzeitiger Prüfprotokoll-Eintrag dieselbe seq belegt", async () => {
    if (!zaehltAlsBestanden(zustand) || !verbindung || !verwaltung) {
      process.stderr.write(befundsatz(`${MARKE.replace("[KLARWERK] ", "")} PG ALT-500`, zustand));
      return;
    }
    const v = verwaltung;
    const url = pgUrl(verbindung, DATENBANK_500);
    const pool = createPool(url);
    pool.on("error", (fehler) => {
      process.stderr.write(`${MARKE} HINWEIS: Verbindung endete — ${String(fehler)}\n`);
    });
    const halterPool = new Pool({ connectionString: url, max: 1 });
    await migrate(pool);
    const strecke = await starteStrecke({ pool });
    // Dieselbe Treiberdiagnose wie im Serverprozess von (1) — hier im Testprozess, weil die
    // Anwendung hier im Testprozess läuft. Sie wird am Ende wieder entfernt.
    const vorfaelle: PgVorfall[] = [];
    const entferne = installiere((x) => vorfaelle.push(x));
    try {
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
      const hatBeleg = async (id: string): Promise<boolean> =>
        (
          await pool.query<{ n: number }>(
            "SELECT count(*)::int AS n FROM audit WHERE event_id = $1",
            [`ko.created:${id}`],
          )
        ).rows[0]?.n === 1;

      // GEGENPROBE: dieselbe Anlage ohne zweiten Schreiber → 201 samt Beleg.
      const frei = await admin.sende("POST", "/api/kos", grenzobjekt("0000", "wbr-alt500"));
      expect(frei.status, frei.text.slice(0, 300)).toBe(201);
      const freiId = (frei.json as { id: string }).id;
      expect(await hatBeleg(freiId), "Gegenprobe: Beleg ko.created vorhanden").toBe(true);
      await ruhe(pool);

      // (a)–(c): der zweite Schreiber hält seinen Eintrag offen, bis die Anlage an ihm wartet.
      const halter = new AuditService({ repo: new PgAuditRepo(halterPool) });
      let antwort: ReturnType<typeof admin.sende> | undefined;
      let wartend = "";
      await withPgTx(halterPool, async (tx) => {
        await halter.record(
          { actor: "wbr-alt500-halter", action: "alt500.gleichzeitig", target: "audit" },
          tx,
        );
        antwort = admin.sende("POST", "/api/kos", grenzobjekt("0002", "wbr-alt500"));
        const frist = Date.now() + 30_000;
        while (Date.now() < frist && !wartend) {
          const r = await v.query<{ q: string }>(
            `SELECT query AS q FROM pg_stat_activity
              WHERE datname = $1 AND wait_event_type = 'Lock' AND query ILIKE 'INSERT INTO audit%'`,
            [DATENBANK_500],
          );
          wartend = r.rows[0]?.q.replace(/\s+/g, " ").slice(0, 80) ?? "";
          if (!wartend) await new Promise((weiter) => setTimeout(weiter, 50));
        }
      });
      const r = await (antwort as ReturnType<typeof admin.sende>);
      await ruhe(pool);
      const ids = await koIdZuTitel("Grenzobjekt 0002");
      const eigen = vorfaelle.find(
        (x) => !x.ok && ids.some((id) => x.eventId === `ko.created:${id}`),
      );
      const folge = (
        await pool.query<{ seq: number }>("SELECT seq FROM audit ORDER BY seq")
      ).rows.map((z) => z.seq);
      alt500 = {
        gegenprobe: frei.status,
        ursache: eigen
          ? `${eigen.code ?? "?"} ${eigen.constraint ?? "?"}`
          : "(kein gescheiterter Beleg)",
        wartend,
        status: r.status,
        rumpf: r.text.slice(0, 200),
        koGespeichert: ids.length,
        belegFehlt: ids.length === 1 ? !(await hatBeleg(ids[0] as string)) : false,
        folge,
      };

      expect(
        wartend,
        "die Anlage wartete nie am INSERT INTO audit — die Überlappung kam nicht zustande, der Fall sagt nichts",
      ).not.toBe("");
      expect(
        r.status,
        `${MARKE} ALT-500: die Anlage lieferte ${r.status} statt 500. Liefert sie 201, ist die Prüfprotokoll-Folge serialisiert — dann ist der Altbefund durch diesen Nachfolger GESCHLOSSEN; beide Fälle darauf umstellen, nicht abschwächen. Rumpf: ${r.text.slice(0, 200)}`,
      ).toBe(500);
      expect((r.json as { error?: string }).error, "Rumpf").toBe("INTERNAL");
      expect(
        alt500.ursache,
        "die INNERE Ursache dieses 500 (Treiberdiagnose am Beleg ko.created dieser Anlage) — dieselbe, die ALT-500-AUSLÖSER am historischen Ablauf verlangt",
      ).toBe(AUDIT_KOLLISION);
      expect(
        { koGespeichert: alt500.koGespeichert, belegFehlt: alt500.belegFehlt },
        "Fingerabdruck: der Eintrag steht in kos, sein Beleg ko.created fehlt",
      ).toEqual({ koGespeichert: 1, belegFehlt: true });
      expect(new Set(folge).size, "keine doppelte seq").toBe(folge.length);
      expect(
        folge,
        "die Folge bleibt lückenlos — der Verlierer hinterlässt keinen halben Eintrag",
      ).toEqual(folge.map((_, i) => i + 1));
    } finally {
      entferne();
      await strecke.schliessen();
      await halterPool.end().catch(() => undefined);
      await pool.end().catch(() => undefined);
    }
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
