// ================================================================================================
// JOB 2605 · D1 — DER AUFRUFER-WÄCHTER: was exportiert wird, muss auch gerufen werden.
// ================================================================================================
//
// DER FEHLER, GEGEN DEN DIESE DATEI STEHT, ist der häufigste dieses Projekts: Etwas wird gebaut,
// getestet, grün geurteilt — und **nie aufgerufen**. Es liegt im Produkt und tut nichts. Niemand
// merkt es, weil alle Tests grün sind. Vier Kennungen aus `OFFEN.md` belegen ihn über vier Wochen:
//
//     S2   `expandSearchTerms`   Baustein gebaut, null Produktionsaufrufer   (OFFEN.md, 21.08.)
//     H3   `wissensnetzLuecken`  vier Dateien, kein Aufrufer                 (OFFEN.md)
//     KA2  Vertrag seit JOB 1151 gelesen, Erzeuger fehlte bis 22.08.         (OFFEN.md)
//     TV1  `titelVorschlag`      Typ bekannt, kein `.tsx` ruft ihn
//
// Die Doktrin dazu steht seit langem im Haus und wird hier nicht neu erfunden:
// `tools/modalgrenze.ts:8` — **„Ein Test ist kein Aufrufer."**
//
// ------------------------------------------------------------------------------------------------
// WARUM ÜBER DEN SYNTAXBAUM UND NICHT ÜBER ZEICHENKETTEN
// ------------------------------------------------------------------------------------------------
// Der vorhandene Prüfstand `promote-operation-callers.test.ts` prüft dieselbe FRAGE für EINE
// Operation, aber mit `toContain`/`toMatch` auf dem Rohtext. Für einen einzelnen, benannten Aufruf
// trägt das; auf der Fläche trägt es nicht, und das ist gemessen und nicht vermutet:
//
//     `fuehreBestandsresetAus` steht in `build-app.ts:684` — in einem KOMMENTAR.
//     `wissensnetzLuecken`     steht in `wissensnetz/index.ts:13` — als BARREL-RE-EXPORT.
//
// Eine Zeichenkettensuche zählt beides als Aufrufer und meldet Entwarnung, wo keine ist. Dieser
// Wächter zählt deshalb Identifier-Knoten im TypeScript-AST: Kommentare kommen dort gar nicht vor,
// und Import-/Exportdeklarationen werden ausdrücklich übersprungen.
//
// ------------------------------------------------------------------------------------------------
// DIE DREI ENTSCHEIDUNGEN (Auftrag §4) — getroffen, nicht erfragt
// ------------------------------------------------------------------------------------------------
//
// 1. WAS IST EIN AUFRUFER? Eine Verwendung des Namens in einer anderen Nicht-Test-Quelldatei,
//    ausserhalb von Import- und Exportdeklarationen. Damit zählen NICHT: Kommentare (stehen nicht
//    im AST), Barrel-Re-Exporte (`export { x } from "./y"`) und reine Typ-Importe (`import type`
//    ist eine ImportDeclaration und wird übersprungen). Genau diese drei sind die Wege, auf denen
//    die vier Altfälle jahrelang wie verdrahtet aussahen.
//
// 2. WELCHE FLÄCHE? Die Exporte unter `services/**` — die Fläche, auf der die belegten Fälle
//    liegen. Gesucht wird der Aufrufer im ganzen Nicht-Test-Baum (`services`, `apps/web/src`,
//    `tools`, `scripts` sowie die Einzeldateien in `SUCHDATEIEN`): ein Export ist auch dann
//    verdrahtet, wenn ihn die Oberfläche oder die Buildkonfiguration ruft.
//
// 3. WAS GILT ALS „OHNE AUFRUFER"? Ein Export, der WEDER von aussen NOCH in seiner eigenen Datei
//    verwendet wird. Gemessen am 27.08.2026 an beiden möglichen Schnitten:
//
//        keine FREMDE Verwendung                       356 von 874 Exporten
//        zusätzlich in der EIGENEN Datei ungenutzt      66 von 874 Exporten
//
//    Der weite Schnitt (356) ist FALSCH für diesen Zweck: `wissensnetzLuecken` steht darin,
//    obwohl `luecken-einstieg.ts:77` ihn ruft — er arbeitet, sein Export ist nur breiter als nötig.
//    Das ist ein Stilbefund, kein „tut nichts". Der enge Schnitt (66) trifft, was wirklich in der
//    Luft hängt. Auftrag §4.2: „Eine enge Fläche, die trägt, ist besser als eine weite, die
//    abgeschaltet wird."
//
// ------------------------------------------------------------------------------------------------
// WAS DIESER WÄCHTER LEISTET — und was ausdrücklich nicht
// ------------------------------------------------------------------------------------------------
//   Ein NEUER Export ohne Aufrufer            -> rot, mit Name, Pfad und Zeile
//   Ein Export MIT Aufrufer                   -> grün (sonst wird der Wächter abgeschaltet)
//   Ein Registereintrag, der behoben wurde    -> rot mit „entfernen", damit das Register schrumpft
//
// Er behob den Altbestand anfangs NICHT (Auftrag §4) — er fror ihn ein und sperrte den Neuzugang.
// R-1349 (Nacharbeit 4): der Altbestand ist inzwischen Fall für Fall abgebaut; geduldet ist nur noch,
// was einen geprüften Grund trägt (Register `BEWUSST`, `BEWUSST_WEB`) oder als UNERLEDIGTER Rest
// mit belegter Sperre bzw. gesondertem Auftrag abgegrenzt ist (`OFFENER_REST`, Nacharbeit 6).
//
// GRENZE, ausdrücklich benannt: Die Zuordnung läuft über den NAMEN, nicht über die aufgelöste
// Modulkante. Zwei gleichnamige Exporte in verschiedenen Paketen decken sich dadurch gegenseitig.
// Das macht den Wächter milder, nie falsch-rot — die richtige Richtung für einen Wächter, der im
// Tor bleiben soll. Eine echte Modulauflösung bräuchte ein `ts.Program` über den ganzen Baum und
// kostet ein Vielfaches der Laufzeit.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { WURZEL, istExportiert, posix, quelldateien, quelleAus } from "../../tools/modalgrenze";

/**
 * Die überwachten Flächen.
 *
 * JOB 2611 D1 · `apps/web/src` kommt dazu. Bis hierher stand hier `"services"` allein, während
 * `apps/web/src` schon als SUCHBAUM diente — die Fläche wurde also nach Aufrufern durchsucht, aber
 * nie selbst überwacht. Ein Export dort, den niemand ruft, fiel dem Wächter nicht auf.
 *
 * Das ist genau die Fläche, auf der gearbeitet wird, und von den vier belegten Altfällen liegt
 * einer dort: TV1 — `api/types.ts` kannte den Typ, kein `.tsx` rief ihn auf. Er blieb wochenlang
 * unsichtbar und war deshalb der teuerste.
 *
 * `tools` und `scripts` bleiben ausdrücklich draußen: eine Fläche nach der anderen (Auftrag §4).
 */
const UEBERWACHT = ["services", "apps/web/src"] as const;

/** Wo nach Aufrufern gesucht wird — der ganze Nicht-Test-Baum. */
const SUCHBAEUME = ["services", "apps/web/src", "tools", "scripts"] as const;

/**
 * EINZELNE Nicht-Test-Quelldateien, die ausserhalb der Suchbaeume liegen und trotzdem Aufrufer
 * sind.
 *
 * JOB 4367 · DER ANLASS, gemessen: `apps/web/src/texte/intern/sammeln.ts::textmodulVertrag` wurde
 * hier als „ohne Aufrufer" gemeldet — und hatte einen. Er steht in `apps/web/vite.config.ts`
 * (`plugins: [react(), klaraStand(), textmodulVertrag()]`), also EINE Ebene ueber `apps/web/src`
 * und damit ausserhalb jedes Suchbaums. Das ist kein Sonderfall dieses einen Exports: die
 * Buildkonfiguration ist Produktionscode — sie laeuft in JEDEM `vite build`, auch im Docker-Bau
 * (`Dockerfile:15`) —, und sie ist der natuerliche Ort, an dem Bau-Werkzeuge verdrahtet werden.
 *
 * WARUM EINE DATEILISTE UND NICHT `"apps/web"` ALS BAUM: ein ganzer Baum naehme
 * `apps/web/public/word-addin/*.js` mit. Dort stehen tausende Zeilen ausgelieferten Codes, und
 * jede Namensnennung darin wuerde ab dann als Aufruf zaehlen — der Waechter wuerde LEISER, statt
 * genauer zu werden. Diese Liste erweitert die Suchflaeche um genau eine Datei.
 *
 * `existsSync` unten: die Kalibrierungsfaelle A2/A3 fahren `erhebe` gegen EIGENE Wurzeln, in denen
 * es diese Datei nicht gibt. Sie fehlt dort einfach — kein Lesefehler, keine Sonderbehandlung.
 */
const SUCHDATEIEN = ["apps/web/vite.config.ts"] as const;

interface Fund {
  readonly datei: string;
  /** Der Bezeichner in der Datei — so steht er in der Meldung, so sucht man ihn im Quelltext. */
  readonly name: string;
  /**
   * Der Name, unter dem das MODUL ihn herausgibt: `"default"` beim Standardexport, sonst `name`.
   *
   * JOB 2611 D1. Auf `services/**` fielen beide zusammen, denn dort gibt es kaum Standardexporte.
   * Auf `apps/web/src` ist der Standardexport die Regel — und dort trennt sich beides:
   *
   *     App.tsx:87      export default function App() { … }        Fund.name = "App"
   *     main.tsx:5      import App from "./App"                    Importkante.exportname = "default"
   *
   * Verglichen wurde bis hierher `Importkante.exportname` gegen `Fund.name`. Fuer `App` heisst
   * das `"default" !== "App"` — kein Treffer, und der Waechter meldete die WURZELKOMPONENTE DER
   * ANWENDUNG als ohne Aufrufer, obwohl `main.tsx:33` sie als `<App />` rendert.
   *
   * Das ist ein FALSCH-ROT, und genau die Sorte Fehler, die einen Waechter abschaltet. Auf der
   * alten Flaeche war er unsichtbar; er kommt mit der neuen Flaeche, nicht durch sie.
   */
  readonly exportname: string;
  readonly zeile: number;
  readonly art: string;
}

/** Traegt diese Deklaration das Schluesselwort `default`? */
function istStandardexport(n: ts.Declaration): boolean {
  return (ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Default) !== 0;
}

/** Die exportierten WERTE einer Datei. `interface`/`type` sind keine Werte und stehen nicht drin. */
function exporteAus(datei: string, sf: ts.SourceFile): Fund[] {
  const raus: Fund[] = [];
  const zeile = (n: ts.Node): number => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  for (const s of sf.statements) {
    if (ts.isFunctionDeclaration(s) && s.name && istExportiert(s)) {
      raus.push({
        datei,
        name: s.name.text,
        exportname: istStandardexport(s) ? "default" : s.name.text,
        zeile: zeile(s),
        art: "function",
      });
    } else if (ts.isClassDeclaration(s) && s.name && istExportiert(s)) {
      raus.push({
        datei,
        name: s.name.text,
        exportname: istStandardexport(s) ? "default" : s.name.text,
        zeile: zeile(s),
        art: "class",
      });
    } else if (
      ts.isVariableStatement(s) &&
      s.declarationList.declarations[0] !== undefined &&
      istExportiert(s.declarationList.declarations[0] as ts.Declaration)
    ) {
      for (const d of s.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) {
          // Eine Variablendeklaration kann kein `export default` tragen — Name und Exportname
          // fallen hier immer zusammen.
          raus.push({
            datei,
            name: d.name.text,
            exportname: d.name.text,
            zeile: zeile(d),
            art: "const",
          });
        }
      }
    }
  }
  return raus;
}

/**
 * Die Namen, die eine Datei VERWENDET.
 *
 * Übersprungen werden Import- und Exportdeklarationen (Verdrahtung, keine Verwendung) und der
 * Bezeichner IN der eigenen Deklaration (`export function x()` nennt `x`, ruft ihn nicht).
 *
 * AUSSCHLIESSLICH `ts.forEachChild`. Der Baum darf NICHT mit `getChildren()` gemischt werden:
 * das liefert die Syntax-Ebene mit `SyntaxList`-Knoten, und `forEachChild` steigt in eine
 * `SyntaxList` nicht ab. Beim ersten Anlauf dieses Wächters hat genau diese Mischung jeden
 * Klassenrumpf verschluckt — der echte Aufruf in `search-projection-repo.ts:704`
 * (`ClassDeclaration > MethodDeclaration > …`) war unsichtbar, und die Fundzahl stand bei 210
 * statt bei 66. Aufgefallen ist es nur an der Kalibrierung unten.
 */
/**
 * Die Namen, die eine Datei verwendet — und zwar SO, dass die Verwendung das Symbol des
 * Modulscopes bezeichnet.
 *
 * JOB 2605 D3. BENs Befund an D2: „R2 und R3 schliessen den entscheidenden Falsch-Gruen-Fall
 * 'Import vorhanden, nur eine unabhaengige gleichnamige Nennung wird benutzt' nicht aus."
 * Gemessen (D3, Vorlauf R4): Eine Datei importiert `x`, deklariert im Rumpf `const x = 42` und
 * benutzt nur dieses — D2 zaehlte das als Verwendung des Imports. Der Export war trotzdem tot.
 *
 * DIE UNTERSCHEIDUNG KOMMT AUS DER BINDUNG, nicht aus den Formen des Prueffalls: Beim Abstieg
 * wird mitgefuehrt, welche Namen an dieser Stelle durch eine INNERE Deklaration verdeckt sind.
 * Ein verdeckter Bezeichner bezeichnet nicht mehr das Modulsymbol und zaehlt darum nicht.
 * Damit faellt jede Form, die einen Namen neu bindet — lokale Variable, Parameter, Fangvariable,
 * Schleifenvariable, innere Funktion oder Klasse —, ohne dass eine davon einzeln aufgezaehlt wird.
 *
 * Ausserdem sind EIGENSCHAFTSNAMEN keine Bezeichner des Scopes: `o.x`, `{ x: 1 }` und
 * `{ x }: { x: number }` nennen `x`, lesen aber kein Modulsymbol. Der Kurzschreibweise
 * `{ x }` liegt sehr wohl eine Leseoperation zugrunde — sie zaehlt.
 */
function bindungenVon(n: ts.Node): string[] {
  const namen: string[] = [];
  const ausBindung = (b: ts.BindingName): void => {
    if (ts.isIdentifier(b)) {
      namen.push(b.text);
      return;
    }
    for (const e of b.elements) {
      if (ts.isBindingElement(e)) {
        ausBindung(e.name);
      }
    }
  };
  const ausStatement = (s: ts.Statement): void => {
    if (ts.isVariableStatement(s)) {
      for (const d of s.declarationList.declarations) {
        ausBindung(d.name);
      }
    } else if ((ts.isFunctionDeclaration(s) || ts.isClassDeclaration(s)) && s.name) {
      namen.push(s.name.text);
    }
  };

  if (ts.isFunctionLike(n)) {
    for (const p of n.parameters) {
      ausBindung(p.name);
    }
    // Nur eine Funktionsdeklaration oder ein benannter Funktionsausdruck bindet ihren Namen im
    // eigenen Rumpf. Ein METHODEN- oder Accessor-Name bindet nichts: in
    // `async riskHorizon() { return riskHorizon(…); }` (services/management/src/service.ts) ruft
    // der Rumpf den IMPORT. Vorher galt der Methodenname als Verdeckung, und der Wächter meldete
    // den gerufenen Export `horizon.ts::riskHorizon` fälschlich als ohne Aufrufer (A7).
    if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)) && n.name) {
      namen.push(n.name.text);
    }
  }
  if (ts.isBlock(n) || ts.isCaseClause(n) || ts.isDefaultClause(n) || ts.isModuleBlock(n)) {
    for (const s of n.statements) {
      ausStatement(s);
    }
  }
  if (ts.isCatchClause(n) && n.variableDeclaration) {
    ausBindung(n.variableDeclaration.name);
  }
  if (
    (ts.isForStatement(n) || ts.isForOfStatement(n) || ts.isForInStatement(n)) &&
    n.initializer &&
    ts.isVariableDeclarationList(n.initializer)
  ) {
    for (const d of n.initializer.declarations) {
      ausBindung(d.name);
    }
  }
  return namen;
}

