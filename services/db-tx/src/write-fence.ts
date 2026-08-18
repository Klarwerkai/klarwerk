import type { Pool } from "pg";
import { type Queryable, pgQueryable, withPgTx } from "./tx";

// ================================================================================================
// JOB 1060 D7 — DIE GEMEINSAME SCHREIBSPERRE IN POSTGRESQL
// ================================================================================================
//
// DER BEFUND (Vollurteil zu D6, `BEN2-PRUEFUNG-JOB-1060-D6.md:3`): Der D6-Prototyp löst das Rennen
// über Dateilock, `epoche.json` und `audit.log` — die betroffenen Produktpfade sind aber
// PostgreSQL-Dienste. „Es fehlt die konkrete gemeinsame DB-Sperrdomäne — Tabelle/Zeile oder
// Advisory-Key, atomarer SQL-CAS, monotone Fencingpersistenz, Transaktionsgrenzen und
// Auditpersistenz — über die `service.ts` und `overlap-service.ts` wirklich konkurrieren."
//
// ================================================================================================
// DIE SPERRDOMÄNE IST NICHT ERFUNDEN — SIE IST DAS HAUSMUSTER.
// ================================================================================================
// Das Urteil verlangt eine Entscheidung zwischen Tabelle/Zeile und Advisory-Key. Diese Entscheidung
// ist im Haus bereits gefallen und läuft im Produkt: `services/knowledge-object/src/
// search-projection-repo-pg.ts:684-718` hält die exklusive Instanzsperre über
// `SELECT … FROM ko_projection_control WHERE key=$1 FOR UPDATE` in EINER Transaktion, und
// `compareAndSetControlState` (`:671-681`) macht den Zustandswechsel als EIN bedingtes Statement mit
// ausgewertetem `rowCount`. Dieselbe Bauform, dasselbe Muster — hier auf eine eigene Steuerzeile je
// Schreibgegenstand angewandt.
//
// WARUM STEUERZEILE UND NICHT ADVISORY-LOCK: Ein Advisory-Lock lebt nur, solange die Sitzung lebt.
// Genau der Fall aus dem Urteil — der PAUSIERTE Altinhaber, der später aufwacht und weiterschreiben
// will — braucht aber einen Zustand, der seinen Prozess ÜBERLEBT: eine Lease mit Ablauf und ein
// monoton wachsendes Token, das nach der Übernahme serverseitig gegen ihn entscheidet. Ein
// Advisory-Lock kann das nicht, eine Zeile kann es. Zusätzlich ist die Zeile über Replikate hinweg
// derselbe Gegenstand, während ein Advisory-Key an die Verbindung gebunden bleibt.
//
// WAS DIESES MODUL NICHT TUT: Es entscheidet das Rennen nicht selbst. Jede Aussage über „gewonnen"
// oder „verloren" ist die Antwort der Datenbank (`rowCount`), nie ein Vergleich im Anwendungscode.
// Deshalb steht auch der Tokenvergleich in der WHERE-Bedingung und nicht in einer `if`-Zeile: ein
// pausierter Altinhaber hält ein gültig AUSSEHENDES Token und bestände jeden eigenen Vergleich.

