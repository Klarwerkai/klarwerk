// ================================================================================================
// JOB 4367 · DER VORHER-SCHNAPPSCHUSS DES SPRACHBESTANDS — erzeugt, nicht abgeschrieben.
// ================================================================================================
//
// WOZU. Dieser Auftrag verschiebt Texte aus `apps/web/src/i18n.ts` in Module unter
// `apps/web/src/texte/`. Die Zusage K1 lautet: der Umzug verliert keinen Schlüssel und ändert
// keinen Text. Eine solche Zusage ist nur so viel wert wie ihr Bezugspunkt — und der darf nicht aus
// dem gemessenen Baum stammen. Dieses Werkzeug holt ihn deshalb aus dem `i18n.ts` DES
// BASISSTANDS, also aus einer Fassung, die den Sammler noch gar nicht kennt.
//
// AUFRUF (der Lauf steht in der RUECKGABE):
//     node --import tsx/esm tests/i18n-textmodule/bestand-erzeugen.ts <basisstand-sha>
//
// Ergebnis: `werte-vorher.json` — JEDER Schlüssel mit SEINEM WERT, je Sprache — und
// `bestand-vorher.json` (Basisstand, Anzahl und SHA-256 je Sprache) als Kopfzeile dazu.
// `bestand-unveraendert.test.ts` vergleicht Wert für Wert dagegen.
//
// WARUM DIE VOLLEN WERTE UND NICHT NUR EINE PRÜFSUMME (BEN, Runde 2, Korrekturpflicht 1): Eine
// Summe über 4437 Texte sagt „irgendetwas ist anders" und nennt nichts. BENs Gegenprobe hat genau
// das aufgedeckt — er hat den deutschen Wert von `nav.library` verändert, und die gelieferten
// Testfälle blieben grün, weil sie nur sieben Werte fest prüften. Ein Nachweis, der die Mutation
// nicht findet, ist kein Nachweis. Jetzt steht jeder Wert eingecheckt da, der Vergleich nennt
// Schlüssel, Sprache, Soll und Ist, und ein Mensch sieht im Diff, was sich geändert hat.
//
// WARUM ÜBER DAS INITIALISIERTE i18next und nicht über den Quelltext: dieselbe Lehre wie in
// `tests/support/i18nBestand.ts` (JOB 3326 R5). Ein Textschnitt über `const de = { … }` sieht
// gespreadete Blöcke (`...lesevarianteTexteDe`) nicht und wäre genau an der Stelle blind, an der
// dieser Auftrag arbeitet. `getResourceBundle` gibt das ZUSAMMENGESETZTE Wörterbuch zurück.
//
// WARUM EINE KOPIE UNTER `apps/web/src/texte/` UND NICHT NEBEN DIESER DATEI: `i18next` wohnt in
// `apps/web/node_modules`, und Node löst ein Paket von der importierenden Datei aus AUFWÄRTS auf —
// von `tests/` aus wird es nicht gefunden (gemessen: `ERR_MODULE_NOT_FOUND: Cannot find package
// 'i18next'`). Der führende Punkt hält die Kopie aus `texte/*.ts` heraus (Globs nehmen
// Punktdateien nicht mit), und `finally` räumt sie auch bei einem Abbruch wieder weg.
//
// WARUM EIN KINDPROZESS UND KEIN `await import(kopie)`: der Pfad der Kopie entsteht zur Laufzeit,
// und ein Modulimport hinter einem berechneten Pfad ist unter `tests/**` verboten — der Wächter
// `tests/legal/mega61-rechtsseiten.test.tsx` macht ihn rot („Diese Aufrufe sind statisch nicht
// auflösbar — der Wächter kann über sie NICHTS sagen"). Gemessen im Tor der Runde 2, an genau
// dieser Datei. Statisch schreiben lässt sich der Pfad nicht (die Kopie gibt es zur Typprüfzeit
// nicht), und einen Eintrag in dessen Ausnahmeliste wäre eine fremde Datei. Der Kindprozess
// braucht gar keinen Import: die Kopie druckt ihren Bestand selbst, zwischen zwei Marken.
//
// WANN ER NEU GEFAHREN WIRD: nur bei einem Rebase auf einen anderen Basisstand — dann mit dessen
// SHA. NICHT, um einen roten Testfall grün zu bekommen: `bestand-unveraendert.test.ts` wird rot,
// wenn ein Schlüssel VERSCHWINDET oder ein Modul einen unterschiebt, und beides ist ein Befund,
// kein Anlass, den Bezugspunkt nachzuziehen.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SPRACHEN = ["de", "en", "nl"] as const;

