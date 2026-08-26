// ================================================================================================
// JOB 2354 · D1 · E7 — DIE LESER. Reine Funktionen, damit die Wache sie kalibrieren kann.
// ================================================================================================
//
// Warum ein eigenes Modul und nicht alles in der Testdatei: `lint/suspicious/noExportsInTest`
// verbietet Exporte aus einer `.test.ts` — dieselbe Hausform, die `tests/smoke/smoke-torlogik.ts`
// neben `torlogik.test.ts` stellt. Die Regeln stehen hier, die Zusicherungen daneben.
//
// Alle Funktionen hier sind REIN: Text hinein, Ergebnis heraus, kein Dateizugriff. Nur so lassen
// sie sich an synthetischen Eingaben kalibrieren, ohne das Produkt zu mutieren (Fall N5).
import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Der Wert von `POSTGRES_DB` in einer Compose-Datei.
 *
 * Kommentarzeilen werden uebersprungen: Der Bau von JOB 2354 hat neben diese Zeilen eine
 * Begruendung gestellt, die den ALTEN Namen zitiert. Ein Kommentar darf hier nicht als
 * Deklaration zaehlen — dieselbe Falle, die der Kopfleser in
 * `tests/app/coolify-compose-quellwahrheit.test.ts` umgeht.
 */
export function postgresDbAus(inhalt: string): string | null {
  for (const rohzeile of inhalt.split("\n")) {
    const zeile = rohzeile.trim();
    if (zeile.startsWith("#")) {
      continue;
    }
    const treffer = /^POSTGRES_DB:\s*(\S+)\s*$/.exec(zeile);
    if (treffer?.[1]) {
      return treffer[1];
    }
  }
  return null;
}

/**
 * Jeder Datenbankname, den eine Verbindungszeichenkette in diesem Text nennt.
 *
 * Gelesen wird dasselbe Pfadsegment, das auch `services/db-tx/src/pg-test-guard.ts:18` als
 * Datenbanknamen liest — bewusst per Muster und nicht per `new URL()`, weil die
 * Socket-Verbindungsstrings dieses Hauses (leerer Host mit Userinfo) von WHATWG-URL abgelehnt
 * werden.
 */
export function datenbanknamenAusUrls(inhalt: string): string[] {
  const namen: string[] = [];
  const muster = /postgres(?:ql)?:\/\/[^\s'"`]*?\/([A-Za-z0-9_$-]+)/g;
  let treffer = muster.exec(inhalt);
  while (treffer !== null) {
    if (treffer[1]) {
      namen.push(treffer[1]);
    }
    treffer = muster.exec(inhalt);
  }
  return namen;
}

/** Der Wert von `POSTGRES_DB: "…"` in einer Testcontainer-Umgebung. */
export function postgresDbAusTestcontainer(inhalt: string): string[] {
  const namen: string[] = [];
  const muster = /POSTGRES_DB:\s*"([^"]+)"/g;
  let treffer = muster.exec(inhalt);
  while (treffer !== null) {
    if (treffer[1]) {
      namen.push(treffer[1]);
    }
    treffer = muster.exec(inhalt);
  }
  return namen;
}

/** Ein Verzeichnis lesen, ohne bei einem fehlenden Pfad zu werfen. */
function leseVerzeichnis(pfad: string) {
  try {
    return readdirSync(pfad, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** Alle Dateien unter `wurzel`, deren Name auf `endung` endet. Ohne node_modules, dist, Punktordner. */
export function dateienMitEndung(wurzel: string, endung: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of leseVerzeichnis(wurzel)) {
    if (
      eintrag.name === "node_modules" ||
      eintrag.name === "dist" ||
      eintrag.name.startsWith(".")
    ) {
      continue;
    }
    const pfad = join(wurzel, eintrag.name);
    if (eintrag.isDirectory()) {
      gefunden.push(...dateienMitEndung(pfad, endung));
    } else if (eintrag.name.endsWith(endung)) {
      gefunden.push(pfad);
    }
  }
  return gefunden;
}