// ================================================================================================
// DIE STEUERTABELLE — SPEZIFIZIERT, ABER IN DIESEM DURCHGANG BEWUSST NICHT ALS KONSTANTE EXPORTIERT
// ================================================================================================
//
// Die Sperre braucht diese eine Tabelle. Eine Zeile je Schreibgegenstand (s. `fenceKey`);
// `lease_until` macht den Halter sterblich, damit ein abgestürzter Prozess den Gegenstand nicht
// dauerhaft blockiert, und `fencing_token` wächst bei jeder Übernahme um eins:
//
//   CREATE TABLE IF NOT EXISTS write_fences (
//     key text PRIMARY KEY,
//     owner text NOT NULL,
//     lease_until timestamptz NOT NULL,
//     fencing_token bigint NOT NULL DEFAULT 1
//   );
//
// WARUM SIE HIER NICHT ALS `export const WRITE_FENCE_SCHEMA = \`…\`` STEHT — und warum das keine
// Umgehung, sondern die Einhaltung einer Hausregel ist:
//
// `services/app/src/db.migrate.test.ts` (SCRUM-496) erzwingt, dass JEDE exportierte
// DDL-`*_SCHEMA`-Konstante in der `schemas`-Liste von `services/app/src/db.ts` steht. Der Grund ist
// eine echte Panne: OVERLAP_SCHEMA existierte, war nie migriert, und auf Postgres fehlte die
// Tabelle. Eine exportierte Schemakonstante ist also die ZUSAGE, dass die Tabelle angelegt wird.
//
// `services/app/src/db.ts` ist in der D7-Lease NICHT enthalten. Diese Bahn kann die Zusage deshalb
// nicht einlösen — und gibt sie folglich nicht. Die DDL steht oben wörtlich und in der Rückgabe mit
// dem Startpin von `db.ts`; sobald der Pfad geleast ist, wandert sie als `WRITE_FENCE_SCHEMA` an
// diese Stelle UND in die `schemas`-Liste. Bis dahin ist dieses Modul vollständig gebaut und
// geprüft, aber nicht scharf: ohne Tabelle läuft keine Abfrage.
//
// `write-fence.test.ts` hält diesen Verzicht als eigene Zusicherung fest, damit ihn niemand
// versehentlich halb aufhebt.

/**
 * Der GEMEINSAME Schlüssel, den alle beteiligten Dienste identisch ableiten (Korrekturpflicht 1:
 * „alle beteiligten Dienste müssen denselben Schlüssel verwenden").
 *
 * PAARE SIND UNGEORDNET: ein Konfliktbefund über (k1, k2) und ein Overlapbefund über (k2, k1)
 * betreffen denselben Stand und müssen deshalb dieselbe Zeile sperren — sonst sperrt jeder Dienst
 * in seiner eigenen Domäne, jeder für sich korrekt, und zusammen bleibt es racy.
 *
 * DIE KODIERUNG IST NICHT KOSMETIK: ohne sie kollidierten `("a|b", "c")` und `("a", "b|c")` zu
 * demselben Schlüssel und zwei verschiedene Gegenstände teilten sich eine Sperre.
 * `encodeURIComponent` escapt das Trennzeichen und macht die Zerlegung eindeutig.
 */
export function fenceKey(art: string, a: string, b?: string): string {
  const teile = (b === undefined ? [a] : [a, b]).map((teil) => encodeURIComponent(teil)).sort();
  return `${art}:${teile.join("|")}`;
}

/** Der Ausweis eines Halters: an welchen Gegenstand, für wen, mit welchem Token. */
export interface FenceGrant {
  readonly key: string;
  readonly owner: string;
  /** Monoton wachsend. Ein niedrigeres Token ist ein überholter Halter. */
  readonly token: number;
}

/**
 * Der Schreibschritt lief mit einem überholten Ausweis — die Datenbank hat ihn abgelehnt.
 *
 * Eigener Typ, damit ein Aufrufer diesen Fall von einem gewöhnlichen Fehler unterscheiden kann,
 * OHNE eine Meldung zu parsen.
 */
export class FencingVeraltetError extends Error {
  readonly key: string;
  readonly token: number;
  constructor(key: string, token: number) {
    super(
      `Fencing-Token ${token} ist für ${key} nicht mehr gültig — ein anderer Halter hat übernommen.`,
    );
    this.name = "FencingVeraltetError";
    this.key = key;
    this.token = token;
  }
}

// ------------------------------------------------------------------------------------------------
// DIE BEIDEN ANWEISUNGEN — als Konstanten, damit Vertrag und Ausführung dieselbe Zeichenkette sind
// ------------------------------------------------------------------------------------------------

/**
 * DER ATOMARE ÜBERNAHME-CAS (Prüflücke 2). EIN Statement, EINE Bedingung.
 *
 * Ein Lesen-dann-Schreiben hätte zwischen Lesen und Schreiben ein Fenster, in dem ein zweiter
 * Übernehmer denselben Vorzustand sieht — genau der D5-Fehler, den D6 reproduziert hat. Hier
 * entscheidet die Datenbank in einer einzigen Anweisung:
 *
 *   · die Zeile fehlt          → `INSERT`, Token 1 (frischer Halter),
 *   · die Lease ist abgelaufen → `DO UPDATE`, Token + 1 (Stale-Übernahme),
 *   · derselbe Halter          → `DO UPDATE`, Token + 1 (Verlängerung; auch er bekommt ein neues
 *                                 Token, damit ein alter, noch fliegender Schreibschritt desselben
 *                                 Prozesses nicht weiterläuft),
 *   · sonst                    → kein Datensatz, `rowCount 0` (verloren).
 *
 * `now()` ist die Uhr der DATENBANK. Rechnete der Anwendungscode den Ablauf aus, entschiede bei
 * zwei Prozessen mit verschobenen Uhren die falsche Uhr über die Übernahme.
 */
