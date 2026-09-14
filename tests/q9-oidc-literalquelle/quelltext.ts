// ================================================================================================
// JOB 3562 · Q9-REST — WERKZEUG: QUELLTEXT OHNE KOMMENTARE.
// ================================================================================================
//
// Die drei Wächter dieses Ordners fragen den Quelltext, nicht die Laufzeit: „steht dieser Satz noch
// ein zweites Mal irgendwo unter services/auth/src?" Eine rohe Zeichenkettensuche beantwortet das
// falsch, denn `oidc.ts:25` und `:291` NENNEN den Satz in Prosa („der eine Fehler für ‚der
// Anmeldedienst antwortet nicht'"). Ein Kommentar ist keine zweite Quelle der Wahrheit: er wird
// nicht ausgeliefert, niemand liest ihn als Nutzertext, und ihn zu verbieten hiesse, Erklärungen zu
// verbieten. Deshalb schneidet dieses Werkzeug Kommentare heraus, BEVOR gesucht wird.
//
// Herausgeschnitten wird längentreu in Zeilen: Blockkommentare werden zu Leerzeichen, ihre
// Zeilenumbrüche bleiben stehen. Nur so stimmt die Zeilennummer, die ein roter Wächter meldet, noch
// mit der Datei überein, die der Mensch dann öffnet.
//
// Der Grund für einen eigenen Abtaster statt eines Regexes: ein Regex, der `//` sucht, verschluckt
// jede URL und jeden regulären Ausdruck. Der Abtaster kennt deshalb drei Zustände, die ein `/`
// harmlos machen — Zeichenkette, Vorlagenzeichenkette (samt `${…}`) und Regex-Literal. Die Fälle
// W0.* in `katalog-ist-die-einzige-quelle.test.ts` kalibrieren ihn an genau diesen Fallen.
//
// DER ABTASTER TRÄGT SEIT JOB 3846 NUR NOCH DIESE FRAGE. Der zweite Abschnitt dieser Datei (Wächter
// D: wo entsteht ein `AuthError`?) liest den Syntaxbaum; die Begründung steht dort. Hier ändert das
// nichts: ein Wächter, der ganze Sätze in fremden Dateien sucht, braucht einen längentreuen Schnitt
// des Rohtexts und keinen Baum.
import ts from "typescript";

/**
 * Ende einer Zeichenkette, die bei `start` mit `"`, `'` oder `` ` `` beginnt (Index HINTER dem
 * schliessenden Zeichen). Escapes zählen; in Vorlagenzeichenketten werden `${…}`-Ausdrücke samt
 * darin geschachtelter Zeichenketten übersprungen.
 */
export function zeichenketteEnde(quelle: string, start: number): number {
  const anfang = quelle[start];
  let i = start + 1;
  while (i < quelle.length) {
    const c = quelle[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === anfang) {
      return i + 1;
    }
    if (anfang === "`" && c === "$" && quelle[i + 1] === "{") {
      let tiefe = 1;
      i += 2;
      while (i < quelle.length && tiefe > 0) {
        const d = quelle[i];
        if (d === '"' || d === "'" || d === "`") {
          i = zeichenketteEnde(quelle, i);
          continue;
        }
        if (d === "{") {
          tiefe += 1;
        } else if (d === "}") {
          tiefe -= 1;
        }
        i += 1;
      }
      continue;
    }
    i += 1;
  }
  return quelle.length;
}

// Nach diesen Zeichen kann ein `/` nur ein Regex-Literal beginnen, nie eine Division: es steht kein
// Wert davor, durch den man teilen könnte. Nach einem Bezeichner, einer Zahl, `)` oder `]` ist es
// umgekehrt eine Division. `return /x/` erkennt die Liste über das `n` nicht — deshalb steht das
// Schlüsselwort-Ende zusätzlich unten.
const VOR_REGEX = new Set("(,=:[!&|?{};+-*%~^<>".split(""));
const VOR_REGEX_WORT = new Set(["return", "typeof", "case", "in", "of", "do", "else", "yield"]);

function regexMoeglich(davor: string, wort: string): boolean {
  return davor === "" || VOR_REGEX.has(davor) || VOR_REGEX_WORT.has(wort);
}

function regexEnde(quelle: string, start: number): number {
  let i = start + 1;
  let inKlasse = false;
  while (i < quelle.length) {
    const c = quelle[i];
    if (c === "\n") {
      // Ein Regex-Literal endet nie über die Zeile hinweg: dann war das `/` doch eine Division.
      return start + 1;
    }
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "[") {
      inKlasse = true;
    } else if (c === "]") {
      inKlasse = false;
    } else if (c === "/" && !inKlasse) {
      return i + 1;
    }
    i += 1;
  }
  return start + 1;
}

/**
 * Das Füllzeichen, mit dem `nurStruktur` Inhalte ausblendet. Bewusst KEIN Leerzeichen und kein
 * Bezeichnerzeichen: so ist im Ergebnis auf einen Blick zu sehen, dass dort etwas stand, und keine
 * Suche nach einem Wort (`new`, `class`, `extends`) kann darin zufällig anschlagen.
 */
