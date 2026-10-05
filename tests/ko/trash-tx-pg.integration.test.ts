import type { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app";
import { AuditService, PgAuditRepo } from "../../services/audit";
import { withPgTx } from "../../services/db-tx";
import {
  type KnowledgeObject,
  type KoError,
  KoService,
  PgKoRepo,
} from "../../services/knowledge-object";
import { type IsoliertePg, oeffneIsoliertePg } from "./pg-pruefplatz";

// SCRUM-523 P.3 (WP-A2): beweist die repo.delete+audit.record-Atomaritäts-Invariante GEGEN ECHTES
// Postgres. Die Unit-Tests in tests/ko/trash-e2e.test.ts bilden withPgTx nur über eine
// In-Memory-Fake-Transaktion nach (Commit/Rollback per Puffer-Array) — das beweist die INTENTION der
// Verdrahtung, aber nicht, dass eine ECHTE Pg-Transaktionsgrenze (BEGIN…COMMIT/ROLLBACK, Sichtbarkeit für
// andere Verbindungen erst nach COMMIT, echter Constraint-Fehler statt simuliertem throw) tatsächlich
// hält. Dieser Test hier schließt genau diese Lücke.
// Lauf: `npm run test:integration`. Aus dem schnellen Gate ausgeschlossen (s. vitest.integration.config.ts,
// Include-Pattern "*.integration.test.ts").
//
// ================================================================================================
// DER PRÜFPLATZ: EINE EIGENE DATENBANK — UND KEIN SKIP MEHR.
// ================================================================================================
//
// JOB 4321 hatte den `KLARWERK_PG_TEST_URL`-Weg eingeführt, aber einen sichtbaren Skip erlaubt,
// wenn keine Datenbank erreichbar war, und die Alleinlage über ein eigenes Schema hergestellt. Seit
// `./pg-pruefplatz` teilen sich die drei KO-Suiten EINEN Weg: eine frische, eigene Datenbank auf
// dem Cluster aus `KLARWERK_PG_TEST_URL`, sonst ein Testcontainer, sonst ROT. Die eigene Datenbank
// ersetzt das Schema — `audit` und `kos` gehören ihr allein, auch wenn
// `services/audit/src/repo-pg.integration.test.ts` nebenher `audit` in `public` droppt. Ein Lauf
// ohne Datenbank ist ein fehlender Nachweis und kein „skipped", das wie bestanden aussieht.

describe("SCRUM-523 P.3 (WP-A2): repo.delete + audit.record — echte Pg-Transaktion", () => {
  let pg: IsoliertePg | undefined;
  let pool: Pool | undefined;

  beforeAll(async () => {
    pg = await oeffneIsoliertePg("trashtx");
    pool = createPool(pg.url);
    await migrate(pool);
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await pg?.abraeumen();
  });

  function requirePool(): Pool {
    if (!pool) {
      throw new Error("beforeAll hat keinen Pool hinterlassen — der Lauf hat nichts gemessen.");
    }
    return pool;
  }

  // Der Zeuge: der Lauf nennt, WOGEGEN er gemessen hat, und der Datenraum steht wirklich.
  it("der Lauf bezeugt seine Datenbank — eine Quelle ohne migrierte Tabellen hätte nichts gemessen", async () => {
    expect(pg?.herkunft.trim().length ?? 0).toBeGreaterThan(0);
    await expect(
      requirePool().query("SELECT count(*)::int AS n FROM audit"),
    ).resolves.toBeDefined();
    const name = await requirePool().query<{ datenbank: string }>(
      "SELECT current_database() AS datenbank",
    );
    expect(name.rows[0]?.datenbank ?? "").toContain("test");
  });

  async function seedKo(koRepo: PgKoRepo, audit: AuditService): Promise<KnowledgeObject> {
    const service = new KoService({ repo: koRepo, audit });
    return service.create({
      title: "Tx-Integrationstest",
      statement: "beweist echte Postgres-Transaktionsgrenzen",
      type: "best_practice",
      category: "A",
      author: "erik",
    });
  }

  it("Erfolgsfall: delete + audit.record committen gemeinsam sichtbar", async () => {
    const pool = requirePool();
    const koRepo = new PgKoRepo(pool);
    const auditRepo = new PgAuditRepo(pool);
    const audit = new AuditService({ repo: auditRepo });
    const ko = await seedKo(koRepo, audit);

    await withPgTx(pool, async (tx) => {
      await koRepo.delete(ko.id, tx);
      await audit.record(
        { actor: "admin", action: "ko.purged", target: ko.id, payload: { reason: "hard" } },
        tx,
      );
    });

    expect(await koRepo.findById(ko.id)).toBeUndefined();
    const entries = (await auditRepo.all()).filter(
      (e) => e.action === "ko.purged" && e.target === ko.id,
    );
    expect(entries).toHaveLength(1);
  });

  it("(a) scheitert die Transaktion NACH repo.delete + audit.record, VOR dem COMMIT: ECHTES ROLLBACK — KO bleibt, kein Audit-Eintrag", async () => {
    const pool = requirePool();
    const koRepo = new PgKoRepo(pool);
    const auditRepo = new PgAuditRepo(pool);
    const audit = new AuditService({ repo: auditRepo });
    const ko = await seedKo(koRepo, audit);

    await expect(
      withPgTx(pool, async (tx) => {
        // Beide Schreibungen laufen INNERHALB der noch offenen Transaktion (derselbe Pg-Client) —
        // der anschließende throw verhindert den COMMIT. Beweist: ein bereits AUSGEFÜHRTES Delete UND
        // ein bereits ausgeführter Audit-Insert werden gemeinsam zurückgerollt, sobald IRGENDETWAS in
        // derselben Transaktion danach scheitert (unabhängig vom Auslöser).
        await koRepo.delete(ko.id, tx);
        await audit.record({ actor: "admin", action: "ko.purged", target: ko.id, payload: {} }, tx);
        throw new Error("simulierter Absturz vor COMMIT");
      }),
    ).rejects.toThrow("simulierter Absturz vor COMMIT");

    expect(await koRepo.findById(ko.id)).toBeDefined();
    const entries = (await auditRepo.all()).filter(
      (e) => e.action === "ko.purged" && e.target === ko.id,
    );
    expect(entries).toHaveLength(0);
  });

  it("(b) scheitert audit.append INNERHALB der Transaktion an einem ECHTEN Pg-Constraint-Fehler: repo.delete bleibt unsichtbar (ROLLBACK) — genau die Richtung, die WP-A nicht bewies", async () => {
    const pool = requirePool();
    const koRepo = new PgKoRepo(pool);
    const auditRepo = new PgAuditRepo(pool);
    const audit = new AuditService({ repo: auditRepo });
    const ko = await seedKo(koRepo, audit);

    // seedKo hat bereits einen ko.created-Eintrag (seq=1) committet. Ein manueller INSERT mit
    // DEMSELBEN seq verletzt den Primärschlüssel — ein echter Datenbankfehler, kein simuliertes throw.
    const last = await auditRepo.last();
    const duplicateSeq = last?.seq ?? 1;

    await expect(
      withPgTx(pool, async (tx) => {
        await koRepo.delete(ko.id, tx);
        await auditRepo.append(
          {
            seq: duplicateSeq,
            at: new Date(0).toISOString(),
            actor: "admin",
            action: "ko.purged",
            target: ko.id,
            payload: {},
            prevHash: "x",
            hash: "y",
          },
          tx,
        );
      }),
    ).rejects.toThrow();

    // repo.delete lief im Code VOR dem gescheiterten audit.append, in DERSELBEN, noch offenen
    // Transaktion — Postgres rollt trotzdem BEIDE Schreibungen zurück. Das KO ist unverändert da.
    expect(await koRepo.findById(ko.id)).toBeDefined();
    const purged = (await auditRepo.all()).filter(
      (e) => e.action === "ko.purged" && e.target === ko.id,
    );
    expect(purged).toHaveLength(0);
  });

  // SCRUM-523 P.3 (WP-A3, externer Review "ben"): PgKoRepo.delete prüfte rowCount bislang NICHT — ein
  // wiederholter/konkurrierender Purge (0 gelöschte Zeilen) konnte trotzdem committen, WEIL delete()
  // stillschweigend erfolgreich zurückkehrte, obwohl es nichts gelöscht hat ("Audit ohne echtes
  // Delete"). Die beiden folgenden Tests beweisen GEGEN ECHTES Postgres, dass ein 0-Zeilen-Delete jetzt
  // NOT_FOUND wirft und (weil es INNERHALB derselben withPgTx-Klammer wie audit.record läuft) die ganze
  // Transaktion zurückrollt — es kann also kein zweiter/geisterhafter ko.purged-Beleg mehr entstehen.
  it("(d) wiederholter Purge desselben KO: zweiter Versuch scheitert kontrolliert (NOT_FOUND), kein zweiter ko.purged-Beleg", async () => {
    const pool = requirePool();
    const koRepo = new PgKoRepo(pool);
    const auditRepo = new PgAuditRepo(pool);
    const audit = new AuditService({ repo: auditRepo });
    const ko = await seedKo(koRepo, audit);

    // Erster Purge — gelingt, genau EIN Beleg.
    await withPgTx(pool, async (tx) => {
      await koRepo.delete(ko.id, tx);
      await audit.record({ actor: "admin", action: "ko.purged", target: ko.id, payload: {} }, tx);
    });
    expect(await koRepo.findById(ko.id)).toBeUndefined();
    expect(
      (await auditRepo.all()).filter((e) => e.action === "ko.purged" && e.target === ko.id),
    ).toHaveLength(1);

    // Zweiter Versuch auf DASSELBE (bereits gelöschte) KO — z. B. ein konkurrierender oder erneut
    // ausgelöster Purge-Chokepoint-Aufruf. Das DELETE trifft 0 Zeilen → PgKoRepo.delete wirft NOT_FOUND,
    // BEVOR audit.record überhaupt läuft (Reihenfolge im Chokepoint: delete zuerst, s. service.ts
    // purgeKo). Selbst wenn audit.record liefe, würde derselbe Rollback-Mechanismus greifen.
    await expect(
      withPgTx(pool, async (tx) => {
        await koRepo.delete(ko.id, tx);
        await audit.record({ actor: "admin", action: "ko.purged", target: ko.id, payload: {} }, tx);
      }),
    ).rejects.toMatchObject({ name: "KoError", code: "NOT_FOUND" } satisfies Partial<KoError>);

    // Kein zweiter Beleg — die zweite (Rollback-)Transaktion hat NICHTS committet.
    expect(await koRepo.findById(ko.id)).toBeUndefined();
    expect(
      (await auditRepo.all()).filter((e) => e.action === "ko.purged" && e.target === ko.id),
    ).toHaveLength(1);
  });

  it("(e) delete trifft 0 Zeilen (KO existiert nicht/nicht mehr): Transaktion rollt zurück, kein Audit-Eintrag entsteht", async () => {
    const pool = requirePool();
    const koRepo = new PgKoRepo(pool);
    const auditRepo = new PgAuditRepo(pool);
    const audit = new AuditService({ repo: auditRepo });

    // KEIN seedKo — die id existiert in `kos` nie. Bildet z. B. eine bereits abgeschlossene Endlöschung
    // (Sweep) nach, gegen die ein zweiter, zeitgleich gestarteter Aufrufer antritt.
    const ghostId = "ghost-nonexistent-ko";

    await expect(
      withPgTx(pool, async (tx) => {
        await koRepo.delete(ghostId, tx);
        await audit.record(
          { actor: "system", action: "ko.purged", target: ghostId, payload: {} },
          tx,
        );
      }),
    ).rejects.toMatchObject({ name: "KoError", code: "NOT_FOUND" } satisfies Partial<KoError>);

    expect(
      (await auditRepo.all()).filter((e) => e.action === "ko.purged" && e.target === ghostId),
    ).toHaveLength(0);
  });
});
