// ================================================================================================
// JOB 4265 · E1 — DAS VERBINDUNGSENDE WIRD NACHGEWIESEN, NICHT ANGENOMMEN.
// ================================================================================================
//
// DER BEFUND, gegen den diese Datei steht (BEN zu JOB 4223 Runde 3, Arbeitsprüfung
// `dcab567835ac4c62b7d2fade74c8b9fc`): Der Integrationslauf endete mit `Tests 2 passed (2)` UND
// `Errors 1 error`, Exit 1 — „terminating connection due to administrator command" (FATAL 57P01,
// `postgres.c:3328`, `ProcessInterrupts`). Die Fehlerakte jenes Laufs nennt die Verbindung
// namentlich: `database: 'klarwerk_gastweg_test_595469534'`, `_poolUseCount: 63`,
// `_ending: true`, `_ended: false`, `_connected: true`. Das ist der Anwendungspool des Testfalls
// (63 Entleihungen), und er war beim `DROP DATABASE … WITH (FORCE)` noch am Server.
//
// DIE URSACHE, am Quelltext von `pg-pool` nachgelesen und nicht vermutet:
//
//   · `Pool._remove` (`node_modules/pg-pool/index.js:179-187`) nimmt den Client SYNCHRON aus
//     `this._clients` heraus und ruft DANACH `client.end(callback)` — der Abbau der TCP-Verbindung
//     läuft ab da nebenher.
//   · `Pool._pulseQueue` (`:133-144`) sieht unmittelbar danach `this._clients.length === 0` und
//     löst im SELBEN Tick `this._endCallback()` aus.
//
// `await pool.end()` bedeutet deshalb „der Pool führt keine Clients mehr" und NICHT „die Backends
// sind weg". Wer direkt danach `DROP DATABASE … WITH (FORCE)` fährt, schiesst mit
// `pg_terminate_backend` auf ein Backend, das gerade selbst geht. PostgreSQL antwortet ihm mit
// FATAL 57P01; der `pg`-Client hat als einzigen Horcher noch den `idleListener` des Pools
// (`:51-63`, in der Fehlerakte als `_events: { error: … }, _eventsCount: 1` zu sehen), der den
// Fehler mit `pool.emit("error", …)` weiterreicht — und der Pool hat keinen `error`-Horcher. Ein
// EventEmitter ohne `error`-Horcher wirft: „Uncaught Exception", Exit 1, obwohl jede Zusage des
// Laufs gehalten wurde.
//
// ES IST EIN WETTLAUF UND KEIN FESTER FEHLER. Zwei eigene Läufe am unveränderten Stand
// (Arbeitsprüfungen `4cdbdaf230974289b201a7906899cc43` und `d011763b773a41149c608d41d93acdbc`,
// letzterer mit BENs Aufrufzeile Zeichen für Zeichen) endeten mit Exit 0 und `Errors 0`: auf einem
// schnellen, unbelasteten Rechner ist das Backend rechtzeitig fort. Genau deshalb steht hier ein
// NACHWEIS und kein weiteres `catch`: ein Fehler, der nur unter Last erscheint, verschwindet nicht
// dadurch, dass man ihn heute nicht sieht.
//
// GEFRAGT WIRD DER SERVER, NICHT DER CLIENT. `pool.end()` ist die Aussage der Clientbibliothek über
// sich selbst — und genau die ist ja der Befund. `pg_stat_activity` ist die Aussage von PostgreSQL
// darüber, wer wirklich noch an der Datenbank hängt.
import type { Pool } from "pg";

/** Eine Verbindung, die noch an der Wegwerf-Datenbank hängt — so, wie der Server sie sieht. */
export interface Verbindungszeile {
  pid: number;
  zustand: string;
  anwendung: string;
  abfrage: string;
}

/** Was das Warten gekostet hat — für den Befund in der Rückgabe, nicht für eine Zusicherung. */
export interface Verbindungsbefund {
  /** Was unmittelbar nach `pool.end()` noch am Server hing. */
  zuBeginn: Verbindungszeile[];
  /** Was am Ende der Frist ÜBRIG war. Leer ist die Zusage; alles andere ist ein Leck. */
  rest: Verbindungszeile[];
  /** Wie lange gewartet wurde, bis nichts mehr hing (oder bis die Frist um war). */
  wartezeitMs: number;
  abfragen: number;
}

/**
 * Wer hängt JETZT noch an dieser Datenbank?
 *
 * `pid <> pg_backend_pid()` schliesst die eigene Zeile aus. Sie kann hier ohnehin nicht auftauchen
 * — der Verwaltungspool liegt auf einer ANDEREN Datenbank —, aber die Bedingung hält die Aussage
 * auch dann richtig, wenn jemand das später ändert.
 */
export async function offeneVerbindungen(
  admin: Pool,
  datenbank: string,
): Promise<Verbindungszeile[]> {
  const ergebnis = await admin.query<{
    pid: number;
    state: string | null;
    application_name: string | null;
    query: string | null;
  }>(
    "SELECT pid, state, application_name, query FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid() ORDER BY pid",
    [datenbank],
  );
  return ergebnis.rows.map((zeile) => ({
    pid: zeile.pid,
    zustand: zeile.state ?? "(ohne Zustand)",
    anwendung: zeile.application_name || "(ohne Namen)",
    abfrage: (zeile.query ?? "").slice(0, 160),
  }));
}

/**
 * Warten, bis keine Verbindung mehr an der Datenbank hängt — und berichten, was übrig blieb.
 *
 * PASSIV, und das ist Absicht: `pool.end()` HAT den Abschied schon geschickt, es fehlt nur die
 * Bestätigung des Servers. Würde hier `pg_terminate_backend` gefahren, wäre das wieder ein
 * Abschuss — derselbe Fehler mit einem anderen Namen, und ein echtes Leck bliebe unsichtbar.
 *
 * Die Frist ist eine OBERGRENZE, kein `sleep`: im Regelfall kehrt die erste oder zweite Abfrage
 * schon leer zurück. Läuft sie ab, ist der `rest` nicht leer, und der Aufrufer macht daraus eine
 * rote Zusicherung mit den Zeilen darin — ein hängengebliebener Client soll gefunden werden, nicht
 * weggewartet.
 */
export async function warteAufVerbindungsende(
  admin: Pool,
  datenbank: string,
  frist = 15_000,
): Promise<Verbindungsbefund> {
  const begonnen = Date.now();
  let zuBeginn: Verbindungszeile[] | undefined;
  let rest: Verbindungszeile[] = [];
  let abfragen = 0;
  do {
    rest = await offeneVerbindungen(admin, datenbank);
    abfragen += 1;
    zuBeginn ??= rest;
    if (rest.length === 0) {
      break;
    }
    await new Promise((weiter) => setTimeout(weiter, 25));
  } while (Date.now() - begonnen < frist);
  return { zuBeginn: zuBeginn ?? [], rest, wartezeitMs: Date.now() - begonnen, abfragen };
}

/** Eine Zeile Klartext je Verbindung — damit eine rote Zusicherung auf den Schuldigen zeigt. */
export function alsBefund(zeilen: Verbindungszeile[]): string {
  return zeilen.length === 0
    ? "(keine)"
    : zeilen.map((z) => `pid ${z.pid} · ${z.zustand} · ${z.anwendung} · ${z.abfrage}`).join("\n  ");
}
