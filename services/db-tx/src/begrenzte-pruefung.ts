import type { Pool } from "pg";
import {
  type Abbruchbefund,
  type PgAktivitaetszeile,
  ZUSTAND_HAENGT,
  bewerte,
} from "./idle-in-transaction";
import { sperreOderAbweisen } from "./reset-lock";
import { type Queryable, clientQueryable } from "./tx";
import { leiheAus } from "./vorrat";

// ================================================================================================
// R-1437 / I10 (R-2045) — DER VERTRAG FÜR ENG BEGRENZTE DATENBANKPRÜFUNGEN.
// ================================================================================================
//
// Eine Datenbankprüfung läuft NIE in einer offenen, interaktiven Transaktion. Dieser Weg ist der
// einzige, auf dem das Produkt und seine Betriebswerkzeuge (`tools/datenintegritaet.ts`) den Bestand
// prüfen. Er hält fünf Zusagen, jede am Ablauf und nicht am guten Willen des Aufrufers:
//
//   1. ZUERST DIE REGEL NACH EINEM ABBRUCH. Vor der Prüfung fragt der Weg `pg_stat_activity` und
//      lässt den vorhandenen Entscheidungshelfer (`idle-in-transaction.ts`, `bewerte`) urteilen.
//      Hängt eine Sitzung `idle in transaction`, beginnt die Prüfung NICHT: sie wirft
//      `HaengendeSitzungError` mit Befund und fertigen Befehlen. Das Beenden bleibt beim Menschen
//      (so verlangt es die Regel, und so ist der Helfer gebaut) — der Weg nimmt ihm nur das Raten ab.
//   2. NUR LESEN. `BEGIN READ ONLY`: eine Prüfung, die schreiben wollte, scheitert an PostgreSQL.
//   3. ZEITGRENZEN IN DER KLAMMER. `statement_timeout`, `lock_timeout` und
//      `idle_in_transaction_session_timeout` gelten per `SET LOCAL` nur für diese Transaktion. Eine
//      Prüfung kann weder unbegrenzt rechnen noch auf eine Sperre warten noch schweigend offen stehen.
//   4. IMMER ROLLBACK. Es gibt kein COMMIT auf diesem Weg; Ergebnis ist allein der Rückgabewert.
//   5. SAUBERE RÜCKGABE. Die Verbindung geht über `leiheAus` zurück (R-0776): scheitert das
//      ROLLBACK, wird sie verworfen.
//
// AUSSERHALB DIESES VERTRAGS, ehrlich benannt: Wer eine `psql`-Konsole von Hand öffnet, begrenzt
// dieser Code nicht. Dafür gibt es nur zwei Wege, beide außerhalb des Produktcodes: eine
// Rolleneinstellung der Datenbank (`ALTER ROLE … SET idle_in_transaction_session_timeout = …`)
// oder eine Servereinstellung der Produktionsdatenbank (Coolify). Beide sind Betriebsentscheidungen.

/** Die Grenzen einer Prüfung in Millisekunden. */
export interface PruefGrenzen {
  /** Höchstdauer je Anweisung (`statement_timeout`). */
  readonly anweisungMs: number;
  /** Höchstwartezeit auf eine Sperre (`lock_timeout`). */
  readonly sperreMs: number;
  /** Höchstes Schweigen innerhalb der Klammer (`idle_in_transaction_session_timeout`). */
  readonly leerlaufMs: number;
}

export const PRUEF_GRENZEN: PruefGrenzen = {
  anweisungMs: 30_000,
  sperreMs: 2_000,
  leerlaufMs: 5_000,
};

/**
 * Die Sitzungsabfrage für den Entscheidungshelfer — dieselben Spalten wie `PgAktivitaetszeile`.
 * Sie fragt NUR die eigene Datenbank und lässt die eigene Sitzung aus; `active` gehört dazu, weil
 * `bewerte` zwischen „warten" und „frei" unterscheidet.
 */
export const SQL_SITZUNGSLAGE = `SELECT pid, state,
  COALESCE(EXTRACT(EPOCH FROM now() - xact_start), 0)::float8 AS "offenSekunden",
  left(COALESCE(query, ''), 200) AS query
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid()
  AND state IN ('${ZUSTAND_HAENGT}', 'active')
ORDER BY xact_start`;

/** Die Prüfung beginnt nicht, weil eine Sitzung offen hängt. Der Befund nennt PIDs und Befehle. */
export class HaengendeSitzungError extends Error {
  readonly befund: Abbruchbefund;

  constructor(befund: Abbruchbefund) {
    super(`Prüfung nicht begonnen: ${befund.begruendung}`);
    this.name = "HaengendeSitzungError";
    this.befund = befund;
  }
}

function grenze(ms: number): number {
  return Math.max(1, Math.trunc(ms));
}

/** Die Anweisungen, die die Klammer öffnen — in genau dieser Reihenfolge. */
export function klammerAnweisungen(grenzen: PruefGrenzen): string[] {
  return [
    "BEGIN READ ONLY",
    `SET LOCAL statement_timeout = ${grenze(grenzen.anweisungMs)}`,
    `SET LOCAL lock_timeout = ${grenze(grenzen.sperreMs)}`,
    `SET LOCAL idle_in_transaction_session_timeout = ${grenze(grenzen.leerlaufMs)}`,
  ];
}

export interface PruefErgebnis<T> {
  readonly ergebnis: T;
  /** Das Urteil des Entscheidungshelfers vor dem Start (`frei` oder `warten`). */
  readonly vorbefund: Abbruchbefund;
}

/**
 * Führt `pruefung` als eng begrenzte, nur lesende, nichtinteraktive Prüfung aus (s. Kopf).
 * Wirft `HaengendeSitzungError`, ohne die Klammer zu öffnen, wenn eine Sitzung offen hängt.
 */
export async function begrenztePruefung<T>(
  pool: Pool,
  pruefung: (q: Queryable) => Promise<T>,
  grenzen: PruefGrenzen = PRUEF_GRENZEN,
): Promise<PruefErgebnis<T>> {
  const client = await pool.connect();
  const ausleihe = leiheAus(client);
  // Ab dem ersten Versuch, die Klammer zu öffnen, wird genau EINMAL zurückgerollt — auch wenn
  // schon `BEGIN` oder ein `SET LOCAL` scheitert. Ein ROLLBACK ohne offene Transaktion ist für
  // PostgreSQL nur eine Warnung; scheitert es selbst, wird die Verbindung verworfen.
  let klammer = false;
  try {
    const q = clientQueryable(client);
    const lage = await q.query<PgAktivitaetszeile>(SQL_SITZUNGSLAGE);
    const vorbefund = bewerte(lage.rows);
    if (vorbefund.handeln === "beenden") {
      throw new HaengendeSitzungError(vorbefund);
    }
    klammer = true;
    for (const anweisung of klammerAnweisungen(grenzen)) {
      await client.query(anweisung);
    }
    // OV-8 (gated-pool.ts): während eines Bestandsresets wird auch gelesen nicht. Die geteilte
    // Sperre ist transaktionsgebunden und in einer READ-ONLY-Klammer erlaubt.
    await sperreOderAbweisen(client);
    const ergebnis = await pruefung(q);
    return { ergebnis, vorbefund };
  } finally {
    if (klammer) {
      await client.query("ROLLBACK").catch((f: unknown) => ausleihe.verwerfen(f));
    }
    ausleihe.zurueckgeben();
  }
}
