import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AUDIT_EVENT_ID_SCHEMA,
  AUDIT_HASH_VERSION_SCHEMA,
  AUDIT_SCHEMA,
  type AuditEntry,
  type AuditRepo,
  AuditService,
  PgAuditRepo,
} from "../../audit";
import { type TxContext, guardedLocalPgTestUrl, withPgTx } from "../../db-tx";
import {
  KO_CREATE_OPERATION_SCHEMA,
  KO_IMPORT_ANCHOR_SCHEMA,
  KO_SCHEMA,
  KO_SICHTBARKEIT_SCHEMA,
  KoService,
  PgKoRepo,
} from "../../knowledge-object";
import { OVERLAP_SCHEMA, PgOverlapRepo } from "./overlap-repo-pg";
import { OverlapService } from "./overlap-service";
import { CONFLICTS_SCHEMA, PgConflictRepo } from "./repo-pg";
import { ConflictService } from "./service";

// ================================================================================================
// JOB 3066 · F3 — DIE ENDLÖSCHUNG UND IHR AUFRÄUMEN COMMITTEN GEMEINSAM, GEGEN ECHTES POSTGRES.
// ================================================================================================
//
// Was hier und NUR hier beweisbar ist: dass `PgOverlapRepo`/`PgConflictRepo` beim Aufräumen wirklich
// auf DEMSELBEN PoolClient schreiben, den `withPgTx` für `repo.delete` und `audit.record` geöffnet
// hat. Eine nachgebaute In-Memory-Transaktion (tests/aufraeumen-atomar) kann das strukturell nicht
// zeigen: sie beweist die Absicht der Verdrahtung, nicht die Transaktionsgrenze.
//
// Der Fall ist der aus JOB 3047 (archiv/3047/runde-4/ben.md, Korrekturpflicht 1): das Audit-Schreiben
// scheitert NACH den fachlichen Schreibungen. Danach darf nichts halb passiert sein.
//
// WARUM DIESE DATEI KNOWLEDGE-OBJECT IMPORTIERT, obwohl `conflicts` das Modul fachlich nicht kennt:
// der Vorgang, um den es geht, ist der Purge-Chokepoint (`KoService.purgeKo`), und ihn nachzubauen
// wäre kein Beleg, sondern eine Attrappe. Die Kante ist auf DIESE Testdatei begrenzt — keine
// Produktdatei von `conflicts` importiert knowledge-object; die Kompositionswurzel bleibt build-app.
//
// Gating wie repo-pg.integration.test.ts: lokale Instanz (durch `guardedLocalPgTestUrl` gesichert)
// hat Vorrang, sonst Testcontainers, sonst sauberer Skip — nie ein gefälschtes Grün.
// Lauf: `KLARWERK_SKIP_KEYCHAIN=1 npx vitest run --config vitest.integration.config.ts services/conflicts/src/purge-atomar.integration.test.ts`
describe("JOB 3066: Endlöschung und Befund-Aufräumung committen/rollbacken gemeinsam (echtes Postgres)", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
        available = true;
        return;
      } catch {
        process.stderr.write(
          "[KLARWERK] Pg-Integrationssuite ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
        );
        available = false;
        return;
      }
    }
    if (process.env.KLARWERK_PG_TEST_URL) {
      available = false;
      return;
    }
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      pool = new Pool({
        connectionString: `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
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

  // Scharfschaltbarer Fehler im AUDIT-Schreiben — die Injektionsstelle aus bens Korrekturpflicht.
  // Er trifft genau den `ko.purged`-Beleg und damit den letzten Schritt im Transaktionskörper.
  function auditMitAusfall(inner: AuditRepo, scharf: { an: boolean }): AuditRepo {
    return {
      append: async (entry: AuditEntry, tx?: TxContext) => {
        if (scharf.an && entry.action === "ko.purged") {
          throw new Error("Audit-Ablage nicht erreichbar");
        }
        return inner.append(entry, tx);
      },
      appendOnce: (entry, tx) => inner.appendOnce(entry, tx),
      all: () => inner.all(),
      last: (tx) => inner.last(tx),
    };
  }

  async function reset(p: Pool): Promise<void> {
    await p.query("DROP TABLE IF EXISTS conflicts CASCADE");
    await p.query("DROP TABLE IF EXISTS ko_overlaps CASCADE");
    await p.query("DROP TABLE IF EXISTS kos CASCADE");
    await p.query("DROP TABLE IF EXISTS ko_schreibstand CASCADE");
    await p.query("DROP TABLE IF EXISTS audit CASCADE");
    // R2 (bens Korrekturpflicht 2): NICHT nur die Grundstufen. Die verwendeten Pg-Adapter setzen
    // ihre ADDITIVEN Migrationsstufen voraus, und die Reihenfolge ist dieselbe wie in der
    // Kompositionswurzel (services/app/src/db.ts:47-89). Ohne AUDIT_EVENT_ID_SCHEMA und
    // AUDIT_HASH_VERSION_SCHEMA fehlen `event_id` und `hash_version`, und schon `ko.create`
    // scheitert im Aufbau: es schreibt seinen Beleg über `appendOnce`
    // (services/audit/src/repo-pg.ts:148-167), das beide Spalten benennt. Ein Test, der auf einem
    // Schema läuft, das es im Betrieb nicht gibt, beweist nichts.
    await p.query(KO_SCHEMA);
    await p.query(KO_IMPORT_ANCHOR_SCHEMA);
    await p.query(KO_CREATE_OPERATION_SCHEMA);
    await p.query(KO_SICHTBARKEIT_SCHEMA);
    await p.query(AUDIT_SCHEMA);
    await p.query(AUDIT_EVENT_ID_SCHEMA);
    await p.query(AUDIT_HASH_VERSION_SCHEMA);
    await p.query(CONFLICTS_SCHEMA);
    await p.query(OVERLAP_SCHEMA);
  }

  // Baut dieselbe Verdrahtung wie die Kompositionswurzel (build-app.ts): EIN Pool, EIN withPgTx,
  // die Befund-Aufräumung im transaktionsgebundenen Haken.
  async function welt(p: Pool, scharf: { an: boolean }) {
    const koRepo = new PgKoRepo(p);
    const auditRepo = auditMitAusfall(new PgAuditRepo(p), scharf);
    const audit = new AuditService({ repo: auditRepo });
    const conflictRepo = new PgConflictRepo(p);
    const overlapRepo = new PgOverlapRepo(p);
    const conflicts = new ConflictService({ repo: conflictRepo, audit });
    const overlaps = new OverlapService({ repo: overlapRepo, audit });
    const ko = new KoService({ repo: koRepo, audit, withTx: (fn) => withPgTx(p, fn) });
    ko.setPurgeTxCleanup(async (koId, actor, tx) => ({
      konflikteGeschlossen: await conflicts.onKoRemoved(koId, actor, tx),
      ueberschneidungenGeschlossen: await overlaps.onKoRemoved(koId, actor, tx),
    }));
    return { koRepo, auditRepo, conflictRepo, overlapRepo, conflicts, overlaps, ko };
  }

  async function zweiMitBefunden(w: Awaited<ReturnType<typeof welt>>) {
    const a = await w.ko.create({
      title: "KO A",
      statement: "Pumpe entlüften alle 200h.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
    });
    const b = await w.ko.create({
      title: "KO B",
      statement: "Pumpe alle 200 Stunden entlüften.",
      type: "best_practice",
      category: "Wartung",
      author: "bob",
    });
    const overlap = await w.overlaps.createAuto(
      {
        koA: a.id,
        koB: b.id,
        relation: "identisch",
        aspects: [{ beschreibung: "gleiche Anweisung", zitatA: "entlüften", zitatB: "entlüften" }],
        eigenanteilA: "",
        eigenanteilB: "",
        recommendation: "zusammenfuehren",
      },
      { trigger: "manual", method: "deterministic", lexicalScore: 0.95 },
      "system",
    );
    const conflict = await w.conflicts.create(
      { koA: a.id, koB: b.id, type: "truth", description: "Widerspruch zur Frist" },
      "anna",
    );
    return { a, b, overlap, conflict };
  }

  async function purgeBelege(p: Pool, koId: string): Promise<number> {
    const res = await p.query(
      "SELECT count(*)::int AS n FROM audit WHERE action='ko.purged' AND target=$1",
      [koId],
    );
    return (res.rows[0] as { n: number }).n;
  }

  it("Audit-Fehler in der Löschtransaktion ⇒ Beitrag unverändert, Überschneidung offen, Konflikt nicht gelöst, kein Beleg", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const scharf = { an: false };
    const w = await welt(p, scharf);
    const { a, overlap, conflict } = await zweiMitBefunden(w);

    scharf.an = true;
    await expect(w.ko.delete(a.id, "admin", { hard: true })).rejects.toThrow(
      "Audit-Ablage nicht erreichbar",
    );

    // Der Beitrag steht unverändert da …
    const nachher = await w.koRepo.findById(a.id);
    expect(nachher).toBeDefined();
    expect(nachher?.version).toBe(1);
    // … und BEIDE Befunde sind weiter offen. Das ist der Kern: keine geschlossene Aussage über
    // einem Beitrag, der noch steht.
    expect((await w.overlapRepo.findById(overlap.id))?.status).toBe("offen");
    expect((await w.conflictRepo.findById(conflict.id))?.status).not.toBe("geloest");
    expect(await purgeBelege(p, a.id)).toBe(0);
  });

  it("Wiederholung nach dem Fehler läuft vollständig durch und erzeugt genau EINEN Beleg mit Umfang", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const scharf = { an: false };
    const w = await welt(p, scharf);
    const { a, overlap, conflict } = await zweiMitBefunden(w);

    scharf.an = true;
    await expect(w.ko.delete(a.id, "admin", { hard: true })).rejects.toThrow();
    scharf.an = false;

    await w.ko.delete(a.id, "admin", { hard: true });

    expect(await w.koRepo.findById(a.id)).toBeUndefined();
    expect((await w.overlapRepo.findById(overlap.id))?.status).toBe("geschlossen");
    expect((await w.conflictRepo.findById(conflict.id))?.status).toBe("geloest");
    expect(await purgeBelege(p, a.id)).toBe(1);
    const beleg = await p.query(
      "SELECT payload FROM audit WHERE action='ko.purged' AND target=$1",
      [a.id],
    );
    expect((beleg.rows[0] as { payload: Record<string, unknown> }).payload).toMatchObject({
      konflikteGeschlossen: 1,
      ueberschneidungenGeschlossen: 1,
    });
  });

  it("Vollzug ohne Fehler: Beitrag weg, beide Befunde geschlossen, EIN Beleg", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const w = await welt(p, { an: false });
    const { a, overlap, conflict } = await zweiMitBefunden(w);

    await w.ko.delete(a.id, "admin", { hard: true });

    expect(await w.koRepo.findById(a.id)).toBeUndefined();
    expect((await w.overlapRepo.findById(overlap.id))?.status).toBe("geschlossen");
    expect((await w.conflictRepo.findById(conflict.id))?.status).toBe("geloest");
    expect(await purgeBelege(p, a.id)).toBe(1);
  });
});
