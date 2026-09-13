// ================================================================================================
// JOB 3840 — EIN PROGRAMM, EIN TYPPRÜFER, EINMAL JE LAUF.
// ================================================================================================
//
// WOZU ES DIESE DATEI GIBT. `toter-kandidatenweg.test.ts` beurteilt den Empfänger eines Aufrufs am
// Syntaxbaum EINER Datei, und genau dort endete seine Reichweite: kommt der Träger als Rückgabewert
// einer importierten Funktion herein (`const y = hol(); y.findCandidates({})`), steht in derselben
// Datei weder eine Typangabe noch ein repo-ähnlicher Name. Die Auskunft liegt in der NACHBARDATEI,
// und die kennt nur der Typprüfer. Der braucht ein `ts.Program` — und ein Programm baut man EINMAL.
//
// WARUM NICHT IN `tools/modalgrenze.ts`: die Datei ist gemeinsame Vorrichtung vieler Wächter; ein
// Programmaufbau dort wirkte auf fremde Bestandsdateien. Er wohnt deshalb hier, neben dem einen
// Wächter, der ihn braucht.
//
// WARUM EIN PROGRAMM UND NICHT EINES JE DATEI ODER JE FALL: der Aufbau ist der teure Teil (er liest
// die ganze Fläche samt aufgelöster Abhängigkeiten), die Frage danach ist billig (der Prüfer
// beantwortet sie für einen einzelnen Knoten). Ein Programm je Aufruf machte die Wächterdatei im Tor
// unbezahlbar; `./tools/check` ist der Engpass der Maschine. Die gemessenen Kosten stehen in
// `Typumgebung.aufbauMs` — der Wächter schreibt sie in seine Ausgabe, damit die Zahl gemessen ist
// und nicht behauptet.
//
// WAS DIESE DATEI NICHT TUT: sie beurteilt nichts. Was als Repository gilt, steht als Regel im
// Wächter (`REPO_TYPEN` in `toter-kandidatenweg.test.ts`) — hier wird nur das Programm gebaut.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import ts from "typescript";
import { WURZEL, posix } from "../../tools/modalgrenze";

export interface Typumgebung {
  readonly pruefer: ts.TypeChecker;
  /**
   * Die Quelle, wie sie IM Programm liegt.
   *
   * Der Prüfer beantwortet ausschliesslich Fragen zu SEINEN Knoten; ein zweiter, nebenher geparster
   * Baum derselben Datei ist für ihn ein Fremdkörper und liefert `any`. Wer den Prüfer fragen will,
   * läuft deshalb über diesen Baum.
   */
  quelle(datei: string): ts.SourceFile | undefined;
  /** Was der Aufbau gekostet hat, in Millisekunden — gemessen, nicht geschätzt. */
  readonly aufbauMs: number;
}

/** Die Grundlage der Übersetzeroptionen: dieselbe Datei, gegen die `npx tsc --noEmit` fährt. */
const GRUNDLAGE = "tsconfig.json";

/**
 * Die Optionen des Programms — aus `tsconfig.json` gelesen, nicht nachgebaut.
 *
 * DREI ZUSÄTZE, jeder mit Grund:
 *   · `jsx`/DOM-Bibliothek: `tsconfig.json` ist Node-rein (es schliesst `tests/**\/*.tsx` aus und
 *     kennt `apps/` nicht als Einstieg). Die Produktfläche enthält aber `apps/web/src/**.tsx`; ohne
 *     diese beiden Zusätze verlöre der Prüfer dort jeden Typ und die Erhebung wäre still schwächer.
 *   · `types: []`: gefragt ist der Typ EINES Empfängers, nicht eine vollständige Typprüfung. Die
 *     globalen Typpakete tragen dazu nichts bei und sind der teuerste Teil des Aufbaus.
 *   · `noEmit`: dieses Programm schreibt nie eine Datei.
 */
function optionen(zusatz: ts.CompilerOptions): ts.CompilerOptions {
  const roh = ts.readConfigFile(join(WURZEL, GRUNDLAGE), (pfad) => readFileSync(pfad, "utf8"));
  const config = (roh.config ?? {}) as { compilerOptions?: unknown };
  const umgewandelt = ts.convertCompilerOptionsFromJson(config.compilerOptions, WURZEL);
  return { ...umgewandelt.options, noEmit: true, types: [], ...zusatz };
}

function umgebungAus(programm: ts.Program, beginn: number): Typumgebung {
  return {
    pruefer: programm.getTypeChecker(),
    quelle: (datei) => programm.getSourceFile(join(WURZEL, datei)),
    aufbauMs: Date.now() - beginn,
  };
}

let produkt: Typumgebung | undefined;

