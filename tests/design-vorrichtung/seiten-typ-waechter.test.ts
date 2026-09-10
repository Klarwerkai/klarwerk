// ================================================================================================
// JOB 3564 · DIE VORRICHTUNG BESCHREIBT DIE SEITE — EINMAL, IN `h4-harness.ts`, UND SONST NIRGENDS.
// ================================================================================================
//
// HERKUNFT. `archiv/3488/runde-2/RUECKGABE.md:66`, die Restschuld, die die Bahn von JOB 3488 selbst
// benannt hat: „`keyboard` gehört in die `Seite`-Typisierung von `tests/design/h4-harness.ts`,
// sobald die Datei frei ist — dann fällt der Cast in der neuen Testdatei weg." JOB 3488 ist LIVE
// (`1.0.0-beta.1.260`), die Datei war frei, JOB 3564 hat die Schuld bezahlt. Diese Datei sorgt
// dafür, dass sie nicht unbemerkt neu entsteht.
//
// WAS HIER GEPRÜFT WIRD, IST EINE KOPPLUNG UND KEIN SCHNAPPSCHUSS. Nicht „steht in Zeile 33 noch
// dasselbe wie heute", sondern: keine Datei unter `tests/`, die `tests/design/h4-harness.ts`
// importiert, reicht sich ein Feld der echten Playwright-Seite selbst nach, das die schlanke
// `Seite`-Typisierung der Vorrichtung nicht kennt — weder über ein Interface
// (`interface X extends Seite { … }`) noch über einen Cast (`seite() as unknown as X`). Die Liste
// der geprüften Dateien wird zur Laufzeit aus dem Baum erhoben, nicht gepflegt; ein neuer
// Verbraucher fällt von selbst hinein.
//
// WENN DIESER FALL ROT WIRD, ist die Antwort NIE „mein Interface in der Testdatei ist doch klein".
// Das Feld gehört in `export interface Seite` in `tests/design/h4-harness.ts` — schlank, nur was
// wirklich benutzt wird, mit einem Satz Begründung daneben. Danach ist dieser Fall von selbst grün
// (er liest `Seite` bei jedem Lauf neu), und die nächste Browserprüfung findet das Feld vor, statt
// sich eine eigene Typarbeit zu bauen. Genau das war der Gewinn von JOB 3564; er soll halten.
//
// ÜBER DEN SYNTAXBAUM, NICHT ÜBER ZEICHENKETTEN — dieselbe Doktrin wie
// `tests/tor-inventar/browser-gruppe.ts:20-29` und `tests/capture/aufrufer-waechter.test.ts`. Eine
// Textsuche träfe die Kopfkommentare dieser Dateien mit: sie BEGRÜNDEN die Aufweitungen wörtlich
// und wären dann ihr eigener Fund. Das ist auch die Promptverbesserung des Prüfers vom 10.09.
// (`LEHREN.md`, JOB 3489): „Die Quelltextprobe sucht nur in CODEZEILEN, nicht in Kommentaren."
// Kommentare kommen im AST gar nicht vor.
//
// KEIN BROWSER, KEINE NEUE STARTSTELLE. Diese Datei liest Quelltext und startet nichts. Sie
// importiert `h4-harness` ausdrücklich NICHT, sondern liest ihn als Text: ein Import zöge sie über
// die Importhülle in die serielle Browser-Gruppe (`tests/tor-inventar/browser-gruppe.ts`) und
// verschöbe den Bestandspin der Startstellen (`tor-bestand-vollstaendig.test.ts:314`, 25). Der
// bleibt unberührt.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const TESTS = join(WURZEL, "tests");

/** Die Vorrichtung, um die es geht — als Pfad UND als Importmuster. */
const HARNESS = "tests/design/h4-harness.ts";
const HARNESS_MUSTER = /(^|\/)design\/h4-harness(\.js)?$/;

/**
 * Die eigene Datei nimmt sich aus. Sie NENNT den Harness-Pfad (als Lesequelle), importiert ihn
 * aber nicht — sie fällt also ohnehin nicht in die Verbrauchermenge. Der Name steht hier trotzdem,
 * damit die Ausnahme benannt ist und nicht aus Versehen entsteht.
 */
const SELBST = "tests/design-vorrichtung/seiten-typ-waechter.test.ts";

