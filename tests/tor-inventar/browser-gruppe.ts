// ================================================================================================
// JOB 3131 · T2 — WER STARTET EINEN BROWSER? Die Antwort wird berechnet, nicht gepflegt.
// ================================================================================================
//
// DAS PROBLEM. `vitest.config.ts` fuhr bis hierher EINEN Lauf ueber alle 1458 Testdateien, ohne
// Prozessgrenze. Darunter sind Dateien, die einen echten Chromium starten (`require("playwright")`
// → `chromium.launch()`). Auf zwoelf Kernen liefen so bis zu zwoelf Browser gleichzeitig; gemessene
// Last 100–140, Tor-Median 9,1 Minuten, Warteschlange bis 55 Minuten.
//
// DIE LOESUNG BRAUCHT EINE MENGE: welche Testdateien starten einen Browser? Eine von Hand gepflegte
// Liste waere die naheliegende Antwort und die falsche: sie ist am Tag ihrer Entstehung richtig und
// zerfaellt mit dem naechsten neuen Test. Ein neuer Chromium-Test rutschte dann still in die
// parallele Gruppe zurueck — der Zustand, den dieser Auftrag beseitigt.
//
// DESHALB WIRD DIE MENGE HIER BERECHNET, aus dem tatsaechlichen Importgraphen: eine Testdatei
// gehoert in die Browser-Gruppe, wenn ihre transitive Importhuelle (sie selbst eingeschlossen)
// eines der Playwright-Pakete beruehrt. Neue Chromium-Tests ordnen sich damit selbst ein; niemand
// muss daran denken.
//
// WARUM UEBER DEN SYNTAXBAUM UND NICHT UEBER ZEICHENKETTEN — dieselbe Lehre wie in
// `tests/capture/aufrufer-waechter.test.ts`: eine Textsuche nach „playwright" trifft im eigenen
// Bestand nachweislich daneben. `tests/smoke/tor-ausnahme.test.ts` nennt das Wort siebenmal, in
// Kommentaren und in einer `execFileSync`-Argumentliste (`npx playwright test --list`), und startet
// dabei keinen Browser. `tests/structure/fremddoppelungen-kd-capture.test.ts` nennt es in einem
// Begruendungstext. Beide waeren mit einer Textsuche in der seriellen Gruppe gelandet.
//
// Der Scanner hier zaehlt deshalb Knoten im TypeScript-AST: `import`-/`export`-Deklarationen,
// `import(...)`, `import x = require(...)` und `require(...)`-Aufrufe. Kommentare kommen im AST
// gar nicht vor, und eine Zeichenkette in einer Argumentliste ist kein Modulspezifizierer.
//
// GRENZE, ausdruecklich benannt: berechnete Spezifizierer (`require(variable)`) sieht dieser
// Graph nicht — sie sind statisch nicht aufloesbar. Im heutigen Bestand gibt es keine: alle 18
// Startstellen sind statisch aufloesbar (gemessen 06.09.: 18 Fundstellen, davon 17 woertlich
// `require("playwright")` und eine ueber einen `createRequire`-Alias, s. `spezifizierer`).
// `tests/tor-inventar/tor-bestand-vollstaendig.test.ts` (B4) haelt diese Aussage fest, indem er
// die 18 Startdateien gegen den Graphen legt.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

/**
 * Die Anker, an denen die Werkswurzel erkannt wird — dieselbe Doktrin wie in
 * `tests/app/job642-testpfade-cwd-unabhaengig.test.ts` (N-3): die Wurzel wird an echten Dateien
 * des Baums festgemacht, nicht an einer gezaehlten Zahl von Ebenen.
 */
const ANKER = ["package.json", "vitest.config.ts", "tests/support/repoPfad.ts"] as const;

