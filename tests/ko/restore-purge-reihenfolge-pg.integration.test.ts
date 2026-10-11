// Aufnahme gesamt-papierkorb (Bens Befund, Nacharbeit 2): Wiederherstellen gegen Endlöschung GEGEN
// ECHTES POSTGRESQL — beide kontrollierten Reihenfolgen, der Fristlauf gegen Wiederherstellen und
// erneutes Löschen, und die sofortige Demo-Endlöschung (Fälle in `restore-purge-faelle.ts`).
//
// Die Entscheidung fällt in `PgKoRepo.delete` (Papierkorbstatus und gelesene rowVersion im selben
// DELETE) bzw. im CAS von `PgKoRepo.update`; `withPgTx` rollt bei verlorener Entscheidung
// Aufräumbeitrag und Beleg zurück. Prüfplatz wie `trash-tx-pg.integration.test.ts`: eigene
// Datenbank, sonst Testcontainer, sonst ROT — kein stiller Skip.
import type { Pool } from "pg";
import { afterAll, beforeAll, describe } from "vitest";
import { createPool, migrate } from "../../services/app";
import { AuditService, PgAuditRepo } from "../../services/audit";
import { withPgTx } from "../../services/db-tx";
import {
  KoService,
  PgKoRepo,
  TRASH_RETENTION_DAYS,
  type WithTx,
} from "../../services/knowledge-object";
import { type IsoliertePg, oeffneIsoliertePg } from "./pg-pruefplatz";
import { gesteuert, restorePurgeFaelle } from "./restore-purge-faelle";

describe("gesamt-papierkorb · Wiederherstellen gegen Endlöschung (echtes PostgreSQL)", () => {
  let pg: IsoliertePg | undefined;
  let pool: Pool | undefined;

  beforeAll(async () => {
    pg = await oeffneIsoliertePg("restorepurge");
    pool = createPool(pg.url);
    await migrate(pool);
  }, 180_000);

  afterAll(async () => {
    await pool?.end();
    await pg?.abraeumen();
  });

  restorePurgeFaelle(async () => {
    if (!pool) {
      throw new Error("beforeAll hat keinen Pool hinterlassen — der Lauf hat nichts gemessen.");
    }
    const p = pool;
    const { repo, halt } = gesteuert(new PgKoRepo(p));
    const auditRepo = new PgAuditRepo(p);
    const uhr = { jetzt: Date.parse("2026-09-12T07:00:00.000Z") };
    const withTx: WithTx = (fn) => withPgTx(p, fn);
    const service = new KoService({
      repo,
      audit: new AuditService({ repo: auditRepo }),
      withTx,
      now: () => uhr.jetzt,
    });
    return { service, repo, halt, belege: () => auditRepo.all(), uhr };
  }, TRASH_RETENTION_DAYS);
});
