// ==================================================================================================
// JOB 3611 · EINE ADRESSE IST KEIN PFAD — UND DAS SAGT AB HIER EIN WÄCHTER, NICHT EIN KOMMENTAR.
// ==================================================================================================
//
// HIER WOHNT DIE BEGRÜNDUNG, UND ZWAR GENAU EINMAL. Ursprung ist
// `tests/app-sprachschalter/wechsel-ohne-verlust.test.tsx:120-138`: JOB 3559 hat den Fehler dort an
// EINER Datei abgestellt und die Lehre als Kommentar daneben geschrieben. Ein Kommentar deckt aber
// nur die Datei, in der er steht — die übrigen Testordner hat 3559 ausdrücklich weder durchsucht
// noch angefasst (`archiv/3559/runde-2/RUECKGABE.md:63`). Dieser Wächter macht aus der Lehre eine
// Messung.
//
// DER FEHLER, in einem Satz: ein Prüffall setzt eine Adresse aus `pathname` UND `search` zu EINER
// Zeichenkette zusammen und stellt sie dann gegen ein Literal OHNE `?`, also gegen einen reinen
// PFAD. Das sieht wie eine Routenprüfung aus, ist aber eine Aussage über die GANZE Adresse:
// stillschweigend behauptet der Fall „und es gibt keinen Abfrageteil".
//
// WARUM DAS TEUER IST, gemessen und nicht vermutet: der Fall wird ZEITABHÄNGIG. Die Bibliothek
// schreibt den getippten Begriff erst nach `LIBRARY_SEARCH_DEBOUNCE_MS` (300 ms) in die Adresse;
// bis dahin ist die zusammengesetzte Zeichenkette gleich dem Pfad, danach nicht mehr. JOB 3531 hat
// genau diesen Fall dreifach kippen sehen, ohne die Ursache zu finden — weil die Fehlermeldung eine
// Zeichenkettendifferenz zeigt und damit auf die falsche Stelle deutet
// (`wechsel-ohne-verlust.test.tsx:128`).
//
// DIE RICHTIGE FORM (JOB 3559, und der Wächter akzeptiert sie in Eigenprobe VII):
//   · ZWEI Sondenknoten — einer trägt `pathname`, einer trägt `search`.
//   · ZWEI Helfer — `routenPfad()` gibt die Route und WIRFT, sobald sein Knoten ein `?` trägt;
//     `adresse()` gibt beide Teile GETRENNT (ein Objekt, keine Zeichenkette).
//   · ZWEI Zusagen, beide ausgeschrieben: „die Route steht still" UND „der Abfrageteil lautet …".
// Damit ist die Verwechslung nicht mehr formulierbar, weil es die zusammengesetzte Zeichenkette
// nicht mehr gibt — nicht bloß, weil niemand sie mehr benutzt.
//
// WIE DIE ERHEBUNG ARBEITET (und warum über den Syntaxbaum, nicht über eine Textsuche): gesucht
// wird nach ECHTEN `pathname`/`search`-Zugriffen in einer echten Zusammensetzung und nach einem
// ECHTEN `expect(...).toBe(...)`-Aufruf. Vorkommen in Kommentaren, in Zeichenketten und in
// Falltiteln sind im Baum keine Zugriffe und keine Aufrufe — sie können deshalb gar nicht zählen.
// Das ist die strukturelle Antwort auf die drei bekannten Fehlerquellen solcher Wächter
// (`LEHREN.md`, JOB 3570 R3 und JOB 3579 R1: Regex-Literalinhalt und Aliasformen); die Eigenproben
// III–XVII unten weisen es an ausgeschriebenen Beispielquelltexten nach.
//
// DIE ERSTE REGEL ÜBER ALLEM (JOB 3611 R2, aus bens Messung): UNBEKANNT HEISST NIEMALS „NACHGEWIESEN
// OHNE ABFRAGETEIL". Ein Befund entsteht nur, wenn der Sollwert VOLLSTÄNDIG aus dem Baum auflösbar ist
// und dann kein `?` trägt. Ein einziger unbekannter Teil — ein Funktionsaufruf in der Verkettung, eine
// mehrdeutige Konstante — macht die ganze Aussage unbekannt, und unbekannt heißt: kein Befund. Die
// erste Fassung hat stattdessen einen Platzhalter ohne `?` eingesetzt und das Ergebnis als bewiesenen
// Pfad behandelt; `"/bibliothek" + suche()` war damit ein FALSCHER Befund. Eigenproben XII und XIII
// halten beide Formen fest, XVI und XVII die Gegenrichtung (die Reparatur darf nicht blind machen).
//
// DIE ZWEITE REGEL (JOB 3611 R3, aus bens zweiter Messung): EINE INNERE BINDUNG SPERRT DIE ÄUSSERE,
// AUCH EINE, DEREN WERT DIE ERHEBUNG NICHT LESEN KANN. Sonst wird aus einer Bindungsform, die der
// Sammler nicht kennt, stillschweigend ein Rückgriff auf die äußere gleichnamige Konstante — und die
// gilt dort längst nicht mehr. Gemessen an drei Formen, die Runde 2 übersah: Parameter
// (`function pruefe(ziel: string)`), Destrukturierung (`const { ziel } = …`) und funktionsweit
// gültiges `var` in einem inneren Block. In allen dreien meldete der Wächter `soll: "/start"` aus der
// äußeren Zeile, obwohl der Fall in Wahrheit gegen `/bibliothek?q=Ventil` prüfte. Deshalb wird JEDE
// Bindungsform erfasst — auch Import, `catch`, Funktions- und Klassenname —, und die unlesbaren
// tragen `wert: null`, was denselben Weg nimmt wie die erste Regel: unbekannt, also kein Befund.
// Eigenproben XVIII–XX sind bens drei Proben, XXI–XXIII die Gegenrichtung.
//
// DIE GRENZEN, benannt statt verschwiegen — im Zweifel bleibt eine Lücke, statt falsch rot zu werden
// (Vorbild `archiv/3576/runde-1/RUECKGABE.md:67`, Grenze i):
//   (i)   Ein Sollwert, der erst zur LAUFZEIT entsteht (`expect(adresse()).toBe(vorher)` mit einer
//         gelesenen Größe), ist im Baum nicht auflösbar. Er zählt NICHT. Eigenproben VI, X, XII, XIII.
//   (ii)  `toContain`, `toMatch` und Freunde behaupten nicht die GANZE Adresse; sie sind kein Fehler
//         dieser Art und werden nicht erhoben. Geprüft werden die Gleichheitsvergleiche.
//   (iii) Geht die Sonde oder der Helfer über Modulgrenzen (eine Hülle in einer zweiten Datei), sieht
//         die Erhebung den Zusammenhang nicht. Sie arbeitet je Datei — und ein importierter Sollwert
//         ist deshalb unbekannt, nicht etwa ein Pfad (Eigenprobe XXIV).
//   (iv)  Ein Name, der im INNERSTEN geltenden Bereich mehrfach gebunden ist, ist mehrdeutig und
//         liefert keine Aussage. Aufgelöst werden Blöcke, Funktionsrümpfe (`var`), Schleifenköpfe und
//         die Dateiebene; NICHT aufgelöst werden `with`, `eval` und die Reihenfolge innerhalb eines
//         Bereichs (die zeitliche Totzone vor einer `let`-Deklaration). Was die Erhebung an einer
//         Stelle nicht entscheiden kann, endet bei „unbekannt" — also bei einer Lücke.
// Keine dieser Grenzen macht den Wächter falsch rot; jede macht ihn an einer Stelle blind, und das
// steht hier, damit es nicht als Deckung missverstanden wird. Diese Zeile war in Runde 2 zu stark
// formuliert („nie zu einem falschen Befund", obwohl drei Formen genau das taten); sie steht jetzt
// nur noch für das, was mit Eigenproben belegt ist.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WURZEL = process.cwd();
const TESTS = join(WURZEL, "tests");

