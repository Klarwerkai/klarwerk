// ================================================================================================
// JOB 3776 · R2 — DER ORT DES VERTRAGSAUFRUFS, NICHT NUR SEINE WIRKUNG.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. `echter-serverstart.test.ts` misst die WIRKUNG am laufenden Prozess:
// eine erste Zeile in der Form `Serverstart fehlgeschlagen: …`. Das ist die Zusage an den
// Betreiber, und sie ist die wichtigere Hälfte. Sie allein trägt aber nicht: dieselbe Zeile
// entstünde auch, wenn der Vertrag irgendwo anders im Ablauf stünde und der Fänger sie zufällig
// noch erwischte. Diese Datei nagelt deshalb den ORT fest.
//
// DER RÜCKFALL, GEGEN DEN SIE STEHT (JOB 3655 Runde 2, `build-app.ts` Zeile 286): Der Vertrag stand
// im MODULRUMPF von `build-app.ts` — also in dem Code, der beim `import` läuft. Ein Wurf von dort
// geschieht, BEVOR die erste Anweisung von `server.ts` ausgeführt wird, und erreicht den Fänger um
// `start()` (server.ts, `start().catch(...)`) deshalb nie. Der Betreiber bekam eine Stapelspur aus
// dem Modulladen. Gemessen am Stand 8208f57, wörtlich die erste Zeile:
//   `/…/services/app/src/start-vertrag.ts:927`
// statt der gewohnten Form. Wer den Aufruf dorthin zurückschiebt, macht diese Datei rot.
//
// ------------------------------------------------------------------------------------------------
// RUNDE 2, KORREKTURPFLICHT 1 — WARUM HIER JETZT EIN PARSER STEHT UND KEINE SPALTENPRÜFUNG MEHR.
// ------------------------------------------------------------------------------------------------
//
// DER BEFUND (BEN, Runde 1): Runde 1 setzte „Modulebene" mit „Spalte 0" gleich — sie prüfte, ob die
// Zeile mit `pruefeStartvertrag(` BEGINNT. BEN hat das widerlegt, indem er den Aufruf mit ZWEI
// FÜHRENDEN LEERZEICHEN in den Modulrumpf schrieb: Der Wächter blieb grün, der Aufruf lief aber
// weiterhin beim Import, und F5 wurde rot. Einrückung bestimmt in TypeScript keinen
// Gültigkeitsbereich — eine Prüfung, die daran hängt, prüft die Formatierung und nicht die Lage.
//
// DESHALB WIRD JETZT GEPARST. `ts.createSourceFile` liefert den echten Syntaxbaum; `vertragsaufrufe`
// unten bestimmt für JEDEN Aufruf die umschliessende Funktion. Steht keine dazwischen, läuft der
// Aufruf beim Import — unabhängig davon, wie tief die Zeile eingerückt ist, ob er in einem
// `if`-Block steht oder in einer sofort aufgerufenen Funktion (IIFE). R2/5 kalibriert genau das
// gegen den ECHTEN Quelltext von `build-app.ts`.
//
// SIE LIEST QUELLTEXT, und das ist hier kein Notbehelf, sondern der Gegenstand: „an welcher Stelle
// steht der Aufruf" ist eine Eigenschaft des Quelltextes. Zur Laufzeit ist sie nicht beobachtbar,
// ohne genau die Ausgabe zu messen, die R1 schon misst.
//
// DIE MENGE DER EINSTIEGSPUNKTE steht seit JOB 3828 an GENAU EINER Stelle in dieser Datei und wird
// nicht mehr im Fliesstext wiederholt: `ERWARTETE_EINSTIEGSPUNKTE` unten, mit der Begründung je
// Pfad. Dort stand bis JOB 3828 zweimal dasselbe — einmal hier als Prosa, einmal in den Fällen —,
// und zwei Aufzählungen derselben Sache laufen auseinander.
//
// NICHT in dieser Menge, entgegen dem alten Kommentar in `build-app.ts` (Zeile 278–279), der drei
// Einstiegspunkte nannte: `services/app/src/dev-persist.ts`. Die Datei hat KEINE Anweisung auf
// Modulebene und keinen CLI-Riegel — sie ist eine Bibliothek, die `server.ts` (Zeile 8) importiert.
// Gemessen: `node --import tsx services/app/src/dev-persist.ts` mit `NODE_ENV=test` endet mit 0 und
// gibt nichts aus. Sie war nie ein Einstiegspunkt; der Vertrag gehört dort nicht hin.
//
// ------------------------------------------------------------------------------------------------
// JOB 3828 — DIE ZWEI LÜCKEN, DIE BEN IN RUNDE 2 VON JOB 3776 BENANNT HAT, SIND GESCHLOSSEN.
// ------------------------------------------------------------------------------------------------
//
// LÜCKE 1 — DIE KLASSE WAR EINE GRENZE, AUCH DORT, WO SIE KEINE IST. `ortFuer` gab für einen Aufruf
// in `static { … }` den KLASSENNAMEN zurück: die Elternkette lautet CallExpression →
// ExpressionStatement → Block → ClassStaticBlockDeclaration → ClassDeclaration, und nur die
// `ClassDeclaration` stand in `istFunktionsartig`. Ein statischer Initialisierer läuft aber, wenn
// die KLASSENDEFINITION ausgewertet wird — steht die Klasse auf Modulebene, ist das beim `import`,
// genau wie die nackte Anweisung aus JOB 3655, gegen die diese Datei angetreten ist.
//
// DIE REGEL, DIE JETZT GILT: Läuft der Weg vom Aufruf nach oben durch einen
// `ClassStaticBlockDeclaration` oder durch eine `PropertyDeclaration` mit `static`-Modifikator, so
// VERBRAUCHT er die nächste Grenze darüber — die Klasse, an der der Initialisierer hängt — und sucht
// weiter nach einer echten, nicht sofort aufgerufenen Funktion; findet er keine, ist der Ort
// MODULRUMPF. Alles andere an der Klasse bleibt Grenze: Methode, Konstruktor, Zugriffsfunktion und
// der NICHT-statische Feldinitialisierer (`wert = …` läuft erst bei `new X()`, nicht beim Import).
// R2/6 kalibriert beide Richtungen am echten Quelltext von `build-app.ts`.
//
// LÜCKE 2 — DIE EINSTIEGSPUNKTE WAREN EINE MOMENTAUFNAHME. R2/7 sucht sie jetzt selbst: rekursiv
// über `services/**` und `tools/**` (`quelldateien`), und die Aufnahme entscheidet der Syntaxbaum
// (`einstiegspunkte`), nicht eine Textsuche.
//
// DIE AUFNAHMEREGEL, WÖRTLICH — das ist die Reichweite, nicht mehr und nicht weniger: aufgenommen
// wird, wer `build-app` SELBST als Modul nennt (statischer `import`, `export … from` oder
// dynamischer `import("…")`, mit oder ohne Dateiendung) UND beim Laden etwas TUT (eine Anweisung auf
// Modulebene, die ausführt — auch ein Initialisierer wie `const x = buildServices()` — oder ein
// Direktaufruf-Riegel gegen `process.argv[1]`/`import.meta.url`). Beide Hälften dieser Regel sind in
// R2/8 einzeln kalibriert, in BEIDE Richtungen; die MENGE misst R2/7 am echten Baum.
//
// BEIDE HÄLFTEN WAREN IN RUNDE 1 ZU ENG, und BEN hat es gemessen, nicht vermutet: (1) der
// Modulbezeichner musste endungslos sein, `./…/build-app.js` blieb in allen drei Importformen
// unsichtbar; (2) jede Variablenanweisung galt als reine Deklaration, `const services =
// buildServices()` blieb damit unsichtbar. Beides ist behoben und in R2/8 belegt.
//
// ------------------------------------------------------------------------------------------------
// JOB 3937 — DAS ENUM MIT BERECHNETEM GLIED LÄUFT BEIM LADEN, UND JETZT WIRD ES AUCH SO GEZÄHLT.
// ------------------------------------------------------------------------------------------------
//
// DER BEFUND (BEN im GRÜN-Urteil von JOB 3828, Prüfpunkt 6): eine `enum`-Deklaration fiel in
// `hatAusfuehrbareModulanweisung` in denselben Topf wie `interface` und `type` und galt pauschal als
// reine Deklaration. Für `interface` und `type` stimmt das — sie verschwinden bei der Übersetzung
// restlos. Für `enum X { A = f() }` stimmt es NICHT: daraus wird eine Zuweisung, die `f()` beim
// Laden des Moduls ruft. Ein Werkzeug, dessen einzige ausführende Anweisung so aussieht, blieb dem
// Inventar unsichtbar und hätte den Startvertrag verletzen können, ohne dass etwas rot wird.
//
// WAS JETZT GILT: ein Enum zählt genau dann als ausführende Modulanweisung, wenn mindestens EIN
// Glied einen Initialisierer hat, für den `wirktBeimLaden` wahr ist — dieselbe EINE Stelle, die das
// auch für Variablenanweisung, Klasse und `export default` entscheidet. Es gibt also keine zweite
// Auffassung von „läuft beim Laden" in dieser Datei. WEITERHIN NICHT gezählt: ein rein konstantes
// Enum (`enum S { Eins = 1, Zwei = Eins + 1 }` führt nichts aus), ein `declare enum` (umgebend, gibt
// keinen Code aus) und ein `const enum` (wird eingesetzt; berechnete Glieder sind dort gar nicht
// übersetzbar). Und die ERSTE Hälfte der Aufnahmeregel bleibt Bedingung: ein berechnetes Enum ohne
// `build-app`-Bezug macht seine Datei nicht zum Einstiegspunkt. Alle drei Richtungen misst R2/8
// (`tools/kp3-enum-berechnet.ts`, `tools/kp3-enum-konstant.ts`, `tools/kp3-enum-ohne-buildapp.ts`).
//
// WAS AUCH JETZT NICHT GEMESSEN WIRD — damit diese Datei nicht mehr behauptet, als sie prüft. Was
// hier steht, ist eine SYNTAKTISCHE Inventarerkennung am Quelltext und ausdrücklich KEINE
// vollständige Laufzeitanalyse: entschieden wird an der Form der Anweisung, nicht daran, was ein
// Ausdruck zur Laufzeit wirklich täte. Jede Grenze nennt deshalb, WER sie sonst deckt:
//   (a) EINE INDIREKTE LADEKETTE. Aufgenommen wird nur, wer `build-app` SELBST als Modul nennt.
//       Eine Datei, die X lädt, und X lädt `build-app`, bleibt unsichtbar (bewusst, JOB 3828 §10).
//       Ebenso unsichtbar bleibt ein Bezeichner, der erst zur Laufzeit entsteht
//       (`import(`./${name}`)`) — kein heutiger Pfad tut das. WER DECKT ES SONST: niemand. Weder
//       Lint noch dependency-cruiser fragen nach dem Startvertrag; eine solche Datei fiele erst im
//       Betrieb auf, und genau dort mit der Stapelspur, gegen die diese Datei antritt.
//   (b) OB EIN EINSTIEGSPUNKT DEN VERTRAG TRÄGT. R2/7 prüft nur, ob er BEKANNT ist. Das ist
//       Absicht und keine Nachlässigkeit: `tools/bodytext-nachziehen.ts` steht in der Menge, und ob
//       es `pruefeStartvertrag` ruft, entscheidet JOB 3797 — R2/7 bleibt in BEIDE Richtungen
//       unberührt davon und wird durch dessen Einbau weder rot noch grün.
//   (c) EIN EINSTIEGSPUNKT AUSSERHALB VON `services/**` UND `tools/**` — etwa unter `apps/`.
//       WER DECKT ES SONST: niemand; der Suchraum steht in `SUCHORDNER` und wird dort begründet.
//   (d) DIE LAUFZEIT. Ort und Menge sind Eigenschaften des Quelltextes; die WIRKUNG am laufenden
//       Prozess misst `echter-serverstart.test.ts`.
//   (e) DER RUMPF EINES `namespace` (JOB 3937). Ein Namensraum mit ausführbaren Anweisungen im
//       Rumpf läuft beim Laden genauso wie ein berechnetes Enum-Glied, wird hier aber weiterhin
//       pauschal verworfen (`ts.isModuleDeclaration`). Das ist eine BEKANNTE Lücke derselben Art,
//       bewusst nicht mitrepariert (JOB 3937 §10), und WER DECKT SIE SONST: niemand. Gemessen am
//       Stand dieser Runde steht unter `services/**` und `tools/**` überhaupt kein `namespace` —
//       und übrigens auch kein einziges `enum`: die Reparatur oben ändert die MENGE am echten Baum
//       darum nicht, sie verbreitert nur die Regel für den Tag, an dem eines dazukommt.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");