const FUELLER = "·";

function maskiere(text: string): string {
  // Zeilenumbrüche bleiben stehen — sonst stimmt die Zeilennummer nicht mehr, die ein roter
  // Wächter meldet, mit der Datei überein, die der Mensch dann öffnet.
  return text.replace(/[^\n]/g, FUELLER);
}

/**
 * Ein Abtaster für beide Schnitte — es gibt bewusst nur DIESEN einen. `ohneKommentare` und
 * `nurStruktur` unterscheiden sich allein darin, ob die INHALTE von Zeichenketten, Vorlagen und
 * Regex-Literalen erhalten bleiben; die Zustandsführung (was ist Kommentar, was ist Zeichenkette,
 * wann beginnt ein Regex) ist dieselbe und wird von W0.* kalibriert.
 *
 * Beide Schnitte sind LÄNGENTREU: jedes Zeichen der Quelle hat im Ergebnis genau ein Zeichen an
 * derselben Stelle. Nur so darf ein Aufrufer einen Index, den er im einen Schnitt gefunden hat, im
 * anderen zum Herausschneiden benutzen — genau das tut `erzeugungsstellen`.
 */
function abtasten(quelle: string, inhalteMaskieren: boolean): string {
  let ergebnis = "";
  let i = 0;
  let davor = "";
  let wort = "";
  const uebernimm = (roh: string): string => {
    if (!inhalteMaskieren || roh.length <= 2) {
      return inhalteMaskieren ? maskiere(roh) : roh;
    }
    // Die Begrenzer bleiben lesbar, damit das Ergebnis noch als Quelltext erkennbar ist.
    return roh.charAt(0) + maskiere(roh.slice(1, -1)) + roh.slice(-1);
  };
  while (i < quelle.length) {
    const c = quelle[i] ?? "";
    if (c === '"' || c === "'" || c === "`") {
      const ende = zeichenketteEnde(quelle, i);
      ergebnis += uebernimm(quelle.slice(i, ende));
      davor = c;
      wort = "";
      i = ende;
      continue;
    }
    if (c === "/" && quelle[i + 1] === "/") {
      const start = i;
      while (i < quelle.length && quelle[i] !== "\n") {
        i += 1;
      }
      // JOB 3580: Bis hierher wurde der Zeilenkommentar ERSATZLOS entfernt — das hielt die
      // Zeilennummern, aber nicht die Zeichenindizes. `erzeugungsstellen` sucht die Struktur im
      // einen Schnitt und schneidet den Text aus dem anderen aus; dafür müssen beide dieselbe
      // Länge haben. Leerzeichen statt nichts, wie beim Blockkommentar schon immer.
      ergebnis += " ".repeat(i - start);
      continue;
    }
    if (c === "/" && quelle[i + 1] === "*") {
      const schluss = quelle.indexOf("*/", i + 2);
      const bis = schluss < 0 ? quelle.length : schluss + 2;
      ergebnis += quelle.slice(i, bis).replace(/[^\n]/g, " ");
      i = bis;
      continue;
    }
    if (c === "/" && regexMoeglich(davor, wort)) {
      const ende = regexEnde(quelle, i);
      ergebnis += uebernimm(quelle.slice(i, ende));
      davor = "/";
      wort = "";
      i = ende;
      continue;
    }
    ergebnis += c;
    if (/[A-Za-z0-9_$]/.test(c)) {
      wort += c;
    } else {
      wort = "";
    }
    if (!/\s/.test(c)) {
      davor = c;
    }
    i += 1;
  }
  return ergebnis;
}

/** Derselbe Quelltext, zeilen-, spalten- und längentreu, aber ohne Zeilen- und Blockkommentare. */
export function ohneKommentare(quelle: string): string {
  return abtasten(quelle, false);
}

/**
 * Nur noch das Gerüst: Kommentare sind weg, und die INHALTE von Zeichenketten, Vorlagen und
 * Regex-Literalen sind ausgeblendet. Darauf — und nur darauf — darf strukturell gesucht werden:
 * ein `new AuthError("X", "y")` in einer Zeichenkette oder in einem Regex ist hier kein Aufruf
 * mehr, und eine Klammer oder ein Komma in einem Text zerlegt keine Argumentliste.
 */
function nurStruktur(quelle: string): string {
  return abtasten(quelle, true);
}