/** Ist dieser Identifier ein Eigenschaftsname und damit kein Bezeichner des Scopes? */
function istEigenschaftsname(n: ts.Identifier): boolean {
  const p = n.parent;
  if (!p) {
    return false;
  }
  if (ts.isPropertyAccessExpression(p)) {
    return p.name === n;
  }
  // `{ x: wert }` — der Schluessel liest nichts. Die Kurzform `{ x }` hat KEINEN initializer
  // und ist sehr wohl eine Leseoperation.
  if (ts.isPropertyAssignment(p)) {
    return p.name === n;
  }
  if (
    ts.isPropertySignature(p) ||
    ts.isMethodSignature(p) ||
    ts.isMethodDeclaration(p) ||
    ts.isPropertyDeclaration(p) ||
    ts.isEnumMember(p)
  ) {
    return "name" in p && p.name === n;
  }
  if (ts.isBindingElement(p)) {
    return p.propertyName === n || p.name === n;
  }
  if (ts.isQualifiedName(p)) {
    return p.right === n;
  }
  return false;
}

function verwendungen(sf: ts.SourceFile): Set<string> {
  const raus = new Set<string>();
  const gehe = (n: ts.Node, verdeckt: ReadonlySet<string>): void => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) {
      return;
    }
    if (ts.isIdentifier(n)) {
      if (!verdeckt.has(n.text) && !istEigenschaftsname(n)) {
        raus.add(n.text);
      }
      return;
    }
    const neue = bindungenVon(n);
    const jetzt = neue.length === 0 ? verdeckt : new Set([...verdeckt, ...neue]);
    ts.forEachChild(n, (k) => {
      // R-1349 (Nacharbeit 4): übersprungen wird nur der deklarierte BEZEICHNER. Ein
      // Destrukturierungsmuster (`const { x = WERT } = o`) wird betreten: seine Namen sind
      // Eigenschafts- bzw. Bindungsnamen (`istEigenschaftsname`) und zählen nicht, seine
      // Vorgabewerte sind echte Leseoperationen. Vorher fiel das ganze Muster weg, und
      // `facetRail.ts::FACET_SEARCH_THRESHOLD` (gelesen als `searchThreshold =
      // FACET_SEARCH_THRESHOLD`) stand als „ohne Aufrufer" im Altbestand — ein Fehlalarm (A9).
      if (
        (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n) || ts.isVariableDeclaration(n)) &&
        k === n.name &&
        ts.isIdentifier(k)
      ) {
        return;
      }
      gehe(k, jetzt);
    });
  };
  ts.forEachChild(sf, (k) => gehe(k, new Set<string>()));
  return raus;
}

// ------------------------------------------------------------------------------------------------
// JOB 2605 D2 — DIE BINDUNG VON IMPORT UND VERWENDUNG
// ------------------------------------------------------------------------------------------------
// BENs Befund an D1, wörtlich: „Eine beliebige gleichnamige Identifier-Nennung kann einen
// unaufgerufenen Export decken." Er trifft. D1 fragte nur, ob der NAME irgendwo in einer anderen
// Datei vorkommt — ein lokales `const bewerte = 42` in einer beliebigen Datei deckte damit einen
// unaufgerufenen `export function bewerte`. Gemessen in D2 (Stand T2).
//
// Der Vertrag hat zwei Hälften, und beide müssen aneinander gebunden sein:
//   (1) IMPORT      — die verwendende Datei importiert das Symbol AUS DIESEM MODUL,
//   (2) VERWENDUNG  — und benutzt den (ggf. umbenannten) LOKALEN Bezeichner.
//
// Nicht „der Name kommt vor", sondern „DIESES Symbol, aus DIESEM Modul, wird HIER benutzt".
//
// GEWÄHLTER WEG (von zweien, die der Auftrag freigibt): den Importnamen je Datei auflösen,
// einschliesslich Umbenennung (`import { a as b }`), Standardimport und Namensraumimport. Der
// zweite Weg (nur am Syntaxbaum arbeiten) war schon in D1 erfüllt und genügte nicht — das Problem
// ist nicht die Zeilenlesung, sondern die fehlende Bindung.
//
// WARUM BARRELS MITVERFOLGT WERDEN MÜSSEN: `gatedPool` wird in `build-app.ts` über
// `import { gatedPool } from "../../db-tx"` geholt, definiert ist er in
// `db-tx/src/gated-pool.ts`; dazwischen steht `db-tx/index.ts` mit `export { gatedPool } from
// "./src/gated-pool"`. Ohne Weiterverfolgung wäre er „ohne Aufrufer" — ein Fehlalarm auf
// nachweislich verdrahtetem Code. Die Kalibrierung A2 hält genau das fest.

/** Eine Importkante: welcher lokale Bezeichner steht für welchen Export welchen Moduls. */
interface Importkante {
  /** Der Name in DIESER Datei — nach `as` umbenannt, falls umbenannt. */
  readonly lokal: string;
  /** Der Name im Zielmodul; `default` beim Standardimport, `*` beim Namensraumimport. */
  readonly exportname: string;
  /** Der Modulspezifikator, wie er dasteht. */
  readonly spezifikator: string;
}

/** Ein Re-Export: `export { a as b } from "./z"` oder `export * from "./z"`. */
interface Reexport {
  /** Der nach aussen sichtbare Name; `*` bei `export * from`. */
  readonly nachAussen: string;
  /** Der Name im Quellmodul. */
  readonly imQuellmodul: string;
  readonly spezifikator: string;
}

/**
 * Die Importkanten einer Datei. Reine Typ-Importe zählen NICHT — weder `import type { … }` noch
 * `import { type X }`. Genau daran hängt TV1: `api/types.ts` kennt den Typ, und kein `.tsx` ruft
 * ihn auf.
 */
function importeAus(sf: ts.SourceFile): Importkante[] {
  const raus: Importkante[] = [];
  for (const s of sf.statements) {
    if (!ts.isImportDeclaration(s) || !ts.isStringLiteral(s.moduleSpecifier)) {
      continue;
    }
    const spezifikator = s.moduleSpecifier.text;
    const klausel = s.importClause;
    if (!klausel || klausel.isTypeOnly) {
      continue;
    }
    if (klausel.name) {
      raus.push({ lokal: klausel.name.text, exportname: "default", spezifikator });
    }
    const b = klausel.namedBindings;
    if (b && ts.isNamespaceImport(b)) {
      raus.push({ lokal: b.name.text, exportname: "*", spezifikator });
    } else if (b && ts.isNamedImports(b)) {
      for (const e of b.elements) {
        if (e.isTypeOnly) {
          continue;
        }
        raus.push({
          lokal: e.name.text,
          exportname: (e.propertyName ?? e.name).text,
          spezifikator,
        });
      }
    }
  }
  return raus;
}

/** Die Re-Exporte einer Datei — die Kanten, über die ein Barrel weiterreicht. */
function reexporteAus(sf: ts.SourceFile): Reexport[] {
  const raus: Reexport[] = [];
  for (const s of sf.statements) {
    if (
      !ts.isExportDeclaration(s) ||
      !s.moduleSpecifier ||
      !ts.isStringLiteral(s.moduleSpecifier)
    ) {
      continue;
    }
    if (s.isTypeOnly) {
      continue;
    }
    const spezifikator = s.moduleSpecifier.text;
    if (!s.exportClause) {
      raus.push({ nachAussen: "*", imQuellmodul: "*", spezifikator });
    } else if (ts.isNamedExports(s.exportClause)) {
      for (const e of s.exportClause.elements) {
        if (e.isTypeOnly) {
          continue;
        }
        raus.push({
          nachAussen: e.name.text,
          imQuellmodul: (e.propertyName ?? e.name).text,
          spezifikator,
        });
      }
    }
  }
  return raus;
}

/** Die Namen, auf die über einen Namensraumimport zugegriffen wird: `x.foo` → `foo`. */
function namensraumZugriffe(sf: ts.SourceFile, lokal: string): Set<string> {
  const raus = new Set<string>();
  const gehe = (n: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === lokal
    ) {
      raus.add(n.name.text);
    }
    ts.forEachChild(n, gehe);
  };
  ts.forEachChild(sf, gehe);
  return raus;
}

// ------------------------------------------------------------------------------------------------
// JOB 3030 — DER DYNAMISCHE IMPORT WAR EIN BLINDER FLECK, UND ER IST JETZT EINE KANTE.
// ------------------------------------------------------------------------------------------------
//
// DER BEFUND, gemessen und nicht vermutet: Seit JOB 3030 lädt `apps/web/src/routes.tsx` jede Seite
// über `lazy(() => import("./pages/Admin").then((m) => ({ default: m.Admin })))` nach. Damit wurden
// 27 Seiten-Exporte SCHLAGARTIG „ohne Aufrufer" gemeldet — obwohl sie unverändert auf denselben
// Routen hängen und der echte Browser sie lädt. Der Grund liegt allein in diesem Wächter:
//   · `importeAus` liest NUR `ImportDeclaration`-Knoten; ein `import(…)` ist eine CallExpression.
//   · `verwendungen` zählt `m.Admin` zu Recht NICHT — `istEigenschaftsname` schliesst
//     Eigenschaftsnamen aus, weil `o.x` normalerweise kein Modulsymbol liest.
// Beim NAMENSRAUMIMPORT (`import * as m from "x"`) macht dieser Wächter genau die Ausnahme, die
// hier fehlte: `namensraumZugriffe` liest dort `m.X` als Zugriff auf den Export `X`. Ein dynamischer
// Import liefert DASSELBE Ding — ein Modul-Namensraumobjekt —, nur eben als Versprechen.
//
// DIE ERWEITERUNG IST BEWUSST ENG. Gezählt wird ein Zugriff nur, wenn BEIDES zusammenkommt: ein
// dynamischer Import mit statisch lesbarem Pfad (`ts.isStringLiteralLike`, dieselbe Regel wie in
// `tests/legal/mega61-rechtsseiten.test.tsx` — ein Template-Literal ohne Platzhalter ist ein
// gültiger Pfad), UND ein Abgriff genau des Exportnamens am Namensraum dieses Imports. Ein `m.Admin` ohne
// zugehörigen `import("./pages/Admin")` deckt nichts; das ist unten der Negativfall in A6. Damit
// wird der Wächter GENAUER und nicht weicher: keine einzige Ausnahme kommt ins Register.
/** Ein Zugriff auf einen Export über einen DYNAMISCHEN Import: `import("./x").then((m) => m.Y)`. */
interface DynamischerZugriff {
  /** Der Name im Zielmodul. */
  readonly exportname: string;
  /** Der Modulspezifikator, wie er dasteht. */
  readonly spezifikator: string;
}

function dynamischeZugriffeAus(sf: ts.SourceFile): DynamischerZugriff[] {
  const raus: DynamischerZugriff[] = [];

  /**
   * Was aus einer Bindung folgt, die einen Modul-Namensraum aufnimmt:
   *   `(m) => … m.Y …`   → jeder Abgriff `m.<Name>` im Teilbaum
   *   `({ Y }) => …`      → das Feld selbst (die Destrukturierung IST der Abgriff)
   */
  const ausNamensraum = (name: ts.BindingName, wo: ts.Node, spezifikator: string): void => {
    if (ts.isIdentifier(name)) {
      const lokal = name.text;
      const gehe = (n: ts.Node): void => {
        if (
          ts.isPropertyAccessExpression(n) &&
          ts.isIdentifier(n.expression) &&
          n.expression.text === lokal
        ) {
          raus.push({ exportname: n.name.text, spezifikator });
        }
        ts.forEachChild(n, gehe);
      };
      gehe(wo);
      return;
    }
    if (ts.isObjectBindingPattern(name)) {
      for (const e of name.elements) {
        const quelle = e.propertyName ?? e.name;
        if (ts.isIdentifier(quelle)) {
          raus.push({ exportname: quelle.text, spezifikator });
        }
      }
    }
  };

  const gehe = (n: ts.Node): void => {
    const erstes = ts.isCallExpression(n) ? n.arguments[0] : undefined;
    if (
      ts.isCallExpression(n) &&
      n.expression.kind === ts.SyntaxKind.ImportKeyword &&
      erstes &&
      ts.isStringLiteralLike(erstes)
    ) {
      const spezifikator = erstes.text;
      // Form 1: `import("./x").then((m) => …)` — die Form, die `lazy()` verlangt.
      const zugriff = n.parent;
      if (
        zugriff &&
        ts.isPropertyAccessExpression(zugriff) &&
        zugriff.expression === n &&
        zugriff.name.text === "then" &&
        zugriff.parent &&
        ts.isCallExpression(zugriff.parent)
      ) {
        const fn = zugriff.parent.arguments[0];
        const erster =
          fn && (ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))
            ? fn.parameters[0]
            : undefined;
        if (fn && erster) {
          ausNamensraum(
            erster.name,
            (fn as ts.ArrowFunction | ts.FunctionExpression).body,
            spezifikator,
          );
        }
      }
      // Form 2: `const m = await import("./x")` bzw. `const m = import("./x")`.
      // Der Teilbaum ist hier die ganze Datei — dieselbe Ungenauigkeit, die `namensraumZugriffe`
      // beim statischen Namensraumimport seit jeher hat, und aus demselben Grund tragbar: der
      // SPEZIFIKATOR ist mitgebunden, ein zufällig gleichnamiges Objekt deckt also nichts, dessen
      // Modulpfad nicht ohnehin dasteht.
      const roh = zugriff && ts.isAwaitExpression(zugriff) ? zugriff.parent : zugriff;
      if (roh && ts.isVariableDeclaration(roh) && roh.initializer) {
        ausNamensraum(roh.name, sf, spezifikator);
      }
      // Form 3 (R-1349, Nacharbeit 7): mehrere Module gemeinsam — `Promise.all([import("./a"),
      // import("./b")])`. Der Namensraum steht dann an DERSELBEN STELLE der Ergebnisliste, an der
      // der Import in der Liste steht; nur diese Bindung wird gelesen, sonst deckte `a` den Export
      // von `b`. Gemessen an `apps/web/src/components/KlaraAssistant.tsx` (Klaras Bibliothek und
      // Elementbeispiele, `laden.then(([modul, beispiele]) => …)`).
      if (zugriff && ts.isArrayLiteralExpression(zugriff)) {
        zugriffeAusPromiseAll(zugriff, zugriff.elements.indexOf(n), spezifikator);
      }
    }
    ts.forEachChild(n, gehe);
  };

  /** Ein `.then(fn)` bzw. `.then(function …)` an `ausdruck` — sein erster Parameter und Rumpf. */
  const handlerVon = (aufruf: ts.Node): { name: ts.BindingName; rumpf: ts.Node } | undefined => {
    if (!ts.isCallExpression(aufruf)) {
      return undefined;
    }
    const fn = aufruf.arguments[0];
    if (!fn || !(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn))) {
      return undefined;
    }
    const erster = fn.parameters[0];
    return erster ? { name: erster.name, rumpf: fn.body } : undefined;
  };

  const zugriffeAusPromiseAll = (
    liste: ts.ArrayLiteralExpression,
    stelle: number,
    spezifikator: string,
  ): void => {
    const alle = liste.parent;
    if (
      !alle ||
      !ts.isCallExpression(alle) ||
      alle.arguments[0] !== liste ||
      !ts.isPropertyAccessExpression(alle.expression) ||
      !ts.isIdentifier(alle.expression.expression) ||
      alle.expression.expression.text !== "Promise" ||
      alle.expression.name.text !== "all"
    ) {
      return;
    }
    const ausListe = (bindung: ts.BindingName, rumpf: ts.Node): void => {
      const element = ts.isArrayBindingPattern(bindung) ? bindung.elements[stelle] : undefined;
      if (element && ts.isBindingElement(element)) {
        ausNamensraum(element.name, rumpf, spezifikator);
      }
    };
    const thenAn = (ziel: ts.Node): ts.Node | undefined => {
      const zugriff = ziel.parent;
      return zugriff &&
        ts.isPropertyAccessExpression(zugriff) &&
        zugriff.expression === ziel &&
        zugriff.name.text === "then"
        ? zugriff.parent
        : undefined;
    };
    // `Promise.all([...]).then(([a, b]) => …)`
    const direkt = thenAn(alle);
    const h = direkt ? handlerVon(direkt) : undefined;
    if (h) {
      ausListe(h.name, h.rumpf);
    }
    // `const [a, b] = await Promise.all([...])` bzw. `const laden = Promise.all([...])` und später
    // `laden.then(([a, b]) => …)`.
    const oben =
      alle.parent && ts.isAwaitExpression(alle.parent) ? alle.parent.parent : alle.parent;
    if (oben && ts.isVariableDeclaration(oben) && oben.initializer) {
      if (ts.isArrayBindingPattern(oben.name)) {
        ausListe(oben.name, sf);
      } else if (ts.isIdentifier(oben.name) && oben.initializer === alle) {
        const lokal = oben.name.text;
        const suche = (k: ts.Node): void => {
          if (ts.isIdentifier(k) && k.text === lokal && k !== oben.name) {
            const spaeter = thenAn(k);
            const hs = spaeter ? handlerVon(spaeter) : undefined;
            if (hs) {
              ausListe(hs.name, hs.rumpf);
            }
          }
          ts.forEachChild(k, suche);
        };
        ts.forEachChild(sf, suche);
      }
    }
  };
  ts.forEachChild(sf, gehe);
  return raus;
}

