// ================================================================================================
// JOB 4367 · DIESELBE PRÜFUNG, OHNE BROWSER — das Einsammeln der Textmodule aus dem Dateibaum.
// ================================================================================================
//
// WOZU. `apps/web/src/i18n.ts` sammelt die Textmodule zur LAUFZEIT über `import.meta.glob` ein.
// Zwei Aufrufer können das nicht: das Vite-Plugin in `apps/web/vite.config.ts` läuft, BEVOR
// irgendetwas gebündelt ist, und die Vitest-Fälle in `tests/i18n-textmodule/` wollen Module prüfen,
// die es im Baum absichtlich gar nicht gibt (Fehlerfälle in einer Wegwerfbühne). Beide brauchen
// denselben Befund aus Dateien statt aus dem Bündel — der steht hier.
//
// DIE PRÜFUNG SELBST STEHT NICHT HIER, sondern in `./pruefung.ts`. Diese Datei beschafft nur; sie
// entscheidet nichts. Genau deshalb kann `./pruefung.ts` rein bleiben (kein `node:fs`) und im
// Browser mitlaufen.
//
// WARUM DIE MODULE AUSGEFÜHRT UND NICHT GEPARST WERDEN. Ein Textmodul ist TypeScript. Sein Inhalt
// über Zeichenketten zu lesen wäre dieselbe Falle, an der die sieben Wörterbuch-Leser aus JOB 3326
// R5 zerbrochen sind. `ts.transpileModule` + Ausführen liefert genau das Objekt, das später auch
// der Browser sieht — einschliesslich `satisfies`-Prüfung im Typcheck und ohne eigene Parserlogik.
//
// WARUM `typescript` UND NICHT `esbuild`. Beide liegen im Baum. `typescript` steht ausdrücklich in
// `apps/web/package.json` (devDependencies) und ist damit auch im Docker-Webbuild da, der NUR
// `apps/web` installiert (`Dockerfile:12-15`); `esbuild` wäre nur als Unterabhängigkeit von Vite
// zufällig vorhanden. Eine Prüfung, die am Hoisting hängt, ist keine.
//
// GRENZE, ausdrücklich: Textmodule sind REINE DATENMODULE. Sie dürfen nichts importieren ausser
// Typen (`import type`, wird beim Transpilieren restlos entfernt). Wer es doch tut, bekommt hier
// eine Meldung mit Dateiname statt eines stillen `undefined`.
//
// WAS DIESE GRENZE NICHT SIEHT, gemessen und nicht vermutet: einen Wertimport, dessen Wert im
// Modul gar nicht vorkommt. `ts.transpileModule` entfernt ihn genauso restlos wie einen Typimport,
// es entsteht kein `require`, und die Datei lädt einwandfrei. Das ist folgenlos — ein Import, der
// nichts lädt, lädt auch im Browser nichts. Gemeldet wird also genau der gefährliche Fall.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { runInThisContext } from "node:vm";
import ts from "typescript";
import { basisSchluesselAusQuelltext, pruefeTextmodule } from "./pruefung";

/** Der Ordner, in dem die Textmodule wohnen — relativ zu `apps/web/src`. */
export const TEXTE_ORDNER = "texte";

/**
 * Der Schlüssel, unter dem ein Modul gemeldet wird: genau die Schreibweise, die
 * `import.meta.glob("./texte/*.ts")` in `i18n.ts` liefert. Damit lautet eine Fehlermeldung aus dem
 * Build zeichengleich wie dieselbe Meldung aus dem Browser.
 */
function globSchluessel(datei: string): string {
  return `./${TEXTE_ORDNER}/${datei}`;
}

/**
 * Führt ein Textmodul aus und gibt seinen Standardexport zurück.
 *
 * Fehler werden NICHT geworfen, sondern als Befundzeile zurückgegeben: ein einzelnes kaputtes
 * Modul soll den Bericht über die anderen nicht abschneiden.
 */