/** Verzeichnisse, die der Gang nie betritt (Vorbild: `tests/tor-inventar/browser-gruppe.ts`). */
const NICHT_BETRETEN = new Set(["node_modules", "dist", ".git", "coverage", ".local"]);

/** Gleichheitsvergleiche — nur sie behaupten die GANZE Adresse (Grenze ii oben). */
const GLEICHHEIT = new Set(["toBe", "toEqual", "toStrictEqual"]);

// ==================================================================================================
// DER ALTBESTAND — WAS JOB 3611 GEZÄHLT, ABER AUFTRAGSGEMÄSS NICHT UMGEBAUT HAT.
// ==================================================================================================
//
// AUFTRAG §10 ist eindeutig: umgebaut werden die zwei Fundstellen aus §2, die übrigen werden
// „gezählt und in den Altbestand geschrieben; das ist die Folgezeile für die Steuerung". Die Zeilen
// stammen aus der Messung am Basisstand `4dfc4f0` und stehen hier als AUSKUNFT — wer aufräumt, weiß
// damit, wohin er sieht.
//
// DIE SCHRANKE GEHT IN BEIDE RICHTUNGEN:
//   · Eine Datei, die NICHT hier steht und einen Befund trägt, macht V1 rot (auch ein neuer Ordner).
//   · Eine Datei, die hier steht und KEINEN Befund mehr trägt, macht V2 rot — sonst verwaltet das
//     Register Gespenster (die Lehre aus JOB 3550/3562: ein Wächter, der nichts mehr sieht, ist grün
//     und nutzlos).
//   · Die Schuld darf nicht WACHSEN: mehr Befunde als eingetragene Zeilen machen V3 rot.
// GEPRÜFT WIRD DIE ANZAHL, NICHT DIE ZEILENNUMMER. Das ist eine Entscheidung mit Grund: eine
// Zeilennummer verschiebt sich bei jeder fremden Änderung in derselben Datei, und ein Wächter, der
// bei jeder Bewegung schreit, wird abgeschaltet (`tests/app/mega89-paarungsstellen-sammler.test.ts`).
// Die Anzahl ist gegen fremde Bewegung stabil und gegen neue Schuld empfindlich.
interface Altfall {
  /** Die am Basisstand gemessenen Zeilen — Auskunft, und die Obergrenze der zugestandenen Schuld. */
  readonly zeilen: readonly number[];
  readonly grund: string;
}

const ALTBESTAND: ReadonlyMap<string, Altfall> = new Map([
  [
    "tests/app/navguard-pop-mounted.test.tsx",
    {
      zeilen: [
        257, 364, 384, 398, 400, 410, 414, 423, 434, 440, 460, 464, 480, 492, 503, 513, 520, 532,
        538, 555,
      ],
      grund:
        "Der größte Schuldner im Bestand (20 Paarungen über `path()`, Sonde `:82`). AUFTRAG §10 " +
        "stellt `tests/app/**` ausdrücklich nach draußen; ein Umbau dieser Größe ist eine eigene Zeile.",
    },
  ],
  [
    "tests/entwuerfe-verwalten/blatt-entwuerfe-verwalten.test.tsx",
    {
      zeilen: [584, 624, 775, 819],
      grund:
        "AUFTRAG §10 nennt `tests/entwuerfe-verwalten/**` namentlich als nicht Teil des Auftrags.",
    },
  ],
  [
    "tests/entwuerfe-menuepunkt/kopfband-und-uebersicht.test.tsx",
    {
      zeilen: [425, 433],
      grund:
        "AUFTRAG §10: `tests/entwuerfe-menuepunkt/**` hält JOB 3605 — keine zwei Bahnen auf eine Datei.",
    },
  ],
  [
    "tests/entwuerfe-menuepunkt/gehe-zu-im-kopfband.test.tsx",
    {
      zeilen: [369],
      grund: "AUFTRAG §10: `tests/entwuerfe-menuepunkt/**` hält JOB 3605.",
    },
  ],
  [
    "tests/entwuerfe-menuepunkt/weg-in-den-editor.test.tsx",
    {
      zeilen: [413],
      grund: "AUFTRAG §10: `tests/entwuerfe-menuepunkt/**` hält JOB 3605.",
    },
  ],
  [
    "tests/d1-meine-entwuerfe/blatt-zugang-und-liste.test.tsx",
    {
      zeilen: [446],
      grund:
        "Erst durch diese Messung gefunden; die Liste in AUFTRAG §2 ist ausdrücklich ein „u. a.“. " +
        "Außerhalb der abschließenden Zielpfade aus §4, deshalb gezählt statt umgebaut.",
    },
  ],
  [
    "tests/import-einstieg/einschritt-mounted.test.tsx",
    {
      zeilen: [221],
      grund:
        "Erst durch diese Messung gefunden, und zwar über die zweite Aliasform: die Sonde SCHREIBT " +
        "die zusammengesetzte Adresse in eine Modulvariable (`:83`). Außerhalb der Zielpfade aus §4.",
    },
  ],
]);

// ==================================================================================================
// DIE ZWEI FUNDSTELLEN DIESES AUFTRAGS — SIE SIND REPARIERT UND DÜRFEN NIE IN DEN ALTBESTAND.
// ==================================================================================================
// AUFTRAG §8.5: „der Wächter wird NICHT dadurch grün gemacht, dass Stellen in den Altbestand
// wandern, die dieser Auftrag reparieren soll". V4 nagelt beides fest: kein Befund, kein Eintrag.
const PFLICHT_SAUBER = [
  "tests/entwurf-fortsetzen/blatt-entwurf-fortsetzen.test.tsx",
  "tests/capture/frontdoor-navguard-exits-mounted.test.tsx",
] as const;

// ---- Quelltextgang -------------------------------------------------------------------------------

function gehe(ordner: string, hinein: string[]): string[] {
  for (const eintrag of readdirSync(ordner)) {
    if (NICHT_BETRETEN.has(eintrag) || eintrag.startsWith(".")) {
      continue;
    }
    const pfad = join(ordner, eintrag);
    if (statSync(pfad).isDirectory()) {
      gehe(pfad, hinein);
    } else if (eintrag.endsWith(".ts") || eintrag.endsWith(".tsx")) {
      hinein.push(pfad);
    }
  }
  return hinein;
}

/** Ein Pfad in der Schreibweise, in der `git` und die Register ihn führen. */
function alsPosix(absolut: string): string {
  return relative(WURZEL, absolut).split("\\").join("/");
}