/**
 * Jede Modulangabe, die der übergebene (bereits kommentarfreie) Quelltext lädt — mit dem
 * Zeichenindex, an dem die Anweisung beginnt.
 *
 * RUNDE 2, KORREKTURPFLICHT DES PRÜFERS: Bis hierher suchte Wächter A nur nach `from "…"`,
 * `import("…")` und `require("…")`. Ein Import OHNE BINDUNG — `import "./types";` — hat kein
 * `from` und kein `(`; er blieb deshalb unsichtbar, und der Katalog konnte wieder von einem
 * Auth-Modul abhängen, während alle Wächter grün blieben (BEN, Runde 1: „`import "./types";` vor
 * den Katalog gesetzt → Exit 0, Tests 15 passed"). Genau diese Form steht jetzt als vierte
 * Alternative in der Liste, und die Fälle A.0.* halten jede Ladeform einzeln fest.
 *
 * Die Reihenfolge der Alternativen ist bedeutsam: `import (` muss vor dem blossen `import` stehen,
 * sonst verschluckt die kürzere Form den dynamischen Import. Ein `.from("…")` (etwa `Array.from`)
 * trifft die Liste nicht, weil zwischen Wort und Anführungszeichen eine Klammer steht.
 */
const IMPORT_MUSTER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)["']([^"']+)["']/g;

export function importe(ohneKommentareQuelle: string): { spezifizierer: string; index: number }[] {
  const gefunden: { spezifizierer: string; index: number }[] = [];
  for (const treffer of ohneKommentareQuelle.matchAll(IMPORT_MUSTER)) {
    const spezifizierer = treffer[1];
    if (spezifizierer) {
      gefunden.push({ spezifizierer, index: treffer.index ?? 0 });
    }
  }
  return gefunden;
}

// ================================================================================================
// JOB 3580 · WERKZEUG: WO ENTSTEHT EIN AuthError, UND WAS TRÄGT ER ALS MELDUNG?
// JOB 3846 · RUNDE 4 — DIESER ABSCHNITT LIEST DEN SYNTAXBAUM STATT ZU TASTEN.
// ================================================================================================
//
// Wächter D fragt: trägt jede Stelle, an der ein `AuthError` entsteht, eine Meldung, die der
// Katalog als SCHLÜSSEL kennt? Dafür braucht er zwei Dinge, die dieser Abschnitt liefert — die
// Menge der Klassen, die überhaupt als `AuthError` durchgereicht werden, und die Erzeugungsstellen
// samt dem Rohtext ihrer Argumente. Kalibriert wird beides einzeln durch D.0.
//
// WARUM ÜBER `ts.createSourceFile` UND NICHT MEHR ÜBER `nurStruktur`: Bis JOB 3846 suchten beide
// Funktionen unten mit Mustern und Klammerarithmetik im maskierten Quelltext. Das löste zwar das
// eigentliche Problem (`new AuthError("X", "y")` steht in diesem Baum auch in Kommentaren, in
// Zeichenketten und in Regex-Literalen, und die echten Stellen stehen als
// `"KEY" satisfies Meldungsschluessel`, mehrere davon über mehrere Zeilen) — aber es trug DREI
// GEMESSENE blinde Flecken, auf denen ein freier Fehlersatz am Katalog vorbeilief, ohne dass ein
// Test rot wurde. Die liefernde Bahn von JOB 3580 hat sie selbst benannt und offen gelassen
// (`archiv/3580/runde-3/RUECKGABE.md:57`); gemessen am 13.09.2026 lieferte der Abtaster bei allen
// drei Formen `[]`:
//
//   1 LAUFZEIT-KLASSENWAHL     `new (b ? AuthError : Error)("FORBIDDEN", "…")` — hinter `new` stand
//                              kein blosser Name, also wurde die Stelle verworfen.
//   2 VORLAGEN-EINSETZUNG      `` `${new AuthError("FORBIDDEN", "…")}` `` — `nurStruktur` maskiert
//                              ALLES zwischen den Begrenzern einer Vorlage. Für eine Zeichenkette
//                              und für ein Regex-Literal ist das richtig (ein Aufruf in einem Text
//                              ist keiner); in einer Einsetzung steht aber echter Code.
//   3 ERBEN ÜBER EINEN AUFRUF  `class StummError extends mischung(AuthError) {}` — das Muster
//                              verlangte hinter `extends` einen NAMEN, also entstand keine Kante.
//
// Der Syntaxbaum kennt diese drei Fälle von Haus aus: ein Kommentar kommt darin gar nicht vor, eine
// Zeichenkette ist ein Literalknoten und kein Aufruf, eine Vorlagen-Einsetzung trägt ihre eigenen
// Knoten, und `new` trägt seinen Konstruktorausdruck als Knoten statt als Zeichenkette. `typescript`
// ist dafür kein neues Werkzeug, sondern der Hausweg (`package.json:36`; ebenso
// `tests/q9-fremde-flaechen/keine-deutschen-literale.test.ts` und
// `tests/capture/aufrufer-waechter.test.ts`).
//
// WAS DIESER ABSCHNITT DAMIT NICHT MEHR BENUTZT: `nurStruktur` und die Klammer-, Komma- und
// Namensarithmetik darüber. Der Abtaster selbst bleibt unangetastet — `ohneKommentare` trägt die
// Wächter A/B/C in `katalog-ist-die-einzige-quelle.test.ts` (dort kalibriert von W0.*), und
// `alsLiteral` weiter unten benutzt `nurStruktur` für eine andere Frage: nicht „wo steht ein
// Aufruf", sondern „ist dieses eine Argument ein Literal". Ein zweiter Erkennungsweg für die Frage
// dieses Abschnitts entsteht dadurch nicht.