function quelltext(pfad: string): string {
  return readFileSync(join(WURZEL, pfad), "utf8");
}

function zeilen(pfad: string): string[] {
  return quelltext(pfad).split("\n");
}

/** Ist diese Zeile ausführbarer Code — also weder leer noch Kommentar? */
function istAnweisung(zeile: string): boolean {
  const t = zeile.trim();
  return t !== "" && !t.startsWith("//") && !t.startsWith("/*") && !t.startsWith("*");
}

const VERTRAGSNAME = "pruefeStartvertrag";
/** Der Ort, den `vertragsaufrufe` meldet, wenn keine Funktion den Aufruf umschliesst. */
const MODULRUMPF = "<Modulrumpf — läuft beim import>";

function istFunktionsartig(knoten: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(knoten) ||
    ts.isFunctionExpression(knoten) ||
    ts.isArrowFunction(knoten) ||
    ts.isMethodDeclaration(knoten) ||
    ts.isConstructorDeclaration(knoten) ||
    ts.isGetAccessorDeclaration(knoten) ||
    ts.isSetAccessorDeclaration(knoten) ||
    ts.isClassDeclaration(knoten) ||
    ts.isClassExpression(knoten)
  );
}

/**
 * JOB 3828 · LÜCKE 1 — LÄUFT DER RUMPF DIESES KNOTENS, WENN DIE UMSCHLIESSENDE KLASSENDEFINITION
 * AUSGEWERTET WIRD? Das sind genau zwei Formen: der statische Block `static { … }` und das statische
 * Feld `static x = …`. Beide laufen nicht erst bei `new X()` oder beim Aufruf einer Methode, sondern
 * mit der Klasse selbst — auf Modulebene also beim `import`.
 *
 * Der NICHT-statische Feldinitialisierer (`x = …`) steht bewusst NICHT hier: er läuft im
 * Konstruktor, und dort ist die Klasse zu Recht eine Grenze (R2/6 c).
 */
function istStatischeInitialisierung(knoten: ts.Node): boolean {
  if (ts.isClassStaticBlockDeclaration(knoten)) {
    return true;
  }
  return (
    ts.isPropertyDeclaration(knoten) &&
    knoten.modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) === true
  );
}

/**
 * Wird diese Funktion an Ort und Stelle SOFORT aufgerufen (IIFE)? Dann ist sie KEINE Grenze: ihr
 * Rumpf läuft beim Import genauso wie eine nackte Anweisung. `(() => { … })()` war der zweite Weg,
 * den eine reine Spaltenprüfung übersehen hätte.
 */
function sofortAufgerufen(fn: ts.Node): boolean {
  let kind: ts.Node = fn;
  let eltern: ts.Node | undefined = fn.parent;
  while (eltern !== undefined && ts.isParenthesizedExpression(eltern)) {
    kind = eltern;
    eltern = eltern.parent;
  }
  return eltern !== undefined && ts.isCallExpression(eltern) && eltern.expression === kind;
}

function nameVon(knoten: ts.Node): string {
  if (
    (ts.isFunctionDeclaration(knoten) ||
      ts.isMethodDeclaration(knoten) ||
      ts.isClassDeclaration(knoten)) &&
    knoten.name !== undefined
  ) {
    return knoten.name.getText();
  }
  const eltern = knoten.parent;
  if (eltern !== undefined && ts.isVariableDeclaration(eltern) && ts.isIdentifier(eltern.name)) {
    return eltern.name.text;
  }
  return "<anonyme Funktion>";
}

interface Vertragsaufruf {
  /** 1-basierte Zeilennummer des Aufrufs. */
  zeile: number;
  /** Die umschliessende Funktion — oder MODULRUMPF, wenn der Aufruf beim Import läuft. */
  ort: string;
}

/**
 * ALLE Aufrufe von `pruefeStartvertrag` in dieser Quelle, je mit dem Ort, an dem sie stehen.
 *
 * Der Ort wird über den SYNTAXBAUM bestimmt, nicht über Einrückung: es zählt die nächste
 * umschliessende Funktion, die nicht sofort aufgerufen wird. Gibt es keine, läuft der Aufruf beim
 * Import, und der Ort ist MODULRUMPF — egal ob die Zeile bei Spalte 0 beginnt oder eingerückt ist.
 */
function vertragsaufrufe(quelle: string, dateiname = "quelle.ts"): Vertragsaufruf[] {
  const datei = ts.createSourceFile(dateiname, quelle, ts.ScriptTarget.ESNext, true);
  const treffer: Vertragsaufruf[] = [];
  const ortFuer = (knoten: ts.Node): string => {
    // JOB 3828 · LÜCKE 1: Führt der Weg nach oben durch eine statische Initialisierung, dann läuft
    // der Aufruf mit der KLASSENDEFINITION — die Klasse ist dann keine Grenze, sondern Teil des
    // Weges. Der Merker VERBRAUCHT deshalb genau die eine Grenze über dem Initialisierer (das ist
    // im Baum immer die Klasse, an der er hängt) und gilt danach nicht mehr: weiter oben zählt
    // wieder die gewöhnliche Regel, sonst würde eine Klasse INNERHALB einer Funktion die Funktion
    // mitreissen (R2/6 d).
    let durchStatischeInitialisierung = false;
    let p: ts.Node | undefined = knoten.parent;
    while (p !== undefined) {
      if (istStatischeInitialisierung(p)) {
        durchStatischeInitialisierung = true;
      } else if (istFunktionsartig(p) && !sofortAufgerufen(p)) {
        if (durchStatischeInitialisierung) {
          durchStatischeInitialisierung = false;
        } else {
          return nameVon(p);
        }
      }
      p = p.parent;
    }
    return MODULRUMPF;
  };
  const gehe = (knoten: ts.Node): void => {
    if (
      ts.isCallExpression(knoten) &&
      ts.isIdentifier(knoten.expression) &&
      knoten.expression.text === VERTRAGSNAME
    ) {
      treffer.push({
        zeile: datei.getLineAndCharacterOfPosition(knoten.getStart(datei)).line + 1,
        ort: ortFuer(knoten),
      });
    }
    knoten.forEachChild(gehe);
  };
  datei.forEachChild(gehe);
  return treffer;
}

const WEG_ZURUECK =
  "Der Vertrag muss aus dem EINSTIEGSPUNKT gerufen werden (erste Anweisung von start() in " +
  "services/app/src/server.ts bzw. im Runner von services/app/src/seed.ts), nicht aus einem " +
  "Modulrumpf. Ein Wurf im Modulrumpf läuft beim import und erreicht den Fänger " +
  "start().catch(...) in server.ts nie — der Betreiber sieht dann eine Stapelspur statt der " +
  "Zeile 'Serverstart fehlgeschlagen: …'. Siehe JOB 3776 und den Kommentar in dieser Datei.";

