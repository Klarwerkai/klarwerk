import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import {
  AKTION_WIEDERANLAUF_FREIGEGEBEN,
  FREIGABE_BESTAETIGUNGEN,
  registriereWiederanlauf,
} from "../../services/app/src/wiederanlauf";
import {
  KENNUNG_HEADER,
  type WebhookZiel,
  WissensereignisMelder,
  type WissensereignisQuellen,
} from "../../services/app/src/wissensereignisse";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  KENNWORT,
  KONTEN,
  anmelden,
  legeFiktivenBestand,
} from "../wiederherstellung-export/bestand";

// ==================================================================================================
// produkt:20261011:peter-p09 · P09-AC03 / AC04 (dazu AC05/AC06 am echten Restore) — DIE MESSPROBE.
// ==================================================================================================
//
// Peters Entscheidung 45, PoC-Nachweis: „vollständig gekennzeichneten Testbestand sichern, isoliert
// wiederherstellen und Verluste/Wiederanlaufzeit messen." Nichts davon ist eine zweite Strecke:
// gesichert wird mit dem UNVERÄNDERTEN `scripts/backup/backup.sh`, wiederhergestellt mit dem
// UNVERÄNDERTEN `scripts/backup/restore-drill.sh` (wie PV-01, `tests/wiederherstellung-export/`),
// wiederangelaufen mit `registriereWiederanlauf` — derselbe Aufbau, den `server.ts` mit
// `KLARWERK_WIEDERANLAUF` fährt.
//
// DER ABLAUF, mit fiktiven Daten an eigenen Wegwerfdatenbanken (`test` im Namen):
//   1. Bestand über die echte Anwendung (fünf Rollen, zwei Spaces, Fassungen, Anhang, Beziehungen),
//      dazu zwei Einstellungen (Upload-Grenzen, Prüferzahl) und ein Webhook-Vorgang ohne Abschluss.
//   2. SICHERUNG.
//   3. Bis zum Ausfall geschieht, was eine Sicherung nicht mehr sieht: ein neuer Beitrag, eine
//      Löschung, ein Rollenentzug, ein entferntes Konto, die Zustellung des offenen Vorgangs.
//   4. AUSFALL (Zeitpunkt festgehalten), Restore-Drill in eine leere Datenbank, Wiederanlauf mit
//      Sperre, Nachführung über die vorhandenen Verwaltungswege, Freigabe.
//
// GEMESSEN (P09-AC03): Sicherungsstand, Ausfall, verlorenes Zeitfenster und verlorene Beiträge
// (Datenverlust), Dauer des Drills und Dauer bis zur Freigabe (Wiederanlaufzeit). GEPRÜFT (P09-AC04):
// Wissen, Rechte, Historie und Konfiguration sind im Sicherungsstand zurück. Dazu am echten Restore:
// was die Sicherung wieder auftauchen lässt (Löschung, Entzug), ist vor der Freigabe nachgeführt
// (AC05), und der offene Webhook-Vorgang geht kein zweites Mal hinaus (AC06).
//
// LIEFERBELEG: `test-results/p09-wiederanlauf/messbericht.json` und — weil der Prüfserver samt
// Speicher abgebaut wird — dieselbe Zeile `[P09 MESSBERICHT]` in der Testausgabe; dazu das
// Drillprotokoll als `[P09 ARTEFAKT]`. Keine Zugangsdaten darin.
//
// GRENZEN, EHRLICH: Prüfaufbau mit Agentenlauf und fiktiven Daten — keine menschliche Reaktionszeit,
// kein Hostausfall (dieselbe Prüf-PostgreSQL, eigene leere Datenbank), keine Produktionssicherung.
// Die gemessenen Zahlen belegen das Messverfahren und den Wiederanlauf dieses Aufbaus; sie sind keine
// RPO/RTO-Zusage (docs/operations/wiederanlauf-rpo-rto.md). Ohne PostgreSQL samt Werkzeugen meldet
// die Probe den Grund auf stderr und überspringt.
const root = resolve(import.meta.dirname, "../..");
const JOB = "[KLARWERK] P09";
const BERICHT = join(root, "test-results", "p09-wiederanlauf");
const KENNUNG = "p09-messprobe";
const ZIEL_HOOK: WebhookZiel = {
  id: "werkzeug-p09",
  url: "https://werkzeug.example/hook",
  ereignisse: ["wissen.validiert"],
  geheimnis: "fiktiv-p09-0123456789abcdef0123456789",
};
const NACH_SICHERUNG = "Fiktiv: nach der Sicherung erfasst";
const GRENZEN = { maxAttachments: 7, maxAttachmentBytes: 3_000_000 };
const PRUEFERZAHL = 2;