/** Eine Klasse, deren Objekte `routes.ts` als `AuthError` an den Menschen durchreicht. */
export interface Fehlerklasse {
  name: string;
  /** `wurzel` = `AuthError` selbst (oder ein blosser anderer Name dafür), `abgeleitet` = erbt. */
  art: "wurzel" | "abgeleitet";
}

/** Eine Stelle, an der eine dieser Klassen erzeugt wird. */
export interface Erzeugungsstelle {
  klasse: string;
  art: Fehlerklasse["art"];
  /** 1-basierte Zeile, in der das `new` steht — dort schlägt der Mensch nach. */
  zeile: number;
  /** Die Argumente als ROHTEXT, getrimmt. Leer, wenn keins dasteht (Vorgabewert der Klasse). */
  argumente: string[];
}

/** Der eine Parser dieses Abschnitts — eine Quelle, ein Baum, keine zweite Lesart. */
function baum(quelle: string): ts.SourceFile {
  return ts.createSourceFile("quelle.ts", quelle, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

/**
 * Der GESCHRIEBENE Name eines Ausdrucks, wenn er eine reine Namenskette ist (`AuthError`,
 * `t.AuthError`, `this.Fehler`, `deps.Fehler`) — sonst `undefined`. Der Name kommt aus dem Baum und
 * nicht aus dem Rohtext: Leerzeichen und Zeilenumbrüche zwischen den Teilen fallen dabei von selbst
 * weg, statt weggerechnet werden zu müssen.
 */
function namensKette(n: ts.Node): string | undefined {
  if (ts.isIdentifier(n)) {
    return n.text;
  }
  if (n.kind === ts.SyntaxKind.ThisKeyword) {
    return "this";
  }
  if (ts.isPropertyAccessExpression(n)) {
    const vorne = namensKette(n.expression);
    return vorne === undefined ? undefined : `${vorne}.${n.name.text}`;
  }
  return undefined;
}

/**
 * Jede Namenskette, die in `wurzel` vorkommt — in Quelltextreihenfolge. Eine gefundene Kette wird
 * NICHT weiter zerlegt: `joseErrors.JWKSTimeout` ist ein Name und nicht zusätzlich `joseErrors`.
 *
 * NUR FÜR DIE `extends`-SEITE. Dort ist „jeder genannte Name" die richtige Frage: bei
 * `class X extends mischung(AuthError) {}` wird `AuthError` wirklich zur Basis, obwohl es als
 * ARGUMENT dasteht. Für den Konstruktorausdruck hinter `new` wäre dieselbe Frage falsch — dort
 * zählt der WERT des Ausdrucks, und `konstruktorklassen` wertet ihn aus, statt Namen einzusammeln
 * (Runde 2, Korrekturpflicht 1: genau diese Verwechslung war der Rückschritt aus Runde 1).
 */
function namenIn(wurzel: ts.Node, gefunden: string[] = []): string[] {
  const kette = namensKette(wurzel);
  if (kette !== undefined) {
    gefunden.push(kette);
    return gefunden;
  }
  ts.forEachChild(wurzel, (kind) => {
    namenIn(kind, gefunden);
  });
  return gefunden;
}

/** Klammern und Typzusagen abtragen — `(AuthError)`, `AuthError as typeof AuthError`, `x!`. */
function ohneHuellen(n: ts.Expression): ts.Expression {
  let rest = n;
  while (
    ts.isParenthesizedExpression(rest) ||
    ts.isAsExpression(rest) ||
    ts.isSatisfiesExpression(rest) ||
    ts.isNonNullExpression(rest) ||
    ts.isTypeAssertionExpression(rest)
  ) {
    rest = rest.expression;
  }
  return rest;
}

/** Ein qualifizierter Typname als geschriebener Text: `typeof t.AuthError` → `t.AuthError`. */
function entitaetsname(n: ts.EntityName): string {
  return ts.isIdentifier(n) ? n.text : `${entitaetsname(n.left)}.${n.right.text}`;
}

interface Kante {
  neu: string;
  basis: string;
  erbt: boolean;
}

/**
 * Eine Kante — und bei einem QUALIFIZIERTEN Basisnamen zusätzlich die über seinen letzten Teil.
 * `const F = t.AuthError;` bindet `F` an `AuthError`; die alte Musterliste tat das (ihr `\b` fing
 * den letzten Teil mit), und die Ablösung darf nicht schwächer sein als das Abgelöste.
 */
function kante(kanten: Kante[], neu: string, basis: string, erbt: boolean): void {
  kanten.push({ neu, basis, erbt });
  const punkt = basis.lastIndexOf(".");
  if (punkt >= 0) {
    kanten.push({ neu, basis: basis.slice(punkt + 1), erbt });
  }
}

/**
 * Die Namen, von denen eine Klasse ERBT — aus dem `extends`-Ausdruck, nicht aus einem Namen.
 *
 * JOB 3846, FLECK 3: `class StummError extends mischung(AuthError) {}` ist gültiges TypeScript und
 * erzeugt eine echte AuthError-Unterklasse; das alte Muster verlangte hinter `extends` einen
 * Bezeichner und legte deshalb gar keine Kante an. Jetzt zählt JEDER im Ausdruck genannte Name als
 * Basis — bei `mischung(AuthError)` also `mischung` (unbekannt) UND `AuthError` (Wurzel).
 * Die TYPARGUMENTE bleiben aussen vor: `class X extends Basis<AuthError> {}` erbt von `Basis`, ein
 * Typargument entsteht zur Laufzeit nicht.
 */
function erbschaftsnamen(k: ts.ClassLikeDeclaration): string[] {
  const namen: string[] = [];
  for (const klausel of k.heritageClauses ?? []) {
    if (klausel.token !== ts.SyntaxKind.ExtendsKeyword) {
      continue;
    }
    for (const typ of klausel.types) {
      namen.push(...namenIn(typ.expression));
    }
  }
  return namen;
}

/**
 * Die WEGE, auf denen ein neuer Name zu einer Fehlerklasse wird — einzeln benannt, weil jeder
 * einzeln in D.0 kalibriert ist. Sie sind keine Spitzfindigkeit: Lehre JOB 3579 R1 (11.09.) — „der
 * AST-Wächter übersieht zwei gemessene Aliasformen". Ein Name, der nur umbenannt wurde, ist
 * dieselbe Klasse.
 *
 *   1 `extends <Name>`      `class OidcUnreachableError extends AuthError {}`        (erbt)
 *   2 KLASSENAUSDRUCK       `const StummError = class extends AuthError {};`         (erbt)
 *   3 EINFUHR-ALIAS         `import { AuthError as Fehler } from "./types";`
 *   4 ZUWEISUNG             `const Fehler = AuthError;` — auch typisiert, auch ohne Deklaration
 *   5 TYPANNOTATION         `let X: typeof AuthError;` — auch an Parametern und Feldern
 *   6 `extends <Ausdruck>`  `class StummError extends mischung(AuthError) {}`        (erbt)
 *
 * RUNDE 2, KORREKTURPFLICHT 1 DES PRÜFERS (sie gilt weiter, nur trägt sie jetzt der Baum): Weg 4
 * kannte bis dahin nur die UNTYPISIERTE Zuweisung. BEN setzte an dieselbe Stelle wie die
 * Pflichtgegenprobe `const Fehler: typeof AuthError = AuthError; throw new Fehler("FORBIDDEN", "Nur
 * Admins duerfen das.");` — und alle 71 Fälle blieben grün (BEN, Runde 1: „→ `Tests  71 passed
 * (71)`"). Eine gewöhnliche Typannotation genügte also, damit der freie Fehlersatz unbemerkt blieb.
 * Deshalb bindet Weg 5 den Namen an der ANNOTATION selbst: `let X: typeof AuthError;` ist ein
 * AuthError-Konstruktor, gleichgültig, woher der Wert später kommt.
 *
 * Weg 3 hängt jetzt an der Einfuhr statt an den zwei Wörtern `X as Y` irgendwo im Text. Das ist
 * enger und zugleich stärker: eine Typzusage (`schluessel as Meldungsschluessel`) legt keine Kante
 * mehr an, dafür trägt Weg 4 über `ohneHuellen` auch `const F = AuthError as typeof AuthError;`,
 * was die alte Musterliste nicht traf.
 */
function sammleKanten(n: ts.Node, kanten: Kante[]): void {
  if (ts.isClassDeclaration(n) || ts.isClassExpression(n)) {
    const eigener = n.name?.text;
    if (eigener !== undefined) {
      for (const basis of erbschaftsnamen(n)) {
        kante(kanten, eigener, basis, true);
      }
    }
  }
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
    const wert = ohneHuellen(n.initializer);
    if (ts.isClassExpression(wert)) {
      for (const basis of erbschaftsnamen(wert)) {
        kante(kanten, n.name.text, basis, true);
      }
    }
    const herkunft = namensKette(wert);
    if (herkunft !== undefined) {
      kante(kanten, n.name.text, herkunft, false);
    }
  }
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    const ziel = namensKette(n.left);
    const herkunft = namensKette(ohneHuellen(n.right));
    if (ziel !== undefined && herkunft !== undefined) {
      kante(kanten, ziel, herkunft, false);
    }
  }
  if ((ts.isImportSpecifier(n) || ts.isExportSpecifier(n)) && n.propertyName) {
    kante(kanten, n.name.text, n.propertyName.text, false);
  }
  // `: typeof X` an allem, was einen Namen und eine Typangabe trägt — Variable, Parameter, Feld,
  // Feldsignatur. Ein Sonderfall je Knotenart wäre vier Wege für eine Aussage.
  const typisiert = n as ts.Node & { name?: ts.Node; type?: ts.TypeNode };
  if (
    typisiert.type !== undefined &&
    ts.isTypeQueryNode(typisiert.type) &&
    typisiert.name !== undefined &&
    ts.isIdentifier(typisiert.name)
  ) {
    kante(kanten, typisiert.name.text, entitaetsname(typisiert.type.exprName), false);
  }
}