/** Verzeichnisse, die der Gang nie betritt (Vorbild: `browser-gruppe.ts`). */
const NICHT_BETRETEN = new Set(["node_modules", "dist", ".git", ".local", "coverage"]);

// ==================================================================================================
// DER ALTBESTAND — WAS JOB 3564 GEZÄHLT, ABER AUFTRAGSGEMÄSS NICHT ANGEFASST HAT.
// ==================================================================================================
//
// Der Auftrag ging von EINEM Schuldner aus (der Datei von JOB 3488). Die Messung vor dem Bau fand
// SIEBEN. Zwei davon (`tests/bibliothek-schmal/telefon-chromium.test.ts`,
// `tests/berichtskopf-spruenge/kopf-sprung-in-chromium.test.ts`) brauchten nur `keyboard.press`;
// ihre Schuld ist mit der Aufnahme in `Seite` von selbst bezahlt, sie stehen deshalb NICHT hier.
// Die vier übrigen brauchen mehr, und AUFTRAG §10 ist eindeutig: „Ergibt die Messung aus §5.4
// weitere Dateien mit derselben Schuld, werden sie gezählt und benannt, nicht mit umgebaut."
//
// Also stehen sie hier — namentlich, mit genau den Feldern, die ihnen heute zugestanden werden.
// Das ist kein Freibrief, sondern eine Schranke in beide Richtungen:
//   · Ein Feld, das NICHT in der Zeile steht, macht diesen Fall rot — auch in einer alten Datei.
//   · Eine alte Datei, die ihre Aufweitung LOSWIRD, macht diesen Fall ebenfalls rot: dann gehört
//     der Eintrag weg, sonst verwaltet das Register Gespenster (die Lehre aus JOB 3550/3562: ein
//     Wächter, der nichts mehr sieht, ist grün und nutzlos).
// Wer eine dieser Zeilen abräumen will, trägt das Feld in `Seite` ein und löscht die Zeile.
const ALTBESTAND: ReadonlyMap<string, readonly string[]> = new Map([
  // Folgezeile 1: `mouse.click` und `setInputFiles` — echte Maus und echter Dateidialog.
  ["tests/anhang-upload-tastatur/foto-anhaengen-tastatur.test.ts", ["mouse", "setInputFiles"]],
  // Folgezeile 2: `reload` — das Neuladen der Seite im Word-Hilfe-Fall.
  ["tests/klara-webhilfe-schmal/klara-hilfe-chromium.test.ts", ["reload"]],
  // Folgezeile 3: `keyboard.type` — Tippen statt nur Tastendruck.
  ["tests/bibliothek-sichten/sichten-chromium.test.ts", ["keyboard.type"]],
  // Folgezeile 4: die breiteste Aufweitung im Bestand — Tippen, Klicken, Fokussieren, Auswählen,
  // Neuladen. Sie ist der eigentliche Kandidat für den nächsten Zug an dieser Vorrichtung.
  [
    "tests/quellen-anker-im-formular/belegstelle-ueberlebt-neuladen-chromium.test.ts",
    ["keyboard.type", "click", "focus", "selectOption", "reload"],
  ],
]);

/**
 * DIE PRÜFMENGE, FESTGENAGELT (Lehre vom 10.09., `LEHREN.md` JOB 3489 09:21:13: „Jede Testmenge,
 * die aus einer Laufzeitquelle abgeleitet wird, braucht einen eigenen `it` … der ihre erwartete
 * Größe festnagelt — sonst kann die ganze Prüfmenge lautlos auf null schrumpfen").
 *
 * Gemessen am Basisstand `00c2328`: `grep -rln "design/h4-harness" tests/` nennt 13 Dateien, aber
 * eine davon (`tests/tor-inventar/tor-bestand-vollstaendig.test.ts`) NENNT den Pfad nur in einem
 * Kommentar und in einer Pin-Liste — sie importiert ihn nicht und ist kein Verbraucher. Genau
 * dieser Unterschied ist der Grund für den Syntaxbaum: 12 Verbraucher, nicht 13.
 *
 * Die Zahl steht unten als Untergrenze und die NAMEN als Pflichtmenge — beides zusammen, weil
 * beides eine andere Frage beantwortet: die Untergrenze fängt eine leergelaufene Erhebung, die
 * Namen sagen, WELCHE Datei verschwunden ist. Ein NEUER Verbraucher darf dazukommen, ohne diesen
 * Fall rot zu machen (das ist keine Entscheidung, die gesehen werden muss) — bringt er eine
 * Aufweitung mit, ist er im Fall darüber rot, und genau dort gehört er hin.
 */