// ==================================================================================================
// JOB 3828 · LÜCKE 2 — DAS INVENTAR DER EINSTIEGSPUNKTE. DIE EINE STELLE, AN DER DIE PFADE STEHEN.
// ==================================================================================================
//
// Ein Einstiegspunkt ist eine Datei, die `build-app` lädt UND als eigener Prozess läuft. Diese drei
// sind der Stand, gegen den R2/7 prüft; der Kopfkommentar verweist hierher, statt sie ein zweites
// Mal aufzuzählen:
//
//   services/app/src/seed.ts        — CLI-Runner hinter `process.argv[1]?.endsWith("seed.ts")`
//        (`npm run seed:demo`). In Produktion erreichbar, aber nur mit `SEED_ALLOW_PROD=1`.
//   services/app/src/server.ts      — `start().catch(...)` auf Modulebene. Der Produktionsweg
//        schlechthin: das Dockerfile setzt `ENV NODE_ENV=production` und startet ihn als `CMD`.
//   tools/bodytext-nachziehen.ts    — CLI-Werkzeug hinter einem `invokedDirectly`-Riegel, lädt
//        `build-app` per dynamischem `import`. Ob es den Vertrag trägt, entscheidet JOB 3797; R2/7
//        prüft die BEKANNTHEIT, nicht den Vertrag — siehe (b) im Kopf dieser Datei.
const ERWARTETE_EINSTIEGSPUNKTE = [
  "services/app/src/seed.ts",
  "services/app/src/server.ts",
  "tools/bodytext-nachziehen.ts",
];

interface Quelldatei {
  /** Repo-relativ, immer mit `/` — unabhängig vom Trennzeichen des Dateisystems. */
  pfad: string;
  quelle: string;
}

/** Wo gesucht wird. `apps/**` bleibt draussen — siehe (c) im Kopf dieser Datei. */
const SUCHORDNER = ["services", "tools"];
/** Kein Quelltext dieses Repos: Fremdcode und Bauergebnisse. */
const NICHT_DURCHSUCHT = ["node_modules", "dist", ".git"];

function sammle(ordner: string, aus: Quelldatei[]): void {
  for (const eintrag of readdirSync(ordner, { withFileTypes: true })) {
    const voll = join(ordner, eintrag.name);
    if (eintrag.isDirectory()) {
      if (!NICHT_DURCHSUCHT.includes(eintrag.name)) {
        sammle(voll, aus);
      }
      continue;
    }
    if (!eintrag.isFile() || !/\.tsx?$/.test(eintrag.name)) {
      continue;
    }
    aus.push({
      pfad: relative(WURZEL, voll).split(sep).join("/"),
      quelle: readFileSync(voll, "utf8"),
    });
  }
}

/**
 * ALLE Quelldateien unter `services/**` und `tools/**`.
 *
 * ZUSTANDSMODELL (JOB 3828 §9): eine negative Aussage braucht eine erfolgreiche frische Grundlage.
 * „Es gibt keinen unbekannten Einstiegspunkt" darf nur dastehen, wenn wirklich gelesen wurde —
 * fehlt ein Suchordner, WIRFT das hier mit Grund, und R2/7 wird rot, statt mit einer leeren Menge
 * grün zu bleiben. Probe (c) in R2/7 misst zusätzlich, dass der Lauf Dateien gesehen hat.
 */
function quelldateien(): Quelldatei[] {
  const aus: Quelldatei[] = [];
  for (const name of SUCHORDNER) {
    const ordner = join(WURZEL, name);
    if (!existsSync(ordner)) {
      throw new Error(
        `Suchlauf abgebrochen: der Ordner '${name}' fehlt unter ${WURZEL}. Ohne ihn ist die Aussage 'es gibt keinen unbekannten Einstiegspunkt' nicht belegt.`,
      );
    }
    sammle(ordner, aus);
  }
  return aus;
}

/** Ist irgendwo in diesem Teilbaum ein Knoten, auf den `treffer` zutrifft? */
function enthaelt(knoten: ts.Node, treffer: (n: ts.Node) => boolean): boolean {
  if (treffer(knoten)) {
    return true;
  }
  let gefunden = false;
  knoten.forEachChild((kind) => {
    if (!gefunden && enthaelt(kind, treffer)) {
      gefunden = true;
    }
  });
  return gefunden;
}

/** Der Modulname, den ein `import`, ein `export … from` oder ein `import("…")` nennt. */
function modulbezeichner(knoten: ts.Node): string | undefined {
  if (ts.isImportDeclaration(knoten) || ts.isExportDeclaration(knoten)) {
    const bezeichner = knoten.moduleSpecifier;
    return bezeichner !== undefined && ts.isStringLiteralLike(bezeichner)
      ? bezeichner.text
      : undefined;
  }
  if (ts.isCallExpression(knoten) && knoten.expression.kind === ts.SyntaxKind.ImportKeyword) {
    const erstes = knoten.arguments[0];
    return erstes !== undefined && ts.isStringLiteralLike(erstes) ? erstes.text : undefined;
  }
  return undefined;
}

/**
 * `build-app` — MIT ODER OHNE DATEIENDUNG.
 *
 * RUNDE 2, KORREKTURPFLICHT 1 (BEN): hier stand `/(^|\/)build-app$/`, also nur die endungslose
 * Schreibweise. BEN hat mit einem echten Node/tsx-Prozess gemessen, dass
 * `./services/app/src/build-app.js` dasselbe Modul auflöst (Exit 0, `BEN_IMPORT=function`) — und
 * dass genau dieser Import in allen drei Importformen unsichtbar blieb: `UNERWARTET: keiner |
 * FEHLEND: keiner`. Ein neuer Einstiegspunkt in dieser Schreibweise wäre also entstanden, ohne dass
 * R2/7 rot wird. Das war die Lücke, gegen die R2/7 antritt.
 *
 * DIE ENDUNGSLISTE sind die Modulendungen, die Node und tsx als Modul auflösen. `.json` steht
 * bewusst NICHT darin — `./build-app.json` wäre eine Datendatei, nicht dieses Modul. Und der Name
 * ist am Ende festgenagelt, damit Namensnachbarn wie `./build-app-helper` nicht mitfallen. Beide
 * Gegenrichtungen misst R2/8.
 */
const BUILD_APP_MODUL = /(^|\/)build-app(\.(js|mjs|cjs|jsx|ts|mts|cts|tsx))?$/;

/**
 * Nennt diese Quelle `build-app` als MODUL? Entschieden wird am Syntaxbaum, nicht am Text — und der
 * Unterschied ist gross: die Zeichenfolge „build-app" steht in 108 Dateien unter `services/**` und
 * `tools/**`, ein echter Modulbezeichner nur in 53 Zeilen, davon 6 ausserhalb von Prüfcode
 * (gemessen am Stand dieser Runde). Ein Kommentar wie in `seed-demo.ts:25` („bewusst KEIN Import aus
 * build-app") ist deshalb hier kein Treffer.
 */
function laedtBuildApp(datei: ts.SourceFile): boolean {
  return enthaelt(datei, (knoten) => {
    const modul = modulbezeichner(knoten);
    return modul !== undefined && BUILD_APP_MODUL.test(modul);
  });
}

/**
 * LÄUFT DIESER AUSDRUCK BEIM LADEN DES MODULS WIRKLICH LOS — oder legt er nur etwas ab?
 *
 * RUNDE 2, KORREKTURPFLICHT 2 (BEN): `hatAusfuehrbareModulanweisung` hat JEDE Variablenanweisung
 * als reine Deklaration verworfen. Damit blieb `const services = buildServices();` auf Modulebene
 * unsichtbar — ein Aufruf, der beim `import` wirklich läuft. BEN hat es gemessen: das Inventar gab
 * für eine solche Datei `[]` zurück. „Deklaration" ist eben eine Aussage über die Anweisungsart,
 * nicht über ihre Wirkung; entschieden werden muss die Wirkung.
 *
 * GEZÄHLT WIRD: ein Aufruf (`f()`), eine Erzeugung (`new X()`), ein `await` und ein markiertes
 * Textmuster. NICHT GEZÄHLT WIRD, was im RUMPF einer Funktion steht — ein dort abgelegter Aufruf
 * wartet auf seinen Aufrufer (BENs Gegenrichtung „verzögerter Callback"). An einer Klasse laufen
 * genau die STATISCHEN Initialisierer mit der Klassendefinition, also beim Laden; Methode,
 * Konstruktor und Instanzfeld nicht. Das ist dieselbe Regel wie in `ortFuer` (Lücke 1) — die zwei
 * Hälften dieser Datei dürfen über statische Blöcke nicht verschieden denken. R2/8 misst jede
 * dieser Richtungen einzeln.
 */
function wirktBeimLaden(knoten: ts.Node): boolean {
  if (
    ts.isCallExpression(knoten) ||
    ts.isNewExpression(knoten) ||
    ts.isAwaitExpression(knoten) ||
    ts.isTaggedTemplateExpression(knoten)
  ) {
    return true;
  }
  if (ts.isClassDeclaration(knoten) || ts.isClassExpression(knoten)) {
    // Von der Klasse läuft beim Laden NUR die statische Initialisierung mit.
    return knoten.members.some(
      (glied) => istStatischeInitialisierung(glied) && wirktBeimLadenTiefer(glied),
    );
  }
  if (istFunktionsartig(knoten)) {
    // Der Rumpf wartet auf seinen Aufruf. (Eine SOFORT aufgerufene Funktion hängt an einer
    // `CallExpression` und ist oben schon beantwortet.)
    return false;
  }
  return wirktBeimLadenTiefer(knoten);
}

function wirktBeimLadenTiefer(knoten: ts.Node): boolean {
  let gefunden = false;
  knoten.forEachChild((kind) => {
    if (!gefunden && wirktBeimLaden(kind)) {
      gefunden = true;
    }
  });
  return gefunden;
}