/**
 * Werkswurzel.
 *
 * BEWUSST NICHT `process.cwd()`: diese Datei wird aus `vitest.config.ts` heraus geladen, also
 * bevor Vitest ein Arbeitsverzeichnis festlegt.
 *
 * UND BEWUSST NICHT `resolve(dirname(import.meta.url), "..", "..")` wie in
 * `tests/support/repoPfad.ts`, so naheliegend das waere. Vite BUENDELT die Konfiguration vor dem
 * Laden nach `<wurzel>/vitest.config.ts.timestamp-<zahl>.mjs` (der Grund, aus dem `tools/test`
 * diese Reste wegraeumt) und zieht relative Importe dabei mit hinein. `import.meta.url` zeigt dann
 * auf die WURZEL statt auf `tests/tor-inventar/` — zwei feste Ebenen hoeher landeten ausserhalb
 * des Arbeitsbaums, und der Verzeichnisgang faende nichts. Der Ankergang trifft beide Lagen.
 */
export const WURZEL = ((): string => {
  let ort = dirname(fileURLToPath(import.meta.url));
  for (;;) {
    if (ANKER.every((anker) => existsSync(join(ort, anker)))) {
      return ort;
    }
    const darueber = dirname(ort);
    if (darueber === ort) {
      throw new Error(
        `Werkswurzel nicht gefunden: ab ${dirname(fileURLToPath(import.meta.url))} aufwaerts ` +
          `traegt kein Verzeichnis alle Anker (${ANKER.join(", ")}).`,
      );
    }
    ort = darueber;
  }
})();

/**
 * Die Baeume, in denen `vitest.config.ts` nach Testdateien sucht — die drei `include`-Muster als
 * Verzeichnis plus erlaubte Endungen. Ein viertes Muster hier UND dort einzutragen ist Pflicht;
 * dass beide Seiten dieselbe Menge sehen, misst `browser-gruppe.test.ts` gegen den echten
 * Vitest-Collector (`vitest list --filesOnly`).
 */
export const TESTBAEUME = [
  { verzeichnis: "tests", endungen: [".test.ts", ".test.tsx"] },
  { verzeichnis: "services", endungen: [".test.ts"] },
  { verzeichnis: "apps/web/src", endungen: [".test.ts", ".test.tsx"] },
] as const;

/**
 * Was `vitest.config.ts` zusaetzlich zu den Vitest-Vorgaben ausschliesst. Steht hier, damit der
 * Verzeichnisgang unten dieselbe Menge liefert wie der Collector.
 */
const AUSGESCHLOSSEN = [".integration.test.ts"] as const;

/** Verzeichnisse, die der Gang nie betritt. */
const NICHT_BETRETEN = new Set(["node_modules", "dist", ".git", ".local", "coverage"]);

/**
 * Die Pakete, deren blosse Anwesenheit in der Importhuelle „diese Datei kann einen Browser
 * starten" bedeutet. `playwright` ist der tatsaechliche Weg im Bestand (18 Stellen);
 * `playwright-core` und `@playwright/test` stehen daneben, weil sie dieselbe `chromium.launch`-
 * Flaeche mitbringen und ein spaeterer Test sie statt `playwright` nehmen koennte.
 */
export const BROWSER_PAKETE = ["playwright", "playwright-core", "@playwright/test"] as const;

const ENDUNGEN = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".json"] as const;
const TS_ENDUNGEN = [".ts", ".tsx", ".mts", ".cts"] as const;

/** Ein Pfad in der Schreibweise, in der Vitest-Globs und `git` ihn fuehren: relativ, mit `/`. */
export function alsPosix(absolut: string): string {
  return relative(WURZEL, absolut).split("\\").join("/");
}

function istDatei(pfad: string): boolean {
  return existsSync(pfad) && statSync(pfad).isFile();
}

/**
 * Aufloesung eines relativen Spezifizierers nach `moduleResolution: "Bundler"` (tsconfig.json:5):
 * ohne Endung, mit Endung, `./x.js` meint die danebenliegende `x.ts`, und ein Verzeichnis meint
 * seine `index`-Datei.
 */