/**
 * Löst einen Modulspezifikator zu einer Datei der Erhebung auf.
 *
 * Nur RELATIVE Spezifikatoren — ein Paketname aus `node_modules` kann keinen Export unter
 * `services/**` decken. Probiert werden die Endungen, die das Werk benutzt, und die
 * `index`-Datei eines Verzeichnisses.
 */
function loeseModul(
  vonDatei: string,
  spezifikator: string,
  bekannt: Set<string>,
): string | undefined {
  if (!spezifikator.startsWith(".")) {
    return undefined;
  }
  const teile = posix(vonDatei).split("/");
  teile.pop();
  for (const stueck of spezifikator.split("/")) {
    if (stueck === "." || stueck === "") {
      continue;
    }
    if (stueck === "..") {
      teile.pop();
    } else {
      teile.push(stueck);
    }
  }
  const basis = teile.join("/");
  for (const kandidat of [
    basis,
    `${basis}.ts`,
    `${basis}.tsx`,
    `${basis}/index.ts`,
    `${basis}/index.tsx`,
  ]) {
    if (bekannt.has(kandidat)) {
      return kandidat;
    }
  }
  return undefined;
}

// ------------------------------------------------------------------------------------------------
// R-1349 — LESER AUSSERHALB VON TYPESCRIPT: GEMESSEN, NICHT GEDULDET.
// ------------------------------------------------------------------------------------------------
//
// Zwei Produktwege lesen TypeScript-Exporte, ohne sie zu importieren:
//   · das Word-Add-in lädt `lib/wordAddin.ts` nicht, sondern trägt dieselben Bausteine als Spiegel
//     in `public/word-addin/taskpane.js` (Kopf dort: „Äquivalenz per Test gepinnt") und ruft sie;
//   · das Release-Werkzeug `scripts/insel/schema-vertrag.mjs` läuft mit blossem `node` und liest
//     die beiden Migrationslisten aus dem QUELLTEXT von `migrationsbeleg.ts` (`stufenAusQuelle`).
// Bis hierher standen diese Exporte als eingefrorener Altbestand oder als Ausnahme mit Grund im
// Register — der Wächter konnte den Aufruf nicht sehen und musste ihn glauben. Jetzt misst er ihn,
// je Name und bei jedem Lauf, und eine bloße Erwähnung deckt nichts:
//   spiegel   — der Leser DEKLARIERT den Namen und VERWEIST ausserhalb der Deklaration auf das
//               Symbol (Syntaxbaum, kein Texttreffer). Eine Definition allein ist ein Spiegel, den
//               niemand ruft — genau der halbe Einbau, um den es geht; eine Zeichenkette oder ein
//               Kommentar mit dem Namen ist kein Verweis.
//   quelltext — der Leser LIEST das Modul (`readFileSync` mit dessen Pfad), gibt das Gelesene an
//               eine eigene Auswertung, und die wendet den Exportnamen auf genau diesen Text an.
//               Pfad und Name als lose Zeichenketten decken nichts.
interface FremdLeser {
  /** Das TypeScript-Modul, dessen Exporte gelesen werden (relativ zur Wurzel). */
  readonly modul: string;
  /** Die Nicht-TypeScript-Dateien, die sie lesen. */
  readonly leser: readonly string[];
  readonly art: "spiegel" | "quelltext";
  readonly grund: string;
}

const FREMDLESER: readonly FremdLeser[] = [
  {
    modul: "apps/web/src/lib/wordAddin.ts",
    leser: ["apps/web/public/word-addin/taskpane.js"],
    art: "spiegel",
    grund:
      "Das Aufgabenfenster lädt das TypeScript-Modul nicht; `taskpane.js` (eingebunden von " +
      "`taskpane.html`) trägt dieselben Bausteine als Spiegel und ruft sie. Die Gleichheit beider " +
      "Fassungen halten die Paritätstests des Add-ins fest.",
  },
  {
    modul: "services/app/src/migrationsbeleg.ts",
    leser: ["scripts/insel/schema-vertrag.mjs"],
    art: "quelltext",
    grund:
      "Der Schema-Vertrag jedes Insel-Release entsteht aus den beiden Listen dieses Moduls; " +
      "`schema-vertrag.mjs` liest sie aus dem Quelltext, weil der Bau ohne `tsx` läuft.",
  },
];

// Nacharbeit 6 (BEN): bis hierher massen beide Arten ZEILEN — im Spiegel genügte nach der
// Definition eine weitere Zeile wie `console.log("name")`, im Quelltextleser genügten zwei ungenutzte
// Zeichenketten mit Modulpfad und Name. Beides ist eine Nennung, keine Verwendung. Jetzt wird der
// Leser als JavaScript geparst und am Syntaxbaum gemessen; Zeichenketten und Kommentare sind dort
// keine Bezeichner und decken nichts.

function jsBaum(pfad: string): ts.SourceFile {
  return ts.createSourceFile(
    pfad,
    readFileSync(pfad, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
}

function besucheAlle(wurzel: ts.Node, tu: (n: ts.Node) => void): void {
  const geh = (n: ts.Node): void => {
    tu(n);
    ts.forEachChild(n, geh);
  };
  geh(wurzel);
}

/** Ein Bezeichner, der auf ein Symbol VERWEIST — kein Eigenschafts-, Schlüssel- oder Parametername. */
function istVerweis(id: ts.Identifier): boolean {
  const p = id.parent;
  if (ts.isPropertyAccessExpression(p) && p.name === id) {
    return false;
  }
  if (
    (ts.isPropertyAssignment(p) ||
      ts.isMethodDeclaration(p) ||
      ts.isPropertyDeclaration(p) ||
      ts.isGetAccessorDeclaration(p) ||
      ts.isSetAccessorDeclaration(p) ||
      ts.isParameter(p)) &&
    p.name === id
  ) {
    return false;
  }
  return !(ts.isBindingElement(p) && p.propertyName === id);
}

/**
 * Art `spiegel`: der Leser DEKLARIERT den Namen (Funktion, Klasse, Variable) und VERWEIST ausserhalb
 * dieser Deklaration auf das Symbol. Ein Selbstaufruf im eigenen Rumpf ist kein Aufrufer.
 */
function spiegelVerwendet(sf: ts.SourceFile, name: string): boolean {
  const deklarationen: ts.Node[] = [];
  const verweise: ts.Identifier[] = [];
  besucheAlle(sf, (n) => {
    if (
      (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n) || ts.isVariableDeclaration(n)) &&
      n.name !== undefined &&
      ts.isIdentifier(n.name) &&
      n.name.text === name
    ) {
      deklarationen.push(n);
    } else if (ts.isIdentifier(n) && n.text === name && istVerweis(n)) {
      verweise.push(n);
    }
  });
  const innerhalb = (v: ts.Node): boolean =>
    deklarationen.some((d) => v.getStart() >= d.getStart() && v.getEnd() <= d.getEnd());
  return deklarationen.length > 0 && verweise.some((v) => !innerhalb(v));
}

/**
 * Art `quelltext`: die Kette muss im Leser stehen, nicht nur ihre Wörter —
 *   1. LESEN:      `readFileSync(…)` mit dem Modulpfad (direkt oder über eine Variable);
 *   2. AUSWERTEN:  das Gelesene geht als Argument an eine Funktion DIESES Lesers;
 *   3. AUSWÄHLEN:  dort wird der Exportname auf genau diesen Parameter angewandt
 *                  (`text.indexOf(…NAME…)`, direkt oder über eine Schleife über die Namensliste).
 */
function quelltextAusgewertet(sf: ts.SourceFile, modul: string, name: string): boolean {
  const funktionen = new Map<string, ts.FunctionDeclaration>();
  const belegung = new Map<string, ts.Expression[]>();
  besucheAlle(sf, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) {
      funktionen.set(n.name.text, n);
    }
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      belegung.set(n.name.text, [...(belegung.get(n.name.text) ?? []), n.initializer]);
    }
  });
  const enthaelt = (n: ts.Node, treffer: (k: ts.Node) => boolean): boolean => {
    let ja = false;
    besucheAlle(n, (k) => {
      ja = ja || treffer(k);
    });
    return ja;
  };
  const traegtPfad = (e: ts.Node): boolean =>
    enthaelt(e, (k) => ts.isStringLiteralLike(k) && k.text === modul) ||
    (ts.isIdentifier(e) && (belegung.get(e.text) ?? []).some((b) => traegtPfad(b)));
  const istLesen = (e: ts.Node): boolean => {
    if (ts.isIdentifier(e)) {
      return (belegung.get(e.text) ?? []).some((b) => istLesen(b));
    }
    if (!ts.isCallExpression(e)) {
      return false;
    }
    const ziel = ts.isPropertyAccessExpression(e.expression) ? e.expression.name : e.expression;
    const erstes = e.arguments[0];
    return (
      ts.isIdentifier(ziel) &&
      ziel.text === "readFileSync" &&
      erstes !== undefined &&
      traegtPfad(erstes)
    );
  };
  const wort = new RegExp(`(^|\\W)${name.replace(/[$]/g, "\\$&")}($|\\W)`);
  const nenntNamen = (k: ts.Node): boolean => ts.isStringLiteralLike(k) && wort.test(k.text);
  const waehltAus = (g: ts.FunctionDeclaration, parameter: string): boolean => {
    if (!g.body) {
      return false;
    }
    // Schleifenvariablen, die über eine Namensliste mit genau diesem Namen laufen.
    const schleife = new Set<string>();
    besucheAlle(g.body, (n) => {
      if (
        ts.isForOfStatement(n) &&
        ts.isArrayLiteralExpression(n.expression) &&
        n.expression.elements.some((el) => ts.isStringLiteralLike(el) && el.text === name) &&
        ts.isVariableDeclarationList(n.initializer)
      ) {
        for (const d of n.initializer.declarations) {
          if (ts.isIdentifier(d.name)) {
            schleife.add(d.name.text);
          }
        }
      }
    });
    return enthaelt(
      g.body,
      (n) =>
        ts.isCallExpression(n) &&
        ts.isPropertyAccessExpression(n.expression) &&
        ts.isIdentifier(n.expression.expression) &&
        n.expression.expression.text === parameter &&
        n.arguments.some((a) =>
          enthaelt(
            a,
            (k) => nenntNamen(k) || (ts.isIdentifier(k) && istVerweis(k) && schleife.has(k.text)),
          ),
        ),
    );
  };
  return enthaelt(sf, (n) => {
    if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression)) {
      return false;
    }
    const g = funktionen.get(n.expression.text);
    if (!g) {
      return false;
    }
    return n.arguments.some((a, i) => {
      const p = g.parameters[i]?.name;
      return istLesen(a) && p !== undefined && ts.isIdentifier(p) && waehltAus(g, p.text);
    });
  });
}

/** Liest eine Nicht-TypeScript-Datei des Produkts WIRKLICH diesen Export? (siehe Kopf oben) */
function fremdGelesen(
  f: Fund,
  wurzel: string,
  fremdleser: readonly FremdLeser[],
  baeume: Map<string, ts.SourceFile> = new Map(),
): boolean {
  for (const eintrag of fremdleser.filter((e) => e.modul === f.datei)) {
    for (const datei of eintrag.leser) {
      const pfad = join(wurzel, datei);
      if (!existsSync(pfad)) {
        continue;
      }
      const sf = baeume.get(pfad) ?? jsBaum(pfad);
      baeume.set(pfad, sf);
      if (
        eintrag.art === "spiegel"
          ? spiegelVerwendet(sf, f.name)
          : quelltextAusgewertet(sf, eintrag.modul, f.name)
      ) {
        return true;
      }
    }
  }
  return false;
}

interface Erhebung {
  readonly ohneAufrufer: Fund[];
  readonly exporte: number;
  readonly gelesen: number;
  /** Für die Kalibrierung: hat dieser Name irgendwo eine fremde Verwendung? */
  readonly fremdGenutzt: (f: Fund) => boolean;
}

/**
 * Die Erhebung. `wurzel` ist ein Parameter, damit der Nachweis an einem echten, aber EIGENEN
 * Baum geführt werden kann — dieselbe Bauart wie `quelldateien(verzeichnis, wurzel)` in
 * `tools/modalgrenze.ts:80`, und aus demselben Grund: der Lease dieses Durchgangs deckt keinen
 * Produktcode, ein Nachweis braucht aber eine Datei, die der Sammler wirklich liest.
 */