/**
 * Alle Klassen, die (auch über mehrere Stufen, auch unter einem anderen Namen) auf `wurzeln`
 * zurückgehen — über ALLE übergebenen Quellen zusammen. Getrennt zu sammeln wäre falsch: eine
 * Klasse, die in `oidc.ts` von `AuthError` erbt, wird auch in `service.ts` geworfen.
 */
export function fehlerklassen(
  quellen: readonly string[],
  wurzeln: readonly string[] = ["AuthError"],
): Fehlerklasse[] {
  const kanten: Kante[] = [];
  for (const quelle of quellen) {
    const sf = baum(quelle);
    const gehe = (n: ts.Node): void => {
      sammleKanten(n, kanten);
      ts.forEachChild(n, gehe);
    };
    ts.forEachChild(sf, gehe);
  }
  const gefunden = new Map<string, Fehlerklasse["art"]>(
    wurzeln.map((name) => [name, "wurzel" as const]),
  );
  let gewachsen = true;
  while (gewachsen) {
    gewachsen = false;
    for (const { neu, basis, erbt } of kanten) {
      const artDerBasis = gefunden.get(basis);
      if (artDerBasis === undefined || gefunden.has(neu)) {
        continue;
      }
      // Ein blosser zweiter Name bleibt, was die Basis war; ein `extends` macht daraus eine
      // abgeleitete Klasse — und die behandelt Wächter D strenger.
      gefunden.set(neu, erbt ? "abgeleitet" : artDerBasis);
      gewachsen = true;
    }
  }
  return [...gefunden].map(([name, art]) => ({ name, art }));
}

