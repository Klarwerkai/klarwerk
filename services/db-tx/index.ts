// Öffentliche API des Moduls db-tx (SCRUM-523 P.3 WP-A2): gemeinsamer, storage-neutraler
// Transaktions-Kernel für Chokepoints, die über Modulgrenzen hinweg atomar committen/rollbacken
// müssen (z. B. knowledge-object.purgeKo: repo.delete + audit.record). Siehe src/tx.ts.
export { type TxContext, type Queryable, poolQueryable, pgQueryable, withPgTx } from "./src/tx";
// WP-SHIP8-CLOSE-6 (bens GELB): harte Freigabesicherung für destruktive Pg-Integrationssuiten —
// gemeinsam genutzt (knowledge-object- und audit-Suite), damit die Regel nirgends divergiert.
export { guardedLocalPgTestUrl } from "./src/pg-test-guard";
// JOB 596 (Ownerentscheidung „zentrale Sperrrichtung"): die EINE Kapselung, die den Bestandsreset
// gegen gleichzeitige Schreiber absichert, samt ihrem Sperrvertrag und dem Auditautomaten, der
// nach einem Absturz sagen kann, ob der Bestand noch steht. Nur die Kompositionswurzel bindet sie
// (s. services/app/src/build-app.ts) — kein Adapter kennt sie.
export { gatedPool } from "./src/gated-pool";
export {
  BestandsresetLaeuftError,
  SPERRSCHLUESSEL_BESTANDSRESET,
  SQL_SPERRE_EXKLUSIV,
  SQL_SPERRE_GETEILT,
  SQL_SPERRE_WIRD_GEHALTEN,
  sperreOderAbweisen,
} from "./src/reset-lock";
// D8: der aufrufbare Vorgang selbst (BEN D7, Auflage 4). Ohne ihn waren die drei Bausteine
// vorhanden und unbenutzbar — „der Baustein haengt in der Luft" war der Rotgrund davor.
export {
  BESTANDSRESET_LOESCHGRAPH,
  BestandsresetGesperrtError,
  fuehreBestandsresetAus,
} from "./src/bestandsreset";
// JOB 2363: I10 Punkt 2 — der Entscheidungshelfer nach einem Konsolenabbruch. Er gehoert hierher
// und nicht in ein Werkzeugskript, weil er dieselbe Frage beantwortet, die dieses Modul stellt:
// haelt gerade jemand eine Transaktion offen? Er oeffnet keine Verbindung und beendet nichts —
// er formuliert den Pruefbefehl und beurteilt sein Ergebnis (s. src/idle-in-transaction.ts).
export {
  type Abbruchbefund,
  type Handlung,
  type PgAktivitaetszeile,
  ZUSTAND_ARBEITET,
  ZUSTAND_HAENGT,
  beendigungsbefehl,
  bewerte,
  pruefbefehl,
} from "./src/idle-in-transaction";
export {
  type BestandsresetBefund,
  type BestandsresetLauf,
  type BestandsresetStatus,
  type BestandsresetZustand,
  SQL_ABSCHLUSS_SETZEN,
  SQL_COMMITMERKMAL_SETZEN,
  SQL_LAUF_ANLEGEN,
  SQL_LETZTER_LAUF,
  SQL_SCHEMA_BESTANDSRESET,
  bestandsresetBefund,
  letzterBestandsresetLauf,
  loeseBestandsresetAuf,
} from "./src/bestandsreset-audit";
