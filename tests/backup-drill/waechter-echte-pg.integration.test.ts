import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import {
  type Verbindung,
  freierPort,
  pgUrl,
  prozessLebt,
  werkzeugFehlt,
  zerlege,
} from "../beziehungs-restore-nutzerweg/vorrichtung";

// ==================================================================================================
// B3 · DIE BENANNTEN WÄCHTER DES DRILLS, DAUERHAFT GEGEN DIE REALE POSTGRESQL-STRECKE.
// ==================================================================================================
//
// HERKUNFT DER FORDERUNG: BEN, JOB 4010 Runde 2, Punkt 6 („PRÜFLÜCKEN"): „Die Datenverfälschung aus
// `echter-wiederanlauf.integration.test.ts` muss gegen echte PostgreSQL ausgeführt werden. Ergänzend
// dauerhafte Tests für den neuen URL-Wächter und einen vorzeitig sterbenden Launcher beziehungsweise
// die SIGKILL-Eskalation vorsehen." Der Auftrag b3-sicherung-wiederherstellung nimmt das auf:
// „Wächter für ungültige DB-URL, Datenverfälschung, vorzeitig sterbenden Launcher und Prozessabbau
// dauerhaft gegen die reale PostgreSQL-Strecke prüfen; vorhandene Tests übernehmen."
//
// WAS SCHON TRUG UND HIER NICHT NEU GEBAUT WIRD: die Datenverfälschung läuft seit JOB 4097 in
// `echter-wiederanlauf.integration.test.ts` W1 (Byte-Gegenprobe), W2 (Anhang unbrauchbar → 73) und
// W4 (Beleg ohne Anhang → 73) gegen echte PostgreSQL. Die Prozesszuordnung P1/P2 in
// `prozesszuordnung.test.ts` misst den echten npx/tsx-Baum — aber mit Attrappen der
// PostgreSQL-Werkzeuge und einer Attrappe der Anwendung. Genau das hat die unabhängige Prüfung von
// Lauf 2 (Runde 3) als Lücke benannt: „die Attrappenmessung nicht als vollständigen PG-Nachweis
// zählen".
//
// DIESE DATEI SCHLIESST DIE LÜCKE MIT DEN UNVERÄNDERTEN SKRIPTEN UND DER ECHTEN ANWENDUNG:
//
//   U1  URL-Wächter der Suite: `pgUrl` verbindet sich mit keinem Namen ohne „test" — die Regel,
//       unter der alle PG-Nachweise dieses Themas Datenbanken anlegen und wieder wegwerfen.
//   U2  `backup.sh` mit einer syntaktisch gültigen, aber FALSCHEN Adresse (Datenbank existiert
//       nicht) an der echten PostgreSQL: kein Dump, kein Sidecar, Ergebnisspur „fehler", kein
//       Kennwort in der Ausgabe.
//   U3  dasselbe mit einer Rolle, die es nicht gibt — die Anmeldung scheitert an der echten
//       PostgreSQL (unabhängig davon, ob der Testcluster Kennwörter prüft oder `trust` fährt).
//   U4  `restore-drill.sh` mit einer Rolle, die es nicht gibt: Exit 20 („nicht erreichbar"),
//       BEVOR `pg_restore` läuft — kein stilles Weiterlaufen.
//   L1  VORZEITIG STERBENDER LAUNCHER: echter Dump, echter Restore (Glied 1–3 grün), dann stirbt
//       die ECHTE Anwendung am Startvertrag (Produktion ohne `APP_BASE_URL`), bevor sie horcht.
//       Erwartet: Exit 30, kein „BESTANDEN", die Gruppe ist leer, der Port frei, keine PID-Datei.
//   K1  PROZESSABBAU MIT SIGKILL-ESKALATION: der vollständige Drill (Exit 0) gegen die echte
//       Anwendung, deren Serverprozess SIGTERM ignoriert. Erwartet: die zweite Stufe greift
//       („SIGTERM hat nicht gereicht — SIGKILL an die eigene Gruppe"), danach ist die Gruppe leer
//       und der Port frei.
//
// WIE K1 DEN SERVER TAUB MACHT, OHNE DAS PRODUKT ZU ÄNDERN: Node beendet sich bei SIGTERM nur,
// solange niemand einen Handler dafür registriert — und die Anwendung registriert keinen
// (`services/**` ohne `SIGTERM`). Ein Vorlademodul über `NODE_OPTIONS=--require` hängt deshalb
// NUR im Serverprozess (erkannt an `services/app/src/server.ts` in `argv` und gesetzter
// `KLARWERK_PID_FILE`) einen Handler an, der das Signal festhält und sonst nichts tut. Drill,
// Anwendung und Datenbank bleiben unverändert; Launcher und tsx bleiben echt.
//
// PRÜFGRENZE, EHRLICH GEMELDET: wie in `echter-wiederanlauf.integration.test.ts` — fehlen
// PostgreSQL oder die Kommandozeilenwerkzeuge, wird der Grund SICHTBAR auf stderr gemeldet und
// übersprungen. Auf dem Testserver (`testlauf.py --gezielt`) und im Prüfwerkzeug des Compose-Drills
// sind beide vorhanden.
//
// KEINE PRODUKTIVDATEN: jede Datenbank trägt „test" im Namen (durchgesetzt in `pgUrl`) und wird
// in `afterAll` wieder entfernt.
const root = resolve(import.meta.dirname, "../..");
const JOB = "[KLARWERK] B3-Wächter";

