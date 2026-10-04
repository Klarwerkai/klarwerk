// ================================================================================================
// I18N-AUFTEILUNG (Aufnahme 20260922 · zentrale-module-aufteilen) — DAS WÖRTERBUCH IN VIER DATEIEN.
// ================================================================================================
//
// Bis zur Aufteilung trug `apps/web/src/i18n.ts` die drei Grundwörterbücher selbst (18.928 Zeilen).
// Jetzt stehen sie je Sprache in `apps/web/src/woerterbuch/{de,en,nl}.ts`, und `i18n.ts` importiert
// sie nur noch. Die Aufteilung ist eine REINE TEXTOPERATION: jeder Block ist Zeile für Zeile
// verschoben, kein Schlüssel und kein Wert ist angefasst.
//
// Diese Datei ist ihr Gegenstück. Sie fügt die vier Dateien wieder zu GENAU dem Text zusammen, der
// vorher in `i18n.ts` stand. Dass es wirklich derselbe ist, misst
// `tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts` gegen die unveränderte Kopie
// `tests/i18n-woerterbuch/i18n-vor-aufteilung.txt` (nachprüfbar ohne Test mit
// `git hash-object` gegen `git rev-parse 69ac08a3:apps/web/src/i18n.ts`).
//
// WOZU DAS ZUSAMMENFÜGEN: rund fünfzig bestehende Prüfstände lesen das Wörterbuch als TEXT (sie
// suchen Schlüssel, Wortlaute und Verbote quer über alle drei Sprachen). Sie lesen ab hier
// `woerterbuchQuelle()` statt der Datei und sehen damit unverändert, was sie vorher sahen. Was das
// laufende i18next daraus macht, ist davon unberührt — es bekommt dieselben drei Objekte.
//
// JEDE ERSETZUNG IST FAIL-CLOSED: steht ein Anker nicht genau einmal da, bricht es mit Klartext ab,
// statt still einen anderen Text zu liefern.
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { repoPfad } from "./repoPfad";

export const I18N_RELATIV = "apps/web/src/i18n.ts";

export const WOERTERBUCH_SPRACHEN = ["de", "en", "nl"] as const;
export type WoerterbuchSprache = (typeof WOERTERBUCH_SPRACHEN)[number];

export function woerterbuchRelativ(sprache: WoerterbuchSprache): string {
  return `apps/web/src/woerterbuch/${sprache}.ts`;
}

/** Was in `i18n.ts` vor der Aufteilung zwischen `htmlLang`- und `sprachwahl`-Import stand. */
const KOPF_ANKER = 'import { sprachAusEintritt } from "./lib/htmlLang";\n';
const KOPF_VORHER = [
  "// JOB 3326 R4: die Texte der Lesevariante wohnen bei ihrer Funktion, damit diese Woerterbuchdatei",
  "// unter dem 1-MiB-Deckel von Biome bleibt. Messung und Begruendung: `lib/lesevariante.ts`.",
  'import { lesevarianteTexteDe, lesevarianteTexteEn, lesevarianteTexteNl } from "./lib/lesevariante";',
  "",
].join("\n");

/** Die drei Importe, die die Aufteilung in `i18n.ts` gesetzt hat. */
export const WOERTERBUCH_IMPORTE = [
  'import { de } from "./woerterbuch/de";',
  'import { en } from "./woerterbuch/en";',
  'import { nl } from "./woerterbuch/nl";',
  "",
].join("\n");

/** Der Hinweis, der in `i18n.ts` an der Stelle der drei Blöcke steht (samt folgender Leerzeile). */
export const WOERTERBUCH_MARKE = [
  "// I18N-AUFTEILUNG (Aufnahme 20260922): die drei Grundwörterbücher wohnen je Sprache in",
  "// `woerterbuch/de.ts`, `woerterbuch/en.ts` und `woerterbuch/nl.ts` — Zeile für Zeile verschoben,",
  "// kein Schlüssel und kein Wert geändert. Neue Texte kommen in ein Textmodul (`texte/`).",
  "",
  "",
].join("\n");

const GROSS: Record<WoerterbuchSprache, string> = { de: "De", en: "En", nl: "Nl" };