/**
 * Hat diese Quelle mindestens eine AUSFÜHRBARE Anweisung auf Modulebene — eine, die beim Laden des
 * Moduls etwas TUT? Import und Wiederausfuhr zählen nicht, und eine Deklaration zählt nur, wenn sie
 * beim Laden wirklich etwas ausführt (`wirktBeimLaden`, Korrekturpflicht 2). Das ist die Bedingung,
 * die `start().catch(...)` in `server.ts` fängt und an der `services/app/index.ts` (nur
 * `export … from`) sowie an `services/app/src/dev-persist.ts` (nur Deklarationen ohne Aufruf)
 * scheitert.
 */
function hatAusfuehrbareModulanweisung(datei: ts.SourceFile): boolean {
  return datei.statements.some((anweisung) => {
    if (ts.isImportDeclaration(anweisung) || ts.isImportEqualsDeclaration(anweisung)) {
      return false;
    }
    if (ts.isExportDeclaration(anweisung)) {
      return false;
    }
    // `export default f()` läuft beim Laden, `export default Klasse` nicht.
    if (ts.isExportAssignment(anweisung)) {
      return wirktBeimLaden(anweisung.expression);
    }
    // BENs Korrekturpflicht 2: eine Variablenanweisung ist nur dann eine REINE Deklaration, wenn
    // keiner ihrer Initialisierer beim Laden etwas tut.
    if (ts.isVariableStatement(anweisung)) {
      return anweisung.declarationList.declarations.some(
        (erklaerung) =>
          erklaerung.initializer !== undefined && wirktBeimLaden(erklaerung.initializer),
      );
    }
    // Eine Klasse auf Modulebene läuft mit ihren statischen Initialisierern (s. `wirktBeimLaden`).
    if (ts.isClassDeclaration(anweisung)) {
      return wirktBeimLaden(anweisung);
    }
    // Ein Funktionsrumpf läuft erst beim Aufruf — hier steht nur die Abmachung.
    if (ts.isFunctionDeclaration(anweisung)) {
      return false;
    }
    // JOB 3937 · BENs Prüflücke aus dem GRÜN-Urteil von JOB 3828: ein Enum ist NICHT immer eine
    // reine Deklaration. `enum X { A = f() }` übersetzt sich in eine Zuweisung, die `f()` beim
    // Laden des Moduls RUFT — dieselbe Wirkung wie `const x = f()`, und deshalb gilt hier dieselbe
    // Regel wie bei der Variablenanweisung darüber: entschieden wird die Wirkung, nicht die
    // Anweisungsart, und entschieden wird sie von `wirktBeimLaden` und von nichts anderem.
    if (ts.isEnumDeclaration(anweisung)) {
      // ZWEI FORMEN ZÄHLEN NIE, und das ist keine Vorsicht, sondern die Übersetzung:
      //   `declare enum` ist umgebend (ambient) — der Übersetzer gibt dafür ÜBERHAUPT keinen Code
      //       aus, es gibt beim Laden also nichts, was laufen könnte.
      //   `const enum` wird an der Verwendungsstelle eingesetzt; seine Glieder MÜSSEN konstante
      //       Ausdrücke sein (TS2474 — ein Aufruf ist dort gar nicht übersetzbar), und selbst mit
      //       `preserveConstEnums` entsteht nur eine Werteliste ohne fremden Code.
      const nurZurUebersetzungszeit =
        anweisung.modifiers?.some(
          (m) => m.kind === ts.SyntaxKind.DeclareKeyword || m.kind === ts.SyntaxKind.ConstKeyword,
        ) === true;
      if (nurZurUebersetzungszeit) {
        return false;
      }
      return anweisung.members.some(
        (glied) => glied.initializer !== undefined && wirktBeimLaden(glied.initializer),
      );
    }
    if (
      ts.isInterfaceDeclaration(anweisung) ||
      ts.isTypeAliasDeclaration(anweisung) ||
      ts.isModuleDeclaration(anweisung)
    ) {
      return false;
    }
    return anweisung.kind !== ts.SyntaxKind.EmptyStatement;
  });
}

/** `process.argv[1]` — der Pfad, mit dem Node gestartet wurde. */
function istProcessArgv1(knoten: ts.Node): boolean {
  if (!ts.isElementAccessExpression(knoten)) {
    return false;
  }
  const index = knoten.argumentExpression;
  if (!ts.isNumericLiteral(index) || index.text !== "1") {
    return false;
  }
  const ziel = knoten.expression;
  return (
    ts.isPropertyAccessExpression(ziel) &&
    ziel.name.text === "argv" &&
    ts.isIdentifier(ziel.expression) &&
    ziel.expression.text === "process"
  );
}

/** `import.meta.url` — die Kennung des eigenen Moduls, die andere Seite desselben Vergleichs. */
function istImportMetaUrl(knoten: ts.Node): boolean {
  return (
    ts.isPropertyAccessExpression(knoten) &&
    knoten.name.text === "url" &&
    knoten.expression.kind === ts.SyntaxKind.MetaProperty
  );
}

/**
 * Hat diese Quelle einen DIREKTAUFRUF-RIEGEL — den VERGLEICH, mit dem ein CLI-Werkzeug prüft, ob es
 * selbst gestartet wurde? Wer einen trägt, ist als eigener Prozess gedacht, auch wenn sein Rumpf
 * sonst nur Deklarationen enthält. Verlangt wird wirklich ein Vergleich und nicht bloss das
 * Vorkommen von `import.meta.url`: `server.ts:61` benutzt es, um den `dist`-Pfad zu bilden — das ist
 * kein Riegel, und `server.ts` steht aus einem anderen Grund im Inventar.
 */
function hatDirektaufrufRiegel(datei: ts.SourceFile): boolean {
  const riegelmarke = (n: ts.Node): boolean => istProcessArgv1(n) || istImportMetaUrl(n);
  return enthaelt(datei, (knoten) => {
    if (!ts.isBinaryExpression(knoten)) {
      return false;
    }
    const zeichen = knoten.operatorToken.kind;
    const istVergleich =
      zeichen === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      zeichen === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      zeichen === ts.SyntaxKind.EqualsEqualsToken ||
      zeichen === ts.SyntaxKind.ExclamationEqualsToken;
    if (!istVergleich) {
      return false;
    }
    return enthaelt(knoten.left, riegelmarke) || enthaelt(knoten.right, riegelmarke);
  });
}

/** Prüfcode läuft unter Vitest und nie als eigener Prozess — zwei einzelne Ausschlüsse. */
function istPruefcode(pfad: string): boolean {
  // (1) Alles unter `tests/`, auf jeder Ebene.
  if (pfad.startsWith("tests/") || pfad.includes("/tests/")) {
    return true;
  }
  // (2) Jede `*.test.ts`/`*.test.tsx` — darunter die vierzehn unter `services/app/src/`, die
  //     `build-app` wirklich importieren (`build-app.test.ts`, `seed.test.ts`, …).
  return /\.test\.tsx?$/.test(pfad);
}

/** Das geladene Modul selbst ist kein Lader — der dritte Ausschluss, für sich benannt. */
const DAS_GELADENE_MODUL = "services/app/src/build-app.ts";

/**
 * DIE EINSTIEGSPUNKTE, die in diesen Dateien stecken: sortiert, repo-relativ mit `/`.
 *
 * AUFNAHMEREGEL, mechanisch entscheidbar und am Syntaxbaum bestimmt: die Datei nennt `build-app` als
 * Modul UND läuft als eigener Prozess — erkennbar an einer ausführbaren Anweisung auf Modulebene
 * ODER an einem Direktaufruf-Riegel.
 *
 * DIE ZWEITE BEDINGUNG IST DIE ENTSCHEIDENDE, und sie ist die Gegenrichtung: `build-app` zu laden
 * macht niemanden zum Einstiegspunkt. Die heutigen Beinahe-Treffer, jeder mit seinem Grund:
 *   - `services/app/index.ts`            — reine Wiederausfuhr (`export … from "./src/build-app"`),
 *                                          neun Zeilen, keine ausführbare Anweisung, kein Riegel.
 *   - `services/app/src/dev-persist.ts`  — importiert `build-app`, hat auf Modulebene aber nur
 *                                          Deklarationen und keinen Riegel: eine Bibliothek, die
 *                                          `server.ts` einbindet (gemessen in JOB 3776, s. oben).
 *   - `services/app/src/seed-demo.ts`    — nennt `build-app` nur im Kommentar, nicht als Modul.
 *   - `services/app/src/build-app.ts`    — das geladene Modul selbst, kein Lader.
 *   - `services/app/src/*.test.ts`       — Prüfcode, läuft unter Vitest.
 * R2/7 prüft jeden dieser fünf einzeln nach: gelesen, und trotzdem nicht im Inventar.
 */
function einstiegspunkte(dateien: { pfad: string; quelle: string }[]): string[] {
  const gefunden: string[] = [];
  for (const datei of dateien) {
    if (istPruefcode(datei.pfad) || datei.pfad === DAS_GELADENE_MODUL) {
      continue;
    }
    const baum = ts.createSourceFile(datei.pfad, datei.quelle, ts.ScriptTarget.ESNext, false);
    if (!laedtBuildApp(baum)) {
      continue;
    }
    if (!hatAusfuehrbareModulanweisung(baum) && !hatDirektaufrufRiegel(baum)) {
      continue;
    }
    gefunden.push(datei.pfad);
  }
  return gefunden.sort();
}

