// ================================================================================================
// JOB 3581 · UX-28-REST — EIN AUSFALL IST KEIN MESSERFOLG.
// ================================================================================================
//
// DAS PROBLEM. `tests/tor-inventar/chromium-prozesszahl.test.ts` (C1) ist der einzige Fall, der die
// Chromium-Prozesszahl dieses Hauses misst. Sein `!gemessen`-Zweig verlangte bis hierher nur, DASS
// ein Fehler vorliegt (`expect(fehler.length).toBeGreaterThan(0)`), nie WELCHER. Damit endete eine
// macOS-Sandbox, die den Browserstart verweigert, in derselben gruenen Zeile wie eine echte
// Regression nach erfolgreichem Start — leere CDP-Prozessliste, Zeitgrenze, gescheitertes
// `close()`. BEN hat genau das an JOB 3560 festgehalten: „Ein gruener Prozesszahltest bedeutet bei
// dokumentiertem Ausfall keine erfolgreiche Prozessmessung" (`archiv/3560/runde-2/ben.md:36`).
//
// DIESE DATEI STARTET KEINEN BROWSER. Sie importiert Playwright nicht und nennt es nur in Text —
// dieselbe Trennung, die `tor-bestand-vollstaendig.test.ts` (B5) am Bestand belegt: eine blosse
// NENNUNG macht eine Datei nicht zur Browser-Datei. C1 liest sie als DATEI (`readFileSync`), nicht
// als Modul; ein Import wuerde die Importhuelle von C1 erben und diese Datei in die serielle
// Browser-Gruppe ziehen (`tests/tor-inventar/browser-gruppe.ts:15-18`).
//
// DREI GRUPPEN:
//   M1–M5 messen die Klassifizierung an den Fehlergestalten, die im Bestand tatsaechlich
//         vorkommen. Sie sind reine Rechnung: gleicher Eingang, gleiches Urteil, ohne Umgebung.
//   W1/W2 sind WAECHTER UEBER DEN SYNTAXBAUM von C1. Sie fragen nicht, ob dort ein Wort steht,
//         sondern ob dort ein AUFRUF steht und eine AUSGEFUEHRTE Erwartung daran haengt.
//   W3    prueft die Waechterlogik selbst an Attrappen, die sich NUR in der Ausfuehrungslage
//         unterscheiden — der Negativfall, den BEN an Runde 1 vermisst hat.
//
// WARUM UEBER DEN SYNTAXBAUM UND NICHT UEBER EINE TEXTSUCHE — die Lehre aus JOB 3570 R1 („F4 laesst
// geloeschte Bestandserwartungen durch, weil ein Kommentar als Ersatz mitzaehlt", LEHREN.md) und aus
// JOB 3565 R2 (Kommentarfilter); dieselbe Doktrin mit Begruendung in `browser-gruppe.ts:20-36`.
// Kommentare kommen im AST gar nicht vor. Zusaetzlich wird der Aufruf an seiner HERKUNFT
// festgemacht: er zaehlt nur, wenn der gerufene Name der aus `./prozesszahl-ausfall` importierte
// ist und in C1 KEINE zweite Bindung desselben Namens existiert. Eine gleichnamige lokale
// Funktion, eine Weiterreichung (`const klassifiziereAusfall = () => …`) und ein Alias erfuellen
// W1 damit nicht.
import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";
import { klassifiziereAusfall } from "../tor-inventar/prozesszahl-ausfall";

const C1_DATEI = "tests/tor-inventar/chromium-prozesszahl.test.ts";
const MODUL = "./prozesszahl-ausfall";
const FUNKTION = "klassifiziereAusfall";
/** Der Name, an dem der Ausfallzweig in C1 haengt (`chromium-prozesszahl.test.ts:89`). */
const SCHALTER = "gemessen";