function loeseRelativAuf(vonDatei: string, spezifizierer: string): string | undefined {
  const roh = resolve(dirname(vonDatei), spezifizierer);
  if (istDatei(roh)) {
    return roh;
  }
  for (const endung of ENDUNGEN) {
    if (istDatei(roh + endung)) {
      return roh + endung;
    }
  }
  const ohneJs = roh.replace(/\.(js|jsx|mjs|cjs)$/, "");
  if (ohneJs !== roh) {
    for (const endung of TS_ENDUNGEN) {
      if (istDatei(ohneJs + endung)) {
        return ohneJs + endung;
      }
    }
  }
  for (const endung of ENDUNGEN) {
    const index = join(roh, `index${endung}`);
    if (istDatei(index)) {
      return index;
    }
  }
  return undefined;
}

/**
 * Die Modulspezifizierer einer Datei — aus dem Syntaxbaum, nicht aus dem Rohtext.
 *
 * Erfasst werden die vier Kanten, ueber die im Bestand tatsaechlich importiert wird:
 * `import … from "x"` / `export … from "x"`, `import("x")`, `import x = require("x")` und
 * `require("x")`. Die letzte traegt in diesem Projekt die gesamte Browserlast — alle 18
 * Startstellen schreiben `const { chromium } = require("playwright")`.
 */
export function spezifizierer(datei: string): string[] {
  const text = readFileSync(datei, "utf8");
  const baum = ts.createSourceFile(datei, text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);

  // ----------------------------------------------------------------------------------------------
  // GANG 1 — die Namen sammeln, unter denen in DIESER Datei `require` erreichbar ist.
  // ----------------------------------------------------------------------------------------------
  // `require` selbst ist der Regelfall. Es gibt aber einen zweiten, und er ist im Bestand belegt:
  // `tests/start-karten-schmal/start-karten-schmal-chromium.test.tsx:213` bindet
  // `const verlangeModul = createRequire(join(WURZEL, "apps", "web", "index.js"))` und startet
  // Chromium in Z. 391 ueber `verlangeModul("playwright")`. Wer nur nach `require(` sucht, uebersieht
  // genau diese Datei — sie ist zuerst durch dieses Raster gefallen und hat den Gang hier erzwungen.
  // Zwei Gaenge, weil die Bindung im Quelltext hinter ihrer Verwendung stehen darf.
  const requireNamen = new Set<string>(["require"]);
  const sammleBindungen = (knoten: ts.Node): void => {
    if (
      ts.isVariableDeclaration(knoten) &&
      ts.isIdentifier(knoten.name) &&
      knoten.initializer !== undefined &&
      ts.isCallExpression(knoten.initializer)
    ) {
      const ruf = knoten.initializer.expression;
      const heisst =
        (ts.isIdentifier(ruf) && ruf.text === "createRequire") ||
        (ts.isPropertyAccessExpression(ruf) && ruf.name.text === "createRequire");
      if (heisst) {
        requireNamen.add(knoten.name.text);
      }
    }
    ts.forEachChild(knoten, sammleBindungen);
  };
  ts.forEachChild(baum, sammleBindungen);

  // ----------------------------------------------------------------------------------------------
  // GANG 2 — die Kanten.
  // ----------------------------------------------------------------------------------------------
  const gefunden: string[] = [];
  const besuche = (knoten: ts.Node): void => {
    if (
      (ts.isImportDeclaration(knoten) || ts.isExportDeclaration(knoten)) &&
      knoten.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(knoten.moduleSpecifier)
    ) {
      gefunden.push(knoten.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(knoten) &&
      ts.isExternalModuleReference(knoten.moduleReference) &&
      ts.isStringLiteralLike(knoten.moduleReference.expression)
    ) {
      gefunden.push(knoten.moduleReference.expression.text);
    } else if (ts.isCallExpression(knoten)) {
      const istImport = knoten.expression.kind === ts.SyntaxKind.ImportKeyword;
      const istRequire =
        ts.isIdentifier(knoten.expression) && requireNamen.has(knoten.expression.text);
      const erstes = knoten.arguments[0];
      if ((istImport || istRequire) && erstes !== undefined && ts.isStringLiteralLike(erstes)) {
        gefunden.push(erstes.text);
      }
    }
    ts.forEachChild(knoten, besuche);
  };
  ts.forEachChild(baum, besuche);
  return gefunden;
}

/** Zeigt ein Spezifizierer auf eines der Browser-Pakete? Auch als Pfad durch `node_modules`. */
function istBrowserPaket(spez: string): boolean {
  for (const paket of BROWSER_PAKETE) {
    if (spez === paket || spez.startsWith(`${paket}/`)) {
      return true;
    }
    if (spez.includes(`node_modules/${paket}/`) || spez.endsWith(`node_modules/${paket}`)) {
      return true;
    }
  }
  return false;
}

/** Alle Testdateien des heutigen `include`, im Verzeichnisgang ermittelt. Posix-relativ, sortiert. */
export function sammleTestdateien(): string[] {
  const gefunden: string[] = [];
  const gehe = (verzeichnis: string, endungen: readonly string[]): void => {
    for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
      if (eintrag.isDirectory()) {
        if (!NICHT_BETRETEN.has(eintrag.name)) {
          gehe(join(verzeichnis, eintrag.name), endungen);
        }
        continue;
      }
      if (!eintrag.isFile()) {
        continue;
      }
      const passt = endungen.some((endung) => eintrag.name.endsWith(endung));
      const raus = AUSGESCHLOSSEN.some((endung) => eintrag.name.endsWith(endung));
      if (passt && !raus) {
        gefunden.push(alsPosix(join(verzeichnis, eintrag.name)));
      }
    }
  };
  for (const baum of TESTBAEUME) {
    const wurzel = join(WURZEL, baum.verzeichnis);
    if (existsSync(wurzel)) {
      gehe(wurzel, baum.endungen);
    }
  }
  return gefunden.sort();
}