/** Die Fehlermeldung von R2/7: was zu viel ist und was fehlt, einzeln benannt. */
function inventarBefund(gefunden: string[]): string {
  const unerwartet = gefunden.filter((p) => !ERWARTETE_EINSTIEGSPUNKTE.includes(p));
  const fehlend = ERWARTETE_EINSTIEGSPUNKTE.filter((p) => !gefunden.includes(p));
  return [
    `UNERWARTET: ${unerwartet.length > 0 ? unerwartet.join(" · ") : "keiner"}`,
    `FEHLEND: ${fehlend.length > 0 ? fehlend.join(" · ") : "keiner"}`,
    "Ein neuer Einstiegspunkt braucht den Startvertrag — siehe JOB 3776 und diese Datei.",
  ].join(" | ");
}

/**
 * Die Probe von Lieferung 4(a): ein vierter Einstiegspunkt, wie er wirklich entstünde — dynamischer
 * `build-app`-Import und `invokedDirectly`-Riegel, die Bauart von `tools/bodytext-nachziehen.ts`.
 * Er wird `einstiegspunkte` nur MITGEGEBEN; im Repo liegt keine solche Datei.
 */
const ERFUNDENER_EINSTIEGSPUNKT: Quelldatei = {
  pfad: "tools/erfunden-nachziehen.ts",
  quelle: [
    'import { pathToFileURL } from "node:url";',
    "",
    "async function main(): Promise<void> {",
    '  const { buildPgServices } = await import("../services/app/src/build-app");',
    "  void buildPgServices;",
    "}",
    "",
    "const invokedDirectly =",
    "  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;",
    "if (invokedDirectly) {",
    "  void main();",
    "}",
    "",
  ].join("\n"),
};

/**
 * RUNDE 2, BENS ZWEITER GEMESSENER EINSTIEGSPUNKT: derselbe Import wie in `server.ts`, nur mit
 * `.js`-Endung. Ein echter Node/tsx-Prozess lädt das Modul so (BENs Messung, Exit 0); das Inventar
 * sah ihn vor dieser Runde nicht. Er wird `einstiegspunkte` nur MITGEGEBEN, im Repo liegt er nicht.
 */
const ERFUNDENER_JS_EINSTIEGSPUNKT: Quelldatei = {
  pfad: "tools/erfunden-mit-endung.ts",
  quelle: [
    'import { buildServices } from "../services/app/src/build-app.js";',
    "",
    "function start(): void {",
    "  void buildServices;",
    "}",
    "",
    "start();",
    "",
  ].join("\n"),
};

/**
 * DIE KALIBRIERUNG DER AUFNAHMEREGEL (R2/8) — BENs zwei Korrekturpflichten, je mit Gegenrichtung.
 *
 * Jede Probe ist ein Quelltext, der `einstiegspunkte` MITGEGEBEN wird; im Repo liegt keine dieser
 * Dateien. `soll` sagt, ob die Regel sie als Einstiegspunkt führen MUSS. Ohne die `soll: false`-Hälfte
 * wäre die Reparatur nicht belegt, sondern nur weiter gefasst: eine Regel, die alles aufnimmt, was
 * `build-app` erwähnt, wäre genauso falsch wie die alte, die zu wenig aufnahm.
 */
interface Aufnahmeprobe {
  pfad: string;
  soll: boolean;
  warum: string;
  quelle: string;
}

const AUFNAHMEPROBEN: Aufnahmeprobe[] = [
  // ---------------------------------------------------------------------------------------------
  // KORREKTURPFLICHT 1 — die Dateiendung am Modulbezeichner, in allen drei Importformen.
  // ---------------------------------------------------------------------------------------------
  {
    pfad: "tools/kp1-statisch.ts",
    soll: true,
    warum: "statischer Import mit .js-Endung plus ausführbare Modulanweisung",
    quelle: [
      'import { buildServices } from "../services/app/src/build-app.js";',
      "",
      "function start(): void {",
      "  void buildServices;",
      "}",
      "",
      "start();",
    ].join("\n"),
  },
  {
    pfad: "tools/kp1-wiederausfuhr.ts",
    soll: true,
    warum: "`export … from` mit .js-Endung plus ausführbare Modulanweisung",
    quelle: [
      'export { buildServices } from "../services/app/src/build-app.js";',
      "",
      'process.stderr.write("Werkzeug gestartet\\n");',
    ].join("\n"),
  },
  {
    pfad: "tools/kp1-dynamisch.ts",
    soll: true,
    warum: 'dynamischer `import("….js")` plus ausführbare Modulanweisung',
    quelle: [
      "async function main(): Promise<void> {",
      '  const { buildServices } = await import("../services/app/src/build-app.js");',
      "  void buildServices;",
      "}",
      "",
      "void main();",
    ].join("\n"),
  },
  {
    pfad: "tools/kp1-endung-ts.ts",
    soll: true,
    warum: ".ts ist dieselbe Modulauflösung wie .js — die Endungsliste darf nicht bei .js enden",
    quelle: [
      'import { buildServices } from "../services/app/src/build-app.ts";',
      "",
      "void buildServices();",
    ].join("\n"),
  },
  {
    pfad: "tools/kp1-endung-mjs.ts",
    soll: true,
    warum: ".mjs über Modul-await — Endung UND ausgeführter Initialisierer in einem",
    quelle: [
      'const { buildServices } = await import("../services/app/src/build-app.mjs");',
      "",
      "export { buildServices };",
    ].join("\n"),
  },
  {
    pfad: "tools/kp1-nur-wiederausfuhr.ts",
    soll: false,
    warum:
      "GEGENRICHTUNG: die Endung macht niemanden zum Einstiegspunkt — ohne ausführbare Anweisung " +
      "und ohne Riegel bleibt es eine Wiederausfuhr wie `services/app/index.ts`",
    quelle: [
      'export { buildServices } from "../services/app/src/build-app.js";',
      'export type { AppServices } from "../services/app/src/build-app.js";',
    ].join("\n"),
  },
  {
    pfad: "tools/kp1-namensnachbar.ts",
    soll: false,
    warum: "GEGENRICHTUNG: `build-app-helper` ist ein anderes Modul, kein `build-app`",
    quelle: [
      'import { helfer } from "../services/app/src/build-app-helper";',
      "",
      "helfer();",
    ].join("\n"),
  },
  {
    pfad: "tools/kp1-datendatei.ts",
    soll: false,
    warum: "GEGENRICHTUNG: `build-app.json` ist eine Datendatei, nicht dieses Modul",
    quelle: [
      'import daten from "../services/app/src/build-app.json";',
      "",
      "process.stderr.write(String(daten));",
    ].join("\n"),
  },
  // ---------------------------------------------------------------------------------------------
  // KORREKTURPFLICHT 2 — der ausgeführte Initialisierer gegen die reine Deklaration.
  // ---------------------------------------------------------------------------------------------
  {
    pfad: "tools/kp2-ausgefuehrt.ts",
    soll: true,
    warum: "BENs gemessener Fall: `const services = buildServices();` läuft beim import",
    quelle: [
      'import { buildServices } from "../services/app/src/build-app";',
      "",
      "const services = buildServices();",
      "export { services };",
    ].join("\n"),
  },
  {
    pfad: "tools/kp2-iife.ts",
    soll: true,
    warum: "sofort aufgerufene Funktion im Initialisierer — läuft ebenfalls beim import",
    quelle: [
      'import { buildServices } from "../services/app/src/build-app";',
      "",
      "const dienste = (() => buildServices())();",
      "export { dienste };",
    ].join("\n"),
  },
  {
    pfad: "tools/kp2-statisches-feld.ts",
    soll: true,
    warum:
      "statischer Feldinitialisierer läuft mit der Klassendefinition — dieselbe Regel wie in " +
      "`ortFuer` (R2/6 b)",
    quelle: [
      'import { buildServices } from "../services/app/src/build-app";',
      "",
      "class Riegel {",
      "  static dienste = buildServices();",
      "}",
      "export { Riegel };",
    ].join("\n"),
  },
  {
    pfad: "tools/kp2-verzoegerter-callback.ts",
    soll: false,
    warum:
      "GEGENRICHTUNG (BEN): der Aufruf liegt im Rumpf eines Pfeils — er wartet auf seinen Aufrufer",
    quelle: [
      'import { buildServices } from "../services/app/src/build-app";',
      "",
      "const bauen = () => buildServices();",
      "export { bauen };",
    ].join("\n"),
  },
  {
    pfad: "tools/kp2-nur-funktion.ts",
    soll: false,
    warum: "GEGENRICHTUNG (BEN): eine blosse Funktionsdeklaration führt beim Laden nichts aus",
    quelle: [
      'import { buildServices } from "../services/app/src/build-app";',
      "",
      "export function bauen() {",
      "  return buildServices();",
      "}",
    ].join("\n"),
  },
  {
    pfad: "tools/kp2-reine-deklarationen.ts",
    soll: false,
    warum:
      "GEGENRICHTUNG: Schnittstelle, Typ und eine Wertliste ohne Aufruf — die Bauart von " +
      "`services/app/src/dev-persist.ts`",
    quelle: [
      'import type { AppServices } from "../services/app/src/build-app";',
      "",
      "export interface Huelle {",
      "  dienste: AppServices;",
      "}",
      'export const NAMEN: readonly string[] = ["a", "b"];',
      "export type Kurz = Huelle;",
    ].join("\n"),
  },
  {
    pfad: "tools/kp2-methode.ts",
    soll: false,
    warum: "GEGENRICHTUNG: eine Methode läuft erst, wenn sie gerufen wird",
    quelle: [
      'import { buildServices } from "../services/app/src/build-app";',
      "",
      "export class Huelle {",
      "  bauen() {",
      "    return buildServices();",
      "  }",
      "}",
    ].join("\n"),
  },
  {
    pfad: "tools/kp2-instanzfeld.ts",
    soll: false,
    warum:
      "GEGENRICHTUNG: ein NICHT-statisches Feld läuft erst bei `new Huelle()` — dieselbe Grenze " +
      "wie in R2/6 (c)",
    quelle: [
      'import { buildServices } from "../services/app/src/build-app";',
      "",
      "export class Huelle {",
      "  dienste = buildServices();",
      "}",
    ].join("\n"),
  },
  // ---------------------------------------------------------------------------------------------
  // JOB 3937 — DAS ENUM MIT BERECHNETEM GLIED, GEGEN DAS KONSTANTE ENUM UND GEGEN DEN FREMDLADER.
  //
  // BENS PRÜFLÜCKE AUS DEM GRÜN-URTEIL VON JOB 3828 (`archiv/3828/runde-2/ben.md:35`, Prüfpunkt 6):
  // „Berechnete Enum-Initialisierer bleiben durch Zeile 472 ausgeschlossen; die Rückgabe benennt
  // dies. Folgeprobe: `enum X { A = f() }` gegen eine konstante Enum-Deklaration."
  // ---------------------------------------------------------------------------------------------
  {
    pfad: "tools/kp3-enum-berechnet.ts",
    soll: true,
    warum:
      "berechnetes Enum-Glied (`Start = zahl()`) ist die EINZIGE beim Laden wirkende Anweisung — " +
      "`zahl` daneben ist eine blosse Funktionsdeklaration und führt für sich nichts aus",
    quelle: [
      'import { buildServices } from "../services/app/src/build-app.js";',
      "",
      "function zahl(): number {",
      "  return 1;",
      "}",
      "",
      "enum Rolle {",
      "  Start = zahl(),",
      "}",
      "",
      "export { Rolle, buildServices };",
    ].join("\n"),
  },
  {
    pfad: "tools/kp3-enum-konstant.ts",
    soll: false,
    warum:
      "GEGENRICHTUNG: ein rein konstantes Enum führt beim Laden nichts aus — wer `isEnumDeclaration` " +
      "einfach aus der Ausschlussliste streicht, nimmt auch diese Datei auf",
    quelle: [
      'import { buildServices } from "../services/app/src/build-app.js";',
      "",
      "enum Stufe {",
      "  Eins = 1,",
      "  Zwei = Eins + 1,",
      "}",
      "",
      "export { Stufe, buildServices };",
    ].join("\n"),
  },
  {
    pfad: "tools/kp3-enum-ohne-buildapp.ts",
    soll: false,
    warum:
      "ZWEITE GEGENRICHTUNG: berechnetes Enum-Glied, aber ohne jeden Bezug auf `build-app` — die " +
      "ERSTE Hälfte der Aufnahmeregel (Korrekturpflicht 1) bleibt Bedingung, nicht Zierde",
    quelle: [
      'import { hostname } from "node:os";',
      "",
      "enum Rechner {",
      "  Laenge = hostname().length,",
      "}",
      "",
      "export { Rechner };",
    ].join("\n"),
  },
];

