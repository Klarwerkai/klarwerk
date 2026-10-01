// ================================================================================================
// R-0794 · DIE FESTE STATUSADRESSE ÜBER EINEN ECHTEN SERVERPROZESS UND ECHTES POSTGRESQL.
// ================================================================================================
//
// Nacharbeit zu Ben (beleg:58e0fb17, geprüfter Commit 3958fa4d): Die Health-Gesamtauskunft war nur
// über `buildApp`/`app.inject` mit In-Memory-Laufprotokoll belegt. Diese Strecke prüft sie dort, wo
// sie im Betrieb antwortet:
//
//   · eine WEGWERF-PostgreSQL mit `test` im Namen, am Ende `DROP … WITH (FORCE)`;
//   · `services/app/src/server.ts` als eigener Betriebssystemprozess mit NICHT geerbter Umgebung
//     (`serverUmgebung` aus `tests/gesamtanweisung-nutzerweg/weg.ts`), `NODE_ENV=production`,
//     eigenem Port, festem Test-SHA in `KLARWERK_BUILD_COMMIT`. Kein Anbieter-Schlüssel, keine
//     lokale Modelladresse, `KLARWERK_SKIP_KEYCHAIN=1` → deterministischer KI-Modus ohne Egress;
//   · echtes HTTP über den Socket — kein `buildApp`, kein `app.inject`.
//
// ABLAUF: (1) Datenbank anlegen · (2) Prozess starten · (3) genau einen KI-Lauf über
// `POST /api/reasoner` auslösen und seinen Protokolleintrag DIREKT aus `model_runs` lesen ·
// (4) `GET /health` prüfen: Laufzustand, KI-Modus, Version aus `package.json`, voller Commit =
// Test-SHA, und die Historie enthält genau den in (3) gelesenen Lauf (Aufgabe, Ausgang, Endzeit).
//
// GEGENPROBEN IM SELBEN WEG:
//   (a) Die Historie VOR dem Lauf enthält ihn nicht — dieselbe Zuordnungsprüfung schlägt an ihr
//       nachweislich fehl.
//   (b) Ein zweiter Prozess gegen dieselbe Datenbank OHNE `KLARWERK_BUILD_COMMIT` meldet
//       `unbekannt` und nicht den Test-SHA.
//   (c) Fehlt die gesicherte PostgreSQL-Verbindung (`KLARWERK_PG_TEST_URL`), wird das über den
//       Laufzustand AUSDRÜCKLICH als „nicht ausgeführt, nicht belegt" gemeldet
//       (`tests/wiki-gesamtanweisung-abnahme/laufzustand.ts`), nie still als bestanden. Ist die
//       Verbindung gesetzt, aber nicht erreichbar, scheitert `beforeAll` laut.
//
// WAS SIE NICHT BELEGT: ein gebautes Container-Image, Coolify, die Live-Auslieferung, einen echten
// Cloud- oder lokalen Modellanbieter.
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { PASSWORT, Sitzung, mussGelingen } from "../gast-nutzerweg/strecke";
import {
  type Verbindung,
  WURZEL,
  freierPort,
  pgUrl,
  schneideMit,
  serverUmgebung,
  warteAufGesund,
  zerlege,
} from "../gesamtanweisung-nutzerweg/weg";
import {
  type Laufzustand,
  befundsatz,
  zaehltAlsBestanden,
} from "../wiki-gesamtanweisung-abnahme/laufzustand";

const MARKE = "R-0794 HEALTH-PG";
const TEST_SHA = "5eed0a1b2c3d4e5f60718293a4b5c6d7e8f90123";
const ADMIN = "health-admin@deploy-health-commit.test";
/** Zusammengesetzt statt ausgeschrieben (Regel aus `tests/app/job2354-drei-datenbanknamen.test.ts`). */
const PG_SCHEMA_TEIL = `${"postgres"}ql://`;

interface HealthLauf {
  task?: unknown;
  status?: unknown;
  mode?: unknown;
  fallback?: unknown;
  finishedAt?: unknown;
}

