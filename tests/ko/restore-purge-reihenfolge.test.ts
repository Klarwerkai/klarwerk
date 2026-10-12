// Aufnahme gesamt-papierkorb (Bens Befund, Nacharbeit 2): Wiederherstellen gegen Endlöschung im
// SPEICHER — dieselben Fälle wie gegen PostgreSQL (`restore-purge-faelle.ts`).
//
// Die Klammer hier ist eine Durchreichung ohne Rückrollung: sie wählt den Transaktionsweg von
// `purgeKo`, in dem die Endlöschung VOR ihrem Beleg steht. Die Atomarität selbst belegt nur der
// PostgreSQL-Lauf; der Speicher belegt die Entscheidung an `InMemoryKoRepo.delete`/`update`.
import { describe } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import type { TxContext } from "../../services/db-tx";
import {
  InMemoryKoRepo,
  KoService,
  TRASH_RETENTION_DAYS,
  type WithTx,
} from "../../services/knowledge-object";
import { gesteuert, restorePurgeFaelle } from "./restore-purge-faelle";

describe("gesamt-papierkorb · Wiederherstellen gegen Endlöschung (Speicher)", () => {
  restorePurgeFaelle(async () => {
    const { repo, halt } = gesteuert(new InMemoryKoRepo());
    const auditRepo = new InMemoryAuditRepo();
    const uhr = { jetzt: Date.parse("2026-09-12T07:00:00.000Z") };
    const withTx: WithTx = (fn) => fn({ brand: "TxContext" } as TxContext);
    const service = new KoService({
      repo,
      audit: new AuditService({ repo: auditRepo }),
      withTx,
      now: () => uhr.jetzt,
    });
    return { service, repo, halt, belege: () => auditRepo.all(), uhr };
  }, TRASH_RETENTION_DAYS);
});
