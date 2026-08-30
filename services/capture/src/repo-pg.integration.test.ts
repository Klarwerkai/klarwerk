// ================================================================================================
// JOB 2697 · D7 — DER PERSISTENZVERTRAG GEGEN ECHTES POSTGRESQL (P0 bis P5).
// ================================================================================================
//
// WARUM ES DIESE DATEI BRAUCHT: Der In-Memory-Spiegel in `repo.ts` ist eine NACHBILDUNG des
// partiellen Unique-Index. Eine Nachbildung beweist nichts über das Original — und genau der Index
// ist das tragende Teil: nur er hält über ZWEI Serverinstanzen und über einen Neustart. BEN hat
// dieselbe Lücke bei `2709 D1` als Scheinbeleg verworfen: „ein In-Memory-Rennen plus SQL-Textprüfung
// genügt nicht."
//
// STATUS IN DIESER UMGEBUNG: NICHT AUSGEFÜHRT. Gemessen (Rückgabe D7, §PostgreSQL):
// `psql --version` endet mit `command not found` (Exitcode 127), der Docker-Socket antwortet
// `permission denied`, `KLARWERK_PG_TEST_URL` ist nicht gesetzt. Die Suite meldet dann einen
// SICHTBAREN Skip mit Klartext auf stderr — ein stiller Skip sähe aus wie ein bestandener Lauf.
//
// SIE IST STARTBAR, ohne dass eine Zeile geändert werden muss:
//
//     KLARWERK_PG_TEST_URL=postgres://user:pass@127.0.0.1:5432/klarwerk_test \
//       npx vitest run services/capture/src/repo-pg.integration.test.ts \
//       --maxWorkers=2 --minWorkers=1 --reporter=basic
//
// Der Datenbankname MUSS `test` enthalten — `guardedLocalPgTestUrl` weist sonst ab
// (`services/db-tx/src/pg-test-guard.ts:25-33`), weil diese Suite eine Tabelle anlegt und abräumt.
//
// DAS MUSTER IST DAS EINGEFÜHRTE, nicht ein zweites:
// `services/knowledge-object/src/create-operation-pg.integration.test.ts:107-145` — lokale URL mit
// Vorrang, sonst Testcontainers, sonst sichtbarer Skip. Und BENs Belegauflage von dort gilt hier
// genauso: ZWEI POOLS statt eines geteilten, sonst könnte ein geteiltes Objekt die Serialisierung
// erklären statt der Datenbank.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../db-tx";
import { CAPTURE_CREATE_OPERATION_SCHEMA, CAPTURE_SCHEMA, PgDraftRepo } from "./repo-pg";
import type { Draft } from "./types";

