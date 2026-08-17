import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../db-tx";
import { GENESIS, hashEntry } from "./chain";
import {
  AUDIT_EVENT_ID_SCHEMA,
  AUDIT_HASH_VERSION_SCHEMA,
  AUDIT_SCHEMA,
  PgAuditRepo,
} from "./repo-pg";
import { AuditService } from "./service";

// WP-SHIP8-CLOSE-6 (bens ROT-1): echte Postgres-Belege für den exactly-once-Vertrag des
// Audit-Belegs — additive event_id-Migration auf Bestand (idempotenter Re-Run, Altzeilen bleiben
// NULL), partieller Unique-Index, appendOnce/recordOnce sequenziell UND parallel. Muster wie die
// knowledge-object-Suite: Docker (Testcontainers) oder eine lokale, per GELB-Sicherung
// freigegebene Testinstanz (KLARWERK_PG_TEST_URL); läuft NUR unter `test:integration`, ohne
// verfügbare Instanz sauberer Skip statt gefälschtem Grün.

describe("WP-SHIP8-CLOSE-6 (bens ROT-1): audit_event_id_uq gegen echtes Postgres", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;

  beforeAll(async () => {
    // Lokale Instanz hat Vorrang (Docker-lose Evidence-Läufe) — HART abgesichert (bens GELB):
    // nur Testdatenbanken oder ausdrückliches KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE=1.
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
        available = true;
        return;
      } catch {
        process.stderr.write(
          "[KLARWERK] Audit-Pg-Integrationssuite ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
        );
        available = false;
        return;
      }
    }
    if (process.env.KLARWERK_PG_TEST_URL) {
      // URL war gesetzt, die Sicherung hat sie abgelehnt (Grund steht auf stderr) → KEIN
      // Testcontainers-Fallback: der Aufrufer wollte ausdrücklich eine lokale Instanz.
      available = false;
      return;
    }
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      pool = new Pool({
        connectionString: `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk`,
      });
      available = true;
    } catch {
      available = false; // kein Docker/PG → skip statt Fehlschlag
    }
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  function requirePool(ctx: { skip: () => void }): Pool {
    if (!available || !pool) {
      ctx.skip();
      throw new Error("unreachable"); // ctx.skip() bricht ab; nur fürs Typing
    }
    return pool;
  }

  async function reset(p: Pool): Promise<void> {
    await p.query("DROP TABLE IF EXISTS audit CASCADE");
  }

  // JOB 498 D8 — DIE ALTZEILEN ENTSTEHEN JETZT PER ROH-SQL, UND ZWAR AUS EINEM GRUND.
  //
  // Bis D8 legte dieser Fall seine Altzeilen mit `service.record()` an. Das geht nicht mehr: seit
  // D8 schreibt `append` die Spalte `hash_version` ausdrücklich mit, und eine Bestandstabelle VOR
  // der Migration hat diese Spalte nicht — der Insert liefe in einen Datenbankfehler.
  //
  // Der Ersatz ist nicht bloß gleichwertig, er ist ehrlicher: eine echte Altzeile stammt eben NICHT
  // aus dem heutigen Schreibweg. Sie wird hier mit V1-Material gehasht und roh eingefügt, genau so,
  // wie sie in einer Bestandsinstanz liegt.
  async function legeAltzeileAn(p: Pool, seq: number, action: string, prevHash: string) {
    const roh = {
      seq,
      at: `2026-07-0${seq}T00:00:00.000Z`,
      actor: "alt",
      action,
      target: "alt-1",
      payload: {} as Record<string, unknown>,
      prevHash,
    };
    const hash = hashEntry(roh);
    await p.query(
      "INSERT INTO audit(seq,at,actor,action,target,payload,prev_hash,hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        roh.seq,
        roh.at,
        roh.actor,
        roh.action,
        roh.target,
        JSON.stringify(roh.payload),
        roh.prevHash,
        hash,
      ],
    );
    return hash;
  }

  it("BESTANDS-UPGRADE: event_id- UND hash_version-Migration auf Tabelle mit Altzeilen + idempotenter Re-Run", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    // Bestandsinstanz: NUR AUDIT_SCHEMA (vor CLOSE-6), zwei V1-Altzeilen liegen bereits drin.
    await pool.query(AUDIT_SCHEMA);
    const h1 = await legeAltzeileAn(pool, 1, "ko.created", GENESIS);
    await legeAltzeileAn(pool, 2, "ko.updated", h1);
    const service = new AuditService({ repo: new PgAuditRepo(pool) });

    // Additive Migration läuft auf dem Bestand — und ist im Re-Run idempotent.
    await expect(pool.query(AUDIT_EVENT_ID_SCHEMA)).resolves.toBeDefined();
    await expect(pool.query(AUDIT_EVENT_ID_SCHEMA)).resolves.toBeDefined();
    const alt = await pool.query("SELECT event_id FROM audit ORDER BY seq");
    expect(alt.rows.map((r) => r.event_id)).toEqual([null, null]);
    const idx = await pool.query(
      "SELECT indexdef FROM pg_indexes WHERE indexname='audit_event_id_uq'",
    );
    expect(idx.rowCount).toBe(1);
    expect(String(idx.rows[0].indexdef)).toContain("IS NOT NULL");

    // JOB 498 D8: dieselbe Bestandsprobe für die Hashversion. Die beiden Altzeilen SIND V1 — sie
    // wurden mit V1-Material gehasht, und `NOT NULL DEFAULT 1` sagt genau das, ohne etwas
    // umzurechnen. Eine Migration, die hier Werte anfasste, wäre keine additive mehr.
    await expect(pool.query(AUDIT_HASH_VERSION_SCHEMA)).resolves.toBeDefined();
    await expect(pool.query(AUDIT_HASH_VERSION_SCHEMA)).resolves.toBeDefined();
    const versionen = await pool.query("SELECT hash_version FROM audit ORDER BY seq");
    expect(versionen.rows.map((r) => r.hash_version)).toEqual([1, 1]);

    // Die Kette überlebt BEIDE Migrationen unverändert, und der Altbestand liest als Version 1.
    expect(await service.verify()).toBe(true);
    for (const eintrag of await service.list()) {
      expect(eintrag.hashVersion).toBe(1);
    }

    // T3 auf echtem Postgres: der nächste Eintrag ist V2, und die gemischte Kette bleibt gültig.
    const neu = await service.record({ actor: "neu", action: "ko.rated", target: "alt-1" });
    expect(neu.hashVersion).toBe(2);
    expect(await service.verify()).toBe(true);
    const roundtrip = await service.list();
    expect(roundtrip.map((e) => e.hashVersion)).toEqual([1, 1, 2]);
  });

  it("EXACTLY-ONCE sequenziell: recordOnce mit derselben Event-Id schreibt genau EINE Zeile, der zweite Aufruf meldet false", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    await pool.query(AUDIT_SCHEMA);
    await pool.query(AUDIT_EVENT_ID_SCHEMA);
    await pool.query(AUDIT_HASH_VERSION_SCHEMA);
    const service = new AuditService({ repo: new PgAuditRepo(pool) });
    expect(
      await service.recordOnce("ko.created:ko-1", {
        actor: "a",
        action: "ko.created",
        target: "ko-1",
      }),
    ).toBe(true);
    expect(
      await service.recordOnce("ko.created:ko-1", {
        actor: "b",
        action: "ko.created",
        target: "ko-1",
      }),
    ).toBe(false);
    const rows = await pool.query("SELECT actor, event_id FROM audit");
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0]).toEqual({ actor: "a", event_id: "ko.created:ko-1" });
    // record() ohne Event-Id bleibt unbegrenzt (partieller Index) und die Kette intakt.
    await service.record({ actor: "c", action: "ko.updated", target: "ko-1" });
    await service.record({ actor: "c", action: "ko.updated", target: "ko-1" });
    expect(await service.verify()).toBe(true);
  });

  it("bens Pflichttest (Pg): zwei PARALLELE Nachzüge derselben Event-Id → exakt EINE Zeile, Kette intakt", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    await pool.query(AUDIT_SCHEMA);
    await pool.query(AUDIT_EVENT_ID_SCHEMA);
    await pool.query(AUDIT_HASH_VERSION_SCHEMA);
    const service = new AuditService({ repo: new PgAuditRepo(pool) });
    // Beide lesen denselben (leeren) Ketten-Stand — der Unique-Index + ON CONFLICT DO NOTHING
    // entscheidet in der DB, nicht der Read (exakt bens Query-then-Write-Race).
    const results = await Promise.all([
      service.recordOnce("ko.created:ko-p", { actor: "a", action: "ko.created", target: "ko-p" }),
      service.recordOnce("ko.created:ko-p", { actor: "b", action: "ko.created", target: "ko-p" }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const rows = await pool.query("SELECT count(*)::int AS n FROM audit");
    expect(rows.rows[0].n).toBe(1);
    expect(await service.verify()).toBe(true);
  });

  // AUFTRAG-mega2 Block F / bens Auflage 5: MEHRSCHLÜSSELIGE, VERSCHACHTELTE Payload über
  // Schreiben → Zurücklesen → Verifizieren. Der bestehende Bestand schreibt nur LEERE Payloads und
  // kann den vermuteten jsonb-Reihenfolge-Fehler NICHT sehen. Die Payload-Schlüssel stehen bewusst
  // NICHT in jsonb-Kanonordnung (jsonb sortiert Objekt-Schlüssel nach Länge, dann bytweise), damit
  // das Zurücklesen eine ANDERE JSON.stringify-Form ergibt als beim Schreiben — genau der Bruch, den
  // hashEntry über JSON.stringify(payload) sichtbar macht.
  //
  // JOB 498 D8 — DIE MARKIERUNG IST WEG, WEIL DER BEFUND WEG IST.
  //
  // Hier stand `it.fails(...)` mit dem Titel „überlebt den jsonb-Roundtrip NICHT (erwartet-rot)".
  // Das war die ehrliche Form für einen offenen Livebug: der Test war GRÜN, weil die Zusicherung
  // fehlschlug. Der Kommentar darüber sagte selbst, was dann zu tun ist — „Wird die Kette später
  // kanonisch/serialisierungsstabil gemacht, kippt der Test auf ROT und erinnert daran, diese
  // Markierung zu entfernen."
  //
  // Genau das ist eingetreten. V2 hasht `canonicalJson(payload)` statt `JSON.stringify(payload)`
  // und damit den WERT statt seiner Schreibweise; die Rückleseordnung von `jsonb` ist für den Hash
  // ohne Bedeutung. Titel und Messung sagen deshalb wieder dasselbe.
  it("AUFTRAG-mega2 Block F / bens Auflage 5: verschachtelte Multi-Key-Payload überlebt den jsonb-Roundtrip", async (ctx) => {
    const pool = requirePool(ctx);
    await reset(pool);
    await pool.query(AUDIT_SCHEMA);
    await pool.query(AUDIT_EVENT_ID_SCHEMA);
    await pool.query(AUDIT_HASH_VERSION_SCHEMA);
    const service = new AuditService({ repo: new PgAuditRepo(pool) });

    // Schlüsselreihenfolge bewusst gegen die jsonb-Kanonordnung gewählt (Länge, dann Bytes).
    const payload = {
      zulu: "z",
      alpha: 1,
      mike: { yankee: true, bravo: [3, 2, 1], "kilo-2": null },
      nummer: 42,
      liste: [{ b: 1, a: 2 }, "x"],
    };
    await service.record({ actor: "a", action: "ko.updated", target: "nested-1", payload });

    // Inhalt bleibt über den jsonb-Roundtrip erhalten (deep-equal ignoriert Schlüsselreihenfolge).
    const [stored] = await service.list({ target: "nested-1" });
    expect(stored?.payload).toEqual(payload);
    expect(stored?.hashVersion).toBe(2);

    // DIE EIGENTLICHE ZUSAGE DIESES DURCHGANGS: hier stand vorher `false`.
    expect(await service.verify()).toBe(true);
    const bericht = await service.verifyReport();
    expect(bericht.ok).toBe(true);
    expect(bericht.payloadDeviations).toBe(0);
    expect(bericht.serialisationDeviations).toBe(0);

    // Und die Gegenprobe zur Kanonisierung: Arrays wurden NICHT normiert. `bravo` liegt noch so da,
    // wie es geschrieben wurde — sonst hätte V2 eine Inhaltsänderung wegsortiert.
    expect((stored?.payload.mike as { bravo: number[] }).bravo).toEqual([3, 2, 1]);
  });
});
