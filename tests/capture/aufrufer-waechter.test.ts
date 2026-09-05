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
//    `tools`, `scripts`): ein Export ist auch dann verdrahtet, wenn ihn die Oberfläche ruft.
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
// Er behebt den Altbestand NICHT (Auftrag §4) — er friert ihn ein und sperrt den Neuzugang.
//
// GRENZE, ausdrücklich benannt: Die Zuordnung läuft über den NAMEN, nicht über die aufgelöste
// Modulkante. Zwei gleichnamige Exporte in verschiedenen Paketen decken sich dadurch gegenseitig.
// Das macht den Wächter milder, nie falsch-rot — die richtige Richtung für einen Wächter, der im
// Tor bleiben soll. Eine echte Modulauflösung bräuchte ein `ts.Program` über den ganzen Baum und
// kostet ein Vielfaches der Laufzeit.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    if (!ts.isArrowFunction(n) && "name" in n && n.name && ts.isIdentifier(n.name)) {
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
      if (
        (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n) || ts.isVariableDeclaration(n)) &&
        k === n.name
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
    }
    ts.forEachChild(n, gehe);
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
): Erhebung {
  const dateien = suchbaeume.flatMap((b) => quelldateien(b, wurzel)).map(posix);
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

  const ohneAufrufer = exporte
    .filter((f) => !fremdGenutzt(f))
    .filter((f) => !(nutzung.get(f.datei)?.has(f.name) ?? false))
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
];

