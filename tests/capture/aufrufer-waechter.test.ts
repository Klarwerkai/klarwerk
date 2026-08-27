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

/** Die überwachte Fläche. */
const UEBERWACHT = "services";

/** Wo nach Aufrufern gesucht wird — der ganze Nicht-Test-Baum. */
const SUCHBAEUME = ["services", "apps/web/src", "tools", "scripts"] as const;

interface Fund {
  readonly datei: string;
  readonly name: string;
  readonly zeile: number;
  readonly art: string;
}

/** Die exportierten WERTE einer Datei. `interface`/`type` sind keine Werte und stehen nicht drin. */
function exporteAus(datei: string, sf: ts.SourceFile): Fund[] {
  const raus: Fund[] = [];
  const zeile = (n: ts.Node): number => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  for (const s of sf.statements) {
    if (ts.isFunctionDeclaration(s) && s.name && istExportiert(s)) {
      raus.push({ datei, name: s.name.text, zeile: zeile(s), art: "function" });
    } else if (ts.isClassDeclaration(s) && s.name && istExportiert(s)) {
      raus.push({ datei, name: s.name.text, zeile: zeile(s), art: "class" });
    } else if (
      ts.isVariableStatement(s) &&
      s.declarationList.declarations[0] !== undefined &&
      istExportiert(s.declarationList.declarations[0] as ts.Declaration)
    ) {
      for (const d of s.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) {
          raus.push({ datei, name: d.name.text, zeile: zeile(d), art: "const" });
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
  ueberwacht: string = UEBERWACHT,
  suchbaeume: readonly string[] = SUCHBAEUME,
): Erhebung {
  const dateien = suchbaeume.flatMap((b) => quelldateien(b, wurzel)).map(posix);
  const bekannt = new Set(dateien);
  const nutzung = new Map<string, Set<string>>();
  const importe = new Map<string, Importkante[]>();
  const reexporte = new Map<string, Reexport[]>();
  const eigeneExporte = new Map<string, Set<string>>();
  const baeume = new Map<string, ts.SourceFile>();
  const exporte: Fund[] = [];

  for (const d of dateien) {
    const sf = quelleAus(d, readFileSync(`${wurzel}/${d}`, "utf8")).ast;
    baeume.set(d, sf);
    nutzung.set(d, verwendungen(sf));
    importe.set(d, importeAus(sf));
    reexporte.set(d, reexporteAus(sf));
    const eigene = exporteAus(d, sf);
    eigeneExporte.set(d, new Set(eigene.map((e) => e.name)));
    if (d.startsWith(`${ueberwacht}/`)) {
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
            namensraumZugriffe(sf, k.lokal).has(f.name) &&
            herkunft(modul, f.name) === f.datei
          ) {
            return true;
          }
          continue;
        }
        if (k.exportname !== f.name || !genutzt.has(k.lokal)) {
          continue;
        }
        if (herkunft(modul, k.exportname) === f.datei) {
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
  "services/knowledge-object/src/display-status.ts::displayStatus",
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
const DURCH_VERSCHAERFUNG_SICHTBAR: readonly Ausnahme[] = [
  {
    schluessel: "services/conflicts/src/duplicate-detect.ts::titleSimilarity",
    grund:
      "NEU IN D3, und der Musterfall der Bindungspruefung: In DERSELBEN Datei fuehrt eine andere " +
      "Funktion einen PARAMETER gleichen Namens (`:91 titleSimilarity: number`) und benutzt ihn " +
      "(`:99`). Bis D2 galt das als Verwendung in der eigenen Datei, und der Export fiel aus der " +
      "Fundliste. Die Verwendung bezeichnet aber den Parameter, nicht den Export — der Export " +
      "`:268` wird nirgends gerufen. NICHT behoben (Auftrag §4): das ist eigene Arbeit.",
  },
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

const GEDULDET = new Set<string>([
  ...BEWUSST.map((a) => a.schluessel),
  ...DURCH_VERSCHAERFUNG_SICHTBAR.map((a) => a.schluessel),
  ...NEUZUGANG_GEMELDET.map((a) => a.schluessel),
  ...ALTBESTAND,
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
      `${neu.length} Export(e) unter \`${UEBERWACHT}/\` haben keinen Aufrufer ausserhalb der Tests:`,
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
      return roh ?? { datei: "", name, zeile: 0, art: "" };
    };

    // POSITIV: ein bekannter echter Aufruf wird gefunden.
    // `gatedPool` wird in `build-app.ts:691` gerufen (`const pool = gatedPool(rohPool);`).
    expect(
      fremdGenutzt({
        datei: "services/db-tx/src/gated-pool.ts",
        name: "gatedPool",
        zeile: 0,
        art: "",
      }),
      "`gatedPool` wird in build-app.ts gerufen — der Sammler muss das sehen",
    ).toBe(true);
    // `expandSearchTerms` wird in beiden Suchadaptern gerufen (search-projection-repo{,-pg}.ts).
    expect(
      fremdGenutzt({
        datei: "services/knowledge-object/src/search-projection.ts",
        name: "expandSearchTerms",
        zeile: 0,
        art: "",
      }),
      "`expandSearchTerms` wird in den Suchadaptern gerufen — der Sammler muss das sehen",
    ).toBe(true);

    // NEGATIV: eine blosse NENNUNG ist kein Aufruf.
    // `fuehreBestandsresetAus` steht in `build-app.ts:684` in einem KOMMENTAR und in
    // `db-tx/index.ts:26` als Barrel-Re-Export — beides darf nicht zaehlen.
    expect(
      fremdGenutzt({
        datei: "services/db-tx/src/bestandsreset.ts",
        name: "fuehreBestandsresetAus",
        zeile: 0,
        art: "",
      }),
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
    for (const a of [...BEWUSST, ...DURCH_VERSCHAERFUNG_SICHTBAR, ...NEUZUGANG_GEMELDET]) {
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
        erhebe(baum, "services", ["services"]).ohneAufrufer.map((f) => f.name);

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
});
