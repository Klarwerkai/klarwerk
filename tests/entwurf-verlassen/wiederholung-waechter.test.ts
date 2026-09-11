// ================================================================================================
// JOB 3600 · DER WÄCHTER GEGEN DEN STILLEN RÜCKFALL.
// ================================================================================================
//
// WAS ER FESTHÄLT — zwei Hälften EINER Zusage („kein Entwurf entsteht zweimal"):
//
//   W1  `createPointDrafts` MELDET, welche Punkte gelungen sind — und zwar als die Punkte SELBST.
//   W2  Der Aufrufer in `Capture.tsx` ENTFERNT sie aus `filePoints`, BEVOR er wirft.
//
// WARUM ER NICHT AUF NAMEN SCHAUT (Lehren JOB 3570 R3, 3579 R1, 3578 R1). Ein Wächter, den ein
// Kommentar oder ein Zeichenketten-Inhalt befriedigt, ist keiner: `// createdPoints` und
// `const hinweis = "setFilePoints vor dem throw"` würden eine Textsuche beruhigen, ohne dass eine
// Zeile Code liefe. Deshalb:
//
//   W1 misst VERHALTEN — `createPointDrafts` wird wirklich gefahren, mit einer Anlagefunktion, die
//      je Punkt entscheidet. Verglichen wird mit `toBe`: Identität, nicht Gleichheit. Eine Kopie
//      (`points.map((p) => ({ ...p }))`) bestünde einen Feldvergleich und wäre für den Aufrufer
//      trotzdem wertlos — er könnte sie in seiner eigenen Liste nicht wiederfinden.
//
//   W2 liest den SYNTAXBAUM von `Capture.tsx`. Kommentare kommen darin nicht vor, Zeichenketten
//      sind eigene Knoten und werden nie für einen Aufruf gehalten. Geprüft wird die REIHENFOLGE
//      zweier Anweisungen im selben Block — die Eigenschaft, um die es geht, und die kein Name
//      ausdrückt.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { createPointDrafts } from "../../apps/web/src/lib/fileMultiPoint";

const CAPTURE = join(process.cwd(), "apps", "web", "src", "pages", "Capture.tsx");

