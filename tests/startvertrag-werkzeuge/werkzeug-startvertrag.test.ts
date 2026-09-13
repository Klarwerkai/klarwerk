// ================================================================================================
// JOB 3797 — DER STARTVERTRAG GILT AUCH FÜR WERKZEUGE, DIE DIE APP-WURZEL LADEN.
// ================================================================================================
//
// DER BEFUND, GEGEN DEN DIESE DATEI STEHT. JOB 3776 hat den Startvertrag an die echten
// Einstiegspunkte gezogen (`server.ts`, `seed.ts`) und dabei einen VIERTEN gemessen, der ausserhalb
// seiner Zielpfade lag: `tools/bodytext-nachziehen.ts` lädt die App-Kompositionswurzel
// `services/app/src/build-app` per `await import` und läuft als eigener Prozess
// (`jobs/3776/runde-1/RUECKGABE.md`, Lieferpunkt 1 und ABWEICHUNG 2). Der Vertrag griff dort nur
// zufällig — über den Modulrumpf von `build-app.ts` — und dann als UNBEHANDELTE Zurückweisung.
//
// GEMESSEN AM ECHTEN PROZESS, VOR DIESEM AUFTRAG (Basisstand 56d2995, Umgebung
// `NODE_ENV=production` + `KLARWERK_DB_URL` gesetzt, `APP_BASE_URL` fehlt):
//     /…/services/app/src/start-vertrag.ts:927
//         throw new StartvertragError(fehlend);
//     …
//         at ModuleJob.run (node:internal/modules/esm/module_job:439:25)
//     Exit 1, zwölf Zeilen stderr.
// Der Betreiber der Vorführ-Instanz las eine Stapelspur aus dem Modullader statt eines Satzes.
//
// WAS DIESE DATEI PRÜFT — QUELLTEXT, sonst nichts. Kein Browser, keine Datenbank, kein Prozess.
// Die Wirkung am laufenden Prozess misst die Nachbardatei `werkzeug-prozess.test.ts`; beide
// zusammen sind der Nachweis, denn der Quelltext allein sagt nichts über die erste Ausgabezeile
// und ein Prozesslauf allein sagt nichts über den nächsten Einstiegspunkt, den jemand baut.
//
// W1 · der Vertrag steht in `main()`, VOR dem Verbindungs-String und vor jedem Laden der App-Wurzel.
// W2 · der CLI-Riegel fängt den Wurf (kein blosses `void main()`).
// W3 · ALTBESTAND mit Schranke in beide Richtungen: jedes Werkzeug, das die App-Wurzel lädt, ruft
//      den Vertrag ODER steht namentlich mit Grund im Altbestand — und wer bezahlt hat, fliegt raus.
// W4 · die Prüfmenge selbst ist festgenagelt, damit ein weggefallener Gang auffällt.
// W5 · KALIBRIERUNG des Gangs an echten, ausführbaren Werkzeugdateien (Runde 3, s. unten).
//
// ------------------------------------------------------------------------------------------------
// RUNDE 3 — WARUM DER GANG NEU GEBAUT IST. Der Prüfer hat in Runde 2 eine Datei
// `tools/ben-startvertrag-probe.ts` mit `await import('../services/app/src/build-app.js')` angelegt:
// ein echter Prozess, der die App-Wurzel wirklich lädt (tsx löst den `.js`-Spezifizierer auf die
// `.ts`-Datei auf) und mit `StartvertragError` endete. W3/A blieb GRÜN — die Sonde kannte nur
// endungslose und `.ts`-Spezifizierer, also genau nicht die ESM-richtige Schreibweise. Behoben ist
// das an drei Stellen: (1) die Endungsgruppe deckt jetzt jede Modulendung ab, (2) gemessen wird der
// SYNTAXBAUM statt des Rohtextes, damit die Meldung Datei UND ZEILE der wirklichen Ladestelle nennt
// (der Rohtext fand auch die Erwähnung in einem Kommentar), (3) W5 kalibriert den Gang an
// ausführbaren Dateien mit allen drei Schreibweisen — ohne Endung, `.ts`, `.js` — statt an einer
// Namensliste, die aus derselben Suchfunktion stammt und deshalb nichts beweist.
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import ts from "typescript";
import { afterAll, describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const WERKZEUGORDNER = join(WURZEL, "tools");

/** Das geprüfte Werkzeug. Es ist der einzige gemessene Lader — s. MESSUNG unten. */
const WERKZEUG = "tools/bodytext-nachziehen.ts";

/**
 * Mehrteilige Meldungen als Liste statt als Kette. Grund: Biome verbietet den Mischbau
 * `"…" + \`…\`` (useTemplate) UND ein Sicherungszeichen ohne Einsetzung (noUnusedTemplateLiteral) —
 * zusammen bliebe nur eine einzige überlange Zeile.
 */
const satz = (...teile: readonly string[]): string => teile.join("");

/**
 * SO WIRD ES WIEDER GRÜN. Eine Fehlermeldung, die nur „falsch" sagt, kostet die nächste Bahn eine
 * halbe Runde Suchen. Hausmuster: der Weg zurück steht im Text, nicht im Kopf des Bauenden.
 */
const WEG_ZURUECK = [
  "",
  "SO WIRD ES WIEDER GRÜN:",
  `  1. In ${WERKZEUG} steht als ERSTE Anweisung von \`main()\`:`,
  "       pruefeStartvertrag(process.env);",
  '     Importiert aus "../services/app/src/start-vertrag" — die VORHANDENE Funktion, keine Kopie,',
  "     keine eigene Liste, keine nachgebaute Meldung.",
  "  2. Der CLI-Riegel am Dateiende fängt den Wurf:",
  "       main().catch((fehler) => { process.stderr.write(...); process.exitCode = 2; });",
  "     Ein blosses `void main()` macht aus dem Vertragswurf wieder eine Stapelspur.",
  "  3. Ein NEUES Werkzeug, das die App-Wurzel lädt: entweder es ruft den Vertrag ebenso, oder es",
  "     steht mit Grund im ALTBESTAND dieser Datei. Beides ohne Eintrag ist die Lücke, gegen die",
  "     dieser Wächter steht (jobs/3776/runde-1/RUECKGABE.md, REST :64).",
].join("\n");

// ================================================================================================
// DIE MESSUNG — WELCHE WERKZEUGE LADEN DIE APP-KOMPOSITIONSWURZEL?
// ================================================================================================
//
// KRITERIUM, wörtlich das von JOB 3776 Lieferpunkt 1, damit die zwei Messungen vergleichbar sind:
// eine Datei unter `tools/`, die (a) `services/app/src/build-app` lädt — statisch oder dynamisch —
// und (b) als eigener Prozess laufen kann.
//
// Gelesen wird JEDE Datei unter `tools/`, auch die Schalen-Skripte und die endungslosen Starter:
// ein `node -e "await import('../services/app/src/build-app.js')"` in einer `.sh` wäre derselbe
// Einstiegspunkt. Für Moduldateien beantwortet der SYNTAXBAUM die Frage (Importanweisung,
// `import("…")`, `require("…")`) — damit zählt nur eine wirkliche Ladestelle und die gemeldete
// Zeile zeigt auf sie, nicht auf eine Erwähnung im Kommentar; für alles andere werden die
// Zeichenketten-Literale je Zeile gelesen.
//
// WAS DIESER GANG NICHT SIEHT und was hier offen benannt ist: ein Pfad, der zur Laufzeit aus
// Bruchstücken zusammengesetzt wird. Dagegen hilft kein Quelltextwächter. Die Sicherungen dagegen,
// dass der Gang selbst einschläft, sind W4 (die EINE wirklich vorhandene Ladestelle ist namentlich
// festgenagelt) und W5 (der Gang wird an eigens angelegten, ausführbaren Werkzeugdateien
// kalibriert — die Namensliste allein stammt aus derselben Suchfunktion und beweist nichts).

/**
 * Die Endungen, die ein konstanter Spezifizierer tragen darf. `.js` steht ausdrücklich dabei: unter
 * ESM ist `import("../services/app/src/build-app.js")` die RICHTIGE Schreibweise für eine
 * `.ts`-Quelle, tsx löst sie auf — genau diese Form hat der Gang in Runde 2 übersehen.
 */
const ENDUNG = String.raw`(?:\.(?:ts|mts|cts|tsx|js|mjs|cjs|jsx))?`;

const APP_WURZEL_WEGE: readonly RegExp[] = [
  // `…/services/app/src/build-app` — mit jeder Modulendung oder ohne.
  new RegExp(String.raw`^(?:.*/)?services/app/src/build-app${ENDUNG}$`),
  // Die öffentliche Modulschnittstelle: `services/app/index.ts:2` reicht `buildApp`,
  // `buildServices` und `buildPgServices` weiter — wer sie lädt, lädt die Wurzel mit.
  new RegExp(String.raw`^(?:.*/)?services/app(?:/index${ENDUNG})?$`),
];

/** Ruft die Datei den VORHANDENEN Vertrag? Beides muss da sein: der Import UND der Aufruf. */
const VERTRAG_IMPORT = new RegExp(String.raw`^(?:.*/)?services/app/src/start-vertrag${ENDUNG}$`);
const VERTRAG_AUFRUF = /\bpruefeStartvertrag\s*\(/;

/**
 * Kann die Datei als eigener Prozess laufen? Der CLI-Riegel ist im Bestand einheitlich gebaut —
 * entweder `import.meta.url === pathToFileURL(process.argv[1]).href` oder
 * `process.argv[1]?.endsWith("…")`. Beide Formen fassen `process.argv[1]` an; das ist die Sonde.
 */
const CLI_RIEGEL = /process\.argv\[1\]/;

const MODULENDUNGEN = [".ts", ".mts", ".cts", ".mjs", ".cjs", ".js"] as const;

/** Eine Stelle, an der eine Datei ein Modul nennt: welcher Spezifizierer, in welcher Zeile. */
interface Ladestelle {
  readonly zeile: number;
  readonly spez: string;
}

function istModuldatei(datei: string): boolean {
  return MODULENDUNGEN.some((e) => datei.endsWith(e));
}

/** Die Zeichenketten einer Nicht-Moduldatei, je Zeile — der `.sh`-Weg. */
function zeichenkettenJeZeile(text: string): Ladestelle[] {
  const gefunden: Ladestelle[] = [];
  const zeilen = text.split("\n");
  for (let i = 0; i < zeilen.length; i += 1) {
    for (const treffer of (zeilen[i] ?? "").matchAll(/(["'`])([^"'`]*)\1/g)) {
      gefunden.push({ zeile: i + 1, spez: treffer[2] ?? "" });
    }
  }
  return gefunden;
}

/**
 * JEDE Zeichenkette einer Datei, mit Zeile. In einer Moduldatei die String-Literale aus dem
 * Syntaxbaum, sonst die Literale der Zeile.
 *
 * ABSICHTLICH WEIT: nicht nur Importspezifizierer, sondern auch ein Pfad, der erst in einer
 * Variablen liegt und danach geladen wird (`const p = "…/build-app.js"; await import(p)`). Der ist
 * eine echte Ladestelle, und diese Sonde sieht ihn. ABSICHTLICH OHNE KOMMENTARE: der Rohtext-Gang
 * aus Runde 2 zählte auch eine Erwähnung in einem Kommentar — dann zeigt die gemeldete Zeile nicht
 * auf die Ladestelle, und `Datei:Zeile` im Befund wäre eine Zahl ohne Deckung.
 */
function zeichenketten(datei: string, text: string): Ladestelle[] {
  if (!istModuldatei(datei)) {
    return zeichenkettenJeZeile(text);
  }
  const sf = ts.createSourceFile(datei, text, ts.ScriptTarget.ESNext, true);
  const gefunden: Ladestelle[] = [];
  const geh = (n: ts.Node): void => {
    if (ts.isStringLiteralLike(n)) {
      gefunden.push({
        zeile: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        spez: n.text,
      });
    }
    n.forEachChild(geh);
  };
  geh(sf);
  return gefunden;
}

/**
 * Die ECHTEN Modulspezifizierer: `import … from "…"`, `export … from "…"`, `import("…")`,
 * `require("…")`, `import x = require("…")`. Enger als `zeichenketten`, weil „diese Datei ruft den
 * Vertrag" an einem wirklichen Import hängen muss und nicht an einem Pfad in einer Zeichenkette.
 */
function importSpezifizierer(datei: string, text: string): Ladestelle[] {
  if (!istModuldatei(datei)) {
    return zeichenkettenJeZeile(text);
  }
  const sf = ts.createSourceFile(datei, text, ts.ScriptTarget.ESNext, true);
  const gefunden: Ladestelle[] = [];
  const nimm = (knoten: ts.Node | undefined, stelle: ts.Node): void => {
    if (knoten !== undefined && ts.isStringLiteralLike(knoten)) {
      gefunden.push({
        zeile: sf.getLineAndCharacterOfPosition(stelle.getStart(sf)).line + 1,
        spez: knoten.text,
      });
    }
  };
  const geh = (n: ts.Node): void => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) {
      nimm(n.moduleSpecifier, n);
    } else if (ts.isExternalModuleReference(n)) {
      nimm(n.expression, n);
    } else if (ts.isCallExpression(n)) {
      const istImport = n.expression.kind === ts.SyntaxKind.ImportKeyword;
      const istRequire = ts.isIdentifier(n.expression) && n.expression.text === "require";
      if (istImport || istRequire) {
        nimm(n.arguments[0], n);
      }
    }
    n.forEachChild(geh);
  };
  geh(sf);
  return gefunden;
}

function alleDateienUnter(ordner: string, wurzel: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
    const pfad = join(ordner, eintrag.name);
    if (eintrag.isDirectory()) {
      gefunden.push(...alleDateienUnter(pfad, wurzel));
    } else if (eintrag.isFile()) {
      gefunden.push(relative(wurzel, pfad).split(sep).join("/"));
    }
  }
  return gefunden.sort();
}

interface Befund {
  readonly datei: string;
  /** Jede Stelle, an der die App-Kompositionswurzel geladen wird — leer heisst: kein Lader. */
  readonly ladestellen: readonly Ladestelle[];
  readonly istModul: boolean;
  readonly hatCliRiegel: boolean;
  readonly ruftVertrag: boolean;
}

function erhebeBefunde(ordner: string, wurzel: string): Befund[] {
  return alleDateienUnter(ordner, wurzel).map((datei) => {
    const text = readFileSync(join(wurzel, datei), "utf8");
    return {
      datei,
      ladestellen: zeichenketten(datei, text).filter((s) =>
        APP_WURZEL_WEGE.some((r) => r.test(s.spez)),
      ),
      istModul: istModuldatei(datei),
      hatCliRiegel: CLI_RIEGEL.test(text),
      ruftVertrag:
        importSpezifizierer(datei, text).some((s) => VERTRAG_IMPORT.test(s.spez)) &&
        VERTRAG_AUFRUF.test(text),
    };
  });
}

/**
 * Die Schuldner: Lader OHNE Vertrag und ohne Eintrag im Altbestand — jeder mit DATEI UND ZEILE der
 * Ladestelle, damit der Befund den Weg zur Stelle weist statt nur einen Dateinamen zu nennen.
 * Eigene Funktion, weil W3/A und die Kalibrierung W5 dieselbe Auswertung fahren müssen.
 */
function offeneSchuldner(
  befunde: readonly Befund[],
  altbestand: ReadonlyMap<string, string>,
): string[] {
  return befunde
    .filter((b) => b.ladestellen.length > 0 && !b.ruftVertrag && !altbestand.has(b.datei))
    .flatMap((b) => b.ladestellen.map((s) => `${b.datei}:${s.zeile} · ${s.spez}`));
}

const BEFUNDE = erhebeBefunde(WERKZEUGORDNER, WURZEL);
const LADER = BEFUNDE.filter((b) => b.ladestellen.length > 0);

// ================================================================================================
// DER ALTBESTAND — UND WARUM ER LEER IST.
// ================================================================================================
//
// Hier stünden die Werkzeuge, die die App-Wurzel laden und den Vertrag NICHT rufen: namentlich, mit
// Grund, als Auskunft für den, der aufräumt. Die Messung am Basisstand 56d2995 hat GENAU EINEN
// Lader gefunden (`tools/bodytext-nachziehen.ts`), und dieser Auftrag hat ihn bezahlt. Die Messung
// in Runde 3 mit dem breiteren Gang (jede Modulendung, Syntaxbaum) hat KEINEN weiteren gefunden:
// unter `tools/` nennt ausser `bodytext-nachziehen.ts` keine Datei `services/app` in einem
// Importspezifizierer — die einzige weitere Erwähnung steht in einem Kommentar
// (`tools/anhang-herkunft-feststellen.ts:6`, `services/app/src/sichtbarkeit.ts`) und ist keine Ladestelle.
//
// DESHALB IST DIESE LISTE LEER — und das ist ein gemessener Befund, kein weggelassener Fall.
// Die Schranke steht trotzdem in BEIDE Richtungen und ist scharf:
//   · Ein NEUER Lader ohne Vertrag und ohne Eintrag macht W3/A rot („neu im Baum, nicht im
//     Altbestand").
//   · Ein Eintrag, dessen Datei den Vertrag ruft, macht W3/B rot („steht im Altbestand, ruft den
//     Vertrag aber") — ein Register, das Gespenster verwaltet, ist grün und nutzlos
//     (Lehre aus JOB 3550/3562, s. tests/adresse-ist-kein-pfad/adresse-ist-kein-pfad.test.ts:100-105).
const ALTBESTAND: ReadonlyMap<string, string> = new Map<string, string>([]);

// ================================================================================================
// DIE KALIBRIERUNG DES GANGS — echte Dateien, alle drei Schreibweisen (W5).
// ================================================================================================
//
// WARUM ES DIESEN FALL GIBT. W3 und W4 fragen denselben Gang, der auch die Namensliste erzeugt hat:
// findet er nichts, sind beide grün — genau so blieb die Lücke aus Runde 2 unsichtbar (der Prüfer
// legte `tools/ben-startvertrag-probe.ts` mit `import('../services/app/src/build-app.js')` an; der
// Prozess lud die App-Wurzel wirklich, der Wächter meldete 5 grüne Fälle). Deshalb bekommt der Gang
// hier einen BAUM MIT BEKANNTER ANTWORT: sieben Lader in allen Schreibweisen, die im Bestand
// vorkommen können, und zwei Gegenfälle. Die erwarteten Zeilen sind von Hand gezählt und stehen
// neben dem Inhalt — sie stammen NICHT aus der Suche, die sie prüfen sollen.
interface Kalibrierfall {
  readonly datei: string;
  readonly zeilen: readonly string[];
  /** Erwarteter Befund `<Zeile> · <Spezifizierer>` — oder `undefined`: kein Schuldner. */
  readonly erwartet: string | undefined;
  readonly warum: string;
}

const KALIBRIERFAELLE: readonly Kalibrierfall[] = [
  {
    datei: "tools/k1-ohne-endung.ts",
    zeilen: [
      "// K1 — endungsloser Spezifizierer, dynamisch geladen.",
      "if (process.argv[1] !== undefined) {",
      '  await import("../services/app/src/build-app");',
      "}",
    ],
    erwartet: "3 · ../services/app/src/build-app",
    warum: "die Schreibweise des heutigen Bestands",
  },
  {
    datei: "tools/k2-punkt-ts.ts",
    zeilen: [
      "// K2 — statischer Import mit .ts.",
      'import { buildPgServices } from "../services/app/src/build-app.ts";',
      "if (process.argv[1] !== undefined) { buildPgServices(); }",
    ],
    erwartet: "2 · ../services/app/src/build-app.ts",
    warum: "der statische Weg, den W1 für das Werkzeug selbst verbietet",
  },
  {
    datei: "tools/k3-punkt-js.ts",
    zeilen: [
      "// K3 — .js: unter ESM die richtige Schreibweise für eine .ts-Quelle, tsx löst sie auf.",
      "// GENAU dieser Fall blieb in Runde 2 unerkannt, obwohl der Prozess die App-Wurzel lud.",
      "if (process.argv[1] !== undefined) {",
      '  await import("../services/app/src/build-app.js");',
      "}",
    ],
    erwartet: "4 · ../services/app/src/build-app.js",
    warum: "die gemessene Lücke aus Runde 2",
  },
  {
    datei: "tools/unterordner/k4-schnittstelle.mjs",
    zeilen: [
      "// K4 — die öffentliche Modulschnittstelle, aus einem Unterordner.",
      'import { buildApp } from "../../services/app/index.js";',
      "if (process.argv[1] !== undefined) { buildApp(); }",
    ],
    erwartet: "2 · ../../services/app/index.js",
    warum: "wer `services/app` lädt, lädt die Wurzel mit; und der Gang steigt in Unterordner",
  },
  {
    datei: "tools/k5-require.cjs",
    zeilen: [
      "// K5 — CommonJS.",
      'const { buildPgServices } = require("../services/app/src/build-app.js");',
      "if (process.argv[1] !== undefined) { buildPgServices(); }",
    ],
    erwartet: "2 · ../services/app/src/build-app.js",
    warum: "`require` ist derselbe Einstieg wie `import`",
  },
  {
    datei: "tools/k6-starter.sh",
    zeilen: [
      "#!/bin/sh",
      "# K6 — Schalenskript, keine Moduldatei: hier zählen die Zeichenketten der Zeile.",
      "node -e \"await import('../services/app/src/build-app.js')\"",
    ],
    erwartet: "3 · ../services/app/src/build-app.js",
    warum: "ein Starter ohne Modulendung ist derselbe Einstiegspunkt",
  },
  {
    datei: "tools/k7-pfad-in-variable.ts",
    zeilen: [
      "// K7 — der Pfad liegt erst in einer Variablen. Auch das ist eine Ladestelle; deshalb liest",
      "// die Sonde JEDE Zeichenkette einer Moduldatei und nicht nur Importspezifizierer.",
      'const wurzelpfad = "../services/app/src/build-app.js";',
      "if (process.argv[1] !== undefined) {",
      "  await import(wurzelpfad);",
      "}",
    ],
    erwartet: "3 · ../services/app/src/build-app.js",
    warum: "die halbdynamische Form, die ein reiner Import-Gang verlöre",
  },
  {
    datei: "tools/n1-nachbarname.ts",
    zeilen: [
      "// N1 — KEIN Lader: eine Erwähnung im Kommentar (../services/app/src/build-app) und ein",
      "// Nachbarname sind keine Ladestelle. Ohne diesen Fall wäre auch ein Gang grün, der alles",
      "// anschlägt und dessen Zeilenangabe nichts wert ist.",
      'import { berichte } from "../services/app/src/build-app-bericht.ts";',
      "if (process.argv[1] !== undefined) { berichte(); }",
    ],
    erwartet: undefined,
    warum: "Gegenrichtung: der Gang darf nicht alles anschlagen",
  },
  {
    datei: "tools/n2-bezahlt.ts",
    zeilen: [
      "// N2 — Lader, der den Vertrag ruft: kein Schuldner. Ohne diesen Fall wäre nicht gemessen,",
      "// dass die Bezahlung überhaupt erkannt wird.",
      'import { pruefeStartvertrag } from "../services/app/src/start-vertrag.js";',
      "if (process.argv[1] !== undefined) {",
      "  pruefeStartvertrag(process.env);",
      '  await import("../services/app/src/build-app.js");',
      "}",
    ],
    erwartet: undefined,
    warum: "Gegenrichtung: wer bezahlt hat, wird nicht gemeldet",
  },
];

/** Der Kalibrierbaum liegt ausserhalb des Arbeitsbaums und wird nach dem Lauf gelöscht. */
const KALIBRIERWURZEL = mkdtempSync(join(tmpdir(), "job3797-kalibrierung-"));

function legeKalibrierbaumAn(): Befund[] {
  for (const fall of KALIBRIERFAELLE) {
    const ziel = join(KALIBRIERWURZEL, fall.datei);
    mkdirSync(dirname(ziel), { recursive: true });
    writeFileSync(ziel, `${fall.zeilen.join("\n")}\n`, "utf8");
  }
  return erhebeBefunde(join(KALIBRIERWURZEL, "tools"), KALIBRIERWURZEL);
}

afterAll(() => {
  rmSync(KALIBRIERWURZEL, { recursive: true, force: true });
});

// ================================================================================================
// DIE AST-SONDEN — für W1 und W2 reicht Textsuche nicht.
// ================================================================================================
// „Der Vertrag steht VOR dem Verbindungs-String" ist eine Aussage über die REIHENFOLGE VON
// ANWEISUNGEN IN `main()`. Eine Textsuche misst die Reihenfolge von Zeichen in der Datei und wäre
// auch dann grün, wenn der Aufruf in einem Kommentar oder in einer anderen Funktion stünde.
// Der Syntaxbaum beantwortet die Frage, die gestellt ist. `typescript` ist im Bestand das übliche
// Werkzeug dafür (u. a. tests/capture/aufrufer-waechter.test.ts).
function quelltext(datei: string): ts.SourceFile {
  return ts.createSourceFile(
    datei,
    readFileSync(join(WURZEL, datei), "utf8"),
    ts.ScriptTarget.ESNext,
    true,
  );
}

function zeileVon(sf: ts.SourceFile, pos: number): number {
  return sf.getLineAndCharacterOfPosition(pos).line + 1;
}

function sammle(wurzel: ts.Node, treffer: (n: ts.Node) => boolean): ts.Node[] {
  const gefunden: ts.Node[] = [];
  const geh = (n: ts.Node): void => {
    if (treffer(n)) {
      gefunden.push(n);
    }
    n.forEachChild(geh);
  };
  geh(wurzel);
  return gefunden;
}

function findeFunktion(sf: ts.SourceFile, name: string): ts.FunctionDeclaration | undefined {
  return sammle(sf, (n) => ts.isFunctionDeclaration(n) && n.name?.text === name)[0] as
    | ts.FunctionDeclaration
    | undefined;
}

/** Ein Aufruf `bezeichner(...)` — die Stelle, an der er steht. */
function aufrufe(wurzel: ts.Node, bezeichner: string): ts.Node[] {
  return sammle(
    wurzel,
    (n) =>
      ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === bezeichner,
  );
}

/** Der Spezifizierer eines `import("…")`-Ausdrucks — oder `undefined`, wenn es keiner ist. */
function dynamischerSpezifizierer(n: ts.Node): string | undefined {
  if (!ts.isCallExpression(n) || n.expression.kind !== ts.SyntaxKind.ImportKeyword) {
    return undefined;
  }
  const erstes = n.arguments[0];
  return erstes !== undefined && ts.isStringLiteralLike(erstes) ? erstes.text : undefined;
}

/** Ein `await import("…build-app…")` bzw. `import("…build-app…")`. */
function dynamischeAppWurzelLadungen(wurzel: ts.Node): ts.Node[] {
  return sammle(wurzel, (n) => {
    const spez = dynamischerSpezifizierer(n);
    return spez !== undefined && APP_WURZEL_WEGE.some((r) => r.test(spez));
  });
}

/** Statische `import … from "…"`-Anweisungen mit ihrem Spezifizierer. */
function statischeSpezifizierer(sf: ts.SourceFile): { spez: string; pos: number }[] {
  const liste: { spez: string; pos: number }[] = [];
  for (const anweisung of sf.statements) {
    if (ts.isImportDeclaration(anweisung) && ts.isStringLiteralLike(anweisung.moduleSpecifier)) {
      liste.push({ spez: anweisung.moduleSpecifier.text, pos: anweisung.getStart(sf) });
    }
  }
  return liste;
}

/** Ein Lesezugriff `process.env.<NAME>`. */
function envZugriffe(wurzel: ts.Node, name: string): ts.Node[] {
  return sammle(wurzel, (n) => ts.isPropertyAccessExpression(n) && n.name.text === name);
}

describe("JOB 3797 · der Startvertrag am vierten Einstiegspunkt", () => {
  it("W1 · das Werkzeug ruft den Vertrag in main() — vor dem Verbindungs-String und vor der App-Wurzel", () => {
    const sf = quelltext(WERKZEUG);
    const main = findeFunktion(sf, "main");
    expect(
      main,
      `${WERKZEUG} hat keine Funktion \`main()\` mehr — der Wächter misst ins Leere.`,
    ).toBeDefined();
    const rumpf = (main as ts.FunctionDeclaration).body;
    expect(rumpf, `${WERKZEUG} · \`main()\` hat keinen Rumpf.`).toBeDefined();
    const body = rumpf as ts.Block;

    // (a) Der Vertrag wird überhaupt in `main()` gerufen.
    const vertrag = aufrufe(body, "pruefeStartvertrag");
    expect(
      vertrag.length,
      `${WERKZEUG} · \`main()\` ruft \`pruefeStartvertrag\` nicht (0 Aufrufe im Rumpf, ` +
        `main() beginnt in Zeile ${zeileVon(sf, body.getStart(sf))}).${WEG_ZURUECK}`,
    ).toBeGreaterThan(0);
    const vertragPos = Math.min(...vertrag.map((n) => n.getStart(sf)));

    // (b) Er kommt aus der VORHANDENEN Datei — keine zweite Wahrheit, keine Kopie der Meldung.
    const herkunft = statischeSpezifizierer(sf).filter((i) => VERTRAG_IMPORT.test(i.spez));
    const dynamischerVertrag = sammle(sf, (n) => {
      const spez = dynamischerSpezifizierer(n);
      return spez !== undefined && VERTRAG_IMPORT.test(spez);
    });
    expect(
      herkunft.length + dynamischerVertrag.length,
      `${WERKZEUG} · \`pruefeStartvertrag\` wird gerufen, aber nicht aus ` +
        `services/app/src/start-vertrag importiert — das wäre ein zweiter Vertragsweg.${WEG_ZURUECK}`,
    ).toBeGreaterThan(0);

    // (c) VOR dem Lesen des Verbindungs-Strings.
    const dbZugriffe = envZugriffe(body, "KLARWERK_DB_URL");
    expect(
      dbZugriffe.length,
      satz(
        `${WERKZEUG} · \`main()\` liest \`process.env.KLARWERK_DB_URL\` nicht mehr — dieser Fall `,
        "misst dann keine Reihenfolge. Sonde nachführen.",
      ),
    ).toBeGreaterThan(0);
    const dbPos = Math.min(...dbZugriffe.map((n) => n.getStart(sf)));
    expect(
      vertragPos,
      `${WERKZEUG} · der Vertrag steht in Zeile ${zeileVon(sf, vertragPos)}, der Verbindungs-String ` +
        `wird schon in Zeile ${zeileVon(sf, dbPos)} gelesen. Die eigene Meldung nennt EINEN Namen, ` +
        `der Vertrag nennt ALLE — der Vertrag gehört davor.${WEG_ZURUECK}`,
    ).toBeLessThan(dbPos);

    // (d) VOR jedem Laden der App-Wurzel — dynamisch wie statisch.
    for (const ladung of dynamischeAppWurzelLadungen(sf)) {
      const pos = ladung.getStart(sf);
      expect(
        vertragPos,
        `${WERKZEUG} · die App-Wurzel wird in Zeile ${zeileVon(sf, pos)} geladen, der Vertrag steht ` +
          `erst in Zeile ${zeileVon(sf, vertragPos)}. Dann wirft der Modulrumpf von build-app ` +
          `zuerst — genau die Stapelspur, gegen die dieser Auftrag steht.${WEG_ZURUECK}`,
      ).toBeLessThan(pos);
    }
    const statischeWurzel = statischeSpezifizierer(sf).filter((i) =>
      APP_WURZEL_WEGE.some((r) => r.test(i.spez)),
    );
    expect(
      statischeWurzel.map((i) => `${i.spez} (Zeile ${zeileVon(sf, i.pos)})`),
      satz(
        `${WERKZEUG} · die App-Wurzel darf NICHT statisch importiert werden: ein Modulimport `,
        "läuft VOR der ersten Anweisung von `main()` — der Vertrag käme wieder zu spät, und der ",
        `Kopfkommentar :152-153 begründet den dynamischen Import ausdrücklich.${WEG_ZURUECK}`,
      ),
    ).toEqual([]);
  });

  it("W2 · der CLI-Riegel fängt den Wurf — kein blosses `void main()`", () => {
    const sf = quelltext(WERKZEUG);
    // Die Deklaration ist keine `CallExpression` — gefunden werden nur echte Aufrufe.
    const mainAufrufe = aufrufe(sf, "main");
    expect(
      mainAufrufe.length,
      `${WERKZEUG} · es gibt keinen Aufruf von \`main()\` mehr — der CLI-Riegel ist weg.${WEG_ZURUECK}`,
    ).toBeGreaterThan(0);

    const nackt = mainAufrufe.filter((n) => {
      const eltern = n.parent;
      // `void main()` — der Fall vor diesem Auftrag.
      if (eltern !== undefined && eltern.kind === ts.SyntaxKind.VoidExpression) {
        return true;
      }
      // `main().catch(…)` — der Fänger. Alles andere gilt als ungefangen.
      return !(
        eltern !== undefined &&
        ts.isPropertyAccessExpression(eltern) &&
        eltern.name.text === "catch"
      );
    });
    expect(
      nackt.map((n) => `Zeile ${zeileVon(sf, n.getStart(sf))}: ${n.parent?.getText(sf).trim()}`),
      satz(
        `${WERKZEUG} · der CLI-Riegel ruft \`main()\` ohne \`.catch(…)\`. Was in \`main()\` wirft — `,
        "und der Startvertrag wirft dort — wird zur unbehandelten Zurückweisung: zwölf Zeilen ",
        `Stapelspur mit \`at ModuleJob.run\` statt eines Satzes.${WEG_ZURUECK}`,
      ),
    ).toEqual([]);

    // Anti-Vakuum: der Fänger muss auch etwas AUSGEBEN und den Exit setzen, sonst schluckt er nur.
    const riegel = readFileSync(join(WURZEL, WERKZEUG), "utf8");
    const fangblock = riegel.slice(riegel.indexOf("main()"));
    expect(
      /process\.stderr\.write/.test(fangblock),
      `${WERKZEUG} · der Fänger schreibt nichts auf stderr — ein stiller Abbruch ist schlimmer als ` +
        `eine Stapelspur.${WEG_ZURUECK}`,
    ).toBe(true);
    expect(
      /process\.exitCode\s*=/.test(fangblock),
      `${WERKZEUG} · der Fänger setzt keinen Exit-Code — der Prozess endete mit 0 und ein ` +
        `Aufrufskript hielte den Abbruch für Erfolg.${WEG_ZURUECK}`,
    ).toBe(true);
  });

  it("W3/A · jedes Werkzeug, das die App-Wurzel lädt, ruft den Vertrag oder steht im Altbestand", () => {
    expect(
      offeneSchuldner(BEFUNDE, ALTBESTAND),
      satz(
        "neu im Baum, nicht im Altbestand (Datei:Zeile · Spezifizierer): diese Werkzeuge laden ",
        `\`services/app/src/build-app\`, rufen den Startvertrag aber nicht.${WEG_ZURUECK}`,
      ),
    ).toEqual([]);
  });

  it("W3/B · wer seine Schuld bezahlt hat, fliegt aus dem Altbestand", () => {
    const bezahlt = [...ALTBESTAND.keys()].filter(
      (d) => BEFUNDE.find((b) => b.datei === d)?.ruftVertrag === true,
    );
    expect(
      bezahlt,
      "steht im Altbestand, ruft den Vertrag aber — der Eintrag ist ein Gespenst und gehört gelöscht.",
    ).toEqual([]);
    const verschwunden = [...ALTBESTAND.keys()].filter(
      (d) => BEFUNDE.find((b) => b.datei === d) === undefined,
    );
    expect(
      verschwunden,
      "steht im Altbestand, die Datei gibt es nicht mehr — der Eintrag gehört gelöscht.",
    ).toEqual([]);
  });

  it("W4 · die Prüfmenge ist festgenagelt — ein weggefallener Gang fällt auf", () => {
    // Am Basisstand 56d2995 gemessen: 28 Dateien unter `tools/`, davon 12 Moduldateien
    // (.ts/.mjs). Geprüft wird eine UNTERGRENZE und nicht die genaue Zahl: ein fremder Auftrag,
    // der ein neues Werkzeug anlegt, darf diesen Wächter nicht rot machen — die scharfe Schranke
    // in beide Richtungen ist W3 und die Namensmenge unten, nicht die Gesamtzahl.
    const GEMESSEN_DATEIEN = 28;
    const GEMESSEN_MODULE = 12;
    expect(
      BEFUNDE.length,
      `Der Gang unter tools/ findet nur ${BEFUNDE.length} Dateien, am Basisstand waren es ` +
        `${GEMESSEN_DATEIEN}. Entweder ist der Ordner leergeräumt oder der Gang ist kaputt.`,
    ).toBeGreaterThanOrEqual(GEMESSEN_DATEIEN);
    expect(
      BEFUNDE.filter((b) => b.istModul).length,
      "Der Gang findet keine Moduldateien mehr — die Endungsliste passt nicht mehr zum Bestand.",
    ).toBeGreaterThanOrEqual(GEMESSEN_MODULE);

    // Die Namensmenge der Lader — EXAKT, in beide Richtungen. Ein neuer Lader gehört gemessen und
    // hier eingetragen (und trägt dann entweder den Vertrag oder einen Altbestandseintrag).
    expect(LADER.map((b) => b.datei)).toEqual([WERKZEUG]);

    // Und die Einstiegspunkte im Sinn von JOB 3776 Lieferpunkt 1: Lader MIT CLI-Riegel.
    expect(LADER.filter((b) => b.hatCliRiegel).map((b) => b.datei)).toEqual([WERKZEUG]);

    // Die gemeldete ZEILE zeigt auf die wirkliche Ladestelle — geprüft am Quelltext selbst, nicht
    // an derselben Suche. Ohne das wäre `Datei:Zeile` im Befund eine Zahl ohne Deckung.
    const quellzeilen = readFileSync(join(WURZEL, WERKZEUG), "utf8").split("\n");
    const stellen = LADER.flatMap((b) => b.ladestellen);
    expect(stellen.length, `${WERKZEUG} · keine Ladestelle gefunden — der Gang misst nichts.`).toBe(
      1,
    );
    for (const stelle of stellen) {
      expect(
        quellzeilen[stelle.zeile - 1] ?? "",
        `${WERKZEUG} · die gemeldete Zeile ${stelle.zeile} enthält gar keine Ladestelle.`,
      ).toContain("build-app");
    }

    // Anti-Vakuum: der Gang muss Dateien wirklich GELESEN haben. Sechs Werkzeuge tragen heute einen
    // CLI-Riegel, ohne die App-Wurzel zu laden — findet der Gang sie nicht, misst er nichts.
    expect(
      BEFUNDE.filter((b) => b.hatCliRiegel && b.ladestellen.length === 0).length,
      "Kein einziges Werkzeug mit CLI-Riegel ohne App-Wurzel gefunden — die Sonde greift nicht.",
    ).toBeGreaterThanOrEqual(5);
  });

  it("W5 · KALIBRIERUNG: ein neuer vertragsloser Lader wird in JEDER Schreibweise gefunden", () => {
    const befunde = legeKalibrierbaumAn();
    expect(
      befunde.map((b) => b.datei).sort(),
      "der Gang findet die angelegten Dateien nicht wieder — er liest den Ordner nicht richtig.",
    ).toEqual(KALIBRIERFAELLE.map((f) => f.datei).sort());

    // DER KERN: dieselbe Auswertung, die W3/A fährt, gegen einen Baum mit bekannter Antwort.
    const erwartet = KALIBRIERFAELLE.filter((f) => f.erwartet !== undefined)
      .map((f) => `${f.datei}:${String(f.erwartet)}`)
      .sort();
    const fallliste = KALIBRIERFAELLE.map(
      (f) => `  ${f.datei} → ${f.erwartet ?? "KEIN Schuldner"} (${f.warum})`,
    ).join("\n");
    expect(
      offeneSchuldner(befunde, new Map<string, string>()).sort(),
      satz(
        "der Gang findet nicht genau die Lader, die angelegt wurden. Fehlt einer, ist die Sonde zu ",
        "eng (Runde 2: `.js` fehlte); steht einer zu viel drin, schlägt sie auf Erwähnungen an und ",
        `ihre Zeilenangabe ist wertlos. Die Fälle:\n${fallliste}${WEG_ZURUECK}`,
      ),
    ).toEqual(erwartet);

    // Die Sonde für „läuft als eigener Prozess" wird mitkalibriert: alle Modulfälle tragen einen
    // CLI-Riegel. Findet sie ihn hier nicht, wäre auch W4s Einstiegspunktmenge nichts wert.
    expect(
      befunde.filter((b) => b.istModul && !b.hatCliRiegel).map((b) => b.datei),
      "der CLI-Riegel wird nicht erkannt — die Einstiegspunktmenge in W4 misst dann nichts.",
    ).toEqual([]);

    // Und die Gegenrichtungen einzeln, damit die Meldung sagt, WELCHE Sonde falsch liegt.
    const nachbarname = befunde.find((b) => b.datei === "tools/n1-nachbarname.ts");
    expect(
      nachbarname?.ladestellen ?? [],
      "ein Kommentar und ein Nachbarname gelten als Ladestelle — der Gang schlägt zu breit an.",
    ).toEqual([]);
    const bezahlt = befunde.find((b) => b.datei === "tools/n2-bezahlt.ts");
    expect(
      bezahlt?.ladestellen.length ?? 0,
      "der bezahlte Fall gilt gar nicht als Lader — dann prüft seine Ausnahme nichts.",
    ).toBeGreaterThan(0);
    expect(
      bezahlt?.ruftVertrag,
      "ein Werkzeug, das `pruefeStartvertrag` importiert UND ruft, gilt nicht als bezahlt.",
    ).toBe(true);
  });
});