/**
 * Das EINE Programm über die Produktfläche, gehalten über die ganze Datei.
 *
 * Der Zwischenspeicher ist modulweit und absichtlich unabhängig von der übergebenen Dateiliste: die
 * Produktfläche ist innerhalb eines Laufs dieselbe, und ein zweiter Aufbau wäre reine Wartezeit.
 *
 * WAS ES KOSTET — GEMESSEN (JOB 3840, 13.09.2026, derselbe Befehl auf demselben Rechner, 759
 * Produktdateien, Gruppe `tests/live-check-postgres-prefilter` + die zwei `repo-pg-*`-Dateien):
 *
 *     VORHER   `toter-kandidatenweg.test.ts` 1395 ms, davon der Produktflächen-Fall 1337 ms · 46 Fälle
 *     NACHHER  `toter-kandidatenweg.test.ts` 2249 ms, davon der Fall 2130 ms · 49 Fälle
 *              (im Fall: Programmaufbau 1422 ms + Erhebung 703 ms)
 *     Gruppe   2,08 s → 2,97 s
 *
 * Der Preis ist also der AUFBAU, nicht die Frage: die Erhebung selbst wurde schneller (703 statt
 * 1337 ms), weil der Baum jetzt aus dem Programm kommt statt je Datei neu geparst zu werden. Netto
 * kostet die Verschärfung rund 0,85 s im Tor. Zum Vergleich auf der Prüfmaschine der Cloud (andere
 * Leistung, dieselbe Richtung): 1515 ms → 3154 ms, davon Programmaufbau 2274 ms.
 */
export function produktprogramm(dateien: readonly string[]): Typumgebung {
  if (produkt !== undefined) {
    return produkt;
  }
  const beginn = Date.now();
  const programm = ts.createProgram({
    rootNames: dateien.map((datei) => join(WURZEL, datei)),
    options: optionen({
      jsx: ts.JsxEmit.ReactJSX,
      lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
      skipLibCheck: true,
    }),
  });
  produkt = umgebungAus(programm, beginn);
  return produkt;
}

const gestellte = new WeakMap<ReadonlyMap<string, string>, Typumgebung>();

/**
 * Ein Programm aus GESTELLTEN Quellen — für die Kalibrierung.
 *
 * Die Kalibrierung braucht mehr als eine Datei: der Träger steht in der einen, seine Typauskunft in
 * der anderen. Genau diese Trennung ist der Gegenstand, sie lässt sich also nicht an einer einzelnen
 * gestellten Quelle messen. Die Quellen liegen im Speicher; nur die Standardbibliothek kommt von
 * der Platte (Rückfall auf den echten Übersetzer-Wirt).
 *
 * Auch hier wird je Quellenmenge genau EINMAL gebaut — alle Fälle teilen ein Programm.
 */
export function gestelltesProgramm(quellen: ReadonlyMap<string, string>): Typumgebung {
  const bekannt = gestellte.get(quellen);
  if (bekannt !== undefined) {
    return bekannt;
  }
  const beginn = Date.now();
  const inhalte = new Map(
    [...quellen].map(([datei, text]) => [posix(join(WURZEL, datei)), text] as const),
  );
  // GEMESSEN UND NICHT VERMUTET: ohne `directoryExists` bleibt der Import ungelöst und der Träger
  // hätte den Typ `any` — der Prüfer probiert in einem Verzeichnis, das es auf der Platte nicht gibt,
  // gar nicht erst (`fileExists` wird dort nie gefragt). Der Fall wäre dann grün geblieben, WEIL die
  // Auskunft fehlt: ein Wächter, der aus „unbekannt" ein „in Ordnung" macht. Deshalb kennt der Wirt
  // die Verzeichnisse der gestellten Quellen samt ihrer Oberverzeichnisse.
  const ordner = new Set<string>();
  for (const datei of inhalte.keys()) {
    for (let ordnerName = posix(dirname(datei)); ordnerName.length > 1; ) {
      ordner.add(ordnerName);
      const oben = posix(dirname(ordnerName));
      if (oben === ordnerName) {
        break;
      }
      ordnerName = oben;
    }
  }
  const eigene = optionen({ lib: ["lib.es2022.d.ts"] });
  const basis = ts.createCompilerHost(eigene, true);
  const wirt: ts.CompilerHost = {
    ...basis,
    getSourceFile: (name, stand, aufFehler, neu) => {
      const text = inhalte.get(posix(name));
      return text === undefined
        ? basis.getSourceFile(name, stand, aufFehler, neu)
        : ts.createSourceFile(name, text, stand, true, ts.ScriptKind.TS);
    },
    fileExists: (name) => inhalte.has(posix(name)) || basis.fileExists(name),
    readFile: (name) => inhalte.get(posix(name)) ?? basis.readFile(name),
    directoryExists: (name) => ordner.has(posix(name)) || basis.directoryExists?.(name) === true,
  };
  const programm = ts.createProgram({
    rootNames: [...inhalte.keys()],
    options: eigene,
    host: wirt,
  });
  const umgebung = umgebungAus(programm, beginn);
  gestellte.set(quellen, umgebung);
  return umgebung;
}
