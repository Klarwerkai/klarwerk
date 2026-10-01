// ================================================================================================
// GRAPH-BROWSER-RECHTE · DIE INTERNE FEHLERDIAGNOSE AM DATENBANKTREIBER — nur für Tests.
// ================================================================================================
//
// WOZU (Befund B3, Ben R2): ein `500 INTERNAL` sagt nichts über seine Ursache — `sendError`
// (`services/app/src/http.ts`) gibt für eine Schlüsselkollision, jede andere SQLSTATE und einen
// gewöhnlichen `Error` denselben Rumpf aus, und sein Auffangzweig schreibt keine Logzeile. Um einen
// 500 einer Ursache ZUZUORDNEN, braucht es eine Auskunft aus dem Inneren des Serverprozesses.
//
// WAS HIER GESCHIEHT: `pg.Client.prototype.query` wird umwickelt — jeder Pool-Weg (`pool.query`,
// `pool.connect()` + `client.query`, `withPgTx`) läuft darüber. Gemeldet werden:
//   · JEDE gescheiterte Anfrage: SQLSTATE (`code`), `constraint`, `table`, Meldung, SQL-Anfang;
//   · JEDES `INSERT INTO audit(...)`, erfolgreich oder nicht, mit `seq` (1. Wert), Handlung
//     (4. Wert) und — beim Exactly-once-Pfad `appendOnce` — der Ereigniskennung (`event_id`,
//     9. Wert, z. B. `ko.created:<id>`). Damit ist bei einer Kollision auch der ZWEITE Schreiber
//     benannt: der erfolgreiche Eintrag mit derselben `seq`.
//
// Die Anfragen selbst bleiben unverändert: dieselben Argumente, derselbe Rückgabewert, derselbe
// Fehler beim Aufrufer. Der Produktcode wird nicht berührt; geladen wird das nur über
// `pg-fehlerdiagnose-vorladen.ts` (Serverprozess) oder ausdrücklich im Test (`installiere`).
import { Client } from "pg";

export interface PgVorfall {
  /** Uhrzeit (ms) im meldenden Prozess. */
  t: number;
  ok: boolean;
  sql: string;
  code?: string;
  constraint?: string;
  table?: string;
  meldung?: string;
  /** Nur bei `INSERT INTO audit`: die berechnete Folgenummer. */
  seq?: number;
  /** Nur bei `INSERT INTO audit`: die Handlung, z. B. `ko.created`, `overlap.auto-created`. */
  handlung?: string;
  /** Nur bei `appendOnce`: die Ereigniskennung, z. B. `ko.created:<id>`. */
  eventId?: string;
}

const AUDIT_INSERT = /^\s*INSERT\s+INTO\s+audit\s*\(/i;

type Abfrage = (this: unknown, ...a: unknown[]) => unknown;

function sqlVon(cfg: unknown): string {
  if (typeof cfg === "string") {
    return cfg;
  }
  if (cfg && typeof cfg === "object" && typeof (cfg as { text?: unknown }).text === "string") {
    return (cfg as { text: string }).text;
  }
  return "";
}

/**
 * Umwickelt `pg.Client.prototype.query`; jeder Vorfall geht an `melde`. Gibt die Funktion zurück,
 * die den vorherigen Zustand wiederherstellt. Ein Fehler in `melde` erreicht den Aufrufer nie.
 */
export function installiere(melde: (v: PgVorfall) => void): () => void {
  const proto = Client.prototype as unknown as { query: Abfrage };
  const original = proto.query;
  proto.query = function (this: unknown, ...a: unknown[]): unknown {
    const sql = sqlVon(a[0]);
    if (sql === "") {
      // Einreichbare Objekte (Cursor, Stream) — unverändert durchreichen.
      return original.apply(this, a);
    }
    const werte: unknown[] = Array.isArray(a[1])
      ? a[1]
      : (((a[0] as { values?: unknown[] }).values ?? []) as unknown[]);
    const audit = AUDIT_INSERT.test(sql);
    const berichte = (fehler: unknown): void => {
      if (!fehler && !audit) {
        return;
      }
      try {
        const f = (fehler ?? {}) as {
          code?: unknown;
          constraint?: unknown;
          table?: unknown;
          message?: unknown;
        };
        const v: PgVorfall = {
          t: Date.now(),
          ok: !fehler,
          sql: sql.replace(/\s+/g, " ").trim().slice(0, 120),
        };
        if (fehler) {
          if (f.code !== undefined) v.code = String(f.code);
          if (f.constraint !== undefined) v.constraint = String(f.constraint);
          if (f.table !== undefined) v.table = String(f.table);
          v.meldung = String(f.message ?? fehler).slice(0, 300);
        }
        if (audit) {
          v.seq = Number(werte[0]);
          v.handlung = String(werte[3]);
          if (/event_id/i.test(sql) && werte[8] !== undefined && werte[8] !== null) {
            v.eventId = String(werte[8]);
          }
        }
        melde(v);
      } catch {
        // Die Diagnose darf nie selbst der Fehler sein.
      }
    };
    const letzte = a[a.length - 1];
    if (typeof letzte === "function") {
      const rueckruf = letzte as (this: unknown, fehler: unknown, erg: unknown) => unknown;
      const kopie = [...a];
      kopie[kopie.length - 1] = function (this: unknown, fehler: unknown, erg: unknown): unknown {
        berichte(fehler);
        return rueckruf.call(this, fehler, erg);
      };
      return original.apply(this, kopie);
    }
    const r = original.apply(this, a);
    if (r && typeof (r as Promise<unknown>).then === "function") {
      (r as Promise<unknown>).then(
        () => berichte(undefined),
        (fehler: unknown) => berichte(fehler ?? new Error("unbenannter Fehler")),
      );
    }
    return r;
  };
  return () => {
    proto.query = original;
  };
}
