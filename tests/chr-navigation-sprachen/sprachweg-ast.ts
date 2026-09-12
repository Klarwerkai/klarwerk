// ================================================================================================
// JOB 3587 R2 · DIE ERKENNUNG DES WÄCHTERS — ALS EIGENES WERKZEUG, DAMIT SIE SELBST GEPRÜFT WIRD.
// ================================================================================================
//
// WARUM DIESE DATEI ENTSTEHT. In Runde 1 wohnte diese Erkennung im Wächter selbst und konnte nur
// gegen den ECHTEN Bestand laufen. BEN hat sie daraufhin von Hand mit zwei Quelltexten geprüft, die
// es im Bestand (noch) nicht gibt, und beide Male danebengetroffen (`ben.md`, Korrekturpflicht 1):
//   · ein harmloser Beispielsatz in einem `console.log` machte den Wächter ROT,
//   · echter Browsercode, der über eine VARIABLE an `evaluate` ging, blieb GRÜN.
// Beides ist eine Eigenschaft der ERKENNUNG, nicht des Bestands. Sie steht deshalb ab jetzt hier,
// nimmt QUELLTEXT statt eines Dateinamens und wird in `sprachweg-ast.test.ts` mit genau solchen
// Quelltexten kalibriert — jede von BENs Gegenproben ist dort ein dauerhafter Fall.
//
// WAS „AUSFÜHRBAR" IN DIESEM HAUS HEISST. Browsercode steht hier als ZEICHENKETTE im Quelltext und
// wird von `fn(...)` zu einer Funktion gemacht (`tests/design/h6-chromium.ts:109`). Die Grenze
// verläuft deshalb NICHT an „Literal oder nicht" und auch nicht an „Argument oder nicht" (das war
// die Fassung aus Runde 1, und daran ist sie gescheitert), sondern an ZWEI Fragen:
//   1. WER ruft? Nur die Zeichenketten, die in einen AUSFÜHRENDEN Aufruf gehen (`fn`, `evaluate`,
//      `addInitScript`, `new Function`, …), werden im Browser Code. `console.log("…")` führt nichts
//      aus, egal was in der Zeichenkette steht.
//   2. WAS STEHT DRIN? Der Inhalt einer solchen Zeichenkette wird selbst als Quelltext GEPARST und
//      in seinem eigenen Syntaxbaum untersucht. Ein `setItem` in einem Kommentar oder in einer
//      Zeichenkette INNERHALB des Browsercodes ist damit kein Aufruf mehr — dieselbe Lehre, die
//      `tests/tor-inventar/browser-gruppe.ts:20-29` für die Importkanten gezogen hat.
// Dazu kommt die Auflösung über VARIABLEN: eine Zeichenkette, die erst in einer Konstante steht und
// dann übergeben wird, ist derselbe Code (BENs zweiter Fund). Aufgelöst wird innerhalb der Datei
// und, wenn der Aufrufer einen Nachbartext reicht, über EINEN Importsprung.
//
// ZWEI MODI, UND WARUM SIE GETRENNT SEIN MÜSSEN (Runde 3, BENs Korrekturpflicht 1).
// Dieselbe Funktion `statischerText` beantwortet zwei VERSCHIEDENE Fragen, und sie vertragen genau
// gegensätzliche Antworten auf zusammengesetzte Texte:
//
//   · Modus "aussage" — „steht hier ein lesbarer BEGRÜNDUNGSSATZ?" Bei `` `Befund: ${zahl} px` ``
//     trägt der FESTE Teil die Aussage; die Einsetzung ist ein Laufzeitwert und darf fehlen. Ein
//     unbekannter Teil macht den Satz nicht unlesbar, nur ungenau.
//   · Modus "code" — „WAS GENAU wird im Browser ausgeführt?" Hier ist ein weggelassener Teil eine
//     FALSCHAUSSAGE: aus `` fn(`() => { ${rumpf}; }`) `` wurde in Runde 2 der Text `"() => {  ; }"`
//     — scheinbar vollständig, tatsächlich verkürzt, und der Setzer in `rumpf` war spurlos weg.
//     Genau damit hat BEN den Wächter der Runde 2 umgangen (`ben.md`, Korrekturpflicht 1). Ebenso
//     wurde bei `"(" + unbekannt + ")"` der unbekannte Teil still durch Leertext ersetzt.
//
// In diesem Modus gilt deshalb: JEDE Einsetzung und JEDES Glied einer Verkettung wird selbst
// aufgelöst; ist auch nur eines davon nicht nachvollziehbar, ist das GANZE nicht aufgelöst und die
// Stelle geht namentlich (mit der Angabe, welcher Teil fehlte) in die Liste `unklar`. Verkürzen
// gibt es nicht mehr — entweder ganz lesbar oder ausdrücklich unklar.
//
// GRENZEN, ausdrücklich benannt (dieselbe Doktrin wie `browser-gruppe.ts:31-36`):
//   · Berechneter Browsercode (`fn("(" + teil() + ")")` mit einem Teil aus einer Funktion) wird
//     nicht aufgelöst. Er fällt dann nicht durchs Raster, sondern in die Liste `unklar` — der
//     Aufrufer entscheidet, was er damit tut (der Wächter macht daraus einen roten Fall mit Namen).
//   · Mehr als EIN Importsprung wird nicht verfolgt.
//   · Trägt eine Stelle mehr als `MAX_WERTE` mögliche Texte (ein Kreuzprodukt aus Verzweigungen),
//     wird sie nicht ausgerechnet, sondern ebenfalls unklar — lieber laut als langsam.
import ts from "typescript";

