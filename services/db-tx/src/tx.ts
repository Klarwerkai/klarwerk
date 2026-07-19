import type { Pool, PoolClient } from "pg";

// SCRUM-523 P.3 (WP-A2): gemeinsamer, storage-neutraler Transaktions-Kernel. Modul-Grund: repo.delete
// (knowledge-object) und audit.record (audit) müssen für den Purge-Chokepoint ATOMAR committen/
// rollbacken (externe Review-Auflage — ein sequentielles „Audit vor Delete" schließt nur EINE der
// beiden Richtungen des Lochs, s. Kommentar an KoService.purgeKo). Eine echte Transaktion braucht
// AUF BEIDEN SEITEN denselben PoolClient — das ist zwangsläufig Pg-Wissen. Damit weder knowledge-object
// noch audit einen Pg-Typ in ihrer öffentlichen, storage-agnostischen Schnittstelle (KoRepo, AuditRepo)
// führen müssen, kapselt DIESES eigene Modul das Pg-Wissen vollständig; beide Module importieren nur
// den opaken TxContext (+ die untenstehenden Helfer) über diese index.ts (Modulgrenzen-Regel).

// Opaker Transaktionskontext. Außerhalb dieses Moduls nur als Wert durchreichbar (import type), NICHT
// konstruierbar/auslesbar — nur withPgTx (unten) erzeugt ihn, nur pgQueryable (unten) löst ihn auf.
// InMemory-Implementierungen ignorieren ihn einfach (dort ist Atomarität trivial, kein I/O-Fenster).
export interface TxContext {
  readonly brand: "TxContext";
}

interface InternalTxContext extends TxContext {
  readonly client: PoolClient;
}

// Minimale, storage-neutrale Query-Fläche — der Ausschnitt von Pool/PoolClient, den die Pg-Repo-
// Adapter (PgKoRepo, PgAuditRepo, …) brauchen. Kein Modul außerhalb von db-tx muss "pg" importieren,
// um sie zu nutzen (structural, kein pg-Typname in fremden Signaturen).
//
// Bewusst OHNE "extends Record<string, unknown>": geschlossene Row-Interfaces der Aufrufer (z. B.
// AuditRow in services/audit) haben keine Index-Signatur und erfüllen eine solche Constraint
// strukturell NICHT (TS2344) — T bleibt hier frei, die Typsicherheit liegt beim Aufrufer, der sein
// eigenes Row-Interface kennt.
export interface Queryable {
  query<T = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

function toQueryable(target: Pool | PoolClient): Queryable {
  return {
    query: <T>(text: string, params?: readonly unknown[]) =>
      // pg selbst verlangt intern T extends QueryResultRow (Index-Signatur) — genau die Einschränkung,
      // die Queryable oben bewusst nicht hat. Der Cast betrifft NUR die Methodensignatur (kein `any` auf
      // T oder auf die Zeilen); zur Laufzeit ist pg ohnehin ungeprüft (rohe DB-Zeilen), Typsicherheit
      // bleibt beim Aufrufer über sein eigenes Row-Interface.
      (
        target.query as unknown as (
          text: string,
          params?: unknown[],
        ) => Promise<{ rows: T[]; rowCount: number | null }>
      )(text, params as unknown[] | undefined),
  };
}

// Für Pg-Repo-Adapter OHNE aktive Transaktion: normale Pool-Query (eigene Verbindung je Aufruf,
// heutiges Verhalten unverändert).
export function poolQueryable(pool: Pool): Queryable {
  return toQueryable(pool);
}

// Löst den Kontext in die Query-Fläche des EINEN Transaktions-Clients auf — für Pg-Repo-Adapter, die
// INNERHALB einer Transaktion auf demselben Client schreiben müssen wie der jeweils andere Aufrufer
// (genau der Zweck dieses Moduls). Die Laufzeitprüfung ist eine Verteidigungslinie: der Typ schließt
// einen fremden TxContext praktisch aus (nur withPgTx erzeugt ihn), aber ein `as`-Cast könnte ihn
// theoretisch umgehen.
export function pgQueryable(tx: TxContext): Queryable {
  const internal = tx as InternalTxContext;
  if (!internal.client) {
    throw new Error("Ungültiger TxContext (nicht von withPgTx erzeugt).");
  }
  return toQueryable(internal.client);
}

// Kompositionswurzel-Fähigkeit (von build-app.ts an den echten Pool gebunden und in Services wie
// KoService injiziert, s. dort): öffnet EINE echte Postgres-Transaktion (ein Client aus dem Pool,
// BEGIN…COMMIT/ROLLBACK) und reicht den Kontext an fn. Committet NUR, wenn fn vollständig durchläuft;
// jeder Fehler (inkl. eines Fehlers im COMMIT selbst) rollt zurück und wird weitergereicht — nie ein
// stiller Teilzustand. Der Client wird in JEDEM Fall freigegeben (finally), das Rollback-Ergebnis wird
// nicht geschluckt (nur sein möglicher eigener Fehler, damit der ursprüngliche Fehler nicht verdeckt wird).
export async function withPgTx<T>(pool: Pool, fn: (tx: TxContext) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tx: InternalTxContext = { brand: "TxContext", client };
    const result = await fn(tx);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
