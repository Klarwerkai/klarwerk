// ================================================================================================
// JOB 4367 · DER VERTRAG DER TEXTMODULE — eine Prüfung, drei Aufrufer.
// ================================================================================================
//
// WOZU ES DIESE DATEI GIBT. `apps/web/src/i18n.ts` war eine Datei mit 18.706 Zeilen, in die JEDER
// Nutzerweg seine Texte schrieb. Zwei Bahnen, die gleichzeitig an zwei verschiedenen Funktionen
// bauen, änderten damit dieselbe Datei — und sperrten sich gegenseitig. Seit diesem Auftrag wohnen
// Texte bei ihrer Funktion: eine Datei je Nutzerweg unter `apps/web/src/texte/`, eingesammelt von
// `i18n.ts` über `import.meta.glob`. Das Muster ist nicht neu, nur verallgemeinert — es stammt aus
// `apps/web/src/lib/lesevariante.ts` (JOB 3326 R4), das unverändert eingebunden bleibt.
//
// WAS EIN AUTOMATISCHER SAMMLER GEFÄHRLICH MACHT, und warum diese Datei die Antwort darauf ist:
// Ein `glob` frisst, was da liegt. Zwei Module, die denselben Schlüssel tragen, überschreiben sich
// dann still — der zuletzt eingesammelte gewinnt, und welcher das ist, entscheidet die alphabetische
// Reihenfolge der Dateinamen. Ein Modul, dem die niederländische Fassung fehlt, fiele lautlos auf
// Deutsch zurück (i18next `fallbackLng: "de"`), und ein Mensch sähe einen deutschen Satz in einer
// niederländischen Oberfläche. Beides sind Fehler, die niemand bemerkt, bis ein Kunde sie sieht.
//
// DESHALB IST DER SAMMLER GEPRÜFT, und zwar an DREI Stellen mit DERSELBEN Funktion:
//   1. `tests/i18n-textmodule/` — Vitest, im Tor.
//   2. `apps/web/vite.config.ts` — ein Plugin (`apply: "build"`), das den Produktbuild rot macht.
//   3. `apps/web/src/i18n.ts` selbst — beim Start der Anwendung.
// Die dritte allein genügt NICHT: sie meldet den Fehler erst im Browser, also nach dem Ausliefern.
// Sie steht trotzdem da, weil ein stilles Überschreiben schlimmer ist als ein lauter Abbruch.
//
// DIESE DATEI IST BEWUSST REIN: keine Dateisystemzugriffe, keine Vite-Abhängigkeit. Nur so kann
// sie sowohl im Anwendungsbündel (Browser) als auch im Bauwerkzeug (Node) laufen. Was Dateien
// liest, steht in `./sammeln.ts` und wird nie vom Browser angefasst.

/**
 * Die PFLICHTSPRACHEN der Oberfläche (R-0960/R-0983: vollständig in DE, EN und NL). Sie sind die
 * Untergrenze, nicht die Obergrenze: R-0997 / FR-I18N-02 („neue Sprache ohne Code-Umbau
 * ergänzbar") — jede WEITERE Sprache meldet sich über ihre Ressource an (`woerterbuch/<kürzel>.ts`,
 * siehe `sprachenAusRessourcen`). Die Regel für `<html lang>` (JOB 536, genau de|en|nl) ist davon
 * getrennt und steht unverändert in `lib/htmlLang.ts`.
 */
export const SPRACHEN = ["de", "en", "nl"] as const;

export type Sprache = (typeof SPRACHEN)[number];

/** Die Basissprache: Grundbestand, Rückfall (`fallbackLng`) und Bezug jedes weiteren Wörterbuchs. */
export const BASISSPRACHE = "de";

/** Ein Ressourcenname, der eine Sprache anmeldet: zwei Kleinbuchstaben (`fr.ts`, `it.ts`). */
const SPRACHKUERZEL = /^[a-z]{2}$/;

/** Die Sprache, die eine Ressource (`…/woerterbuch/fr.ts`) anmeldet — oder `null`. */
export function spracheAusPfad(pfad: string): string | null {
  const letzte = pfad.split("/").pop() ?? pfad;
  if (!letzte.endsWith(".ts")) {
    return null;
  }
  const name = letzte.slice(0, -".ts".length);
  return SPRACHKUERZEL.test(name) ? name : null;
}