// ------------------------------------------------------------------------------------------------
// REGISTER 2 · DER ALTBESTAND, EINGEFROREN AM 27.08.2026
// ------------------------------------------------------------------------------------------------
// Diese Einträge sind NICHT freigesprochen. Sie sind der gemessene Ist-Zustand an dem Tag, an dem
// dieser Wächter entstand — der Auftrag verbietet ausdrücklich, sie in diesem Durchgang zu beheben
// (§4: „Was du NICHT tust: die vier Altfälle beheben").
//
// Wozu die Liste dann? Sie sperrt den NEUZUGANG: ab jetzt macht jeder weitere Export ohne Aufrufer
// das Tor rot. Und sie ist ein Arbeitsvorrat, der schrumpfen soll — wird ein Eintrag verdrahtet
// oder entfernt, meldet A3 ihn als „nicht mehr zutreffend" und verlangt seine Streichung. Eine
// Liste, die nur wächst, wäre der Anfang vom Ende dieses Wächters.
const ALTBESTAND: readonly string[] = [
  "services/app/src/addon-principal.ts::ADDON_CAPABILITY",
  "services/app/src/addon-principal.ts::isLiteralAskPath",
  "services/app/src/csrf.ts::COOKIE_STRATEGY",
  "services/app/src/csrf.ts::csrfAssessment",
  "services/app/src/csrf.ts::requestAuthMode",
  "services/app/src/demo-content.ts::DEMO_GAP_QUESTIONS",
  "services/app/src/demo-corpus.ts::DEMO_CORPUS_PAGE_COUNT",
  "services/app/src/demo-corpus.ts::corpusConflictPairs",
  "services/app/src/demo-corpus.ts::corpusImportItems",
  "services/app/src/dev-persist.ts::readJournal",
  "services/app/src/duplicate-signal.ts::A28_SIGNAL_GRENZE",
  "services/app/src/duplicate-signal.ts::befundFuerEigenesKo",
  "services/app/src/example-packages.ts::EXAMPLE_PACKAGE_IDS",
  "services/app/src/feature-flags.ts::vorgabeAn",
  "services/app/src/migrationsbeleg.ts::IRREVERSIBLE_DATENMIGRATIONEN",
  "services/app/src/migrationsbeleg.ts::MIGRATIONS_SOLLLISTE",
  "services/app/src/migrationsbeleg.ts::erzeugeStrukturbeleg",
  "services/app/src/migrationsbeleg.ts::istStrukturstufe",
  "services/app/src/object-references.ts::isObjectReferenced",
  "services/app/src/reindex-queue.ts::REINDEX_CONCURRENCY",
  "services/app/src/reindex-queue.ts::createReindexQueue",
  "services/app/src/routes/ko-routes.ts::KO_AKTIONEN_MIT_TORURTEIL",
  "services/app/src/routes/naechster-schritt-entwurf.ts::naechsterSchrittEntwurfRoutes",
  "services/app/src/seed-demo.ts::DEMO_GAP_QUESTION",
  "services/audit/src/repo.ts::pruefeValidationDecisionRef",
  "services/capture/src/interview.ts::InterviewSession",
  "services/conflicts/src/coverage.ts::singleRunBalances",
  "services/conflicts/src/duplicate-detect.ts::overlapCandidacy",
  "services/conflicts/src/duplicate-detect.ts::overlapScorePercent",
  "services/confluence/src/adapter.ts::adapterFromConfig",
  "services/db-tx/src/bestandsreset-audit.ts::SQL_SCHEMA_BESTANDSRESET",
  "services/db-tx/src/bestandsreset-audit.ts::bestandsresetBefund",
  "services/db-tx/src/bestandsreset.ts::fuehreBestandsresetAus",
  "services/db-tx/src/reset-lock.ts::SQL_SPERRE_WIRD_GEHALTEN",
  "services/db-tx/src/write-fence.ts::PgWriteFence",
  "services/db-tx/src/write-fence.ts::fenceKey",
  // JOB 3024 · GESTRICHEN, WEIL BEHOBEN: `displayStatus` stand hier seit dem 27.08.2026 — die
  // Ableitung war gebaut, exportiert und hatte im ganzen Produkt keinen einzigen Aufrufer
  // (`git log -S "displayStatus" -- services/app`: kein Treffer ueber die gesamte Historie). Seit
  // JOB 3024 ruft `services/app/src/routes/ko-routes.ts` sie am Detailabruf `GET /api/kos/:id`.
  // Genau dafuer ist dieses Register da: es soll schrumpfen.
  "services/knowledge-object/src/effective-search-document.ts::EFFECTIVE_SEARCH_DOCUMENT_FIELDS",
  "services/knowledge-object/src/kanten-repo.ts::DeduplizierenderKantenBestand",
  "services/knowledge-object/src/kanten-service.ts::InMemoryKantenRepo",
  "services/knowledge-object/src/kanten-service.ts::netzQualitaet",
  "services/knowledge-object/src/metadata-projection.ts::METADATA_PROJECTION_FIELDS",
  "services/knowledge-object/src/metadata-projection.ts::METADATA_PROJECTION_MATCH_FIELDS",
  "services/knowledge-object/src/search-projection-repo.ts::freigegebeneProjektionsfassung",
  "services/knowledge-object/src/search-projection.ts::S2_ERWEITERUNG_GRENZE",
  "services/knowledge-object/src/search-projection.ts::SEARCH_PROJECTION_FIELDS",
  "services/knowledge-object/src/search-projection.ts::SEARCH_PROJECTION_MATCH_FIELDS",
  "services/knowledge-object/src/search-projection.ts::isReconstructedClassification",
  "services/knowledge-object/src/service.ts::SEARCH_PROJECTION_BACKFILL_PER_QUERY",
  "services/knowledge-object/src/types.ts::MAX_ATTACHMENTS",
  "services/knowledge-object/src/types.ts::MAX_ATTACHMENT_BYTES",
  "services/library-analytics/src/repo.ts::OPEN_REVIEW_STATUSES",
  "services/library-analytics/src/search-captions.ts::captionsMatchQuery",
  "services/library-analytics/src/service.ts::SEARCH_BACKFILL_LIMIT_PER_QUERY",
  "services/library-analytics/src/types.ts::pruefeGapBindung",
  "services/library-analytics/src/types.ts::pruefeInhaltsreferenzBindung",
  "services/lifecycle/src/types.ts::LifecycleError",
  "services/model-runs/src/types.ts::KI_ERZEUGENDE_AUFGABEN",
  "services/object-store/src/service.ts::isTransientMedia",
  "services/object-store/src/service.ts::isWithinRetention",
  "services/output/src/zuruf.ts::ZurufService",
  "services/reasoner/src/klara-policy.ts::KLARA_MODES",
  "services/reasoner/src/provider.ts::keywordSelect",
];

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
const DURCH_VERSCHAERFUNG_SICHTBAR: readonly Ausnahme[] = [
  {
    schluessel: "services/rbac/src/guard.ts::requirePermission",
    grund:
      "Gedeckt war er von `guards.requirePermission(...)` — einem OBJEKTFELD in `build-app.ts:1507` " +
      "und zwei Routen — sowie von einer eigenen lokalen Funktion gleichen Namens in " +
      "`services/app/src/http.ts:159`. Der rbac-Export selbst wird nirgends importiert. NICHT " +
      "behoben (Auftrag §4): das ist eigene Arbeit und betrifft eine Rechtepruefung.",
  },
  {
    schluessel: "services/conflicts/src/detect.ts::pairKey",
    grund:
      "Gedeckt war er von `const pairKey = ...` in `services/app/src/example-packages.ts:471` und " +
      "von `pairKey:` als OBJEKT-EIGENSCHAFT in `overlap-service.ts:120` und `overlap-types.ts:50`. " +
      "Kein Import, keine Verwendung des Exports. NICHT behoben (Auftrag §4).",
  },
  {
    schluessel: "services/ask/src/types.ts::GAP_PRIORITIES",
    grund:
      "Nur Definition und Barrel-Re-Export (`services/ask/index.ts:59`), kein Verbraucher. Bis D2 " +
      "deckte ihn der Re-Export selbst, weil dessen Bezeichner als Verwendung zaehlte. NICHT " +
      "behoben (Auftrag §4).",
  },
];

