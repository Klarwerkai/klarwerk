// ================================================================================================
// JOB 3586 · DIE AST-ENTSCHEIDUNG: WAS IST EINE AUSGEFÜHRTE ERWARTUNG — UND WAS NUR IHR WORTLAUT.
// ================================================================================================
//
// WOZU ES DIESES MODUL GIBT. Der Freigabe-Wächter in
// `tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts` (F4, F7) schützt Bestandserwartungen: eine
// geschützte Prüfung darf nicht still verschwinden. Drei Runden von JOB 3570 sind an EINER Frage
// gescheitert, und jedes Mal an derselben Wurzel — der Wächter verglich ZEICHEN:
//
//   Runde 1   ein KOMMENTAR („Hier stand einmal expect(alt).toBe(1)") bezahlte den Boden weiter.
//   Runde 2   eine ZEICHENKETTE (`void 'expect(datensatz.status).toBe("error")';`) bezahlte ihn.
//   Runde 3   ein REGEX-LITERAL (`void /expect(datensatz.status).toBe("error");/;`) bezahlte ihn —
//             und diese Stelle war mit Zeichenvergleichen nicht mehr zu halten: ein `/` beginnt ein
//             Regex-Literal oder eine Division, und welches von beidem, weiß nur ein Parser.
//
// Alle drei Male hat Prüfer BEN die Lücke an echtem Material gemessen, nicht vermutet. Die Antwort
// ist deshalb keine vierte Heuristik, sondern der SYNTAXBAUM: eine Erwartung gilt als vorhanden,
// wenn sie als AUFRUF im Baum steht. Ein Kommentar steht dort gar nicht, der Inhalt einer
// Zeichenkette ist ein Textknoten, der Inhalt eines Regex-Literals ebenso — keiner von ihnen ist je
// ein `CallExpression`. Damit fallen alle drei Umgehungen in EINEM Schritt weg, statt einzeln
// nachgepflegt zu werden.
//
// DIESELBE WAHL HAT DAS HAUS SCHON ZWEIMAL GETROFFEN, aus demselben Grund:
// `tests/capture/aufrufer-waechter.test.ts` zählt Identifier-Knoten, weil `grep` einen Aufruf in
// einem Kommentar mitzählte; `tests/tor-chromium-abbau/probe-beschriftet-sich-als-probe.test.ts`
// prüft Vergleiche über den Baum und verfolgt dabei die Namen, unter denen `expect` erreichbar ist.
// Die Aliasverfolgung unten ist bewusst dieselbe Bauart wie dort (Lehre aus JOB 3579 R1: ein
// AST-Wächter, der nur das Wort „expect" kennt, übersieht `const pruefe = expect`).
//
// KEINE NEUE ABHÄNGIGKEIT: `typescript` liegt seit jeher im Projekt (`package.json`) und wird von
// den beiden genannten Wächtern bereits so benutzt.
//
// WAS DIESES MODUL NICHT IST: keine Typprüfung und keine Auswertung. Es sagt, ob an einer
// Zeichenstelle ein `expect(…)`-AUFRUF beginnt, der im Baum steht und nicht syntaktisch
// unerreichbar ist. Ob dieser Aufruf zur Laufzeit auch erreicht wird (`if (schalter)`), ist eine
// Frage an den Lauf und nicht an den Parser; die Grenze steht unten bei `TOTER_ZWEIG` ausdrücklich.
import ts from "typescript";

/** Was eine Quelle an ausgeführten Erwartungen trägt. */
export interface Erwartungsbefund {
  /** Zeichenstelle jedes ausgeführten `expect(`-Aufrufs, aufsteigend, bezogen auf die Quelle. */
  readonly stellen: readonly number[];
  /** Unter welchen Namen `expect` in dieser Quelle erreichbar ist — mindestens `expect` selbst. */
  readonly namen: readonly string[];
}