/**
 * R-0997 · DIE SPRACHREGISTRIERUNG AUS DEN RESSOURCEN. Aus den Dateinamen der Grundwörterbücher
 * wird die Menge der Oberflächensprachen abgeleitet: die Pflichtsprachen in fester Reihenfolge, dann
 * jede weitere angemeldete Sprache alphabetisch. Wer eine Sprache ergänzt, legt Ressourcen an — er
 * ändert keine Liste im Programm.
 */
export function sprachenAusRessourcen(pfade: readonly string[]): string[] {
  const pflicht: readonly string[] = SPRACHEN;
  const weitere = new Set<string>();
  for (const pfad of pfade) {
    const sprache = spracheAusPfad(pfad);
    if (sprache !== null && !pflicht.includes(sprache)) {
      weitere.add(sprache);
    }
  }
  return [...pflicht, ...[...weitere].sort()];
}

/**
 * Ein Textmodul — die Texte EINER Funktion in DE/EN/NL.
 *
 * `praefix` ist der Namensraum der Datei und muss zum Dateinamen passen (`ux08.ts` → `"ux08."`).
 * Jeder NEUE Schlüssel trägt ihn; damit kann kein zweites Modul denselben Schlüssel erfinden.
 *
 * `legacySchluessel` ist die Ausnahmeliste für Schlüssel, die es schon VOR dem Umzug gab und deren
 * Namen nicht geändert werden dürfen (sie stehen in Tests, in `services/`, in Playwright-Spuren).
 * Sie ist ausdrücklich eine Liste und kein Schalter: wer einen Altnamen mitnimmt, schreibt ihn hin.
 */
export interface Textmodul {
  readonly praefix: string;
  readonly legacySchluessel: readonly string[];
  readonly de: Readonly<Record<string, string>>;
  readonly en: Readonly<Record<string, string>>;
  readonly nl: Readonly<Record<string, string>>;
  /** R-0997: der Block jeder weiteren, über `woerterbuch/` angemeldeten Sprache (`fr: {…}`). */
  readonly [sprache: string]: Readonly<Record<string, string>> | string | readonly string[];
}

/** Der Textblock einer Sprache — leer, wenn das Modul ihn nicht führt. */
function block(modul: Textmodul, sprache: string): Readonly<Record<string, string>> {
  const wert = (modul as unknown as Record<string, unknown>)[sprache];
  return istRecordAusZeichenketten(wert) ? wert : {};
}

/** Der Dateiname ohne Pfad und ohne Endung — daraus leitet sich das Pflicht-Präfix ab. */
export function modulname(pfad: string): string {
  const letzte = pfad.split("/").pop() ?? pfad;
  return letzte.replace(/\.ts$/, "");
}

function istRecordAusZeichenketten(wert: unknown): wert is Record<string, string> {
  if (typeof wert !== "object" || wert === null || Array.isArray(wert)) {
    return false;
  }
  return Object.values(wert as Record<string, unknown>).every(
    (eintrag) => typeof eintrag === "string",
  );
}

/**
 * Prüft die Grundform eines eingesammelten Moduls. Gibt die Befunde zurück; eine leere Liste heisst
 * „die Form trägt" und erst dann lohnt sich die inhaltliche Prüfung.
 */
