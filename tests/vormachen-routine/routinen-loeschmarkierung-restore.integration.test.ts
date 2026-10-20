import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import {
  DateiLoeschmarkierungen,
  fuehreLoeschmarkierungenNach,
} from "../../services/app/src/loeschmarkierungen";
import {
  FREIGABE_BESTAETIGUNGEN,
  registriereWiederanlauf,
  sicherungsstandAus,
} from "../../services/app/src/wiederanlauf";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  type App,
  KENNWORT,
  KONTEN,
  type Kopf,
  anmelden,
  legeFiktivenBestand,
} from "../wiederherstellung-export/bestand";

// ==================================================================================================
// produkt:20261011:peter-p06 · RF-17 AM ECHTEN RESTORE — SICHERUNG → PRIVATLÖSCHUNG → RESTORE →
// WIEDERFREIGABE.
// ==================================================================================================
//
// Originalfall RF-17: „Privatverlauf löschen, getrennt geteilte Firmennotiz behalten; später
// Testrestore → Privatbestand entfernt, geteiltes Wissen erhalten, Löschmarkierung vor
// Wiederfreigabe angewendet." Keine zweite Strecke: gesichert mit dem UNVERÄNDERTEN
// `scripts/backup/backup.sh`, wiederhergestellt mit dem UNVERÄNDERTEN `scripts/backup/restore-drill.sh`
// in eine leere Datenbank, wiederangelaufen mit `registriereWiederanlauf` und derselben
// Nachführung, die `server.ts` anschließt (`fuehreLoeschmarkierungenNach`). Die Löschmarkierungen
// liegen in einer Datei AUSSERHALB der Datenbank — wie `KLARWERK_LOESCHMARKIERUNGEN` im Betrieb.
//
// Fiktive Daten an eigenen Wegwerfdatenbanken (`test` im Namen). Ohne PostgreSQL samt Werkzeugen
// meldet die Probe den Grund auf stderr und überspringt — dann ist sie KEIN Beleg.
const root = resolve(import.meta.dirname, "../..");
const JOB = "[KLARWERK] P06 RF-17";
const KENNUNG = "p06-rf17-restore";
const PFAD = "/api/me/vormachen";
const ZWECK = {
  anna: "Fiktiv: Wochenbericht Linie Nord vorbereiten",
  bert: "Fiktiv: Entlüftung Süd nachschlagen",
} as const;

interface Uebergabe {
  routine: { firmenuebergabe: { entwurfId: string } };
}

interface Verbindung {
  host: string;
  port: string;
  user: string;
  passwort: string;
}

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

/** Vormachen über die echten Routen (sichtbare Anzeige, zwei Seitenwechsel), dann bestätigen. */
async function routine(app: App, kopf: Kopf, zweck: string): Promise<string> {
  const start = await app.inject({
    method: "POST",
    url: PFAD,
    headers: kopf,
    payload: { host: "klarwerk_web", vorgaenge: ["seite_oeffnen"], zweck },
  });
  expect(start.statusCode, start.body).toBe(201);
  const sitzung = (start.json() as { sitzung: { id: string } }).sitzung.id;
  const anzeige = await app.inject({ url: `${PFAD}?anzeige=klarwerk_web`, headers: kopf });
  expect((anzeige.json() as { sichtbar: boolean }).sichtbar).toBe(true);
  for (const seite of ["/bibliothek", "/fragen"]) {
    const beob = await app.inject({
      method: "POST",
      url: `${PFAD}/${sitzung}/beobachtungen`,
      headers: kopf,
      payload: { host: "klarwerk_web", vorgang: "seite_oeffnen", beschreibung: seite },
    });
    expect(beob.statusCode, beob.body).toBe(201);
  }
  const vorschau = await app.inject({ url: `${PFAD}/${sitzung}/vorschau`, headers: kopf });
  const stand = (vorschau.json() as { vorschau: { stand: string } }).vorschau.stand;
  const best = await app.inject({
    method: "POST",
    url: `${PFAD}/${sitzung}/bestaetigung`,
    headers: kopf,
    payload: { stand },
  });
  expect(best.statusCode, best.body).toBe(201);
  return (best.json() as { routine: { id: string } }).routine.id;
}