function erhebe(
  wurzel: string = WURZEL,
  ueberwacht: readonly string[] = UEBERWACHT,
  suchbaeume: readonly string[] = SUCHBAEUME,
  suchdateien: readonly string[] = SUCHDATEIEN,
  fremdleser: readonly FremdLeser[] = FREMDLESER,
): Erhebung {
  const dateien = [
    ...suchbaeume.flatMap((b) => quelldateien(b, wurzel)),
    ...suchdateien.filter((datei) => existsSync(join(wurzel, datei))),
  ].map(posix);
  const bekannt = new Set(dateien);
  const nutzung = new Map<string, Set<string>>();
  const importe = new Map<string, Importkante[]>();
  // JOB 3030: die Kanten, die ein `import(…)` zieht — getrennt geführt, weil sie keinen lokalen
  // Bezeichner im Modulscope haben (der Namensraum ist ein Lambda-Parameter) und deshalb nicht
  // durch die `genutzt.has(k.lokal)`-Bedingung der statischen Kanten passen.
  const dynamisch = new Map<string, DynamischerZugriff[]>();
  const reexporte = new Map<string, Reexport[]>();
  const eigeneExporte = new Map<string, Set<string>>();
  const baeume = new Map<string, ts.SourceFile>();
  const exporte: Fund[] = [];

  for (const d of dateien) {
    const sf = quelleAus(d, readFileSync(`${wurzel}/${d}`, "utf8")).ast;
    baeume.set(d, sf);
    nutzung.set(d, verwendungen(sf));
    importe.set(d, importeAus(sf));
    dynamisch.set(d, dynamischeZugriffeAus(sf));
    reexporte.set(d, reexporteAus(sf));
    const eigene = exporteAus(d, sf);
    // Nach EXPORTNAME, nicht nach Bezeichner: `herkunft()` folgt Modulkanten, und die tragen
    // `default`, wo die Datei einen Standardexport hat.
    eigeneExporte.set(d, new Set(eigene.map((e) => e.exportname)));
    if (ueberwacht.some((u) => d.startsWith(`${u}/`))) {
      exporte.push(...eigene);
    }
  }

  /**
   * Wo wird der Export `name` des Moduls `modul` WIRKLICH definiert? Barrels reichen nur weiter.
   * Der Zyklusschutz ist Pflicht: `index.ts` → `src/x.ts` → `index.ts` kommt vor.
   */
  const herkunft = (
    modul: string,
    name: string,
    gesehen = new Set<string>(),
  ): string | undefined => {
    const marke = `${modul}::${name}`;
    if (gesehen.has(marke)) {
      return undefined;
    }
    gesehen.add(marke);
    if (eigeneExporte.get(modul)?.has(name)) {
      return modul;
    }
    for (const r of reexporte.get(modul) ?? []) {
      const ziel = loeseModul(modul, r.spezifikator, bekannt);
      if (!ziel) {
        continue;
      }
      if (r.nachAussen === name) {
        const tiefer = herkunft(ziel, r.imQuellmodul, gesehen);
        if (tiefer) {
          return tiefer;
        }
      } else if (r.nachAussen === "*") {
        const tiefer = herkunft(ziel, name, gesehen);
        if (tiefer) {
          return tiefer;
        }
      }
    }
    return undefined;
  };

  /**
   * Der Vertrag: eine ANDERE Nicht-Test-Datei importiert dieses Symbol aus diesem Modul UND
   * benutzt den lokalen Bezeichner. Eine gleichnamige, unabhängige Nennung deckt nichts.
   */
  const fremdGenutzt = (f: Fund): boolean => {
    for (const [d, kanten] of importe) {
      if (d === f.datei) {
        continue;
      }
      const genutzt = nutzung.get(d) ?? new Set<string>();
      for (const k of kanten) {
        const modul = loeseModul(d, k.spezifikator, bekannt);
        if (!modul) {
          continue;
        }
        if (k.exportname === "*") {
          // Namensraumimport: nur die wirklich abgegriffenen Namen zählen.
          if (!genutzt.has(k.lokal)) {
            continue;
          }
          const sf = baeume.get(d);
          if (
            sf &&
            namensraumZugriffe(sf, k.lokal).has(f.exportname) &&
            herkunft(modul, f.exportname) === f.datei
          ) {
            return true;
          }
          continue;
        }
        // Verglichen wird EXPORTNAME gegen EXPORTNAME. Vorher stand hier `f.name`, und damit fand
        // `import App from "./App"` (Kante: `default`) den Standardexport `App` nie — siehe den
        // Kommentar an `Fund.exportname`.
        if (k.exportname !== f.exportname || !genutzt.has(k.lokal)) {
          continue;
        }
        if (herkunft(modul, k.exportname) === f.datei) {
          return true;
        }
      }
    }
    // JOB 3030: dieselbe Frage für den dynamischen Import. Der Vertrag bleibt derselbe und wird an
    // KEINER Stelle lockerer: der Pfad muss auf genau die Datei auflösen, in der der Export
    // definiert ist, und der abgegriffene Name muss der Exportname sein.
    for (const [d, zugriffe] of dynamisch) {
      if (d === f.datei) {
        continue;
      }
      for (const z of zugriffe) {
        if (z.exportname !== f.exportname) {
          continue;
        }
        const modul = loeseModul(d, z.spezifikator, bekannt);
        if (modul && herkunft(modul, z.exportname) === f.datei) {
          return true;
        }
      }
    }
    return false;
  };

  const leserbaeume = new Map<string, ts.SourceFile>();
  const ohneAufrufer = exporte
    .filter((f) => !fremdGenutzt(f))
    .filter((f) => !(nutzung.get(f.datei)?.has(f.name) ?? false))
    .filter((f) => !fremdGelesen(f, wurzel, fremdleser, leserbaeume))
    .sort((a, b) => a.datei.localeCompare(b.datei) || a.name.localeCompare(b.name));
  return { ohneAufrufer, exporte: exporte.length, gelesen: dateien.length, fremdGenutzt };
}

const schluessel = (f: { datei: string; name: string }): string => `${f.datei}::${f.name}`;

// ------------------------------------------------------------------------------------------------
// REGISTER 1 · BEWUSST OHNE AUFRUFER — jede Zeile mit Grund
// ------------------------------------------------------------------------------------------------
// Auftrag §4.3: „Eine Ausnahme ohne Begründung ist der Anfang vom Ende des Wächters." Deshalb
// stehen hier NUR Einträge, deren Grund ich am Code geprüft habe.
interface Ausnahme {
  readonly schluessel: string;
  readonly grund: string;
}

const BEWUSST: readonly Ausnahme[] = [
  {
    schluessel: "services/app/src/embed-concurrency.ts::resetEmbedSemaphoreForTests",
    grund:
      "Ausdrücklich für Tests gebaut — der Name sagt es. Ein Produktaufrufer wäre hier der Fehler: " +
      "er würde die Semaphore im Betrieb zurücksetzen.",
  },
  {
    schluessel: "services/reasoner/src/model-concurrency.ts::resetModelSemaphoreForTests",
    grund: "Dieselbe Bauart und derselbe Grund wie `resetEmbedSemaphoreForTests`.",
  },
  {
    schluessel: "services/reasoner/src/testhelfer-ki-freigabe.ts::erteileKiFreigabe",
    grund:
      "JOB 3550: setzt die Adminfreigabe für öffentliche KI (JOB 3549) in einem TESTAUFBAU — " +
      "dieselbe Bauart und derselbe Grund wie `resetModelSemaphoreForTests` eine Zeile höher. " +
      "Ein Produktaufrufer wäre hier der Fehler und nicht die Behebung: er würde die Freigabe im " +
      "Betrieb erteilen, statt sie vom Administrator zu verlangen — genau das, was Pedis Satz " +
      'verbietet („Voreinstellung bleibt ohne ausdrückliche Adminfreigabe gesperrt"). ' +
      "`mitKiFreigabe` aus derselben Datei steht NICHT hier: es wird in seiner eigenen Datei " +
      "verwendet und fällt deshalb nicht unter den engen Schnitt dieses Wächters.",
  },
  {
    schluessel: "services/db-tx/src/pg-test-guard.ts::guardedLocalPgTestUrl",
    grund:
      "Riegel für Integrationstests: er verhindert, dass ein Testlauf auf eine fremde Datenbank " +
      "zeigt. Ein Produktaufrufer wäre sinnwidrig.",
  },
  {
    schluessel: "services/app/src/routes/confluence-import-routes.ts::warteAufOffeneImportLaeufe",
    grund:
      "JOB 2691 D1: der Importlauf laeuft seit 2691 im Hintergrund (202 QUEUED). Tests warten " +
      "hiermit auf sein Ende, statt zu schlafen. Ein Produktaufrufer waere der alte Fehler: " +
      "eine Route, die auf den Lauf wartet, bevor sie antwortet.",
  },
  // R-1349 (Nacharbeit 4): Hier stand `ko-routes.ts::ohneImportHerkunft` mit dem Vermerk, Streichen
  // oder ein Routenfall gehöre dem Importauftrag. Beides ist geschehen: der Helfer ist entfernt, und
  // W6 (`tests/import-kandidaten-echt/annahme-in-validierung.test.ts`) misst die Zusage am echten
  // `POST /api/kos`.
  {
    schluessel: "services/knowledge-object/src/kanten-service.ts::InMemoryKantenRepo",
    grund:
      "R-1349 (Nacharbeit 4), am Code geprueft: der Pruefstand des Kanten-Lesewegs. Er legt je " +
      "KENNUNG ab statt je Beziehung und ist deshalb als Ablage der Anwendung falsch — die " +
      "Kompositionswurzel nimmt ausdruecklich `DeduplizierenderKantenBestand` (JOB 4151). Er teilt " +
      "modulprivate Hilfen mit dem Lesedienst; ein Umzug nach `tests/` braeche diese Bindung auf " +
      "oder verdoppelte sie. Ein Produktaufrufer waere hier der Fehler, kein Anschluss.",
  },
  // R-1349 (Nacharbeit 2): drei Vertragspruefhilfen der Integrationsschnittstelle, mit dem
  // Hauptstand 1.0.0-beta.1.771 hereingekommen und am Code geprueft. Ihr einziger Leser ist der
  // Vertragstest; das ist ihre Aufgabe und keine Luecke.
  {
    schluessel: "services/app/src/integrations-vertrag.ts::integrationsOpenApi",
    grund:
      "Erzeugt die OpenAPI-Beschreibung aus der Zustandstabelle. Ausgeliefert wird sie als Datei " +
      "`docs/generated/integrations-openapi.json`, nicht ueber eine HTTP-Route — so festgehalten in " +
      "`docs/architektur/integrations-schnittstelle.md` (Grenzen). Der Vertragstest " +
      "`tests/integrations-api/zustandstabelle-am-draht.test.ts` (O1) verlangt Gleichheit von Datei " +
      "und Erzeugung. Eine Route waere eine eigene Produktentscheidung, kein Anschluss.",
  },
  {
    schluessel: "services/app/src/integrations-vertrag.ts::vertragUndRoutenGleich",
    grund:
      "Prueft, dass Vertragstabelle und `DIENST_ROUTEN` dieselben Routen mit denselben Rechten " +
      "fuehren. Das ist eine Gleichlaufpruefung fuer den Vertragstest; ein Aufruf im Betrieb " +
      "aenderte nichts, weil beide Tabellen zur Bauzeit feststehen.",
  },
  {
    schluessel: "services/app/src/integrations-vertrag.ts::zustandErlaubt",
    grund:
      "Fragt, ob eine beobachtete Antwort (Status und `error`) in der Zustandstabelle steht — der " +
      "Massstab, an dem der Vertragstest jede Routenantwort misst. Die Routen selbst setzen ihre " +
      "Zustaende; eine Durchsetzung zur Laufzeit waere eine eigene Produktentscheidung.",
  },
  // JOB 3110 (06.09.2026): Der Eintrag fuer `klara-session-routes.ts::klaraZurufRoutes` ist
  // GESTRICHEN und nicht umformuliert — er war ausdruecklich selbstauslaufend („sobald build-app.ts
  // die Route registriert, hat sie einen Aufrufer, und A3 verlangt die Streichung dieser Zeile").
  // `build-app.ts` registriert sie seit M2b; der Aufrufer ist echt, die Ausnahme hat keinen Traeger
  // mehr. Waere sie geblieben, haette A3 sie als „nicht mehr zutreffend" gemeldet.
  //
  // JOB 4154 (WIKI-GESAMTANWEISUNG, 15.09.2026): DREI SELBSTAUSLAUFENDE EINTRAEGE.
  // HIER STANDEN DREI ZEILEN AUS JOB 4154 UND SIND MIT JOB 4156 GESTRICHEN — genau so, wie sie es
  // selbst angekuendigt hatten („SELBSTAUSLAUFEND: sobald der Nachfolger ihn in build-app bindet,
  // hat er einen Aufrufer, und A3 verlangt die Streichung dieser Zeile"):
  //   · `GesamtanweisungDienst`  — gebunden in `services/app/src/build-app.ts` (`app.register(
  //     gesamtanweisungRoutes, { dienst: new GesamtanweisungDienst({…}) })`).
  //   · `PgAnweisungRepo`        — gebaut in `buildPgServices` gegen den echten Pool; die DDL steht
  //     jetzt als `GESAMTANWEISUNG_SCHEMA` in der `schemas`-Liste von `services/app/src/db.ts`.
  //   · `gesamtanweisungRoutes`  — an derselben Stelle registriert.
  // A3 hat die Streichung verlangt und erzwungen: solange die Zeilen standen, war dieser Fall rot.
  // Das ist die Bauform, um die es geht — ein Register, das sich selbst abbaut, statt zu wachsen.
];

// ------------------------------------------------------------------------------------------------
// REGISTER 2 · UNERLEDIGTER REST VON R-1349 — abgegrenzt, nicht abgeschlossen
// ------------------------------------------------------------------------------------------------
// HIER STAND DER ALTBESTAND, eingefroren am 27.08.2026 (am Kandidaten b7be5168 nach BENs Zählung
// 174 eingefrorene Altfälle über Server und Web). R-1349 verlangt: „Jeder Fall soll entweder
// angeschlossen oder begründet entfernt werden." Jeder Eintrag ist einzeln abgeglichen und
// angeschlossen, entfernt, als Prüfzeug nach `tests/` gezogen oder als gemessene Fremdlesekante
// (`FREMDLESER`) belegt worden. Die Aufstellung je Fall steht in
// `docs/qm/aufnahme-20260922-gesamt-aufruferwaechter.md`. Ein eingefrorenes Register gibt es nicht.
//
// WAS HIER STEHT, IST NICHT ERLEDIGT (Nacharbeit 6, BEN): R-1349 ist für diese Bausteine NICHT
// erfüllt — sie haben weiterhin keinen Aufrufer. Ein Eintrag mit Entscheider allein wäre keine
// Abgrenzung. Hier steht deshalb nur, was eine ausdrückliche SPERRE trägt oder einem belegten
// GESONDERTEN AUFTRAG gehört, und jeder Eintrag nennt diesen Beleg. Ohne eine solche Einschränkung
// wurde abgeschlossen: in Nacharbeit 6 sind `PgWriteFence`, `fenceKey` und `netzQualitaet`
// entfernt worden (Kommentare an den früheren Stellen). A3 verlangt die Streichung, sobald ein
// Baustein einen Aufrufer hat oder entfernt ist, und prüft, dass jede genannte Belegdatei existiert.
interface OffenerRest extends Ausnahme {
  /** Warum dieser Auftrag den Fall nicht abschliesst. */
  readonly abgrenzung: "sperre" | "gesonderter-auftrag";
  /** Die Sperre bzw. der Auftrag, mit Fundstelle — keine bloße Zuständigkeit. */
  readonly beleg: string;
  /** Die Datei im Baum, in der die Sperre steht (wenn sie im Baum steht). */
  readonly belegdatei?: string;
  /** Wer die ausstehende Entscheidung trifft — eine Rolle oder ein benannter Auftrag. */
  readonly entscheidet: string;
}

const AUFTRAG_BESTANDSRESET =
  "Auftrag aufnahme:20260922:gesamt-bestandsreset — R-0774: offene Owner-Punkte OV-1 bis OV-5 " +
  "(Sperrrichtung, Löschgraph, Auditwahrheit bei Absturz, Zielpfade, zweiter Server); " +
  "R-1911: E9 OFFEN";
const SPERRE_WISSENSRAUM =
  "PLAN PRO 378 §9 führt B-1, B-2, B-3 und B-6 als offene Sperren („ohne Produktsprache bleiben " +
  "P-1/P-2 unbenennbar“), zitiert im Kopf von tests/library/wissensraum381-bauteile.test.tsx; " +
  "der Server liefert kein `home`";