describe("JOB 3776 R2 · der Startvertrag steht am Einstiegspunkt, nicht im Modulrumpf", () => {
  it("R2/1 · server.ts ruft den Vertrag als ERSTE Anweisung von start()", () => {
    const pfad = "services/app/src/server.ts";
    const aufrufe = vertragsaufrufe(quelltext(pfad), "server.ts");
    expect(
      aufrufe.map((a) => a.ort),
      `In ${pfad} steht der Vertragsaufruf nicht in start(), sondern in: ` +
        `${JSON.stringify(aufrufe)}. ${WEG_ZURUECK}`,
    ).toEqual(["start"]);

    const quelle = zeilen(pfad);
    const start = quelle.findIndex((z) => z.includes("async function start("));
    expect(
      start,
      "async function start( nicht gefunden in services/app/src/server.ts",
    ).toBeGreaterThanOrEqual(0);

    const ersteAnweisung = quelle.findIndex((z, i) => i > start && istAnweisung(z));
    expect(
      quelle[ersteAnweisung],
      `${pfad}:${ersteAnweisung + 1} — die erste Anweisung von start() ist ` +
        `'${quelle[ersteAnweisung]?.trim()}' und nicht der Aufruf pruefeStartvertrag(process.env). ` +
        `${WEG_ZURUECK}`,
    ).toContain("pruefeStartvertrag(");

    // Und er steht damit VOR dem Speicherwächter — sonst nennte der wieder nur DATABASE_URL und
    // schnitte die Sammelmeldung ab (BENs Befund aus JOB 3655 Runde 1).
    const waechter = quelle.findIndex((z) => z.includes("assertPersistentStore({"));
    expect(waechter, "assertPersistentStore({ nicht gefunden in server.ts").toBeGreaterThan(0);
    expect(
      ersteAnweisung,
      `pruefeStartvertrag steht in Zeile ${ersteAnweisung + 1}, assertPersistentStore in Zeile ` +
        `${waechter + 1} — der Vertrag muss VORHER stehen.`,
    ).toBeLessThan(waechter);
  });

  it("R2/2 · seed.ts ruft den Vertrag im Runner, bevor irgendein Dienst entsteht", () => {
    const pfad = "services/app/src/seed.ts";
    const aufrufe = vertragsaufrufe(quelltext(pfad), "seed.ts");
    expect(
      aufrufe.map((a) => a.ort),
      `In ${pfad} steht der Vertragsaufruf nicht in runSeed(), sondern in: ` +
        `${JSON.stringify(aufrufe)}. Ein Seed-Lauf in Produktion (SEED_ALLOW_PROD=1) liefe damit ` +
        `ohne Vertragsprüfung. ${WEG_ZURUECK}`,
    ).toEqual(["runSeed"]);

    // Vor der Verdrahtung: ein Lauf mit fehlendem Pflichtwert darf keine Verbindung aufbauen und
    // keine Dienste bauen, bevor er den Mangel meldet.
    const quelle = zeilen(pfad);
    const aufrufZeile = aufrufe[0]?.zeile ?? -1;
    const runner = quelle.findIndex((z) => z.includes("export async function runSeed("));
    for (const marke of ["createPool(", "buildPgServices(", "buildServices("]) {
      const stelle = quelle.findIndex((z, i) => i > runner && z.includes(marke));
      if (stelle < 0) {
        continue;
      }
      expect(
        aufrufZeile,
        `${pfad}:${stelle + 1} — '${marke}' steht VOR dem Vertragsaufruf (Zeile ${aufrufZeile}). Der Vertrag gehört davor.`,
      ).toBeLessThan(stelle + 1);
    }
  });

  it("R2/3 · build-app.ts ruft den Vertrag NICHT beim Import — unabhängig von der Einrückung", () => {
    const aufrufe = vertragsaufrufe(quelltext("services/app/src/build-app.ts"), "build-app.ts");
    expect(
      aufrufe.length,
      "In build-app.ts wird pruefeStartvertrag gar nicht mehr gerufen — der Aufruf im RUMPF von " +
        "buildApp() muss bleiben (s. R2/4).",
    ).toBeGreaterThan(0);

    const beimImport = aufrufe.filter((a) => a.ort === MODULRUMPF);
    expect(
      beimImport,
      `services/app/src/build-app.ts — der Vertrag wird wieder beim IMPORT gerufen (Zeile(n) ${beimImport.map((a) => a.zeile).join(", ")}). Keine Funktion umschliesst den Aufruf; die Einrückung ändert daran nichts. ${WEG_ZURUECK}`,
    ).toEqual([]);
  });

  it("R2/4 · der Aufruf im RUMPF von buildApp bleibt — er ist ein anderer Aufruf", () => {
    // Gegenrichtung zu R2/3: wer beim Aufräumen den falschen der beiden Aufrufe mitnimmt, nimmt die
    // Prüfung für eine App mit, die erst NACH einer Umgebungsänderung gebaut wird.
    //
    // GEMESSEN UND FESTGEHALTEN (Runde 1, zweite Gegenprobe): `tests/security/vip2-gate.test.ts`
    // schützt diesen Aufruf NICHT — entfernt man ihn, bleibt vip2-gate grün, weil es in seinem
    // `beforeEach` DATABASE_URL und APP_BASE_URL selbst setzt und damit um den Vertrag herum
    // arbeitet. Dieser Fall hier ist der einzige Schutz.
    const aufrufe = vertragsaufrufe(quelltext("services/app/src/build-app.ts"), "build-app.ts");
    expect(
      aufrufe.map((a) => a.ort),
      "Im Rumpf von buildApp() wird pruefeStartvertrag nicht mehr gerufen — dieser Aufruf gehört " +
        "NICHT zu JOB 3776 und muss stehen bleiben.",
    ).toContain("buildApp");
  });

  it("R2/5 · KALIBRIERUNG: der Wächter erkennt den eingerückten Modulaufruf und die IIFE", () => {
    // ============================================================================================
    // RUNDE 2, KORREKTURPFLICHT 1 — DIESER FALL IST DER BELEG, DASS R2/3 ÜBERHAUPT ETWAS PRÜFT.
    // ============================================================================================
    //
    // Ohne ihn wäre R2/3 auch dann grün, wenn `vertragsaufrufe` nie etwas fände. Kalibriert wird
    // gegen den ECHTEN Quelltext von `build-app.ts`, nicht gegen ein Kunstbeispiel: jede Mutation
    // hängt eine Anweisung an die reale Datei an und fragt, ob der Wächter sie sieht.
    const echt = quelltext("services/app/src/build-app.ts");
    expect(vertragsaufrufe(echt, "build-app.ts").filter((a) => a.ort === MODULRUMPF)).toEqual([]);

    // (a) BENs Mutation: zwei führende Leerzeichen. Einrückung ist kein Gültigkeitsbereich — das
    //     läuft beim Import. Die Spaltenprüfung aus Runde 1 hat das durchgelassen.
    const eingerueckt = `${echt}\n  ${VERTRAGSNAME}(process.env);\n`;
    expect(
      vertragsaufrufe(eingerueckt, "build-app.ts").filter((a) => a.ort === MODULRUMPF).length,
      "Der eingerückte Modulaufruf wurde NICHT erkannt — genau die Lücke aus Runde 1.",
    ).toBe(1);

    // (b) Tief eingerückt in einem Block auf Modulebene — läuft ebenfalls beim Import.
    const imBlock = `${echt}\nif (process.env.NODE_ENV) {\n      ${VERTRAGSNAME}(process.env);\n}\n`;
    expect(
      vertragsaufrufe(imBlock, "build-app.ts").filter((a) => a.ort === MODULRUMPF).length,
      "Der Aufruf in einem Block auf Modulebene wurde NICHT erkannt.",
    ).toBe(1);

    // (c) Sofort aufgerufene Funktion (IIFE) — sieht nach Funktion aus, läuft aber beim Import.
    const iife = `${echt}\n(() => {\n  ${VERTRAGSNAME}(process.env);\n})();\n`;
    expect(
      vertragsaufrufe(iife, "build-app.ts").filter((a) => a.ort === MODULRUMPF).length,
      "Der Aufruf in einer sofort aufgerufenen Funktion wurde NICHT erkannt.",
    ).toBe(1);

    // (d) GEGENRICHTUNG: ein Aufruf in einer echten, NICHT sofort gerufenen Funktion läuft NICHT
    //     beim Import und darf den Wächter nicht auslösen. Ohne diese Zeile wäre der Wächter auch
    //     dann grün-kaputt, wenn er einfach ALLES meldete — und R2/4 würde nie durchkommen.
    const inFunktion = `${echt}\nfunction niemalsGerufen() {\n  ${VERTRAGSNAME}(process.env);\n}\n`;
    const gemeldet = vertragsaufrufe(inFunktion, "build-app.ts").filter(
      (a) => a.ort === MODULRUMPF,
    );
    expect(
      gemeldet,
      "Ein Aufruf in einer gewöhnlichen Funktion wurde fälschlich als Modulrumpf gemeldet.",
    ).toEqual([]);
    expect(vertragsaufrufe(inFunktion, "build-app.ts").map((a) => a.ort)).toContain(
      "niemalsGerufen",
    );
  });

  it("R2/6 · KALIBRIERUNG: statische Klasseninitialisierung läuft beim Import", () => {
    // ============================================================================================
    // JOB 3828 · LÜCKE 1 — BENS PRÜFLÜCKE AUS JOB 3776 R2, JETZT GEMESSEN.
    // ============================================================================================
    //
    // Bis JOB 3828 war eine Klasse für `ortFuer` immer eine Grenze. Ein Aufruf in `static { … }`
    // bekam damit den KLASSENNAMEN als Ort und wurde nicht gemeldet — obwohl er beim `import`
    // läuft, also genau dort, wo JOB 3655 den Fehler hatte. (a) und (b) sind die Rückfalltür,
    // (c) und (d) sichern, dass die Reparatur die Klassengrenze nicht einfach streicht.
    //
    // Kalibriert wird wie in R2/5 gegen den ECHTEN Quelltext von `build-app.ts`, nicht gegen ein
    // Kunstbeispiel: jede Mutation hängt eine Klasse an die reale Datei an.
    //
    // WARUM DIE VIER MUTATIONEN `expect.soft` BENUTZEN und der Anker nicht: die vier prüfen VIER
    // verschiedene Elternketten. Eine harte Erwartung bricht beim ersten Fehlschlag ab, und wer
    // `ortFuer` verstellt, sähe dann nur (a) und müsste dreimal nachfahren, um zu erfahren, welche
    // Ketten er noch mitgerissen hat. Der Anker bleibt hart: stimmt der Ausgangsstand nicht, sagen
    // die Mutationen darunter ohnehin nichts.
    const echt = quelltext("services/app/src/build-app.ts");
    expect(
      vertragsaufrufe(echt, "build-app.ts").filter((a) => a.ort === MODULRUMPF),
      "Anker: der UNVERÄNDERTE Quelltext von build-app.ts ruft den Vertrag nicht beim Import.",
    ).toEqual([]);

    // (a) Statischer Block einer Klasse auf Modulebene. Er läuft, sobald die Klassendefinition
    //     ausgewertet wird — beim `import`, genauso wie die nackte Anweisung aus JOB 3655.
    const statischerBlock = `${echt}\nclass Riegel {\n  static {\n    ${VERTRAGSNAME}(process.env);\n  }\n}\n`;
    expect
      .soft(
        vertragsaufrufe(statischerBlock, "build-app.ts").filter((a) => a.ort === MODULRUMPF).length,
        `R2/6 (a): Der Aufruf in 'static { … }' wurde NICHT als Modulrumpf erkannt — genau BENs Prüflücke aus JOB 3776 Runde 2 (Elternkette über ClassStaticBlockDeclaration zur ClassDeclaration). ${WEG_ZURUECK}`,
      )
      .toBe(1);

    // (b) Statischer Feldinitialisierer. Andere Elternkette (PropertyDeclaration statt
    //     ClassStaticBlockDeclaration), dieselbe Laufzeit: beim `import`.
    const statischesFeld = `${echt}\nclass Riegel {\n  static wert = ${VERTRAGSNAME}(process.env);\n}\n`;
    expect
      .soft(
        vertragsaufrufe(statischesFeld, "build-app.ts").filter((a) => a.ort === MODULRUMPF).length,
        `R2/6 (b): Der Aufruf in 'static wert = …' wurde NICHT als Modulrumpf erkannt — die zweite Form derselben Lücke (Elternkette über PropertyDeclaration mit static). ${WEG_ZURUECK}`,
      )
      .toBe(1);

    // (c) GEGENRICHTUNG, Instanzfeld: `wert = …` läuft erst bei `new Riegel()`, nicht beim Import.
    //     Hier ist die Klasse zu Recht eine Grenze — wer sie streicht, meldet Fälle, die es nicht
    //     gibt (und R2/4 würde falsch).
    const instanzfeld = `${echt}\nclass Riegel {\n  wert = ${VERTRAGSNAME}(process.env);\n}\n`;
    expect
      .soft(
        vertragsaufrufe(instanzfeld, "build-app.ts").filter((a) => a.ort === MODULRUMPF),
        "R2/6 (c): Ein Aufruf in einem NICHT-statischen Feldinitialisierer wurde fälschlich als " +
          "Modulrumpf gemeldet — er läuft erst bei `new Riegel()`. Die Klassengrenze ist zu breit " +
          "gefallen.",
      )
      .toEqual([]);
    expect
      .soft(
        vertragsaufrufe(instanzfeld, "build-app.ts").map((a) => a.ort),
        "R2/6 (c): Der Ort des Instanzfeld-Aufrufs muss die Klasse `Riegel` sein.",
      )
      .toContain("Riegel");

    // (d) GEGENRICHTUNG, Klasse INNERHALB einer Funktion: der statische Block läuft dort erst,
    //     wenn die Funktion läuft. Der Merker darf die Klasse verbrauchen, nicht auch noch die
    //     Funktion darüber.
    const klasseInFunktion = `${echt}\nfunction nichtGerufen() {\n  class R {\n    static {\n      ${VERTRAGSNAME}(process.env);\n    }\n  }\n  void R;\n}\n`;
    expect
      .soft(
        vertragsaufrufe(klasseInFunktion, "build-app.ts").filter((a) => a.ort === MODULRUMPF),
        "R2/6 (d): Ein statischer Block in einer Klasse INNERHALB einer Funktion wurde fälschlich " +
          "als Modulrumpf gemeldet — er läuft erst, wenn `nichtGerufen()` läuft.",
      )
      .toEqual([]);
    expect
      .soft(
        vertragsaufrufe(klasseInFunktion, "build-app.ts").map((a) => a.ort),
        "R2/6 (d): Der Ort muss die umschliessende Funktion `nichtGerufen` sein.",
      )
      .toContain("nichtGerufen");
  });

  it("R2/7 · jeder Einstiegspunkt ist bekannt — der Suchlauf findet keinen vierten", () => {
    // ============================================================================================
    // JOB 3828 · LÜCKE 2 — DIE ZWEITE PRÜFLÜCKE AUS JOB 3776 R2: DAS INVENTAR.
    // ============================================================================================
    //
    // R2/1–R2/6 fassen drei Dateien namentlich an. Ein VIERTER Einstiegspunkt — eine neue Datei,
    // die `build-app` lädt und als eigener Prozess läuft — liefe an allen vorbei und bekäme den
    // Startvertrag nie, ohne dass etwas rot würde. Dieser Fall sucht sie deshalb selbst.
    const beginn = Date.now();
    const dateien = quelldateien();
    const gefunden = einstiegspunkte(dateien);
    const dauerMs = Date.now() - beginn;

    // KALIBRIERUNG (c) — DER SUCHLAUF HAT WIRKLICH DATEIEN GESEHEN. Ohne diese Probe wäre der Fall
    // auch dann grün, wenn er nichts fände: eine leere Menge trägt keine negative Aussage
    // (Zustandsmodell, s. `quelldateien`). Beide Suchordner müssen vorkommen — ein Inventar, das
    // nur `services/app/src/` liest, übersähe `tools/bodytext-nachziehen.ts`.
    const gelesen = dateien.map((d) => d.pfad);
    expect(
      gelesen.length,
      `Der Suchlauf hat nur ${gelesen.length} Datei(en) gelesen. Bei so wenigen ist die Aussage 'es gibt keinen unbekannten Einstiegspunkt' nicht belegt.`,
    ).toBeGreaterThan(50);
    expect(gelesen, "services/** wurde nicht gelesen.").toContain("services/app/src/server.ts");
    expect(gelesen, "tools/** wurde nicht gelesen.").toContain("tools/bodytext-nachziehen.ts");

    // DIE ZUSICHERUNG. Weicht die Menge ab, nennt `inventarBefund` die unerwarteten und die
    // fehlenden Pfade einzeln.
    expect(gefunden, inventarBefund(gefunden)).toEqual(ERWARTETE_EINSTIEGSPUNKTE);

    // GEGENRICHTUNG: `build-app` zu erwähnen oder sogar zu laden macht niemanden zum
    // Einstiegspunkt. Jeder dieser fünf ist gelesen worden und steht trotzdem NICHT im Inventar —
    // die Gründe stehen einzeln über `einstiegspunkte`.
    const NICHT_EINSTIEGSPUNKTE: [string, string][] = [
      ["services/app/index.ts", "reine Wiederausfuhr, keine ausführbare Anweisung, kein Riegel"],
      [
        "services/app/src/dev-persist.ts",
        "Bibliothek: auf Modulebene nur Deklarationen, deren Initialisierer beim Laden nichts " +
          "ausführen, und kein Riegel",
      ],
      ["services/app/src/seed-demo.ts", "nennt build-app nur im Kommentar"],
      ["services/app/src/build-app.ts", "das geladene Modul selbst, kein Lader"],
      ["services/app/src/build-app.test.ts", "Prüfcode, läuft unter Vitest"],
    ];
    // `expect.soft` aus demselben Grund wie in R2/6: wer die Aufnahmeregel zu weit fasst, soll ALLE
    // Pfade auf einmal erfahren, die dadurch hereinfallen, nicht nur den ersten.
    for (const [pfad, grund] of NICHT_EINSTIEGSPUNKTE) {
      expect
        .soft(
          gelesen,
          `${pfad} wurde vom Suchlauf gar nicht gelesen — dann belegt sein Nicht-Treffer nichts.`,
        )
        .toContain(pfad);
      expect
        .soft(gefunden, `${pfad} steht im Inventar, gehört dort aber nicht hin (${grund}).`)
        .not.toContain(pfad);
    }

    // KALIBRIERUNG (a) — DER BEFÜRCHTETE FEHLER SELBST: ein neuer Einstiegspunkt, der niemandem
    // auffällt. Die echte Dateiliste plus EIN synthetischer Eintrag; die Zusicherung oben muss
    // daran zerbrechen und den Pfad wörtlich nennen.
    //
    // RUNDE 2: MIT ZWEI EINTRÄGEN, nicht mehr mit einem. BEN hat gemessen, dass genau der zweite
    // (`.js`-Endung am Modulbezeichner) vorher unsichtbar blieb — die Probe mit nur dem ersten war
    // also grün, obwohl die Regel eine Lücke hatte. Beide Schreibweisen laufen jetzt durch
    // dieselbe Zusicherung.
    const mitErfundenem = einstiegspunkte([
      ...dateien,
      ERFUNDENER_EINSTIEGSPUNKT,
      ERFUNDENER_JS_EINSTIEGSPUNKT,
    ]);
    expect(
      mitErfundenem,
      `Ein vierter Einstiegspunkt (${ERFUNDENER_EINSTIEGSPUNKT.pfad}: dynamischer build-app-Import plus invokedDirectly-Riegel) wurde NICHT aufgenommen — das Inventar würde ihn übersehen.`,
    ).toContain(ERFUNDENER_EINSTIEGSPUNKT.pfad);
    expect(
      mitErfundenem,
      `Ein fünfter Einstiegspunkt (${ERFUNDENER_JS_EINSTIEGSPUNKT.pfad}: statischer Import von build-app.js, von BEN am echten Node-Prozess als ladbar gemessen) wurde NICHT aufgenommen — genau BENs Korrekturpflicht 1 aus Runde 1.`,
    ).toContain(ERFUNDENER_JS_EINSTIEGSPUNKT.pfad);
    expect(
      mitErfundenem,
      "Mit einem vierten Einstiegspunkt darf die Zusicherung oben NICHT mehr halten.",
    ).not.toEqual(ERWARTETE_EINSTIEGSPUNKTE);
    // Die Meldung führt die Unerwarteten EINZELN — nicht „zwei Abweichungen", sondern beide Pfade
    // wörtlich, sonst muss wer sie liest selbst suchen.
    const befundMitErfundenem = inventarBefund(mitErfundenem);
    expect(befundMitErfundenem, "Die Meldung sagt nicht, was unerwartet ist.").toContain(
      "UNERWARTET: ",
    );
    for (const pfad of [ERFUNDENER_EINSTIEGSPUNKT.pfad, ERFUNDENER_JS_EINSTIEGSPUNKT.pfad]) {
      expect(
        befundMitErfundenem,
        `Die Meldung nennt den unerwarteten Pfad ${pfad} nicht wörtlich: ${befundMitErfundenem}`,
      ).toContain(pfad);
    }

    // KALIBRIERUNG (b) — DIE ANDERE RICHTUNG DESSELBEN FEHLERS: ein bekannter Einstiegspunkt
    // verschwindet. Dann muss die Meldung ihn als FEHLEND benennen und nicht schweigen.
    const ohneServer = einstiegspunkte(
      dateien.filter((d) => d.pfad !== "services/app/src/server.ts"),
    );
    expect(ohneServer).not.toContain("services/app/src/server.ts");
    expect(
      inventarBefund(ohneServer),
      "Die Meldung nennt den fehlenden Pfad nicht wörtlich.",
    ).toContain("FEHLEND: services/app/src/server.ts");

    // REISSLEINE, keine Leistungsmessung: der Suchlauf liest reine Quelltexte ohne Typprüfer.
    // GEMESSEN in JOB 3828 auf dem Prüfrechner: 350 ms für 473 Dateien. Die Grenze liegt weit
    // darüber, damit sie auf einem geteilten Rechner nicht klappert — sie fängt nur einen Suchlauf,
    // der aus dem Ruder läuft (etwa weil jemand `node_modules` wieder mitnimmt).
    expect(
      dauerMs,
      `Der Suchlauf brauchte ${dauerMs} ms für ${gelesen.length} Dateien.`,
    ).toBeLessThan(20_000);
  });

  it("R2/8 · KALIBRIERUNG der Aufnahmeregel: Dateiendung und ausgeführter Initialisierer", () => {
    // ============================================================================================
    // RUNDE 2 — BENS ZWEI KORREKTURPFLICHTEN, JEDE MIT IHRER GEGENRICHTUNG.
    // ============================================================================================
    //
    // R2/7 misst die MENGE am echten Baum. Das reicht nicht: solange kein heutiger Einstiegspunkt
    // die neue Schreibweise benutzt, bleibt R2/7 auch mit einer löchrigen Aufnahmeregel grün — BEN
    // hat genau das gemessen („dieselbe Modulschreibweise bleibt im Inventar bei statischem Import,
    // dynamischem Import und Wiederausfuhr unsichtbar: UNERWARTET: keiner | FEHLEND: keiner").
    // Dieser Fall prüft deshalb die REGEL selbst, gegen Quelltexte, die es im Repo nicht gibt.
    //
    // Jede Probe wird EINZELN gefahren (eine Liste mit genau einer Datei), damit der Befund nicht
    // von einer anderen Probe stammt; `expect.soft`, damit ein Fehlgriff an der Regel ALLE
    // betroffenen Formen auf einmal nennt und nicht nur die erste.
    expect(
      AUFNAHMEPROBEN.some((p) => p.soll) && AUFNAHMEPROBEN.some((p) => !p.soll),
      "Die Kalibrierung braucht BEIDE Richtungen — sonst belegt sie nur, dass die Regel etwas oder nichts aufnimmt.",
    ).toBe(true);

    for (const probe of AUFNAHMEPROBEN) {
      const gefunden = einstiegspunkte([{ pfad: probe.pfad, quelle: probe.quelle }]);
      if (probe.soll) {
        expect
          .soft(
            gefunden,
            `${probe.pfad} MUSS ein Einstiegspunkt sein (${probe.warum}) — die Aufnahmeregel übersieht ihn. Quelltext:\n${probe.quelle}`,
          )
          .toEqual([probe.pfad]);
      } else {
        expect
          .soft(
            gefunden,
            `${probe.pfad} darf KEIN Einstiegspunkt sein (${probe.warum}) — die Aufnahmeregel greift zu weit. Quelltext:\n${probe.quelle}`,
          )
          .toEqual([]);
      }
    }

    // UND DIE BEIDEN AUSSCHLÜSSE GELTEN WEITER, auch für eine Datei, die alles andere erfüllt:
    // dieselbe Quelle einmal als Werkzeug, einmal als Prüfcode, einmal als das geladene Modul.
    const tauglich = AUFNAHMEPROBEN.find((p) => p.pfad === "tools/kp2-ausgefuehrt.ts");
    expect(
      tauglich,
      "Die Probe kp2-ausgefuehrt.ts fehlt — ohne sie sagt der Rest nichts.",
    ).toBeDefined();
    const taugliche = tauglich?.quelle ?? "";
    expect
      .soft(
        einstiegspunkte([{ pfad: "tests/erfunden/kp2-ausgefuehrt.ts", quelle: taugliche }]),
        "Eine Datei unter tests/ läuft unter Vitest und ist kein Einstiegspunkt — der Ausschluss greift nicht mehr.",
      )
      .toEqual([]);
    expect
      .soft(
        einstiegspunkte([{ pfad: "services/app/src/erfunden.test.ts", quelle: taugliche }]),
        "Eine *.test.ts läuft unter Vitest und ist kein Einstiegspunkt — der Ausschluss greift nicht mehr.",
      )
      .toEqual([]);
    expect
      .soft(
        einstiegspunkte([{ pfad: DAS_GELADENE_MODUL, quelle: taugliche }]),
        `${DAS_GELADENE_MODUL} ist das geladene Modul, kein Lader — der Ausschluss greift nicht mehr.`,
      )
      .toEqual([]);
  });
});