function ladeModul(pfad: string, schluessel: string): { wert?: unknown; fehler?: string } {
  let quelle: string;
  try {
    quelle = readFileSync(pfad, "utf8");
  } catch (grund) {
    return { fehler: `${schluessel}: nicht lesbar (${String(grund)}).` };
  }
  const { outputText } = ts.transpileModule(quelle, {
    fileName: pfad,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  });
  const modul: { exports: Record<string, unknown> } = { exports: {} };
  const verlangeNichts = (spezifizierer: string): never => {
    throw new Error(
      `Textmodule sind reine Datenmodule und dürfen nichts laden — "${spezifizierer}" ist ein Wertimport (Typen bitte mit "import type").`,
    );
  };
  try {
    const fabrik = runInThisContext(`(function (module, exports, require) {${outputText}\n})`, {
      filename: pfad,
    }) as (m: typeof modul, e: Record<string, unknown>, r: (s: string) => never) => void;
    fabrik(modul, modul.exports, verlangeNichts);
  } catch (grund) {
    return { fehler: `${schluessel}: konnte nicht ausgeführt werden — ${String(grund)}` };
  }
  if (!("default" in modul.exports)) {
    return {
      fehler: `${schluessel}: kein Standardexport — ein Textmodul schreibt "export default { praefix, legacySchluessel, de, en, nl }".`,
    };
  }
  return { wert: modul.exports.default };
}

/**
 * Die Dateien, aus denen sich der GRUNDBESTAND zusammensetzt: `i18n.ts` selbst und jede Datei, aus
 * der es einen Textblock hineinspreadet (heute nur `lib/lesevariante.ts`).
 *
 * WARUM MITGELESEN WIRD, WAS GESPREADET IST: sonst wäre der Eindeutigkeitsnachweis blind für genau
 * die Schlüssel, die schon einmal ausgelagert wurden — ein neues Modul dürfte
 * `lesevariante.badge.original` erfinden, und im Bündel gewänne still das Modul.
 */
export function basisQuellen(i18nPfad: string): string[] {
  const text = readFileSync(i18nPfad, "utf8");
  const herkunft = new Map<string, string>();
  for (const treffer of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
    const namen = (treffer[1] ?? "").split(",");
    const quelle = treffer[2] ?? "";
    for (const roh of namen) {
      const name = roh.replace(/^\s*type\s+/, "").trim();
      if (name.length > 0) {
        herkunft.set(name, quelle);
      }
    }
  }
  const dateien = new Set<string>([i18nPfad]);
  for (const treffer of text.matchAll(/^\s*\.\.\.([A-Za-z0-9_$]+),\s*$/gm)) {
    const quelle = herkunft.get(treffer[1] ?? "");
    if (quelle === undefined || !quelle.startsWith(".")) {
      continue;
    }
    const roh = resolve(dirname(i18nPfad), quelle);
    for (const kandidat of [`${roh}.ts`, join(roh, "index.ts"), roh]) {
      try {
        readFileSync(kandidat, "utf8");
        dateien.add(kandidat);
        break;
      } catch {
        // nächster Kandidat — ein nicht auflösbarer Spezifizierer ist hier kein Abbruchgrund
      }
    }
  }
  return [...dateien];
}

export interface Textbaum {
  /** Glob-Schlüssel → Standardexport des Moduls, ungeprüft. */
  readonly module: Record<string, unknown>;
  /** Alle Schlüssel, die der Grundbestand schon trägt. */
  readonly basisSchluessel: Set<string>;
  /** Befunde, die schon beim Beschaffen aufgefallen sind (nicht lesbar, kein Standardexport …). */
  readonly ladefehler: string[];
}

/**
 * Liest alle Textmodule eines `src`-Ordners ein. Nur DIREKTE Kinder von `texte/` sind Module —
 * `texte/intern/` trägt die Werkzeuge und wird bewusst nicht eingesammelt, genau wie beim
 * `import.meta.glob("./texte/*.ts")` in `i18n.ts` (ein `*` überschreitet kein `/`).
 */