async function zeilen(pool: Pool): Promise<{ id: string; konto: string }[]> {
  const res = await pool.query<{ id: string; konto: string }>(
    "SELECT id, konto_id AS konto FROM persoenliche_routinen ORDER BY id",
  );
  return res.rows;
}

/** Wartet, bis keine Sitzung mehr an `db` hängt (höchstens 10 s, dann räumt FORCE auf). */
async function bisGetrennt(admin: Pool, db: string): Promise<void> {
  for (let versuch = 0; versuch < 100; versuch += 1) {
    const res = await admin.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = $1",
      [db],
    );
    if ((res.rows[0]?.n ?? 0) === 0) {
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

function quellenVon(services: AppServices) {
  return {
    wissensobjekte: () => services.ko.list({}),
    revalidierungFaellig: () => services.lifecycle.pendingRevalidation(),
    offeneWidersprueche: () => services.conflicts.unresolved(),
    wissensobjekt: (id: string) => services.ko.get(id),
  };
}

describe("P06 · RF-17 · Löschmarkierung am echten Restore", () => {
  let container: StartedTestContainer | undefined;
  let adminPool: Pool | undefined;
  let quellPool: Pool | undefined;
  let zielPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let arbeitsordner = "";
  let verfuegbar = false;
  const kennung = `${Date.now()}`.slice(-9);
  const quellDb = `klarwerk_p06_quelle_test_${kennung}`;
  const zielDb = `klarwerk_p06_ziel_test_${kennung}`;

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
    arbeitsordner = mkdtempSync(join(tmpdir(), "klarwerk-p06-rf17-"));
    verfuegbar = true;
  }, 240_000);

  afterAll(async () => {
    await zielPool?.end();
    await quellPool?.end();
    if (adminPool) {
      for (const db of [quellDb, zielDb]) {
        // `pool.end()` kehrt zurück, bevor die Verbindungen serverseitig zu sind. Ein sofortiges
        // `DROP … WITH (FORCE)` beendete sie mitten im Schließen (57P01), und der Pool reichte das
        // als unbehandelten Fehler weiter (Nacharbeit 12). Erst warten, bis sie wirklich weg sind.
        await bisGetrennt(adminPool, db);
        await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      }
      await adminPool.end();
    }
    await container?.stop();
    if (arbeitsordner) {
      rmSync(arbeitsordner, { recursive: true, force: true });
    }
  }, 120_000);

  it("RF17 · Sicherung → Privatlöschung → Restore → Wiederfreigabe: Privatbestand weg, Firmenentwurf erhalten", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const v = verbindung;
    // Die Ablage der Markierungen liegt außerhalb jeder Datenbank und jeder Sicherung.
    const ablage = new DateiLoeschmarkierungen(join(arbeitsordner, "markierungen", "rf17.jsonl"));

    // 1. AUSGANGSBESTAND über die echte Anwendung: je eine Routine für Anna und Bert, Annas Routine
    //    zusätzlich getrennt an die Firma übergeben (eigener Entwurf).
    quellPool = createPool(pgUrl(v, quellDb));
    await migrate(quellPool);
    const quellServices = buildPgServices(quellPool);
    await quellServices.ko.activateSearchProjectionV2();
    let quellApp = buildApp(quellServices, { loeschmarkierungen: ablage });
    const b = await legeFiktivenBestand(quellApp);
    const annasRoutine = await routine(quellApp, b.kopf.anna, ZWECK.anna);
    const bertsRoutine = await routine(quellApp, b.kopf.bert, ZWECK.bert);
    // H: dieselbe Tabelle enthält auch die Beschaffungsfunktion. Ihre Pause und Fassung müssen
    // den tatsächlichen Dump/Restore überstehen; Annas private Löschung berührt sie nicht.
    const bes = await quellApp.inject({
      method: "POST",
      url: "/api/me/funktionen",
      headers: b.kopf.bert,
      payload: {
        text: "So möchte ich künftig Angebote für eine Verpackung einholen.",
        quellen: [],
      },
    });
    expect(bes.statusCode, bes.body).toBe(201);
    const besF = bes.json().funktion as { id: string; rev: number };
    const pause = await quellApp.inject({
      method: "PUT",
      url: `/api/me/funktionen/${besF.id}`,
      headers: b.kopf.bert,
      payload: { rev: besF.rev, stand: "pausiert" },
    });
    expect(pause.statusCode, pause.body).toBe(200);
    const besGespeichert = pause.json().funktion;

    const uebergabe = await quellApp.inject({
      method: "POST",
      url: `${PFAD}/routinen/${annasRoutine}/firmenuebergabe`,
      headers: b.kopf.anna,
    });
    expect(uebergabe.statusCode, uebergabe.body).toBe(201);
    const entwurfId = (uebergabe.json() as Uebergabe).routine.firmenuebergabe.entwurfId;
    await quellApp.close();
    const imSicherungsstand = await zeilen(quellPool);
    expect(imSicherungsstand.map((z) => z.id).sort()).toEqual(
      [annasRoutine, bertsRoutine, besF.id].sort(),
    );

    // 2. SICHERUNG — das unveränderte backup.sh.
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
    const dump = join(sicherungsordner, dumpName);
    const sicherungsstand = sicherungsstandAus(dump);

    // 3. PRIVATLÖSCHUNG NACH DER SICHERUNG — mit Markierung außerhalb der Datenbank.
    quellApp = buildApp(quellServices, { loeschmarkierungen: ablage });
    const loeschen = await quellApp.inject({ method: "DELETE", url: PFAD, headers: b.kopf.anna });
    expect(loeschen.statusCode, loeschen.body).toBe(200);
    expect(loeschen.json()).toEqual({ geloescht: { sitzungen: 0, routinen: 1 } });
    await quellApp.close();
    const markierungen = await ablage.alle();
    expect(markierungen).toEqual([
      { art: "persoenliche_routinen", kontoId: b.kennung.anna, am: expect.any(String) },
    ]);
    const geloeschtAm = markierungen[0]?.am ?? "";
    expect(geloeschtAm >= sicherungsstand, "Löschung nach der Sicherung").toBe(true);
    const roh = readFileSync(ablage.ort, "utf8");
    expect(roh).not.toContain(ZWECK.anna);
    expect((await zeilen(quellPool)).map((z) => z.id).sort()).toEqual(
      [bertsRoutine, besF.id].sort(),
    );

    // 4. RESTORE — das unveränderte restore-drill.sh in eine leere Datenbank. Die gelöschte Routine
    //    ist damit wieder in der Datenbank: genau der Fall, den die Markierung abfangen muss.
    const drillEnv: NodeJS.ProcessEnv = {
      ...process.env,
      PGHOST: v.host,
      PGPORT: v.port,
      PGUSER: v.user,
      PGPASSWORD: v.passwort,
      RESTORE_DB: zielDb,
      DRILL_PORT: "3098",
      DRILL_WORKDIR: sicherungsordner,
      DRILL_LOGIN_EMAIL: KONTEN.admin.email,
      DRILL_LOGIN_PASSWORT: KENNWORT,
    };
    drillEnv.KLARWERK_DATABASE_URL = undefined;
    drillEnv.DATABASE_URL = undefined;
    const drill = spawnSync("bash", [join(root, "scripts/backup/restore-drill.sh"), dump], {
      cwd: root,
      encoding: "utf8",
      timeout: 600_000,
      env: drillEnv,
    });
    expect(drill.status, `${drill.stdout}${drill.stderr}`).toBe(0);
    zielPool = createPool(pgUrl(v, zielDb));
    const nachRestore = await zeilen(zielPool);
    expect(nachRestore, "Restore bringt die gelöschte Routine zurück").toEqual(imSicherungsstand);

    // 5. WIEDERANLAUF — die Markierung ist angewendet, sobald die Anwendung bereit ist.
    const zielServices = buildPgServices(zielPool);
    const zielApp = buildApp(zielServices, { loeschmarkierungen: ablage });
    registriereWiederanlauf(zielApp, {
      wiederanlauf: { kennung: KENNUNG, sicherungsstand },
      audit: zielServices.audit,
      auth: zielServices.auth,
      quellen: quellenVon(zielServices),
      loeschmarkierungen: () =>
        fuehreLoeschmarkierungenNach(ablage, zielServices.vormachenRoutinen),
    });
    await zielApp.ready();
    const vorFreigabe = (await zeilen(zielPool)).map((z) => z.id);
    expect(vorFreigabe.sort(), "vor der Freigabe nachgeführt").toEqual(
      [bertsRoutine, besF.id].sort(),
    );
    const admin = await anmelden(zielApp, KONTEN.admin.email);
    const anna = await anmelden(zielApp, KONTEN.anna.email);
    const bert = await anmelden(zielApp, KONTEN.bert.email);
    const lage = await zielApp.inject({ url: "/api/admin/wiederanlauf", headers: admin });
    expect(lage.json()).toMatchObject({
      zustand: "gesperrt",
      persoenlicheLoeschmarkierungen: { ort: ablage.ort, markierungen: 1, entfernt: 1 },
    });
    expect((await zielApp.inject({ url: PFAD, headers: anna })).statusCode).toBe(503);

    const freigabe = await zielApp.inject({
      method: "POST",
      url: "/api/admin/wiederanlauf/freigabe",
      headers: admin,
      payload: Object.fromEntries(FREIGABE_BESTAETIGUNGEN.map((s) => [s, true])),
    });
    expect(freigabe.statusCode, freigabe.body).toBe(200);

    // 6. NACH DER FREIGABE: Privatbestand entfernt, Berts Routine und Annas Firmenentwurf erhalten.
    const liste = async (kopf: Kopf) => {
      const res = await zielApp.inject({ url: PFAD, headers: kopf });
      expect(res.statusCode, res.body).toBe(200);
      return (res.json() as { routinen: { id: string }[] }).routinen.map((r) => r.id);
    };
    expect(await liste(anna)).toEqual([]);
    expect(await liste(bert)).toEqual([bertsRoutine]);
    const besRead = await zielApp.inject({ url: `/api/me/funktionen/${besF.id}`, headers: bert });
    expect(besRead.statusCode, besRead.body).toBe(200);
    expect(besRead.json().funktion).toEqual(besGespeichert);
    const verhindert = await zielApp.inject({
      method: "POST",
      url: `/api/me/funktionen/${besF.id}/laeufe`,
      headers: bert,
      payload: { parameter: { produkt: "Karton B", menge: "30 Stück", termin: "2026-11-30" } },
    });
    expect(verhindert.statusCode, verhindert.body).toBe(409);

    const entwurf = await zielApp.inject({ url: `/api/drafts/${entwurfId}`, headers: anna });
    expect(entwurf.statusCode, entwurf.body).toBe(200);
    expect(entwurf.body).toContain(ZWECK.anna);
    await zielApp.close();

    process.stdout.write(
      `[P06 RF-17] ${JSON.stringify({
        sicherung: dumpName,
        sicherungsstand,
        markierungen: markierungen.length,
        imRestoreZurueck: imSicherungsstand.length,
        vorFreigabeEntfernt: 1,
        nachFreigabe: { anna: 0, bert: 1, firmenentwurf: "erhalten" },
      })}\n`,
    );
  }, 900_000);
});