const EMAIL = "waechter-controller@example.test";
const PASSWORT = "waechter-geheim-4711";
const QUELLBYTES = Buffer.concat(
  Array.from({ length: 4 }, (_, i) => createHash("sha256").update(`B3-WAECHTER-${i}`).digest()),
);

/** Mitglieder einer Prozessgruppe — gemessen am Betriebssystem, nicht an einer PID-Datei. */
function gruppenMitglieder(pgid: number): number[] {
  if (!(pgid > 0)) {
    return [];
  }
  const r = spawnSync("ps", ["-Ao", "pid=,pgid="], { encoding: "utf8" });
  return (r.stdout ?? "")
    .split("\n")
    .map((zeile) => zeile.trim().split(/\s+/))
    .filter((teile) => teile.length === 2 && Number(teile[1]) === pgid)
    .map((teile) => Number(teile[0]));
}

/**
 * Lässt sich ein Kennwort in einer Ausgabe überhaupt eindeutig wiederfinden? Das Kennwort des
 * Wegwerf-Containers heißt „test" — dieses Wort steht absichtlich in jedem Datenbanknamen, ein
 * Treffer bewiese also nichts.
 */
function kennwortUnterscheidbar(kennwort: string, ...namen: string[]): boolean {
  return kennwort.length >= 6 && !namen.some((n) => n.includes(kennwort));
}

async function portFrei(port: number): Promise<boolean> {
  return await new Promise<boolean>((fertig) => {
    const srv = createServer();
    srv.once("error", () => fertig(false));
    srv.listen(port, "0.0.0.0", () => srv.close(() => fertig(true)));
  });
}

// Das Vorlademodul für K1. CommonJS, weil `--require` es vor jedem ESM-Lader auswertet.
const TAUB_BEI_SIGTERM = `
const fs = require("node:fs");
const ziel = process.env.WAECHTER_TAUB_PROTOKOLL;
const istServer = process.argv.some((a) => a.endsWith("services/app/src/server.ts"));
if (ziel && istServer && process.env.KLARWERK_PID_FILE) {
  fs.writeFileSync(ziel, "taub " + process.pid + "\\n", { flag: "a" });
  process.on("SIGTERM", () => {
    fs.writeFileSync(ziel, "SIGTERM empfangen " + process.pid + "\\n", { flag: "a" });
  });
}
`;