// ------------------------------------------------------------------------------------------------
// REGISTER 4 · NEUZUGANG, BEIM EINBAU GEFANGEN (JOB 2605 D2)
// ------------------------------------------------------------------------------------------------
// Diese beiden kamen mit dem Basisstand `c850f67a` (JOB 2604 D1) neu ins Werk und haben von Anfang
// an keinen Aufrufer. **Das ist der erste echte Fang dieses Wächters im Betrieb** — er hat beim
// ersten Kontakt mit einem frischen Einbau angeschlagen, wofuer er gebaut wurde.
//
// Sie stehen hier und nicht im `ALTBESTAND`, damit sichtbar bleibt, dass sie NEU sind: Der
// Altbestand ist eingefroren und soll schrumpfen; ein Neuzugang gehoert gemeldet, nicht abgelegt.
const NEUZUGANG_GEMELDET: readonly Ausnahme[] = [
  {
    schluessel: "services/db-tx/src/idle-in-transaction.ts::pruefbefehl",
    grund:
      "Neu mit JOB 2604 D1 (Basisstand c850f67a). Nur Definition, Barrel-Re-Export " +
      "(`services/db-tx/index.ts:40`) und eine Kommentarerwaehnung — kein Aufrufer. Gemeldet am " +
      "27.08.2026 in der Rueckgabe zu JOB 2605 D2; NICHT behoben, das ist Sache des Einbauenden.",
  },
  {
    schluessel: "services/db-tx/src/idle-in-transaction.ts::bewerte",
    grund:
      "Neu mit JOB 2604 D1, gleiche Lage wie `pruefbefehl` (`services/db-tx/index.ts:39`). " +
      "Gemeldet, NICHT behoben.",
  },
];

// ------------------------------------------------------------------------------------------------
// REGISTER 4b · ERSETZT, ABBAU LIEGT AUSSERHALB DER ZIELPFADE (JOB 3015 D5)
// ------------------------------------------------------------------------------------------------
// JOB 3015 D5 macht die Startseite zur Konsole (Zielbild KonsoleStart.dc.html): Die beiden
// CTA-Knoepfe des Seitenkopfs („Frage stellen"/„Wissen erfassen" und „Validierung oeffnen") sind
// durch die drei Karten Suchen/Pruefen/Hinzufuegen ersetzt, deren Ziele als Literale in
// `pages/Start.tsx` stehen. Damit hat die Tabelle `lib/startCtas.ts` ihren einzigen Produkt-Leser
// verloren. Die Datei liegt AUSSERHALB der Zielpfade des Auftrags (Start.tsx, i18n.ts, der neue
// Design-Test) und darf von der Bahn nicht angefasst werden; ihr Abbau (Datei, die Schluessel
// `start.ctaAsk/ctaCapture/ctaValidate`, die Regel `.kw-cta-primary` im modernen Thema (Block D
// der Werkbank-Regeln) und der Import im mega51-Sammler) ist in der Rueckgabe zu JOB 3015 als
// Folgeauftrag benannt. Gemeldet, nicht abgelegt — A3 streicht die Eintraege, sobald die Datei weg
// ist. (Der Pfad des Stylesheets steht hier absichtlich nicht: das Deckungsregister der
// Theme-Waechter, tests/app/theme-deckungsregister.test.ts, sammelt jeden Test, der ihn nennt,
// und dieser Test deckt das Thema nicht.)
const ERSETZT_JOB3015: readonly Ausnahme[] = [
  {
    schluessel: "apps/web/src/lib/startCtas.ts::startCta",
    grund:
      "Seit JOB 3015 D5 ohne Produktaufrufer: der Haupt-CTA der Startseite ist durch die Karten " +
      "Suchen (/fragen) und Hinzufuegen (/erfassen) ersetzt. Abbau ausserhalb der Zielpfade, " +
      "Folgeauftrag benannt (RUECKGABE JOB 3015).",
  },
  {
    schluessel: "apps/web/src/lib/startCtas.ts::startQueueCta",
    grund:
      "Seit JOB 3015 D5 ohne Produktaufrufer: der Warteschlangen-Link der Startseite ist durch " +
      "die Karte Pruefen (/validierung) mit der Pille „N offen“ ersetzt. Abbau ausserhalb der " +
      "Zielpfade, Folgeauftrag benannt (RUECKGABE JOB 3015).",
  },
];