function pruefeForm(pfad: string, roh: unknown, sprachen: readonly string[]): string[] {
  const fehler: string[] = [];
  if (typeof roh !== "object" || roh === null) {
    return [
      `${pfad}: kein Textmodul — erwartet wird ein Standardexport { praefix, legacySchluessel, de, en, nl }.`,
    ];
  }
  const modul = roh as Partial<Record<keyof Textmodul, unknown>>;
  const erwartetesPraefix = `${modulname(pfad)}.`;
  if (typeof modul.praefix !== "string" || modul.praefix.length === 0) {
    fehler.push(`${pfad}: kein praefix — jedes Textmodul muss "${erwartetesPraefix}" setzen.`);
  } else if (modul.praefix !== erwartetesPraefix) {
    fehler.push(
      `${pfad}: praefix "${modul.praefix}" passt nicht zum Dateinamen — erwartet "${erwartetesPraefix}".`,
    );
  }
  if (!Array.isArray(modul.legacySchluessel)) {
    fehler.push(`${pfad}: legacySchluessel fehlt — leere Liste [] schreiben, wenn es keine gibt.`);
  } else if (modul.legacySchluessel.some((eintrag) => typeof eintrag !== "string")) {
    fehler.push(`${pfad}: legacySchluessel enthält einen Eintrag, der keine Zeichenkette ist.`);
  }
  for (const sprache of sprachen) {
    if (!istRecordAusZeichenketten((roh as Record<string, unknown>)[sprache])) {
      fehler.push(`${pfad}: ${sprache} fehlt oder ist kein Objekt aus Zeichenketten.`);
    }
  }
  // R-1169 / R-0983: eine Sprache AUSSERHALB der angemeldeten (etwa `fr: {…}` ohne
  // `woerterbuch/fr.ts`) fiel bis hierher still durch — der Sammler liest nur die angemeldeten
  // Blöcke, der übrige wurde nie ausgeliefert und nie gemeldet. Jeder unbekannte Eintrag der
  // Modulform ist ein Befund. Angemeldet wird eine Sprache über ihre Ressource (R-0997), nicht hier.
  const bekannt = new Set<string>(["praefix", "legacySchluessel", ...sprachen]);
  for (const feld of Object.keys(roh as object).sort()) {
    if (!bekannt.has(feld)) {
      fehler.push(
        `${pfad}: unbekannter Eintrag "${feld}" — ein Textmodul kennt nur ${sprachen.join(", ")}; eine weitere Sprache wäre still ignoriert worden.`,
      );
    }
  }
  return fehler;
}

/**
 * DIE PRÜFUNG. Ein Aufruf, sechs Zusagen — und jede Fehlermeldung nennt Modul UND Schlüssel, damit
 * niemand suchen muss:
 *
 *   1. Jedes Modul hat ein `praefix`, das zu seinem Dateinamen passt.
 *   2. Jeder Schlüssel trägt das Präfix seines Moduls ODER steht in dessen `legacySchluessel`.
 *   3. Kein Eintrag in `legacySchluessel`, den es im Modul gar nicht gibt (tote Ausnahme).
 *   4. Jeder Schlüssel liegt in ALLEN angemeldeten Sprachen vor (mindestens DE/EN/NL) — kein
 *      stilles Zurückfallen auf Deutsch.
 *   5. Kein Schlüssel kommt in zwei Modulen vor.
 *   6. Kein Schlüssel des Moduls steht noch im Grundbestand (`i18n.ts` samt gespreadeter Blöcke).
 *
 * @param module   Pfad (wie ihn `import.meta.glob` liefert) → Standardexport des Moduls, ungeprüft.
 * @param basisSchluessel Alle Schlüssel, die der Grundbestand schon trägt.
 * @param sprachen Die angemeldeten Oberflächensprachen (`sprachenAusRessourcen`); Vorgabe: DE/EN/NL.
 */
