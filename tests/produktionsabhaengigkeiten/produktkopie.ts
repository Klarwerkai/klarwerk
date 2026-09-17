// ================================================================================================
// JOB 4272 · DIE ISOLIERTE PRODUKTKOPIE — UND DER UNVERÄNDERTE TEST, DER IN IHR LÄUFT.
// ================================================================================================
//
// WARUM DIESE DATEI IN RUNDE 4 ENTSTANDEN IST. BEN hat an Runde 3 den Nachweis der Lieferung 7
// zurückgewiesen, und er hatte recht: `kalibrierung.test.ts` baute die Verstellungen NACH —
// `:408` baute eine eigene Route `/api/pruef`, `:461` eine eigene `sharp`-Kette, `:497` verglich
// unmittelbar Zeichenketten. Sein Satz dazu: „Das belegt Hilfsfunktionen, aber keinen roten Lauf
// der vorgeschriebenen Regressionstests gegen mutierten Produktcode."
//
// DER UNTERSCHIED, UM DEN ES GEHT. Ein nachgebauter Fall zeigt, dass eine PRÜFFUNKTION
// unterscheiden kann. Er zeigt nicht, dass der REGRESSIONSTEST rot wird, wenn das Produkt sich
// ändert — und nur das Zweite ist die Zusage, die dieser Ordner gibt. Deshalb geht dieser Weg
// andersherum:
//
//   1. eine vollständige Kopie des Produkts in einem Wegwerfordner AUSSERHALB des Arbeitsbaums,
//   2. GENAU EINE Zeile darin verstellt — im Produktcode, nicht im Test,
//   3. der UNVERÄNDERTE Regressionstest, Zeichen für Zeichen derselbe, in dieser Kopie gefahren,
//   4. sein wirklicher Exit-Code und seine wirkliche Fehlermeldung als Beleg.
//
// DER ARBEITSBAUM WIRD DABEI NIE ANGEFASST. Verstellt wird ausschliesslich in der Kopie; jede
// Verstellung wird danach wortgleich zurückgenommen und die Rücknahme geprüft (`zurueckgenommen`).
//
// WAS DIESE DATEI NICHT TUT: Sie bewertet nichts. Sie stellt her, fährt und gibt zurück, was der
// Lauf gesagt hat — die Bewertung steht in `produktmutationen.test.ts`.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";

/**
 * Was die Kopie braucht, damit ein Regressionstest dieses Ordners in ihr läuft.
 *
 * `tests` UND `services` UND `apps` sind alle drei nötig und keines davon Beiwerk: der Bildimport
 * zieht `apps/web/src/lib/docx` und die Vorrichtungen unter `tests/m5-…`, die HTTP-Prüfung zieht
 * `services/app/src/build-app`, und `vitest.config.ts` zieht `tests/tor-inventar/browser-gruppe`.
 */
const ORDNER = ["services", "apps", "tests"] as const;

/** Die Wurzeldateien, ohne die Vitest die Kopie nicht als Projekt erkennt. */
const DATEIEN = ["package.json", "package-lock.json", "tsconfig.json", "vitest.config.ts"] as const;

/**
 * Nie mitkopiert: Abhängigkeiten (sie werden verlinkt, s. unten), Git und alles Erzeugte. Ein
 * `apps/web/node_modules` entsteht im Cloud-Prüfplatz durch `npm ci --prefix apps/web` und wäre
 * hunderte Megabyte — es wird deshalb ebenfalls verlinkt und nicht kopiert.
 */
const NICHT_KOPIEREN = new Set(["node_modules", ".git", "coverage", ".local"]);

/** Die Orte, an denen ein `node_modules` liegen kann und dann in die Kopie verlinkt wird. */
const VERLINKTE_ABHAENGIGKEITEN = ["", "apps/web"] as const;

/**
 * Diese Datei darf in der Kopie NICHT liegen.
 *
 * Sonst könnte ein Lauf in der Kopie sie einsammeln und seinerseits Kopien bauen — eine Schachtel
 * in der Schachtel. Sie wird deshalb nach dem Kopieren entfernt, nicht bloss nicht aufgerufen.
 */