const OFFENER_REST: readonly OffenerRest[] = [
  {
    schluessel: "services/app/src/reindex-queue.ts::createReindexQueue",
    grund:
      "Die Neuindizierungs-Warteschlange ist gebaut und am Verhalten geprueft (`reindex-queue.test.ts`). " +
      "Ihr Kopf haelt fest, dass die Anschlusswahl zwischen Service-Hook und Routenanschluss und " +
      "die Herkunft der Kennungen „weiterhin nicht freigegeben“ sind; das Modul wird deshalb " +
      "nirgends registriert.",
    abgrenzung: "sperre",
    beleg:
      "BEN zu JOB 1163 (Kopf von reindex-queue.ts, Zeilen 16-18): die Wahl zwischen Service-Hook " +
      "und Routenanschluss ist „weiterhin nicht freigegeben“; build-app.ts bleibt unberührt",
    belegdatei: "services/app/src/reindex-queue.ts",
    entscheidet: "Produktverantwortung (Freigabe der Anschlusswahl, Pruefung durch BEN)",
  },
  {
    schluessel: "services/audit/src/repo.ts::pruefeValidationDecisionRef",
    grund:
      "Prueft eine Validierungs-Entscheidungsreferenz (Hash vor Action und Subject, Kette als " +
      "Pflichtparameter). Der Anschlussort steht fest: `AnswerExplanationService` " +
      "(services/app/src/services/answer-explanation.ts) liefert `evidenceValidationRefStates` heute " +
      "nicht. Den Leseweg zu bauen ist die Auflösungserklärung des Antwortbelegs selbst.",
    abgrenzung: "gesonderter-auftrag",
    beleg:
      "Auftrag aufnahme:20260922:gesamt-antwortbeleg („Antwortbelege dauerhaft speichern und ihre " +
      "Auflösung erklären“), R-0308: je Wissenseinheit eine Prüfreferenz auf den Eintrag im Prüfbuch",
    entscheidet: "Auftrag gesamt-antwortbeleg (Leseweg der Antwortbelege mit Kettenpruefung)",
  },
  // R-1349 (Nacharbeit 6): `services/db-tx/src/write-fence.ts` (`PgWriteFence`, `fenceKey`) stand hier
  // als „Betriebs-/Architekturentscheidung“. Eine Sperre oder ein gesonderter Auftrag dazu ist nicht
  // belegt; die Sperre war nie scharf (keine Tabelle, kein Dienst). Sie ist samt ihren zwei
  // Prüfständen entfernt (Grund am Kopf von `services/db-tx/index.ts`).
  {
    schluessel: "services/db-tx/src/bestandsreset.ts::fuehreBestandsresetAus",
    grund:
      "Der aufrufbare Postgres-Bestandsreset aus JOB 596 D8 (drei Transaktionen, Auditautomat). Sein " +
      "Loeschgraph ist dort ausdruecklich „Vorschlag, nicht Entscheidung“ (Rueckgabe D8, V-1); ohne " +
      "diese Entscheidung bekommt der Reset keinen Betreiber- oder Adminweg.",
    abgrenzung: "gesonderter-auftrag",
    beleg: AUFTRAG_BESTANDSRESET,
    entscheidet: "Owner (OV-1 bis OV-5) im Auftrag gesamt-bestandsreset",
  },
  {
    schluessel: "services/db-tx/src/bestandsreset-audit.ts::bestandsresetBefund",
    grund:
      "Teil des Bestandsresets (Auswertung des Laufzustands); offen mit derselben Entscheidung wie " +
      "`fuehreBestandsresetAus`.",
    abgrenzung: "gesonderter-auftrag",
    beleg: AUFTRAG_BESTANDSRESET,
    entscheidet: "Owner (OV-1 bis OV-5) im Auftrag gesamt-bestandsreset",
  },
  {
    schluessel: "services/db-tx/src/bestandsreset-audit.ts::SQL_SCHEMA_BESTANDSRESET",
    grund:
      "Das Schema der Reset-Laufakte; es kommt erst mit dem Betreiberweg des Resets in die " +
      "Migrationsliste. Offen mit derselben Entscheidung wie `fuehreBestandsresetAus`.",
    abgrenzung: "gesonderter-auftrag",
    beleg: AUFTRAG_BESTANDSRESET,
    entscheidet: "Owner (OV-1 bis OV-5) im Auftrag gesamt-bestandsreset",
  },
  {
    schluessel: "services/db-tx/src/reset-lock.ts::SQL_SPERRE_WIRD_GEHALTEN",
    grund:
      "Die beobachtende Sperrabfrage des Reset-Auditautomaten (`pg_locks`); offen mit derselben " +
      "Entscheidung wie `fuehreBestandsresetAus`.",
    abgrenzung: "gesonderter-auftrag",
    beleg: AUFTRAG_BESTANDSRESET,
    entscheidet: "Owner (OV-1 bis OV-5) im Auftrag gesamt-bestandsreset",
  },
  // R-1349 (Nacharbeit 6): `kanten-service.ts::netzQualitaet` stand hier, weil „ob und wo“ die Zahl
  // gezeigt werde, offen sei. Das ist entschieden: der Qualitätsblick ist ohne neuen Server-Weg
  // geliefert (`apps/web/src/lib/netzQualitaet.ts`, R-0744). Die Funktion ist entfernt.
  {
    schluessel: "apps/web/src/components/confluence-import/ImportResultView.tsx::ImportResultView",
    grund:
      "Die W2-Resultatflaeche des Confluence-Imports ist gebaut und gemountet geprueft; ihre " +
      "Sichtbarkeit ist eine eigene Tranche. `tests/app/w2a-import-run-routes-148.test.ts` (Block 5) " +
      "verlangt ausdruecklich, dass sie bis dahin keinen Aufrufer in der Oberflaeche hat.",
    abgrenzung: "gesonderter-auftrag",
    beleg:
      "Auftrag aufnahme:20260922:gesamt-confluence-import, R-0142 (Original und abgeleitete " +
      "Wissenseinheiten auf einer Fläche, hinter Rechte- und Funktionsschalter); bis dahin sperrt " +
      "w2a-import-run-routes-148 „ImportResultView hat weiterhin keinen Aufrufer in der Oberfläche“",
    belegdatei: "tests/app/w2a-import-run-routes-148.test.ts",
    entscheidet: "Auftrag gesamt-confluence-import (Freigabe der W2-Resultattranche, KW-S4-26)",
  },
  {
    schluessel: "apps/web/src/components/LibraryScopeBar.tsx::LibraryScopeBar",
    grund:
      "Wissensraeume (PRO 381): der Server liefert heute kein `home`, und das Wort fuer den Ort ist " +
      "eine offene Ownerentscheidung (PLAN PRO 378). Das Bauteil ist geprueft " +
      "(`tests/library/wissensraum381-bauteile.test.tsx`) und wartet auf diese Entscheidung.",
    abgrenzung: "sperre",
    beleg: SPERRE_WISSENSRAUM,
    belegdatei: "tests/library/wissensraum381-bauteile.test.tsx",
    entscheidet: "Owner (PLAN PRO 378, Wissensraeume)",
  },
  {
    schluessel: "apps/web/src/components/trust/KoHomeLine.tsx::KoHomeLine",
    grund:
      "Wie `LibraryScopeBar`: die Heimatzeile eines Objekts braucht ein `home` vom Server und die " +
      "Ownerentscheidung PLAN PRO 378; geprueft in `tests/library/wissensraum381-bauteile.test.tsx`.",
    abgrenzung: "sperre",
    beleg: SPERRE_WISSENSRAUM,
    belegdatei: "tests/library/wissensraum381-bauteile.test.tsx",
    entscheidet: "Owner (PLAN PRO 378, Wissensraeume)",
  },
  {
    schluessel: "apps/web/src/lib/librarySpace.ts::koHomePath",
    grund:
      "Wissensraeume (R-0991 Nr. 45, Fall C): der Server liefert kein `home`, das Wort fuer den Ort " +
      "ist eine offene Ownerentscheidung (PLAN PRO 378).",
    abgrenzung: "sperre",
    beleg: SPERRE_WISSENSRAUM,
    belegdatei: "tests/library/wissensraum381-bauteile.test.tsx",
    entscheidet: "Owner (PLAN PRO 378, Wissensraeume)",
  },
  {
    schluessel: "apps/web/src/lib/librarySpace.ts::serializeSpace",
    grund:
      "Wissensraum in der Adresse (R-0991 Nr. 46, Fall C); offen mit derselben Ownerentscheidung " +
      "wie `koHomePath`.",
    abgrenzung: "sperre",
    beleg: SPERRE_WISSENSRAUM,
    belegdatei: "tests/library/wissensraum381-bauteile.test.tsx",
    entscheidet: "Owner (PLAN PRO 378, Wissensraeume)",
  },
  {
    schluessel: "apps/web/src/lib/librarySpace.ts::spaceFromParams",
    grund:
      "Wissensraum aus der Adresse lesen (R-0991 Nr. 47, Fall C); offen mit derselben " +
      "Ownerentscheidung wie `koHomePath`.",
    abgrenzung: "sperre",
    beleg: SPERRE_WISSENSRAUM,
    belegdatei: "tests/library/wissensraum381-bauteile.test.tsx",
    entscheidet: "Owner (PLAN PRO 378, Wissensraeume)",
  },
];

// Frühere Erledigungen aus der Zeit des eingefrorenen Altbestands, unverändert zur Herkunft:
// JOB 3024 (`displayStatus` am Detailabruf angeschlossen), JOB 4151 (`DeduplizierenderKantenBestand`
// als Kantenablage gewählt), R-0846 / L6 (`isTransientMedia`, `isWithinRetention` im Waisen-Sweep),
// JOB 3091 (`ZurufService` hinter der Zuruf-Route).

// ------------------------------------------------------------------------------------------------
// REGISTER 3 · ERST DURCH DIE VERSCHÄRFUNG SICHTBAR (JOB 2605 D2 und D3)
// ------------------------------------------------------------------------------------------------
// Diese lagen schon vorher ohne Aufrufer da — der jeweils frühere Wächter sah sie nur nicht, weil
// ein gleichnamiger, unabhängiger Bezeichner sie „deckte". Genau der Befund, den BEN gerügt hat,
// hier an echtem Code statt an einer Attrappe:
//
// ERLEDIGT, JOB 2609 D1 (27.08.2026): `duplicate-detect.ts::titleSimilarity` stand hier als erster
// Eintrag und ist der erste Fund dieses Waechters, der wirklich erlegt wurde — die Funktion ist
// entfernt, weil sie ueberholt war (sie belieferte allein `overlapCandidacy`, und seit „jeder gegen
// jeden" gibt es die Stufe nicht mehr). A3 hat ihre Streichung aus diesem Register verlangt, sobald
// es den Export nicht mehr gibt; genau das ist hier geschehen. Die Liste ist geschrumpft, nicht
// gewachsen.
//
// R-1349 (Nacharbeit 4) · DIESES REGISTER IST ABGEBAUT. Seine drei letzten Einträge standen als
// „NICHT behoben (Auftrag §4)" da und sind jetzt einzeln erledigt:
//   · `services/rbac/src/guard.ts::requirePermission` — entfernt samt Datei. Jede Route prüft über
//     `makeGuards().requirePermission` in `services/app/src/http.ts`; den 403-Satz
//     `PERMISSION_DENIED` misst `tests/q9-entwurfsfehler/entwurfsfehler-sprachfaelle.test.ts` (G) an
//     der Route, die ihn im Produkt sendet.
//   · `services/conflicts/src/detect.ts::pairKey` — entfernt. Die Anlegestelle entdoppelt
//     typunabhängig über Kennungen und Fassungen (`service.ts`, `hasOpenPair`); der Typ-Schlüssel
//     beschrieb eine Regel, die das Produkt nicht anwendet.
//   · `services/ask/src/types.ts::GAP_PRIORITIES` — angeschlossen: `isGapPriority` liest die Liste.

// ------------------------------------------------------------------------------------------------
// REGISTER 4 · NEUZUGANG, BEIM EINBAU GEFANGEN (JOB 2605 D2)
// ------------------------------------------------------------------------------------------------
// Diese beiden kamen mit dem Basisstand `c850f67a` (JOB 2604 D1) neu ins Werk und haben von Anfang
// an keinen Aufrufer. **Das ist der erste echte Fang dieses Wächters im Betrieb** — er hat beim
// ersten Kontakt mit einem frischen Einbau angeschlagen, wofuer er gebaut wurde.
//
// Sie standen hier und nicht im damaligen `ALTBESTAND`, damit sichtbar blieb, dass sie NEU waren: ein
// Neuzugang gehoert gemeldet, nicht abgelegt.
//
// R-1437 / I10 · ERLEDIGT: `pruefbefehl` und `bewerte` (idle-in-transaction.ts) standen hier seit
// JOB 2605 D2. Seit R-1437 urteilt `bewerte` vor jeder begrenzten Prüfung
// (`services/db-tx/src/begrenzte-pruefung.ts`), und `pruefbefehl` nennt der Betreiberweg
// (`tools/datenintegritaet.ts`), wenn eine Sitzung offen hängt. Die Liste ist leer geworden.
const NEUZUGANG_GEMELDET: readonly Ausnahme[] = [];

// ------------------------------------------------------------------------------------------------
// R-1349 · DIE REGISTER 4b UND 4c SIND ABGEBAUT, NICHT LEER STEHEN GEBLIEBEN
// ------------------------------------------------------------------------------------------------
// Sie fuehrten Bausteine, die durch einen Umbau ersetzt waren und deren Abbau ausserhalb der
// damaligen Zielpfade lag:
//   · 4b (JOB 3015 D5) — `lib/startCtas.ts` (`startCta`, `startQueueCta`): die Startseite fuehrt
//     ihre Wege seit der Konsole ueber Karten mit Literalzielen.
//   · 4c (JOB 3061 H2) — `components/FindingCard.tsx` (`FindingCard`, `FindingGroupHeader`) und
//     `components/conflicts/ConflictKoSide.tsx`: Befund und Beleg stehen seither im „Mehr" der
//     Kartenpaare, aus `lib/findingGroups.ts` und `components/ko/SourceEvidence`.
// Der Auftrag „Gebauten Code ohne tatsaechliche Verwendung erkennen" (R-1349: „Jeder Fall soll
// entweder angeschlossen oder begruendet entfernt werden") hat die Pfade und hat die Dateien samt
// ihrer reinen Komponententests entfernt. Die Woerterbuchschluessel bleiben stehen: der Textbestand
// ist durch `tests/i18n-textmodule/bestand-unveraendert.test.ts` Wert fuer Wert festgehalten.

// ------------------------------------------------------------------------------------------------
// REGISTER 4d · SEIT JOB 3063 (H4) OHNE PRODUKTAUFRUFER — GEMELDET, NICHT ABGELEGT
// ------------------------------------------------------------------------------------------------
// JOB 3063 macht aus der Bibliothek eine Flaeche (Liste links, Lesefläche rechts) und aus der
// Detailseite mit dreizehn Karten deren rechte Haelfte. Drei Bausteine der ABGELOESTEN Flaechen
// verloren dabei ihren einzigen Produktleser.
//
// R-1349: `lib/koCta.ts::koCta` und `lib/libraryMaturity.ts::libraryUseCta` sind entfernt — beide
// sind durch `components/bibliothek/fragen.ts::fragenHref` ersetzt.
//
// R-1349 (Nacharbeit 4) · DIESES REGISTER IST ABGEBAUT. Sein letzter Eintrag, `KoReadView`, stand als
// „eigener Schnitt" da. Der Schnitt ist gemacht: `components/ko/KoReadView.tsx` und
// `components/ko/KoRead.tsx` sind samt ihrer Komponententests entfernt. Die drei fremden Prüfstände,
// die an der toten Leseansicht maßen, messen ihre Zusage jetzt an der Lesefläche der Bibliothek:
// mega34 C1 (`tests/ko/mega34-gesichert-eindeutig.test.tsx`, Balken von `MehrAbschnitte.tsx`),
// WP-BILD-1d (`tests/ko/body-image-gallery.test.ts`, Galerie in `BibliothekLesen.tsx`) und UX-27
// (`tests/ux27-pruefstand/ux27-weitere-leseflaechen.test.tsx`, Fall „lesen" entfällt). Mit der
// Leseansicht fiel `lib/bodyReadMode.ts::BODY_READ_NOTE_KEY`, dessen einziger Leser sie war.

