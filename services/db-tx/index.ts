// Öffentliche API des Moduls db-tx (SCRUM-523 P.3 WP-A2): gemeinsamer, storage-neutraler
// Transaktions-Kernel für Chokepoints, die über Modulgrenzen hinweg atomar committen/rollbacken
// müssen (z. B. knowledge-object.purgeKo: repo.delete + audit.record). Siehe src/tx.ts.
export { type TxContext, type Queryable, poolQueryable, pgQueryable, withPgTx } from "./src/tx";
// WP-SHIP8-CLOSE-6 (bens GELB): harte Freigabesicherung für destruktive Pg-Integrationssuiten —
// gemeinsam genutzt (knowledge-object- und audit-Suite), damit die Regel nirgends divergiert.
export { guardedLocalPgTestUrl } from "./src/pg-test-guard";