/**
 * TOTER_ZWEIG — was als „steht zwar da, läuft aber nie" gilt.
 *
 * Der Auftrag verlangt neben Kommentar, Zeichenkette und Regex-Literal auch den toten Zweig. Was
 * hier erkannt wird, ist SYNTAKTISCH entschieden und damit belegbar:
 *
 *   1. alles hinter `return`, `throw`, `break`, `continue` in derselben Anweisungsliste,
 *   2. der nie genommene Zweig eines `if` mit konstanter Bedingung (`if (false)`, `if (!true)`),
 *   3. der Rumpf einer Schleife mit konstant falscher Bedingung — `while (false)` UND
 *      `for (…; false; …)`,
 *   4. der tote Teil eines konstanten Kurzschlusses (`false && …`, `true || …`) und der nie
 *      genommene Zweig einer konstanten Auswahl (`true ? … : hier`).
 *
 * PUNKT 3 UND 4 SIND DIE KORREKTURPFLICHT AUS RUNDE 1 (Prüfer BEN, JOB 3586). Runde 1 behandelte
 * `if` und `while`; der `for`-Rumpf lief über den allgemeinen Baumgang mit. BEN hat das an echtem
 * Material gemessen: V3c, ersetzt durch `for (; false;) { expect(datensatz.status).toBe("error"); }`,
 * blieb grün — die teuerste Erwartung der Fläche war damit still abzuschalten. Die Verstellung steht
 * seitdem dauerhaft in `./vier-proben.test.ts` (P5b), zusammen mit den Formen aus Punkt 4.
 *
 * WAS DABEI WEITERLÄUFT und deshalb weiter zählt — die Gegenrichtung ist in P5b genauso gemessen:
 * der KOPF einer `for`-Schleife (`for (let i = expect(…); false; )` wertet den Anfangsteil aus),
 * `for (;;)` ohne Bedingung, `while (true)` und `do … while (false)` (läuft genau einmal).
 *
 * Was hier AUSDRÜCKLICH NICHT erkannt wird: eine Bedingung, die erst zur Laufzeit falsch ist
 * (`if (schalter)`), eine Funktion, die niemand ruft, ein `it.skip`. Das erste ist keine
 * Parserfrage; das dritte bewacht der Freigabe-Wächter längst an anderer Stelle (er verbietet
 * `.skip(`, `.only(`, `.todo(`, `.fails(` in den geführten Dateien). Ebenso wenig erkannt wird eine
 * Konstante, die erst über einen Namen konstant ist (`const AUS = false; if (AUS) …`) — das
 * verlangte eine Namensauflösung, die dieser Wächter nicht hat. Diese Aufzählung ist die ganze
 * Zusicherung — mehr steht hier nicht, damit niemand aus ihr mehr liest, als sie trägt.
 *
 * Die vier Punkte stehen unten im Baumgang: `istEndgueltig` (1), `ts.isIfStatement` (2),
 * `ts.isWhileStatement`/`ts.isForStatement` (3), `ts.isBinaryExpression`/`ts.isConditionalExpression`
 * (4).
 */
function istEndgueltig(anweisung: ts.Statement): boolean {
  return (
    ts.isReturnStatement(anweisung) ||
    ts.isThrowStatement(anweisung) ||
    ts.isBreakStatement(anweisung) ||
    ts.isContinueStatement(anweisung)
  );
}