const ERWARTETE_VERBRAUCHER = [
  "tests/ablage-kontext/neuladen-in-chromium.test.ts",
  "tests/anhang-upload-tastatur/foto-anhaengen-tastatur.test.ts",
  "tests/berichtskopf-spruenge/kopf-sprung-in-chromium.test.ts",
  "tests/bibliothek-schmal/telefon-chromium.test.ts",
  "tests/bibliothek-scope-sprache/ortszeile-390px-browser.test.ts",
  "tests/bibliothek-sichten/sichten-chromium.test.ts",
  "tests/bibliothek-vorschau-aufklapper/vorschau-aufklapper-chromium.test.ts",
  "tests/bibliothek/job3068-deckung-sichtbar.test.tsx",
  "tests/klara-webhilfe-schmal/klara-hilfe-chromium.test.ts",
  "tests/quellen-anker-im-formular/belegstelle-ueberlebt-neuladen-chromium.test.ts",
  "tests/tor-bereitschaft/verzoegerte-antworten.test.ts",
  "tests/ux21-tablet-lesemodus/tablet-chromium.test.ts",
] as const;

// ---- Quelltextgang -------------------------------------------------------------------------------

function gehe(ordner: string, hinein: string[]): string[] {
  for (const eintrag of readdirSync(ordner)) {
    if (NICHT_BETRETEN.has(eintrag)) {
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

function baum(pfad: string): ts.SourceFile {
  return ts.createSourceFile(
    pfad,
    readFileSync(pfad, "utf8"),
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    pfad.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
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

/** Importiert diese Datei die Vorrichtung? Gemessen am Modulspezifizierer, nicht am Text. */
function istVerbraucher(sf: ts.SourceFile): boolean {
  return knoten(sf).some((n) => {
    const spez = ts.isImportDeclaration(n)
      ? n.moduleSpecifier
      : ts.isExportDeclaration(n)
        ? n.moduleSpecifier
        : undefined;
    return spez !== undefined && ts.isStringLiteral(spez) && HARNESS_MUSTER.test(spez.text);
  });
}

// ---- Felder eines Typs ---------------------------------------------------------------------------

/** Feldname → seine Unterfelder (leer, wenn der Feldtyp kein Objekt ist). */
type Felder = Map<string, string[]>;

const NICHT_AUFLOESBAR = "<Feldtyp nicht auflösbar>";

function namenVon(mitglied: ts.TypeElement, sf: ts.SourceFile): string | null {
  const name = mitglied.name;
  if (name === undefined) {
    return null;
  }
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : name.getText(sf);
}

/**
 * Die Felder EINES Typliterals oder EINER lokalen Deklaration — ohne das, was von `Seite` geerbt
 * wird. Geerbtes ist keine Aufweitung; nachgereichtes schon.
 */
function felderAus(
  mitglieder: readonly ts.TypeElement[],
  sf: ts.SourceFile,
  lokal: ReadonlyMap<string, ts.TypeNode | readonly ts.TypeElement[]>,
): Felder {
  const felder: Felder = new Map();
  for (const m of mitglieder) {
    const name = namenVon(m, sf);
    if (name === null) {
      continue;
    }
    felder.set(name, unterfelder(m, sf, lokal));
  }
  return felder;
}

/**
 * Was hinter einem Typausdruck steckt.
 *
 * DREI AUSGÄNGE, WEIL ES DREI LAGEN GIBT (Korrekturpflicht 1, Prüfer BEN zu Runde 2): Runde 2 löste
 * einen benannten Typ nur auf, wenn er als `interface` geschrieben war — `type X = { … }` fiel
 * lautlos durch, obwohl es dieselbe Sache ist. Deshalb wird hier nicht mehr nach der Schreibweise
 * gefragt, sondern nach dem, was am Ende der Kette steht: Mitglieder, kein Objekt, oder unbekannt.
 * Nur „unbekannt" (ein Name, der aus dieser Datei hinausführt) ist die Zweifelslage.
 */
type Aufloesung =
  | { art: "mitglieder"; mitglieder: readonly ts.TypeElement[] }
  | { art: "kein-objekt" }
  | { art: "unbekannt" };

const KEIN_OBJEKT: Aufloesung = { art: "kein-objekt" };
const UNBEKANNT: Aufloesung = { art: "unbekannt" };

function aufloesen(
  typ: ts.TypeNode,
  lokal: ReadonlyMap<string, ts.TypeNode | readonly ts.TypeElement[]>,
  gesehen: ReadonlySet<string> = new Set(),
): Aufloesung {
  if (ts.isParenthesizedTypeNode(typ)) {
    return aufloesen(typ.type, lokal, gesehen);
  }
  if (ts.isTypeLiteralNode(typ)) {
    return { art: "mitglieder", mitglieder: typ.members };
  }
  if (ts.isIntersectionTypeNode(typ)) {
    // `Seite & { mouse: … }`: die Bezugnahme auf `Seite` führt aus der Datei hinaus (unbekannt),
    // das Literal daneben ist die Aufweitung. Gemeldet wird, was hier neu dazukommt.
    const mitglieder: ts.TypeElement[] = [];
    for (const teil of typ.types) {
      const auf = aufloesen(teil, lokal, gesehen);
      if (auf.art === "mitglieder") {
        mitglieder.push(...auf.mitglieder);
      }
    }
    return mitglieder.length > 0 ? { art: "mitglieder", mitglieder } : UNBEKANNT;
  }
  if (ts.isTypeReferenceNode(typ) && ts.isIdentifier(typ.typeName)) {
    const name = typ.typeName.text;
    if (gesehen.has(name)) {
      return UNBEKANNT; // Ringschluss `type A = A` — im Zweifel nicht schweigen.
    }
    const ziel = lokal.get(name);
    if (ziel === undefined) {
      return UNBEKANNT; // Der Name führt aus dieser Datei hinaus.
    }
    if (Array.isArray(ziel)) {
      return { art: "mitglieder", mitglieder: ziel as readonly ts.TypeElement[] };
    }
    return aufloesen(ziel as ts.TypeNode, lokal, new Set([...gesehen, name]));
  }
  return KEIN_OBJEKT;
}

/**
 * Die Unterfelder eines Feldes. Sie werden gebraucht, weil eine Aufweitung sich auch INNEN
 * verstecken kann: `keyboard: { press; type }` gegen ein `Seite`, das nur `press` kennt, wäre auf
 * Feldnamen-Ebene unsichtbar. Ein Feldtyp, der sich hier nicht auflösen lässt, gilt als Aufweitung
 * (fail-closed) — ein Wächter, der im Zweifel schweigt, ist grün und nutzlos.
 */
function unterfelder(
  mitglied: ts.TypeElement,
  sf: ts.SourceFile,
  lokal: ReadonlyMap<string, ts.TypeNode | readonly ts.TypeElement[]>,
): string[] {
  if (!ts.isPropertySignature(mitglied) || mitglied.type === undefined) {
    return [];
  }
  const auf = aufloesen(mitglied.type, lokal);
  if (auf.art === "mitglieder") {
    return auf.mitglieder.map((m) => namenVon(m, sf)).filter((n): n is string => n !== null);
  }
  return auf.art === "unbekannt" ? [NICHT_AUFLOESBAR] : [];
}

// ---- Die Felder, die `Seite` selbst kennt --------------------------------------------------------

/**
 * Gelesen aus `tests/design/h4-harness.ts` — bei JEDEM Lauf neu. Nichts hier ist abgeschrieben:
 * trägt jemand ein Feld in `Seite` ein, weiß dieser Wächter es sofort, und die Verbraucher, die
 * es bisher selbst nachreichten, werden dadurch von selbst sauber.
 */
function seitenFelder(): Felder {
  const pfad = join(WURZEL, HARNESS);
  const sf = baum(pfad);
  const lokal = lokaleTypen(sf);
  const seite = knoten(sf).find(
    (n): n is ts.InterfaceDeclaration => ts.isInterfaceDeclaration(n) && n.name.text === "Seite",
  );
  if (seite === undefined) {
    throw new Error(
      `${HARNESS}: \`export interface Seite\` nicht gefunden — der Wächter misst nichts.`,
    );
  }
  return felderAus(seite.members, sf, lokal);
}

// ---- Die Aufweitungen einer Verbraucherdatei -----------------------------------------------------

function lokaleTypen(sf: ts.SourceFile): Map<string, ts.TypeNode | readonly ts.TypeElement[]> {
  const lokal = new Map<string, ts.TypeNode | readonly ts.TypeElement[]>();
  for (const n of knoten(sf)) {
    if (ts.isInterfaceDeclaration(n)) {
      lokal.set(n.name.text, n.members);
    } else if (ts.isTypeAliasDeclaration(n)) {
      lokal.set(n.name.text, n.type);
    }
  }
  return lokal;
}

interface Aufweitung {
  datei: string;
  zeile: number;
  name: string;
  art: "erweiterung" | "cast";
  /** Was `Seite` an dieser Stelle NICHT kennt — genau das, was in `Seite` gehört. */
  fehlt: string[];
}

/** Heisst dieser Typausdruck `Seite` (oder ein lokaler Typ, der von `Seite` abstammt)? */
function seitenTypen(sf: ts.SourceFile): Set<string> {
  const menge = new Set(["Seite"]);
  // Mehrfach laufen: `A extends Seite`, `B extends A` — die Kette kann in jeder Reihenfolge stehen.
  for (let runde = 0; runde < 8; runde++) {
    let gewachsen = false;
    for (const n of knoten(sf)) {
      if (ts.isInterfaceDeclaration(n) && !menge.has(n.name.text)) {
        const erbt = (n.heritageClauses ?? []).some((h) =>
          h.types.some((t) => ts.isIdentifier(t.expression) && menge.has(t.expression.text)),
        );
        if (erbt) {
          menge.add(n.name.text);
          gewachsen = true;
        }
      }
      if (ts.isTypeAliasDeclaration(n) && !menge.has(n.name.text)) {
        const teile = ts.isIntersectionTypeNode(n.type) ? n.type.types : [n.type];
        const erbt = teile.some(
          (t) =>
            ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName) && menge.has(t.typeName.text),
        );
        if (erbt) {
          menge.add(n.name.text);
          gewachsen = true;
        }
      }
    }
    if (!gewachsen) {
      break;
    }
  }
  return menge;
}

/**
 * Namen, hinter denen in dieser Datei eine Seite steckt: alles, was ausdrücklich `: Seite` heisst,
 * jede Funktion, die eine Seite zurückgibt (auch als `H4Stand["seite"]`), und jeder Zugriff `.seite`.
 */
function seitenNamen(sf: ts.SourceFile, typen: ReadonlySet<string>): Set<string> {
  const namen = new Set<string>();
  const istSeitenTyp = (t: ts.TypeNode | undefined): boolean => {
    if (t === undefined) {
      return false;
    }
    if (ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName) && typen.has(t.typeName.text)) {
      return true;
    }
    // `H4Stand["seite"]`
    return (
      ts.isIndexedAccessTypeNode(t) &&
      ts.isLiteralTypeNode(t.indexType) &&
      ts.isStringLiteral(t.indexType.literal) &&
      t.indexType.literal.text === "seite"
    );
  };
  for (const n of knoten(sf)) {
    if ((ts.isParameter(n) || ts.isVariableDeclaration(n)) && istSeitenTyp(n.type)) {
      if (ts.isIdentifier(n.name)) {
        namen.add(n.name.text);
      }
    }
    if (ts.isFunctionDeclaration(n) && n.name !== undefined && istSeitenTyp(n.type)) {
      namen.add(n.name.text);
    }
  }
  return namen;
}

/** Steckt hinter diesem Ausdruck die Seite der Vorrichtung? */
function istSeitenAusdruck(e: ts.Expression, namen: ReadonlySet<string>): boolean {
  if (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)) {
    return istSeitenAusdruck(e.expression, namen);
  }
  if (ts.isIdentifier(e)) {
    return namen.has(e.text) || e.text === "seite" || e.text === "page";
  }
  if (ts.isPropertyAccessExpression(e)) {
    return e.name.text === "seite" || istSeitenAusdruck(e.expression, namen);
  }
  if (ts.isCallExpression(e)) {
    const ruf = e.expression;
    if (ts.isIdentifier(ruf)) {
      return namen.has(ruf.text) || ruf.text === "seite";
    }
    return ts.isPropertyAccessExpression(ruf) && ruf.name.text === "seite";
  }
  return false;
}

function ueberschuss(eigen: Felder, bekannt: Felder): string[] {
  const fehlt: string[] = [];
  for (const [name, unter] of eigen) {
    const bekannteUnter = bekannt.get(name);
    if (bekannteUnter === undefined) {
      fehlt.push(name);
      continue;
    }
    for (const u of unter) {
      if (!bekannteUnter.includes(u)) {
        fehlt.push(`${name}.${u}`);
      }
    }
  }
  return fehlt;
}

function aufweitungen(pfad: string, bekannt: Felder): Aufweitung[] {
  return aufweitungenAusBaum(baum(pfad), alsPosix(pfad), bekannt);
}

/**
 * Dieselbe Erhebung, aber über einen fertigen Baum statt über einen Dateipfad. Getrennt, damit die
 * Kalibrierung (V4) den Wächter mit Quelltext im Speicher füttern kann, ohne eine echte Testdatei
 * anzufassen: eine Gegenprobe, die dauerhaft im Lauf steht, statt einmal von Hand gefahren zu werden.
 */
function aufweitungenAusBaum(sf: ts.SourceFile, datei: string, bekannt: Felder): Aufweitung[] {
  const lokal = lokaleTypen(sf);
  const typen = seitenTypen(sf);
  const namen = seitenNamen(sf, typen);
  const gefunden = new Map<string, Aufweitung>();

  const melde = (knoten_: ts.Node, name: string, art: Aufweitung["art"], felder: Felder): void => {
    const fehlt = ueberschuss(felder, bekannt);
    if (fehlt.length === 0 || gefunden.has(name)) {
      return;
    }
    gefunden.set(name, {
      datei,
      zeile: sf.getLineAndCharacterOfPosition(knoten_.getStart(sf)).line + 1,
      name,
      art,
      fehlt,
    });
  };

  for (const n of knoten(sf)) {
    // (1) `interface X extends Seite { … }` — die offene Aufweitung.
    if (ts.isInterfaceDeclaration(n) && typen.has(n.name.text) && n.name.text !== "Seite") {
      melde(n, n.name.text, "erweiterung", felderAus(n.members, sf, lokal));
    }
    // (2) `type X = Seite & { … }` — dieselbe Sache in Kurzschreibweise, aufgelöst wie jede andere.
    if (ts.isTypeAliasDeclaration(n) && typen.has(n.name.text)) {
      const auf = aufloesen(n.type, lokal);
      if (auf.art === "mitglieder") {
        melde(n, n.name.text, "erweiterung", felderAus(auf.mitglieder, sf, lokal));
      }
    }
    // (3) Der Cast: `seite() as unknown as X`, `stand.seite as X`, `s as unknown as { … }` —
    // gleichgültig, ob X ein Interface, ein Typalias, ein Typliteral oder eine Schnittmenge ist.
    // Der Auflöser oben entscheidet das, nicht diese Stelle: eine Schreibweise mehr darf keine
    // Prüflücke mehr sein (Korrekturpflicht 1 zu Runde 2).
    if (ts.isAsExpression(n) && istSeitenAusdruck(n.expression, namen)) {
      const auf = aufloesen(n.type, lokal);
      if (auf.art === "mitglieder") {
        const felder = felderAus(auf.mitglieder, sf, lokal);
        const benannt =
          ts.isTypeReferenceNode(n.type) && ts.isIdentifier(n.type.typeName)
            ? n.type.typeName.text
            : `{ ${[...felder.keys()].join(", ")} }`;
        melde(n, benannt, "cast", felder);
      }
    }
  }
  return [...gefunden.values()];
}

// ---- Die Erhebung, einmal je Lauf ----------------------------------------------------------------

const BEKANNT = seitenFelder();
const VERBRAUCHER = gehe(TESTS, [])
  .map(alsPosix)
  .filter((d) => d !== SELBST)
  .filter((d) => istVerbraucher(baum(join(WURZEL, d))))
  .sort();
const BEFUND = VERBRAUCHER.flatMap((d) => aufweitungen(join(WURZEL, d), BEKANNT));

function zeile(a: Aufweitung): string {
  return `${a.datei}:${a.zeile} · ${a.art} „${a.name}" reicht nach: ${a.fehlt.join(", ")}`;
}

// ---- Die Kalibrierung: derselbe Verstoß in allen Schreibweisen -----------------------------------
//
// WARUM ES DIESEN ABSCHNITT GIBT (Prüfer BEN, JOB 3564 Runde 2). Runde 2 löste ein benanntes
// Cast-Ziel nur auf, wenn es ein `interface` war; derselbe Verstoß als `type X = { … }` blieb
// unentdeckt — der Wächter hing an der SCHREIBWEISE, nicht an der Sache. Die Gegenprobe des Prüfers
// war eine Handmessung; hier steht sie dauerhaft im Lauf, mit allen Schreibweisen nebeneinander.
//
// Die Fälle sind Quelltext im Speicher, keine echten Dateien: so kalibriert sich der Wächter, ohne
// dass jemand eine Verbraucherdatei absichtlich verunreinigen müsste. Jeder Fall benutzt DIESELBE
// unbekannte Seitenfunktion (`mouse.click`), damit allein die Schreibweise sich unterscheidet.
const KALIBRIER_RUMPF = `import type { H4Stand, Seite } from "../design/h4-harness";
declare function seite(): H4Stand["seite"];
`;
const MAUS = "{ click(x: number, y: number): Promise<void> }";

interface Kalibrierfall {
  readonly name: string;
  readonly quelle: string;
  /** Was der Wächter melden MUSS — leer heisst: dieser Fall ist erlaubt und bleibt still. */
  readonly erwartet: readonly string[];
}

const KALIBRIERFAELLE: readonly Kalibrierfall[] = [
  {
    name: "Interface hinter einem Cast",
    quelle: `${KALIBRIER_RUMPF}interface KMaus { mouse: ${MAUS} }
async function probe(): Promise<void> { await (seite() as unknown as KMaus).mouse.click(1, 2); }`,
    erwartet: ["mouse"],
  },
  {
    name: "Typalias hinter einem Cast (die Lücke aus Runde 2)",
    quelle: `${KALIBRIER_RUMPF}type KMaus = { mouse: ${MAUS} };
async function probe(): Promise<void> { await (seite() as unknown as KMaus).mouse.click(1, 2); }`,
    erwartet: ["mouse"],
  },
  {
    name: "Typliteral unmittelbar im Cast",
    quelle: `${KALIBRIER_RUMPF}async function probe(): Promise<void> {
  await (seite() as unknown as { mouse: ${MAUS} }).mouse.click(1, 2);
}`,
    erwartet: ["mouse"],
  },
  {
    name: "Schnittmenge mit `Seite` unmittelbar im Cast",
    quelle: `${KALIBRIER_RUMPF}async function probe(): Promise<void> {
  await (seite() as unknown as (Seite & { mouse: ${MAUS} })).mouse.click(1, 2);
}`,
    erwartet: ["mouse"],
  },
  {
    name: "Interface, das `Seite` erweitert",
    quelle: `${KALIBRIER_RUMPF}interface KSeite extends Seite { mouse: ${MAUS} }
async function probe(): Promise<void> { await (seite() as KSeite).mouse.click(1, 2); }`,
    erwartet: ["mouse"],
  },
  {
    name: "Typalias `Seite & { … }`",
    quelle: `${KALIBRIER_RUMPF}type KSeite = Seite & { mouse: ${MAUS} };
async function probe(): Promise<void> { await (seite() as KSeite).mouse.click(1, 2); }`,
    erwartet: ["mouse"],
  },
  {
    name: "verstecktes Unterfeld über einen Typalias",
    quelle: `${KALIBRIER_RUMPF}type KTasten = { press(taste: string): Promise<void>; type(text: string): Promise<void> };
interface KSeite extends Seite { keyboard: KTasten }
async function probe(): Promise<void> { await (seite() as KSeite).keyboard.type("abc"); }`,
    erwartet: ["keyboard.type"],
  },
  {
    name: "Negativfall: der Cast nennt nur, was `Seite` selbst kennt",
    quelle: `${KALIBRIER_RUMPF}type KBekannt = { keyboard: { press(taste: string): Promise<void> } };
async function probe(): Promise<void> { await (seite() as unknown as KBekannt).keyboard.press("Tab"); }`,
    erwartet: [],
  },
];

const KALIBRIER_DATEI = "tests/design-vorrichtung/<kalibrierung>.test.ts";

function kalibriere(fall: Kalibrierfall): Aufweitung[] {
  const sf = ts.createSourceFile(
    KALIBRIER_DATEI,
    fall.quelle,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  return aufweitungenAusBaum(sf, KALIBRIER_DATEI, BEKANNT);
}

describe("JOB 3564 · die Seiten-Typisierung wohnt in der Vorrichtung, nicht in den Testdateien", () => {
  it("V1 · kein Verbraucher der Vorrichtung reicht sich ein Feld selbst nach, das `Seite` nicht kennt", () => {
    console.info(
      `JOB 3564 · Verbraucher: ${VERBRAUCHER.length} · Felder in \`Seite\`: ${[...BEKANNT.keys()].join(", ")}`,
    );
    for (const a of BEFUND) {
      console.info(`JOB 3564 · Aufweitung: ${zeile(a)}`);
    }
    const unerlaubt = BEFUND.filter((a) => {
      const zugestanden = ALTBESTAND.get(a.datei);
      return zugestanden === undefined || a.fehlt.some((f) => !zugestanden.includes(f));
    });
    expect(
      unerlaubt.map(zeile),
      "Diese Felder gehören in `export interface Seite` (tests/design/h4-harness.ts), nicht in die " +
        "Testdatei — s. archiv/3488/runde-2/RUECKGABE.md:66",
    ).toEqual([]);
  });

  it("V2 · der Altbestand verwaltet keine Gespenster: jede registrierte Zeile hat noch eine Aufweitung", () => {
    const mitBefund = new Set(BEFUND.map((a) => a.datei));
    const bezahlt = [...ALTBESTAND.keys()].filter((d) => !mitBefund.has(d));
    expect(
      bezahlt,
      "Die Schuld dieser Dateien ist bezahlt — der Eintrag im ALTBESTAND gehört gelöscht",
    ).toEqual([]);
  });

  it("V3 · die Prüfmenge ist festgenagelt: der Wächter sieht wirklich alle Verbraucher an", () => {
    // Ohne diesen Fall wäre V1 auch dann grün, wenn die Erhebung gar nichts mehr fände — die
    // teuerste Art, einen Wächter zu verlieren (`LEHREN.md`, JOB 3489, 10.09. 09:21:13).
    expect(
      gehe(TESTS, []).length,
      "Der Verzeichnisgang hat den Testbaum nicht gefunden",
    ).toBeGreaterThan(500);
    expect(VERBRAUCHER.length).toBeGreaterThanOrEqual(ERWARTETE_VERBRAUCHER.length);
    expect(
      ERWARTETE_VERBRAUCHER.filter((d) => !VERBRAUCHER.includes(d)),
      "Diese Verbraucher der Vorrichtung sind aus der Prüfmenge verschwunden",
    ).toEqual([]);
    // Und die Grundlage selbst: `Seite` muss Felder haben, sonst wäre jede Aufweitung „bekannt".
    expect([...BEKANNT.keys()]).toContain("keyboard");
    expect(BEKANNT.size).toBeGreaterThanOrEqual(9);
  });

  it("V4 · kalibriert: derselbe Verstoß wird in JEDER Schreibweise gefunden — Interface wie Typalias", () => {
    // Ohne diesen Fall hängt V1 an der Schreibweise: Runde 2 sah `interface X { mouse … }` hinter
    // einem Cast, `type X = { mouse … }` aber nicht (Prüfer BEN, 10.09.). Beides ist derselbe
    // Verstoß, also muss beides denselben Fund erzeugen — mit Datei, Zeile, Typname und Feld.
    const rest: string[] = [];
    for (const fall of KALIBRIERFAELLE) {
      const befund = kalibriere(fall);
      const gefunden = [...befund.flatMap((a) => a.fehlt)].sort();
      const erwartet = [...fall.erwartet].sort();
      if (gefunden.join("|") !== erwartet.join("|")) {
        rest.push(
          `${fall.name}: erwartet [${erwartet.join(", ")}], gefunden [${gefunden.join(", ")}]`,
        );
      }
      for (const a of befund) {
        if (a.zeile <= 0 || a.name === "" || a.datei !== KALIBRIER_DATEI) {
          rest.push(`${fall.name}: unbrauchbare Meldung „${zeile(a)}"`);
        }
      }
    }
    expect(
      rest,
      "Der Wächter darf nicht an der Schreibweise hängen: jede dieser Formen reicht dasselbe Feld " +
        "nach und gehört gemeldet (s. Korrekturpflicht 1, JOB 3564 Runde 2)",
    ).toEqual([]);
  });
});