// ------------------------------------------------------------------------------------------------
// REGISTER 4c · ERSETZT, ABBAU LIEGT AUSSERHALB DER ZIELPFADE (JOB 3061 H2)
// ------------------------------------------------------------------------------------------------
// JOB 3061 baut die vier Pruefseiten auf die Mockups vom 04.09. um (Pruefen/Konflikte/Duplikate
// unter einem gemeinsamen Reiterkopf). Zwei Praesentations-Bauteile haben dabei ihren einzigen
// Produkt-Aufrufer verloren, weil die FLAECHE ihre Aufgabe uebernommen hat:
//
//   FindingCard / FindingGroupHeader — die Befundkarte mit Gruppen-Ueberschrift. Ihre INHALTE sind
//     nicht entfallen: die ehrliche Benennung von WAS und ERKENNUNGSWEG kommt weiterhin aus
//     `lib/findingGroups.ts` (`conflictFinding` / `overlapFinding`) und steht im „Mehr" beider
//     Karten; die Ordnung „je Beitrag, neueste zuerst" kommt weiterhin aus
//     `groupFindingsByBeitrag`, der Gruppentitel aus `resolveKo`. Nur die KARTE ist ersetzt.
//   ConflictKoSide — die Belegkachel je Konfliktseite. Ihr Beleg (klickbare Quelle, Quelldatum,
//     KO-Konfidenz) steht jetzt im „Mehr" der jeweiligen Karte, aus DERSELBEN geteilten Komponente
//     `components/ko/SourceEvidence` mit denselben Feldern.
//
// Die zwei Dateien liegen AUSSERHALB der Zielpfade des Auftrags (`pages/Validation*.tsx`,
// `pages/Conflicts*.tsx`, `pages/Duplicate*.tsx`, `pages/Lifecycle*.tsx`,
// `components/pruefen/**`, `i18n.ts`, `tests/**`) und duerfen von der Bahn nicht geloescht werden;
// ihr Abbau (die zwei Dateien samt der mitgehenden Schluessel `finding.*` und
// `con.evidenceSideLabel`, soweit dann ungenutzt) ist in der RUECKGABE zu JOB 3061 als
// Folgeauftrag benannt. Gemeldet, nicht abgelegt — A3 streicht die Eintraege, sobald sie weg sind.
const ERSETZT_JOB3061: readonly Ausnahme[] = [
  {
    schluessel: "apps/web/src/components/FindingCard.tsx::FindingCard",
    grund:
      "Seit JOB 3061 H2 ohne Produktaufrufer: die Befundkarte ist durch das Kartenpaar der " +
      "Pruefflaeche ersetzt (design/klarwerk/Konflikte.dc.html, Duplikate.dc.html). Ihre Inhalte " +
      "leben ueber `lib/findingGroups.ts` im Mehr-Aufklapper weiter. Abbau ausserhalb der Zielpfade, " +
      "Folgeauftrag benannt (RUECKGABE JOB 3061).",
  },
  {
    schluessel: "apps/web/src/components/FindingCard.tsx::FindingGroupHeader",
    grund:
      "Seit JOB 3061 H2 ohne Produktaufrufer: die Gruppen-Ueberschrift ist entfallen (es steht " +
      "genau ein Befund da, mit der Pille k von n); die Gruppierung selbst wirkt weiter als " +
      "REIHENFOLGE ueber `groupFindingsByBeitrag`. Abbau ausserhalb der Zielpfade " +
      "(RUECKGABE JOB 3061).",
  },
  {
    schluessel: "apps/web/src/components/conflicts/ConflictKoSide.tsx::ConflictKoSide",
    grund:
      "Seit JOB 3061 H2 ohne Produktaufrufer: der Beleg je Konfliktseite steht jetzt im " +
      "Mehr-Aufklapper der jeweiligen Karte, aus derselben geteilten Komponente " +
      "`components/ko/SourceEvidence`. " +
      "Abbau ausserhalb der Zielpfade, Folgeauftrag benannt (RUECKGABE JOB 3061).",
  },
];