/** Der Vorspann einer Sprachdatei — alles vor `const <sprache>…`. */
export function woerterbuchVorspann(sprache: WoerterbuchSprache): string {
  return [
    `// GRUNDWÖRTERBUCH \`${sprache}\` — I18N-AUFTEILUNG (Aufnahme 20260922, zentrale-module-aufteilen).`,
    "//",
    "// Dieser Block stand bis zur Aufteilung in `apps/web/src/i18n.ts`. Er ist Zeile für Zeile hierher",
    "// verschoben; kein Schlüssel und kein Wert ist geändert (Beleg:",
    "// `tests/i18n-woerterbuch/aufteilung-unveraendert.test.ts`). Neue Texte gehören in ein Textmodul",
    "// unter `apps/web/src/texte/` (docs/i18n-textmodule.md), nicht hierher.",
    `import { lesevarianteTexte${GROSS[sprache]} } from "../lib/lesevariante";`,
    ...(sprache === "de" ? [] : ['import type { de } from "./de";']),
    "",
    "",
  ].join("\n");
}

/** Der Nachspann einer Sprachdatei — alles nach dem schließenden `};` des Blocks. */
export function woerterbuchNachspann(sprache: WoerterbuchSprache): string {
  return `\nexport { ${sprache} };\n`;
}

export interface WoerterbuchTeile {
  i18n: string;
  de: string;
  en: string;
  nl: string;
}

/** Die vier Dateien, wie sie im Baum liegen. */
export function woerterbuchTeile(): WoerterbuchTeile {
  return {
    i18n: readFileSync(repoPfad(I18N_RELATIV), "utf8"),
    de: readFileSync(repoPfad(woerterbuchRelativ("de")), "utf8"),
    en: readFileSync(repoPfad(woerterbuchRelativ("en")), "utf8"),
    nl: readFileSync(repoPfad(woerterbuchRelativ("nl")), "utf8"),
  };
}

function einmal(text: string, anker: string, ersatz: string, wo: string): string {
  const teile = text.split(anker);
  if (teile.length !== 2) {
    throw new Error(`${wo}: der Anker steht ${teile.length - 1}-mal da, erwartet genau einmal`);
  }
  return `${teile[0]}${ersatz}${teile[1]}`;
}

/** Der verschobene Block einer Sprachdatei — fail-closed gegen Vor- und Nachspann. */
export function woerterbuchBlock(sprache: WoerterbuchSprache, datei: string): string {
  const vor = woerterbuchVorspann(sprache);
  const nach = woerterbuchNachspann(sprache);
  if (!datei.startsWith(vor) || !datei.endsWith(nach)) {
    throw new Error(
      `${woerterbuchRelativ(sprache)}: Vor- oder Nachspann weicht ab — die Datei ist nicht mehr der reine verschobene Block`,
    );
  }
  return datei.slice(vor.length, datei.length - nach.length);
}

/** Die Umkehrung der Aufteilung: der Text von `i18n.ts`, wie er vorher war. */
export function fuegeWoerterbuchZusammen(teile: WoerterbuchTeile): string {
  const bloecke = WOERTERBUCH_SPRACHEN.map((sprache) => woerterbuchBlock(sprache, teile[sprache]));
  let text = einmal(teile.i18n, KOPF_ANKER, `${KOPF_ANKER}${KOPF_VORHER}`, I18N_RELATIV);
  text = einmal(text, WOERTERBUCH_IMPORTE, "", I18N_RELATIV);
  return einmal(text, WOERTERBUCH_MARKE, `${bloecke.join("\n")}\n`, I18N_RELATIV);
}

/** Das Wörterbuch als EIN Text — genau der frühere Inhalt von `apps/web/src/i18n.ts`. */
export function woerterbuchQuelle(): string {
  return fuegeWoerterbuchZusammen(woerterbuchTeile());
}

/**
 * Wie `woerterbuchQuelle()`, für Prüfstände, die den Pfad als eigene Konstante führen (relativ
 * zum Startverzeichnis, zur Testdatei oder absolut). Der Pfad muss auf `apps/web/src/i18n.ts`
 * zeigen — sonst ist es ein Testfehler, kein stiller Rückfall auf eine andere Datei.
 */
export function woerterbuchQuelleAus(pfad: string): string {
  const ende = I18N_RELATIV.split("/").join(sep);
  if (!resolve(pfad).endsWith(ende)) {
    throw new Error(`woerterbuchQuelleAus: ${pfad} ist nicht ${I18N_RELATIV}`);
  }
  return woerterbuchQuelle();
}