/** `true`/`false` als Bedingung — auch über eine Kette von `!`. Alles andere: unbekannt. */
function konstanteBedingung(ausdruck: ts.Expression): boolean | undefined {
  if (ausdruck.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (ausdruck.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isParenthesizedExpression(ausdruck)) return konstanteBedingung(ausdruck.expression);
  if (
    ts.isPrefixUnaryExpression(ausdruck) &&
    ausdruck.operator === ts.SyntaxKind.ExclamationToken
  ) {
    const innen = konstanteBedingung(ausdruck.operand);
    return innen === undefined ? undefined : !innen;
  }
  return undefined;
}

/** Der Eigenschaftsname einer Zerlegung: `{ expect: pruefe }` → `expect`. */
function eigenschaftsname(element: ts.BindingElement): string | undefined {
  const name = element.propertyName ?? element.name;
  return ts.isIdentifier(name) ? name.text : undefined;
}

/**
 * Alle Namen, unter denen einer aus `namen` in dieser Quelle erreichbar ist — als Fixpunkt.
 *
 * Erfasst die Weiterreichung (`const pruefe = expect;`) und die Zerlegung
 * (`const { expect: pruefe } = await import("vitest");`), beide beliebig oft hintereinander. Das
 * ist kein vollständiger Namensauflöser (kein Gültigkeitsbereich, keine Neuzuweisung) — es ist
 * genau die Menge Tarnungen, die Prüfer BEN in JOB 3579 Runde 1 an einem anderen AST-Wächter
 * gemessen hat. Für DIESEN Wächter ist ein übersehener Alias die sichere Richtung: er zählt dann zu
 * WENIG Erwartungen, und zu wenig heißt rot.
 */
function mitAliasen(ast: ts.SourceFile, namen: Iterable<string>): Set<string> {
  const alle = new Set(namen);
  for (let gewachsen = true; gewachsen; ) {
    gewachsen = false;
    const nimm = (name: string): void => {
      if (!alle.has(name)) {
        alle.add(name);
        gewachsen = true;
      }
    };
    const besuche = (n: ts.Node): void => {
      if (ts.isVariableDeclaration(n) && n.initializer !== undefined) {
        if (
          ts.isIdentifier(n.name) &&
          ts.isIdentifier(n.initializer) &&
          alle.has(n.initializer.text)
        ) {
          nimm(n.name.text);
        } else if (ts.isObjectBindingPattern(n.name)) {
          for (const e of n.name.elements) {
            if (ts.isIdentifier(e.name) && alle.has(eigenschaftsname(e) ?? "\0")) {
              nimm(e.name.text);
            }
          }
        }
      }
      ts.forEachChild(n, besuche);
    };
    ts.forEachChild(ast, besuche);
  }
  return alle;
}

/** Unter welchem Namen kommt `expect` herein? Ohne Einfuhr gilt der eigene Name. */
function eingefuehrteNamen(ast: ts.SourceFile): Set<string> {
  const eingefuehrt = new Set<string>();
  ts.forEachChild(ast, (k) => {
    if (!ts.isImportDeclaration(k)) return;
    const bindungen = k.importClause?.namedBindings;
    if (bindungen === undefined || !ts.isNamedImports(bindungen)) return;
    for (const e of bindungen.elements) {
      if ((e.propertyName ?? e.name).text === "expect") {
        eingefuehrt.add(e.name.text);
      }
    }
  });
  // Ohne Einfuhrzeile bleibt `expect` der Name: der Freigabe-Wächter liest auch ABGESCHNITTENE
  // Stücke (seinen eigenen Bestandsteil, der vor der Einfuhr endet) und Proben ohne Kopfzeilen.
  if (eingefuehrt.size === 0) eingefuehrt.add("expect");
  return eingefuehrt;
}

/**
 * Die Zeichenstellen aller AUSGEFÜHRTEN `expect(…)`-Aufrufe einer Quelle.
 *
 * Gezählt wird der Aufruf, dessen gerufener Ausdruck ein Bezeichner aus `namen` ist — also
 * `expect(x)`, nicht `expect.soft(x)` und nicht `expect.hasAssertions()`. Das ist dieselbe Grenze,
 * die der abgelöste Zeichenvergleich (`/expect\(/`) hatte, und sie bleibt absichtlich dort: dieser
 * Auftrag tauscht die TECHNIK, nicht den bewachten Bestand.
 *
 * Die Stelle ist der Anfang des Bezeichners. Damit deckt sie sich mit der Stelle, an der derselbe
 * Wortlaut im Text steht — darauf beruht die namentliche Prüfung (F7) in `erwartungLaeuft`.
 *
 * FAIL-CLOSED: `ts.createSourceFile` wirft bei kaputter Syntax nicht, sondern liefert einen
 * unvollständigen Baum. Dann fehlen Aufrufe, der Boden unterschreitet seinen Eintrag, und der
 * Wächter wird rot. Eine unlesbare Datei ist damit nie still grün.
 */
export function erwartungsstellen(quelle: string, dateiname: string): Erwartungsbefund {
  const ast = ts.createSourceFile(
    dateiname,
    quelle,
    ts.ScriptTarget.Latest,
    true,
    dateiname.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const namen = mitAliasen(ast, eingefuehrteNamen(ast));
  const stellen: number[] = [];

  const besuche = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && namen.has(n.expression.text)) {
      stellen.push(n.expression.getStart(ast));
    }
    if (ts.isIfStatement(n)) {
      const fest = konstanteBedingung(n.expression);
      besuche(n.expression);
      if (fest !== false) besuche(n.thenStatement);
      if (fest !== true && n.elseStatement !== undefined) besuche(n.elseStatement);
      return;
    }
    if (ts.isWhileStatement(n)) {
      besuche(n.expression);
      if (konstanteBedingung(n.expression) !== false) besuche(n.statement);
      return;
    }
    if (ts.isForStatement(n)) {
      // Der Anfangsteil läuft IMMER, auch bei toter Bedingung — deshalb steht er vor dem Ausstieg.
      if (n.initializer !== undefined) besuche(n.initializer);
      if (n.condition !== undefined) besuche(n.condition);
      // Ohne Bedingung (`for (;;)`) läuft der Rumpf; mit konstant falscher Bedingung nie — und dann
      // läuft auch der Fortschaltteil nicht, denn der kommt erst nach dem ersten Durchlauf.
      if (n.condition !== undefined && konstanteBedingung(n.condition) === false) return;
      if (n.incrementor !== undefined) besuche(n.incrementor);
      besuche(n.statement);
      return;
    }
    if (ts.isConditionalExpression(n)) {
      const fest = konstanteBedingung(n.condition);
      besuche(n.condition);
      if (fest !== false) besuche(n.whenTrue);
      if (fest !== true) besuche(n.whenFalse);
      return;
    }
    if (ts.isBinaryExpression(n)) {
      const art = n.operatorToken.kind;
      const kurzschluss =
        art === ts.SyntaxKind.AmpersandAmpersandToken || art === ts.SyntaxKind.BarBarToken;
      if (kurzschluss) {
        besuche(n.left);
        const fest = konstanteBedingung(n.left);
        const totRechts =
          (art === ts.SyntaxKind.AmpersandAmpersandToken && fest === false) ||
          (art === ts.SyntaxKind.BarBarToken && fest === true);
        if (!totRechts) besuche(n.right);
        return;
      }
    }
    if (ts.isSourceFile(n) || ts.isBlock(n) || ts.isCaseClause(n) || ts.isDefaultClause(n)) {
      for (const anweisung of n.statements) {
        besuche(anweisung);
        // Was hinter einem Rücksprung steht, läuft nicht mehr — und zählt deshalb nicht mit.
        if (istEndgueltig(anweisung)) return;
      }
      return;
    }
    ts.forEachChild(n, besuche);
  };
  besuche(ast);

  stellen.sort((a, b) => a - b);
  return { stellen, namen: [...namen].sort() };
}

/** Wie viele ausgeführte Erwartungen im Bereich `[von, bis)` liegen. */
export function zaehleErwartungen(befund: Erwartungsbefund, von: number, bis: number): number {
  return befund.stellen.filter((s) => s >= von && s < bis).length;
}

/**
 * Die Stellen, an denen der WORTLAUT `erwartung` steht UND ein Aufruf beginnt — im Bereich.
 *
 * Beides zusammen, denn einzeln ist jedes zu haben: den Wortlaut hat auch eine Zeichenkette, den
 * Aufruf hat auch jede andere Erwartung. Gesucht wird in der ROHEN Quelle; eine Erwähnung in einem
 * Kommentar kann nie treffen, weil dort kein Aufruf beginnt.
 */
export function erwartungLaeuft(
  quelle: string,
  befund: Erwartungsbefund,
  erwartung: string,
  bereich: { readonly von: number; readonly bis: number },
): number[] {
  const stellen = new Set(befund.stellen);
  const gefunden: number[] = [];
  for (let i = quelle.indexOf(erwartung); i >= 0; i = quelle.indexOf(erwartung, i + 1)) {
    if (i >= bereich.von && i < bereich.bis && stellen.has(i)) gefunden.push(i);
  }
  return gefunden;
}