// ------------------------------------------------------------------------------------------------
// REGISTER 4e · ERSETZT, ABBAU LIEGT AUSSERHALB DER ZIELPFADE (JOB 3062 · H3)
// ------------------------------------------------------------------------------------------------
// JOB 3062 macht `/erfassen` zum Blatt (Zielbild `Erfassen.dc.html`): Der Standardweg-Kasten, die
// Modus-Leiste, die Schritt-Leiste, die Erstnutzer-Einfuehrung, die Vordertuer-Optionsliste und die
// eigene Intake-Flaeche sind durch EINE Komponente mit Werkzeugzeile und Untermenues ersetzt
// (`components/erfassen/Blatt.tsx`). Damit haben die Bausteine, die AUSSCHLIESSLICH diese Flaechen
// bedient haben, ihren Produkt-Leser verloren.
//
// WARUM SIE HIER STEHEN UND NICHT GELOESCHT SIND — dieselbe Lage wie bei JOB 3015 D5, und aus
// demselben Grund derselbe Weg: Die Dateien liegen AUSSERHALB der Zielpfade dieses Auftrags
// (`pages/Capture*.tsx`, `pages/KnowledgeIntake*.tsx`, `components/erfassen/**`, `i18n.ts`,
// `tests/**`) und duerfen von der Bahn nicht angefasst werden. Runde 1 hatte sie geloescht; genau
// das hat der Sachpruefer als Zielpfad-Verstoss rot geurteilt. Sie sind deshalb auf den
// Basisstand zurueckgestellt und werden hier GEMELDET, nicht abgelegt — ihr Abbau (die vier
// Komponenten-Dateien, `lib/intakeSuggestion.ts`, die genannten Exporte in `lib/captureEntry.ts`
// und `lib/captureWizard.ts` samt ihrer mitgelieferten Tests) ist in der RUECKGABE zu JOB 3062 als
// Folgeauftrag benannt. A3 streicht jeden Eintrag, sobald er nicht mehr zutrifft.
//
// AUSDRUECKLICH NICHT HIER: `lib/intakeExample.ts::dominantCategory`. Der Export sah nach demselben
// Fall aus, ist aber KEINER — seine Leistung (das domaenennahe Beispiel) hat im Blatt keinen
// Ersatz. Ihn hier einzutragen haette einen stillen Funktionsverlust als „ersetzt" getarnt; er ist
// stattdessen in `Blatt.tsx` wieder verdrahtet (Menue „…" -> „Beispiel ansehen").
//
// R-1349 · ABGEBAUT: `IntakeEmptyState`, `IntakeCompletion`, `StructureSuggestionChips` (samt ihrer
// Komponententests), `captureWizard.ts::wizardChips` und die elf Exporte der alten Modus-Leiste,
// Erstnutzer-Fuehrung und Vordertuer-Optionsliste in `lib/captureEntry.ts` (dazu die drei Helfer,
// die nur sie lasen: `RECOMMENDED_NARRATE_MODE`, `CAPTURE_INTRO_SEEN_KEY`,
// `CAPTURE_FRONT_DOOR_OPTIONS_OPEN_KEY`).
//
// R-1349 (Nacharbeit 4) · DIESES REGISTER IST ABGEBAUT. Sein letzter Eintrag,
// `KnowledgeRescueIntro`, ist samt `lib/knowledgeRescue.ts` und dessen Test entfernt: der
// Erklärkasten ist seit JOB 3062 von der Fläche genommen (Auftrag §5), seine Schritte und sein
// Wertbeitrag hatten keinen anderen Leser. Der Beleg R-0991 Nr. 33 ist im Bedarfsabgleich als
// „mit R-1349 entfernt" geführt.
//
// Zur Herkunft, unverändert:
// JOB 3062 R6 — DER EINTRAG `intakeSuggestion.ts::deriveIntakeSuggestion` FIEL, WEIL DER WAECHTER
// RECHT HATTE.
//
// In R5 stand hier `intakeSuggestion.ts::deriveIntakeSuggestion` mit der Begruendung, die Quelle
// sei „die Autorenzeile in ,…' -> ,Status'". Das war eine Umdeutung: die Autorenzeile ist der
// AUTOR, die Struktur-Chip-Zeile war die VERMUTETE QUELLE — zwei Aussagen, die zufaellig
// denselben Namen tragen. ben hat den Verlust gemessen („Eine Quellenzeile im Status fehlt").
// Seit R6 ruft `Blatt.tsx` die Ableitung wirklich auf (`quellenVorschlag`), der Export hat damit
// einen Produktaufrufer, und A3 hat den Eintrag zu Recht als Leiche gemeldet.

// ------------------------------------------------------------------------------------------------
// JOB 3556: Das Duldungsregister aus JOB 3427 R2 ist GESTRICHEN, nicht leer stehen geblieben. Sein
// einziger Eintrag duldete den abgeloesten `useLiveKnowledgeCheck` in components/capture/intake,
// weil dessen Abbau ausserhalb der damaligen Zielpfade lag. Dieser Auftrag hatte die Pfade und hat
// ihn entfernt — damit trifft die Ausnahme nicht mehr zu, und A3 haette sie als Leiche gemeldet.

// REGISTER 5 · BEWUSST OHNE AUFRUFER AUF `apps/web/src` (JOB 2611 D1)
// ------------------------------------------------------------------------------------------------
// Dieselbe Regel wie bei `BEWUSST`: nur Eintraege, deren Grund am Code geprueft ist.
const BEWUSST_WEB: readonly Ausnahme[] = [
  {
    schluessel: "apps/web/src/app/navHistory.ts::clearPopAuthorityForTests",
    grund:
      "Ausdruecklich fuer Tests gebaut — der Name sagt es. Ein Produktaufrufer waere hier der " +
      "Fehler: er wuerde die Pop-Autoritaet der Navigation im Betrieb zuruecksetzen.",
  },
  {
    schluessel: "apps/web/src/test/render.tsx::renderMarkup",
    grund:
      "Testhilfe im Verzeichnis `src/test` — dort steht das Ruestzeug der Oberflaechentests. " +
      "Ein Produktaufrufer waere sinnwidrig; Produktionscode rendert nicht ueber Testhelfer.",
  },
  {
    schluessel: "apps/web/src/test/render.tsx::setLanguage",
    grund: "Dieselbe Bauart und derselbe Grund wie `renderMarkup` — Ruestzeug der Tests.",
  },
  {
    schluessel: "apps/web/src/test/render.tsx::makeKo",
    grund: "Testdatenbauer im selben Ruestzeug. Ein Produktaufrufer waere ein Befund, kein Ziel.",
  },
  {
    schluessel: "apps/web/src/test/render.tsx::makeSource",
    grund: "Dieselbe Bauart und derselbe Grund wie `makeKo`.",
  },
  // HIER STAND `imageResize.ts::imageWidthPercent` UND IST GESTRICHEN — von A3 erzwungen. Die
  // Breitenanzeige der Bildleiste (`RichTextEditor.tsx`, `bildgroesse-gezogen`) liest die Zahl
  // seither über diesen Export statt per Zeichenkettenersetzung am Attribut.
  // R-1349: Hier standen `WORD_ADDIN_DOKUMENT_SETTING`, `mitDokumentkennung` und
  // `dokumentkennungAusAntwort` mit dem Grund „Aufrufer ist der Skript-Spiegel". Der Wächter misst
  // diesen Aufruf seitdem selbst (`FREMDLESER`, Art `spiegel`); die Ausnahme ist überflüssig.
  {
    schluessel: "apps/web/src/lib/captureAdvancedFields.ts::ADVANCED_FIELDS_TOTAL",
    grund:
      "Seit 8f70ef9a (R-0922, Zaehler der erweiterten Details) ohne Produktaufrufer, am Code " +
      "geprueft: der Kommentar an der Konstante sagt woertlich „fuer Tests und Pruefer, nicht fuer " +
      "die Anzeige“ — das Badge zeigt nur `filledCount` aus `advancedFieldsSummary`, eine " +
      "Hoechstzahl erscheint auf keiner Flaeche. Gelesen wird der Export in " +
      "`tests/app/capture-advanced-fields.test.ts` und " +
      "`tests/capture/job2683-d2-suche-flaeche.test.tsx` als Pruefhilfe dafuer, dass der Zaehler alle neun Angaben erreicht. Ein erfundener " +
      "Produktaufruf waere hier der Fehler; entfaellt die Pruefhilfe, ist der Export zu streichen.",
  },
  {
    schluessel: "apps/web/src/components/klara-vorschau/avatar.ts::KLARA_AVATAR_SHA256",
    grund:
      "R-1349 (Nacharbeit 2), mit dem Hauptstand 1.0.0-beta.1.771 hereingekommen und am Code " +
      "geprueft: die Pruefsumme der freigegebenen Figur `klara/klara-avatar-v1.png`. Gelesen wird " +
      "sie in `tests/klara-vorschau/avatar.test.ts`, das Datei und Summe gegen die Freigabe haelt. " +
      "Die Oberflaeche laedt die Figur ueber `klaraAvatarUrl()`; ein Produktaufruf der Summe waere " +
      "eine Laufzeitpruefung im Browser, die niemand beschlossen hat.",
  },
  // HIER STAND `GesamtanweisungSeite` (JOB 4154) UND IST MIT JOB 4156 GESTRICHEN — ebenfalls
  // selbstauslaufend und ebenfalls von A3 erzwungen. Ihr Aufrufer ist jetzt
  // `apps/web/src/components/gesamtanweisung/GesamtanweisungBereich.tsx`, und der haengt ueber
  // `apps/web/src/routes.tsx` (`PAGES.gesamtanweisungen`) an einem Menuepunkt.
  //
  // R-1349 (Nacharbeit 4): zwei Einträge aus dem abgebauten ALTBESTAND_WEB, am Code geprüft und
  // BEGRÜNDET stehen gelassen — beide sind Prüfnähte am Produktmodul, keine halb eingebaute Funktion.
  {
    schluessel: "apps/web/src/app/ImageDescribeContext.tsx::ImageDescribeValueProvider",
    grund:
      "Die Naht fuer isoliert montierte Editor-Tests: sie setzt einen Wert in den ECHTEN " +
      "Bildbeschreibungs-Kontext (`tests/capture/bildbeschreibung-naht.tsx`, " +
      "`tests/anhaenge-ziehen/buehne.tsx`). Ein Umzug nach `tests/` muesste den modulprivaten " +
      "Kontext freilegen. JOB 3062 R8 hat einen Produktaufrufer (den Mithoerer im Blatt) als Fehler " +
      "gemessen und entfernt — ein Produktaufruf waere hier der Befund.",
  },
  {
    schluessel: "apps/web/src/lib/richText.ts::RICH_TEXT_ALLOWED_TAGS",
    grund:
      "Die autoritative Tag-Allowlist des Sanitizers, gelesen von " +
      "`tests/capture/huelle-tagbewusste-grenze.test.ts`, der daraus seine Grundmenge erhebt. Die " +
      "Produktentscheidungen lesen `FLAT_BODY_TAGS` (gemessen). Eine Abschrift der Liste im Test " +
      "waere genau die Drift, gegen die er steht; entfaellt der Test, ist der Export zu streichen.",
  },
];

// ------------------------------------------------------------------------------------------------
// R-1349 (Nacharbeit 4) · REGISTER 6 (ALTBESTAND AUF `apps/web/src`) IST ABGEBAUT
// ------------------------------------------------------------------------------------------------
// Eingefroren am 27.08.2026 mit 117 Einträgen (JOB 2611 D1), zuletzt 120 mit den 26 Namen aus
// `lib/wordAddin.ts`. Diese misst der Wächter seit Nacharbeit 4 selbst (`FREMDLESER`, Art `spiegel`).
// Jeder übrige Eintrag ist einzeln abgeglichen: angeschlossen, entfernt, als Prüfzeug in den Test
// gezogen oder — wo eine belegte Sperre oder ein gesonderter Auftrag den Abschluss ausschliesst — als
// unerledigter Rest in `OFFENER_REST` geführt; zwei Prüfnähte stehen begründet in `BEWUSST_WEB`. Die Aufstellung je Fall
// steht in `docs/qm/aufnahme-20260922-gesamt-aufruferwaechter.md`.
//
// Frühere Erledigungen aus der Zeit des eingefrorenen Registers, unverändert zur Herkunft: JOB 3337
// (`isAdminSectionId` als Weiche der Verwaltung), R-1349 Nacharbeit 3 (`KNOWLEDGE_TYPES_DRAFT` im
// Blatt), R-0991 K3 (`ordnerOhneEigeneZeile` in der Importvorschau), JOB 4193 (`replacePayload` in
// der Offline-Warteschlange), JOB 3064 H5 (`START_HELP_TOPICS` im Start).

// R-1349 (Nacharbeit 4): GEDULDET besteht nur noch aus BEGRÜNDETEN Einträgen — jeder trägt einen
// Grund, die offenen Entscheidungen zusätzlich ihren Entscheider. Ein eingefrorenes Register ohne
// Grund gibt es nicht mehr.
const GEDULDET = new Set<string>([
  ...BEWUSST.map((a) => a.schluessel),
  ...NEUZUGANG_GEMELDET.map((a) => a.schluessel),
  ...OFFENER_REST.map((a) => a.schluessel),
  ...BEWUSST_WEB.map((a) => a.schluessel),
]);

