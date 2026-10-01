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
} from "../../services/audit";
import {
  CONFLICTS_SCHEMA,
  ConflictService,
  OVERLAP_SCHEMA,
  type OverlapEntry,
  OverlapService,
  PgConflictRepo,
  PgOverlapRepo,
} from "../../services/conflicts";
import { type TxContext, guardedLocalPgTestUrl, withPgTx } from "../../services/db-tx";
import {
  KO_CREATE_OPERATION_SCHEMA,
  KO_IMPORT_ANCHOR_SCHEMA,
  KO_SCHEMA,
  KO_SICHTBARKEIT_SCHEMA,
  KoService,
  PgKoRepo,
} from "../../services/knowledge-object";
import { stelleTrigrammErweiterungSicher } from "../office-pg-abnahme/rueckweg-erwartung";

const EIGENES_SCHEMA = "dubl_rueckzug_atomar";

// ================================================================================================
// Auftrag gesamt-dubletten-rueckzug (R-1547) — RÜCKZUG UND WIEDERHERSTELLEN, GEGEN ECHTES POSTGRES.
// ================================================================================================
//
// Was nur hier beweisbar ist: dass Papierkorb-Schreiben, Schliessen des Befunds und ihre Belege
// (bzw. beim Wiederherstellen: Zurückholen und Beleg) wirklich auf DEMSELBEN PoolClient committen
// oder gemeinsam zurückrollen. Nach Pedis Entscheidung (entscheidung:43017d60) öffnet das
// Wiederherstellen KEINEN Befund wieder; die Fälle aus Lauf 1/2 stehen unten mit diesem Soll. Der Fall
// ist der, an dem JOB 3047 (archiv/3047/runde-4/ben.md) scheiterte: das Audit-Schreiben fällt NACH
// den fachlichen Schreibungen aus. Danach darf nichts halb geschehen sein — und ein zweiter Anlauf
// geht vollständig durch.
//
// Die Verdrahtung ist die der Kompositionswurzel (build-app.ts, `setRuecknahmeTxCleanup`).
// Gating wie services/conflicts/src/purge-atomar.integration.test.ts: lokale Instanz (gesichert)
// vor Testcontainers, sonst sauberer Skip.
describe("R-1547: Rückzug und Wiederherstellen committen/rollbacken gemeinsam (echtes Postgres)", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;

  beforeAll(async () => {
    let url: string | undefined;
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      url = localUrl;
    } else if (process.env.KLARWERK_PG_TEST_URL) {
      available = false;
      return;
    } else {
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
      } catch {
        available = false;
        return;
      }
    }
    // Lauf 2: EIGENE ECKE im geteilten Wegwerfcluster (Muster tests/ko/trash-tx-pg.integration.test.ts).
    // Der Prüfplatz führt alle Integrationsdateien parallel gegen EINE Instanz; purge-atomar droppt
    // `kos`/`ko_overlaps`/`audit` in `public`. Auf dem Prüfplatz riss das beide Dateien in `reset`
    // (`relation "kos" does not exist`, `pg_extension_name_index`) — ein Wettlauf, keine
    // Produktaussage. Eigenes Schema + `search_path`, die Trigramm-Erweiterung vorab gesichert.
    const verwaltung = new Pool({ connectionString: url });
    try {
      await verwaltung.query("SELECT 1");
      await stelleTrigrammErweiterungSicher(verwaltung);
      await verwaltung.query(`DROP SCHEMA IF EXISTS ${EIGENES_SCHEMA} CASCADE`);
      await verwaltung.query(`CREATE SCHEMA ${EIGENES_SCHEMA}`);
      pool = new Pool({
        connectionString: url,
        options: `-c search_path=${EIGENES_SCHEMA},public`,
      });
      available = true;
    } catch {
      process.stderr.write(
        "[KLARWERK] Pg-Integrationssuite ÜBERSPRUNGEN: keine Verbindung zur Testinstanz möglich.\n",
      );
      available = false;
    } finally {
      await verwaltung.end();
    }
  });

  afterAll(async () => {
    if (available && pool) {
      await pool.query(`DROP SCHEMA IF EXISTS ${EIGENES_SCHEMA} CASCADE`).catch(() => undefined);
    }
    await pool?.end();
    await container?.stop();
  });

  function requirePool(ctx: { skip: () => void }): Pool {
    if (!available || !pool) {
      ctx.skip();
      throw new Error("unreachable");
    }
    return pool;
  }

  // Scharfschaltbarer Ausfall GENAU EINES Belegs — des letzten Schritts im Transaktionskörper.
  function auditMitAusfall(inner: AuditRepo, scharf: { action: string | null }): AuditRepo {
    return {
      append: async (entry: AuditEntry, tx?: TxContext) => {
        if (scharf.action !== null && entry.action === scharf.action) {
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
    for (const tabelle of ["conflicts", "ko_overlaps", "kos", "ko_schreibstand", "audit"]) {
      // Schema-qualifiziert: ohne eigene Tabelle fände der `search_path` sonst die in `public`.
      await p.query(`DROP TABLE IF EXISTS ${EIGENES_SCHEMA}.${tabelle} CASCADE`);
    }
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

  // Zwei Haltepunkte für die Nebenläufigkeitsfälle. `nachBegin` hält eine Transaktion direkt nach
  // BEGIN an (vor jedem Schreiben), `vorSchliessen` hält den Rückzug im Transaktionskörper direkt
  // vor `closeOpenForKo` an.
  function haltepunkte() {
    const nachBegin: Promise<void>[] = [];
    const vorSchliessen: Promise<void>[] = [];
    const anhalten = (liste: Promise<void>[]): (() => void) => {
      let freigeben: () => void = () => undefined;
      liste.push(
        new Promise<void>((fertig) => {
          freigeben = fertig;
        }),
      );
      return () => freigeben();
    };
    return {
      nachBegin,
      vorSchliessen,
      naechsteTxAnhalten: () => anhalten(nachBegin),
      naechstesSchliessenAnhalten: () => anhalten(vorSchliessen),
    };
  }

  async function welt(p: Pool, scharf: { action: string | null }) {
    const halt = haltepunkte();
    const koRepo = new PgKoRepo(p);
    const audit = new AuditService({ repo: auditMitAusfall(new PgAuditRepo(p), scharf) });
    const conflictRepo = new PgConflictRepo(p);
    const overlapRepo = new PgOverlapRepo(p);
    const echtesSchliessen = overlapRepo.closeOpenForKo.bind(overlapRepo);
    overlapRepo.closeOpenForKo = async (koId, patch, tx) => {
      const sperre = halt.vorSchliessen.shift();
      if (sperre) {
        await sperre;
      }
      return echtesSchliessen(koId, patch, tx);
    };
    const conflicts = new ConflictService({ repo: conflictRepo, audit });
    const overlaps = new OverlapService({ repo: overlapRepo, audit });
    const ko = new KoService({
      repo: koRepo,
      audit,
      withTx: (fn) =>
        withPgTx(p, async (tx) => {
          const sperre = halt.nachBegin.shift();
          if (sperre) {
            await sperre;
          }
          return fn(tx);
        }),
    });
    // Dieselbe Verdrahtung wie build-app.ts (`setPurgeTxCleanup`, `setRuecknahmeTxCleanup`). Das
    // Wiederherstellen ruft keinen Haken (Entscheidung 43017d60).
    ko.setPurgeTxCleanup(async (koId, actor, tx, ruecknahme) => ({
      konflikteGeschlossen: await conflicts.onKoRemoved(koId, actor, tx),
      ueberschneidungenGeschlossen: await overlaps.onKoRemoved(koId, actor, tx, ruecknahme),
    }));
    ko.setRuecknahmeTxCleanup(async (koId, actor, tx, ruecknahme) => ({
      konflikteGeschlossen: await conflicts.onKoRemoved(koId, actor, tx),
      ueberschneidungenGeschlossen: await overlaps.onKoRemoved(koId, actor, tx, ruecknahme),
    }));
    const a = await ko.create({
      title: "KO A",
      statement: "Pumpe entlüften alle 200h.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
    });
    const b = await ko.create({
      title: "KO B",
      statement: "Pumpe alle 200 Stunden entlüften.",
      type: "best_practice",
      category: "Wartung",
      author: "bob",
    });
    const overlap = await overlaps.createAuto(
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
    return { ko, koRepo, overlapRepo, a, b, overlap, halt };
  }

  async function belege(p: Pool, action: string, target: string): Promise<number> {
    const res = await p.query(
      "SELECT count(*)::int AS n FROM audit WHERE action=$1 AND target=$2",
      [action, target],
    );
    return (res.rows[0] as { n: number }).n;
  }

  it("Audit-Ausfall beim Rückzug ⇒ Beitrag nicht im Papierkorb, Befund offen, kein Beleg; Wiederholung vollständig", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const scharf: { action: string | null } = { action: null };
    const w = await welt(p, scharf);

    scharf.action = "ko.deleted";
    await expect(w.ko.delete(w.a.id, "anna")).rejects.toThrow("Audit-Ablage nicht erreichbar");
    expect((await w.koRepo.findById(w.a.id))?.deletedAt).toBeUndefined();
    expect((await w.overlapRepo.findById(w.overlap.id))?.status).toBe("offen");
    expect(await belege(p, "overlap.withdrawn-own", w.overlap.id)).toBe(0);
    expect(await belege(p, "ko.deleted", w.a.id)).toBe(0);

    scharf.action = null;
    await w.ko.delete(w.a.id, "anna");
    expect((await w.koRepo.findById(w.a.id))?.deletedBy).toBe("anna");
    expect((await w.overlapRepo.findById(w.overlap.id))?.resolution).toMatchObject({
      reason: "withdrawn_own",
      by: "anna",
    });
    expect(await belege(p, "overlap.withdrawn-own", w.overlap.id)).toBe(1);
    expect(await belege(p, "ko.deleted", w.a.id)).toBe(1);
  });

  // Die gemeinsame Zusage nach Entscheidung 43017d60: der Befund steht zeichengleich da, kein
  // Umkehrbeleg — das Wiederherstellen hat den Überschneidungsspeicher nicht angefasst.
  async function bleibtZu(
    p: Pool,
    overlapRepo: PgOverlapRepo,
    id: string,
    zu: OverlapEntry | undefined,
  ): Promise<void> {
    expect(zu?.status).toBe("geschlossen");
    expect(await overlapRepo.findById(id)).toEqual(zu);
    expect(await belege(p, "overlap.withdrawal-reverted", id)).toBe(0);
  }

  it("Audit-Ausfall beim Wiederherstellen ⇒ Beitrag bleibt im Papierkorb; Wiederholung holt ihn, Befund bleibt zu", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const scharf: { action: string | null } = { action: null };
    const w = await welt(p, scharf);
    await w.ko.delete(w.a.id, "anna");
    const zu = await w.overlapRepo.findById(w.overlap.id);

    scharf.action = "ko.restored";
    await expect(w.ko.restore(w.a.id, "admin")).rejects.toThrow("Audit-Ablage nicht erreichbar");
    expect((await w.koRepo.findById(w.a.id))?.deletedAt).toBeDefined();
    expect(await belege(p, "ko.restored", w.a.id)).toBe(0);
    await bleibtZu(p, w.overlapRepo, w.overlap.id, zu);

    scharf.action = null;
    await w.ko.restore(w.a.id, "admin");
    expect((await w.koRepo.findById(w.a.id))?.deletedAt).toBeUndefined();
    expect(await belege(p, "ko.restored", w.a.id)).toBe(1);
    await bleibtZu(p, w.overlapRepo, w.overlap.id, zu);
    // Die Gegenseite: unberührt, weder gelöscht noch wiederhergestellt.
    expect((await w.koRepo.findById(w.b.id))?.deletedAt).toBeUndefined();
    expect(await belege(p, "ko.deleted", w.b.id)).toBe(0);
    expect(await belege(p, "ko.restored", w.b.id)).toBe(0);
  });

  const takt = (ms = 300) => new Promise((r) => setTimeout(r, ms));

  // ==============================================================================================
  // Die in Lauf 1/2 reproduzierten Wiederherstellungsfehler — unter echten Zeilensperren und
  // getrennten Verbindungen, mit dem Soll aus Entscheidung 43017d60.
  // ==============================================================================================

  it("L1-R1-1: B wird zurückgezogen, während die Wiederherstellung von A offen ist ⇒ A zurück, Befund zu", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const w = await welt(p, { action: null });
    await w.ko.delete(w.a.id, "anna");
    const zu = await w.overlapRepo.findById(w.overlap.id);

    const freigeben = w.halt.naechsteTxAnhalten();
    const wiederherstellungA = w.ko.restore(w.a.id, "admin"); // BEGIN, dann angehalten
    await takt();
    await w.ko.delete(w.b.id, "bob"); // läuft vollständig durch und committet
    freigeben();
    await wiederherstellungA;

    expect((await w.koRepo.findById(w.a.id))?.deletedAt).toBeUndefined();
    expect((await w.koRepo.findById(w.b.id))?.deletedAt).toBeDefined();
    await bleibtZu(p, w.overlapRepo, w.overlap.id, zu);
  });

  it("L1-R1-2: zwei Wiederherstellungen gleichzeitig ⇒ beide Beiträge zurück, Befund zu", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const w = await welt(p, { action: null });
    await w.ko.delete(w.a.id, "anna");
    await w.ko.delete(w.b.id, "bob");
    const zu = await w.overlapRepo.findById(w.overlap.id);

    const freigebenA = w.halt.naechsteTxAnhalten();
    const freigebenB = w.halt.naechsteTxAnhalten();
    const beide = Promise.all([w.ko.restore(w.a.id, "admin"), w.ko.restore(w.b.id, "admin")]);
    await takt();
    freigebenA();
    freigebenB();
    await beide;

    expect((await w.koRepo.findById(w.a.id))?.deletedAt).toBeUndefined();
    expect((await w.koRepo.findById(w.b.id))?.deletedAt).toBeUndefined();
    expect(await belege(p, "ko.restored", w.a.id)).toBe(1);
    expect(await belege(p, "ko.restored", w.b.id)).toBe(1);
    await bleibtZu(p, w.overlapRepo, w.overlap.id, zu);
  });

  it("L1-R3-1: zwei Rückzüge beginnen am offenen Befund ⇒ ein Abschluss; Wiederherstellen öffnet nicht", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const w = await welt(p, { action: null });

    // B hält im Körper vor seinem Schliessen.
    const freigeben = w.halt.naechstesSchliessenAnhalten();
    const rueckzugB = w.ko.delete(w.b.id, "bob");
    await takt();
    await w.ko.delete(w.a.id, "anna"); // schliesst den Befund und committet
    freigeben();
    await rueckzugB; // Schliessen findet die Zeile geschlossen und überspringt sie

    const zu = await w.overlapRepo.findById(w.overlap.id);
    expect(zu?.resolution).toMatchObject({ reason: "withdrawn_own", by: "anna" });
    expect(await belege(p, "overlap.withdrawn-own", w.overlap.id)).toBe(1);

    await w.ko.restore(w.a.id, "admin");
    expect((await w.koRepo.findById(w.b.id))?.deletedAt).toBeDefined();
    await bleibtZu(p, w.overlapRepo, w.overlap.id, zu);
  });

  // Altbestand herstellen: Beitrag im Papierkorb, Befund vor dieser Lieferung geschlossen.
  async function altImPapierkorb(p: Pool, id: string, wer: string): Promise<void> {
    await p.query(
      `UPDATE kos SET data = data || jsonb_build_object('deletedAt', now()::text, 'deletedBy', $2::text)
        WHERE id = $1`,
      [id, wer],
    );
  }
  async function altGeschlossen(p: Pool, overlapId: string): Promise<void> {
    await p.query(
      `UPDATE ko_overlaps
          SET data = data || jsonb_build_object(
                'status', 'geschlossen',
                'closedAt', data->>'createdAt',
                'resolution', jsonb_build_object('reason', 'withdrawn_own', 'by', 'anna',
                                                 'note', null, 'at', data->>'createdAt'))
        WHERE id = $1`,
      [overlapId],
    );
  }

  it("L1-R3-2: Altbefund, beide Seiten im Papierkorb, zwei gleichzeitige Wiederherstellungen ⇒ Befund zu", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const w = await welt(p, { action: null });
    await altImPapierkorb(p, w.a.id, "anna");
    await altImPapierkorb(p, w.b.id, "bob");
    await altGeschlossen(p, w.overlap.id);
    const zu = await w.overlapRepo.findById(w.overlap.id);

    const freigebenA = w.halt.naechsteTxAnhalten();
    const freigebenB = w.halt.naechsteTxAnhalten();
    const beide = Promise.all([w.ko.restore(w.a.id, "admin"), w.ko.restore(w.b.id, "admin")]);
    await takt();
    freigebenA();
    freigebenB();
    await beide;

    expect((await w.koRepo.findById(w.a.id))?.deletedAt).toBeUndefined();
    expect((await w.koRepo.findById(w.b.id))?.deletedAt).toBeUndefined();
    await bleibtZu(p, w.overlapRepo, w.overlap.id, zu);
  });

  it("L1-R3-3: Gegenseite direkt endgelöscht ⇒ A zurück, Befund zu", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const w = await welt(p, { action: null });
    await w.ko.delete(w.a.id, "anna");
    const zu = await w.overlapRepo.findById(w.overlap.id);
    await w.ko.delete(w.b.id, "admin", { hard: true });
    expect(await w.koRepo.findById(w.b.id)).toBeUndefined();

    await w.ko.restore(w.a.id, "admin");

    expect((await w.koRepo.findById(w.a.id))?.deletedAt).toBeUndefined();
    await bleibtZu(p, w.overlapRepo, w.overlap.id, zu);
  });

  it("L2: Altbefund (A im Papierkorb) · B zurückziehen · B wiederherstellen ⇒ A bleibt weg, Befund zu", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const w = await welt(p, { action: null });
    await altImPapierkorb(p, w.a.id, "anna");
    await altGeschlossen(p, w.overlap.id);
    const zu = await w.overlapRepo.findById(w.overlap.id);

    await w.ko.delete(w.b.id, "bob");
    await w.ko.restore(w.b.id, "admin");

    expect((await w.koRepo.findById(w.a.id))?.deletedAt).toBeDefined();
    expect((await w.koRepo.findById(w.b.id))?.deletedAt).toBeUndefined();
    await bleibtZu(p, w.overlapRepo, w.overlap.id, zu);
  });
});