function baumVon(datei: string, quelle: string): ts.SourceFile {
  return ts.createSourceFile(
    datei,
    quelle,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    datei.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

/** Jeder Knoten des Baums, einmal. */
function knoten(wurzel: ts.Node): ts.Node[] {
  const alle: ts.Node[] = [];
  const gang = (n: ts.Node): void => {
    alle.push(n);
    n.forEachChild(gang);
  };
  gang(wurzel);
  return alle;
}

function zeileVon(sf: ts.SourceFile, n: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
}

// ---- (a) Die Zusammensetzung ---------------------------------------------------------------------

/** Alle Feldnamen, die im Teilbaum als ECHTER Zugriff vorkommen (`.pathname`, `["search"]`). */
function zugriffsnamen(n: ts.Node): Set<string> {
  const namen = new Set<string>();
  for (const k of knoten(n)) {
    if (ts.isPropertyAccessExpression(k)) {
      namen.add(k.name.text);
    } else if (ts.isElementAccessExpression(k) && k.argumentExpression !== undefined) {
      const arg = k.argumentExpression;
      if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) {
        namen.add(arg.text);
      }
    }
  }
  return namen;
}

/**
 * Eine ZUSAMMENSETZUNG: ein Schablonenliteral oder eine `+`-Verkettung, in der `pathname` UND
 * `search` als Zugriff vorkommen (ein zusätzliches `hash` ändert nichts). Genau diese Form macht
 * aus zwei verschiedenen Aussagen eine Zeichenkette.
 */
function istZusammensetzung(n: ts.Node): boolean {
  const verkettet =
    ts.isTemplateExpression(n) ||
    (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken);
  if (!verkettet) {
    return false;
  }
  const namen = zugriffsnamen(n);
  return namen.has("pathname") && namen.has("search");
}

/** Der Name der Funktion, in der ein Knoten wohnt — oder `null` im Modulrumpf. */
function huelleVon(n: ts.Node): string | null {
  let p: ts.Node | undefined = n.parent;
  while (p) {
    if (ts.isFunctionDeclaration(p) && p.name) {
      return p.name.text;
    }
    if (
      (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) &&
      p.parent &&
      ts.isVariableDeclaration(p.parent) &&
      ts.isIdentifier(p.parent.name)
    ) {
      return p.parent.name.text;
    }
    p = p.parent;
  }
  return null;
}

// ---- Gültigkeitsbereiche -------------------------------------------------------------------------
//
// Gebraucht für bens Korrekturpflicht 2. Der Bereich einer Deklaration ist der nächste umschließende
// Block (jeder Funktionsrumpf, jeder `it`/`describe`-Rumpf ist einer), sonst die Datei. Ein
// Pfeilausdruck ohne Block kann keine Deklaration enthalten und braucht deshalb keinen eigenen Fall.
function bereichVon(n: ts.Node): ts.Node {
  let p: ts.Node | undefined = n.parent;
  while (p) {
    if (
      ts.isSourceFile(p) ||
      ts.isBlock(p) ||
      ts.isModuleBlock(p) ||
      ts.isCaseBlock(p) ||
      ts.isForStatement(p) ||
      ts.isForOfStatement(p) ||
      ts.isForInStatement(p)
    ) {
      return p;
    }
    p = p.parent;
  }
  return n.getSourceFile();
}

/** Ein Knoten mit eigenem Funktionsbereich — die Grenze, hinter der `var` nicht mehr gilt. */
function istFunktionsknoten(n: ts.Node): boolean {
  return (
    ts.isFunctionDeclaration(n) ||
    ts.isFunctionExpression(n) ||
    ts.isArrowFunction(n) ||
    ts.isMethodDeclaration(n) ||
    ts.isConstructorDeclaration(n) ||
    ts.isGetAccessorDeclaration(n) ||
    ts.isSetAccessorDeclaration(n)
  );
}

/**
 * Der FUNKTIONSbereich — für `var`, das nicht am Block endet (JOB 3611 R3, bens Probe 3). Ein
 * `var ziel` in einem `if`-Block gilt im ganzen Rumpf und überschattet dort jede äußere Konstante.
 */
function funktionsbereichVon(n: ts.Node): ts.Node {
  let p: ts.Node | undefined = n.parent;
  while (p) {
    if (istFunktionsknoten(p) || ts.isSourceFile(p)) {
      return p;
    }
    p = p.parent;
  }
  return n.getSourceFile();
}

/** Jeder Name, den ein Bindungsmuster einführt (`{a, b: c}`, `[d, ...e]`, oder schlicht `f`). */
function namenAus(name: ts.BindingName, hinein: string[]): string[] {
  if (ts.isIdentifier(name)) {
    hinein.push(name.text);
    return hinein;
  }
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) {
      namenAus(element.name, hinein);
    }
  }
  return hinein;
}

/** Liegt `n` innerhalb von `bereich`? Gemessen an den Positionen, nicht am Namen. */
function umschliesst(bereich: ts.Node, n: ts.Node): boolean {
  return bereich.pos <= n.pos && n.end <= bereich.end;
}

/** Der engste der übergebenen Bereiche — der, der am spätesten beginnt. */
function innerster(bereiche: readonly ts.Node[]): ts.Node | undefined {
  let beste: ts.Node | undefined;
  for (const b of bereiche) {
    if (beste === undefined || b.pos > beste.pos) {
      beste = b;
    }
  }
  return beste;
}

function eigenschaftsname(name: ts.PropertyName): string {
  if (ts.isStringLiteral(name) || ts.isIdentifier(name)) {
    return name.text;
  }
  return "";
}

/** Die `data-testid`, unter der eine Zusammensetzung in den Baum gerendert wird. */
function testIdsUm(n: ts.Node): string[] {
  const ids: string[] = [];
  let p: ts.Node | undefined = n.parent;
  let tiefe = 0;
  while (p && tiefe < 6) {
    if (ts.isCallExpression(p)) {
      for (const arg of p.arguments) {
        if (!ts.isObjectLiteralExpression(arg)) {
          continue;
        }
        for (const eigenschaft of arg.properties) {
          if (!ts.isPropertyAssignment(eigenschaft)) {
            continue;
          }
          const name = eigenschaftsname(eigenschaft.name);
          if (name === "data-testid" && ts.isStringLiteral(eigenschaft.initializer)) {
            ids.push(eigenschaft.initializer.text);
          }
        }
      }
      if (ids.length > 0) {
        return ids;
      }
    }
    if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p)) {
      const auf = ts.isJsxElement(p) ? p.openingElement : p;
      for (const attribut of auf.attributes.properties) {
        if (!ts.isJsxAttribute(attribut) || attribut.name.getText() !== "data-testid") {
          continue;
        }
        const wert = attribut.initializer;
        if (wert && ts.isStringLiteral(wert)) {
          ids.push(wert.text);
        } else if (
          wert &&
          ts.isJsxExpression(wert) &&
          wert.expression &&
          ts.isStringLiteral(wert.expression)
        ) {
          ids.push(wert.expression.text);
        }
      }
      if (ids.length > 0) {
        return ids;
      }
    }
    p = p.parent;
    tiefe += 1;
  }
  return ids;
}

// ---- Die Erhebung je Datei -----------------------------------------------------------------------

interface Zusammensetzung {
  readonly datei: string;
  readonly zeile: number;
  readonly quelltext: string;
}

interface Befund {
  readonly datei: string;
  readonly zeile: number;
  readonly negiert: boolean;
  readonly soll: string;
  readonly quelltext: string;
}

interface Erhebung {
  readonly zusammensetzungen: Zusammensetzung[];
  readonly befunde: Befund[];
}