/**
 * Die Art einer Klasse hinter dem geschriebenen Namen — auch dann, wenn der Name QUALIFIZIERT ist.
 *
 * RUNDE 3, KORREKTURPFLICHT DES PRÜFERS: Weg 5 erkannte das Feld
 * `private readonly Fehler: typeof AuthError = AuthError;` korrekt als Fehlerklasse — aber die
 * VERWENDUNG heisst `new this.Fehler(…)`, und dieser Name stand so in keiner Liste. BEN warf damit
 * in `service.ts:149` einen freien Satz, und alle 81 Faelle blieben gruen (BEN, Runde 2:
 * „→ `Tests  81 passed (81)`"). Eine erkannte Deklaration nuetzt nichts, wenn ihre Verwendung
 * nicht aufgeloest wird.
 *
 * Deshalb: zuerst der GANZE geschriebene Name (`AuthError`, `t.AuthError`), dann — und nur bei
 * einem qualifizierten Namen — sein LETZTER Teil. Das trifft `this.Fehler` ebenso wie
 * `new t.AuthError(…)` nach einem Namensraum-Import. Die Richtung ist bewusst gewaehlt: ein
 * Waechter, der beim qualifizierten Namen wegsieht, ist genau dort blind, wo er gebraucht wird;
 * meldet er dagegen einmal zu viel, steht die Stelle mit Datei und Zeile da und ein Mensch
 * entscheidet. `joseErrors.JWKSTimeout` bleibt unberuehrt — `JWKSTimeout` ist keine Fehlerklasse
 * dieses Moduls, und `D.0` haelt genau das fest.
 */
function artFuer(
  name: string,
  nachArt: ReadonlyMap<string, Fehlerklasse["art"]>,
): Fehlerklasse["art"] | undefined {
  const ganz = nachArt.get(name);
  if (ganz !== undefined) {
    return ganz;
  }
  const punkt = name.lastIndexOf(".");
  return punkt < 0 ? undefined : nachArt.get(name.slice(punkt + 1));
}

