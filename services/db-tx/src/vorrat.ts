import type { PoolClient, PoolConfig } from "pg";

// ================================================================================================
// R-0776 / R-0798 — DER VERBINDUNGSVORRAT LÄUFT NICHT LEER, UND NICHTS KOMMT HALB ZURÜCK.
// ================================================================================================
//
// Zwei Zusagen, beide an genau dieser Stelle gehalten und nicht in jedem Adapter einzeln:
//
// (1) ZURÜCKGEGEBEN WIRD NUR, WAS SAUBER IST. `client.release()` ohne Argument legt die Verbindung
//     zurück in den Vorrat — auch dann, wenn ihr ROLLBACK gescheitert ist und auf ihr noch eine
//     Transaktion offen steht. Der nächste Ausleiher erbte dann eine fremde, halbe Klammer samt
//     ihren Sperren. pg-pool verwirft eine Verbindung nur, wenn `release` einen Fehler bekommt
//     (oder die Verbindung schon tot ist). Deshalb führt `leiheAus` mit, ob die Ausleihe
//     unsauber geworden ist, und reicht das bei der Rückgabe weiter: die Verbindung wird
//     geschlossen, der Server rollt ihre offene Transaktion zurück, und der Vorrat legt eine
//     frische an.
//
//     Dazu gehört der `error`-Listener: Während einer Ausleihe hängt pg-pool KEINEN Listener an
//     die Verbindung. Reißt sie dann ab, sendet pg ein `error`-Ereignis ins Leere — ein
//     unbehandeltes Ereignis beendet den Prozess. Der Listener hier fängt es und merkt sich nur,
//     DASS die Verbindung verloren ist; die laufende Anweisung scheitert ohnehin selbst.
//
// (2) KEINE KLAMMER WARTET UNBEGRENZT. Zwei Zeitgrenzen, beide am Vorrat:
//
//     `connectionTimeoutMillis` — die Notbremse für den Vorrat. Ohne sie wartet ein Ausleiher
//     beliebig lange auf eine freie Verbindung. Hält eine Transaktion ihre Verbindung und wartet
//     selbst auf eine zweite (der Fall, den `overlap-service.ts` beschreibt), steht der Betrieb —
//     bei Vorratsgröße 1 sofort. Mit der Grenze scheitert der Wartende laut, seine Klammer rollt
//     zurück, und die gehaltene Verbindung kommt frei.
//
//     `idle_in_transaction_session_timeout` — die Grenze des Servers. Eine Sitzung, die mitten in
//     einer Transaktion schweigt (sie wartet auf einen Menschen, ein Netz oder ein Modell), wird
//     nach dieser Frist vom Server beendet; ihre Sperren fallen, ihre Änderungen rollen zurück.
//     Wer ausdrücklich eine schweigende Sperrklammer braucht, schaltet sie für SEINE Transaktion
//     ab (`SET LOCAL … = 0`, so `library-analytics/src/repo-pg.ts`) und begrenzt stattdessen das
//     Warten.
//
// BEWUSST NICHT gesetzt ist `statement_timeout`: Er träfe auch Migrationen und Indexaufbau beim
// Start, die auf großem Bestand legitim lange laufen. Die Zusage (2) betrifft das WARTEN, nicht
// das Arbeiten — eine arbeitende Anweisung wird nicht abgeschnitten (vgl. `idle-in-transaction.ts`,
// Zustand `active`).
//
// VORRANG: Trägt die `DATABASE_URL` selbst ein `options=` oder ein `connect_timeout`, gilt der Wert
// aus der Adresse (pg liest die Adresse nach der Konfiguration). Der Betreiber behält damit das
// letzte Wort, ohne dass es einen zweiten Schalter gibt.

/** Höchstwartezeit auf eine freie Verbindung aus dem Vorrat. */
export const VORRAT_WARTEZEIT_MS = 30_000;

/** Nach dieser Frist beendet der Server eine Sitzung, die in einer offenen Transaktion schweigt. */
export const LEERLAUF_IN_TRANSAKTION_MS = 60_000;

/** Die Konfiguration des einen, geteilten Vorrats (s. `services/app/src/db.ts`, `createPool`). */
export function vorratsKonfiguration(connectionString?: string): PoolConfig {
  return {
    ...(connectionString ? { connectionString } : {}),
    connectionTimeoutMillis: VORRAT_WARTEZEIT_MS,
    options: `-c idle_in_transaction_session_timeout=${LEERLAUF_IN_TRANSAKTION_MS}`,
  };
}

/** Eine laufende Ausleihe: merkt sich, ob die Verbindung unsauber wurde, und gibt sie passend zurück. */
export interface Ausleihe {
  /** Die Verbindung darf nicht in den Vorrat zurück (ROLLBACK gescheitert, Verbindung verloren). */
  verwerfen(grund: unknown): void;
  /** Ist die Ausleihe bereits unsauber? */
  readonly unsauber: boolean;
  /** Gibt die Verbindung genau einmal zurück — sauber in den Vorrat oder verworfen. */
  zurueckgeben(zusatz?: unknown): void;
}

function alsFehler(grund: unknown): Error {
  return grund instanceof Error
    ? grund
    : new Error("Verbindung verworfen: Transaktionszustand nicht sauber.");
}

// Testdoppel kennen oft weder `on` noch `removeListener`; dann gibt es auch kein Ereignis, das
// unbehandelt bleiben könnte. Die Prüfung ist deshalb Verträglichkeit, keine Ausnahme vom Vertrag.
// Ohne Typumwandlung (R-1152): `PoolClient` ist laut Typ ein EventEmitter, geprüft wird nur, ob
// das Laufzeitobjekt die Methode wirklich trägt.
export function leiheAus(client: PoolClient): Ausleihe {
  let grund: unknown;
  let zurueck = false;
  const beiFehler = (fehler: Error): void => {
    grund ??= fehler;
  };
  if (typeof client.on === "function") {
    client.on("error", beiFehler);
  }
  return {
    verwerfen(neu: unknown) {
      grund ??= neu ?? true;
    },
    get unsauber() {
      return grund !== undefined;
    },
    zurueckgeben(zusatz?: unknown) {
      if (zurueck) {
        return;
      }
      zurueck = true;
      if (typeof client.removeListener === "function") {
        client.removeListener("error", beiFehler);
      }
      const verworfen = grund ?? (zusatz ? zusatz : undefined);
      if (verworfen === undefined) {
        client.release();
      } else {
        client.release(alsFehler(verworfen));
      }
    },
  };
}