/** Der Speicherschlüssel der Sprachwahl des Produkts (`apps/web/src/lib/sprachwahl.ts:23`). */
export const SPRACHE_SCHLUESSEL = "kw.sprache";

/** Der Aufruf, mit dem in den Speicher geschrieben wird. */
const SETZER = "setItem";

/**
 * Aufrufe, deren Zeichenketten-Argumente im Browser AUSGEFÜHRT werden.
 *
 * Die Liste ist nicht geraten: `fn` ist die Hülle dieses Hauses (`h6-chromium.ts:109`,
 * `new Function`), `evaluate`/`evaluateHandle`/`waitForFunction`/`$eval`/`$$eval`/`addInitScript`/
 * `addScriptTag` sind die Playwright-Flächen, die Quelltext annehmen, `Function` und `eval` die
 * beiden Wege der Sprache selbst. Ein Name, der hier fehlt, ist eine Lücke — deshalb steht in
 * `sprachweg-ast.test.ts` ein Fall, der die Liste gegen die tatsächlich benutzte Hülle hält.
 */
export const AUSFUEHRENDE_AUFRUFE = [
  "fn",
  "evaluate",
  "evaluateHandle",
  "waitForFunction",
  "$eval",
  "$$eval",
  "addInitScript",
  "addScriptTag",
  "Function",
  "eval",
] as const;

const AUSFUEHREND = new Set<string>(AUSFUEHRENDE_AUFRUFE);

export interface Fundstelle {
  zeile: number;
  was: string;
}

export interface Setzerbefund {
  /** Der Speicherschlüssel des Produkts in ausführbarer Lage. */
  schluessel: Fundstelle[];
  /** Ein `setItem`, dessen Schlüssel AM AUFRUF steht und der Sprachschlüssel IST. */
  sicher: Fundstelle[];
  /** Ein `setItem`, dessen Schlüssel von aussen kommt (Parameter/Variable) — Schlüssel unbekannt. */
  moeglich: Fundstelle[];
  /** Browsercode, der ausgeführt wird, dessen Quelltext aber nicht aufzulösen war. */
  unklar: Fundstelle[];
  /** Wie viele Browserquellen wirklich geparst wurden — die Kalibrierung der Erkennung. */
  geparsteBrowserquellen: number;
  /** Setzt diese Datei die Sprachwahl selbst? */
  setztSprache: boolean;
  /**
   * Die Datei trägt den Sprachschlüssel UND führt Browsercode aus, den diese Erkennung nicht lesen
   * kann. Das ist nicht „unschuldig": genau so sähe eine Umgehung aus, die sich hinter einem
   * berechneten Quelltext versteckt. Der Wächter behandelt sie wie einen Fund, nur mit anderer
   * Meldung — entweder wird der Quelltext lesbar geschrieben oder `setzeSprache` benutzt.
   */
  verdaechtig: boolean;
}

