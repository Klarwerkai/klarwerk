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
 *      genommene Zweig einer konstanten Auswahl (`true ? … : hier`),
 *   5. eine Bedingung, die erst über einen NAMEN konstant ist (`const AUS = false; if (AUS) …`),
 *   6. jede `case`-Gruppe eines `switch` mit konstantem Verteiler, die von KEINEM möglichen
 *      Einstieg aus erreichbar ist (`switch (false) { case true: hier }`),
 *   7. der Rumpf eines `for (const x of [])` über einem LEEREN Feldliteral,
 *   8. jeder SPRUNGWERT eines `switch` mit konstantem Verteiler, der hinter einem sicher passenden
 *      `case` steht (`switch (false) { case false: … case hier: … }`) — verglichen wird der Reihe
 *      nach und nur bis zum ersten Treffer, was danach kommt, wertet kein Lauf mehr aus.
 *
 * PUNKT 3 UND 4 SIND DIE KORREKTURPFLICHT AUS RUNDE 1 (Prüfer BEN, JOB 3586). Runde 1 behandelte
 * `if` und `while`; der `for`-Rumpf lief über den allgemeinen Baumgang mit. BEN hat das an echtem
 * Material gemessen: V3c, ersetzt durch `for (; false;) { expect(datensatz.status).toBe("error"); }`,
 * blieb grün — die teuerste Erwartung der Fläche war damit still abzuschalten. Die Verstellung steht
 * seitdem dauerhaft in `./vier-proben.test.ts` (P5b), zusammen mit den Formen aus Punkt 4.
 *
 * PUNKT 5 BIS 7 SIND DER REST, DEN JOB 3586 SELBST BENANNT UND OFFEN GELASSEN HAT (dessen Rückgabe,
 * Abschnitt REST: „Nicht abgedeckt und nicht zugesagt: Konstanten über einen Namen
 * (`const AUS = false`), `switch` mit konstantem Verteiler, `for (const x of [])`"). JOB 3791 holt
 * sie nach; sie stehen als P8, P9 und P10 in `./vier-proben.test.ts` an derselben echten Datei, an
 * der BEN gemessen hat. Die Namensauflösung hinter Punkt 5 ist eine reine BINDUNG im Baum und keine
 * Auswertung: `konstantenTafel` unten nimmt nur Namen an, die in dieser Quelle GENAU EINMAL als
 * `const` an ein `true`/`false`-Literal gebunden und nie wieder angefasst werden.
 *
 * PUNKT 8 IST DIE KORREKTURPFLICHT AUS RUNDE 2 (Prüfer BEN, JOB 3791). Runde 2 trennte richtig,
 * welche GRUPPE ein Lauf betritt, besuchte die SPRUNGWERTE aber alle vorweg — „sie werden
 * verglichen, also ausgewertet". BEN hat gemessen, dass das zu weit ist:
 * `switch (false) { case false: break; case expect(1): break; }` ruft NULLMAL, Runde 2 zählte eins,
 * und damit war eine geführte Erwartung wieder still abzuschalten. Beide Richtungen stehen seitdem
 * in `./vier-proben.test.ts` (P13), Lauf gegen Baum gemessen.
 *
 * WAS DABEI WEITERLÄUFT und deshalb weiter zählt — die Gegenrichtung ist in P5b, P8, P9, P10, P11,
 * P12 und P13 genauso gemessen: der VERTEILER eines `switch` (er wird immer ausgewertet) und jeder
 * Sprungwert VOR dem Treffer (`switch (false) { case expect(…): … case false: … }` vergleicht den
 * ersten sehr wohl), der KOPF einer `for`-Schleife (`for (let i = expect(…); false; )` wertet
 * den Anfangsteil aus) und der durchlaufene Ausdruck eines `for … of`, `for (;;)` ohne Bedingung,
 * `while (true)`, `do … while (false)` (läuft genau einmal), jede Gruppe eines `switch` mit
 * unbekanntem Verteiler, der Durchfall ab jeder erreichten Gruppe (`case` ohne `break`) und — das
 * ist die KORREKTURPFLICHT 1 von Prüfer BEN aus JOB 3791 Runde 1 — alles, was von IRGENDEINEM
 * möglichen Einstieg aus erreichbar ist: ein `case` mit unbekanntem Sprungwert kann treffen oder
 * nicht, sein `break` beendet deshalb nur seinen eigenen Durchfall und nicht den des `default` oder
 * eines späteren, sicher passenden `case`. Weiter zählt außerdem jeder Name, der mehrfach gebunden,
 * neu zugewiesen (auch über eine Zerlegung `[AUS] = …` oder den Kopf `for (AUS of …)`), als
 * `let`/`var` geführt, eingeführt, zerlegt, als Parameter übergeben oder von einem benannten
 * Funktions- oder Klassenausdruck beschattet wird (KORREKTURPFLICHTEN 2 und 3) — der ist UNBEKANNT,
 * und unbekannt heißt lebend.
 *
 * Was hier AUSDRÜCKLICH NICHT erkannt wird:
 *   · eine Bedingung, die erst zur Laufzeit falsch ist (`if (schalter)`) — keine Parserfrage,
 *   · `for (const k in {})` — die Aufzählung eines leeren Objektliterals läuft nie und zählt
 *     trotzdem mit (gemessen in P10, damit die Grenze dasteht statt behauptet zu werden),
 *   · eine Funktion, die niemand ruft,
 *   · ein `it.skip` — das bewacht der Freigabe-Wächter längst an anderer Stelle (er verbietet
 *     `.skip(`, `.only(`, `.todo(`, `.fails(` in den geführten Dateien),
 *   · jeder Wert außer `true`/`false`: `if (0)`, `switch (1) { case 2: … }`, `while ("")` bleiben
 *     lebend, und eine Konstante, die erst über eine andere Konstante konstant wird
 *     (`const A = false; const B = A;`), ebenso.
 * Diese Aufzählung ist die ganze Zusicherung — mehr steht hier nicht, damit niemand aus ihr mehr
 * liest, als sie trägt.
 *
 * Die acht Punkte stehen unten in DEMSELBEN Baumgang, nicht in einem zweiten Abtaster:
 * `istEndgueltig` (1), `ts.isIfStatement` (2), `ts.isWhileStatement`/`ts.isForStatement` (3),
 * `ts.isBinaryExpression`/`ts.isConditionalExpression` (4), `konstantenTafel` in
 * `konstanteBedingung` (5), `ts.isSwitchStatement` (6 und 8 — dieselbe Schleife entscheidet beides,
 * weil es dieselbe Reihenfolge ist), `ts.isForOfStatement` (7).
 */
function istEndgueltig(anweisung: ts.Statement): boolean {
  return (
    ts.isReturnStatement(anweisung) ||
    ts.isThrowStatement(anweisung) ||
    ts.isBreakStatement(anweisung) ||
    ts.isContinueStatement(anweisung)
  );
}

/** Welcher Name steht für welchen festen Wahrheitswert — siehe `konstantenTafel`. */
type Konstantentafel = ReadonlyMap<string, boolean>;

/**
 * `true`/`false` als Bedingung — auch über eine Kette von `!`. Alles andere: unbekannt.
 *
 * Mit `tafel` zählt zusätzlich ein NAME, der dort steht (Punkt 5 in TOTER_ZWEIG). OHNE `tafel`
 * bleibt es bei den Literalen — genau so wird die Tafel selbst gebaut, damit kein Name auf einem
 * anderen Namen ruht und die Auflösung eine einzige Stufe tief bleibt.
 */
function konstanteBedingung(ausdruck: ts.Expression, tafel?: Konstantentafel): boolean | undefined {
  if (ausdruck.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (ausdruck.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isParenthesizedExpression(ausdruck)) {
    return konstanteBedingung(ausdruck.expression, tafel);
  }
  if (
    ts.isPrefixUnaryExpression(ausdruck) &&
    ausdruck.operator === ts.SyntaxKind.ExclamationToken
  ) {
    const innen = konstanteBedingung(ausdruck.operand, tafel);
    return innen === undefined ? undefined : !innen;
  }
  if (ts.isIdentifier(ausdruck)) return tafel?.get(ausdruck.text);
  return undefined;
}

/**
 * Ist dieser Ausdruck das LEERE Feldliteral `[]` — auch in Klammern?
 *
 * Mehr nicht: `[] as string[]`, `[...leer]`, `leer`, `""`, ein Aufruf. Jede dieser Formen kann
 * tragen oder ist ohne Auswertung nicht zu entscheiden, und dieser Wächter wertet nichts aus.
 */
function istLeeresFeld(ausdruck: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(ausdruck)) return istLeeresFeld(ausdruck.expression);
  return ts.isArrayLiteralExpression(ausdruck) && ausdruck.elements.length === 0;
}

/**
 * Jeder Name, den diese ZUWEISUNGSSEITE treffen kann — auch aus `[AUS] = …`, `({AUS} = …)`,
 * `[...rest] = …` und `for (AUS of …)`.
 *
 * Bewusst grob: genommen wird JEDER Bezeichner, der links steht, auch der Eigenschaftsname in
 * `({ a: b } = …)` und das Objekt in `[o.p] = …`. Zu viele Namen zu verderben kostet nur Strenge
 * (verdorben heißt unbekannt heißt lebend heißt gezählt); einen zu übersehen kostete die Richtung —
 * genau das hat Prüfer BEN in Runde 1 an `[AUS] = [true]` gemessen, wo nur ein blanker Bezeichner
 * links erkannt wurde und die Zerlegung durchrutschte.
 */
function zuweisungsziele(ziel: ts.Expression): string[] {
  const gefunden: string[] = [];
  const sammle = (k: ts.Node): void => {
    if (ts.isIdentifier(k)) gefunden.push(k.text);
    ts.forEachChild(k, sammle);
  };
  sammle(ziel);
  return gefunden;
}

/** Jeder Bezeichner, den diese Bindung einführt — auch aus `{ a }` und `[b]` heraus. */
function gebundeneNamen(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  const gefunden: string[] = [];
  for (const element of name.elements) {
    if (ts.isBindingElement(element)) gefunden.push(...gebundeneNamen(element.name));
  }
  return gefunden;
}

/**
 * Welche Namen in dieser Quelle NACHWEISLICH für `true` oder `false` stehen.
 *
 * Aufgenommen wird ein Name nur, wenn er GENAU EINMAL in der ganzen Quelle vorkommt und dort als
 * `const` an ein `true`/`false`-Literal gebunden ist (Klammern und `!`-Kette eingeschlossen). Jede
 * andere Berührung verdirbt ihn dauerhaft: ein zweites `const` gleichen Namens in einem anderen
 * Geltungsbereich, `let`/`var`, eine Neuzuweisung (auch `||=`, `++`, die Zerlegung `[AUS] = …` und
 * der Kopf `for (AUS of …)`), eine Zerlegung bei der Bindung, eine Einfuhr (auch
 * `import AUS = require(…)`), ein Parameter, eine Funktion, eine Klasse, ein `enum`, ein
 * Namensraum — und der NAME EINES FUNKTIONS- ODER KLASSENAUSDRUCKS (`const f = function AUS() {…}`,
 * `class AUS {…}` als Ausdruck): der beschattet in seinem eigenen Rumpf die äußere Konstante und
 * steht dort für sich selbst, also für etwas Wahres. Die letzten beiden Formen sind die
 * Korrekturpflichten 2 und 3 von Prüfer BEN aus Runde 1, an ausführbaren Gegenbeispielen gemessen.
 *
 * WARUM SO GROB: dieser Wächter hat keine Geltungsbereiche und soll auch keine bekommen — eine
 * halbe Namensauflösung, die Schattierung falsch rät, machte unschuldige Bestandsdateien rot. Die
 * grobe Regel hat nur EINE Richtung: im Zweifel unbekannt, unbekannt heißt lebend, lebend heißt
 * gezählt. Gemessen steht diese Richtung in `./vier-proben.test.ts` (P11).
 */
function konstantenTafel(ast: ts.SourceFile): Konstantentafel {
  const wert = new Map<string, boolean>();
  const verdorben = new Set<string>();
  const verdirb = (name: string): void => {
    wert.delete(name);
    verdorben.add(name);
  };
  const binde = (name: string, fest: boolean | undefined): void => {
    if (verdorben.has(name)) return;
    // Zweite Bindung desselben Namens oder kein Literal dahinter: ab jetzt unbekannt.
    if (fest === undefined || wert.has(name)) {
      verdirb(name);
      return;
    }
    wert.set(name, fest);
  };

  const besuche = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n)) {
      const liste = n.parent;
      const istConst =
        ts.isVariableDeclarationList(liste) && (liste.flags & ts.NodeFlags.Const) !== 0;
      for (const name of gebundeneNamen(n.name)) {
        // Nur die schlichte Form `const NAME = <Literal>` trägt; `const { NAME } = …` nicht.
        const fest =
          istConst && ts.isIdentifier(n.name) && n.initializer !== undefined
            ? konstanteBedingung(n.initializer)
            : undefined;
        binde(name, fest);
      }
    } else if (ts.isParameter(n)) {
      for (const name of gebundeneNamen(n.name)) verdirb(name);
    } else if (
      ts.isImportSpecifier(n) ||
      ts.isImportClause(n) ||
      ts.isNamespaceImport(n) ||
      ts.isImportEqualsDeclaration(n)
    ) {
      if (n.name !== undefined) verdirb(n.name.text);
    } else if (
      ts.isFunctionDeclaration(n) ||
      ts.isClassDeclaration(n) ||
      ts.isEnumDeclaration(n) ||
      ts.isModuleDeclaration(n) ||
      // KORREKTURPFLICHT 2 (Prüfer BEN, Runde 1): der Name eines Funktions- oder Klassenausdrucks
      // bindet NUR im eigenen Rumpf — und dort steht er für die Funktion, also für etwas Wahres.
      // `const AUS = false; (function AUS() { if (AUS) expect(…); })();` LÄUFT.
      ts.isFunctionExpression(n) ||
      ts.isClassExpression(n)
    ) {
      if (n.name !== undefined && ts.isIdentifier(n.name)) verdirb(n.name.text);
    } else if (ts.isBinaryExpression(n)) {
      // Jede Zuweisung, auch `=`, `||=`, `&&=`: der Wert von vorhin gilt dann nicht mehr.
      // KORREKTURPFLICHT 3 (Prüfer BEN, Runde 1): das gilt auch für die ZERLEGUNG links —
      // `[AUS] = [true]` und `({ AUS } = quelle)` sind Neuzuweisungen ohne blanken Bezeichner.
      const art = n.operatorToken.kind;
      if (art >= ts.SyntaxKind.FirstAssignment && art <= ts.SyntaxKind.LastAssignment) {
        for (const name of zuweisungsziele(n.left)) verdirb(name);
      }
    } else if (
      (ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) &&
      (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)
    ) {
      for (const name of zuweisungsziele(n.operand)) verdirb(name);
    } else if (
      (ts.isForOfStatement(n) || ts.isForInStatement(n)) &&
      !ts.isVariableDeclarationList(n.initializer)
    ) {
      // `for (AUS of [true])` bindet keinen neuen Namen, sondern weist dem vorhandenen zu.
      for (const name of zuweisungsziele(n.initializer)) verdirb(name);
    }
    ts.forEachChild(n, besuche);
  };
  ts.forEachChild(ast, besuche);
  return wert;
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
  const tafel = konstantenTafel(ast);
  /** Fester Wahrheitswert dieses Ausdrucks — Literale UND aufgelöste Namen (TOTER_ZWEIG 5). */
  const fest = (ausdruck: ts.Expression): boolean | undefined =>
    konstanteBedingung(ausdruck, tafel);
  const stellen: number[] = [];

  const besuche = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && namen.has(n.expression.text)) {
      stellen.push(n.expression.getStart(ast));
    }
    if (ts.isIfStatement(n)) {
      const bedingung = fest(n.expression);
      besuche(n.expression);
      if (bedingung !== false) besuche(n.thenStatement);
      if (bedingung !== true && n.elseStatement !== undefined) besuche(n.elseStatement);
      return;
    }
    if (ts.isWhileStatement(n)) {
      besuche(n.expression);
      if (fest(n.expression) !== false) besuche(n.statement);
      return;
    }
    if (ts.isForStatement(n)) {
      // Der Anfangsteil läuft IMMER, auch bei toter Bedingung — deshalb steht er vor dem Ausstieg.
      if (n.initializer !== undefined) besuche(n.initializer);
      if (n.condition !== undefined) besuche(n.condition);
      // Ohne Bedingung (`for (;;)`) läuft der Rumpf; mit konstant falscher Bedingung nie — und dann
      // läuft auch der Fortschaltteil nicht, denn der kommt erst nach dem ersten Durchlauf.
      if (n.condition !== undefined && fest(n.condition) === false) return;
      if (n.incrementor !== undefined) besuche(n.incrementor);
      besuche(n.statement);
      return;
    }
    if (ts.isForOfStatement(n)) {
      // TOTER_ZWEIG 7. Der KOPF läuft in jedem Fall: die Bindung links und der durchlaufene
      // Ausdruck rechts werden ausgewertet, bevor der erste Durchlauf überhaupt entschieden ist.
      besuche(n.initializer);
      besuche(n.expression);
      // Nur das LEERE Feldliteral ist syntaktisch leer. Alles andere — eine Variable, ein Aufruf,
      // ein gefülltes Literal, ein Spread, eine Zeichenkette, ein `as`-Ausdruck — kann tragen und
      // bleibt lebend, auch wenn es zur Laufzeit leer wäre. `for (const k in {})` ist NICHT gedeckt.
      if (istLeeresFeld(n.expression)) return;
      besuche(n.statement);
      return;
    }
    if (ts.isSwitchStatement(n)) {
      besuche(n.expression);
      const klauseln = n.caseBlock.clauses;
      const verteiler = fest(n.expression);
      // EINE SCHLEIFE FÜR BEIDES, weil es dieselbe Reihenfolge ist: welcher Sprungwert noch
      // VERGLICHEN wird, und welche Gruppe der Lauf betreten kann.
      //
      // KORREKTURPFLICHT 1 (Prüfer BEN, JOB 3791 Runde 2). Runde 2 besuchte alle Sprungwerte
      // vorweg, mit dem Satz „sie werden verglichen, also ausgewertet — sie zählen immer mit".
      // Das ist zu weit: JavaScript vergleicht sie NACHEINANDER und hört beim ersten Treffer auf.
      // BEN hat es gemessen — `switch (false) { case false: break; case expect(1): break; }` ruft
      // NULLMAL, Runde 2 zählte eins. Damit war eine geführte Erwartung erneut still abzuschalten,
      // diesmal im Sprungwert hinter dem Treffer. `default` hat keinen Sprungwert und wird beim
      // Vergleich übersprungen, ganz gleich wo er steht.
      //
      // JEDER MÖGLICHE EINSTIEG, nicht nur der erste — KORREKTURPFLICHT 1 aus Runde 1. Runde 1
      // folgte dem frühesten Einstieg und brach am ersten `break` ab. Bei
      // `switch (false) { case sprung(): break; default: expect(…); }` ist der früheste Einstieg
      // der UNBEKANNTE `case`; sein `break` erklärte den `default` für tot — der aber läuft, sobald
      // `sprung()` nicht trifft. Ein unbekannter Sprungwert sagt eben NICHTS, also müssen beide
      // Möglichkeiten offen bleiben: tot ist nur, was von KEINEM Einstieg aus erreichbar ist.
      const einstiege: number[] = [];
      let sichererTreffer = false;
      for (const [i, klausel] of klauseln.entries()) {
        if (!ts.isCaseClause(klausel)) continue;
        // Bis hierher wird verglichen — also wird DIESER Sprungwert ausgewertet und zählt mit.
        besuche(klausel.expression);
        const sprung = fest(klausel.expression);
        // Bei unbekanntem Verteiler kann jeder Sprungwert treffen und jeder nicht: dann wird
        // WEITER verglichen (im Zweifel lebend) und die Gruppenfrage unten gar nicht gestellt.
        if (verteiler === undefined) continue;
        if (sprung === undefined || sprung === verteiler) einstiege.push(i);
        if (sprung === verteiler) {
          // Ab dem ersten SICHER passenden Sprungwert wird nicht mehr verglichen: kein späterer
          // Sprungwert läuft, und kein späterer `case` kommt als Einstieg in Frage.
          sichererTreffer = true;
          break;
        }
      }
      if (verteiler === undefined) {
        // TOTER_ZWEIG 6 greift nur bei konstantem Verteiler. Sonst kann JEDE Gruppe die getroffene
        // sein; ein `break` in der einen sagt nichts über die andere, deshalb je Gruppe für sich.
        for (const klausel of klauseln) besuche(klausel);
        return;
      }
      // `default` läuft, sobald KEIN `case` trifft; ausgeschlossen ist das nur, wenn einer sicher
      // trifft. Wo `default` steht, ist dabei gleich — er ist ein eigener Einstieg wie jeder andere.
      const standard = klauseln.findIndex((klausel) => ts.isDefaultClause(klausel));
      if (!sichererTreffer && standard >= 0) einstiege.push(standard);
      // AB JEDEM EINSTIEG FÄLLT ES DURCH: ohne `break` läuft die nächste Gruppe mit; steht ein
      // Abbruch in der Anweisungsliste, endet der Durchfall AB DIESEM Einstieg — und nur dort.
      const lebend = new Set<number>();
      for (const einstieg of einstiege) {
        for (let i = einstieg; i < klauseln.length; i += 1) {
          const klausel = klauseln[i];
          if (klausel === undefined) break;
          lebend.add(i);
          if (klausel.statements.some(istEndgueltig)) break;
        }
      }
      // Derselbe Gang durch die Anweisungsliste wie überall (unten bei `ts.isCaseClause`).
      for (const [i, klausel] of klauseln.entries()) {
        if (lebend.has(i)) besuche(klausel);
      }
      return;
    }
    if (ts.isConditionalExpression(n)) {
      const bedingung = fest(n.condition);
      besuche(n.condition);
      if (bedingung !== false) besuche(n.whenTrue);
      if (bedingung !== true) besuche(n.whenFalse);
      return;
    }
    if (ts.isBinaryExpression(n)) {
      const art = n.operatorToken.kind;
      const kurzschluss =
        art === ts.SyntaxKind.AmpersandAmpersandToken || art === ts.SyntaxKind.BarBarToken;
      if (kurzschluss) {
        besuche(n.left);
        const links = fest(n.left);
        const totRechts =
          (art === ts.SyntaxKind.AmpersandAmpersandToken && links === false) ||
          (art === ts.SyntaxKind.BarBarToken && links === true);
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
