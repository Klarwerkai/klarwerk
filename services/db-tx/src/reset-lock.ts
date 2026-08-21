import type { PoolClient } from "pg";

// ================================================================================================
// JOB 596 — DIE SPERRE DES BESTANDSRESETS.
// ================================================================================================
//
// Ein Bestandsreset löscht den Bestand. Solange er läuft, darf kein anderer Schreiber in die
// Datenbank greifen — sonst entsteht ein Bestand, der halb gelöscht und halb neu ist. Die Sperre
// ist deshalb keine Bequemlichkeit, sondern der Vertrag, ohne den der Reset nicht zugesagt werden
// kann.
//
// TRANSAKTIONSGEBUNDENE ADVISORY-SPERREN, nicht sitzungsgebundene. Der Unterschied trägt: eine
// `pg_advisory_lock`-Sperre überlebt die Transaktion und muss aktiv freigegeben werden — stirbt der
// Prozess dazwischen, bleibt die Datenbank gesperrt, bis jemand aufräumt. `*_xact_*` gibt die Sperre
// beim Transaktionsende SERVERSEITIG frei, auch bei Absturz und Verbindungsabbruch. Für einen
// Vorgang, dessen ganzer Zweck die Absturzfestigkeit ist, ist das die einzig vertretbare Wahl.
//
// GETEILT für die normalen Schreiber, EXKLUSIV für den Reset. Beliebig viele Schreiber halten die
// geteilte Sperre gleichzeitig; der Reset bekommt die exklusive erst, wenn keiner mehr da ist, und
// hält dann alle neuen ab. Das ist die übliche Leser-Schreiber-Richtung, hier um eine Ebene
// verschoben: „Schreiber" ist der Normalbetrieb, „Schreiber-Schreiber" ist der Reset.
//
// ABWEISEN, NICHT WARTEN. Beide Anweisungen sind `try`-Varianten: Wer die Sperre nicht sofort
// bekommt, bekommt einen Fehler statt einer unbestimmt langen Blockade. Ein Request, der still
// minutenlang hängt, ist für den Benutzer nicht von einem Ausfall zu unterscheiden.
//
//   RESTGRENZE (Ownerfrage OV-5, unverändert offen): Ob der Normalbetrieb während eines Resets
//   abgewiesen wird oder wartet, ist eine Produktentscheidung. Der Vertrag hier ist auf ABWEISEN
//   gebaut. `pg_try_advisory_xact_lock_shared` gegen `pg_advisory_xact_lock_shared` zu tauschen ist
//   der eine Handgriff, mit dem daraus „Warten" würde — an genau dieser Stelle und nirgends sonst.

// Der Sperrschlüssel dieses Jobs. Advisory-Sperren teilen einen datenbankweiten Zahlenraum ohne
// Namensvergabe; eine job-eigene, hier einmal vergebene Zahl ist der Schutz gegen die zufällige
// Kollision mit einer fremden Sperre.
export const SPERRSCHLUESSEL_BESTANDSRESET = 596000001;

// Die Sperre der normalen Schreiber. Als EINZIGE Anweisung formuliert, die eine Transaktion
// eröffnen darf — der Aufrufer setzt sie unmittelbar nach `BEGIN` ab (s. gated-pool.ts).
export const SQL_SPERRE_GETEILT = `SELECT pg_try_advisory_xact_lock_shared(${SPERRSCHLUESSEL_BESTANDSRESET}) AS erworben`;

// Die Sperre des Resets selbst.
export const SQL_SPERRE_EXKLUSIV = `SELECT pg_try_advisory_xact_lock(${SPERRSCHLUESSEL_BESTANDSRESET}) AS erworben`;

// Der Fehler, den ein abgewiesener Schreiber bekommt. Eine eigene Klasse und keine generische
// Meldung, damit die Routen ihn erkennen und als „gerade nicht möglich" beantworten können, statt
// ihn als Störung zu behandeln.
export class BestandsresetLaeuftError extends Error {
  readonly code = "BESTANDSRESET_LAEUFT";

  constructor() {
    super(
      "Der Bestand wird gerade zurückgesetzt. Schreibende Zugriffe sind für die Dauer des Vorgangs abgewiesen.",
    );
    this.name = "BestandsresetLaeuftError";
  }
}

interface SperrZeile {
  erworben: boolean;
}

// ================================================================================================
// D5 → D6: DIESE FUNKTION STELLT NUR FEST. SIE RÄUMT NICHT AUF.
// ================================================================================================
//
// In der ersten Fassung räumten hier UND im äußeren Fang je ein `ROLLBACK` auf — die Verbindung
// trug dadurch zwei davon. Aufgeräumt wird jetzt ausschließlich dort, wo die Transaktion geöffnet
// wurde; wer sie öffnet, schließt sie. Diese Regel steht hier im Quelltext, weil sie der Grund für
// den Zuschnitt der Funktion ist und ohne ihn beim nächsten Umbau wieder verloren ginge.
export async function sperreOderAbweisen(client: PoolClient): Promise<void> {
  const res = await client.query<SperrZeile>(SQL_SPERRE_GETEILT);
  if (!res.rows[0]?.erworben) {
    throw new BestandsresetLaeuftError();
  }
}

// ================================================================================================
// DAS LEBENSZEICHEN — hält gerade jemand die exklusive Sperre?
// ================================================================================================
//
// Diese Frage ist die zweite Eingabe des Auditautomaten (bestandsreset-audit.ts). Sie wird
// BEOBACHTEND gestellt, nicht durch einen Erwerbsversuch: Wer die Sperre testweise nimmt, hält sie
// bis zum Ende seiner eigenen Transaktion und beantwortet damit für jeden weiteren Frager die
// falsche Frage.
//
// `pg_locks` ist die serverseitige Sicht, und sie ist der Grund, warum das überhaupt trägt: Stirbt
// ein Prozess, verschwindet sein Eintrag dort, ohne dass jemand aufräumen müsste. Ein Zeitstempel
// in einer Tabelle könnte das nicht — ein abgestürzter Prozess schreibt keinen Schlussstempel.
//
// Advisory-Sperren erscheinen in `pg_locks` als `locktype='advisory'`; der 64-Bit-Schlüssel steht
// zerlegt in `classid` (obere 32 Bit) und `objid` (untere 32 Bit). Unser Schlüssel liegt unter
// 2^31, die oberen Bits sind daher 0.
export const SQL_SPERRE_WIRD_GEHALTEN = `
SELECT EXISTS (
  SELECT 1 FROM pg_locks
  WHERE locktype = 'advisory'
    AND classid = 0
    AND objid = ${SPERRSCHLUESSEL_BESTANDSRESET}
    AND mode = 'ExclusiveLock'
    AND granted
) AS gehalten`;