describe("JOB 3600 · Wächter: kein Entwurf entsteht zweimal", () => {
  // ==============================================================================================
  // W1 · DIE MELDUNG DER GELUNGENEN PUNKTE — GEFAHREN, NICHT GELESEN.
  // ==============================================================================================
  it("W1 · createPointDrafts meldet die gelungenen Punkte als DIESELBEN Objekte", async () => {
    // Bewusst mit einem Zusatzfeld und einem DOPPELTEN Titel: nur Identität trägt hier. Über den
    // Titel wären der erste und der dritte Punkt nicht zu unterscheiden.
    const a = { title: "Doppelt", summary: "erste", sourceExcerpt: "A", id: "fp-0" };
    const b = { title: "Scheitert", summary: "zweite", sourceExcerpt: "B", id: "fp-1" };
    const c = { title: "Doppelt", summary: "dritte", sourceExcerpt: "C", id: "fp-2" };

    const ergebnis = await createPointDrafts([a, b, c], "bericht.txt", "de", async (payload) => {
      if ((payload as { title: string }).title === b.title) {
        throw new Error("abgelehnt");
      }
      return {};
    });

    expect(ergebnis.created).toBe(2);
    expect(ergebnis.failed).toEqual([b.title]);
    // Die gemeldeten Punkte SIND die hineingegebenen — kein Abbild, keine Titelliste.
    expect(ergebnis.createdPoints.length).toBe(2);
    expect(ergebnis.createdPoints[0]).toBe(a);
    expect(ergebnis.createdPoints[1]).toBe(c);
    expect(ergebnis.createdPoints).not.toContain(b);
  });

  it("W1b · scheitert alles, ist die Meldung leer — keine Zusage ohne Grundlage", async () => {
    const a = { title: "Eins", summary: "s", sourceExcerpt: "A" };
    const ergebnis = await createPointDrafts([a], "bericht.txt", "de", async () => {
      throw new Error("offline");
    });
    expect(ergebnis.created).toBe(0);
    expect(ergebnis.createdPoints).toEqual([]);
    expect(ergebnis.failed).toEqual(["Eins"]);
  });

  // ==============================================================================================
  // W2 · DER AUFRUFER NIMMT SIE HERAUS — VOR DEM WURF.
  // ==============================================================================================
  it("W2 · im Teilfehlerzweig des Wächter-Rückrufs steht die Entnahme VOR dem throw", () => {
    const text = readFileSync(CAPTURE, "utf8");
    const ast = ts.createSourceFile(CAPTURE, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    /** Jeden Knoten des Baums einmal, von aussen nach innen. */
    function alleKnoten(wurzel: ts.Node): ts.Node[] {
      const raus: ts.Node[] = [];
      const gehe = (n: ts.Node): void => {
        raus.push(n);
        n.forEachChild(gehe);
      };
      gehe(wurzel);
      return raus;
    }

    const knoten = alleKnoten(ast);

    // 1. Die Stelle, an der der Lauf sein Ergebnis bekommt: `const <x> = await createPointDrafts(…)`
    //    IM Wächter-Rückruf. Der zweite Aufrufer (die `filePointDrafts`-Mutation) übergibt sein
    //    Ergebnis als Rückruf-Argument und hat gar keine solche Deklaration — er kann hier also
    //    nicht versehentlich mitgemessen werden.
    const deklarationen = knoten.filter(
      (n): n is ts.VariableDeclaration =>
        ts.isVariableDeclaration(n) &&
        n.initializer !== undefined &&
        ts.isAwaitExpression(n.initializer) &&
        ts.isCallExpression(n.initializer.expression) &&
        ts.isIdentifier(n.initializer.expression.expression) &&
        n.initializer.expression.expression.text === "createPointDrafts",
    );
    expect(
      deklarationen.length,
      "kein `const … = await createPointDrafts(…)` in Capture.tsx gefunden",
    ).toBe(1);
    const ergebnisName = (deklarationen[0] as ts.VariableDeclaration).name;
    expect(ts.isIdentifier(ergebnisName), "das Ergebnis wird destrukturiert statt benannt").toBe(
      true,
    );
    const name = (ergebnisName as ts.Identifier).text;

    // 1b. Gesucht wird ab jetzt NUR noch im Block dieser Deklaration. Die zweite Fundstelle von
    //     `createPointDrafts` (die `filePointDrafts`-Mutation) nennt ihr Rückruf-Argument ebenfalls
    //     `result` und trägt denselben `if (result.failed.length > 0)`-Zweig — ohne diese Eingrenzung
    //     misst der Wächter zwei Stellen auf einmal und trifft keine (gemessen: „expected 2 to be 1").
    let bereich: ts.Node = deklarationen[0] as ts.VariableDeclaration;
    while (!ts.isBlock(bereich)) {
      const eltern = bereich.parent;
      expect(eltern, "die Deklaration liegt in keinem Block").toBeDefined();
      bereich = eltern;
    }
    const imBereich = alleKnoten(bereich);

    // 2. Der Teilfehlerzweig: `if (<x>.failed.length > 0) { … }`.
    const zweige = imBereich.filter((n): n is ts.IfStatement => {
      if (!ts.isIfStatement(n) || !ts.isBinaryExpression(n.expression)) {
        return false;
      }
      const links = n.expression.left;
      return (
        ts.isPropertyAccessExpression(links) &&
        links.name.text === "length" &&
        ts.isPropertyAccessExpression(links.expression) &&
        links.expression.name.text === "failed" &&
        ts.isIdentifier(links.expression.expression) &&
        links.expression.expression.text === name
      );
    });
    expect(zweige.length, `kein Zweig \`if (${name}.failed.length > 0)\` gefunden`).toBe(1);
    const zweig = zweige[0] as ts.IfStatement;
    const block = alleKnoten(zweig.thenStatement);

    // 3. In diesem Zweig wird geworfen — das ist der Zustand, der den Dialog offen hält.
    const wuerfe = block.filter(ts.isThrowStatement);
    expect(wuerfe.length, "der Teilfehlerzweig wirft nicht mehr — der Dialog ginge zu").toBe(1);
    const wurf = wuerfe[0] as ts.ThrowStatement;

    // 4. UND davor steht die Entnahme: ein Aufruf des Punktesetzers, dessen Argument auf die
    //    gemeldeten gelungenen Punkte (`<x>.createdPoints`) ZURÜCKGEHT. „Zurückgehen" und nicht
    //    „enthalten": die Meldung darf unterwegs in einer lokalen Grösse liegen (heute ein `Set`,
    //    damit das Filtern nicht quadratisch wird). Deshalb wird der Wert verfolgt — erst die
    //    Namen, die aus `createdPoints` gebildet werden, dann die Namen, die aus jenen gebildet
    //    werden, bis sich nichts mehr ändert.
    //
    //    Geprüft werden dabei ausschliesslich Knoten, nie Rohtext: ein Kommentar steht gar nicht im
    //    Baum, und eine Zeichenkette ist ein StringLiteral und nie ein Bezeichner oder ein Aufruf.
    const gespeist = (n: ts.Node, namen: ReadonlySet<string>): boolean =>
      alleKnoten(n).some(
        (k) =>
          (ts.isPropertyAccessExpression(k) && k.name.text === "createdPoints") ||
          (ts.isIdentifier(k) && namen.has(k.text)),
      );

    const abgeleitet = new Set<string>();
    for (let runde = 0; runde < 8; runde++) {
      const vorher = abgeleitet.size;
      for (const n of block) {
        if (
          ts.isVariableDeclaration(n) &&
          ts.isIdentifier(n.name) &&
          n.initializer !== undefined &&
          gespeist(n.initializer, abgeleitet)
        ) {
          abgeleitet.add(n.name.text);
        }
      }
      if (abgeleitet.size === vorher) {
        break;
      }
    }

    const entnahmen = block.filter((n): n is ts.CallExpression => {
      if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression)) {
        return false;
      }
      if (n.expression.text !== "setFilePoints") {
        return false;
      }
      return n.arguments.some((arg) => gespeist(arg, abgeleitet));
    });
    expect(
      entnahmen.length,
      "der Teilfehlerzweig nimmt die gelungenen Punkte nicht aus `filePoints` — " +
        "ein zweiter Druck legte sie erneut an",
    ).toBe(1);
    const entnahme = entnahmen[0] as ts.CallExpression;

    // 5. Und zwar VOR dem Wurf. Danach wäre sie unerreichbar — genau der Rückfall, um den es geht.
    expect(
      entnahme.getStart(ast) < wurf.getStart(ast),
      "die Entnahme steht hinter dem throw und wird nie ausgeführt",
    ).toBe(true);
  });
});