describe("B3 · Wächter des Drills gegen die reale PostgreSQL-Strecke", () => {
  let container: StartedTestContainer | undefined;
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let arbeitsordner = "";
  let verfuegbar = false;
  let dump = "";

  const kennung = `${Date.now()}`.slice(-9);
  const quellDb = `klarwerk_waechter_quelle_test_${kennung}`;
  const zielDbAnmeldung = `klarwerk_waechter_ziel_test_a_${kennung}`;
  const zielDbLauncher = `klarwerk_waechter_ziel_test_l_${kennung}`;
  const zielDbAbbau = `klarwerk_waechter_ziel_test_k_${kennung}`;
  const gibtEsNicht = `klarwerk_waechter_gibt_es_nicht_test_${kennung}`;

  beforeAll(async () => {
    const fehlend = ["pg_dump", "pg_restore", "psql", "createdb", "ps"].filter(werkzeugFehlt);
    if (fehlend.length > 0) {
      process.stderr.write(
        `${JOB} ÜBERSPRUNGEN: Werkzeuge fehlen auf dem PATH: ${fehlend.join(", ")} — ohne sie laufen weder Sicherung noch Drill.\n`,
      );
      return;
    }

    let url = guardedLocalPgTestUrl();
    if (!url && process.env.KLARWERK_PG_TEST_URL) {
      // Die Sicherung hat die URL abgelehnt (Grund steht auf stderr) — KEIN Container-Rückfall.
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
    arbeitsordner = mkdtempSync(join(tmpdir(), "klarwerk-b3-waechter-"));

    // Der Bestand entsteht über die ECHTE Anwendung — derselbe Weg wie W1 in
    // `echter-wiederanlauf.integration.test.ts`: Konto mit `ko.validate`, Wissensobjekt,
    // hochgeladene Datei, Anhangsbindung (erst sie schreibt die Belegzeile in `ko_evidence`).
    const quellPool = createPool(pgUrl(verbindung, quellDb));
    try {
      await migrate(quellPool);
      const app = buildApp(buildPgServices(quellPool));
      const reg = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Wächter Controller", email: EMAIL, password: PASSWORT },
      });
      expect(reg.statusCode, reg.body).toBe(201);
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
          title: "Pumpe entlüften",
          statement: "Vor dem Anfahren die Pumpe P2 entlüften.",
          type: "best_practice",
          category: "Anlage 2",
        },
      });
      expect(ko.statusCode, ko.body).toBe(201);
      const koId = ko.json().id as string;
      const upload = await app.inject({
        method: "POST",
        url: "/api/objects",
        headers: kopf,
        payload: {
          name: "entlueftung.png",
          mime: "image/png",
          data: `data:image/png;base64,${QUELLBYTES.toString("base64")}`,
        },
      });
      expect(upload.statusCode, upload.body).toBe(201);
      const objektId = upload.json().id as string;
      const gebunden = await app.inject({
        method: "PUT",
        url: `/api/kos/${koId}`,
        headers: kopf,
        payload: {
          action: "attach",
          attachment: { name: "entlueftung.png", mime: "image/png", objectId: objektId },
        },
      });
      expect(gebunden.statusCode, gebunden.body).toBe(200);
    } finally {
      await quellPool.end();
    }

    // EIN echter Dump mit dem UNVERÄNDERTEN backup.sh — L1 und K1 spielen ihn je in ein eigenes
    // leeres Ziel zurück.
    const ordner = join(arbeitsordner, "gut");
    const lauf = sichere(verbindung, quellDb, ordner);
    expect(lauf.status, lauf.ausgabe).toBe(0);
    const name = readdirSync(ordner).find((d) => d.endsWith(".dump"));
    expect(name, "backup.sh hat keinen Dump veröffentlicht").toBeTruthy();
    dump = join(ordner, String(name));
    verfuegbar = true;
  }, 600_000);

  afterAll(async () => {
    if (adminPool) {
      for (const db of [quellDb, zielDbAnmeldung, zielDbLauncher, zielDbAbbau, gibtEsNicht]) {
        await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      }
      await adminPool.end();
    }
    await container?.stop();
    if (arbeitsordner) {
      rmSync(arbeitsordner, { recursive: true, force: true });
    }
  }, 120_000);

  /** Das UNVERÄNDERTE backup.sh gegen genau diese Adresse. */
  function sichere(v: Verbindung, datenbank: string, ordner: string) {
    mkdirSync(ordner, { recursive: true });
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: pgUrl(v, datenbank),
      BACKUP_DIR: ordner,
    };
    // backup.sh bevorzugt KLARWERK_DATABASE_URL — stünde sie in der Umgebung, sicherte dieser Lauf
    // eine andere Datenbank als die hier genannte.
    env.KLARWERK_DATABASE_URL = undefined;
    const r = spawnSync("bash", [join(root, "scripts/backup/backup.sh")], {
      cwd: root,
      encoding: "utf8",
      timeout: 300_000,
      env,
    });
    return { status: r.status, ausgabe: `${r.stdout ?? ""}${r.stderr ?? ""}` };
  }

  /** Der UNVERÄNDERTE Drill; `zusatz` setzt oder entfernt (undefined) einzelne Umgebungswerte. */
  function fahreDrill(
    v: Verbindung,
    ziel: string,
    port: number,
    arbeit: string,
    zusatz: NodeJS.ProcessEnv = {},
  ) {
    mkdirSync(arbeit, { recursive: true });
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PGHOST: v.host,
      PGPORT: v.port,
      PGUSER: v.user,
      PGPASSWORD: v.passwort,
      RESTORE_DB: ziel,
      DRILL_PORT: String(port),
      DRILL_WORKDIR: arbeit,
      DRILL_LOGIN_EMAIL: EMAIL,
      DRILL_LOGIN_PASSWORT: PASSWORT,
      ...zusatz,
    };
    env.KLARWERK_DATABASE_URL = undefined;
    env.DATABASE_URL = undefined;
    for (const [schluessel, wert] of Object.entries(zusatz)) {
      if (wert === undefined) {
        delete env[schluessel];
      }
    }
    const r = spawnSync("bash", [join(root, "scripts/backup/restore-drill.sh"), dump], {
      cwd: root,
      encoding: "utf8",
      timeout: 600_000,
      env,
    });
    const ausgabe = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    return {
      status: r.status,
      ausgabe,
      gruppe: Number(/Prozessgruppe (\d+)/.exec(ausgabe)?.[1] ?? 0),
      pidDateiBleibt: existsSync(join(arbeit, "klarwerk-drill.pid")),
    };
  }

  async function zielTabellen(datenbank: string): Promise<number> {
    if (!verbindung) {
      return -1;
    }
    const pool = new Pool({ connectionString: pgUrl(verbindung, datenbank) });
    try {
      const r = await pool.query(
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'",
      );
      return r.rows[0].n as number;
    } finally {
      await pool.end();
    }
  }

  // ================================================================================================
  // U1 — DER URL-WÄCHTER DER SUITE (ohne Datenbank, deshalb nie übersprungen)
  // ================================================================================================
  it("U1 · pgUrl verbindet sich mit keinem Namen ohne „test“ — und bewahrt Sonderzeichen", () => {
    const v: Verbindung = { host: "db.invalid", port: "5432", user: "b3", passwort: "p@ss:/?#" };
    expect(() => pgUrl(v, "klarwerk_prod")).toThrow(/kein „test“/);
    expect(() => pgUrl(v, "klarwerk")).toThrow(/kein „test“/);
    const gebaut = pgUrl(v, "klarwerk_b3_test");
    expect(zerlege(gebaut)).toEqual(v);
    expect(gebaut.endsWith("/klarwerk_b3_test")).toBe(true);
  });

  // ================================================================================================
  // U2/U3 — UNGÜLTIGE DB-URL AN DER SICHERUNG
  // ================================================================================================
  it("U2 · backup.sh gegen eine Datenbank, die es nicht gibt: nichts veröffentlicht, Spur „fehler“", (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const ordner = join(arbeitsordner, "u2");
    const lauf = sichere(verbindung, gibtEsNicht, ordner);
    expect(lauf.status, lauf.ausgabe).not.toBe(0);
    expect(lauf.ausgabe).toContain("pg_dump gescheitert");
    expect(lauf.ausgabe).toContain(gibtEsNicht);
    // Kein Dump, kein Sidecar, kein Arbeitsstand unter einem Endnamen.
    expect(readdirSync(ordner).filter((d) => d.endsWith(".dump") || d.endsWith(".sha256"))).toEqual(
      [],
    );
    const spur = JSON.parse(readFileSync(join(ordner, "letzter-lauf.json"), "utf8"));
    expect(spur.ergebnis).toBe("fehler");
    expect(spur.datei).toBeNull();
    expect(spur.sha256).toBeNull();
    // Die Adresse trägt ein Kennwort — es darf in keiner Ausgabe und keiner Spur stehen.
    if (kennwortUnterscheidbar(verbindung.passwort, gibtEsNicht, ordner)) {
      expect(lauf.ausgabe).not.toContain(verbindung.passwort);
      expect(JSON.stringify(spur)).not.toContain(verbindung.passwort);
    }
  }, 300_000);

  it("U3 · backup.sh mit einer Rolle, die es nicht gibt: die echte Anmeldung scheitert", (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const rolle = `b3_rolle_gibt_es_nicht_${kennung}`;
    const falsch = `falsch-${kennung}-Kennwort`;
    const ordner = join(arbeitsordner, "u3");
    const lauf = sichere({ ...verbindung, user: rolle, passwort: falsch }, quellDb, ordner);
    expect(lauf.status, lauf.ausgabe).not.toBe(0);
    expect(lauf.ausgabe).toContain("pg_dump gescheitert");
    expect(lauf.ausgabe).toContain(rolle);
    expect(readdirSync(ordner).filter((d) => d.endsWith(".dump") || d.endsWith(".sha256"))).toEqual(
      [],
    );
    expect(lauf.ausgabe).not.toContain(falsch);
  }, 300_000);

  // ================================================================================================
  // U4 — UNGÜLTIGE ANMELDUNG AM DRILL: Exit 20, bevor pg_restore läuft
  // ================================================================================================
  it("U4 · restore-drill.sh mit einer Rolle, die es nicht gibt: Exit 20 vor pg_restore", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const falsch = `falsch-${kennung}-Drill`;
    const port = await freierPort();
    const lauf = fahreDrill(verbindung, zielDbAnmeldung, port, join(arbeitsordner, "u4"), {
      PGUSER: `b3_rolle_gibt_es_nicht_${kennung}`,
      PGPASSWORD: falsch,
    });
    expect(lauf.status, lauf.ausgabe).toBe(20);
    expect(lauf.ausgabe).toContain("ABBRUCH (20)");
    expect(lauf.ausgabe).toContain("nicht erreichbar");
    expect(lauf.ausgabe).toContain("Glied 1 — Sidecar geprueft");
    expect(lauf.ausgabe).not.toContain("Glied 2 —");
    expect(lauf.ausgabe).not.toContain(falsch);
    // Keine Zieldatenbank ist entstanden — gemessen mit der RICHTIGEN Anmeldung.
    const da = await adminPool?.query("SELECT 1 FROM pg_database WHERE datname=$1", [
      zielDbAnmeldung,
    ]);
    expect(da?.rowCount).toBe(0);
  }, 300_000);

  // ================================================================================================
  // L1 — VORZEITIG STERBENDER LAUNCHER, AN DER ECHTEN ANWENDUNG
  // ================================================================================================
  it("L1 · die echte Anwendung stirbt vor dem Horchen: Exit 30, Gruppe leer, Port frei", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const port = await freierPort();
    const arbeit = join(arbeitsordner, "l1");
    // Produktion OHNE `APP_BASE_URL`: der Startvertrag (`services/app/src/start-vertrag.ts`) wirft
    // als erste Anweisung von `start()`, der Prozess endet mit „Serverstart fehlgeschlagen".
    const lauf = fahreDrill(verbindung, zielDbLauncher, port, arbeit, {
      NODE_ENV: "production",
      APP_BASE_URL: undefined,
    });

    expect(lauf.status, lauf.ausgabe).toBe(30);
    expect(lauf.ausgabe).toContain("ABBRUCH (30)");
    expect(lauf.ausgabe).toContain("Serverstart fehlgeschlagen");
    expect(lauf.ausgabe).not.toContain("DRILL BESTANDEN");
    // Bis hierher war die Strecke ECHT und grün: Sidecar, leeres Ziel, Restore, voller Pflichtsatz.
    expect(lauf.ausgabe).toContain("Glied 1 — Sidecar geprueft");
    expect(lauf.ausgabe).toContain("Glied 2 — leere Zieldatenbank");
    expect(lauf.ausgabe).toContain("Pflichttabellen vorhanden und Zeilenzahlen wie im Dump");
    expect(lauf.ausgabe).not.toContain("Glied 4 —");
    // Das Abräumen erkennt die tote Gruppe und sendet KEIN Signal ins Leere.
    expect(lauf.ausgabe).toContain("lebt nicht mehr");
    expect(lauf.pidDateiBleibt).toBe(false);
    expect(await portFrei(port)).toBe(true);
    expect(await zielTabellen(zielDbLauncher)).toBeGreaterThan(0);
  }, 600_000);

  // ================================================================================================
  // K1 — PROZESSABBAU MIT SIGKILL-ESKALATION, AN DER ECHTEN ANWENDUNG
  // ================================================================================================
  it("K1 · Server ignoriert SIGTERM: die zweite Stufe greift, Gruppe leer, Port frei, Exit 0", async (ctx) => {
    if (!verfuegbar || !verbindung) {
      ctx.skip();
      return;
    }
    const port = await freierPort();
    const arbeit = join(arbeitsordner, "k1");
    mkdirSync(arbeit, { recursive: true });
    const vorlade = join(arbeit, "taub-bei-sigterm.cjs");
    writeFileSync(vorlade, TAUB_BEI_SIGTERM);
    const protokoll = join(arbeit, "taub.protokoll");
    const vorhandeneOptionen = process.env.NODE_OPTIONS ?? "";

    const lauf = fahreDrill(verbindung, zielDbAbbau, port, arbeit, {
      NODE_OPTIONS: `${vorhandeneOptionen} --require ${vorlade}`.trim(),
      WAECHTER_TAUB_PROTOKOLL: protokoll,
    });

    // Der Serverprozess war wirklich taub: er hat sich gemeldet und das SIGTERM empfangen, ohne
    // zu enden. Ohne diese Zeilen wäre nicht zu unterscheiden, ob die zweite Stufe gebraucht wurde.
    // (`argv` endet auch bei npx und dem tsx-Starter auf server.ts — auch sie werden taub; das
    // ändert nichts an der Frage, macht sie nur strenger.)
    const zeilen = existsSync(protokoll) ? readFileSync(protokoll, "utf8") : "";
    const taube = [...zeilen.matchAll(/^taub (\d+)$/gm)].map((m) => Number(m[1]));
    const serverPid = Number(/Serverprozess (\d+)/.exec(lauf.ausgabe)?.[1] ?? 0);
    expect(taube, `${zeilen}\n${lauf.ausgabe}`).toContain(serverPid);
    expect(zeilen).toContain(`SIGTERM empfangen ${serverPid}`);

    expect(lauf.status, lauf.ausgabe).toBe(0);
    expect(lauf.ausgabe).toContain("DRILL BESTANDEN");
    expect(lauf.ausgabe).toContain("Anhangsinhalt zurueckgelesen");
    expect(lauf.ausgabe).toContain("SIGTERM hat nicht gereicht — SIGKILL an die eigene Gruppe");
    expect(lauf.ausgabe).toContain("restlos beendet");
    expect(lauf.gruppe).toBeGreaterThan(0);
    for (const pid of taube) {
      expect(prozessLebt(pid), `taub gemachter Prozess ${pid} lebt noch`).toBe(false);
    }
    expect(gruppenMitglieder(lauf.gruppe)).toEqual([]);
    expect(lauf.pidDateiBleibt).toBe(false);
    expect(await portFrei(port)).toBe(true);
  }, 600_000);
});