/**
 * Die Klassen, die ein Konstruktorausdruck erzeugen KANN — ausgewertet nach seinem WERT, nicht nach
 * den Namen, die irgendwo in ihm vorkommen. Jede erreichbare Alternative steht einzeln in der
 * Liste; ein Name, der nur in einem verworfenen Teilausdruck steht, steht gar nicht darin.
 *
 * JOB 3846, FLECK 1: `new (b ? AuthError : Error)(…)` hatte hinter `new` keinen blossen Namen und
 * lieferte deshalb gemessen `[]` — als „Laufzeit-Klassenwahl" ausdrücklich als Grenze festgehalten.
 * Sie ist keine: im Quelltext STEHT, dass hier ein `AuthError` entstehen KANN, und ein Wächter, der
 * erst dann etwas sagt, wenn nur noch eine Klasse in Frage kommt, schweigt genau bei dem Fall, den
 * jemand einbaut, um ihn zum Schweigen zu bringen. Gemeldet wird der geschriebene Name — der
 * Mensch soll lesen, was dasteht.
 *
 * RUNDE 2, KORREKTURPFLICHT 1 DES PRÜFERS — WARUM NICHT „DER ERSTE BEKANNTE NAME IM AUSDRUCK":
 * Genau so las Runde 1, und BEN hat das mit zwei Zeilen widerlegt. `throw new (void AuthError,
 * BenError)("FORBIDDEN", "USER_NOT_FOUND");` erzeugt `BenError`; der Kommaoperator VERWIRFT seinen
 * linken Teil. Runde 1 meldete `AuthError`/`wurzel`, stufte damit eine unerlaubte Unterklasse zur
 * Wurzel herab, und weil das zweite Argument ein gültiger Katalogschlüssel ist, blieb D grün —
 * gemessen ein RÜCKSCHRITT gegenüber dem abgelösten Abtaster, der den letzten freien Kommateil las.
 * Die Gegenrichtung ebenso: `new (void AuthError, Error)("Nur Admins duerfen das.")` erzeugt einen
 * gewöhnlichen `Error`, und Runde 1 meldete den Fehlalarm `AuthError ohne Meldung erzeugt`.
 * Beide Formen stehen seither als dauerhafte D.0-Fälle im Lauf.
 *
 * DIE DREI REGELN, die daraus folgen — jede einzeln in D.0 kalibriert:
 *   KOMMA (`a, b`) und `&&`      → nur der RECHTE Operand; der linke ist verworfen bzw. unbrauchbar.
 *   `?:`, `??`, `||`            → BEIDE Zweige; beide sind erreichbar, und nur den ersten zu melden
 *                                 hiesse, die Unterklassenregel über die Zweigreihenfolge
 *                                 abschaltbar zu machen (BEN, Prüflücke 6).
 *   alles andere                → nur, wenn der Ausdruck SELBST eine Namenskette ist.
 *
 * DIE KOSTEN, offen benannt: ein Konstruktorausdruck, dessen Wert erst zur Laufzeit entsteht
 * (`new (registrierung[schluessel])(…)`, `new (mischung(AuthError))(…)`), liefert KEINE Stelle —
 * dort steht im Quelltext wirklich nicht, was gebaut wird, und ein geratener Name wäre ein
 * Fehlalarm ohne Fundstelle. Das ist dieselbe Grenze, die der abgelöste Abtaster hatte; sie wird
 * hier nicht enger, aber auch nicht stillschweigend weiter.
 */
function konstruktorklassen(
  ausdruck: ts.Expression,
  nachArt: ReadonlyMap<string, Fehlerklasse["art"]>,
): { name: string; art: Fehlerklasse["art"] }[] {
  const treffer: { name: string; art: Fehlerklasse["art"] }[] = [];
  const gesehen = new Set<string>();
  const sammle = (n: ts.Expression): void => {
    const kern = ohneHuellen(n);
    if (ts.isBinaryExpression(kern)) {
      const zeichen = kern.operatorToken.kind;
      if (
        zeichen === ts.SyntaxKind.CommaToken ||
        zeichen === ts.SyntaxKind.AmpersandAmpersandToken
      ) {
        sammle(kern.right);
        return;
      }
      if (
        zeichen === ts.SyntaxKind.QuestionQuestionToken ||
        zeichen === ts.SyntaxKind.BarBarToken
      ) {
        sammle(kern.left);
        sammle(kern.right);
        return;
      }
      return;
    }
    if (ts.isConditionalExpression(kern)) {
      sammle(kern.whenTrue);
      sammle(kern.whenFalse);
      return;
    }
    const name = namensKette(kern);
    if (name === undefined) {
      return;
    }
    const art = artFuer(name, nachArt);
    if (art === undefined || gesehen.has(name)) {
      return;
    }
    gesehen.add(name);
    treffer.push({ name, art });
  };
  sammle(ausdruck);
  return treffer;
}

/**
 * Jede Stelle in `quelle`, an der eine der `klassen` mit `new` erzeugt wird — jeder
 * `NewExpression`-Knoten des Syntaxbaums, in Quelltextreihenfolge.
 *
 * Was der Baum dabei ohne eigenes Zutun richtig macht und die abgelöste Klammer-, Komma- und
 * Namensarithmetik einzeln erkämpfen musste: ein Kommentar mitten in der Argumentliste gehört nicht
 * zum Argument (`getStart` überspringt ihn), ein Komma IN einer Zeichenkette zerlegt die Liste
 * nicht, `new Foo<Bar>()` trägt seine Typargumente getrennt von den Argumenten, und ein `new` in
 * einem Kommentar, einer Zeichenkette oder einem Regex-Literal ist gar kein Knoten.
 *
 * `argumente` ist bewusst ROHTEXT und nicht der ausgewertete Wert: Wächter D entscheidet mit
 * `alsLiteral`, ob dieser Text ein Literal IST, und meldet den Text, wenn nicht. Ein fehlendes
 * Argument ist kein Eintrag, nicht `undefined`.
 */