interface Verbindung {
  host: string;
  port: string;
  user: string;
  passwort: string;
}

// Wie in PV-01 zusammengesetzt: die Wegwerfnamen entstehen zur Laufzeit und müssen `test` tragen.
const PG_SCHEMA = "postgresql:";

function pgUrl(v: Verbindung, datenbank: string): string {
  if (!datenbank.toLowerCase().includes("test")) {
    throw new Error(`${JOB}: „${datenbank}“ trägt kein „test“ im Namen — keine Verbindung.`);
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

function zerlege(url: string): Verbindung | undefined {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/, "http:"));
    return u.hostname
      ? {
          host: u.hostname,
          port: u.port || "5432",
          user: decodeURIComponent(u.username) || "postgres",
          passwort: decodeURIComponent(u.password),
        }
      : undefined;
  } catch {
    return undefined;
  }
}

function werkzeugFehlt(name: string): boolean {
  return spawnSync("/bin/sh", ["-c", `command -v ${name} >/dev/null 2>&1`]).status !== 0;
}

function sha256(daten: Buffer | string): string {
  return createHash("sha256").update(daten).digest("hex");
}

function kandidat(): string {
  const git = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" });
  const commit = git.stdout?.trim() ?? "";
  return git.status === 0 && /^[0-9a-f]{40}$/.test(commit) ? commit : "unbekannt";
}

function quellenVon(services: AppServices): WissensereignisQuellen {
  return {
    wissensobjekte: () => services.ko.list({}),
    revalidierungFaellig: () => services.lifecycle.pendingRevalidation(),
    offeneWidersprueche: () => services.conflicts.unresolved(),
    wissensobjekt: (id) => services.ko.get(id),
  };
}

function melder(services: AppServices, status: number) {
  const gesendet: string[] = [];
  const m = new WissensereignisMelder({
    quellen: quellenVon(services),
    audit: services.audit,
    ziele: [ZIEL_HOOK],
    zusteller: async (anfrage) => {
      gesendet.push(anfrage.headers[KENNUNG_HEADER] ?? "");
      return { status };
    },
  });
  return { m, gesendet };
}

/**
 * Wissen, Rechte, Historie und Konfiguration — Quelle und Ziel mit DERSELBEN Abfrage. Zugangsdaten
 * (Adresse, Hash) werden nicht gelesen.
 */
async function bestandVon(pool: Pool): Promise<Record<string, unknown[]>> {
  const q = async (sql: string) => (await pool.query(sql)).rows;
  return {
    wissen: await q(
      `SELECT id, status, (data->>'version')::int AS fassung, data->>'statement' AS aussage,
              data->>'spaceId' AS space, data->'ownership'->>'owner' AS verantwortlich,
              data->>'deletedAt' AS geloescht
         FROM kos ORDER BY id`,
    ),
    anhaenge: await q("SELECT id, md5(data) AS inhalt FROM objects ORDER BY id"),
    beziehungen: await q("SELECT * FROM ko_kanten ORDER BY 1"),
    rechte: await q("SELECT id, role, approved FROM users ORDER BY id"),
    spaces: await q(
      `SELECT space_id, version, data->'mitglieder' AS mitglieder, data->>'zugang' AS zugang
         FROM spaces_fassungen ORDER BY space_id, version`,
    ),
    historie: await q(
      `SELECT ko_id, version, snapshot->>'statement' AS aussage FROM ko_versions
        ORDER BY ko_id, version`,
    ),
    konfiguration: await q(
      `SELECT 'upload_limits' AS tabelle, to_jsonb(t)::text AS zeile FROM upload_limits t
       UNION ALL
       SELECT 'validation_settings', to_jsonb(t)::text FROM validation_settings t
       ORDER BY 1, 2`,
    ),
  };
}

/** Die Auditkette als Folge (seq, hash) — die Historie der Vorgänge, bitgenau. */
async function kette(pool: Pool): Promise<{ seq: number; hash: string }[]> {
  return (
    await pool.query<{ seq: number; hash: string }>(
      "SELECT seq::int AS seq, hash FROM audit ORDER BY seq",
    )
  ).rows;
}