export function pruefeTextmodule(
  module: Readonly<Record<string, unknown>>,
  basisSchluessel: ReadonlySet<string>,
  sprachen: readonly string[] = SPRACHEN,
): string[] {
  const fehler: string[] = [];
  const herkunft = new Map<string, string>();

  for (const pfad of Object.keys(module).sort()) {
    const roh = module[pfad];
    const formfehler = pruefeForm(pfad, roh, sprachen);
    if (formfehler.length > 0) {
      fehler.push(...formfehler);
      continue;
    }
    const modul = roh as Textmodul;
    const erlaubtAlt = new Set(modul.legacySchluessel);

    for (const schluessel of Object.keys(modul.de).sort()) {
      // (2) Namensraum — oder ausdrücklich eingetragener Altname.
      if (!schluessel.startsWith(modul.praefix) && !erlaubtAlt.has(schluessel)) {
        fehler.push(
          `${pfad}: Schlüssel "${schluessel}" trägt weder das Präfix "${modul.praefix}" noch steht er in legacySchluessel.`,
        );
      }
      // (4) Alle angemeldeten Sprachen — je Sprache gemeldet, nicht als Sammelmeldung.
      for (const sprache of sprachen) {
        if (!(schluessel in block(modul, sprache))) {
          fehler.push(`${pfad}: Schlüssel "${schluessel}" fehlt in der Sprache "${sprache}".`);
        }
      }
      // (5) Zwei Module, ein Schlüssel — der stille Überschreiber.
      const schon = herkunft.get(schluessel);
      if (schon !== undefined) {
        fehler.push(`Schlüssel "${schluessel}" steht in zwei Modulen: ${schon} und ${pfad}.`);
      } else {
        herkunft.set(schluessel, pfad);
      }
      // (6) Der Altname wurde aus `i18n.ts` nicht entfernt — dann gewänne das Modul still.
      if (basisSchluessel.has(schluessel)) {
        fehler.push(
          `${pfad}: Schlüssel "${schluessel}" steht noch im Grundbestand (apps/web/src/woerterbuch/ bzw. i18n.ts) — dort entfernen, nicht daneben legen.`,
        );
      }
    }

    // Schlüssel, die NUR in einer anderen Sprache stehen: dieselbe Lücke, andere Richtung.
    for (const sprache of sprachen) {
      for (const schluessel of Object.keys(block(modul, sprache)).sort()) {
        if (!(schluessel in modul.de)) {
          fehler.push(
            `${pfad}: Schlüssel "${schluessel}" steht in "${sprache}", fehlt aber in der Sprache "de".`,
          );
        }
      }
    }

    // (3) Tote Ausnahme — ein Altname in der Liste, den das Modul gar nicht führt.
    for (const alt of [...erlaubtAlt].sort()) {
      if (!(alt in modul.de)) {
        fehler.push(
          `${pfad}: legacySchluessel nennt "${alt}", das Modul führt diesen Schlüssel aber nicht.`,
        );
      }
    }
  }

  return fehler;
}

/**
 * Führt die geprüften Module je Sprache zu einem Block zusammen — genau das, was `i18n.ts` neben
 * seinen Grundbestand legt. Bewusst GETRENNT von der Prüfung: wer zusammenführt, hat vorher geprüft.
 */
export function fuehreTextmoduleZusammen(
  module: Readonly<Record<string, Textmodul>>,
  sprachen: readonly string[] = SPRACHEN,
): Record<string, Record<string, string>> {
  const zusammen: Record<string, Record<string, string>> = {};
  for (const sprache of sprachen) {
    zusammen[sprache] = {};
  }
  for (const pfad of Object.keys(module).sort()) {
    const modul = module[pfad] as Textmodul;
    for (const sprache of sprachen) {
      Object.assign(zusammen[sprache] ?? {}, block(modul, sprache));
    }
  }
  return zusammen;
}

/**
 * Die Schlüssel des Grundbestands aus dem QUELLTEXT — für die Aufrufer, die `i18n.ts` nicht
 * ausführen können (das Build-Plugin läuft in Node, bevor irgendetwas gebündelt ist).
 *
 * WARUM ZEILENWEISE UND NICHT ÜBER EINEN PARSER: `i18n.ts` und die gespreadeten Blöcke sind von
 * Biome formatiert, und Biome schreibt jeden Wörterbucheintrag als eigene Zeile mit genau zwei
 * Leerzeichen Einzug (`  "ask.help.sources.title": "…"`). Mehrzeilige Werte rücken auf VIER
 * Leerzeichen ein und werden deshalb nicht mitgezählt. Dass diese Annahme trägt, wird nicht
 * geglaubt, sondern gemessen: `tests/i18n-textmodule/grundbestand.test.ts` legt das Ergebnis dieser
 * Funktion gegen die Schlüssel des WIRKLICH initialisierten i18next. Weichen sie ab, wird der Test
 * rot — nicht irgendwann der Build.
 */
export function basisSchluesselAusQuelltext(quelltexte: readonly string[]): Set<string> {
  const gefunden = new Set<string>();
  for (const text of quelltexte) {
    for (const zeile of text.split("\n")) {
      const treffer = /^ {2}"([^"]+)":/.exec(zeile);
      if (treffer?.[1] !== undefined) {
        gefunden.add(treffer[1]);
      }
    }
  }
  return gefunden;
}
