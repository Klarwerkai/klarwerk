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
// `tests/i18n-woerterbuch/i18n-vor-aufteilung.txt`. Seit der Integration von `main` (Nacharbeit 3)
// ist das die Datei des integrierten Hauptstands `a2ff8da8` — dieselbe Datei samt der dort
// hinzugekommenen Schlüssel und des R-0801-Nachladens (nachprüfbar ohne Test mit
// `git hash-object` gegen `git rev-parse a2ff8da8:apps/web/src/i18n.ts`, Blob `42ab6f8b…`). Seit
// Nacharbeit 5 ist es die Datei von `main` 1147c026 (Blob `1dbd6f42…`, dazu R-0247).
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

/**
 * Der eine Kommentarabsatz, den die Aufteilung in `i18n.ts` umformulieren MUSSTE: R-0801 (Nachladen
 * von en/nl, integriert aus `main` a2ff8da8) beschrieb die drei Blöcke als „oben, wo sie sind". Nach
 * der Aufteilung wäre der Satz falsch; das Zusammenfügen setzt den früheren Wortlaut wieder ein.
 * Nur Kommentarzeilen, kein Code — und fail-closed wie jede andere Ersetzung hier.
 */
export const R0801_ABSATZ_JETZT = [
  "// Die drei Wörterbücher stehen je Sprache in `woerterbuch/` (I18N-AUFTEILUNG) und werden oben",
  "// statisch importiert. Getrennt wird erst im PRODUKTIONSBAU: das Plugin `sprachpaketeNachladen`",
  "// (`texte/intern/sprachpakete.ts`) nimmt die Importe von `en` und `nl` aus dieser Datei heraus,",
  "// liefert ihre Blöcke als eigene Stücke, ersetzt `{ en, nl }` in `VORLIEGEND` durch `{}` und trägt",
  "// in `NACHLADEN` je Sprache ein `import()` ein. Es bricht den Bau ab, wenn es einen seiner Anker",
  "// nicht genau einmal findet — sonst lägen beide Sprachen still wieder im Eintritt.",
  "",
].join("\n");
const R0801_ABSATZ_VORHER = [
  "// Die drei Blöcke oben bleiben, wo sie sind: diese Datei ist die eine Quelle aller Texte, und",
  "// zahlreiche Wächter lesen sie als Text. Getrennt wird erst im PRODUKTIONSBAU: das Plugin",
  "// `sprachpaketeNachladen` (`texte/intern/sprachpakete.ts`) schneidet die Blöcke `en` und `nl` als",
  "// eigene Stücke heraus, ersetzt `{ en, nl }` in `VORLIEGEND` durch `{}` und trägt in `NACHLADEN`",
  "// je Sprache ein `import()` ein. Es greift NUR auf die zwei Zeilen unten und bricht den Bau ab, wenn",
  "// es eine davon nicht genau einmal findet — sonst lägen beide Sprachen still wieder im Eintritt.",
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
      `${woerterbuchRelativ(sprache)}: Vorspann oder Nachspann weicht ab — die Datei ist nicht mehr der reine verschobene Block`,
    );
  }
  return datei.slice(vor.length, datei.length - nach.length);
}

// ================================================================================================
// NACH DER AUFTEILUNG ERLAUBT ERGÄNZT — Aufnahme 20260922 · antwort-quellenanzeige (Ben zu e6eb2409).
// ================================================================================================
// Der Umzugsnachweis (W1) gilt dem Text, der VOR der Aufteilung stand. Neue Produkttexte, die ein
// späterer Auftrag ausdrücklich ergänzt, gehören nicht zu diesem historischen Umfang. Sie stehen hier
// BENANNT — Schlüssel und die Kommentarzeilen, die sie begründen —, und NUR der historische
// Vergleich (`woerterbuchQuelleHistorisch`, W1) nimmt GENAU diese Zeilen heraus; der volle Text für
// alle anderen Leser bleibt unberührt. Fail-closed wie `einmal`: steht ein Eintrag nicht genau einmal
// da, bricht es ab; eine stille Toleranz für irgendwelche neuen Zeilen gibt es nicht. Was W1 danach
// noch meldet, stammt NICHT aus diesen Ergänzungen. Gegenprobe: `tests/i18n-woerterbuch/
// ergaenzungen-antwort-quellenanzeige.test.ts`.
export const ERGAENZTE_SCHLUESSEL: readonly string[] = [
  // R-0326: die Lage der Belegstelle an der Lesefläche (BibliothekLesen).
  "lib.lesen.belegstelle.markiert",
  "lib.lesen.belegstelle.nichtGefunden",
  "lib.lesen.belegstelle.andereFassung",
  // R-0310: der Chip „+N" unter der Web-Antwort (Ask.tsx).
  "ask.quellen.weitere",
  // R-0310/R-0325: die zurückgehaltene Antwort bei unbekannter Zuordnung (Ask.tsx).
  "ask.zuordnungUnbekannt",
];