interface HealthKoerper {
  status?: unknown;
  version?: unknown;
  commit?: unknown;
  ai?: Record<string, unknown>;
  aiRuns?: { available?: unknown; recent?: HealthLauf[] };
}

interface PgLauf {
  id: string;
  task: string;
  status: string;
  finishedAt: string;
  provider: string;
  model?: string;
}

function paketVersion(): string {
  const roh = readFileSync(join(WURZEL, "package.json"), "utf8");
  return String((JSON.parse(roh) as { version?: unknown }).version ?? "");
}

async function health(basis: string): Promise<{ code: number; roh: string; body: HealthKoerper }> {
  const antwort = await fetch(`${basis}/health`, { cache: "no-store" });
  const roh = await antwort.text();
  return { code: antwort.status, roh, body: JSON.parse(roh) as HealthKoerper };
}

/** Trägt die Historie GENAU diesen aus PostgreSQL gelesenen Lauf? (Aufgabe, Ausgang, Endzeit.) */
function enthaeltLauf(recent: HealthLauf[], lauf: PgLauf): boolean {
  return recent.some(
    (r) => r.task === lauf.task && r.status === lauf.status && r.finishedAt === lauf.finishedAt,
  );
}

/** Alle Schlüssel eines JSON-Werts, rekursiv — für „kein Anbieter-/Modellfeld irgendwo". */
function alleSchluessel(wert: unknown, ablage: string[] = []): string[] {
  if (Array.isArray(wert)) {
    for (const eintrag of wert) {
      alleSchluessel(eintrag, ablage);
    }
  } else if (wert !== null && typeof wert === "object") {
    for (const [schluessel, inhalt] of Object.entries(wert)) {
      ablage.push(schluessel);
      alleSchluessel(inhalt, ablage);
    }
  }
  return ablage;
}

async function beende(prozess: ChildProcessWithoutNullStreams): Promise<void> {
  if (prozess.exitCode === null && prozess.signalCode === null) {
    const aus = new Promise<void>((fertig) => prozess.once("exit", () => fertig()));
    prozess.kill("SIGTERM");
    await aus;
  }
}