function baumAus(quelltext: string, herkunft: string): ts.SourceFile {
  return ts.createSourceFile(herkunft, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function zeileVon(knoten: ts.Node, versatz = 0): number {
  return knoten.getSourceFile().getLineAndCharacterOfPosition(knoten.getStart()).line + 1 + versatz;
}

function gehe(knoten: ts.Node, tu: (k: ts.Node) => void): void {
  tu(knoten);
  knoten.forEachChild((kind) => gehe(kind, tu));
}

/** Klammern und `as const` abstreifen — sie ändern den Wert nicht. */
function kern(knoten: ts.Node): ts.Node {
  let jetzt = knoten;
  while (
    ts.isAsExpression(jetzt) ||
    ts.isParenthesizedExpression(jetzt) ||
    ts.isTypeAssertionExpression(jetzt) ||
    ts.isNonNullExpression(jetzt) ||
    ts.isSatisfiesExpression(jetzt)
  ) {
    jetzt = jetzt.expression;
  }
  return jetzt;
}

/** Der Name, unter dem ein Aufruf gerufen wird — `f(…)`, `a.b.f(…)` oder `new F(…)`. */
function aufrufName(knoten: ts.CallExpression | ts.NewExpression): string | undefined {
  const ruf = kern(knoten.expression);
  if (ts.isIdentifier(ruf)) {
    return ruf.text;
  }
  if (ts.isPropertyAccessExpression(ruf)) {
    return ruf.name.text;
  }
  return undefined;
}

// ==================================================================================================
// STATISCHER TEXT — was eine Stelle im Quelltext WIRKLICH für einen Wert trägt.
// ==================================================================================================
//
// Gebraucht an zwei Stellen: für den Browsercode (was wird ausgeführt?) und für den Grund einer
// abgeschalteten Zusage (steht dort wirklich ein Satz?). Beides ist dieselbe Frage.
//
// Das Ergebnis ist eine LISTE, weil eine Stelle mehrere Werte tragen kann (`a ?? b`, `a ? b : c`,
// ein Kartenzugriff). `undefined` heisst „nicht nachvollziehbar" und ist ausdrücklich NICHT dasselbe
// wie „leer": der Aufrufer behandelt beides verschieden.
export type Texte = string[] | undefined;

/** Siehe „ZWEI MODI" im Kopf: `aussage` darf verkürzen, `code` niemals. */
export type Modus = "aussage" | "code";

/** Wie viele mögliche Texte eine Stelle tragen darf, bevor sie als unklar gilt. */
const MAX_WERTE = 12;

export interface Umgebung {
  quelle: ts.SourceFile;
  /** Quelltext eines relativen Nachbarmoduls — EIN Sprung, vom Aufrufer gereicht. */
  nachbarText?: ((spezifizierer: string) => string | undefined) | undefined;
  tiefe: number;
  modus: Modus;
  /**
   * Sammelt, WELCHER Teilausdruck sich nicht auflösen liess. Ohne sie meldete der Wächter nur
   * „nicht auflösbar" und der Mensch müsste raten, was er lesbar hinschreiben soll.
   */
  spur?: string[] | undefined;
}

/** Diese Stelle ist nicht nachvollziehbar — mit Vermerk, damit die Meldung sie benennen kann. */
function nichtAufloesbar(knoten: ts.Node, umgebung: Umgebung): undefined {
  umgebung.spur?.push(knoten.getText().replace(/\s+/g, " ").slice(0, 60));
  return undefined;
}

/**
 * Die Glieder eines zusammengesetzten Textes zusammenfügen — ohne je eines zu verschlucken.
 *
 * Ein `undefined`-Glied macht das GANZE `undefined` (BENs Korrekturpflicht 1). Mehrere mögliche
 * Texte je Glied (`a ?? b`) ergeben das Kreuzprodukt, gedeckelt durch `MAX_WERTE`.
 */
function verbinde(glieder: Texte[]): Texte {
  let bisher = [""];
  for (const glied of glieder) {
    if (glied === undefined) {
      return undefined;
    }
    const naechste: string[] = [];
    for (const anfang of bisher) {
      for (const teil of glied) {
        naechste.push(anfang + teil);
      }
    }
    if (naechste.length > MAX_WERTE) {
      return undefined;
    }
    bisher = naechste;
  }
  return bisher;
}

/** Die Deklaration einer Konstante dieses Namens in dieser Datei. */
function deklaration(quelle: ts.SourceFile, name: string): ts.Node | undefined {
  let gefunden: ts.Node | undefined;
  gehe(quelle, (k) => {
    if (gefunden !== undefined) {
      return;
    }
    if (ts.isVariableDeclaration(k) && ts.isIdentifier(k.name) && k.name.text === name) {
      gefunden = k.initializer;
    }
  });
  return gefunden;
}

/** Aus welchem Modul kommt dieser Name — falls er importiert ist? */
function importQuelle(quelle: ts.SourceFile, name: string): string | undefined {
  let spez: string | undefined;
  gehe(quelle, (k) => {
    if (spez !== undefined || !ts.isImportDeclaration(k) || k.importClause === undefined) {
      return;
    }
    const bindung = k.importClause.namedBindings;
    if (bindung === undefined || !ts.isNamedImports(bindung)) {
      return;
    }
    for (const element of bindung.elements) {
      if (element.name.text === name && ts.isStringLiteralLike(k.moduleSpecifier)) {
        spez = k.moduleSpecifier.text;
      }
    }
  });
  return spez;
}

/** Die Werte aus `new Map([[…, "…"], …])` — der Kartenzugriff, den der Bestand wirklich benutzt. */
function karteWerte(knoten: ts.Node, umgebung: Umgebung): Texte {
  const k = kern(knoten);
  if (!ts.isNewExpression(k) || aufrufName(k) !== "Map") {
    return undefined;
  }
  const liste = k.arguments?.[0] === undefined ? undefined : kern(k.arguments[0] as ts.Node);
  if (liste === undefined || !ts.isArrayLiteralExpression(liste)) {
    return undefined;
  }
  const werte: string[] = [];
  for (const paar of liste.elements) {
    const p = kern(paar);
    if (!ts.isArrayLiteralExpression(p) || p.elements[1] === undefined) {
      return undefined;
    }
    const texte = statischerText(p.elements[1] as ts.Node, umgebung);
    if (texte === undefined) {
      return undefined;
    }
    werte.push(...texte);
  }
  return werte;
}

export function statischerText(knoten: ts.Node, umgebung: Umgebung): Texte {
  if (umgebung.tiefe > 6) {
    return nichtAufloesbar(knoten, umgebung);
  }
  const tiefer: Umgebung = { ...umgebung, tiefe: umgebung.tiefe + 1 };
  const k = kern(knoten);
  if (ts.isStringLiteral(k) || ts.isNoSubstitutionTemplateLiteral(k)) {
    return [k.text];
  }
  // Im CODE-Modus zählt, was JavaScript beim Einsetzen wirklich schreibt: `` `w=${12}px` `` ist
  // vollständig lesbar und darf nicht bloss deshalb als unklar gelten, weil 12 keine Zeichenkette
  // ist. Für die Frage „steht hier ein Begründungssatz?" bleibt eine Zahl dagegen kein Satz.
  if (umgebung.modus === "code") {
    if (ts.isNumericLiteral(k)) {
      return [k.text];
    }
    if (k.kind === ts.SyntaxKind.TrueKeyword) {
      return ["true"];
    }
    if (k.kind === ts.SyntaxKind.FalseKeyword) {
      return ["false"];
    }
    if (k.kind === ts.SyntaxKind.NullKeyword) {
      return ["null"];
    }
  }
  if (ts.isTemplateExpression(k)) {
    if (umgebung.modus === "aussage") {
      // Die festen Teile tragen die AUSSAGE; die Einsetzungen sind Laufzeitwerte. Ein Grund, dessen
      // feste Teile leer sind (`${x}` allein), zählt deshalb als leer — er sagt ohne Lauf nichts.
      const fest = k.head.text + k.templateSpans.map((s) => s.literal.text).join("");
      return [fest];
    }
    // Als CODE gelesen ist eine Einsetzung kein Beiwerk, sondern Teil dessen, was ausgeführt wird
    // (BENs Korrekturpflicht 1): `` fn(`() => { ${rumpf}; }`) `` trägt den Setzer in `rumpf`. Jede
    // Einsetzung wird deshalb selbst aufgelöst, und eine einzige unbekannte macht das Ganze unklar.
    const glieder: Texte[] = [[k.head.text]];
    for (const span of k.templateSpans) {
      glieder.push(statischerText(span.expression, tiefer));
      glieder.push([span.literal.text]);
    }
    const ganz = verbinde(glieder);
    return ganz === undefined ? nichtAufloesbar(k, umgebung) : ganz;
  }
  if (ts.isBinaryExpression(k) && k.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const links = statischerText(k.left, tiefer);
    const rechts = statischerText(k.right, tiefer);
    if (umgebung.modus === "code") {
      // Kein Leertext für unbekannte Glieder: `"(" + baue() + ")"` ergibt NICHT `"()"`, sondern
      // einen unklaren Befund mit Namen. Sonst verschwände der ganze Rumpf lautlos.
      const ganz = verbinde([links, rechts]);
      return ganz === undefined ? nichtAufloesbar(k, umgebung) : ganz;
    }
    if (links === undefined && rechts === undefined) {
      return undefined;
    }
    return [(links?.[0] ?? "") + (rechts?.[0] ?? "")];
  }
  if (
    ts.isBinaryExpression(k) &&
    (k.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken ||
      k.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  ) {
    const links = statischerText(k.left, tiefer);
    const rechts = statischerText(k.right, tiefer);
    if (links === undefined || rechts === undefined) {
      return undefined;
    }
    return [...links, ...rechts];
  }
  if (ts.isConditionalExpression(k)) {
    const ja = statischerText(k.whenTrue, tiefer);
    const nein = statischerText(k.whenFalse, tiefer);
    if (ja === undefined || nein === undefined) {
      return undefined;
    }
    return [...ja, ...nein];
  }
  if (ts.isIdentifier(k)) {
    if (k.text === "undefined") {
      return nichtAufloesbar(k, umgebung);
    }
    const eigene = deklaration(umgebung.quelle, k.text);
    if (eigene !== undefined) {
      return statischerText(eigene, tiefer);
    }
    // EIN Importsprung: die Zeichenkette in ein Nachbarmodul zu verschieben, ändert nichts daran,
    // dass sie ausgeführt wird. Die Nachbarumgebung bekommt KEIN `nachbarText` — damit bleibt es
    // bei genau einem Sprung, ohne dass dafür an der Tiefe gemessen werden muss (bis Runde 2 hing
    // die Schranke an `tiefe > 0`; das schloss einen Import IN einer Einsetzung mit aus, obwohl er
    // dort genauso ausgeführt wird).
    const spez = importQuelle(umgebung.quelle, k.text);
    const text = spez === undefined ? undefined : umgebung.nachbarText?.(spez);
    if (text === undefined) {
      return nichtAufloesbar(k, umgebung);
    }
    const nachbar = baumAus(text, spez ?? "<nachbar>");
    const dort = deklaration(nachbar, k.text);
    return dort === undefined
      ? nichtAufloesbar(k, umgebung)
      : statischerText(dort, {
          quelle: nachbar,
          tiefe: tiefer.tiefe,
          modus: umgebung.modus,
          spur: umgebung.spur,
        });
  }
  // Der Kartenzugriff des Bestands: `KARTE.get(x)` mit einer als Literal gebauten `new Map`.
  if (ts.isCallExpression(k) && aufrufName(k) === "get") {
    const ruf = kern(k.expression);
    if (ts.isPropertyAccessExpression(ruf) && ts.isIdentifier(kern(ruf.expression))) {
      const karte = deklaration(umgebung.quelle, (kern(ruf.expression) as ts.Identifier).text);
      if (karte !== undefined) {
        const werte = karteWerte(karte, tiefer);
        return werte === undefined ? nichtAufloesbar(k, umgebung) : werte;
      }
    }
  }
  return nichtAufloesbar(k, umgebung);
}

// ==================================================================================================
// (a) SETZT SICH JEMAND DIE SPRACHE SELBST?
// ==================================================================================================

/** Ein `setItem`-Aufruf in einem Syntaxbaum — mit dem, was über seinen Schlüssel bekannt ist. */
function sammleSetItem(
  quelle: ts.SourceFile,
  umgebung: Umgebung,
  versatz: number,
  woher: string,
  befund: Setzerbefund,
): void {
  gehe(quelle, (k) => {
    if (!ts.isCallExpression(k)) {
      return;
    }
    const ruf = kern(k.expression);
    if (!ts.isPropertyAccessExpression(ruf) || ruf.name.text !== SETZER) {
      return;
    }
    const erstes = k.arguments[0];
    const schluessel = erstes === undefined ? undefined : statischerText(erstes, umgebung);
    const stelle = { zeile: zeileVon(k, versatz), was: `\`${SETZER}(…)\`${woher}` };
    if (schluessel === undefined) {
      // Der Schlüssel kommt von aussen (Parameter oder Laufzeitwert) — welcher es ist, sagt erst
      // die zweite Hälfte (der Schlüssel in dieser Datei).
      befund.moeglich.push(stelle);
      return;
    }
    if (schluessel.includes(SPRACHE_SCHLUESSEL)) {
      befund.sicher.push({ ...stelle, was: `\`${SETZER}("${SPRACHE_SCHLUESSEL}", …)\`${woher}` });
    }
  });
}

/**
 * Die zwei Hälften eines lokalen Sprachsetzers, getrennt gesucht und erst am Ende zusammengelegt.
 *
 * SCHLÜSSEL: der Speicherschlüssel des Produkts als eigenes Literal irgendwo im Baum (auch als
 * `const K = "kw.sprache"`, die Aliasform, die im Bestand wirklich vorkommt) oder als Literal im
 * GEPARSTEN Browsercode, der ausgeführt wird.
 *
 * SETZER: ein `…setItem(…)` im Baum der Datei oder im geparsten Browsercode. Steht der Schlüssel am
 * Aufruf, ist der Fund SICHER; kommt er von aussen, ist er MÖGLICH und zählt nur zusammen mit der
 * ersten Hälfte. Ein `setItem("kw.theme", …)` ist damit kein Sprachsetzer — auch nicht in einer
 * Datei, die den Sprachschlüssel woanders liest.
 */
export function untersucheQuelle(
  quelltext: string,
  optionen: {
    herkunft?: string;
    nachbarText?: (spezifizierer: string) => string | undefined;
  } = {},
): Setzerbefund {
  const herkunft = optionen.herkunft ?? "<quelltext>";
  const quelle = baumAus(quelltext, herkunft);
  // Alles an dieser Erhebung fragt „was wird AUSGEFÜHRT?" — also durchgehend der strenge Modus, in
  // dem nichts verkürzt wird. Der nachsichtige Modus gehört allein den Begründungstexten unten.
  const umgebung: Umgebung = {
    quelle,
    nachbarText: optionen.nachbarText,
    tiefe: 0,
    modus: "code",
  };
  const befund: Setzerbefund = {
    schluessel: [],
    sicher: [],
    moeglich: [],
    unklar: [],
    geparsteBrowserquellen: 0,
    setztSprache: false,
    verdaechtig: false,
  };

  // Der Schlüssel als eigenes Literal — in JEDER Lage des Baums. Ein Kommentar steht nicht im Baum
  // und kommt hier nie an; eine Zeichenkette, die den Schlüssel bloss ERWÄHNT ("Beispiel: …"), ist
  // kein Literal des Schlüssels und zählt nicht.
  gehe(quelle, (k) => {
    if (
      (ts.isStringLiteral(k) || ts.isNoSubstitutionTemplateLiteral(k)) &&
      k.text === SPRACHE_SCHLUESSEL
    ) {
      befund.schluessel.push({ zeile: zeileVon(k), was: `Literal "${SPRACHE_SCHLUESSEL}"` });
    }
  });

  // Der Setzer in dieser Datei selbst.
  sammleSetItem(quelle, umgebung, 0, "", befund);

  // Und der Setzer im BROWSERCODE: jede Zeichenkette, die in einen ausführenden Aufruf geht, wird
  // als Quelltext geparst und in ihrem eigenen Baum untersucht.
  gehe(quelle, (k) => {
    if (!ts.isCallExpression(k) && !ts.isNewExpression(k)) {
      return;
    }
    const name = aufrufName(k);
    if (name === undefined || !AUSFUEHREND.has(name)) {
      return;
    }
    for (const arg of k.arguments ?? []) {
      const roh = kern(arg);
      // Ein verschachtelter AUSFÜHRENDER Aufruf (`evaluate(fn(code))`) wird an seiner eigenen
      // Stelle behandelt; eine Funktion als Argument ist ohnehin kein Quelltext, und ein Wert, der
      // gar keine Zeichenkette sein kann, auch nicht.
      const nurWert =
        ts.isArrowFunction(roh) ||
        ts.isFunctionExpression(roh) ||
        ts.isObjectLiteralExpression(roh) ||
        ts.isArrayLiteralExpression(roh) ||
        ts.isNumericLiteral(roh) ||
        roh.kind === ts.SyntaxKind.TrueKeyword ||
        roh.kind === ts.SyntaxKind.FalseKeyword ||
        (ts.isCallExpression(roh) && AUSFUEHREND.has(aufrufName(roh) ?? ""));
      if (nurWert) {
        continue;
      }
      // Die Spur ist je Argument frisch: sie sagt hinterher, WELCHER Teil sich nicht lesen liess.
      const spur: string[] = [];
      const texte = statischerText(roh, { ...umgebung, spur });
      if (texte === undefined) {
        // Nicht auflösbar heisst NICHT harmlos: die Stelle wird namentlich gemeldet (die benannte
        // Grenze dieser Erkennung, s. Kopf). Seit Runde 3 steht der fehlende Teil dabei — sonst
        // müsste der Mensch raten, was er lesbar hinschreiben soll.
        const unbekannt = [...new Set(spur)].slice(0, 3);
        const fehlt = unbekannt.length === 0 ? "" : ` (unbekannt: \`${unbekannt.join("`, `")}\`)`;
        const stelle = roh.getText().replace(/\s+/g, " ").slice(0, 40);
        befund.unklar.push({
          zeile: zeileVon(k),
          was: `ausgeführter Browsercode aus \`${stelle}\` — Quelltext nicht auflösbar${fehlt}`,
        });
        continue;
      }
      for (const text of texte) {
        if (!text.includes(SETZER) && !text.includes(SPRACHE_SCHLUESSEL)) {
          continue;
        }
        befund.geparsteBrowserquellen += 1;
        const browser = baumAus(text, `${herkunft}#browsercode`);
        const innen: Umgebung = { quelle: browser, tiefe: 1, modus: "code" };
        const zeile = zeileVon(k);
        gehe(browser, (b) => {
          if (
            (ts.isStringLiteral(b) || ts.isNoSubstitutionTemplateLiteral(b)) &&
            b.text === SPRACHE_SCHLUESSEL
          ) {
            befund.schluessel.push({
              zeile,
              was: `Literal "${SPRACHE_SCHLUESSEL}" im ausgeführten Browsercode`,
            });
          }
        });
        const vorher = { sicher: befund.sicher.length, moeglich: befund.moeglich.length };
        sammleSetItem(browser, innen, 0, " im ausgeführten Browsercode", befund);
        // Der Versatz der Browserquelle ist die Zeile ihres Aufrufs, nicht die Zeile im Schnipsel.
        for (const stelle of befund.sicher.slice(vorher.sicher)) {
          stelle.zeile = zeile;
        }
        for (const stelle of befund.moeglich.slice(vorher.moeglich)) {
          stelle.zeile = zeile;
        }
      }
    }
  });

  befund.setztSprache =
    befund.sicher.length > 0 || (befund.schluessel.length > 0 && befund.moeglich.length > 0);
  befund.verdaechtig =
    !befund.setztSprache && befund.schluessel.length > 0 && befund.unklar.length > 0;
  return befund;
}

/** Die Fundstellen als eine Zeile — der Beleg in der Fehlermeldung des Wächters. */
export function beschreibe(befund: Setzerbefund): string {
  return [...befund.schluessel, ...befund.sicher, ...befund.moeglich]
    .sort((a, b) => a.zeile - b.zeile)
    .map((f) => `Z. ${f.zeile} (${f.was})`)
    .join(", ");
}

// ==================================================================================================
// (b)/(c) DIE ZUSAGEN DER MESSDATEI
// ==================================================================================================

/** Eine als Literal deklarierte Liste — `as const` und Klammern abgestreift. */
export function listeAus(
  quelltext: string,
  name: string,
  herkunft = "<quelltext>",
): (string | number)[] {
  const quelle = baumAus(quelltext, herkunft);
  let gefunden: (string | number)[] | undefined;
  gehe(quelle, (k) => {
    if (!ts.isVariableDeclaration(k) || !ts.isIdentifier(k.name) || k.name.text !== name) {
      return;
    }
    const wert = k.initializer === undefined ? undefined : kern(k.initializer);
    if (wert === undefined || !ts.isArrayLiteralExpression(wert)) {
      return;
    }
    gefunden = wert.elements.map((e) => {
      const el = kern(e);
      if (ts.isStringLiteral(el)) {
        return el.text;
      }
      if (ts.isNumericLiteral(el)) {
        return Number(el.text);
      }
      return `«kein Literal: ${el.getText()}»`;
    });
  });
  if (gefunden === undefined) {
    throw new Error(
      `in ${herkunft} steht keine als Literal deklarierte Liste \`${name}\` mehr — die Prüfmenge hat keine Quelle`,
    );
  }
  return gefunden;
}

/** Die drei engen Achsen, deren Abschaltung ohne Grund nicht durchgehen darf. */
export const ACHSEN = ["ueberlauf", "fenster", "ueberlappung"] as const;

export interface Aufweichung {
  zeile: number;
  achsen: string[];
  /** Der Grund, sofern er als Text WIRKLICH da und nicht leer ist. */
  grund: string | null;
  /** Warum kein Grund gilt — steht in der Fehlermeldung des Wächters. */
  warum: string;
}

/**
 * Trägt diese Stelle einen wirklich vorhandenen, nichtleeren Grund?
 *
 * BENs Korrekturpflicht 2: die Fassung aus Runde 1 nahm jeden nichtliteralen Ausdruck ungeprüft an
 * — auch `grund: undefined`. Geprüft wird jetzt der WERT: fehlt er, ist er `undefined`, leer, oder
 * steht er in einer Variablen mit leerem Inhalt, gilt er nicht. Ist er überhaupt nicht
 * nachvollziehbar (ein Aufruf, ein Feldzugriff), gilt er ebenfalls nicht — dann steht das in der
 * Meldung, und wer ihn behalten will, schreibt ihn als Text hin.
 */
function pruefeGrund(
  knoten: ts.Node | undefined,
  umgebung: Umgebung,
): { grund: string | null; warum: string } {
  if (knoten === undefined) {
    return { grund: null, warum: "kein Grund angegeben" };
  }
  const texte = statischerText(knoten, umgebung);
  if (texte === undefined) {
    return {
      grund: null,
      warum: `der Grund \`${knoten.getText().slice(0, 60)}\` ist kein nachvollziehbarer Text (\`undefined\`, ein Aufruf oder ein Laufzeitwert)`,
    };
  }
  const leere = texte.filter((t) => t.trim() === "");
  if (texte.length === 0 || leere.length > 0) {
    return {
      grund: null,
      warum: `der Grund \`${knoten.getText().slice(0, 60)}\` ist leer`,
    };
  }
  return { grund: texte.join(" | "), warum: "" };
}

/** Jede Stelle, an der eine der drei Achsen abgeschaltet wird. */
export function sammleAufweichungen(quelltext: string, herkunft = "<quelltext>"): Aufweichung[] {
  const quelle = baumAus(quelltext, herkunft);
  // Hier zählt die AUSSAGE, nicht der ausgeführte Text: ein Grund darf eine Zahl einsetzen, solange
  // sein fester Teil den Satz trägt (`Befund: ${px} px Überschuss`). Die Trennung der beiden Modi
  // ist BENs Promptverbesserung aus Runde 2, wörtlich: „Trenne die Prüfung nichtleerer
  // Begründungstexte von der vollständigen Auflösung ausführbaren Browsercodes."
  const umgebung: Umgebung = { quelle, tiefe: 0, modus: "aussage" };
  const gefunden: Aufweichung[] = [];
  gehe(quelle, (k) => {
    // Form 1: `nurGemessen("…")` — der Grund ist das Argument.
    if (ts.isCallExpression(k) && aufrufName(k) === "nurGemessen") {
      const { grund, warum } = pruefeGrund(k.arguments[0], umgebung);
      gefunden.push({ zeile: zeileVon(k), achsen: [...ACHSEN], grund, warum });
      return;
    }
    // Form 2: ein Zusage-Objekt, das eine Achse auf `false` stellt.
    if (!ts.isObjectLiteralExpression(k)) {
      return;
    }
    const felder = new Map<string, ts.Expression | undefined>();
    for (const e of k.properties) {
      if (ts.isPropertyAssignment(e) && (ts.isIdentifier(e.name) || ts.isStringLiteral(e.name))) {
        felder.set(e.name.text, e.initializer);
      }
    }
    const abgeschaltet = ACHSEN.filter((a) => {
      const feld = felder.get(a);
      return feld !== undefined && kern(feld).kind === ts.SyntaxKind.FalseKeyword;
    });
    if (abgeschaltet.length === 0) {
      return;
    }
    const { grund, warum } = pruefeGrund(felder.get("grund"), umgebung);
    gefunden.push({ zeile: zeileVon(k), achsen: [...abgeschaltet], grund, warum });
  });
  return gefunden;
}