const basisstand = process.argv[2];
if (basisstand === undefined || basisstand.length === 0) {
  throw new Error(
    "Basisstand fehlt: node --import tsx/esm tests/i18n-textmodule/bestand-erzeugen.ts <sha>",
  );
}

const hier = dirname(fileURLToPath(import.meta.url));
const wurzel = join(hier, "..", "..");
const kopie = join(wurzel, "apps", "web", "src", "texte", ".basis-i18n.ts");

/** Die Marke, zwischen der die Kopie ihren Bestand druckt — i18next selbst redet auf stdout mit. */
const MARKE = "<<<KLARWERK-BESTAND>>>";

/**
 * Was an die Kopie angehängt wird, damit sie ihren eigenen Bestand ausgibt. `i18n` ist dort in
 * Reichweite: die Datei importiert es oben aus `i18next` und exportiert es unten als Standard.
 */
const DRUCKANHANG = [
  "",
  `const kwBestand = { de: i18n.getResourceBundle("de", "translation"), en: i18n.getResourceBundle("en", "translation"), nl: i18n.getResourceBundle("nl", "translation") };`,
  `process.stdout.write("${MARKE}" + JSON.stringify(kwBestand) + "${MARKE}");`,
  "",
].join("\n");

/**
 * Die kanonische Form eines Sprachbestands: Schlüssel sortiert, Werte wörtlich. Über sie läuft der
 * Hash — Reihenfolgeänderungen (und genau die bringt das Zusammenführen von Modulen mit) sind damit
 * folgenlos, Textänderungen nicht.
 */
function kanonisch(bestand: Record<string, string>, namen: readonly string[]): string {
  return JSON.stringify(namen.map((schluessel) => [schluessel, bestand[schluessel]]));
}

const roh = execFileSync("git", ["show", `${basisstand}:apps/web/src/i18n.ts`], {
  cwd: wurzel,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});

const sprachen: Record<string, { anzahl: number; sha256: string }> = {};
let schluessel: string[] | undefined;
let gedruckt: string;

try {
  writeFileSync(kopie, `${roh.replaceAll('from "./lib/', 'from "../lib/')}${DRUCKANHANG}`, "utf8");
  gedruckt = execFileSync(process.execPath, ["--import", "tsx/esm", kopie], {
    cwd: wurzel,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
} finally {
  rmSync(kopie, { force: true });
}

const teile = gedruckt.split(MARKE);
if (teile.length !== 3 || teile[1] === undefined) {
  throw new Error(
    `Die Kopie des Basisstands hat ihren Bestand nicht zwischen den Marken gedruckt. Ausgabe:\n${gedruckt}`,
  );
}
const bestaende = JSON.parse(teile[1]) as Record<string, Record<string, string> | undefined>;

/** Schlüssel sortiert — damit der eingecheckte Abzug diffbar ist und nicht an der Reihenfolge hängt. */
const werte: Record<string, Record<string, string>> = {};

for (const sprache of SPRACHEN) {
  const bestand = bestaende[sprache];
  if (!bestand || Object.keys(bestand).length === 0) {
    throw new Error(`Sprachbestand fehlt oder ist leer: ${sprache}`);
  }
  const namen = Object.keys(bestand).sort();
  if (schluessel === undefined) {
    schluessel = namen;
  } else if (JSON.stringify(namen) !== JSON.stringify(schluessel)) {
    throw new Error(`Schlüsselmenge von ${sprache} weicht von de ab — Schnappschuss unbrauchbar.`);
  }
  const sortiert: Record<string, string> = {};
  for (const name of namen) {
    const wert = bestand[name];
    if (typeof wert !== "string") {
      throw new Error(`Wert von "${name}" (${sprache}) ist keine Zeichenkette.`);
    }
    sortiert[name] = wert;
  }
  werte[sprache] = sortiert;
  sprachen[sprache] = {
    anzahl: namen.length,
    sha256: createHash("sha256").update(kanonisch(bestand, namen), "utf8").digest("hex"),
  };
}

if (schluessel === undefined) {
  throw new Error("kein Sprachbestand gelesen");
}

writeFileSync(join(hier, "werte-vorher.json"), `${JSON.stringify(werte, null, 2)}\n`, "utf8");
writeFileSync(
  join(hier, "bestand-vorher.json"),
  `${JSON.stringify({ basisstand, sprachen }, null, 2)}\n`,
  "utf8",
);

process.stdout.write(
  `Basisstand ${basisstand}: ${schluessel.length} Schlüssel je Sprache\n${JSON.stringify(sprachen, null, 2)}\n`,
);