describe("R-0794 · /health über echten Serverprozess und echtes PostgreSQL", () => {
  let adminPool: Pool | undefined;
  let verbindung: Verbindung | undefined;
  let laufzustand: Laufzustand | undefined;
  const db = `klarwerk_health_r0794_test_${`${Date.now()}`.slice(-9)}`;

  beforeAll(async () => {
    const url = guardedLocalPgTestUrl();
    if (!url) {
      laufzustand = {
        gelaufen: false,
        grund:
          "keine gesicherte KLARWERK_PG_TEST_URL — Serverprozess gegen PostgreSQL nicht ausgeführt",
      };
      process.stderr.write(befundsatz(MARKE, laufzustand));
      return;
    }
    verbindung = zerlege(url);
    if (!verbindung) {
      laufzustand = { gelaufen: false, grund: "KLARWERK_PG_TEST_URL nennt keinen Rechnernamen" };
      process.stderr.write(befundsatz(MARKE, laufzustand));
      return;
    }
    // Gesetzt, aber nicht erreichbar → hier wirft es. Das ist laut, nicht übersprungen.
    adminPool = new Pool({ connectionString: url });
    await adminPool.query("SELECT 1");
    await adminPool.query(`CREATE DATABASE ${db}`);
    laufzustand = { gelaufen: true, quelle: `${verbindung.host}:${verbindung.port}/${db}` };
    process.stderr.write(befundsatz(MARKE, laufzustand));
  }, 120_000);

  afterAll(async () => {
    if (adminPool) {
      await adminPool.query(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`).catch(() => undefined);
      await adminPool.end();
    }
  }, 120_000);

  it("(1–4) ein echter KI-Lauf steht in /health · (a) vorher nicht · (b) ohne Commit „unbekannt“", async (ctx) => {
    if (!zaehltAlsBestanden(laufzustand) || !verbindung) {
      ctx.skip();
      return;
    }
    expect(TEST_SHA).toMatch(/^[0-9a-f]{40}$/);
    const zugang = pgUrl(verbindung, db);
    const pool = new Pool({ connectionString: zugang });
    try {
      await mitTestSha(zugang, pool);
    } finally {
      await pool.end();
    }
  }, 600_000);

  /** (2)–(4), (a) und (b) — ausgelagert, damit der Pool in JEDEM Fall geschlossen wird. */
  async function mitTestSha(zugang: string, pool: Pool): Promise<void> {
    // ── (2) Prozess MIT Test-SHA ───────────────────────────────────────────────────────────────
    const port = await freierPort();
    const basis = `http://127.0.0.1:${port}`;
    const protokoll: string[] = [];
    const prozess = spawn("node", ["--import", "tsx", "services/app/src/server.ts"], {
      cwd: WURZEL,
      env: { ...serverUmgebung(zugang, port), KLARWERK_BUILD_COMMIT: TEST_SHA },
    });
    schneideMit(prozess, protokoll);

    let pgLauf: PgLauf | undefined;
    try {
      await warteAufGesund(basis, prozess, protokoll, "Start mit Test-SHA");

      // ── (a) Vorher: die Historie ist leer, der Lauf existiert noch nicht. ───────────────────
      const vorher = await health(basis);
      expect(vorher.code).toBe(200);
      expect(vorher.body.aiRuns?.available, `${MARKE}: ${vorher.roh}`).toBe(true);
      expect(vorher.body.aiRuns?.recent, `${MARKE}: ${vorher.roh}`).toEqual([]);
      const zeilenVorher = await pool.query("SELECT count(*)::int AS n FROM model_runs");
      expect(zeilenVorher.rows[0]?.n).toBe(0);

      // ── (3) Genau ein KI-Lauf über die echte HTTP-Route. ───────────────────────────────────
      const admin = new Sitzung(basis, "admin");
      mussGelingen(
        "POST /api/auth/setup",
        await admin.sende("POST", "/api/auth/setup", {
          name: "Admin",
          email: ADMIN,
          password: PASSWORT,
        }),
        201,
      );
      mussGelingen(
        "POST /api/reasoner (extract)",
        await admin.sende("POST", "/api/reasoner", {
          task: "extract",
          text: "Vor jeder Wartung ist der Hauptschalter zu verriegeln. Danach den Restdruck ablesen.",
          source: "transient-document",
          confidentiality: "intern",
        }),
      );

      // Der Protokolleintrag, DIREKT aus PostgreSQL — nicht über die Anwendung.
      const zeilen = await pool.query<{ data: PgLauf }>("SELECT data FROM model_runs");
      expect(zeilen.rows, `${MARKE}: genau ein Laufeintrag erwartet`).toHaveLength(1);
      pgLauf = zeilen.rows[0]?.data;
      if (!pgLauf) {
        throw new Error(`${MARKE}: model_runs trägt keinen lesbaren Eintrag`);
      }
      expect(pgLauf.id.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(pgLauf.finishedAt))).toBe(false);

      // ── (4) Die feste Statusadresse, per echtem HTTP. ──────────────────────────────────────
      const nachher = await health(basis);
      expect(nachher.code).toBe(200);
      const b = nachher.body;
      expect(b.status, "Anwendungszustand").toBe("ok");
      expect(b.version, "Version aus dem Bauvorgang (package.json)").toBe(paketVersion());
      expect(b.commit, "voller Commit = gesetzter Test-SHA").toBe(TEST_SHA);
      expect(b.ai?.mode, "aktiver KI-Modus ohne externen Anbieter").toBe("deterministic");
      expect(b.ai?.active).toBe(false);
      expect(b.aiRuns?.available).toBe(true);
      const recent = b.aiRuns?.recent ?? [];
      expect(recent, `${MARKE}: ${nachher.roh}`).toHaveLength(1);
      expect(
        enthaeltLauf(recent, pgLauf),
        `${MARKE}: /health nennt den aus PG gelesenen Lauf ${pgLauf.id} (${pgLauf.task}, ${pgLauf.status}, ${pgLauf.finishedAt}) nicht: ${nachher.roh}`,
      ).toBe(true);
      expect(recent[0]).toEqual({
        task: pgLauf.task,
        status: pgLauf.status,
        mode: "deterministic",
        fallback: false,
        finishedAt: pgLauf.finishedAt,
      });

      // Keine Geheimnisse, kein Anbieter-/Modellfeld, keine Laufkennung, kein Nutzer.
      const schluessel = alleSchluessel(b);
      for (const verboten of ["provider", "model", "actor", "subject", "error", "id"]) {
        expect(schluessel, `${MARKE}: /health trägt das Feld „${verboten}"`).not.toContain(
          verboten,
        );
      }
      expect(nachher.roh).not.toContain(pgLauf.id);
      expect(nachher.roh).not.toContain(ADMIN);
      const passwort = verbindung?.passwort ?? "";
      if (passwort !== "") {
        expect(nachher.roh).not.toContain(passwort);
      }
      expect(nachher.roh).not.toContain(PG_SCHEMA_TEIL);
      if (pgLauf.model) {
        expect(nachher.roh).not.toContain(pgLauf.model);
      }

      // ── (a) Gegenprobe: dieselbe Zuordnungsprüfung an der Historie VOR dem Lauf. ────────────
      expect(
        enthaeltLauf(vorher.body.aiRuns?.recent ?? [], pgLauf),
        `${MARKE}: die Zuordnungsprüfung fand den Lauf in einer Historie, in der er nicht stehen kann — sie prüft nichts`,
      ).toBe(false);
    } finally {
      await beende(prozess);
    }

    // ── (b) Gegenprobe: zweiter Prozess, dieselbe Datenbank, OHNE KLARWERK_BUILD_COMMIT. ────────
    const port2 = await freierPort();
    const basis2 = `http://127.0.0.1:${port2}`;
    const protokoll2: string[] = [];
    const umgebung2 = serverUmgebung(zugang, port2);
    expect(umgebung2.KLARWERK_BUILD_COMMIT).toBeUndefined();
    const prozess2 = spawn("node", ["--import", "tsx", "services/app/src/server.ts"], {
      cwd: WURZEL,
      env: umgebung2,
    });
    schneideMit(prozess2, protokoll2);
    try {
      await warteAufGesund(basis2, prozess2, protokoll2, "Start ohne KLARWERK_BUILD_COMMIT");
      const ohne = await health(basis2);
      expect(ohne.code).toBe(200);
      expect(ohne.body.commit, `${MARKE}: ${ohne.roh}`).toBe("unbekannt");
      expect(ohne.roh).not.toContain(TEST_SHA);
      // Der Lauf überlebt den Prozesswechsel — er steht in PostgreSQL, nicht im Speicher.
      expect(enthaeltLauf(ohne.body.aiRuns?.recent ?? [], pgLauf)).toBe(true);
    } finally {
      await beende(prozess2);
    }
  }

  // Der Zeuge läuft IMMER: er fasst weder Datenbank noch Prozess an und sagt, was dieser Lauf belegt.
  it("R-0794z — der Laufzustand ist entschieden, und ein Skip zählt nicht als bestanden", () => {
    process.stderr.write(befundsatz(MARKE, laufzustand));
    expect(
      laufzustand,
      "kein Laufzustand — beforeAll lief nicht durch, und dann sagt der Exitcode dieses Laufs nichts über die Sache",
    ).toBeDefined();
    if (!zaehltAlsBestanden(laufzustand)) {
      expect((laufzustand as { gelaufen: false; grund: string }).grund.length).toBeGreaterThan(0);
      return;
    }
    expect((laufzustand as { gelaufen: true; quelle: string }).quelle).toContain(db);
  });
});
