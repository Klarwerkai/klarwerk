import type { Queryable } from "./tx";

// ================================================================================================
// JOB 596 — CRASHFESTE AUDITWAHRHEIT DES BESTANDSRESETS.
// ================================================================================================
//
// DAS PROBLEM, das dieser Automat löst, ist eines der unangenehmen: zwei entgegengesetzte
// Wirklichkeiten hinter demselben Bild.
//
// Ein Reset schreibt „läuft", nimmt die exklusive Sperre, löscht den Bestand, committet und
// schreibt danach sein Ergebnis. Stirbt der Prozess IRGENDWO dazwischen, findet der Wiederanlauf
// einen Lauf im Zustand „läuft" und eine freie Sperre vor — und zwar in beiden Fällen:
//
//     Absturz VOR dem Commit:   Nutzdaten sind da.  Sperre frei.  Status „läuft".
//     Absturz NACH dem Commit:  Nutzdaten sind weg. Sperre frei.  Status „läuft".
//
// „Läuft plus freie Sperre" kann diese beiden nicht unterscheiden. Wer daraus „zurückgerollt"
// schließt, behauptet im zweiten Fall, der Bestand stehe unverändert — während er gelöscht ist.
// Von den beiden möglichen Irrtümern ist das der gefährliche.
//
// DIE LÖSUNG IST KEINE ZUSÄTZLICHE PRÜFUNG, SONDERN EIN ZUSÄTZLICHES DATUM. `payload_committed_at`
// wird INNERHALB der Nutzdatentransaktion gesetzt, als deren letzte Anweisung:
//
//     die Transaktion committet    →  Nutzdaten weg   UND  Merkmal da
//     die Transaktion rollt zurück →  Nutzdaten da    UND  Merkmal weg
//
// Ein Zwischenzustand ist nicht konstruierbar, weil es kein zweites Commit gibt, in dem er
// entstehen könnte. Ein `UPDATE` NACH dem `COMMIT` wäre genau dieses zweite Fenster und damit
// derselbe Fehler in neuer Gestalt — deshalb steht die Anweisung ausdrücklich IN der Transaktion.
//
// Der Preis dafür ist ehrlich zu nennen: Die Audittabelle muss in DERSELBEN Datenbank liegen wie
// der Bestand, sonst gäbe es keine gemeinsame Transaktion. Für eine dedizierte Kundeninstanz ist
// das der Normalfall (ein Datenraum); für einen zweiten Server wäre es zu prüfen — das ist Teil
// der offenen Ownerfrage OV-5.

// Was in der Tabelle steht: die drei Stände, die ein Lauf selbst über sich schreibt.
export type BestandsresetStatus = "RUNNING" | "OK" | "ROLLED_BACK";

// Was der Automat daraus ableitet. Die drei zusätzlichen Werte sind genau die Fälle, die der
// geschriebene Status allein nicht ausdrücken kann.
export type BestandsresetZustand =
  | BestandsresetStatus
  // Absturz vor dem Commit: die Nutzdaten stehen unverändert.
  | "ROLLED_BACK_BY_CRASH"
  // Absturz nach dem Commit, vor dem Auditabschluss: die Nutzdaten sind WEG, der Lauf gilt
  // trotzdem nicht als erfolgreich — niemand hat sein Ergebnis bestätigt.
  | "COMMITTED_AUDIT_MISSING"
  // Ein Bestand, der sich selbst widerspricht. Fail-closed: kein Erfolg, keine Aussage.
  | "INCONSISTENT";

export interface BestandsresetLauf {
  readonly id: string;
  readonly status: BestandsresetStatus;
  // Das Commitmerkmal. `null`, solange die Nutzdatentransaktion nicht committet hat.
  readonly payloadCommittedAt: Date | null;
}

export interface BestandsresetBefund {
  readonly zustand: BestandsresetZustand;
  // Steht der Bestand noch auf seinem Stand vor dem Reset (P0)? `undefined` heißt ausdrücklich
  // „nicht aussagbar" — und ist NICHT dasselbe wie `false`. Ein Automat, der im Zweifel rät,
  // wäre genau der, den dieser hier ersetzt.
  readonly bestandIstP0: boolean | undefined;
  // Darf dieser Lauf als erfolgreich gemeldet werden?
  readonly erfolgMeldbar: boolean;
  readonly begruendung: string;
}