describe("P09 · isolierter Wiederanlauf mit gemessener Dauer und gemessenem Datenverlust", () => {
  let container: StartedTestContainer | undefined;
  let adminPool: Pool | undefined;
  let quellPool: Pool | undefined;
  let zielPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let arbeitsordner = "";
  let verfuegbar = false;
  const kennung = `${Date.now()}`.slice(-9);
  const quellDb = `klarwerk_p09_quelle_test_${kennung}`;
  const zielDb = `klarwerk_p09_ziel_test_${kennung}`;

  beforeAll(async () => {
    const fehlend = ["pg_dump", "pg_restore", "psql", "createdb", "ps"].filter(werkzeugFehlt);
    if (fehlend.length > 0) {
      process.stderr.write(`${JOB} ÜBERSPRUNGEN: Werkzeuge fehlen: ${fehlend.join(", ")}.\n`);
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
    await adminPool.query(`CREATE DATABASE ${quellDb}`);
    arbeitsordner = mkdtempSync(join(tmpdir(), "klarwerk-p09-"));
    verfuegbar = true;
  }, 240_000);

  afterAll(async () => {
    await zielPool?.end();
    await quellPool?.end();
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

  it("M1 · sichern, Ausfall, Restore, Nachführung, Freigabe — Dauer und Verlust gemessen", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const v = verbindung;

    // ----------------------------------------------------------------------------------------------
    // 1. AUSGANGSBESTAND über die echte Anwendung.
    // ----------------------------------------------------------------------------------------------
    quellPool = createPool(pgUrl(v, quellDb));
    await migrate(quellPool);
    const quellServices = buildPgServices(quellPool);
    await quellServices.ko.activateSearchProjectionV2();
    let quellApp = buildApp(quellServices);
    const b = await legeFiktivenBestand(quellApp);
    for (const [url, payload] of [
      ["/api/upload-limits", GRENZEN],
      ["/api/validation/settings", { defaultNeededValidations: PRUEFERZAHL }],
    ] as const) {
      const res = await quellApp.inject({ method: "PUT", url, headers: b.kopf.admin, payload });
      expect(res.statusCode, `${url}: ${res.body}`).toBe(200);
    }
    const einstellungen = async (app: typeof quellApp, kopf: Record<string, string>) => ({
      grenzen: (await app.inject({ url: "/api/upload-limits", headers: kopf })).json(),
      pruefer: (await app.inject({ url: "/api/validation/settings", headers: kopf })).json(),
    });
    const einstellungenQuelle = await einstellungen(quellApp, b.kopf.admin);
    // Webhook: Grundstand, dann ein neu validierter Beitrag, dessen erste Zustellung scheitert.
    await melder(quellServices, 204).m.lauf();
    const offenerVorgang = await quellServices.ko.create({
      title: "Fiktiv: Meldung zwischen Sicherung und Ausfall",
      statement: "Wird vor der Sicherung validiert und erst danach zugestellt (fiktiv).",
      type: "best_practice",
      category: "Allgemein",
      author: b.kennung.admin,
    } as never);
    await quellServices.validation.adminValidate(offenerVorgang.id, b.kennung.admin);
    await melder(quellServices, 503).m.lauf();
    await quellApp.close();

    // ----------------------------------------------------------------------------------------------
    // 2. SICHERUNG — das unveränderte backup.sh.
    // ----------------------------------------------------------------------------------------------
    const imSicherungsstand = await bestandVon(quellPool);
    const ketteImSicherungsstand = await kette(quellPool);
    const sicherungsordner = join(arbeitsordner, "sicherung");
    mkdirSync(sicherungsordner, { recursive: true });
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: pgUrl(v, quellDb),
      BACKUP_DIR: sicherungsordner,
    };
    env.KLARWERK_DATABASE_URL = undefined;
    const sicherung = spawnSync("bash", [join(root, "scripts/backup/backup.sh")], {
      cwd: root,
      encoding: "utf8",
      timeout: 300_000,
      env,
    });
    expect(sicherung.status, `${sicherung.stdout}${sicherung.stderr}`).toBe(0);
    const dumpName = readdirSync(sicherungsordner).find((d) => d.endsWith(".dump")) ?? "";
    const stempel = /klarwerk-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(dumpName);
    expect(stempel, `Dateiname ohne Zeitstempel: ${dumpName}`).toBeTruthy();
    const [, jj, mm, tt, hh, mi, ss] = stempel ?? [];
    const sicherungsstand = new Date(`${jj}-${mm}-${tt}T${hh}:${mi}:${ss}Z`);

    // ----------------------------------------------------------------------------------------------
    // 3. BIS ZUM AUSFALL — was die Sicherung nicht mehr sieht.
    // ----------------------------------------------------------------------------------------------
    quellApp = buildApp(quellServices);
    const admin = await anmelden(quellApp, KONTEN.admin.email);
    const neu = await quellApp.inject({
      method: "POST",
      url: "/api/kos",
      headers: await anmelden(quellApp, KONTEN.anna.email),
      payload: {
        confidentiality: "intern",
        title: NACH_SICHERUNG,
        statement: "Dieser Beitrag entsteht nach der Sicherung und geht beim Ausfall verloren.",
        type: "best_practice",
        category: "Allgemein",
      },
    });
    expect(neu.statusCode, neu.body).toBe(201);
    const neuId = (neu.json() as { id: string }).id;
    const nachfuehrung = async (app: typeof quellApp, kopf: Record<string, string>) => {
      const schritte = [
        await app.inject({ method: "DELETE", url: `/api/kos/${b.offenId}`, headers: kopf }),
        await app.inject({
          method: "PUT",
          url: `/api/users/${b.kennung.carl}`,
          headers: kopf,
          payload: { role: "viewer" },
        }),
        await app.inject({ method: "DELETE", url: `/api/users/${b.kennung.vera}`, headers: kopf }),
      ];
      expect(
        schritte.map((s) => s.statusCode),
        schritte.map((s) => s.body).join(" | "),
      ).toEqual([204, 200, 204]);
    };
    await nachfuehrung(quellApp, admin);
    const nachSicherungZugestellt = melder(quellServices, 204);
    await nachSicherungZugestellt.m.lauf();
    const fassung = (await quellServices.ko.get(offenerVorgang.id))?.version;
    const offeneKennung = `wissen.validiert:${offenerVorgang.id}:${fassung}`;
    expect(nachSicherungZugestellt.gesendet).toEqual([offeneKennung]);
    await quellApp.close();
    const ausfall = new Date();
    const imAusfall = await bestandVon(quellPool);

    // ----------------------------------------------------------------------------------------------
    // 4. RESTORE — das unveränderte restore-drill.sh in eine leere Datenbank.
    // ----------------------------------------------------------------------------------------------
    const dump = join(sicherungsordner, dumpName);
    const drillEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PGHOST: v.host,
      PGPORT: v.port,
      PGUSER: v.user,
      PGPASSWORD: v.passwort,
      RESTORE_DB: zielDb,
      DRILL_PORT: "3099",
      DRILL_WORKDIR: sicherungsordner,
      DRILL_LOGIN_EMAIL: KONTEN.admin.email,
      DRILL_LOGIN_PASSWORT: KENNWORT,
    };
    drillEnv.KLARWERK_DATABASE_URL = undefined;
    drillEnv.DATABASE_URL = undefined;
    const drillStart = Date.now();
    const drill = spawnSync("bash", [join(root, "scripts/backup/restore-drill.sh"), dump], {
      cwd: root,
      encoding: "utf8",
      timeout: 600_000,
      env: drillEnv,
    });
    const drillDauerMs = Date.now() - drillStart;
    expect(drill.status, `${drill.stdout}${drill.stderr}`).toBe(0);
    const protokoll = readFileSync(join(sicherungsordner, "letzter-drill.json"), "utf8");

    // P09-AC04: Wissen, Rechte, Historie und Konfiguration im Sicherungsstand zurück.
    zielPool = createPool(pgUrl(v, zielDb));
    const imZiel = await bestandVon(zielPool);
    const abweichend = Object.keys(imSicherungsstand).filter(
      (k) => JSON.stringify(imSicherungsstand[k]) !== JSON.stringify(imZiel[k]),
    );
    expect(abweichend, "Bereiche, die vom Sicherungsstand abweichen").toEqual([]);
    expect(imZiel.konfiguration?.length, "Einstellungen im Bestand").toBeGreaterThanOrEqual(2);
    // Historie: die Auditkette der Sicherung steht bitgenau am Anfang der wiederhergestellten.
    const zielKette = await kette(zielPool);
    expect(zielKette.slice(0, ketteImSicherungsstand.length)).toEqual(ketteImSicherungsstand);

    // P09-AC03: der Datenverlust — was es beim Ausfall gab und im Ziel fehlt oder wieder auftaucht.
    const ids = (liste: unknown[] | undefined) => (liste as { id: string }[]).map((r) => r.id);
    const verloren = ids(imAusfall.wissen).filter((id) => !ids(imZiel.wissen).includes(id));
    expect(verloren).toEqual([neuId]);
    const geloeschtIn = (liste: unknown[] | undefined) => {
      const zeilen = liste as { id: string; geloescht: string | null }[];
      return zeilen.find((r) => r.id === b.offenId)?.geloescht ?? null;
    };
    expect(geloeschtIn(imAusfall.wissen), "Löschung vor dem Ausfall").not.toBeNull();
    expect(geloeschtIn(imZiel.wissen), "Löschung ist mit dem Restore weg").toBeNull();
    const rolleIn = (liste: unknown[] | undefined, id: string) =>
      (liste as { id: string; role: string }[]).find((r) => r.id === id)?.role;
    expect(rolleIn(imAusfall.rechte, b.kennung.carl)).toBe("viewer");
    const carlImZiel = rolleIn(imZiel.rechte, b.kennung.carl);
    expect(carlImZiel, "Rollenentzug ist mit dem Restore weg").toBe("controller");
    expect(rolleIn(imZiel.rechte, b.kennung.vera), "entferntes Konto ist zurück").toBe("viewer");

    // ----------------------------------------------------------------------------------------------
    // 5. WIEDERANLAUF — Sperre, Nachführung über die vorhandenen Wege, Freigabe.
    // ----------------------------------------------------------------------------------------------
    const wiederanlaufStart = Date.now();
    const zielServices = buildPgServices(zielPool);
    const zielApp = buildApp(zielServices);
    const lage = registriereWiederanlauf(zielApp, {
      wiederanlauf: { kennung: KENNUNG },
      audit: zielServices.audit,
      auth: zielServices.auth,
      quellen: quellenVon(zielServices),
    });
    await zielApp.ready();
    const zielAdmin = await anmelden(zielApp, KONTEN.admin.email);
    const zielAnna = await anmelden(zielApp, KONTEN.anna.email);
    const zielCarl = await anmelden(zielApp, KONTEN.carl.email);
    const zielVera = await anmelden(zielApp, KONTEN.vera.email);
    // Vor der Freigabe: weder das gelöschte Objekt noch die entzogenen Rechte sind erreichbar.
    const status = async (url: string, kopf: Record<string, string>) =>
      (await zielApp.inject({ url, headers: kopf })).statusCode;
    for (const kopf of [zielAnna, zielCarl, zielVera]) {
      expect(await status("/api/kos", kopf)).toBe(503);
      expect(await status(`/api/kos/${b.offenId}`, kopf)).toBe(503);
    }
    expect(await status("/api/audit/verify", zielCarl)).toBe(503);
    await nachfuehrung(zielApp, zielAdmin);
    const freigabe = await zielApp.inject({
      method: "POST",
      url: "/api/admin/wiederanlauf/freigabe",
      headers: zielAdmin,
      payload: Object.fromEntries(FREIGABE_BESTAETIGUNGEN.map((s) => [s, true])),
    });
    expect(freigabe.statusCode, freigabe.body).toBe(200);
    const freigabeZeit = Date.now();

    // Geöffnet — mit dem nachgeführten Stand (AC05).
    const liste = await zielApp.inject({ url: "/api/kos", headers: zielAnna });
    expect(liste.statusCode).toBe(200);
    const sichtbar = (liste.json() as { id: string }[]).map((k) => k.id);
    expect(sichtbar).toContain(b.nordId);
    expect(sichtbar, "nachgeführte Löschung").not.toContain(b.offenId);
    expect(await status("/api/audit/verify", zielCarl)).toBe(403);
    expect(await status("/api/kos", zielVera)).toBe(401);
    // Konfiguration über die Anwendung gelesen — wie in der Quelle (AC04).
    expect(await einstellungen(zielApp, zielAdmin)).toEqual(einstellungenQuelle);

    // Der offene Webhook-Vorgang ist mit der Grenze geschlossen und geht nicht noch einmal hinaus.
    const grenze = lage.grenze();
    expect(grenze?.geschlossen.map((g) => g.ziel)).toEqual([ZIEL_HOOK.id]);
    const nachFreigabe = melder(zielServices, 204);
    await nachFreigabe.m.lauf();
    expect(nachFreigabe.gesendet, "Replay nach dem Restore").toEqual([]);
    const freigegeben = await zielServices.audit.list({ action: AKTION_WIEDERANLAUF_FREIGEGEBEN });
    expect(freigegeben).toHaveLength(1);
    await zielApp.close();

    // ----------------------------------------------------------------------------------------------
    // 6. MESSBERICHT — gemessen in diesem Lauf, ohne Zugangsdaten.
    // ----------------------------------------------------------------------------------------------
    const drillProtokoll = JSON.parse(protokoll) as { beginn: string; zeit: string };
    const bericht = {
      auftrag: "produkt:20261011:peter-p09",
      art: "Agentenprüfung mit fiktiven Daten — keine Messung mit realen Anwendern",
      kandidat: kandidat(),
      datum: new Date().toISOString(),
      isoliert: {
        quelle: quellDb,
        ziel: zielDb,
        host: "dieselbe Prüf-PostgreSQL, eigene leere Zieldatenbank, kein Hostausfall",
      },
      sicherung: {
        werkzeug: "scripts/backup/backup.sh (unverändert)",
        datei: dumpName,
        sha256: sha256(readFileSync(dump)),
        sicherungsstand: sicherungsstand.toISOString(),
      },
      ausfall: ausfall.toISOString(),
      datenverlust: {
        verlorenesZeitfensterMs: ausfall.getTime() - sicherungsstand.getTime(),
        verloreneBeitraege: verloren.length,
        wiederaufgetaucht: { geloeschteBeitraege: 1, rollenentzuege: 1, entfernteKonten: 1 },
        offeneAussenaktionen: grenze?.geschlossen.length ?? 0,
      },
      wiederherstellung: {
        werkzeug: "scripts/backup/restore-drill.sh (unverändert)",
        exitcode: drill.status,
        dauerMs: drillDauerMs,
        protokollBeginn: drillProtokoll.beginn,
        protokollEnde: drillProtokoll.zeit,
        protokollSha256: sha256(protokoll),
        wiederhergestellt: Object.keys(imSicherungsstand),
      },
      wiederanlauf: {
        kennung: KENNUNG,
        bisFreigabeMs: freigabeZeit - wiederanlaufStart,
        nachgefuehrt: ["Löschung (Papierkorb)", "Rollenentzug", "Konto entfernt"],
        replayGrenze: {
          geschlossen: grenze?.geschlossen.length ?? 0,
          unterdrueckt: grenze?.unterdrueckt.length ?? 0,
          erneutGesendet: nachFreigabe.gesendet.length,
        },
      },
      gemesseneWiederanlaufzeitMs: freigabeZeit - ausfall.getTime(),
      hinweis:
        "Messwerte dieses Prüfaufbaus. Sie belegen Verfahren und Ablauf, keine RPO/RTO-Zusage: Im Betrieb bestimmen Sicherungstakt, Hostausfall und menschliche Reaktionszeit die Werte (docs/operations/wiederanlauf-rpo-rto.md).",
    };
    const text = `${JSON.stringify(bericht, null, 2)}\n`;
    for (const verboten of [KENNWORT, "@example.test", pgUrl(v, quellDb), pgUrl(v, zielDb)]) {
      expect(text).not.toContain(verboten);
      expect(protokoll).not.toContain(verboten);
    }
    mkdirSync(BERICHT, { recursive: true });
    writeFileSync(join(BERICHT, "messbericht.json"), text);
    writeFileSync(join(BERICHT, "letzter-drill-p09.json"), protokoll);
    process.stdout.write(
      `[P09 ARTEFAKT] ${JSON.stringify({ datei: "letzter-drill-p09.json", sha256: sha256(protokoll), inhalt: protokoll })}\n`,
    );
    process.stdout.write(`[P09 MESSBERICHT] ${JSON.stringify(bericht)}\n`);
  }, 900_000);
});
