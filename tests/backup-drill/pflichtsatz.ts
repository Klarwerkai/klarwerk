// ==================================================================================================
// JOB 4097 — DIE EINE WAHRHEIT ÜBER DEN DATENRAUM, VON BEIDEN SEITEN GELESEN.
// ==================================================================================================
//
// Der Restore-Drill prüft nach dem Restore eine Liste von Tabellen. Diese Liste darf nicht neben der
// Migration herlaufen — genau daran ist der alte Zustand gescheitert: `KERNTABELLEN=(kos users audit
// objects)` stand seit JOB 517 im Skript, während das Produkt inzwischen rund vierzig Tabellen
// anlegt. Ein Restore konnte Entwürfe, Belege samt Anhangszuordnung, Validierungen, Konflikte,
// Import-Kandidaten und Lesevarianten verlieren und trotzdem mit Exit 0 enden.
//
// Deshalb gibt es hier keine dritte Abschrift, sondern zwei Lesungen derselben Sachen:
//   `tabellenAusSchemas` liest die Tabellennamen aus den DDL-Stufen, die `migrate()` wirklich fährt
//   (`services/app/src/db.ts`, `schemas`), und
//   `pflichttabellenAusDrill` liest die Liste, gegen die der Drill wirklich prüft.
// `tests/backup-drill/tabellensatz.test.ts` hält beide gegeneinander.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const wurzel = resolve(import.meta.dirname, "../..");

/** Die Tabellennamen, die eine Menge von DDL-Stufen anlegt — in der Reihenfolge der Stufen. */
export function tabellenAusSchemas(stufen: readonly string[]): string[] {
  const raus: string[] = [];
  for (const ddl of stufen) {
    for (const treffer of ddl.matchAll(/CREATE TABLE IF NOT EXISTS\s+"?([A-Za-z0-9_]+)"?/gi)) {
      const name = treffer[1] as string;
      if (!raus.includes(name)) {
        raus.push(name);
      }
    }
  }
  return raus;
}

/**
 * Die Pflichtliste des Drills — aus dem Shellskript, das sie wirklich ausführt.
 *
 * Bewusst am Text und nicht an einer zweiten TypeScript-Konstante: Was der Drill prüft, steht im
 * Drill. Eine gespiegelte Konstante wäre wieder der zweite Pflegeort, den dieser Auftrag abschafft.
 */
export function pflichttabellenAusDrill(
  skript: string = readFileSync(resolve(wurzel, "scripts/backup/restore-drill.sh"), "utf8"),
): string[] {
  const start = skript.indexOf("PFLICHTTABELLEN=(");
  if (start < 0) {
    throw new Error("PFLICHTTABELLEN=( … ) in scripts/backup/restore-drill.sh nicht gefunden");
  }
  const ende = skript.indexOf(")", start);
  if (ende < 0) {
    throw new Error("PFLICHTTABELLEN=( … ) ist nicht geschlossen");
  }
  return skript
    .slice(start + "PFLICHTTABELLEN=(".length, ende)
    .split(/\s+/)
    .map((wort) => wort.trim())
    .filter((wort) => wort.length > 0);
}

/** Was die Migration anlegt, der Drill aber nicht prüft. Leer heißt: der Satz ist vollständig. */
export function nichtImDrill(
  tabellen: readonly string[],
  pflicht: readonly string[],
): readonly string[] {
  return tabellen.filter((name) => !pflicht.includes(name));
}

/** Und die Gegenrichtung: was der Drill prüft, was keine Migration anlegt. */
export function nichtInDenSchemas(
  tabellen: readonly string[],
  pflicht: readonly string[],
): readonly string[] {
  return pflicht.filter((name) => !tabellen.includes(name));
}