const NICHT_IN_DER_KOPIE = "tests/produktionsabhaengigkeiten/produktmutationen.test.ts";

/** Legt die Kopie an und gibt ihre Wurzel zurück. Der Aufrufer räumt sie mit `rmSync` weg. */
export function baueProduktkopie(quelle: string): string {
  const ziel = mkdtempSync(join(tmpdir(), "kw-4272-produktkopie-"));
  for (const ordner of ORDNER) {
    cpSync(join(quelle, ordner), join(ziel, ordner), {
      recursive: true,
      filter: (pfad) => !pfad.split(sep).some((teil) => NICHT_KOPIEREN.has(teil)),
    });
  }
  for (const datei of DATEIEN) {
    cpSync(join(quelle, datei), join(ziel, datei));
  }
  for (const ort of VERLINKTE_ABHAENGIGKEITEN) {
    const quellPfad = ort ? join(quelle, ort, "node_modules") : join(quelle, "node_modules");
    if (!existsSync(quellPfad)) {
      continue;
    }
    const zielPfad = ort ? join(ziel, ort, "node_modules") : join(ziel, "node_modules");
    mkdirSync(dirname(zielPfad), { recursive: true });
    symlinkSync(quellPfad, zielPfad, "dir");
  }
  // Vitest legt seinen Ergebniscache unter `.local/run/vite-cache` ab (`vitest.config.ts`). In der
  // Kopie ist das ein eigener, wirklich beschreibbarer Ordner — nicht der des Arbeitsbaums.
  mkdirSync(join(ziel, ".local", "run"), { recursive: true });
  rmSync(join(ziel, NICHT_IN_DER_KOPIE), { force: true });
  return ziel;
}

/** Der Text einer Datei der Kopie. */
export function lies(wurzel: string, rel: string): string {
  return readFileSync(join(wurzel, rel), "utf8");
}

/**
 * Verstellt GENAU EINE Stelle im Produktcode der Kopie und gibt den Originaltext zurück.
 *
 * Kommt `ersetze` nicht genau einmal vor, wirft diese Funktion. Das ist Absicht: eine Verstellung,
 * die gar nicht oder mehrfach greift, belegt nichts, und ein danach roter Lauf hätte einen anderen
 * Grund als den behaupteten.
 */
export function verstelle(wurzel: string, rel: string, ersetze: string, durch: string): string {
  const vorher = lies(wurzel, rel);
  const treffer = vorher.split(ersetze).length - 1;
  if (treffer !== 1) {
    throw new Error(
      `Die Verstellung greift ${treffer}× statt genau einmal in ${rel} — die Vorlage passt nicht mehr zum Produktcode: ${ersetze.slice(0, 120)}`,
    );
  }
  writeFileSync(join(wurzel, rel), vorher.replace(ersetze, durch), "utf8");
  return vorher;
}

/** Nimmt die Verstellung zurück. `true` heisst: die Datei ist wieder zeichengleich das Original. */
export function zurueckgenommen(wurzel: string, rel: string, original: string): boolean {
  writeFileSync(join(wurzel, rel), original, "utf8");
  return lies(wurzel, rel) === original;
}

/** Umgebungswerte des äusseren Laufs, die den inneren nicht erreichen dürfen. */
const NICHT_VERERBEN = new Set(["KLARWERK_TESTGRUPPE", "NODE_V8_COVERAGE"]);

const fordere = createRequire(import.meta.url);

/** Die Startdatei von Vitest — aus dem Paket gelesen, nicht geraten. */
function vitestStartdatei(): string {
  const pfad = fordere.resolve("vitest/package.json");
  const paket = JSON.parse(readFileSync(pfad, "utf8")) as {
    bin?: string | Record<string, string>;
  };
  const bin = typeof paket.bin === "string" ? paket.bin : paket.bin?.vitest;
  if (!bin) {
    throw new Error(
      "vitest/package.json nennt keine Startdatei (bin) — der Lauf ist nicht möglich",
    );
  }
  return join(dirname(pfad), bin);
}