function entwurf(id: string, over: Partial<Draft> = {}): Draft {
  return {
    id,
    payload: { title: "Ventil prüfen", bodyHtml: "<p>Text</p>" },
    originalAuthor: "u1",
    lastEditor: "u1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

const vorgang = (id: string, actor: string, fingerprint = "abc") => ({ id, actor, fingerprint });

let container: StartedTestContainer | undefined;
let verbindung: string | undefined;
let available = false;

beforeAll(async () => {
  const localUrl = guardedLocalPgTestUrl();
  if (localUrl) {
    try {
      const probe = new Pool({ connectionString: localUrl });
      await probe.query("SELECT 1");
      await probe.end();
      verbindung = localUrl;
      available = true;
      return;
    } catch {
      process.stderr.write(
        "[KLARWERK] JOB 2697 Pg-Vertrag ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
      );
      available = false;
      return;
    }
  }
  try {
    container = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forListeningPorts())
      .start();
    verbindung = `postgres://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
    available = true;
  } catch {
    process.stderr.write(
      "[KLARWERK] JOB 2697 Pg-Vertrag ÜBERSPRUNGEN: weder KLARWERK_PG_TEST_URL noch eine Container-Laufzeit verfügbar.\n",
    );
    available = false;
  }
}, 180_000);

afterAll(async () => {
  await container?.stop();
});

/** Frischer Bestand je Fall — die Stufe ist idempotent, das Aufräumen ist es auch. */
async function frischesSchema(pool: Pool): Promise<void> {
  await pool.query("DROP TABLE IF EXISTS drafts");
  await pool.query(CAPTURE_SCHEMA);
  await pool.query(CAPTURE_CREATE_OPERATION_SCHEMA);
}

/** Meldet ehrlich, dass dieser Fall NICHT MESSBAR war — nicht, dass er bestanden hat. */
function nichtMessbar(): void {
  expect(
    available,
    "kein PostgreSQL erreichbar — dieser Fall ist NICHT MESSBAR, nicht bestanden",
  ).toBe(false);
}

describe("JOB 2697 D7 · PgDraftRepo · der Vorgang in echtem PostgreSQL", () => {
  it("die Migrationsstufe läuft durch und ist wiederholbar", async () => {
    if (!available) {
      nichtMessbar();
      return;
    }
    const pool = new Pool({ connectionString: verbindung });
    try {
      await frischesSchema(pool);
      // Zweimal — `ADD COLUMN IF NOT EXISTS` und `CREATE UNIQUE INDEX IF NOT EXISTS` sind additiv.
      await pool.query(CAPTURE_CREATE_OPERATION_SCHEMA);
      const spalten = await pool.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_name='drafts'",
      );
      const namen = spalten.rows.map((r) => r.column_name);
      expect(namen).toContain("create_operation_id");
      expect(namen).toContain("create_operation_actor");
    } finally {
      await pool.end();
    }
  }, 120_000);

  it("P0 · KALIBRIERUNG: zwei Anlagen OHNE Vorgang ergeben zwei Zeilen", async () => {
    if (!available) {
      nichtMessbar();
      return;
    }
    const pool = new Pool({ connectionString: verbindung });
    try {
      await frischesSchema(pool);
      const repo = new PgDraftRepo(pool);
      await repo.insertIfOperationAbsent(entwurf("d1"));
      await repo.insertIfOperationAbsent(entwurf("d2"));
      expect(await repo.list()).toHaveLength(2);
    } finally {
      await pool.end();
    }
  }, 120_000);

  it("P1 · gleicher Eigentümer, gleiche Kennung: EINE Zeile, der zweite bekommt den ersten", async () => {
    if (!available) {
      nichtMessbar();
      return;
    }
    const pool = new Pool({ connectionString: verbindung });
    try {
      await frischesSchema(pool);
      const repo = new PgDraftRepo(pool);
      const erst = await repo.insertIfOperationAbsent(
        entwurf("d1", { createOperation: vorgang("op-1", "u1") }),
      );
      const zweit = await repo.insertIfOperationAbsent(
        entwurf("d2", { createOperation: vorgang("op-1", "u1") }),
      );
      expect(erst.angelegt).toBe(true);
      expect(zweit.angelegt).toBe(false);
      if (!zweit.angelegt) {
        expect(zweit.bestehend.id).toBe("d1");
      }
      expect(await repo.list()).toHaveLength(1);
    } finally {
      await pool.end();
    }
  }, 120_000);

  it("P2 · derselbe Vorgang mit abweichendem Abdruck: die Ablage liefert den bestehenden Datensatz", async () => {
    // Die 409-Entscheidung trifft der Dienst, nicht die Ablage — hier wird belegt, dass die Ablage
    // ihm den ECHTEN gespeicherten Abdruck vorlegt, an dem er sie treffen kann.
    if (!available) {
      nichtMessbar();
      return;
    }
    const pool = new Pool({ connectionString: verbindung });
    try {
      await frischesSchema(pool);
      const repo = new PgDraftRepo(pool);
      await repo.insertIfOperationAbsent(
        entwurf("d1", { createOperation: vorgang("op-1", "u1", "abdruck-A") }),
      );
      const zweit = await repo.insertIfOperationAbsent(
        entwurf("d2", { createOperation: vorgang("op-1", "u1", "abdruck-B") }),
      );
      expect(zweit.angelegt).toBe(false);
      if (!zweit.angelegt) {
        expect(zweit.bestehend.createOperation?.fingerprint).toBe("abdruck-A");
      }
      expect(await repo.list()).toHaveLength(1);
    } finally {
      await pool.end();
    }
  }, 120_000);

  it("P3 · VERSCHIEDENE Eigentümer, gleiche Kennung: zwei Zeilen, keiner sieht den anderen", async () => {
    // Die Denial-Kante. Und der Grund, warum die Nachlese KEINEN `IS NULL`-Zweig trägt: er würde
    // eine Zeile ohne Eigentümer an einen beliebigen Anfragenden geben.
    if (!available) {
      nichtMessbar();
      return;
    }
    const pool = new Pool({ connectionString: verbindung });
    try {
      await frischesSchema(pool);
      const repo = new PgDraftRepo(pool);
      const a = await repo.insertIfOperationAbsent(
        entwurf("d1", { createOperation: vorgang("op-1", "u1") }),
      );
      const b = await repo.insertIfOperationAbsent(
        entwurf("d2", { originalAuthor: "u2", createOperation: vorgang("op-1", "u2") }),
      );
      expect(a.angelegt).toBe(true);
      expect(b.angelegt, "u2 wurde von der Kennung von u1 blockiert").toBe(true);
      expect(await repo.list()).toHaveLength(2);
    } finally {
      await pool.end();
    }
  }, 120_000);

  it("P4 · ZWEI INSTANZEN, echte Überlappung: eine Zeile, beide bekommen denselben Entwurf", async () => {
    // ZWEI POOLS — BENs Belegauflage. Mit einem geteilten Pool könnte ein gemeinsames Objekt die
    // Serialisierung erklären statt des Index. Und KEIN roher Datenbankfehler bei einem der beiden:
    // `ON CONFLICT DO NOTHING` plus Nachlese fängt die Kollision, statt sie durchzureichen.
    if (!available) {
      nichtMessbar();
      return;
    }
    const aufbau = new Pool({ connectionString: verbindung });
    await frischesSchema(aufbau);
    await aufbau.end();
    const poolA = new Pool({ connectionString: verbindung, max: 2 });
    const poolB = new Pool({ connectionString: verbindung, max: 2 });
    try {
      const repoA = new PgDraftRepo(poolA);
      const repoB = new PgDraftRepo(poolB);
      const [a, b] = await Promise.all([
        repoA.insertIfOperationAbsent(entwurf("d1", { createOperation: vorgang("op-1", "u1") })),
        repoB.insertIfOperationAbsent(entwurf("d2", { createOperation: vorgang("op-1", "u1") })),
      ]);
      expect(await repoA.list(), "zwei Instanzen legten zwei Entwürfe an").toHaveLength(1);
      const ids = [
        a.angelegt ? a.draft.id : a.bestehend.id,
        b.angelegt ? b.draft.id : b.bestehend.id,
      ];
      expect(ids[0], "die beiden bekamen verschiedene Entwürfe").toBe(ids[1]);
      expect(
        [a.angelegt, b.angelegt].filter(Boolean),
        "beide hielten sich für die Anlage",
      ).toHaveLength(1);
    } finally {
      await poolA.end();
      await poolB.end();
    }
  }, 120_000);

  it("P5 · NEUSTART DES DIENSTES: der Vorgang überlebt, es bleibt bei einer Zeile", async () => {
    // Das ist die Zusage, die ein prozesslokales Register NICHT geben kann — der Grund, aus dem
    // BEN den D4-Bau verworfen hat.
    if (!available) {
      nichtMessbar();
      return;
    }
    const erst = new Pool({ connectionString: verbindung });
    await frischesSchema(erst);
    await new PgDraftRepo(erst).insertIfOperationAbsent(
      entwurf("d1", { createOperation: vorgang("op-1", "u1") }),
    );
    await erst.end();

    // Alles neu aufgebaut: neuer Pool, neues Repo — als wäre der Dienst durchgestartet.
    const nachNeustart = new Pool({ connectionString: verbindung });
    try {
      const repo = new PgDraftRepo(nachNeustart);
      const zweit = await repo.insertIfOperationAbsent(
        entwurf("d2", { createOperation: vorgang("op-1", "u1") }),
      );
      expect(zweit.angelegt, "nach dem Neustart wurde erneut angelegt").toBe(false);
      if (!zweit.angelegt) {
        expect(zweit.bestehend.id).toBe("d1");
      }
      expect(await repo.list()).toHaveLength(1);
    } finally {
      await nachNeustart.end();
    }
  }, 120_000);

  it("GEGENMUTATION: ohne den partiellen Unique-Index entstehen zwei Zeilen", async () => {
    // Ohne diesen Fall bewiese P1 nur, dass zweimal dasselbe herauskommt — nicht, dass der Index
    // die Ursache ist. Gemessen wird mit demselben Ablauf gegen ein Schema OHNE die Stufe.
    if (!available) {
      nichtMessbar();
      return;
    }
    const pool = new Pool({ connectionString: verbindung });
    try {
      await pool.query("DROP TABLE IF EXISTS drafts");
      await pool.query(CAPTURE_SCHEMA); // OHNE CAPTURE_CREATE_OPERATION_SCHEMA
      await pool.query("INSERT INTO drafts(id,data) VALUES($1,$2::jsonb)", [
        "d1",
        JSON.stringify(entwurf("d1", { createOperation: vorgang("op-1", "u1") })),
      ]);
      await pool.query("INSERT INTO drafts(id,data) VALUES($1,$2::jsonb)", [
        "d2",
        JSON.stringify(entwurf("d2", { createOperation: vorgang("op-1", "u1") })),
      ]);
      const zahl = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM drafts");
      expect(zahl.rows[0]?.n, "ohne Index verhinderte trotzdem etwas die zweite Zeile").toBe("2");
    } finally {
      await pool.end();
    }
  }, 120_000);
});