export function ladeTextbaum(srcOrdner: string): Textbaum {
  const ordner = join(srcOrdner, TEXTE_ORDNER);
  const module: Record<string, unknown> = {};
  const ladefehler: string[] = [];
  let eintraege: string[] = [];
  try {
    eintraege = readdirSync(ordner, { withFileTypes: true })
      .filter((eintrag) => eintrag.isFile() && eintrag.name.endsWith(".ts"))
      .map((eintrag) => eintrag.name)
      .sort();
  } catch {
    eintraege = []; // kein `texte/`-Ordner ist ein gültiger Zustand: null Module, null Befunde
  }
  for (const datei of eintraege) {
    const schluessel = globSchluessel(datei);
    const geladen = ladeModul(join(ordner, datei), schluessel);
    if (geladen.fehler !== undefined) {
      ladefehler.push(geladen.fehler);
      continue;
    }
    module[schluessel] = geladen.wert;
  }
  const quellen = basisQuellen(join(srcOrdner, "i18n.ts"));
  return {
    module,
    basisSchluessel: basisSchluesselAusQuelltext(
      quellen.map((datei) => readFileSync(datei, "utf8")),
    ),
    ladefehler,
  };
}

/**
 * DIE EINE PRÜFUNG, wie sie das Build-Plugin und Vitest fahren: Befunde als Liste, leer heisst grün.
 *
 * @param srcOrdner absoluter Pfad auf `apps/web/src` (oder eine Bühne derselben Gestalt).
 */
export function pruefeTextbaum(srcOrdner: string): string[] {
  const baum = ladeTextbaum(srcOrdner);
  return [...baum.ladefehler, ...pruefeTextmodule(baum.module, baum.basisSchluessel)];
}

/**
 * Das Vite-Plugin, das den Produktbuild an einem verletzten Vertrag abbrechen lässt. Eingetragen
 * wird es in `apps/web/vite.config.ts`; die Begründung, warum die Fabrik HIER steht und nicht dort,
 * steht ebenfalls in jener Datei (kurz: eine Testdatei muss sie importieren können, ohne
 * `vite.config.ts` in den Root-Typcheck zu ziehen, wo sie nicht typisierbar ist).
 *
 * STRUKTURELL TYPISIERT, ohne `import type { Plugin } from "vite"`: so hängt diese Datei an keinem
 * Vite-Import und bleibt aus dem Anwendungsbündel ebenso heraus wie aus dem Browser.
 */
export interface TextmodulPlugin {
  readonly name: "textmodul-vertrag";
  readonly apply: "build";
  configResolved(config: { readonly root: string }): void;
  buildStart(): void;
}

export function textmodulVertrag(): TextmodulPlugin {
  let wurzel: string | undefined;
  return {
    name: "textmodul-vertrag",
    apply: "build",
    // `config.root` und nicht `process.cwd()`: der Docker-Build ruft `vite build` aus `apps/web`
    // (`Dockerfile:15`), die Automatisierung aus der Werkswurzel. Die Wurzel des Projekts ist in
    // beiden Fällen die aufgelöste Konfiguration — das Aufrufverzeichnis ist es nicht.
    configResolved(config) {
      wurzel = config.root;
    },
    // buildStart und nicht closeBundle: ein verletzter Vertrag soll den Bau gar nicht erst
    // durchlaufen lassen, statt nach zwei Minuten Bündeln ein fertiges dist zu verwerfen.
    buildStart() {
      const fehler = pruefeTextbaum(join(wurzel ?? resolve("."), "src"));
      if (fehler.length > 0) {
        // `throw` und nicht `this.error(…)`: Rollup bricht bei beidem ab, aber ein geworfener
        // Fehler lässt sich aus einem Test heraus ohne nachgebauten Plugin-Kontext auslösen und
        // lesen — genau das tut `tests/i18n-textmodule/modulvertrag.test.ts`.
        const regeln = "apps/web/src/texte/intern/pruefung.ts, docs/i18n-textmodule.md";
        throw new Error(
          `Textmodule verletzen ihren Vertrag (${fehler.length}):\n  ${fehler.join("\n  ")}\nRegeln und Begründung: ${regeln}`,
        );
      }
    },
  };
}