export const ERGAENZTE_KOMMENTARE: Readonly<Record<WoerterbuchSprache, readonly string[]>> = {
  de: [
    "  // R-0310/R-0325 (Ben zu 8e6c9d73): die Antwort ist zurückgehalten, weil sich kein Absatz einer",
    "  // Quelle zuordnen ließ. Zuordnung unbekannt macht einen unbelegten Absatz nicht ausgabefähig.",
    '  // R-0310: der Chip „+N" unter der Antwort — sein zugänglicher Name.',
  ],
  en: [
    "  // R-0310/R-0325: the answer is withheld because no paragraph could be attributed to a source.",
  ],
  nl: [
    "  // R-0310/R-0325: het antwoord wordt achtergehouden omdat geen alinea aan een bron toe te wijzen was.",
  ],
};

/** Der Block einer Sprache OHNE die benannten Ergänzungen — fail-closed (je Eintrag genau einmal). */
export function ohneErgaenzungen(sprache: WoerterbuchSprache, block: string): string {
  const zeilen = block.split("\n");
  const raus = new Set<number>();
  const genauEinmal = (treffer: number[], was: string): number => {
    if (treffer.length !== 1) {
      throw new Error(
        `${woerterbuchRelativ(sprache)}: ${was} steht ${treffer.length}-mal da, erwartet genau einmal`,
      );
    }
    return treffer[0] as number;
  };
  for (const kommentar of ERGAENZTE_KOMMENTARE[sprache]) {
    const treffer = zeilen.flatMap((z, i) => (z === kommentar ? [i] : []));
    raus.add(genauEinmal(treffer, `der Kommentar „${kommentar.trim()}"`));
  }
  for (const schluessel of ERGAENZTE_SCHLUESSEL) {
    const kopf = `  "${schluessel}":`;
    const treffer = zeilen.flatMap((z, i) => (z.startsWith(kopf) ? [i] : []));
    const i = genauEinmal(treffer, `der Schlüssel ${schluessel}`);
    raus.add(i);
    // Steht der Wert auf der Folgezeile (`"schluessel":` am Zeilenende), gehört sie dazu.
    if ((zeilen[i] ?? "").trimEnd() === kopf) {
      raus.add(i + 1);
    }
  }
  return zeilen.filter((_, i) => !raus.has(i)).join("\n");
}

/**
 * Der Umzugsnachweis in seinem HISTORISCHEN Umfang: wie `fuegeWoerterbuchZusammen`, aber ohne die
 * oben benannten, nach der Aufteilung erlaubt ergänzten Zeilen. NUR für W1 — alle übrigen Leser
 * (`woerterbuchQuelle()`, über 30 Prüfungen auf Schlüssel und Texte) sehen weiter den VOLLEN Text.
 */
export function fuegeWoerterbuchZusammenHistorisch(teile: WoerterbuchTeile): string {
  return fuegeWoerterbuchZusammen({
    ...teile,
    de: ohneErgaenzungenDatei("de", teile.de),
    en: ohneErgaenzungenDatei("en", teile.en),
    nl: ohneErgaenzungenDatei("nl", teile.nl),
  });
}

/** Der historische Vergleichstext aus dem Baum — `woerterbuchQuelle()` ohne die benannten Ergänzungen. */
export function woerterbuchQuelleHistorisch(): string {
  return fuegeWoerterbuchZusammenHistorisch(woerterbuchTeile());
}

/** Eine ganze Sprachdatei ohne die Ergänzungen — Vor- und Nachspann bleiben, wie sie sind. */
function ohneErgaenzungenDatei(sprache: WoerterbuchSprache, datei: string): string {
  const block = woerterbuchBlock(sprache, datei);
  return `${woerterbuchVorspann(sprache)}${ohneErgaenzungen(sprache, block)}${woerterbuchNachspann(sprache)}`;
}

/** Die Umkehrung der Aufteilung: der Text von `i18n.ts`, wie er vorher war. */
export function fuegeWoerterbuchZusammen(teile: WoerterbuchTeile): string {
  const bloecke = WOERTERBUCH_SPRACHEN.map((sprache) => woerterbuchBlock(sprache, teile[sprache]));
  let text = einmal(teile.i18n, KOPF_ANKER, `${KOPF_ANKER}${KOPF_VORHER}`, I18N_RELATIV);
  text = einmal(text, WOERTERBUCH_IMPORTE, "", I18N_RELATIV);
  text = einmal(text, R0801_ABSATZ_JETZT, R0801_ABSATZ_VORHER, I18N_RELATIV);
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