// ------------------------------------------------------------------------------------------------
// REGISTER 4d · SEIT JOB 3063 (H4) OHNE PRODUKTAUFRUFER — GEMELDET, NICHT ABGELEGT
// ------------------------------------------------------------------------------------------------
// JOB 3063 macht aus der Bibliothek eine Flaeche (Liste links, Lesefläche rechts) und aus der
// Detailseite mit dreizehn Karten deren rechte Haelfte. Zwei Bausteine der ABGELOESTEN Flaechen
// verlieren dabei ihren einzigen Produktleser. Beide Dateien liegen AUSSERHALB der Zielpfade des
// Auftrags (`pages/Library*.tsx`, `pages/KnowledgeDetail*.tsx`, `components/bibliothek/**`,
// `i18n.ts`, `tests/**`) und duerfen von der Bahn nicht angefasst werden; ihr Abbau ist in der
// RUECKGABE zu JOB 3063 unter ABWEICHUNGEN als Folgeauftrag benannt. A3 streicht die Eintraege,
// sobald die Dateien weg sind.
const ERSETZT_JOB3063: readonly Ausnahme[] = [
  {
    schluessel: "apps/web/src/components/ko/KoReadView.tsx::KoReadView",
    grund:
      "Seit JOB 3063 ohne Produktaufrufer: die Zonen-Leseansicht (Rahmen „Was in diesem Beitrag " +
      "steht“, Belegzone, Schlusshinweis) ist durch die Lesefläche der Bibliothek ersetzt — Titel, " +
      "Text, Quellen-Chips, sonst nichts (Pedi 04.09.: Erklärtext gehört hinter Menüs). Abbau " +
      "ausserhalb der Zielpfade, Folgeauftrag benannt.",
  },
  {
    schluessel: "apps/web/src/lib/koCta.ts::koCta",
    grund:
      "Seit JOB 3063 ohne Produktaufrufer: die „nächste Handlung“ der alten Detailseite ist durch " +
      "den Knopf „Fragen“ der Lesefläche ersetzt, der aus `components/bibliothek/fragen.ts::" +
      "fragenHref` kommt. Zwei Wege nebeneinander waeren genau die zweite Wahrheit, die dieser " +
      "Umbau abschafft. Abbau ausserhalb der Zielpfade.",
  },
  {
    schluessel: "apps/web/src/lib/libraryMaturity.ts::libraryUseCta",
    grund:
      "Seit JOB 3063 Runde 5 ohne Produktaufrufer: diese Regel verzweigte die verbindliche Aktion " +
      "ueber die REIFE — nur ein validierter Eintrag bekam „Fragen“, alles andere „Pruefen“ und " +
      "das Ziel /validierung. Pedis Vorgabe vom 04.09. (Auftrag §5.3/§5a) verlangt fuer JEDEN " +
      "gewaehlten Eintrag dieselbe Aktion „Fragen“ mit Bezug auf den Eintrag (`ko=<id>`); die " +
      "Lesefläche zieht ihre Adresse deshalb aus `components/bibliothek/fragen.ts::fragenHref`. " +
      "Die uebrigen Exporte der Datei (libraryMaturity, filterByMaturity, …) tragen weiter. Abbau " +
      "ausserhalb der Zielpfade (`apps/web/src/lib/**`), Folgeauftrag benannt.",
  },
];

// ------------------------------------------------------------------------------------------------
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
];

