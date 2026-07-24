import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AUDIT_EVENT_ID_SCHEMA, AUDIT_SCHEMA, AuditService, PgAuditRepo } from "../../audit";
import { guardedLocalPgTestUrl, withPgTx } from "../../db-tx";
import { KO_SCHEMA, KoService, PgKoRepo } from "../../knowledge-object";
import { Reasoner } from "../../reasoner";
import { signAnswerReceipt } from "./receipt";
import { InMemoryGapRepo } from "./repo";
import { AskService } from "./service";

// FUNKE-FIX2 P0 (bens ROT-1, Blocker 1): echter Postgres-Beleg für die ATOMARE Kopplung des „Danke".
// Anders als der frühere Test (der das KO in-memory hielt) laufen hier PgAuditRepo UND PgKoRepo GEMEINSAM
// gegen dieselbe DB, und der gekoppelte Schreibblock (recordOnce-CAS + Trust-Inkrement) läuft in EINER
// echten withPgTx-Transaktion. Belegt:
//   1) zwei gleichzeitige Danke DESSELBEN Nutzers → genau EIN Audit, genau EIN Trust-Schritt (+2),
//   2) zwei gleichzeitige Danke VERSCHIEDENER Nutzer aufs selbe KO → zwei Trust-Schritte (kein
//      Lost-Update — atomarer LEAST-Inkrement, nicht Read-modify-write eines Absolutwerts),
//   3) Fehler NACH gewonnenem Event-CAS → Rollback (kein „Beleg ohne Trust"), Retry zieht sauber nach.
// Muster/Gating wie die Audit-Suite: braucht Docker (Testcontainers) bzw. eine per GELB-Sicherung
// freigegebene lokale Instanz (KLARWERK_PG_TEST_URL); ohne Infrastruktur sauberer Skip statt gefälschtem
// Grün.

// Fester Secret-/Zeitwert → deterministischer, verifizierbarer Answer-Receipt im Test.
const TEST_SECRET = Buffer.from("funke-fix-p0-integration-secret-32b", "utf8");
const NOW = Date.parse("2026-07-24T12:00:00.000Z");