function erhebe(datei: string, quelle: string): Erhebung {
  const sf = baumVon(datei, quelle);
  const alle = knoten(sf);

  // --- (a) Wo wird zusammengesetzt, und was greift danach darauf zu? ------------------------------
  const zusammensetzungen: Zusammensetzung[] = [];
  const testIds = new Set<string>();
  /** Funktionen, die selbst zusammensetzen — ihr Rückgabewert IST die zusammengesetzte Adresse. */
  const adressquellen = new Set<string>();
  // Größen, die eine zusammengesetzte Adresse halten, stehen NICHT in einer eigenen Menge: sie
  // werden an ihrer Benutzungsstelle über `bindungenAn` aufgelöst, weil derselbe Name in zwei Fällen
  // Verschiedenes halten kann (JOB 3611 R2, bens Korrekturpflicht 2).

  for (const n of alle) {
    if (!istZusammensetzung(n)) {
      continue;
    }
    // Die äußerste Zusammensetzung zählt, nicht jede Teilverkettung darin.
    if (n.parent && istZusammensetzung(n.parent)) {
      continue;
    }
    zusammensetzungen.push({
      datei,
      zeile: zeileVon(sf, n),
      quelltext: n.getText(sf).replace(/\s+/g, " "),
    });
    for (const id of testIdsUm(n)) {
      testIds.add(id);
    }
    const huelle = huelleVon(n);
    if (huelle !== null) {
      adressquellen.add(huelle);
    }
  }

  // Leser der Sonde: jede Funktion, die einen zusammengesetzten Knoten über `querySelector` holt.
  // Das ist die Kette, die den Fehler trägt: Sonde → Helfer → Vergleich.
  if (testIds.size > 0) {
    // GANZE KENNUNG, nicht Teilzeichenkette: `loc` darf nicht auch `[data-testid=loc-pfad]` treffen.
    // Gemessen an der Gegenprobe b dieser Runde — dort zog die zusammengesetzte Kennung `loc` den
    // Helfer der GETEILTEN Knoten mit herein und der Wächter meldete eine Stelle, die richtig ist.
    // Ein Wächter, der Richtiges meldet, wird abgeschaltet; deshalb hier die Wortgrenze.
    const gesucht = [...testIds].map((id) => {
      const roh = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^\\w-])${roh}([^\\w-]|$)`);
    });
    for (const n of alle) {
      if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) {
        continue;
      }
      const ruf = n.expression.name.text;
      if (ruf !== "querySelector" && ruf !== "querySelectorAll") {
        continue;
      }
      const arg = n.arguments[0];
      if (arg === undefined) {
        continue;
      }
      const selektor =
        ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg) ? arg.text : null;
      if (selektor === null || !gesucht.some((muster) => muster.test(selektor))) {
        continue;
      }
      const huelle = huelleVon(n);
      if (huelle !== null) {
        adressquellen.add(huelle);
      }
    }
  }

  // --- Auflösung von Sollwerten und Aliasen ------------------------------------------------------
  //
  // EIN VERZEICHNIS, ABER JEDER EINTRAG KENNT SEINEN GÜLTIGKEITSBEREICH (JOB 3611 R2, bens
  // Korrekturpflicht 2). Vorher stand hier eine Tabelle NAME → WERT über die ganze Datei, die den
  // ERSTEN gleichnamigen Eintrag nahm. Das war falsch und gemessen falsch: deklarieren zwei Fälle
  // derselben Datei je ein `const ziel`, entschied das `ziel` des ERSTEN Falls über den Vergleich des
  // ZWEITEN — ein gültiger Volladressvergleich wurde dadurch als Pfadvergleich gemeldet.
  //
  // JETZT gilt: ein Name wird an der STELLE aufgelöst, an der er benutzt wird. Kandidat ist jede
  // Bindung, deren Gültigkeitsbereich die Benutzung umschließt; es zählt der INNERSTE. Bleiben dort
  // mehrere, ist der Name mehrdeutig und es gibt KEINE Aussage — nicht die erste Vermutung.
  //
  // WOFÜR DIE ZWEI FRAGEN STEHEN:
  //   · „Hält dieser Name eine zusammengesetzte Adresse?" — dafür zählt JEDE Schreibung, auch die
  //     nachträgliche `x = …` (`tests/import-einstieg/einschritt-mounted.test.tsx:83` schreibt die
  //     Adresse aus der Sonde in eine Modulvariable; die Aliasform aus der Lehre JOB 3579 R1).
  //   · „Welcher Sollwert steht rechts im Vergleich?" — dafür zählt NUR `const` mit Initialisierung.
  //     Eine nachschreibbare Größe wäre eine Falle: bei `let ziel = ""; ziel = "/x?y";` stünde im
  //     Baum der Wert der Deklaration, und der Wächter läse „kein `?`", wo zur Laufzeit eines steht.
  //
  // UND DIE REGEL, DIE BEN IN RUNDE 2 ERZWUNGEN HAT: EINE INNERE BINDUNG SPERRT DIE ÄUSSERE, AUCH
  // WENN DIE ERHEBUNG IHREN WERT NICHT LESEN KANN. Runde 2 erfasste nur `const`/`let` mit Namen und
  // die Zuweisung; ein Parameter, eine Destrukturierung oder ein funktionsweit gültiges `var` waren
  // für sie unsichtbar — und weil sie unsichtbar waren, griff die Auflösung auf die gleichnamige
  // ÄUSSERE Konstante zurück, die an dieser Stelle längst überschattet ist. Bens Messung:
  // `const ziel = "/start"` draußen, `function pruefe(ziel: string)` drinnen → falscher Befund
  // `soll: "/start"`. Deshalb wird JEDE Bindungsform erfasst; die unlesbaren tragen `wert: null` und
  // machen den Namen an ihrer Stelle UNBEKANNT. Eigenproben XVIII–XX halten die drei Formen fest,
  // XXI–XXIII die Gegenrichtung (eine Bindung, die nicht überschattet, macht nicht blind).
  interface Bindung {
    readonly bereich: ts.Node;
    /** `null` = hier gebunden, Wert für die Erhebung nicht lesbar (Parameter, Muster, Import …). */
    readonly wert: ts.Expression | null;
    readonly konstant: boolean;
  }
  const bindungen = new Map<string, Bindung[]>();
  const merke = (name: string, b: Bindung): void => {
    const bisher = bindungen.get(name);
    if (bisher === undefined) {
      bindungen.set(name, [b]);
    } else {
      bisher.push(b);
    }
  };
  const merkeUnlesbar = (name: ts.BindingName, bereich: ts.Node): void => {
    for (const einzeln of namenAus(name, [])) {
      merke(einzeln, { bereich, wert: null, konstant: false });
    }
  };

  // ERSTER GANG: alle DEKLARATIONEN. Getrennt vom zweiten, weil `var` hochgezogen wird — eine
  // Zuweisung weiter oben in der Datei muss die weiter unten stehende Deklaration schon kennen.
  for (const n of alle) {
    if (ts.isParameter(n)) {
      // Der Bereich eines Parameters ist die FUNKTION selbst, samt Rumpf — nicht der Block darum.
      merkeUnlesbar(n.name, n.parent);
      continue;
    }
    if (ts.isVariableDeclaration(n)) {
      const traeger = n.parent;
      const liste = ts.isVariableDeclarationList(traeger) ? traeger : null;
      const konstant = liste !== null && (liste.flags & ts.NodeFlags.Const) !== 0;
      // `var` (und nur `var`) reicht über Blockgrenzen bis an den Funktionsrumpf.
      const hochgezogen = liste !== null && (liste.flags & ts.NodeFlags.BlockScoped) === 0;
      const bereich = ts.isCatchClause(traeger)
        ? traeger.block
        : hochgezogen
          ? funktionsbereichVon(n)
          : bereichVon(n);
      if (ts.isIdentifier(n.name) && n.initializer) {
        merke(n.name.text, { bereich, wert: n.initializer, konstant });
      } else {
        // Muster (`const { ziel } = …`) und Deklaration ohne Wert (`let ziel;`, `for (const x of …)`,
        // `catch (ziel)`) — gebunden, aber nicht lesbar.
        merkeUnlesbar(n.name, bereich);
      }
      continue;
    }
    if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name) {
      merke(n.name.text, { bereich: bereichVon(n), wert: null, konstant: false });
      continue;
    }
    if (ts.isImportSpecifier(n) || ts.isNamespaceImport(n)) {
      merke(n.name.text, { bereich: sf, wert: null, konstant: false });
      continue;
    }
    if (ts.isImportClause(n) && n.name) {
      merke(n.name.text, { bereich: sf, wert: null, konstant: false });
    }
  }

  // ZWEITER GANG: die Zuweisungen. Eine Zuweisung gehört zum Gültigkeitsbereich der DEKLARATION,
  // nicht zu dem der Zuweisung: `adresseJetzt = …` in einer Sonde schreibt die Modulvariable, die
  // weit außerhalb lebt.
  for (const n of alle) {
    if (
      !ts.isBinaryExpression(n) ||
      n.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
      !ts.isIdentifier(n.left)
    ) {
      continue;
    }
    const name = n.left.text;
    const deklariert = (bindungen.get(name) ?? []).filter((b) => umschliesst(b.bereich, n));
    const bereich = innerster(deklariert.map((b) => b.bereich)) ?? sf;
    merke(name, { bereich, wert: n.right, konstant: false });
  }

  /** Die Bindungen eines Namens, die an DIESER Stelle gelten — nur die des innersten Bereichs. */
  function bindungenAn(name: string, ort: ts.Node): Bindung[] {
    const drin = (bindungen.get(name) ?? []).filter((b) => umschliesst(b.bereich, ort));
    if (drin.length === 0) {
      return [];
    }
    const tiefste = innerster(drin.map((b) => b.bereich));
    return drin.filter((b) => b.bereich === tiefste);
  }

  /**
   * Der Sollwert eines Ausdrucks, oder `null` für „keine Aussage".
   *
   * UNBEKANNT HEISST NIEMALS „NACHGEWIESEN OHNE ABFRAGETEIL" (JOB 3611 R2, bens Korrekturpflicht 1).
   * Vorher ersetzte diese Funktion einen nicht auflösbaren Teil durch einen Platzhalter ohne `?` und
   * behandelte das Ergebnis danach als bewiesenen Pfad. Damit war `"/bibliothek" + suche()` ein
   * Befund, obwohl `suche()` genau den Abfrageteil liefert. Jetzt gilt: EIN unbekannter Teil macht
   * die ganze Verkettung unbekannt.
   */
  function loese(n: ts.Node, tiefe = 0): string | null {
    if (tiefe > 6) {
      return null;
    }
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      return n.text;
    }
    if (ts.isIdentifier(n)) {
      const gueltig = bindungenAn(n.text, n);
      // Mehrdeutig (zwei gleichnamige Bindungen im selben Bereich) oder nicht konstant → keine Aussage.
      if (gueltig.length !== 1) {
        return null;
      }
      const einzig = gueltig[0];
      // `wert === null`: der Name ist hier gebunden (Parameter, Muster, Import), aber sein Wert ist
      // nicht lesbar. UNBEKANNT — und niemals der äußere gleichnamige Wert (bens Korrekturpflicht 1).
      if (einzig === undefined || !einzig.konstant || einzig.wert === null) {
        return null;
      }
      return loese(einzig.wert, tiefe + 1);
    }
    if (ts.isParenthesizedExpression(n) || ts.isAsExpression(n) || ts.isNonNullExpression(n)) {
      return loese(n.expression, tiefe + 1);
    }
    if (ts.isTemplateExpression(n)) {
      let aus = n.head.text;
      for (const spanne of n.templateSpans) {
        const teil = loese(spanne.expression, tiefe + 1);
        if (teil === null) {
          return null;
        }
        aus += teil;
        aus += spanne.literal.text;
      }
      return aus;
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const links = loese(n.left, tiefe + 1);
      const rechts = loese(n.right, tiefe + 1);
      if (links === null || rechts === null) {
        return null;
      }
      return `${links}${rechts}`;
    }
    return null;
  }

  /** Hält dieser Ausdruck eine zusammengesetzte Adresse? */
  function haeltAdresse(w: ts.Expression): boolean {
    return (
      istZusammensetzung(w) ||
      (ts.isCallExpression(w) &&
        ts.isIdentifier(w.expression) &&
        adressquellen.has(w.expression.text))
    );
  }

  function istAdresse(n: ts.Node): boolean {
    if (istZusammensetzung(n)) {
      return true;
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
      return adressquellen.has(n.expression.text);
    }
    if (ts.isIdentifier(n)) {
      // Auch hier am Gültigkeitsbereich: ein `const jetzt = adresse()` in EINEM Fall macht das
      // gleichnamige `const jetzt = "/start"` eines ANDEREN Falls nicht zur Adresse.
      // Eine unlesbare Bindung (`wert === null`) hält keine nachweisbare Adresse — sie überschattet
      // die äußere und macht die Aussage damit UNBEKANNT, nicht wahr.
      return bindungenAn(n.text, n).some((b) => b.wert !== null && haeltAdresse(b.wert));
    }
    if (
      ts.isAwaitExpression(n) ||
      ts.isParenthesizedExpression(n) ||
      ts.isNonNullExpression(n) ||
      ts.isAsExpression(n)
    ) {
      return istAdresse(n.expression);
    }
    return false;
  }

  // --- (b) Die Paarung: zusammengesetzte Adresse GEGEN ein Literal ohne `?` ----------------------
  const befunde: Befund[] = [];
  for (const n of alle) {
    if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) {
      continue;
    }
    if (!GLEICHHEIT.has(n.expression.name.text)) {
      continue;
    }
    // Den `expect(...)`-Aufruf finden, auch durch `.not`, `.resolves` und Freunde hindurch.
    let kette: ts.Expression = n.expression.expression;
    let negiert = false;
    while (ts.isPropertyAccessExpression(kette)) {
      if (kette.name.text === "not") {
        negiert = true;
      }
      kette = kette.expression;
    }
    if (
      !ts.isCallExpression(kette) ||
      !ts.isIdentifier(kette.expression) ||
      kette.expression.text !== "expect"
    ) {
      continue;
    }
    const subjekt = kette.arguments[0];
    if (subjekt === undefined || !istAdresse(subjekt)) {
      continue;
    }
    const sollknoten = n.arguments[0];
    if (sollknoten === undefined) {
      continue;
    }
    const soll = loese(sollknoten);
    // Grenze (i): nicht auflösbar → keine Aussage. Mit `?` → eine ehrliche Volladress-Zusage.
    if (soll === null || soll.includes("?")) {
      continue;
    }
    befunde.push({
      datei,
      zeile: zeileVon(sf, n),
      negiert,
      soll,
      quelltext: n.getText(sf).replace(/\s+/g, " ").slice(0, 160),
    });
  }

  return { zusammensetzungen, befunde };
}

// ---- Die Erhebung über den ganzen Testbestand ----------------------------------------------------

const DATEIEN = gehe(TESTS, []);

const ERHEBUNG: Erhebung = (() => {
  const zusammensetzungen: Zusammensetzung[] = [];
  const befunde: Befund[] = [];
  for (const pfad of DATEIEN) {
    const quelle = readFileSync(pfad, "utf8");
    // Vorfilter: ohne das Wort kann es keinen Zugriff geben. Spart Bäume, ändert nichts am Urteil.
    if (!quelle.includes("pathname")) {
      continue;
    }
    const teil = erhebe(alsPosix(pfad), quelle);
    zusammensetzungen.push(...teil.zusammensetzungen);
    befunde.push(...teil.befunde);
  }
  return { zusammensetzungen, befunde };
})();

function zeige(b: Befund): string {
  return `${b.datei}:${b.zeile} → ${b.quelltext}`;
}

// ==================================================================================================
// DIE EIGENPROBEN — KALIBRIERUNG AN AUSGESCHRIEBENEN BEISPIELQUELLTEXTEN.
// ==================================================================================================
// Die Proben stehen als Zeichenketten da, nicht als Dateien: so ist der erwartete Befund neben dem
// Quelltext ablesbar. Die Zeilen sind bewusst einzeln aufgeführt und mit "\n" verbunden, damit in
// DIESER Datei selbst kein `pathname`-Zugriff und kein `expect`-Aufruf entsteht — der Wächter sieht
// sich selbst an (V5) und muss sauber bleiben.
const SONDE_EINS = [
  "function Sonde() {",
  "  const loc = useLocation();",
  '  return createElement("span", { "data-testid": "ort" }, `${loc.pathname}${loc.search}`);',
  "}",
  "function adresse() {",
  '  return container.querySelector(\'[data-testid="ort"]\')?.textContent ?? "";',
  "}",
].join("\n");

interface Eigenprobe {
  readonly name: string;
  readonly quelle: string;
  /** Wie viele Befunde die Erhebung finden MUSS. */
  readonly erwartet: number;
  /** Wie viele Zusammensetzungen (a) sie finden muss. */
  readonly erwarteteZusammensetzungen: number;
}

const EIGENPROBEN: readonly Eigenprobe[] = [
  {
    name: "I · setzt zusammen und prüft gegen eine VOLLE Adresse → kein Befund",
    quelle: [
      SONDE_EINS,
      'it("die Bibliothek trägt den Begriff", () => {',
      '  expect(adresse()).toBe("/bibliothek?q=Ventil");',
      "});",
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "II · setzt zusammen und prüft gegen einen PFAD → erkannt",
    quelle: [
      SONDE_EINS,
      'it("die Route steht still", () => {',
      '  expect(adresse()).toBe("/bibliothek");',
      "});",
    ].join("\n"),
    erwartet: 1,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "III · die Paarung steht nur im KOMMENTAR → nicht erkannt",
    quelle: [
      SONDE_EINS,
      "// Bis JOB 3559 stand hier `${loc.pathname}${loc.search}` und darunter",
      '// expect(adresse()).toBe("/bibliothek") — genau diese Paarung ist der Fehler.',
      'it("die Route steht still", () => {',
      '  expect(adresse()).toBe("/bibliothek?q=Ventil");',
      "});",
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "IV · die Paarung steht nur im FALLTITEL → nicht erkannt",
    quelle: [
      SONDE_EINS,
      "it('expect(adresse()).toBe(\"/bibliothek\") bei `${loc.pathname}${loc.search}`', () => {",
      '  expect(adresse()).toBe("/bibliothek?q=Ventil");',
      "});",
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "V · die Paarung steht nur in einer ZEICHENKETTE → nicht erkannt",
    quelle: [
      SONDE_EINS,
      "const warnung = 'expect(adresse()).toBe(\"/bibliothek\") über `${loc.pathname}${loc.search}`';",
      'it("die Route steht still", () => {',
      "  expect(warnung.length).toBeGreaterThan(0);",
      '  expect(adresse()).toBe("/bibliothek?q=Ventil");',
      "});",
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "VI · Grenze (i): der Sollwert entsteht zur LAUFZEIT → nicht erkannt, Lücke statt Fehlalarm",
    quelle: [
      SONDE_EINS,
      'it("die Adresse bewegt sich nicht", () => {',
      "  const vorher = adresse();",
      "  expect(adresse()).toBe(vorher);",
      "});",
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "VII · die RICHTIGE Form (JOB 3559): zwei Knoten, zwei Helfer → kein Befund, keine Zusammensetzung",
    quelle: [
      "function Sonde() {",
      "  const ort = useLocation();",
      "  return createElement(",
      '    "span",',
      "    null,",
      '    createElement("span", { "data-testid": "ort-pfad", children: ort.pathname }),',
      '    createElement("span", { "data-testid": "ort-abfrage", children: ort.search }),',
      "  );",
      "}",
      "function routenPfad() {",
      '  const wert = container.querySelector(\'[data-testid="ort-pfad"]\')?.textContent ?? "";',
      '  if (wert.includes("?")) {',
      "    throw new Error(wert);",
      "  }",
      "  return wert;",
      "}",
      "function adresse() {",
      "  return {",
      "    pfad: routenPfad(),",
      '    abfrage: container.querySelector(\'[data-testid="ort-abfrage"]\')?.textContent ?? "",',
      "  };",
      "}",
      'it("die Route steht still UND die Adresse trägt den Begriff", () => {',
      '  expect(routenPfad()).toBe("/bibliothek");',
      '  expect(adresse()).toEqual({ pfad: "/bibliothek", abfrage: "?q=Ventil" });',
      "});",
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 0,
  },
  {
    name: "VIII · dieselbe Paarung über eine Aliasgröße → erkannt (Lehre JOB 3579 R1)",
    quelle: [
      SONDE_EINS,
      'it("die Route steht still", () => {',
      "  const jetzt = adresse();",
      '  expect(jetzt).toBe("/bibliothek");',
      "});",
    ].join("\n"),
    erwartet: 1,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "IX · die Sonde SCHREIBT in eine Modulvariable → erkannt (die Form aus tests/import-einstieg)",
    quelle: [
      'let adresseJetzt = "";',
      "function Sonde() {",
      "  const ort = useLocation();",
      "  adresseJetzt = `${ort.pathname}${ort.search}`;",
      "  return null;",
      "}",
      'it("der Parameter ist aus der Adresse verschwunden", () => {',
      '  expect(adresseJetzt).toBe("/erfassen");',
      "});",
    ].join("\n"),
    erwartet: 1,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "XI · geteilte Knoten NEBEN einem zusammengesetzten → nur der zusammengesetzte zählt",
    quelle: [
      "function Sonde() {",
      "  const ort = useLocation();",
      "  return createElement(",
      '    "span",',
      "    null,",
      '    createElement("span", { "data-testid": "ort", children: `${ort.pathname}${ort.search}` }),',
      '    createElement("span", { "data-testid": "ort-pfad", children: ort.pathname }),',
      '    createElement("span", { "data-testid": "ort-abfrage", children: ort.search }),',
      "  );",
      "}",
      "function adresse() {",
      '  return container.querySelector(\'[data-testid="ort"]\')?.textContent ?? "";',
      "}",
      "function routenPfad() {",
      '  return container.querySelector(\'[data-testid="ort-pfad"]\')?.textContent ?? "";',
      "}",
      'it("die Route steht still UND die Adresse trägt den Begriff", () => {',
      '  expect(adresse()).toBe("/bibliothek?q=Ventil");',
      '  expect(routenPfad()).toBe("/bibliothek");',
      "});",
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "X · der Sollwert ist eine NACHGESCHRIEBENE Größe → nicht erkannt, kein falscher Befund",
    quelle: [
      SONDE_EINS,
      'let ziel = "";',
      'it("die Adresse trägt den Begriff", () => {',
      '  ziel = "/bibliothek?q=Ventil";',
      "  expect(adresse()).toBe(ziel);",
      "});",
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 1,
  },

  // ================================================================================================
  // XII–XVII · JOB 3611 RUNDE 2 — DIE ZWEI FEHLER, DIE BEN GEMESSEN HAT, UND IHRE GEGENRICHTUNG.
  // ================================================================================================
  // XII/XIII sind bens Gegenbeispiele zu Korrekturpflicht 1 wörtlich, XIV/XV die zu Korrekturpflicht
  // 2 (in BEIDEN Reihenfolgen, weil der alte Fehler reihenfolgeabhängig war). XVI/XVII sind die
  // Gegenrichtung und mindestens so wichtig: eine Reparatur, die den Wächter blind macht, ist keine.
  {
    name: "XII · ein unbekannter Teil in einer `+`-Verkettung → KEIN Befund (bens Korrekturpflicht 1)",
    quelle: [
      SONDE_EINS,
      'function suche() { return "?q=Ventil"; }',
      'it("die Adresse trägt den Begriff", () => {',
      '  const ziel = "/bibliothek" + suche();',
      "  expect(adresse()).toBe(ziel);",
      "});",
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "XIII · ein unbekannter Teil in einer SCHABLONE → KEIN Befund (bens Korrekturpflicht 1)",
    quelle: [
      SONDE_EINS,
      'function suche() { return "?q=Ventil"; }',
      'it("die Adresse trägt den Begriff", () => {',
      "  const ziel = `/bibliothek${suche()}`;",
      "  expect(adresse()).toBe(ziel);",
      "});",
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "XIV · gleichnamige Konstanten in getrennten Fällen → der eigene Fall entscheidet",
    quelle: [
      SONDE_EINS,
      'it("A: die Seite nennt den Start", () => {',
      '  const ziel = "/start";',
      "  expect(container.textContent).toBe(ziel);",
      "});",
      'it("B: die Adresse trägt den Begriff", () => {',
      '  const ziel = "/bibliothek?q=Ventil";',
      "  expect(adresse()).toBe(ziel);",
      "});",
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "XV · dieselben zwei Fälle in umgekehrter Reihenfolge → weiterhin KEIN Befund",
    quelle: [
      SONDE_EINS,
      'it("B: die Adresse trägt den Begriff", () => {',
      '  const ziel = "/bibliothek?q=Ventil";',
      "  expect(adresse()).toBe(ziel);",
      "});",
      'it("A: die Seite nennt den Start", () => {',
      '  const ziel = "/start";',
      "  expect(container.textContent).toBe(ziel);",
      "});",
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "XVI · GEGENRICHTUNG: eine auflösbare Konstante im eigenen Fall wird weiter erkannt",
    quelle: [
      SONDE_EINS,
      'it("A: die Adresse trägt den Begriff", () => {',
      '  const ziel = "/bibliothek?q=Ventil";',
      "  expect(adresse()).toBe(ziel);",
      "});",
      'it("B: die Route steht still", () => {',
      '  const ziel = "/bibliothek";',
      "  expect(adresse()).toBe(ziel);",
      "});",
    ].join("\n"),
    erwartet: 1,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "XVII · GEGENRICHTUNG: eine Aliasgröße aus einem FREMDEN Fall macht keine Adresse",
    quelle: [
      SONDE_EINS,
      'it("A: die Adresse bewegt sich nicht", () => {',
      "  const jetzt = adresse();",
      '  expect(jetzt).toBe("/bibliothek?q=Ventil");',
      "});",
      'it("B: ein gleichnamiger Name, aber kein Adressträger", () => {',
      '  const jetzt = "/start";',
      '  expect(jetzt).toBe("/start");',
      "});",
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 1,
  },

  // ================================================================================================
  // XVIII–XXIII · JOB 3611 RUNDE 3 — EINE INNERE BINDUNG SPERRT DIE ÄUSSERE, AUCH EINE UNLESBARE.
  // ================================================================================================
  // Runde 2 hat die Bereiche aufgelöst, aber nur für die Bindungsformen, die sie SELBST erfasst hat
  // (`const`/`let` mit Namen, Zuweisung). Ben hat daraus drei falsche Befunde gemessen: wo der Name
  // durch einen Parameter, eine Destrukturierung oder ein funktionsweit gültiges `var` überschattet
  // war, sah die Erhebung die innere Bindung nicht — und griff auf die äußere gleichnamige Konstante
  // zurück, die dort gar nicht mehr gilt. XVIII–XX sind seine drei Proben wörtlich. XXI–XXIII sind
  // die Gegenrichtung: eine Bindung, die NICHT überschattet, darf den Wächter auch nicht blind machen.
  {
    name: "XVIII · ein PARAMETER überschattet die äußere Pfadkonstante → KEIN Befund (bens Probe 1)",
    quelle: [
      SONDE_EINS,
      'const ziel = "/start";',
      "function pruefe(ziel: string) {",
      "  expect(adresse()).toBe(ziel);",
      "}",
      'pruefe("/bibliothek?q=Ventil");',
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "XIX · eine DESTRUKTURIERUNG überschattet die äußere Pfadkonstante → KEIN Befund (bens Probe 2)",
    quelle: [
      SONDE_EINS,
      'const ziel = "/start";',
      'it("voll", () => {',
      '  const { ziel } = { ziel: "/bibliothek?q=Ventil" };',
      "  expect(adresse()).toBe(ziel);",
      "});",
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "XX · `var` gilt im ganzen FUNKTIONSRUMPF, nicht nur im inneren Block → KEIN Befund (bens Probe 3)",
    quelle: [
      SONDE_EINS,
      'const ziel = "/start";',
      "function pruefe() {",
      '  if (true) { var ziel = "/bibliothek?q=Ventil"; }',
      "  expect(adresse()).toBe(ziel);",
      "}",
      "pruefe();",
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "XXI · GEGENRICHTUNG: ein Parameter mit ANDEREM Namen macht nicht blind → weiterhin erkannt",
    quelle: [
      SONDE_EINS,
      "function zeige(erwartet: string) {",
      "  expect(container.textContent).toBe(erwartet);",
      "}",
      'it("die Route steht still", () => {',
      '  const ziel = "/bibliothek";',
      '  zeige("Bibliothek");',
      "  expect(adresse()).toBe(ziel);",
      "});",
    ].join("\n"),
    erwartet: 1,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "XXII · GEGENRICHTUNG: eine Destrukturierung mit ANDEREM Namen macht nicht blind → weiterhin erkannt",
    quelle: [
      SONDE_EINS,
      'it("die Route steht still", () => {',
      '  const { begriff } = { begriff: "Ventil" };',
      '  const ziel = "/bibliothek";',
      "  expect(begriff.length).toBeGreaterThan(0);",
      "  expect(adresse()).toBe(ziel);",
      "});",
    ].join("\n"),
    erwartet: 1,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "XXIII · GEGENRICHTUNG: ein `var` in einer FREMDEN Funktion überschattet nicht → weiterhin erkannt",
    quelle: [
      SONDE_EINS,
      "function andere() {",
      '  var ziel = "/bibliothek?q=Ventil";',
      "  return ziel;",
      "}",
      'it("die Route steht still", () => {',
      '  const ziel = "/bibliothek";',
      "  expect(andere().length).toBeGreaterThan(0);",
      "  expect(adresse()).toBe(ziel);",
      "});",
    ].join("\n"),
    erwartet: 1,
    erwarteteZusammensetzungen: 1,
  },
  {
    name: "XXIV · ein IMPORTIERTER Sollwert ist über die Modulgrenze nicht lesbar → KEIN Befund (Grenze iii)",
    quelle: [
      'import { ZIEL } from "./fixtures";',
      SONDE_EINS,
      'it("die Route steht still", () => {',
      "  expect(adresse()).toBe(ZIEL);",
      "});",
    ].join("\n"),
    erwartet: 0,
    erwarteteZusammensetzungen: 1,
  },
];

const KALIBRIERDATEI = "tests/adresse-ist-kein-pfad/<eigenprobe>.test.tsx";

// ==================================================================================================
describe("JOB 3611 · eine Adresse ist kein Pfad: keine zusammengesetzte Adresse gegen einen Pfad", () => {
  it("V1 · jede Paarung ist entweder weg oder namentlich im Altbestand", () => {
    for (const b of ERHEBUNG.befunde) {
      console.info(`JOB 3611 · Befund: ${zeige(b)} [soll=${b.soll}]`);
    }
    const unerlaubt = ERHEBUNG.befunde.filter((b) => !ALTBESTAND.has(b.datei));
    expect(
      unerlaubt.map(zeige),
      "Hier wird eine aus `pathname` UND `search` ZUSAMMENGESETZTE Adresse gegen ein Literal OHNE " +
        "`?` gestellt — das sieht wie eine Routenprüfung aus, behauptet aber stillschweigend „und " +
        'kein Abfrageteil" und wird dadurch zeitabhängig. Richtig sind ZWEI Sondenknoten und ZWEI ' +
        "Helfer (`routenPfad()` und ein `adresse()`, das beide Teile getrennt gibt); die Begründung " +
        "steht im Kopf dieser Datei, der Ursprung in " +
        "tests/app-sprachschalter/wechsel-ohne-verlust.test.tsx:120-138.",
    ).toEqual([]);
  });

  it("V2 · der Altbestand verwaltet keine Gespenster: jeder Eintrag trägt noch einen Befund", () => {
    for (const [datei, fall] of ALTBESTAND) {
      console.info(`JOB 3611 · Altbestand: ${datei} (${fall.zeilen.join(", ")}) — ${fall.grund}`);
    }
    // Ein Eintrag ohne Grund ist ein Freibrief. Die Liste ist die Folgezeile für die Steuerung;
    // wer eine Zeile einträgt, sagt auch, warum sie heute stehen bleibt.
    expect(
      [...ALTBESTAND].filter(([, fall]) => fall.grund.trim() === "" || fall.zeilen.length === 0),
      "Ein Altbestandseintrag nennt keinen Grund oder keine Zeile",
    ).toEqual([]);
    const mitBefund = new Set(ERHEBUNG.befunde.map((b) => b.datei));
    expect(
      [...ALTBESTAND.keys()].filter((d) => !mitBefund.has(d)),
      "Die Schuld dieser Dateien ist bezahlt (repariert oder verschwunden) — der Eintrag im " +
        "ALTBESTAND gehört gelöscht. Eine Altbestandsliste, die vergammelt, ist schlimmer als keine.",
    ).toEqual([]);
  });

  it("V3 · die zugestandene Schuld wächst nicht: kein Altfall bekommt neue Paarungen", () => {
    const gewachsen: string[] = [];
    for (const [datei, fall] of ALTBESTAND) {
      const anzahl = ERHEBUNG.befunde.filter((b) => b.datei === datei).length;
      if (anzahl > fall.zeilen.length) {
        gewachsen.push(`${datei}: ${anzahl} Paarungen, zugestanden sind ${fall.zeilen.length}`);
      }
    }
    expect(
      gewachsen,
      "In einer Altbestandsdatei ist eine NEUE Paarung entstanden. Der Altbestand deckt den " +
        "gemessenen Stand von JOB 3611, keine Fortschreibung.",
    ).toEqual([]);
  });

  it("V4 · die zwei Fundstellen aus AUFTRAG §2 sind sauber und stehen NICHT im Altbestand", () => {
    for (const datei of PFLICHT_SAUBER) {
      expect(
        ERHEBUNG.befunde.filter((b) => b.datei === datei).map(zeige),
        `${datei} ist von JOB 3611 umgebaut worden — hier darf keine Paarung zurückkehren`,
      ).toEqual([]);
      expect(
        ALTBESTAND.has(datei),
        `${datei} darf nicht in den Altbestand wandern: dieser Auftrag hat sie repariert`,
      ).toBe(false);
      expect(
        ERHEBUNG.zusammensetzungen.filter((z) => z.datei === datei).map((z) => z.quelltext),
        `${datei} setzt wieder pathname und search zu EINER Zeichenkette zusammen`,
      ).toEqual([]);
    }
  });

  it("V5 · die Erhebung sieht wirklich hin (und sich selbst nicht falsch)", () => {
    // Ohne diesen Fall wären V1–V4 auch dann grün, wenn die Erhebung leergelaufen wäre — die
    // teuerste Art, einen Wächter zu verlieren (`LEHREN.md`, JOB 3489, 10.09. 09:21:13).
    expect(DATEIEN.length, "Der Verzeichnisgang hat den Testbaum nicht gefunden").toBeGreaterThan(
      500,
    );
    console.info(
      `JOB 3611 · ${DATEIEN.length} Testdateien, ${ERHEBUNG.zusammensetzungen.length} Zusammensetzungen, ${ERHEBUNG.befunde.length} Paarungen`,
    );
    expect(
      ERHEBUNG.zusammensetzungen.length,
      "Keine einzige Zusammensetzung gefunden — dann ist der Wächter blind, nicht grün",
    ).toBeGreaterThan(30);
    // Und diese Datei selbst: ihre Beispielquelltexte wohnen in Zeichenketten, also darf die
    // Erhebung hier nichts sehen. Das ist die Kalibrierung auf echtem Boden.
    const selbst = "tests/adresse-ist-kein-pfad/adresse-ist-kein-pfad.test.ts";
    expect(
      ERHEBUNG.befunde.filter((b) => b.datei === selbst).map(zeige),
      "Der Wächter hält seine eigenen Beispielquelltexte für Befunde",
    ).toEqual([]);
    expect(ERHEBUNG.zusammensetzungen.filter((z) => z.datei === selbst)).toEqual([]);
  });

  for (const probe of EIGENPROBEN) {
    it(`V6 · Eigenprobe ${probe.name}`, () => {
      const gemessen = erhebe(KALIBRIERDATEI, probe.quelle);
      const gefunden = gemessen.befunde.map((b) => b.quelltext).join(" | ");
      expect(
        gemessen.befunde.length,
        `Eigenprobe → gefunden: ${gefunden === "" ? "nichts" : gefunden}`,
      ).toBe(probe.erwartet);
      const gesetzt = gemessen.zusammensetzungen.map((z) => z.quelltext).join(" | ");
      expect(
        gemessen.zusammensetzungen.length,
        `Eigenprobe → Zusammensetzungen: ${gesetzt === "" ? "keine" : gesetzt}`,
      ).toBe(probe.erwarteteZusammensetzungen);
    });
  }
});