// ------------------------------------------------------------------------------------------------
// REGISTER 6 · DER ALTBESTAND AUF `apps/web/src`, EINGEFROREN AM 27.08.2026 (JOB 2611 D1)
// ------------------------------------------------------------------------------------------------
// 117 Eintraege. Sie sind NICHT freigesprochen — sie sind der gemessene Ist-Zustand der
// Flaeche an dem Tag, an dem sie in die Ueberwachung kam.
//
// WARUM EINGEFROREN UND NICHT BEHOBEN — die Entscheidung aus Auftrag §3.2, hier begruendet:
// Die Probe VOR jeder Aenderung ergab 122 Exporte ohne Aufrufer (Protokoll
// `arbeit/protokoll_messen2.txt`). Das ist keine Handvoll, sondern ein Arbeitsvorrat von Tagen.
// Wer sie in EINEM Durchgang beheben wollte, muesste in 60 Dateien eingreifen — quer durch
// Bibliothek, Erfassung, Ask und Verwaltung, in Flaechen, an denen gerade drei andere Bahnen
// arbeiten. Der Auftrag benennt die Gefahr wortgleich: „Ein Waechter, der das Haus blockiert,
// wird abgeschaltet — und dann ist er nichts mehr wert."
//
// Deshalb dasselbe Verfahren wie bei `ALTBESTAND` fuer `services`: Die Flaeche kommt SOFORT in
// die Ueberwachung, der Bestand wird eingefroren, und ab jetzt macht **jeder weitere** Export
// ohne Aufrufer auf `apps/web/src` das Tor rot. Der Neuzugang ist gesperrt, der Altbestand ist
// Arbeitsvorrat — und A3 verlangt die Streichung jedes Eintrags, sobald er nicht mehr zutrifft.
// Eine Liste, die nur waechst, waere der Anfang vom Ende dieses Waechters.
//
// ZWEI BEOBACHTUNGEN, die den Vorrat sortieren:
//   · 110 der 122 Funde liegen in `apps/web/src/lib` — dem Verzeichnis der reinen Hilfsfunktionen.
//     Dort sammelt sich, was einmal fuer einen Weg gebaut und beim naechsten Umbau umgangen wurde.
//   · KEIN einziger Fund liegt in einer der sieben Dateien, die die Lease gesperrt hat. Es war
//     also nichts zu unterlassen — die Trennung zu den drei anderen Bahnen haelt von selbst.
const ALTBESTAND_WEB: readonly string[] = [
  "apps/web/src/app/ImageDescribeContext.tsx::ImageDescribeValueProvider",
  // JOB 3060 · H1: der letzte Aufrufer von `GuardedNavLink` war die Seitenleiste (Sidebar.tsx,
  // Nutzerzeile → /profil); die Hülle navigiert jetzt ausschließlich über `GuardedLink` (EINE
  // Aktivregel, JOB 562). Der Export bleibt, weil app/NavGuardContext.tsx nicht im Zielpfad des
  // Auftrags liegt — Folgeabbau, wie `TopbarIcons` darunter.
  "apps/web/src/app/NavGuardContext.tsx::GuardedNavLink",
  "apps/web/src/app/navigation.ts::TopbarIcons",
  "apps/web/src/components/LibraryScopeBar.tsx::LibraryScopeBar",
  "apps/web/src/components/confluence-import/ImportResultView.tsx::ImportResultView",
  "apps/web/src/components/d44Struktur.ts::D44_GLIEDERUNG_GRENZE",
  "apps/web/src/components/ko/KoRead.tsx::KoReadBody",
  "apps/web/src/components/trust/KoHomeLine.tsx::KoHomeLine",
  "apps/web/src/lib/adminForms.ts::isNewUserValid",
  "apps/web/src/lib/adminSections.ts::isAdminSectionId",
  "apps/web/src/lib/answerMarkdown.ts::stripAnswerMarkdown",
  "apps/web/src/lib/askGapRescue.ts::gapRescueStepLabelKey",
  "apps/web/src/lib/askGapRescue.ts::gapRescueSteps",
  "apps/web/src/lib/askResponse.ts::selectGap",
  "apps/web/src/lib/attachment.ts::attachmentPreview",
  "apps/web/src/lib/attachment.ts::isObjectAttachment",
  "apps/web/src/lib/boardCard.ts::BOARD_REMOVED_LABEL_KEY",
  "apps/web/src/lib/boardCard.ts::conflictLead",
  "apps/web/src/lib/boardCard.ts::duplicateLead",
  "apps/web/src/lib/bodyFileLink.ts::applyBodyFileLink",
  "apps/web/src/lib/captureAiAssist.ts::ASSIST_APPLY_MODES",
  "apps/web/src/lib/captureAttachments.ts::uploadAttachments",
  "apps/web/src/lib/captureFlowGuide.ts::captureFlowStepLabelKey",
  "apps/web/src/lib/captureFlowGuide.ts::captureFlowSteps",
  "apps/web/src/lib/captureFlowGuide.ts::recommendedFlowStep",
  "apps/web/src/lib/captureFromFile.ts::createWholeDocumentDraft",
  "apps/web/src/lib/captureFromFile.ts::imagesOnlyNoticeKey",
  "apps/web/src/lib/captureFromFile.ts::importImageNotice",
  "apps/web/src/lib/conflictCollision.ts::conflictDisplayMode",
  "apps/web/src/lib/conflictImpact.ts::effectiveUsability",
  "apps/web/src/lib/demoKnowledge.ts::demoKnowledgeBadge",
  "apps/web/src/lib/demoKnowledge.ts::filterByDemoKnowledge",
  "apps/web/src/lib/demoPilotPath.ts::demoPilotPath",
  "apps/web/src/lib/draftForm.ts::KNOWLEDGE_TYPES_DRAFT",
  "apps/web/src/lib/draftForm.ts::isPromotable",
  "apps/web/src/lib/draftListView.ts::isDraftSortKey",
  "apps/web/src/lib/duplicateCompare.ts::DUPLICATE_COMPARE_SAFETY",
  "apps/web/src/lib/editorAttachmentContext.ts::ATTACH_FILES_KEY",
  "apps/web/src/lib/editorAttachmentContext.ts::ATTACH_FILE_HINT_KEY",
  "apps/web/src/lib/editorAttachmentContext.ts::ATTACH_IMAGES_KEY",
  "apps/web/src/lib/editorAttachmentContext.ts::ATTACH_IMAGE_HINT_KEY",
  "apps/web/src/lib/editorAttachmentContext.ts::ATTACH_TITLE_KEY",
  "apps/web/src/lib/editorGuidance.ts::editorGuidance",
  "apps/web/src/lib/examplePackages.ts::EXAMPLE_PACKAGES_ALL_KEYS",
  "apps/web/src/lib/externalAttachGate.ts::externalAttachBlockedKey",
  "apps/web/src/lib/externalSearch.ts::isAttachable",
  "apps/web/src/lib/facetRail.ts::FACET_SEARCH_THRESHOLD",
  "apps/web/src/lib/facets.ts::combinableFacetCounts",
  "apps/web/src/lib/fileMultiPoint.ts::mergedDraftFromPoints",
  "apps/web/src/lib/files.ts::isOcrCandidate",
  "apps/web/src/lib/files.ts::isPptxDocument",
  "apps/web/src/lib/funke.ts::openGapsView",
  "apps/web/src/lib/importSelectView.ts::folderTreeSegmentKey",
  "apps/web/src/lib/importSelectView.ts::ordnerOhneEigeneZeile",
  "apps/web/src/lib/intakeSimilarity.ts::classifyIntake",
  "apps/web/src/lib/interviewFlow.ts::answeredTurns",
  "apps/web/src/lib/knowledgeRescue.ts::knowledgeRescueImpact",
  "apps/web/src/lib/knowledgeRescue.ts::knowledgeRescueSteps",
  "apps/web/src/lib/knowledgeRescue.ts::rescueStepLabelKey",
  "apps/web/src/lib/knowledgeStory.ts::KNOWLEDGE_STORY_SURFACES",
  "apps/web/src/lib/knowledgeStudioGuide.ts::studioGuideActiveStep",
  "apps/web/src/lib/knowledgeStudioGuide.ts::studioGuideSteps",
  "apps/web/src/lib/knowledgeStudioLayout.ts::knowledgeStudioSections",
  "apps/web/src/lib/knowledgeStudioTips.ts::knowledgeStudioTips",
  "apps/web/src/lib/koEvidence.ts::evidenceKindLabel",
  "apps/web/src/lib/koLabel.ts::hatTitel",
  "apps/web/src/lib/learningPath.ts::nextOpenStep",
  "apps/web/src/lib/libraryExport.ts::exportFormatMeta",
  "apps/web/src/lib/libraryMaturity.ts::MATURITY_FILTERS",
  "apps/web/src/lib/libraryMaturity.ts::countByMaturity",
  "apps/web/src/lib/libraryMaturity.ts::filterByMaturity",
  "apps/web/src/lib/libraryMaturity.ts::maturityFilterLabelKey",
  "apps/web/src/lib/librarySort.ts::isLibrarySortKey",
  "apps/web/src/lib/librarySpace.ts::koHomePath",
  "apps/web/src/lib/librarySpace.ts::serializeSpace",
  "apps/web/src/lib/librarySpace.ts::spaceFromParams",
  "apps/web/src/lib/loadingState.ts::isGroupLoaded",
  "apps/web/src/lib/mobileConfirm.ts::confirmsDelete",
  "apps/web/src/lib/mobileConfirm.ts::needsConfirmation",
  "apps/web/src/lib/offlineQueue.ts::replacePayload",
  "apps/web/src/lib/oidcCallback.ts::isCompleteCallback",
  "apps/web/src/lib/outputDoc.ts::orderedSelection",
  "apps/web/src/lib/pdf.ts::extractPdfText",
  "apps/web/src/lib/pilotChecklist.ts::pilotChecklist",
  "apps/web/src/lib/pilotNextSteps.ts::pilotNextSteps",
  "apps/web/src/lib/pilotObservationGuide.ts::pilotObservationGuide",
  "apps/web/src/lib/proofChain.ts::proofChain",
  "apps/web/src/lib/reasonerStatus.ts::reasonerStatusSummary",
  "apps/web/src/lib/reviewerMinimum.ts::isNeededValidationsValid",
  "apps/web/src/lib/richText.ts::RICH_TEXT_ALLOWED_TAGS",
  // JOB 3064 H5: `START_HELP_TOPICS` steht hier NICHT mehr — die drei ?-Hilfen des Start-Screens
  // werden seit dem Umbau aus genau dieser Tabelle gerendert (`components/start/StartPanel.tsx`,
  // Punkt „Hilfe zu dieser Seite"). Der Eintrag träfe nicht mehr zu, und A3 hat das gemeldet.
  //
  // JOB 3064 H5: `primaryWorkItem` ist neu OHNE Aufrufer. Der „beste nächste Einstieg" war eine
  // hervorgehobene Zeile ÜBER der Arbeitsliste — das Zielbild `design/klarwerk/Main.dc.html` hat
  // beides zu EINER Karte zusammengezogen: „FÜR DICH" reiht selbst nach Dringlichkeit (kritisch
  // vor heute vor später, `components/start/forYou.ts`), und die dringendste Arbeit IST damit die
  // erste Zeile. Eine zweite Hervorhebung derselben Sache wäre genau die Doppelung, die mega38
  // Block G2 auf dieser Seite schon einmal beseitigt hat.
  // Die Funktion selbst steht in `lib/workCenter.ts` und damit AUSSERHALB der Zielpfade dieses
  // Auftrags; ihr Abbau (samt `canActOn`, das nur sie ruft) ist als Folgeschritt gemeldet.
  "apps/web/src/lib/workCenter.ts::primaryWorkItem",
  "apps/web/src/lib/validationStatus.ts::deriveDisplayStatus",
  "apps/web/src/lib/wordAddin.ts::WORD_ADDIN_ASK_TIMEOUT_MS",
  "apps/web/src/lib/wordAddin.ts::WORD_ADDIN_LOGIN_FETCH_TIMEOUT_MS",
  "apps/web/src/lib/wordAddin.ts::WORD_ADDIN_LOGIN_POLL_INTERVAL_MS",
  "apps/web/src/lib/wordAddin.ts::answerIsLong",
  "apps/web/src/lib/wordAddin.ts::answerSelectionIsWhole",
  "apps/web/src/lib/wordAddin.ts::askAiNoticeVisible",
  "apps/web/src/lib/wordAddin.ts::askEvidenceDetail",
  "apps/web/src/lib/wordAddin.ts::askLocale",
  "apps/web/src/lib/wordAddin.ts::askSnippetWorthShowing",
  "apps/web/src/lib/wordAddin.ts::askSourceRole",
  "apps/web/src/lib/wordAddin.ts::askSourceStatus",
  "apps/web/src/lib/wordAddin.ts::canInsertAnswer",
  "apps/web/src/lib/wordAddin.ts::classifyDraftResponse",
  "apps/web/src/lib/wordAddin.ts::composeAnswerOutput",
  "apps/web/src/lib/wordAddin.ts::draftWasCreated",
  "apps/web/src/lib/wordAddin.ts::fillWordImages",
  "apps/web/src/lib/wordAddin.ts::klaraTrustHead",
  "apps/web/src/lib/wordAddin.ts::koDetailUrl",
  "apps/web/src/lib/wordAddin.ts::loginPollStep",
  "apps/web/src/lib/wordAddin.ts::openQuestionDraftTitle",
  "apps/web/src/lib/wordAddin.ts::performAsk",
  "apps/web/src/lib/wordAddin.ts::performCopy",
  "apps/web/src/lib/wordAddin.ts::performInsert",
  "apps/web/src/lib/wordAddin.ts::prepareAskQuestion",
  "apps/web/src/lib/wordAddin.ts::prepareWordDraftRequest",
  "apps/web/src/lib/wordAddin.ts::wordHtmlToPlainText",
];