export interface Laufergebnis {
  readonly code: number | null;
  readonly ausgabe: string;
}

/**
 * Fährt eine Testdatei IN DER KOPIE und gibt Exit-Code und die vollständige Ausgabe zurück.
 *
 * stdout UND stderr werden zusammengeführt (REGELN Abschnitt 7): ein Abbruch vor den fachlichen
 * Fällen steht oft nur auf stderr, und ein Lauf, der gar nicht angefangen hat, darf nicht wie ein
 * roter Fall aussehen. `code === null` heisst: abgebrochen (Zeitgrenze oder Signal).
 */
export function fahreTest(wurzel: string, testpfad: string): Laufergebnis {
  const umgebung: Record<string, string> = {};
  for (const [name, wert] of Object.entries(process.env)) {
    // Die VITEST_*-Werte des ÄUSSEREN Laufs (Arbeiterkennung, Pool) dürfen den inneren nicht
    // erreichen — er ist ein eigener Lauf und kein Arbeiter dieses hier. `KLARWERK_TESTGRUPPE`
    // und `NODE_V8_COVERAGE` bleiben ebenfalls draussen: die Gruppenwahl und die Abdeckungsspur
    // des äusseren Laufs haben in einer Messung des inneren nichts zu suchen.
    if (wert === undefined || name.startsWith("VITEST") || NICHT_VERERBEN.has(name)) {
      continue;
    }
    umgebung[name] = wert;
  }
  umgebung.KLARWERK_SKIP_KEYCHAIN = "1";
  umgebung.CI = "1";
  const lauf = spawnSync(
    process.execPath,
    [
      vitestStartdatei(),
      "run",
      "--pool=forks",
      "--poolOptions.forks.maxForks=1",
      "--poolOptions.forks.minForks=1",
      testpfad,
    ],
    {
      cwd: wurzel,
      env: umgebung,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      timeout: 300_000,
    },
  );
  return { code: lauf.status, ausgabe: `${lauf.stdout ?? ""}\n${lauf.stderr ?? ""}` };
}

/**
 * Die Farbfolgen aus einer Laufausgabe nehmen.
 *
 * GEMESSEN UND NICHT VERMUTET (Cloud-Lauf `80b05aaf95b0d300a21e179e`): Vitest schreibt auch in
 * einer Rohr-Umleitung ANSI-Folgen. `„Test Files 7 passed"` steht dort als
 * `\e[2m Test Files \e[22m \e[1m\e[32m7 passed…` — eine Suche nach dem Zeilenanfang fand deshalb
 * NICHTS, und die Zusammenfassung der Läufe blieb leer. Ohne sie stünde in der Rundenakte ein
 * Exit-Code ohne die Zahl der Fälle dahinter.
 *
 * Der Steuerzeichen-Beginn wird aus seinem Code gebaut und nicht als Literal geschrieben: ein
 * Steuerzeichen im Muster selbst wäre in dieser Quelle unlesbar (und Biome verbietet es zu Recht).
 */
const FARBFOLGE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

export function ohneFarbe(text: string): string {
  return text.replace(FARBFOLGE, "");
}

/** Die Zeilen einer Laufausgabe, die einen Text enthalten — der Beleg für die Rundenakte. */
export function belegzeilen(ausgabe: string, text: string, hoechstens = 2): string[] {
  return ohneFarbe(ausgabe)
    .split("\n")
    .map((zeile) => zeile.trim())
    .filter((zeile) => zeile.includes(text))
    .slice(0, hoechstens);
}

/** Die Zusammenzeilen von Vitest („Test Files 1 failed", „Tests 2 failed | 1 passed"). */
export function zusammenzeilen(ausgabe: string): string[] {
  return ohneFarbe(ausgabe)
    .split("\n")
    .map((zeile) => zeile.replace(/\s+/g, " ").trim())
    .filter((zeile) => /^(Test Files|Tests) \d/.test(zeile));
}