export function erzeugungsstellen(
  quelle: string,
  klassen: readonly Fehlerklasse[],
): Erzeugungsstelle[] {
  const sf = baum(quelle);
  const nachArt = new Map(klassen.map((k) => [k.name, k.art]));
  const stellen: Erzeugungsstelle[] = [];
  const gehe = (n: ts.Node): void => {
    if (ts.isNewExpression(n)) {
      // Eine Laufzeitwahl kann MEHRERE Klassen erzeugen; dann steht jede mit derselben Zeile und
      // denselben Argumenten da. Nur die erste zu melden hiesse, die zweite zu verschenken.
      for (const treffer of konstruktorklassen(n.expression, nachArt)) {
        stellen.push({
          klasse: treffer.name,
          art: treffer.art,
          zeile: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
          argumente: (n.arguments ?? []).map((a) => a.getText(sf).trim()),
        });
      }
    }
    ts.forEachChild(n, gehe);
  };
  ts.forEachChild(sf, gehe);
  return stellen;
}

const ENTKOMMEN: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v" };

/** Der Text hinter den Begrenzern — Escapes aufgelöst, für alle drei Anführungsarten gleich. */
function entkommen(inhalt: string): string {
  let ergebnis = "";
  let i = 0;
  while (i < inhalt.length) {
    const c = inhalt[i] ?? "";
    if (c !== "\\") {
      ergebnis += c;
      i += 1;
      continue;
    }
    const naechstes = inhalt[i + 1] ?? "";
    if (naechstes === "u" && inhalt[i + 2] === "{") {
      const zu = inhalt.indexOf("}", i + 3);
      if (zu > 0) {
        ergebnis += String.fromCodePoint(Number.parseInt(inhalt.slice(i + 3, zu), 16));
        i = zu + 1;
        continue;
      }
    }
    if (naechstes === "u" || naechstes === "x") {
      const stellen = naechstes === "u" ? 4 : 2;
      ergebnis += String.fromCharCode(Number.parseInt(inhalt.slice(i + 2, i + 2 + stellen), 16));
      i += 2 + stellen;
      continue;
    }
    ergebnis += ENTKOMMEN[naechstes] ?? naechstes;
    i += 2;
  }
  return ergebnis;
}

/**
 * Der Wert eines Arguments, WENN es ein Zeichenkettenliteral ist — sonst `undefined`.
 *
 * Nachgestellte Typzusagen (`satisfies Meldungsschluessel`, `as const`) werden abgetragen: sie
 * ändern den Wert nicht, und der ganze Bestand schreibt genau so. Eine Vorlage MIT Einsetzung, ein
 * Bezeichner und ein Elementzugriff sind KEIN Literal — und das ist in Wächter D ein Verstoss,
 * nicht ein „unbekannt": ein Wächter, der wegsieht, sobald es unübersichtlich wird, ist genau dort
 * blind, wo er gebraucht wird.
 */
export function alsLiteral(argument: string): string | undefined {
  let rest = argument.trim();
  for (let runde = 0; runde < 8 && rest !== ""; runde += 1) {
    const vorher = rest;
    const struktur = nurStruktur(rest);
    if (struktur.startsWith("(") && struktur.endsWith(")")) {
      let tiefe = 0;
      let paar = true;
      for (let i = 0; i < struktur.length; i += 1) {
        tiefe += struktur[i] === "(" ? 1 : struktur[i] === ")" ? -1 : 0;
        if (tiefe === 0 && i < struktur.length - 1) {
          paar = false;
          break;
        }
      }
      if (paar) {
        rest = rest.slice(1, -1).trim();
      }
    }
    // Die Typzusage wird in der STRUKTUR gesucht: ein „ satisfies X" innerhalb eines Textes ist
    // Text und darf nicht abgetragen werden.
    const zusage = /\s(?:satisfies|as)\s+[A-Za-z_$][\w$.<>[\]|\s]*$/.exec(nurStruktur(rest));
    if (zusage) {
      rest = rest.slice(0, zusage.index).trim();
    }
    if (rest === vorher) {
      break;
    }
  }
  const anfang = rest.charAt(0);
  if (anfang !== '"' && anfang !== "'" && anfang !== "`") {
    return undefined;
  }
  if (zeichenketteEnde(rest, 0) !== rest.length) {
    return undefined; // etwas steht dahinter: `"a" + b`, `"a".trim()` — kein blosses Literal.
  }
  if (anfang === "`" && rest.includes("${")) {
    return undefined; // eine Vorlage MIT Einsetzung ist zur Bauzeit kein fester Text.
  }
  return entkommen(rest.slice(1, -1));
}

/** 1-basierte Zeilennummer eines Zeichenindex. */
export function zeileVon(quelle: string, index: number): number {
  let zeile = 1;
  for (let i = 0; i < index && i < quelle.length; i += 1) {
    if (quelle[i] === "\n") {
      zeile += 1;
    }
  }
  return zeile;
}