// ================================================================================================
// DIE AUFLÖSUNG. Reine Funktion — kein I/O, keine Uhr, kein Zufall.
// ================================================================================================
//
// Zwei Eingaben: was der Lauf über sich geschrieben hat, und ob seine exklusive Sperre GERADE
// gehalten wird. Die Sperre ist die einzige Information, die ein abgestürzter Prozess nicht
// hinterlassen kann — sie wird beim Transaktionsende serverseitig frei, auch bei Absturz. Genau
// deshalb ist sie hier das Lebenszeichen und nicht ein Zeitstempel.
export function loeseBestandsresetAuf(
  lauf: BestandsresetLauf,
  sperreGehalten: boolean,
): BestandsresetBefund {
  const merkmalDa = lauf.payloadCommittedAt !== null;

  if (lauf.status === "RUNNING") {
    if (sperreGehalten) {
      // Ein lebender Lauf. NICHT ANFASSEN — jede Aufräumung hier führe ihm in die Arbeit.
      return {
        zustand: "RUNNING",
        bestandIstP0: undefined,
        erfolgMeldbar: false,
        begruendung: "Die exklusive Sperre wird gehalten: der Lauf arbeitet noch.",
      };
    }
    if (merkmalDa) {
      // DER FALL, DEN „läuft plus freie Sperre" NICHT SEHEN KANN.
      return {
        zustand: "COMMITTED_AUDIT_MISSING",
        bestandIstP0: false,
        erfolgMeldbar: false,
        begruendung:
          "Die Nutzdatentransaktion hat committet (Commitmerkmal gesetzt), der Auditabschluss fehlt. Der Bestand ist NICHT mehr auf P0; der Lauf gilt trotzdem nicht als erfolgreich.",
      };
    }
    return {
      zustand: "ROLLED_BACK_BY_CRASH",
      bestandIstP0: true,
      erfolgMeldbar: false,
      begruendung:
        "Sperre frei und kein Commitmerkmal: die Nutzdatentransaktion ist zurückgerollt, der Bestand steht unverändert auf P0.",
    };
  }

  if (lauf.status === "OK") {
    if (!merkmalDa) {
      // Ein Lauf, der sich selbst für erfolgreich hält, ohne dass seine Nutzdatentransaktion je
      // committet hat. Das kann nicht beides stimmen.
      return {
        zustand: "INCONSISTENT",
        bestandIstP0: undefined,
        erfolgMeldbar: false,
        begruendung:
          "Status OK ohne Commitmerkmal — widersprüchlich. Fail-closed: kein Erfolg, keine Bestandsaussage.",
      };
    }
    return {
      zustand: "OK",
      bestandIstP0: false,
      erfolgMeldbar: true,
      begruendung: "Commitmerkmal gesetzt und Abschluss geschrieben: der Reset ist durchgelaufen.",
    };
  }

  // ROLLED_BACK — sauber zurückgerollt und als solcher abgeschlossen.
  if (merkmalDa) {
    return {
      zustand: "INCONSISTENT",
      bestandIstP0: undefined,
      erfolgMeldbar: false,
      begruendung:
        "Status ROLLED_BACK mit gesetztem Commitmerkmal — widersprüchlich. Fail-closed: keine Bestandsaussage.",
    };
  }
  return {
    zustand: "ROLLED_BACK",
    bestandIstP0: true,
    erfolgMeldbar: false,
    begruendung: "Sauber zurückgerollt: der Bestand steht unverändert auf P0.",
  };
}

// ================================================================================================
// DIE ANWEISUNGEN.
// ================================================================================================

export const SQL_SCHEMA_BESTANDSRESET = `
CREATE TABLE IF NOT EXISTS bestandsreset_laeufe (
  id                  text PRIMARY KEY,
  status              text NOT NULL CHECK (status IN ('RUNNING','OK','ROLLED_BACK')),
  gestartet_at        timestamptz NOT NULL DEFAULT now(),
  payload_committed_at timestamptz,
  abgeschlossen_at    timestamptz
)`;

export const SQL_LAUF_ANLEGEN = `
INSERT INTO bestandsreset_laeufe(id, status) VALUES ($1, 'RUNNING')`;

// DIE LETZTE ANWEISUNG IN DER NUTZDATENTRANSAKTION. Ihre Stellung ist der ganze Vertrag: Sie
// committet mit den Löschungen zusammen oder gar nicht.
export const SQL_COMMITMERKMAL_SETZEN = `
UPDATE bestandsreset_laeufe SET payload_committed_at = now() WHERE id = $1`;

export const SQL_ABSCHLUSS_SETZEN = `
UPDATE bestandsreset_laeufe SET status = $2, abgeschlossen_at = now() WHERE id = $1`;

export const SQL_LETZTER_LAUF = `
SELECT id, status, payload_committed_at FROM bestandsreset_laeufe
ORDER BY gestartet_at DESC LIMIT 1`;

interface LaufZeile {
  id: string;
  status: BestandsresetStatus;
  payload_committed_at: Date | null;
}

// Liest den jüngsten Lauf. `undefined` heißt: es hat nie einen gegeben — das ist kein Befund,
// sondern die Abwesenheit eines Laufs, und wird deshalb nicht in einen Zustand übersetzt.
export async function letzterBestandsresetLauf(
  db: Queryable,
): Promise<BestandsresetLauf | undefined> {
  const res = await db.query<LaufZeile>(SQL_LETZTER_LAUF);
  const zeile = res.rows[0];
  if (!zeile) {
    return undefined;
  }
  return {
    id: zeile.id,
    status: zeile.status,
    payloadCommittedAt: zeile.payload_committed_at,
  };
}

// ================================================================================================
// DER WIEDERANLAUF-BEFUND — die Frage, für die dieser Automat gebaut ist.
// ================================================================================================
//
// „Was ist beim letzten Reset passiert, und steht mein Bestand?" Sie wird über den ROHEN,
// ungesperrten Pool gestellt (s. build-app.ts): Der Audit muss auch WÄHREND eines laufenden Resets
// antworten können — sonst könnte er über einen laufenden Reset nichts sagen, und genau das ist
// der Zeitpunkt, zu dem man ihn fragt.
export async function bestandsresetBefund(
  db: Queryable,
  sperrePruefen: (db: Queryable) => Promise<boolean>,
): Promise<BestandsresetBefund | undefined> {
  const lauf = await letzterBestandsresetLauf(db);
  if (!lauf) {
    return undefined;
  }
  return loeseBestandsresetAuf(lauf, await sperrePruefen(db));
}