const GEDULDET = new Set<string>([
  ...BEWUSST.map((a) => a.schluessel),
  ...DURCH_VERSCHAERFUNG_SICHTBAR.map((a) => a.schluessel),
  ...NEUZUGANG_GEMELDET.map((a) => a.schluessel),
  ...ERSETZT_JOB3015.map((a) => a.schluessel),
  ...ERSETZT_JOB3061.map((a) => a.schluessel),
  ...ERSETZT_JOB3063.map((a) => a.schluessel),
  ...ALTBESTAND,
  ...BEWUSST_WEB.map((a) => a.schluessel),
  ...ALTBESTAND_WEB,
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
      "  · `ALTBESTAND` ist KEIN Ablageort fuer Neues. Diese Liste soll schrumpfen, nicht wachsen.",
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
        "oder es gibt ihn nicht mehr. Bitte aus `BEWUSST` beziehungsweise `ALTBESTAND` streichen:",
        ...erledigt.map((s) => `  ${s}`),
      ].join("\n"),
    ).toEqual([]);

    // Und jede benannte Ausnahme traegt wirklich einen Grund — in ALLEN drei begruendeten
    // Registern, nicht nur im ersten. Ein Register ohne diese Zeile waere die Hintertuer, durch
    // die unbegruendete Eintraege hereinkommen.
    for (const a of [
      ...BEWUSST,
      ...DURCH_VERSCHAERFUNG_SICHTBAR,
      ...NEUZUGANG_GEMELDET,
      ...ERSETZT_JOB3015,
      ...ERSETZT_JOB3061,
      ...BEWUSST_WEB,
    ]) {
      expect(a.grund.length, `Ausnahme ${a.schluessel} ohne Begruendung`).toBeGreaterThan(40);
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
});