export interface Browserbefund {
  /** Testdateien, deren Importhuelle ein Browser-Paket beruehrt — die serielle Gruppe. */
  readonly browserTests: readonly string[];
  /** Dateien, die das Browser-Paket SELBST importieren (Testdateien wie Helfer). */
  readonly startdateien: readonly string[];
  /** Je Browser-Test die kuerzeste Kette bis zur Startdatei — der Beleg in der Fehlermeldung. */
  readonly ketten: ReadonlyMap<string, readonly string[]>;
}

/**
 * Der Importgraph ueber den Bestand. Ausgehend von jeder Testdatei wird die Huelle entlang der
 * AST-Kanten gebildet; `node_modules` wird nicht betreten (dort endet die Frage: ein Spezifizierer
 * auf ein Browser-Paket ist die Antwort).
 */
export function ermittleBrowserbefund(
  testdateien: readonly string[] = sammleTestdateien(),
): Browserbefund {
  // ----------------------------------------------------------------------------------------------
  // SCHRITT 1 — den Graphen EINMAL vollstaendig aufspannen.
  // ----------------------------------------------------------------------------------------------
  // Bewusst VOLLSTAENDIG und nicht „suchen, bis ein Treffer da ist". Die erste Fassung dieser
  // Funktion brach die Suche je Testdatei beim ersten Treffer ab und sammelte die Startdateien
  // nebenbei ein — dann sieht sie nur, was auf einem abgebrochenen Weg lag. Gemessen: 16 statt 18
  // Startdateien (`B4` wurde rot, bevor das jemand geglaubt haette). Die Menge der Startdateien
  // ist aber die Kalibrierung des ganzen Verfahrens; sie darf nicht davon abhaengen, in welcher
  // Reihenfolge gesucht wurde.
  const nachbarn = new Map<string, string[]>();
  const startdateien = new Set<string>();
  const offen = [...testdateien];
  while (offen.length > 0) {
    const posix = offen.pop() as string;
    if (nachbarn.has(posix)) {
      continue;
    }
    const absolut = join(WURZEL, posix);
    const ziele: string[] = [];
    nachbarn.set(posix, ziele);
    for (const spez of spezifizierer(absolut)) {
      if (istBrowserPaket(spez)) {
        startdateien.add(posix);
        continue;
      }
      if (!spez.startsWith(".")) {
        continue;
      }
      const ziel = loeseRelativAuf(absolut, spez);
      if (ziel === undefined || !ziel.startsWith(WURZEL) || ziel.includes("node_modules")) {
        continue;
      }
      const zielPosix = alsPosix(ziel);
      ziele.push(zielPosix);
      if (!nachbarn.has(zielPosix)) {
        offen.push(zielPosix);
      }
    }
  }

  // ----------------------------------------------------------------------------------------------
  // SCHRITT 2 — rueckwaerts von den Startdateien: wer kommt dort an?
  // ----------------------------------------------------------------------------------------------
  const rueckwaerts = new Map<string, string[]>();
  for (const [von, ziele] of nachbarn) {
    for (const nach of ziele) {
      const eingang = rueckwaerts.get(nach);
      if (eingang === undefined) {
        rueckwaerts.set(nach, [von]);
      } else {
        eingang.push(von);
      }
    }
  }
  const erreichtChromium = new Set<string>(startdateien);
  const welle = [...startdateien];
  while (welle.length > 0) {
    const aktuell = welle.pop() as string;
    for (const vorher of rueckwaerts.get(aktuell) ?? []) {
      if (!erreichtChromium.has(vorher)) {
        erreichtChromium.add(vorher);
        welle.push(vorher);
      }
    }
  }

  // ----------------------------------------------------------------------------------------------
  // SCHRITT 3 — je betroffener Testdatei die kuerzeste Kette als BELEG.
  // ----------------------------------------------------------------------------------------------
  // Eine Fehlermeldung „diese Datei startet einen Browser" ist wertlos, wenn man ihr das nicht
  // ansieht: die Kette nennt den Weg bis zur Zeile mit `require("playwright")`.
  const browserTests = testdateien.filter((datei) => erreichtChromium.has(datei));
  const ketten = new Map<string, readonly string[]>();
  for (const test of browserTests) {
    const vorgaenger = new Map<string, string | undefined>([[test, undefined]]);
    const schlange = [test];
    let treffer: string | undefined;
    while (schlange.length > 0 && treffer === undefined) {
      const aktuell = schlange.shift() as string;
      if (startdateien.has(aktuell)) {
        treffer = aktuell;
        break;
      }
      for (const nachbar of nachbarn.get(aktuell) ?? []) {
        if (!vorgaenger.has(nachbar) && erreichtChromium.has(nachbar)) {
          vorgaenger.set(nachbar, aktuell);
          schlange.push(nachbar);
        }
      }
    }
    const kette: string[] = [];
    for (let glied = treffer; glied !== undefined; glied = vorgaenger.get(glied)) {
      kette.unshift(glied);
    }
    ketten.set(test, kette);
  }

  return { browserTests, startdateien: [...startdateien].sort(), ketten };
}

/**
 * Die Browser-Gruppe als Vitest-Muster. Bewusst die vollen Dateipfade und nicht ein Verzeichnis-
 * oder Namensmuster: der Bestand liegt in sechs verschiedenen Verzeichnissen, und ein Muster
 * wuerde beim naechsten Umzug still zu viel oder zu wenig fangen.
 */
export function browserMuster(): string[] {
  return [...ermittleBrowserbefund().browserTests];
}