describe("FUNKE-FIX2 P0 (bens ROT-1): Danke atomar gegen echtes Postgres (Audit + KO gemeinsam)", () => {
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
          "[KLARWERK] Ask-Pg-Integrationssuite ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
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
      throw new Error("unreachable");
    }
    return pool;
  }

  // Frische Audit- UND KO-Tabelle; beide Repos teilen den EINEN Pool. Der gekoppelte Danke-Schreibblock
  // läuft über withPgTx(pool, …) — Audit-CAS und Trust-Inkrement auf demselben Client.
  async function makeAsk(pool: Pool): Promise<{ ask: AskService; koService: KoService }> {
    await pool.query("DROP TABLE IF EXISTS audit CASCADE");
    await pool.query("DROP TABLE IF EXISTS kos CASCADE");
    await pool.query(AUDIT_SCHEMA);
    await pool.query(AUDIT_EVENT_ID_SCHEMA);
    await pool.query(KO_SCHEMA);
    const audit = new AuditService({ repo: new PgAuditRepo(pool), now: () => NOW });
    const koService = new KoService({ repo: new PgKoRepo(pool), now: () => NOW });
    const ask = new AskService({
      reasoner: new Reasoner(),
      koService,
      gaps: new InMemoryGapRepo(),
      audit,
      now: () => NOW,
      receiptSecret: TEST_SECRET,
      withTx: (fn) => withPgTx(pool, fn),
    });
    return { ask, koService };
  }

  async function auditCount(pool: Pool, koId: string): Promise<number> {
    const rows = await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit WHERE action='answer.helpful' AND target=$1",
      [koId],
    );
    return rows.rows[0]?.n ?? 0;
  }

  it("zwei PARALLELE Danke DESSELBEN Nutzers → genau EIN Audit, genau EIN Trust-Schritt (+2)", async (ctx) => {
    const pool = requirePool(ctx);
    const { ask, koService } = await makeAsk(pool);
    const ko = await koService.create({
      title: "Pumpe entlüften",
      statement: "Vor dem Start entlüften.",
      type: "best_practice",
      category: "Pumpen",
      author: "anna",
    });
    const before = ko.trust;
    const receipt = signAnswerReceipt(TEST_SECRET, "vera", [ko.id], NOW);

    await Promise.all([
      ask.markHelpful(receipt, ko.id, "vera"),
      ask.markHelpful(receipt, ko.id, "vera"),
    ]);

    expect(await auditCount(pool, ko.id)).toBe(1);
    const after = await koService.get(ko.id);
    expect(after?.trust).toBe(Math.min(99, before + 2));
    expect(await new AuditService({ repo: new PgAuditRepo(pool) }).verify()).toBe(true);
  });

  it("zwei PARALLELE Danke VERSCHIEDENER Nutzer aufs selbe KO → zwei Trust-Schritte (kein Lost-Update)", async (ctx) => {
    const pool = requirePool(ctx);
    const { ask, koService } = await makeAsk(pool);
    const ko = await koService.create({
      title: "Ventil justieren",
      statement: "Nach Wartung justieren.",
      type: "best_practice",
      category: "Ventile",
      author: "anna",
    });
    const before = ko.trust;
    const veraReceipt = signAnswerReceipt(TEST_SECRET, "vera", [ko.id], NOW);
    const tomReceipt = signAnswerReceipt(TEST_SECRET, "tom", [ko.id], NOW);

    // Beide feuern parallel gegen denselben (leeren) Ausgangsstand — der atomare Inkrement (LEAST)
    // zählt BEIDE, nicht ein vorab gelesener Absolutwert (der einen Schritt verschluckt hätte).
    await Promise.all([
      ask.markHelpful(veraReceipt, ko.id, "vera"),
      ask.markHelpful(tomReceipt, ko.id, "tom"),
    ]);

    expect(await auditCount(pool, ko.id)).toBe(2);
    const after = await koService.get(ko.id);
    expect(after?.trust).toBe(Math.min(99, before + 4)); // ZWEI Schritte (+2 je Nutzer)
    expect(await new AuditService({ repo: new PgAuditRepo(pool) }).verify()).toBe(true);
  });

  it("Fehler NACH gewonnenem Event-CAS → Rollback (kein Beleg ohne Trust), Retry zieht sauber nach", async (ctx) => {
    const pool = requirePool(ctx);
    const { ask, koService } = await makeAsk(pool);
    const ko = await koService.create({
      title: "Presse P2 entlüften",
      statement: "Vor dem Start entlüften.",
      type: "best_practice",
      category: "Pressen",
      author: "anna",
    });
    const before = ko.trust;
    const receipt = signAnswerReceipt(TEST_SECRET, "vera", [ko.id], NOW);

    // Trust-Schritt schlägt EINMAL fehl (nach gewonnenem recordOnce). withPgTx muss den Audit-Beleg
    // mitzurückrollen — sonst bliebe „Beleg ja, Trust nie" und jeder Retry wäre No-op.
    const spy = vi
      .spyOn(koService, "bumpTrust")
      .mockRejectedValueOnce(new Error("boom (Trust-Schritt)"));

    await expect(ask.markHelpful(receipt, ko.id, "vera")).rejects.toThrow(/boom/);
    // Rollback: KEIN Audit, KEIN Trust-Schritt (halber Zustand ausgeschlossen).
    expect(await auditCount(pool, ko.id)).toBe(0);
    expect((await koService.get(ko.id))?.trust).toBe(before);
    expect(spy).toHaveBeenCalledTimes(1);

    // Retry mit intaktem Trust-Schritt zieht sauber nach: genau EIN Audit, genau EIN Trust-Schritt.
    spy.mockRestore();
    await ask.markHelpful(receipt, ko.id, "vera");
    expect(await auditCount(pool, ko.id)).toBe(1);
    expect((await koService.get(ko.id))?.trust).toBe(Math.min(99, before + 2));
    expect(await new AuditService({ repo: new PgAuditRepo(pool) }).verify()).toBe(true);
  });

  it("zweiter Klick (nach erstem) ist idempotent; unbelegte KO-ID → FORBIDDEN", async (ctx) => {
    const pool = requirePool(ctx);
    const { ask, koService } = await makeAsk(pool);
    const ko = await koService.create({
      title: "Presse P3 entlüften",
      statement: "Vor dem Start entlüften.",
      type: "best_practice",
      category: "Pressen",
      author: "anna",
    });
    const receipt = signAnswerReceipt(TEST_SECRET, "vera", [ko.id], NOW);
    await ask.markHelpful(receipt, ko.id, "vera");
    await ask.markHelpful(receipt, ko.id, "vera"); // idempotenter No-op
    expect(await auditCount(pool, ko.id)).toBe(1);
    // Ein gültiger Beleg für ein NICHT ausgeliefertes KO autorisiert nicht.
    await expect(ask.markHelpful(receipt, "fremdes-ko", "vera")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
});