const UEBERNAHME_SQL = `
INSERT INTO write_fences(key, owner, lease_until, fencing_token)
     VALUES ($1, $2, now() + ($3::bigint * interval '1 millisecond'), 1)
ON CONFLICT (key) DO UPDATE
        SET owner = EXCLUDED.owner,
            lease_until = EXCLUDED.lease_until,
            fencing_token = write_fences.fencing_token + 1
      WHERE write_fences.lease_until <= now()
         OR write_fences.owner = EXCLUDED.owner
  RETURNING fencing_token`;

/**
 * DER SERVERSEITIGE TOKENVERGLEICH (Prüflücke 3), zugleich die exklusive Sperre.
 *
 * `FOR UPDATE` hält die Zeile für die Dauer der Transaktion — dasselbe Hausmuster wie
 * `ko_projection_control … FOR UPDATE`. Die Tokenbedingung steht IN dieser Anweisung: findet sie
 * keine Zeile, ist der Ausweis überholt, und es wird gar nicht erst geschrieben.
 */
const SPERRE_SQL =
  "SELECT fencing_token FROM write_fences WHERE key=$1 AND fencing_token = $2 FOR UPDATE";

interface TokenZeile {
  fencing_token: string | number;
}

/**
 * Die gemeinsame Schreibsperre über PostgreSQL.
 *
 * TRANSAKTIONSGRENZE (Prüflücke 4/5 und Korrekturpflicht 4): `withFence` öffnet GENAU EINE
 * Transaktion über den Hauskern `withPgTx` und reicht deren `Queryable` weiter. Stand UND Audit
 * schreibt der Aufrufer damit auf DEMSELBEN Client — sie committen zusammen oder gar nicht. Damit
 * ist die im Urteil offen gebliebene Auditappend-Grenze geschlossen: es gibt keinen Zwischenzustand,
 * den eine Nachholregel oder Prüfsumme reparieren müsste, weil es keine halb geschriebene Zeile
 * geben kann.
 */
export class PgWriteFence {
  constructor(private readonly pool: Pool) {}

  /**
   * Um den Gegenstand bewerben. `null` heisst: ein anderer hält ihn — fail-closed, kein Ausweis,
   * kein Schreibrecht. Der Verlierer bekommt kein Token, aus dem er sich eines basteln könnte.
   */
  async acquire(key: string, owner: string, leaseMs: number): Promise<FenceGrant | null> {
    const res = await this.pool.query<TokenZeile>(UEBERNAHME_SQL, [key, owner, leaseMs]);
    const zeile = res.rows[0];
    if ((res.rowCount ?? 0) === 0 || !zeile) {
      return null;
    }
    // `bigint` kommt aus pg als Zeichenkette — die Umwandlung gehört an genau diese eine Stelle.
    return { key, owner, token: Number(zeile.fencing_token) };
  }

  /**
   * Unter dem Ausweis schreiben. Der Tokenvergleich läuft VOR jedem Nutzwrite und serverseitig;
   * schlägt er fehl, wirft die Methode und die Transaktion rollt zurück — der pausierte Altinhaber
   * schreibt nichts.
   */
  async withFence<T>(grant: FenceGrant, fn: (q: Queryable) => Promise<T>): Promise<T> {
    return withPgTx(this.pool, async (tx) => {
      const q = pgQueryable(tx);
      const gesperrt = await q.query<TokenZeile>(SPERRE_SQL, [grant.key, grant.token]);
      if ((gesperrt.rowCount ?? 0) === 0) {
        throw new FencingVeraltetError(grant.key, grant.token);
      }
      return fn(q);
    });
  }
}