// ------------------------------------------------------------------------------------------------
// M1–M4 · die Klassifizierung an den echten Fehlergestalten des Bestands
// ------------------------------------------------------------------------------------------------
describe("M · Ausfallklassen", () => {
  it("M1 · der Browserstart kam gar nicht zurueck → Umgebungsgrenze, erlaubt", () => {
    // Wortlaut eines echten Startabbruchs. Er steht hier als BELEG, nicht als Kriterium: die
    // Klassifizierung darf ihn nicht lesen (LEHREN.md zu JOB 3345: „Fehlermeldungen aus
    // Umgebungsproblemen bitte als Startabbruch, Text lastabhaengig melden, nicht als feste
    // Eigenschaft — der Pruefer sieht auf derselben Maschine oft einen anderen Text").
    const start =
      "browserType.launch: Target page, context or browser has been closed\n" +
      "Browser logs:\n<launching> /Users/x/Library/Caches/ms-playwright/chromium-1148/" +
      "chrome-mac/Chromium.app/Contents/MacOS/Chromium --disable-field-trial-config …\n" +
      "<launched> pid=41235\n[pid=41235][err] dyld: Operation not permitted";
    const urteil = klassifiziereAusfall({ gestartet: false, fehler: [start] });
    expect(urteil.klasse).toBe("umgebung");
    expect(urteil.erlaubt).toBe(true);
    expect(urteil.grund).toContain(start);
  });

  it("M2 · leere CDP-Prozessliste nach erfolgreichem Start → Befund, nicht erlaubt", () => {
    // `chromium-prozesszahl.test.ts:66-67` — der Wurf entsteht erst NACH dem Start.
    const text = "SystemInfo.getProcessInfo: leere Prozessliste";
    const urteil = klassifiziereAusfall({ gestartet: true, fehler: [text] });
    expect(urteil.klasse).toBe("befund");
    expect(urteil.erlaubt).toBe(false);
    expect(urteil.grund).toContain(text);
  });

  it("M3 · die Messung laeuft in die Zeitgrenze → Befund, nicht erlaubt", () => {
    // `chromium-prozesszahl.test.ts:20` mit der Grenze aus `:76`.
    const text = "Chromium-Prozessmessung: Zeitgrenze 25000ms";
    const urteil = klassifiziereAusfall({ gestartet: true, fehler: [text] });
    expect(urteil.klasse).toBe("befund");
    expect(urteil.erlaubt).toBe(false);
    expect(urteil.grund).toContain(text);
  });

  it("M4 · das Herunterfahren scheitert nach der Messung → Befund, nicht erlaubt", () => {
    // `chromium-prozesszahl.test.ts:83-85` sammelt den gescheiterten `close()` in dieselbe Liste.
    const text = "Chromium-Prozessmessung: Zeitgrenze 5000ms";
    const urteil = klassifiziereAusfall({ gestartet: true, fehler: [text] });
    expect(urteil.klasse).toBe("befund");
    expect(urteil.erlaubt).toBe(false);
    expect(urteil.grund).toContain(text);
  });

  it("M5 · mehrere Fehler nach dem Start: alle Texte woertlich im Grund", () => {
    const texte = [
      "SystemInfo.getProcessInfo: leere Prozessliste",
      "Chromium-Prozessmessung: Zeitgrenze 5000ms",
    ];
    const urteil = klassifiziereAusfall({ gestartet: true, fehler: texte });
    expect(urteil.erlaubt).toBe(false);
    for (const text of texte) {
      expect(urteil.grund).toContain(text);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// Werkzeug der Waechter — der Syntaxbaum von C1
// ------------------------------------------------------------------------------------------------
function baumAus(pfad: string, quelltext: string): ts.SourceFile {
  // `setParentNodes = true`: die Waechter gehen von einem Knoten zu seinem Elternteil hoch.
  return ts.createSourceFile(pfad, quelltext, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function c1Baum(): ts.SourceFile {
  const pfad = repoPfad(C1_DATEI);
  return baumAus(pfad, readFileSync(pfad, "utf8"));
}

function zeile(ast: ts.SourceFile, knoten: ts.Node): number {
  return ast.getLineAndCharacterOfPosition(knoten.getStart(ast)).line + 1;
}

function alleKnoten(wurzel: ts.Node): ts.Node[] {
  const gesammelt: ts.Node[] = [];
  const gehe = (n: ts.Node): void => {
    gesammelt.push(n);
    ts.forEachChild(n, gehe);
  };
  gehe(wurzel);
  return gesammelt;
}

/** Unter welchem Namen ist `ausfuhr` aus `modul` in dieser Datei importiert? */
function importierterName(ast: ts.SourceFile, modul: string, ausfuhr: string): string | undefined {
  let name: string | undefined;
  for (const k of ast.statements) {
    if (!ts.isImportDeclaration(k) || !ts.isStringLiteralLike(k.moduleSpecifier)) {
      continue;
    }
    if (k.moduleSpecifier.text !== modul) {
      continue;
    }
    const bindungen = k.importClause?.namedBindings;
    if (bindungen === undefined || !ts.isNamedImports(bindungen)) {
      continue;
    }
    for (const e of bindungen.elements) {
      if ((e.propertyName ?? e.name).text === ausfuhr) {
        name = e.name.text;
      }
    }
  }
  return name;
}

/**
 * Jede Bindung dieses Namens, die NICHT der Import ist — eine gleichnamige lokale Funktion, eine
 * Variable, ein Parameter, eine Zerlegung. Ist eine davon da, ist der Name in C1 nicht mehr
 * eindeutig die importierte Funktion, und W1 verweigert die Anerkennung.
 */
function fremdeBindungen(ast: ts.SourceFile, name: string): number[] {
  const zeilen: number[] = [];
  for (const n of alleKnoten(ast)) {
    const trifft =
      (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) ||
      (ts.isFunctionDeclaration(n) && n.name?.text === name) ||
      (ts.isParameter(n) && ts.isIdentifier(n.name) && n.name.text === name) ||
      (ts.isBindingElement(n) && ts.isIdentifier(n.name) && n.name.text === name);
    if (trifft) {
      zeilen.push(zeile(ast, n));
    }
  }
  return zeilen;
}

/** Die `then`-Zweige aller `if (!gemessen)`-Anweisungen — strukturell, nicht ueber den Text. */
function ausfallzweige(ast: ts.SourceFile): ts.Statement[] {
  const zweige: ts.Statement[] = [];
  for (const n of alleKnoten(ast)) {
    if (!ts.isIfStatement(n)) {
      continue;
    }
    const bedingung = n.expression;
    if (
      ts.isPrefixUnaryExpression(bedingung) &&
      bedingung.operator === ts.SyntaxKind.ExclamationToken &&
      ts.isIdentifier(bedingung.operand) &&
      bedingung.operand.text === SCHALTER
    ) {
      zweige.push(n.thenStatement);
    }
  }
  return zweige;
}

/** Unter welchen Namen ist `expect` erreichbar — Import und Weiterreichung (JOB 3579 R1). */
function expectNamen(ast: ts.SourceFile): Set<string> {
  const namen = new Set<string>();
  for (const k of ast.statements) {
    if (!ts.isImportDeclaration(k) || !ts.isStringLiteralLike(k.moduleSpecifier)) {
      continue;
    }
    const bindungen = k.importClause?.namedBindings;
    if (bindungen === undefined || !ts.isNamedImports(bindungen)) {
      continue;
    }
    for (const e of bindungen.elements) {
      if ((e.propertyName ?? e.name).text === "expect") {
        namen.add(e.name.text);
      }
    }
  }
  let gewachsen = true;
  while (gewachsen) {
    gewachsen = false;
    for (const n of alleKnoten(ast)) {
      if (!ts.isVariableDeclaration(n) || n.initializer === undefined) {
        continue;
      }
      if (
        ts.isIdentifier(n.name) &&
        ts.isIdentifier(n.initializer) &&
        namen.has(n.initializer.text) &&
        !namen.has(n.name.text)
      ) {
        namen.add(n.name.text);
        gewachsen = true;
      }
    }
  }
  return namen;
}

/** Ist dieser `expect(...)`-Aufruf Teil einer Kette, die in einem Matcher endet? */
function endetInMatcher(aufruf: ts.CallExpression): boolean {
  let knoten: ts.Node = aufruf;
  while (
    knoten.parent !== undefined &&
    ts.isPropertyAccessExpression(knoten.parent) &&
    knoten.parent.expression === knoten
  ) {
    const zugriff = knoten.parent;
    if (
      zugriff.parent !== undefined &&
      ts.isCallExpression(zugriff.parent) &&
      zugriff.parent.expression === zugriff
    ) {
      return true;
    }
    knoten = zugriff;
  }
  return false;
}

/** Der Koerper des `it(...)`-Falls — der Bereich, der laeuft, wenn C1 laeuft. */
function testkoerper(ast: ts.SourceFile): ts.Node | undefined {
  for (const n of alleKnoten(ast)) {
    if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression) || n.expression.text !== "it") {
      continue;
    }
    const koerper = n.arguments[1];
    if (
      koerper !== undefined &&
      (ts.isArrowFunction(koerper) || ts.isFunctionExpression(koerper))
    ) {
      return koerper;
    }
  }
  return undefined;
}

/** Die Variablendeklaration, die diesen Namen in der Datei bindet. */
function deklarationVon(ast: ts.SourceFile, name: string): ts.VariableDeclaration | undefined {
  for (const n of alleKnoten(ast)) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) {
      return n;
    }
  }
  return undefined;
}

/**
 * Wird der Koerper dieser Funktion beim Durchlauf ihrer Umgebung wirklich ausgefuehrt? Das ist
 * genau dann der Fall, wenn sie an Ort und Stelle aufgerufen wird — `(() => { … })()`. Ist sie
 * `async`, muss der Aufruf zusaetzlich abgewartet werden, sonst erreicht ihr Scheitern den Fall
 * nicht mehr. Ein Generator laeuft beim Aufruf gar nicht an.
 */
function sofortAufgerufen(fn: ts.ArrowFunction | ts.FunctionExpression): boolean {
  if (ts.isFunctionExpression(fn) && fn.asteriskToken !== undefined) {
    return false;
  }
  let aussen: ts.Node = fn;
  while (aussen.parent !== undefined && ts.isParenthesizedExpression(aussen.parent)) {
    aussen = aussen.parent;
  }
  const ruf = aussen.parent;
  if (ruf === undefined || !ts.isCallExpression(ruf) || ruf.expression !== aussen) {
    return false;
  }
  const istAsync = fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword) === true;
  if (!istAsync) {
    return true;
  }
  let geklammert: ts.Node = ruf;
  while (geklammert.parent !== undefined && ts.isParenthesizedExpression(geklammert.parent)) {
    geklammert = geklammert.parent;
  }
  return geklammert.parent !== undefined && ts.isAwaitExpression(geklammert.parent);
}

/** Legt dieser Knoten eine eigene, erst spaeter aufgerufene Ausfuehrung an? */
function istFunktionsknoten(n: ts.Node): boolean {
  return (
    ts.isArrowFunction(n) ||
    ts.isFunctionExpression(n) ||
    ts.isFunctionDeclaration(n) ||
    ts.isMethodDeclaration(n) ||
    ts.isGetAccessor(n) ||
    ts.isSetAccessor(n) ||
    ts.isConstructorDeclaration(n) ||
    ts.isClassDeclaration(n) ||
    ts.isClassExpression(n)
  );
}

/**
 * Laeuft dieser Knoten mit, wenn `grenze` laeuft — oder liegt er nur im Syntaxbaum darunter?
 * Liefert bei einem Hindernis dessen Zeile, sonst `undefined`.
 *
 * DAS IST DIE KORREKTUR AUS JOB 3581 R1. BEN hat die Erwartung aus C1 in eine nie aufgerufene
 * Pfeilfunktion verschoben (`void (() => expect(urteil.erlaubt, …).toBe(true));`) und alle Faelle
 * blieben gruen: die alte Fassung sammelte saemtliche Nachfahren des Zweigs ohne Ruecksicht
 * darauf, ob sie je laufen. Eine abgelegte Erwartung ist aber so wenig ein Schutz wie ein
 * Kommentar (JOB 3570 R1). Zwischen Knoten und Grenze darf deshalb keine Funktion stehen, die
 * nicht an Ort und Stelle aufgerufen wird — eine Rueckruffunktion (`forEach`, `then`) zaehlt
 * bewusst auch nicht: ob und wann sie laeuft, entscheidet ein Empfaenger, den der Syntaxbaum
 * nicht kennt.
 */
function ausfuehrungsHindernis(
  ast: ts.SourceFile,
  knoten: ts.Node,
  grenze: ts.Node,
): string | undefined {
  let n: ts.Node | undefined = knoten.parent;
  while (n !== undefined && n !== grenze) {
    if (istFunktionsknoten(n)) {
      const sofort = (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) && sofortAufgerufen(n);
      if (!sofort) {
        return `liegt in einer nicht an Ort und Stelle aufgerufenen Funktion (Zeile ${zeile(ast, n)})`;
      }
    }
    n = n.parent;
  }
  return n === grenze ? undefined : "liegt ausserhalb des geprueften Bereichs";
}

/** Ist dieser Knoten ein Aufruf des importierten Namens? */
function istAufruf(knoten: ts.Node, name: string): boolean {
  return (
    ts.isCallExpression(knoten) &&
    ts.isIdentifier(knoten.expression) &&
    knoten.expression.text === name
  );
}

/**
 * Geht dieser Ausdruck auf das Ergebnis eines Aufrufs von `name` zurueck? Erfasst den direkten
 * Aufruf, den Weg ueber eine Variable (`const urteil = klassifiziereAusfall(...)`) und die
 * Zerlegung (`const { erlaubt } = klassifiziereAusfall(...)`) — die Umgehungsformen aus JOB 3579.
 */
function stammtVomAufruf(ast: ts.SourceFile, knoten: ts.Expression, name: string): boolean {
  if (istAufruf(knoten, name)) {
    return true;
  }
  if (ts.isIdentifier(knoten)) {
    const deklaration = deklarationVon(ast, knoten.text);
    if (deklaration?.initializer !== undefined) {
      return stammtVomAufruf(ast, deklaration.initializer, name);
    }
    // Zerlegung: `const { erlaubt } = klassifiziereAusfall(...)`
    for (const n of alleKnoten(ast)) {
      if (
        ts.isBindingElement(n) &&
        ts.isIdentifier(n.name) &&
        n.name.text === knoten.text &&
        ts.isVariableDeclaration(n.parent.parent) &&
        n.parent.parent.initializer !== undefined
      ) {
        return stammtVomAufruf(ast, n.parent.parent.initializer, name);
      }
    }
  }
  if (ts.isPropertyAccessExpression(knoten)) {
    return stammtVomAufruf(ast, knoten.expression, name);
  }
  return false;
}

/** Die ausgefuehrten Aufrufe von `name` innerhalb eines Zweiges. */
function aufrufeIm(ast: ts.SourceFile, zweig: ts.Node, name: string): number[] {
  const zeilen: number[] = [];
  for (const n of alleKnoten(zweig)) {
    if (istAufruf(n, name) && ausfuehrungsHindernis(ast, n, zweig) === undefined) {
      zeilen.push(zeile(ast, n));
    }
  }
  return zeilen;
}

/**
 * Die ausgefuehrten Erwartungen auf `erlaubt` innerhalb eines Zweiges: ein `expect(...)`-Aufruf,
 * dessen Argument auf das Ergebnis von `klassifiziereAusfall` zurueckgeht und das Feld `erlaubt`
 * betrifft, mit einem Matcher am Ende der Kette.
 */
function erlaubtErwartungen(ast: ts.SourceFile, zweig: ts.Statement, name: string): number[] {
  const namen = expectNamen(ast);
  const zeilen: number[] = [];
  for (const n of alleKnoten(zweig)) {
    if (
      !ts.isCallExpression(n) ||
      !ts.isIdentifier(n.expression) ||
      !namen.has(n.expression.text)
    ) {
      continue;
    }
    const argument = n.arguments[0];
    if (argument === undefined || !endetInMatcher(n)) {
      continue;
    }
    // Eine abgelegte, nie aufgerufene Erwartung ist kein Schutz (JOB 3581 R1, BEN).
    if (ausfuehrungsHindernis(ast, n, zweig) !== undefined) {
      continue;
    }
    const trifftErlaubt = alleKnoten(argument).some(
      (k) =>
        ts.isPropertyAccessExpression(k) &&
        k.name.text === "erlaubt" &&
        stammtVomAufruf(ast, k.expression, name),
    );
    const ueberZerlegung =
      ts.isIdentifier(argument) &&
      argument.text === "erlaubt" &&
      stammtVomAufruf(ast, argument, name);
    if (trifftErlaubt || ueberZerlegung) {
      zeilen.push(zeile(ast, n));
    }
  }
  return zeilen;
}

// ------------------------------------------------------------------------------------------------
// W1/W2 · die Waechter ueber C1
// ------------------------------------------------------------------------------------------------
describe("W · C1 benutzt die Klassifizierung wirklich", () => {
  it("W1 · im !gemessen-Zweig steht ein echter Aufruf und eine ausgefuehrte Erwartung auf erlaubt", () => {
    const ast = c1Baum();
    const name = importierterName(ast, MODUL, FUNKTION);
    expect(name, `${C1_DATEI} importiert ${FUNKTION} nicht aus ${MODUL}`).toBeDefined();
    const gebunden = name as string;

    expect(
      fremdeBindungen(ast, gebunden),
      `In ${C1_DATEI} bindet ausser dem Import noch etwas den Namen ${gebunden}; eine gleichnamige lokale Variable oder Funktion darf diesen Waechter nicht erfuellen`,
    ).toEqual([]);

    const zweige = ausfallzweige(ast);
    expect(
      zweige.length,
      `${C1_DATEI} hat keinen if (!${SCHALTER})-Zweig mehr — wurde der Schalter umbenannt, gehoert dieser Waechter nachgefuehrt`,
    ).toBeGreaterThan(0);

    const aufrufe: number[] = [];
    const erwartungen: number[] = [];
    for (const zweig of zweige) {
      aufrufe.push(...aufrufeIm(ast, zweig, gebunden));
      erwartungen.push(...erlaubtErwartungen(ast, zweig, gebunden));
    }

    expect(
      aufrufe,
      `Im !${SCHALTER}-Zweig von ${C1_DATEI} steht kein ausgefuehrter Aufruf von ${gebunden}. Ein Kommentar, ein fest geschriebenes Urteil oder ein Alias zaehlt hier nicht.`,
    ).not.toEqual([]);

    expect(
      erwartungen,
      `Im !${SCHALTER}-Zweig von ${C1_DATEI} haengt keine ausgefuehrte expect-Kette am Feld ` +
        `erlaubt des ${gebunden}-Ergebnisses — der Befund wuerde C1 also nicht rot faerben.`,
    ).not.toEqual([]);
  });

  it("W2 · der Beleg traegt ausfall und erstelltAm, und erstelltAm wird geprueft", () => {
    const ast = c1Baum();
    const beleg = deklarationVon(ast, "beleg");
    expect(beleg?.initializer, `${C1_DATEI} hat kein Belegobjekt mehr`).toBeDefined();
    const objekt = beleg?.initializer;
    expect(objekt !== undefined && ts.isObjectLiteralExpression(objekt)).toBe(true);
    const felder = (objekt as ts.ObjectLiteralExpression).properties.flatMap((p) =>
      p.name !== undefined && ts.isIdentifier(p.name) ? [p.name.text] : [],
    );
    for (const feld of ["status", "maximum", "messungen", "fehler", "ausfall", "erstelltAm"]) {
      expect(felder, `Dem Beleg in ${C1_DATEI} fehlt das Feld ${feld}`).toContain(feld);
    }

    const namen = expectNamen(ast);
    const koerper = testkoerper(ast);
    expect(koerper, `${C1_DATEI} hat keinen it(...)-Testkoerper mehr`).toBeDefined();
    const bereich = koerper as ts.Node;
    const geprueft = alleKnoten(bereich).some((n) => {
      if (
        !ts.isCallExpression(n) ||
        !ts.isIdentifier(n.expression) ||
        !namen.has(n.expression.text)
      )
        return false;
      const argument = n.arguments[0];
      return (
        argument !== undefined &&
        endetInMatcher(n) &&
        // Auch hier zaehlt nur, was beim Lauf von C1 wirklich ausgefuehrt wird (JOB 3581 R1).
        ausfuehrungsHindernis(ast, n, bereich) === undefined &&
        alleKnoten(argument).some(
          (k) => ts.isPropertyAccessExpression(k) && k.name.text === "erstelltAm",
        )
      );
    });
    expect(
      geprueft,
      `${C1_DATEI} schreibt erstelltAm nur hin, prueft es aber nirgends ausgefuehrt — ein liegen gebliebener Beleg eines frueheren Laufs bliebe damit unerkannt.`,
    ).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// W3 · der Waechter misst AUSFUEHRUNG, nicht blosse Anwesenheit im Syntaxbaum
// ------------------------------------------------------------------------------------------------
//
// BEN an JOB 3581 R1: „`erlaubtErwartungen` durchsucht saemtliche Nachfahren des Zweigs ohne
// Ausfuehrungskontext. Eine nicht aufgerufene Pfeilfunktion erfuellt deshalb W1." Seine Mutation
// `void (() => expect(urteil.erlaubt, …).toBe(true));` liess alle Faelle gruen, obwohl die
// Erwartung nie laeuft. Das ist dieselbe Familie wie die Lehre aus JOB 3570 R1 (ein Kommentar als
// Ersatz): Anwesenheit ist kein Beleg. W3 prueft die Waechterlogik deshalb an Attrappen, deren
// Zweig sich NUR in der Ausfuehrungslage unterscheidet — damit steht der Negativfall dauerhaft im
// Bestand und haengt nicht an einer von Hand wiederholten Gegenprobe.

/** Eine Attrappe in der Gestalt von C1: gleicher Import, gleicher `if (!gemessen)`-Zweig. */
function c1Attrappe(zweigKoerper: string): ts.SourceFile {
  return baumAus(
    "tests/tor-inventar/attrappe.test.ts",
    [
      'import { expect, it } from "vitest";',
      `import { ${FUNKTION} } from "${MODUL}";`,
      'it("Attrappe", () => {',
      `  const ${SCHALTER} = false;`,
      "  const gestartet = false;",
      "  const fehler: string[] = [];",
      `  if (!${SCHALTER}) {`,
      zweigKoerper,
      "  }",
      "});",
    ].join("\n"),
  );
}

/** Aufrufe und Erwartungen im einzigen Ausfallzweig einer Attrappe. */
function attrappenbefund(ast: ts.SourceFile): { aufrufe: number; erwartungen: number } {
  const zweige = ausfallzweige(ast);
  expect(zweige.length, "die Attrappe hat keinen Ausfallzweig").toBe(1);
  const zweig = zweige[0] as ts.Statement;
  return {
    aufrufe: aufrufeIm(ast, zweig, FUNKTION).length,
    erwartungen: erlaubtErwartungen(ast, zweig, FUNKTION).length,
  };
}

const URTEIL = `    const urteil = ${FUNKTION}({ gestartet, fehler });`;
const ERWARTUNG = '    expect(urteil.erlaubt, "Grund").toBe(true);';

describe("W3 · nur eine ausgefuehrte Erwartung zaehlt", () => {
  it("W3a · Aufruf und Erwartung stehen ausgefuehrt im Zweig → beides zaehlt", () => {
    expect(attrappenbefund(c1Attrappe([URTEIL, ERWARTUNG].join("\n")))).toEqual({
      aufrufe: 1,
      erwartungen: 1,
    });
  });

  it("W3b · die Erwartung liegt in einer nie aufgerufenen Pfeilfunktion → sie zaehlt nicht", () => {
    // Woertlich die Mutation aus BENs Pruefung der Runde 1.
    const befund = attrappenbefund(
      c1Attrappe([URTEIL, `    void (() => ${ERWARTUNG.trim()});`].join("\n")),
    );
    expect(befund.aufrufe, "der Aufruf selbst steht weiter ausgefuehrt im Zweig").toBe(1);
    expect(
      befund.erwartungen,
      "eine Erwartung in einer nie aufgerufenen Pfeilfunktion laeuft nie und darf W1 nicht erfuellen",
    ).toBe(0);
  });

  it("W3c · auch der Aufruf zaehlt nicht, wenn er in einer nie aufgerufenen Funktion liegt", () => {
    expect(
      attrappenbefund(c1Attrappe(["    void (() => {", URTEIL, ERWARTUNG, "    });"].join("\n"))),
    ).toEqual({ aufrufe: 0, erwartungen: 0 });
  });

  it("W3d · eine sofort aufgerufene Funktion laeuft wirklich → sie zaehlt", () => {
    // Die Grenze wird an der AUSFUEHRUNG gezogen, nicht an der Verschachtelung: dieser Koerper
    // laeuft beim Durchlauf des Zweigs, also ist die Erwartung eine echte.
    expect(
      attrappenbefund(c1Attrappe(["    (() => {", URTEIL, ERWARTUNG, "    })();"].join("\n"))),
    ).toEqual({ aufrufe: 1, erwartungen: 1 });
  });

  it("W3e · eine nicht abgewartete async-Funktion zaehlt nicht", () => {
    // Sie laeuft zwar an, aber ihr Scheitern erreicht den Fall nicht mehr — die Erwartung
    // verpufft genauso wie in W3b.
    expect(
      attrappenbefund(
        c1Attrappe(["    void (async () => {", URTEIL, ERWARTUNG, "    })();"].join("\n")),
      ),
    ).toEqual({ aufrufe: 0, erwartungen: 0 });
  });
});