describe("JOB 2605 · A · der Aufrufer-Wächter über services/**", () => {
  it("A1 · DER FANG: kein neuer Export ohne Nicht-Test-Aufrufer", () => {
    const { ohneAufrufer, exporte, gelesen } = erhebe();

    // Ohne diese zwei Zeilen wäre der Fall auch dann grün, wenn der Sammler leer liefe — ein
    // leergelaufener Sammler meldet dasselbe wie ein sauberer Baum.
    expect(gelesen, "Es wurden kaum Quelldateien gelesen — der Gang ist kaputt").toBeGreaterThan(
      300,
    );
    expect(exporte, "Es wurden kaum Exporte erhoben — die Erhebung ist kaputt").toBeGreaterThan(
      500,
    );

    const neu = ohneAufrufer.filter((f) => !GEDULDET.has(schluessel(f)));
    const meldung = [
      `${neu.length} Export(e) unter ${UEBERWACHT.map((u) => `\`${u}/\``).join(" bzw. ")} haben keinen Aufrufer ausserhalb der Tests:`,
      "",
      ...neu.map((f) => `  ${f.datei}:${f.zeile}  ${f.name}  (${f.art})`),
      "",
      "Ein Test ist kein Aufrufer (tools/modalgrenze.ts:8). Gebaut, getestet, gruen geurteilt —",
      "und nie gerufen: genau das ist der haeufigste Fehler dieses Projekts (OFFEN.md S2, H3, KA2, TV1).",
      "",
      "WAS ZU TUN IST:",
      "  · Verdrahte den Export dort, wo er wirken soll — das ist der Regelfall.",
      "  · Ist er bewusst ohne Aufrufer (Testhilfe, Betriebsbefehl), traegst du ihn mit GRUND",
      "    in `BEWUSST` in dieser Datei ein.",
      "  · Sperrt eine belegte Sperre oder ein gesonderter Auftrag seinen Anschluss, gehoert er mit",
      "    GRUND, BELEG und ENTSCHEIDER in `OFFENER_REST` — als unerledigter Rest, nie als stiller",
      "    Altbestand (R-1349).",
      "  · Ist er ueberholt, entferne ihn (R-1349: „angeschlossen oder begruendet entfernt“).",
    ].join("\n");

    expect(neu.map(schluessel), meldung).toEqual([]);
  });

  it("A2 · KALIBRIERUNG: der Sammler erkennt echte Aufrufer und faellt nicht auf Nennungen herein", () => {
    // Pflicht in beide Richtungen. Ohne sie misst ein Befund den Sammler statt den Code — und
    // genau daran ist der erste Anlauf dieses Waechters gescheitert (s. `verwendungen`).
    const { exporte, ohneAufrufer, fremdGenutzt } = erhebe();
    expect(exporte).toBeGreaterThan(500);
    const finde = (name: string): Fund => {
      const treffer = ohneAufrufer.find((f) => f.name === name);
      if (treffer) return treffer;
      // Nicht in der Fundliste heisst: er hat einen Aufrufer. Fuer die Probe brauchen wir ihn trotzdem.
      const alle = erhebe();
      const roh = alle.ohneAufrufer.find((f) => f.name === name);
      return roh ?? { datei: "", name, exportname: name, zeile: 0, art: "" };
    };

    /** Ein Prueffund fuer einen BENANNTEN Export — dort fallen Bezeichner und Exportname zusammen. */
    const benannt = (datei: string, name: string): Fund => ({
      datei,
      name,
      exportname: name,
      zeile: 0,
      art: "",
    });

    // POSITIV: ein bekannter echter Aufruf wird gefunden.
    // `gatedPool` wird in `build-app.ts:691` gerufen (`const pool = gatedPool(rohPool);`).
    expect(
      fremdGenutzt(benannt("services/db-tx/src/gated-pool.ts", "gatedPool")),
      "`gatedPool` wird in build-app.ts gerufen — der Sammler muss das sehen",
    ).toBe(true);
    // `expandSearchTerms` wird in beiden Suchadaptern gerufen (search-projection-repo{,-pg}.ts).
    expect(
      fremdGenutzt(
        benannt("services/knowledge-object/src/search-projection.ts", "expandSearchTerms"),
      ),
      "`expandSearchTerms` wird in den Suchadaptern gerufen — der Sammler muss das sehen",
    ).toBe(true);

    // POSITIV, JOB 3030: eine NACHGELADENE Seite ist gerufen. `routes.tsx` holt `Admin` seit
    // JOB 3030 über `lazy(() => import("./pages/Admin").then((m) => ({ default: m.Admin })))`;
    // vor der Erweiterung von `dynamischeZugriffeAus` meldete der Waechter genau diese 27 Seiten
    // als „ohne Aufrufer", obwohl sie unveraendert auf ihren Routen haengen.
    expect(
      fremdGenutzt(benannt("apps/web/src/pages/Admin.tsx", "Admin")),
      "`Admin` wird in routes.tsx dynamisch nachgeladen — der Sammler muss das sehen",
    ).toBe(true);

    // NEGATIV: eine blosse NENNUNG ist kein Aufruf.
    // `fuehreBestandsresetAus` steht in `build-app.ts:684` in einem KOMMENTAR und in
    // `db-tx/index.ts:26` als Barrel-Re-Export — beides darf nicht zaehlen.
    expect(
      fremdGenutzt(benannt("services/db-tx/src/bestandsreset.ts", "fuehreBestandsresetAus")),
      "Kommentar und Barrel-Re-Export duerfen NICHT als Aufrufer zaehlen",
    ).toBe(false);
    expect(finde("fuehreBestandsresetAus").datei).toBe("services/db-tx/src/bestandsreset.ts");
  });

  it("A3 · KEINE LEICHEN: jeder Registereintrag trifft heute noch zu", () => {
    // Eine Ausnahme, die nichts mehr deckt, verschleiert die Reichweite — dieselbe Regel fuehrt
    // der Reichweiten-Fall R1 des Fremddoppelungs-Waechters (Dateiname ohne Pfad genannt: er ist
    // im Bestand noch nicht eingebaut, und `testverweise-aufloesbar` verlangt zu Recht, dass ein
    // vollstaendiger Testpfad im Kommentar auf eine existierende Datei zeigt).
    // Wird ein Altfall verdrahtet, MUSS er aus dem Register verschwinden, sonst waechst die Liste
    // zu einem Friedhof.
    const { ohneAufrufer } = erhebe();
    const heute = new Set(ohneAufrufer.map(schluessel));

    const erledigt = [...GEDULDET].filter((s) => !heute.has(s)).sort();
    expect(
      erledigt,
      [
        "Diese Registereintraege treffen nicht mehr zu — der Export hat inzwischen einen Aufrufer",
        "oder es gibt ihn nicht mehr. Bitte aus `BEWUSST`, `BEWUSST_WEB` beziehungsweise",
        "`OFFENER_REST` streichen:",
        ...erledigt.map((s) => `  ${s}`),
      ].join("\n"),
    ).toEqual([]);

    // Und jede benannte Ausnahme traegt wirklich einen Grund — in JEDEM Register, nicht nur im
    // ersten. Ein Register ohne diese Zeile waere die Hintertuer, durch die unbegruendete Eintraege
    // hereinkommen.
    for (const a of [...BEWUSST, ...NEUZUGANG_GEMELDET, ...OFFENER_REST, ...BEWUSST_WEB]) {
      expect(a.grund.length, `Ausnahme ${a.schluessel} ohne Begruendung`).toBeGreaterThan(40);
    }
    // R-1349 (Nacharbeit 4 und 6): ein Rest ohne Entscheider wäre wieder stiller Altbestand, und ein
    // Rest ohne belegte Sperre bzw. gesonderten Auftrag wäre keine Abgrenzung (BEN, Nacharbeit 6).
    // Jeder Eintrag nennt beides; eine genannte Belegdatei muss es im Baum geben.
    for (const a of OFFENER_REST) {
      const wer = `Rest ${a.schluessel}`;
      expect(a.entscheidet.trim().length, `${wer} ohne Entscheider`).toBeGreaterThan(5);
      expect(a.beleg.trim().length, `${wer} ohne Beleg`).toBeGreaterThan(40);
      if (a.abgrenzung === "gesonderter-auftrag") {
        expect(a.beleg, `${wer}: der Auftrag ist nicht benannt`).toMatch(
          /aufnahme:\d{8}:[a-z0-9-]+/,
        );
      }
      if (a.belegdatei !== undefined) {
        const da = existsSync(join(WURZEL, a.belegdatei));
        expect(da, `Belegdatei ${a.belegdatei} fehlt`).toBe(true);
      }
    }
    // Kein Schlüssel steht in zwei Registern — sonst trüge er zwei Begründungen, von denen eine
    // falsch ist.
    const alle = [...BEWUSST, ...NEUZUGANG_GEMELDET, ...OFFENER_REST, ...BEWUSST_WEB].map(
      (a) => a.schluessel,
    );
    expect(alle.length, "ein Schlüssel steht in mehr als einem Register").toBe(new Set(alle).size);
    // Und jede gemessene Fremdlesekante trägt ihren Grund — sie ersetzt eine Ausnahme und muss sich
    // deshalb genauso rechtfertigen.
    for (const f of FREMDLESER) {
      expect(f.grund.length, `Fremdleser ${f.modul} ohne Begruendung`).toBeGreaterThan(40);
      expect(f.leser.length, `Fremdleser ${f.modul} ohne Leserdatei`).toBeGreaterThan(0);
      for (const datei of f.leser) {
        expect(existsSync(join(WURZEL, datei)), `Leserdatei ${datei} fehlt`).toBe(true);
      }
    }
  });

  it("A4 · DIE GEGENPROBE: ohne Aufrufer gefangen, mit Aufrufer nicht — und ein Test rettet nichts", () => {
    // Auftrag §5: „Ein Test, der von Anfang an gruen ist, beweist nichts." Dieser Fall fuehrt die
    // Gegenprobe deshalb bei JEDEM Lauf mit — an einem echten Baum aus echten Dateien, gelesen vom
    // echten Sammler. Nur die Wurzel ist eine andere; dieselbe Bauart wie der `wurzel`-Parameter
    // in `tools/modalgrenze.ts:80` und aus demselben Grund: fuer einen Nachweis am Produktbaum
    // muesste Produktcode entstehen, und den deckt kein Lease dieses Durchgangs.
    const baum = mkdtempSync(join(tmpdir(), "kw2605-aufrufer-"));
    try {
      const src = join(baum, "services", "probe", "src");
      mkdirSync(src, { recursive: true });
      const schreib = (name: string, text: string): void =>
        writeFileSync(join(src, name), text, "utf8");
      const namen = (): string[] =>
        erhebe(baum, ["services"], ["services"]).ohneAufrufer.map((f) => f.name);

      // (a) DER FANG — ein Export, den niemand ruft.
      schreib("haenger.ts", "export function haengtInDerLuft(): number {\n  return 1;\n}\n");
      expect(namen(), "ein Export ohne jeden Aufrufer muss gefangen werden").toContain(
        "haengtInDerLuft",
      );

      // (b) EIN TEST IST KEIN AUFRUFER — die Doktrin, an einem echten Testaufruf gemessen.
      schreib("nur-test.ts", "export function nurVomTestGerufen(): number {\n  return 2;\n}\n");
      schreib(
        "nur-test.test.ts",
        'import { nurVomTestGerufen } from "./nur-test";\n\nnurVomTestGerufen();\n',
      );
      expect(namen(), "ein Export, den NUR ein Test ruft, muss gefangen werden").toContain(
        "nurVomTestGerufen",
      );

      // (c) DIE GEGENMUTATION — derselbe Export, jetzt mit echtem Aufrufer, faellt heraus.
      // Ein Waechter, der auch das rot meldet, ist immer rot und wird abgeschaltet.
      schreib(
        "nutzer.ts",
        'import { haengtInDerLuft } from "./haenger";\n\nexport function nutzeIhn(): number {\n  return haengtInDerLuft() + 1;\n}\n',
      );
      expect(
        namen(),
        "ein Export MIT echtem Aufrufer darf NICHT mehr gefangen werden",
      ).not.toContain("haengtInDerLuft");

      // (d) UND EINE NENNUNG RETTET IHN NICHT: Kommentar und Barrel-Re-Export sind keine Aufrufe.
      schreib(
        "index.ts",
        '// `nurVomTestGerufen` wird hier nur erwaehnt.\nexport { nurVomTestGerufen } from "./nur-test";\n',
      );
      expect(namen(), "Kommentar und Barrel-Re-Export duerfen einen Export NICHT decken").toContain(
        "nurVomTestGerufen",
      );
    } finally {
      rmSync(baum, { recursive: true, force: true });
    }
  });

  // ----------------------------------------------------------------------------------------------
  // JOB 2611 D1 — DIESELBEN NACHWEISE AUF DER NEUEN FLAECHE
  // ----------------------------------------------------------------------------------------------
  // Auftrag §3.3, woertlich: „Der Nachweis bleibt derselbe wie in 2605 D3: ein Fangtest (Export
  // ohne Aufrufer ⇒ rot), eine Gegenprobe (mit Aufrufer ⇒ gruen), und der Falsch-Gruen-Fall R4 —
  // Import vorhanden, benutzt wird eine unabhaengige gleichnamige Nennung. Der ist in `services`
  // schon belegt; er muss auch auf der neuen Flaeche greifen."
  //
  // Warum das nicht schon durch A4 erledigt ist: A4 misst mit `ueberwacht = ["services"]`. Dass
  // der Sammler auf `services` traegt, sagt nichts darueber, ob er es auf `apps/web/src` tut —
  // dort liegen `.tsx`-Dateien, Standardexporte und JSX-Verwendungen, und genau daran ist der
  // Standardexport-Fall (`Fund.exportname`) aufgefallen. Ein Nachweis auf der alten Flaeche waere
  // fuer die neue eine Behauptung.
  it("A5 · NEUE FLAECHE: Fang, Gegenprobe und der Falsch-Gruen-Fall R4 auf `apps/web/src`", () => {
    const baum = mkdtempSync(join(tmpdir(), "kw2611-web-"));
    try {
      const src = join(baum, "apps", "web", "src", "lib");
      mkdirSync(src, { recursive: true });
      const schreib = (name: string, text: string): void =>
        writeFileSync(join(src, name), text, "utf8");
      const namen = (): string[] =>
        erhebe(baum, ["apps/web/src"], ["apps/web/src"]).ohneAufrufer.map((f) => f.name);

      // (a) DER FANG — ein Export auf der neuen Flaeche, den niemand ruft.
      schreib("haenger.ts", "export function webHaengtInDerLuft(): number {\n  return 1;\n}\n");
      expect(
        namen(),
        "ein Export unter apps/web/src ohne jeden Aufrufer muss gefangen werden",
      ).toContain("webHaengtInDerLuft");

      // (b) R4 · DER FALSCH-GRUEN-FALL, auf der neuen Flaeche.
      // Die Datei IMPORTIERT `webVerdeckt` — und benutzt im Rumpf eine eigene, unabhaengige
      // Deklaration desselben Namens. Der Import ist damit unbenutzt, der Export tot. Wer nur
      // fragt „kommt der Name in einer anderen Datei vor?", meldet hier faelschlich Entwarnung.
      schreib("verdeckt.ts", "export function webVerdeckt(): number {\n  return 2;\n}\n");
      schreib(
        "verdecker.ts",
        'import { webVerdeckt } from "./verdeckt";\n\n' +
          "export function ruftEigenes(): number {\n" +
          "  const webVerdeckt = 42;\n" +
          "  return webVerdeckt;\n" +
          "}\n",
      );
      expect(
        namen(),
        "R4: eine unabhaengige gleichnamige Nennung darf den Export NICHT decken",
      ).toContain("webVerdeckt");

      // (c) DIE GEGENPROBE — derselbe Export, jetzt mit echtem Aufrufer, faellt heraus.
      // Ohne diesen Fall waere der Waechter immer rot, und ein immer roter Waechter wird
      // abgeschaltet. Das ist die Haelfte, die genauso zaehlt wie der Fang.
      schreib(
        "nutzer.ts",
        'import { webHaengtInDerLuft } from "./haenger";\n\n' +
          "export function webNutzeIhn(): number {\n  return webHaengtInDerLuft() + 1;\n}\n",
      );
      expect(
        namen(),
        "ein Export MIT echtem Aufrufer darf auf der neuen Flaeche NICHT gefangen werden",
      ).not.toContain("webHaengtInDerLuft");

      // (d) DER STANDARDEXPORT — der Fall, der diese Flaeche mitgebracht hat.
      // `export default function X` wird als `default` exportiert, aber als `X` importiert.
      // Vor JOB 2611 D1 verglich der Waechter Exportname gegen BEZEICHNER und meldete deshalb
      // `App.tsx::App` als ohne Aufrufer — die Wurzelkomponente der Anwendung, die `main.tsx`
      // als `<App />` rendert. Ein Falsch-Rot auf dem sichtbarsten Stueck Code, das es gibt.
      const seiten = join(baum, "apps", "web", "src", "pages");
      mkdirSync(seiten, { recursive: true });
      writeFileSync(
        join(seiten, "Wurzel.tsx"),
        "export default function Wurzel(): number {\n  return 3;\n}\n",
        "utf8",
      );
      writeFileSync(
        join(seiten, "einstieg.tsx"),
        'import Wurzel from "./Wurzel";\n\nexport function starte(): number {\n  return Wurzel();\n}\n',
        "utf8",
      );
      expect(
        namen(),
        "ein Standardexport MIT Aufrufer darf nicht gefangen werden (Falsch-Rot vor JOB 2611 D1)",
      ).not.toContain("Wurzel");

      // (e) UND DIE GEGENPROBE DAZU: ein Standardexport OHNE Aufrufer wird weiterhin gefangen.
      // Sonst waere (d) mit einem Freibrief fuer alle Standardexporte erkauft.
      writeFileSync(
        join(seiten, "Waise.tsx"),
        "export default function Waise(): number {\n  return 4;\n}\n",
        "utf8",
      );
      expect(namen(), "ein Standardexport OHNE Aufrufer muss weiterhin gefangen werden").toContain(
        "Waise",
      );
    } finally {
      rmSync(baum, { recursive: true, force: true });
    }
  });

  // ----------------------------------------------------------------------------------------------
  // JOB 3030 — DER DYNAMISCHE IMPORT, IN BEIDE RICHTUNGEN GEFAHREN
  // ----------------------------------------------------------------------------------------------
  // Eine Erweiterung, die nur den einen Fall grün macht, den sie grün machen soll, ist keine
  // Erweiterung, sondern eine Ausnahme mit anderem Namen. Deshalb hier vier Fälle: der Fang bleibt,
  // die drei Schreibweisen des Nachladens zählen, und ein Abgriff OHNE zugehörigen dynamischen
  // Import zählt weiterhin nicht.
  it("A6 · NACHGELADEN IST GERUFEN: `import(…).then((m) => m.X)` deckt, eine blosse Nennung nicht", () => {
    const baum = mkdtempSync(join(tmpdir(), "kw3030-lazy-"));
    try {
      const src = join(baum, "apps", "web", "src", "lib");
      mkdirSync(src, { recursive: true });
      const schreib = (name: string, text: string): void =>
        writeFileSync(join(src, name), text, "utf8");
      const namen = (): string[] =>
        erhebe(baum, ["apps/web/src"], ["apps/web/src"]).ohneAufrufer.map((f) => f.name);

      // (a) DER FANG BLEIBT: drei Exporte, die niemand nachlädt.
      schreib("seite-a.ts", "export function LazySeiteA(): number {\n  return 1;\n}\n");
      schreib("seite-b.ts", "export function LazySeiteB(): number {\n  return 2;\n}\n");
      schreib("seite-c.ts", "export function LazySeiteC(): number {\n  return 3;\n}\n");
      const gefangen = namen();
      expect(gefangen, "ohne Nachladen bleibt der Export ohne Aufrufer").toContain("LazySeiteA");
      expect(gefangen).toContain("LazySeiteB");
      expect(gefangen).toContain("LazySeiteC");

      // (b) DIE FORM AUS `routes.tsx`: `.then((m) => ({ default: m.X }))`.
      schreib(
        "router.ts",
        'export const A = lazy(() => import("./seite-a").then((m) => ({ default: m.LazySeiteA })));\n' +
          "declare function lazy(f: () => Promise<unknown>): unknown;\n",
      );
      // (c) DIE DESTRUKTURIERENDE FORM: `.then(({ X }) => …)`.
      schreib(
        "router-destrukturiert.ts",
        'export const B = import("./seite-b").then(({ LazySeiteB }) => LazySeiteB);\n',
      );
      // (d) DIE AWAIT-FORM: `const m = await import("./x"); m.X`.
      schreib(
        "router-await.ts",
        "export async function holeC(): Promise<unknown> {\n" +
          '  const m = await import("./seite-c");\n' +
          "  return m.LazySeiteC;\n" +
          "}\n",
      );
      const nachGeladen = namen();
      expect(
        nachGeladen,
        "`import(…).then((m) => m.X)` IST ein Aufrufer — genau die Form, mit der routes.tsx seine Seiten lädt",
      ).not.toContain("LazySeiteA");
      expect(nachGeladen, "die destrukturierende Form zählt genauso").not.toContain("LazySeiteB");
      expect(nachGeladen, "die await-Form zählt genauso").not.toContain("LazySeiteC");

      // (e) DIE GEGENRICHTUNG — ohne sie wäre die Erweiterung ein Freibrief.
      // Hier steht `m.LazyWaise` ohne jeden dynamischen Import dieses Moduls: ein gewöhnlicher
      // Eigenschaftszugriff auf ein beliebiges Objekt. Er darf nichts decken.
      schreib("waise.ts", "export function LazyWaise(): number {\n  return 4;\n}\n");
      schreib(
        "falscher-abgriff.ts",
        "export function greifeAb(m: { LazyWaise: number }): number {\n  return m.LazyWaise;\n}\n",
      );
      expect(
        namen(),
        "ein Eigenschaftszugriff OHNE dynamischen Import dieses Moduls darf NICHTS decken",
      ).toContain("LazyWaise");

      // (f) UND EIN DYNAMISCHER IMPORT AUF EIN ANDERES MODUL DECKT IHN AUCH NICHT.
      // Der Pfad ist mitgebunden: `import("./seite-a")` sagt nichts über `waise.ts`.
      schreib(
        "falscher-pfad.ts",
        'export const C = import("./seite-a").then((m) => m.LazyWaise);\n',
      );
      expect(
        namen(),
        "der Spezifikator ist Teil des Vertrags — ein Abgriff am FALSCHEN Modul deckt nichts",
      ).toContain("LazyWaise");
    } finally {
      rmSync(baum, { recursive: true, force: true });
    }
  });

  // ----------------------------------------------------------------------------------------------
  // R-1349 (Nacharbeit 1) — EIN METHODENNAME VERDECKT KEINEN IMPORT
  // ----------------------------------------------------------------------------------------------
  // Der rote Lauf am Kandidaten meldete `services/management/src/horizon.ts::riskHorizon`, obwohl
  // `service.ts` ihn in der gleichnamigen Methode `async riskHorizon()` ruft. Beide Richtungen:
  // der Aufruf im Methodenrumpf deckt, eine bloss gleichnamige Methode ohne Aufruf deckt nicht.
  it("A7 · GLEICHNAMIGE METHODE: der Aufruf im Rumpf zählt, der Methodenname allein nicht", () => {
    const baum = mkdtempSync(join(tmpdir(), "kw1349-methode-"));
    try {
      const src = join(baum, "services", "probe", "src");
      mkdirSync(src, { recursive: true });
      const schreib = (name: string, text: string): void =>
        writeFileSync(join(src, name), text, "utf8");
      const namen = (): string[] =>
        erhebe(baum, ["services"], ["services"]).ohneAufrufer.map((f) => f.name);

      schreib("ableitung.ts", "export function ableitung(): number {\n  return 1;\n}\n");
      schreib("nur-name.ts", "export function nurName(): number {\n  return 2;\n}\n");
      schreib(
        "dienst.ts",
        'import { ableitung } from "./ableitung";\nimport { nurName } from "./nur-name";\n\n' +
          "export class Dienst {\n" +
          "  async ableitung(): Promise<number> {\n    return ableitung();\n  }\n" +
          "  nurName(): number {\n    return 3;\n  }\n" +
          "}\n" +
          "export const dienst = new Dienst();\n",
      );
      const gefangen = namen();
      expect(
        gefangen,
        "der Aufruf des Imports im Rumpf einer gleichnamigen Methode IST ein Aufruf",
      ).not.toContain("ableitung");
      expect(
        gefangen,
        "eine gleichnamige Methode ohne Aufruf des Imports deckt den Export NICHT",
      ).toContain("nurName");
    } finally {
      rmSync(baum, { recursive: true, force: true });
    }
  });

  // ----------------------------------------------------------------------------------------------
  // R-1349 (Nacharbeit 4) — A8 · DIE FREMDLESEKANTE IST GEMESSEN, NICHT GEGLAUBT
  // ----------------------------------------------------------------------------------------------
  // `FREMDLESER` ersetzt Ausnahmen durch eine Messung. Diese Messung muss in beide Richtungen
  // tragen: ein wirklich gerufener Spiegel und eine wirklich auswertende Lesekette decken; eine
  // blosse Definition, ein Kommentar, eine Zeichenkette, ein Eigenschaftsname, ein Selbstaufruf, lose
  // Pfad- und Namenszeichenketten oder ein Lesen ohne Anwendung des Namens decken NICHT (die letzten
  // vier seit Nacharbeit 6, BEN). Gefahren wird sie an einem eigenen Baum mit eigener Leserliste —
  // dieselbe Bauart wie A4.
  it("A8 · FREMDLESER: gerufener Spiegel und benannter Quelltextleser decken, Nennungen nicht", () => {
    const baum = mkdtempSync(join(tmpdir(), "kw1349-fremdleser-"));
    try {
      const src = join(baum, "services", "probe", "src");
      mkdirSync(src, { recursive: true });
      mkdirSync(join(baum, "public"), { recursive: true });
      mkdirSync(join(baum, "werkzeug"), { recursive: true });
      const schreib = (rel: string, text: string): void =>
        writeFileSync(join(baum, rel), text, "utf8");
      // Nacharbeit 6 (BEN): `nurGenannt` steht nach seiner Definition auf einer weiteren Codezeile —
      // aber nur als Zeichenkette; `nurEigenschaft` nur als Eigenschaftsname; `nurSelbst` ruft nur
      // sich selbst. Keiner davon ist ein Verweis.
      schreib(
        "services/probe/src/spiegelquelle.ts",
        "export function gerufen(): number {\n  return 1;\n}\n" +
          "export function nurDefiniert(): number {\n  return 2;\n}\n" +
          "export function nurKommentiert(): number {\n  return 3;\n}\n" +
          "export function nurGenannt(): number {\n  return 4;\n}\n" +
          "export function nurEigenschaft(): number {\n  return 5;\n}\n" +
          "export function nurSelbst(n: number): number {\n  return n;\n}\n",
      );
      schreib(
        "public/spiegel.js",
        "function gerufen() { return 1; }\nfunction nurDefiniert() { return 2; }\n" +
          "function nurKommentiert() { return 3; }\n// nurKommentiert();\n" +
          'function nurGenannt() { return 4; }\nconsole.log("nurGenannt");\n' +
          "function nurEigenschaft() { return 5; }\nvar o = { nurEigenschaft: 1 };\n" +
          "o.nurEigenschaft();\n" +
          "function nurSelbst(n) { return n > 0 ? nurSelbst(n - 1) : 0; }\n" +
          "console.log(gerufen());\n",
      );
      schreib(
        "services/probe/src/listen.ts",
        'export const LISTE_A = ["a"];\nexport const LISTE_B = ["b"];\n',
      );
      // Die echte Kette: lesen → an die eigene Auswertung geben → den Namen auf den Text anwenden.
      schreib(
        "werkzeug/leser.mjs",
        'import { readFileSync } from "node:fs";\n' +
          "function auswerten(quelltext) {\n" +
          '  for (const liste of ["LISTE_A"]) {\n' +
          '    if (quelltext.indexOf("export const " + liste) === -1) {\n' +
          "      throw new Error(liste);\n" +
          "    }\n" +
          "  }\n" +
          "}\n" +
          'const quelle = "services/probe/src/listen.ts";\n' +
          'auswerten(readFileSync(quelle, "utf8"));\n',
      );
      schreib("services/probe/src/pfadlos.ts", 'export const LISTE_C = ["c"];\n');
      schreib("werkzeug/pfadlos.mjs", 'const name = "LISTE_C";\n');
      // BENs Fall wörtlich: Modulpfad und Exportname als zwei ungenutzte Zeichenketten.
      schreib("services/probe/src/lose.ts", 'export const LISTE_D = ["d"];\n');
      schreib(
        "werkzeug/lose.mjs",
        'const quelle = "services/probe/src/lose.ts";\nconst name = "LISTE_D";\n',
      );
      // Gelesen, aber der Name wird NICHT auf das Gelesene angewandt.
      schreib("services/probe/src/blind.ts", 'export const LISTE_E = ["e"];\n');
      schreib(
        "werkzeug/blind.mjs",
        'import { readFileSync } from "node:fs";\n' +
          "function zaehle(text) {\n" +
          '  console.log("LISTE_E");\n' +
          "  return text.length;\n" +
          "}\n" +
          'zaehle(readFileSync("services/probe/src/blind.ts", "utf8"));\n',
      );
      const leser: readonly FremdLeser[] = [
        {
          modul: "services/probe/src/spiegelquelle.ts",
          leser: ["public/spiegel.js"],
          art: "spiegel",
          grund: "Probe",
        },
        {
          modul: "services/probe/src/listen.ts",
          leser: ["werkzeug/leser.mjs"],
          art: "quelltext",
          grund: "Probe",
        },
        {
          modul: "services/probe/src/pfadlos.ts",
          leser: ["werkzeug/pfadlos.mjs"],
          art: "quelltext",
          grund: "Probe",
        },
        {
          modul: "services/probe/src/lose.ts",
          leser: ["werkzeug/lose.mjs"],
          art: "quelltext",
          grund: "Probe",
        },
        {
          modul: "services/probe/src/blind.ts",
          leser: ["werkzeug/blind.mjs"],
          art: "quelltext",
          grund: "Probe",
        },
      ];
      const gefangen = erhebe(baum, ["services"], ["services"], [], leser).ohneAufrufer.map(
        (f) => f.name,
      );
      expect(gefangen, "ein gerufener Spiegel deckt seinen Export").not.toContain("gerufen");
      expect(gefangen, "eine Definition allein ist kein Aufruf").toContain("nurDefiniert");
      expect(gefangen, "ein Kommentar ist kein Aufruf").toContain("nurKommentiert");
      expect(gefangen, "eine Zeichenkette mit dem Namen ist kein Verweis").toContain("nurGenannt");
      expect(gefangen, "ein Eigenschaftsname ist kein Verweis").toContain("nurEigenschaft");
      expect(gefangen, "ein Selbstaufruf ist kein Aufrufer").toContain("nurSelbst");
      expect(gefangen, "lesen, auswerten, Namen anwenden deckt").not.toContain("LISTE_A");
      expect(gefangen, "nicht ausgewählt ist nicht gelesen").toContain("LISTE_B");
      expect(gefangen, "ohne den Modulpfad deckt eine Zeichenkette nichts").toContain("LISTE_C");
      expect(gefangen, "Pfad und Name als lose Zeichenketten decken nichts").toContain("LISTE_D");
      expect(gefangen, "gelesen, aber der Name nicht angewandt deckt nichts").toContain("LISTE_E");
      // Und ohne Leserliste deckt gar nichts — die Kante kommt aus der Liste, nicht aus dem Baum.
      const ohneListe = erhebe(baum, ["services"], ["services"], [], []).ohneAufrufer.map(
        (f) => f.name,
      );
      expect(ohneListe).toEqual(expect.arrayContaining(["gerufen", "LISTE_A"]));
    } finally {
      rmSync(baum, { recursive: true, force: true });
    }
  });

  // ----------------------------------------------------------------------------------------------
  // R-1349 (Nacharbeit 4) — A9 · EIN VORGABEWERT IN DER DESTRUKTURIERUNG IST EINE LESEOPERATION
  // ----------------------------------------------------------------------------------------------
  // Gemessen an `facetRail.ts::FACET_SEARCH_THRESHOLD`: gelesen als `searchThreshold =
  // FACET_SEARCH_THRESHOLD` in einer Destrukturierung — der Wächter übersprang das ganze Muster und
  // meldete den Export als „ohne Aufrufer". Die Gegenprobe hält die andere Richtung: ein Name, der
  // im Muster nur als Eigenschafts- oder Bindungsname steht, liest kein Modulsymbol.
  it("A9 · DESTRUKTURIERUNG: der Vorgabewert zählt, Eigenschafts- und Bindungsnamen nicht", () => {
    const baum = mkdtempSync(join(tmpdir(), "kw1349-muster-"));
    try {
      const src = join(baum, "services", "probe", "src");
      mkdirSync(src, { recursive: true });
      writeFileSync(
        join(src, "muster.ts"),
        "export const SCHWELLE = 3;\n" +
          "export const breite = 1;\n" +
          "export const hoehe = 2;\n" +
          "export function lies(o: { s?: number; breite?: number; h?: number }): number {\n" +
          "  const { s = SCHWELLE, breite: b = 0, h: hoehe2 = 0 } = o;\n" +
          "  const { hoehe } = { hoehe: 5 };\n" +
          "  return s + b + hoehe2 + hoehe;\n" +
          "}\n",
        "utf8",
      );
      const gefangen = erhebe(baum, ["services"], ["services"], [], []).ohneAufrufer.map(
        (f) => f.name,
      );
      expect(gefangen, "der Vorgabewert liest das Modulsymbol").not.toContain("SCHWELLE");
      expect(gefangen, "ein Eigenschaftsname im Muster liest nichts").toContain("breite");
      expect(gefangen, "ein gleichnamiger Bindungsname verdeckt, liest aber nichts").toContain(
        "hoehe",
      );
    } finally {
      rmSync(baum, { recursive: true, force: true });
    }
  });

  // ----------------------------------------------------------------------------------------------
  // R-1349 (Nacharbeit 7) — A10 · MEHRERE DYNAMISCHE IMPORTE GEMEINSAM (`Promise.all`)
  // ----------------------------------------------------------------------------------------------
  // Gemessen an `apps/web/src/components/KlaraAssistant.tsx`: `laden.then(([modul, beispiele]) =>
  // modul.allBibliothekEntries(…))`. Der Wächter kannte nur `import(…).then((m) => …)` und meldete die
  // drei so geladenen Exporte als „ohne Aufrufer". Die Gegenprobe hält die andere Richtung: ein
  // Namensraum deckt nur die Exporte SEINES Moduls, nicht die des Nachbarn in derselben Liste.
  it("A10 · Promise.all: jede Ergebnisstelle deckt genau ihr Modul — direkt, über Variable, mit await", () => {
    const baum = mkdtempSync(join(tmpdir(), "kw1349-promiseall-"));
    try {
      const src = join(baum, "services", "probe", "src");
      mkdirSync(src, { recursive: true });
      const schreib = (datei: string, text: string): void =>
        writeFileSync(join(src, datei), text, "utf8");
      schreib("a.ts", "export const eins = 1;\nexport const zwei = 2;\n");
      schreib("b.ts", "export const drei = 3;\n");
      schreib("c.ts", "export const vier = 4;\n");
      schreib("d.ts", "export const fuenf = 5;\nexport const sechs = 6;\n");
      schreib(
        "nutzer.ts",
        'const laden = Promise.all([import("./a"), import("./b")]);\n' +
          "void laden.then(([m, n]) => m.eins + n.drei + n.zwei);\n" +
          'void Promise.all([import("./c")]).then(([k]) => k.vier);\n' +
          "async function start(): Promise<number> {\n" +
          '  const [p] = await Promise.all([import("./d")]);\n' +
          "  return p.fuenf;\n" +
          "}\n" +
          "void start();\n",
      );
      const gefangen = erhebe(baum, ["services"], ["services"], [], []).ohneAufrufer.map(
        (f) => f.name,
      );
      expect(gefangen, "über eine Variable und `.then`").not.toContain("eins");
      expect(gefangen, "die zweite Stelle der Liste").not.toContain("drei");
      expect(gefangen, "direkt an `Promise.all(…).then`").not.toContain("vier");
      expect(gefangen, "`const [p] = await Promise.all(…)`").not.toContain("fuenf");
      expect(gefangen, "der Nachbar-Namensraum deckt nicht").toContain("zwei");
      expect(gefangen, "nicht abgegriffen ist nicht gerufen").toContain("sechs");
    } finally {
      rmSync(baum, { recursive: true, force: true });
    }
  });
});
