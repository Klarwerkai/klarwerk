// ================================================================================================
// JOB 1020 / D12 — DIE ASSERTIONSKETTE, ALS BEZIEHUNG STATT ALS ANWESENHEIT.
// ================================================================================================
//
// BEN hat den D11-Belegwächter PRODUKT-ROT gestellt, und der Grund ist präzise:
//
//   „Ein gemeinsamer AST-Teilbaum ist noch keine zusammenhängende Assertion."
//
// D10 fragte, ob vier Wörter irgendwo in der Datei stehen. D11 fragte, ob vier AST-Ereignisse
// irgendwo im selben Teilbaum stehen — und fiel, wenn kein einzelner Testfall genügte, auf die
// GESAMTE Quelldatei zurück. Beides beantwortet die Frage „kommt es vor?", nicht die Frage
// „hängt es zusammen?". BEN hat das mit zwei synthetischen Formen belegt, die D11 fälschlich
// freigab: zwei getrennte Testfälle, und ein Namensvergleich am fremden Element.
//
// WAS DIESE DATEI LIEFERT: `belegAssertionErfuellt` als DATENFLUSSPRÜFUNG. Sie verlangt, dass
// EIN ausgeführter `it`/`test`-Rumpf die ganze Kette an DERSELBEN Variablen trägt:
//
//   Markerselektor  →  dialogVar
//   dialogVar       →  dessen `aria-labelledby` wird gelesen
//   dialogVar       →  Argument der Namensauflösung
//   deren Ergebnis  →  nameVar
//   nameVar         →  Nichtleerheitsaussage
//   nameVar         →  Vergleich mit der registrierten Erwartung
//
// Es gibt KEINEN SourceFile-Rückfall. Wer die Kette auf zwei Tests verteilt, bleibt rot.
//
// WAS DIESE DATEI NICHT IST: der zentrale Sammler. Der D-044-Belegvertrag aus den Durchgängen
// D3–D11 steckt NICHT in dieser Base (nachgemessen: `RENDERERBELEGE`, `belegAssertionErfuellt`
// und `zugaenglicherName` kommen im gesamten Bestand nicht vor). Diese Datei baut deshalb den
// korrigierten Prüfkern eigenständig und kalibriert ihn vollständig — anschlussfähig für den
// Wiederaufbau der Kette, ohne einen Beleg zu behaupten, den es hier nicht gibt.
import ts from "typescript";
import { describe, expect, it } from "vitest";

// ================================================================================================
// DER REGISTEREINTRAG. Vier Felder, so wie ihn der zentrale Wächter führt.
// ================================================================================================
interface Beleg {
  /** Der Selektor, mit dem der registrierte Dialog ausgewählt wird. */
  readonly marker: string;
  /** Die Beschriftungsbindung, die an ihm gelesen werden muss. */
  readonly bindung: string;
  /** Die Funktion, die den zugänglichen Namen ermittelt. */
  readonly namensaufloesung: string;
  /** Die Erwartung, gegen die der ermittelte Name stehen muss. */
  readonly inhaltserwartung: string;
}

const D044: Beleg = {
  marker: '[data-testid="editor-zoom"]',
  bindung: "aria-labelledby",
  namensaufloesung: "zugaenglicherName",
  inhaltserwartung: "editor.zoom.title",
};

// ================================================================================================
// AST-WERKZEUG. Dasselbe Idiom wie im Sammler (`mega47-modale-flaechen-sammler.test.tsx:228`).
// ================================================================================================
function baum(quelltext: string): ts.SourceFile {
  return ts.createSourceFile(
    "beleg.test.tsx",
    quelltext,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function kinder(knoten: ts.Node): ts.Node[] {
  const raus: ts.Node[] = [];
  knoten.forEachChild((k) => {
    raus.push(k);
  });
  return raus;
}

function alleKnoten(knoten: ts.Node): ts.Node[] {
  const raus: ts.Node[] = [knoten];
  for (const k of kinder(knoten)) {
    raus.push(...alleKnoten(k));
  }
  return raus;
}

/** Enthält der Teilbaum ein Stringliteral, das `text` enthält? */
function literalEnthaelt(knoten: ts.Node, text: string): boolean {
  return alleKnoten(knoten).some(
    (k) =>
      (ts.isStringLiteral(k) || ts.isNoSubstitutionTemplateLiteral(k)) && k.text.includes(text),
  );
}

/** Die Rümpfe aller `it`/`test`-Aufrufe — und NUR die. Kein SourceFile-Rückfall. */
function testRuempfe(sf: ts.SourceFile): ts.Node[] {
  const raus: ts.Node[] = [];
  for (const k of alleKnoten(sf)) {
    if (!ts.isCallExpression(k)) {
      continue;
    }
    const name = ts.isIdentifier(k.expression)
      ? k.expression.text
      : ts.isPropertyAccessExpression(k.expression) && ts.isIdentifier(k.expression.expression)
        ? k.expression.expression.text
        : "";
    if (name !== "it" && name !== "test") {
      continue;
    }
    const rumpf = k.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a));
    if (rumpf && (ts.isArrowFunction(rumpf) || ts.isFunctionExpression(rumpf)) && rumpf.body) {
      raus.push(rumpf.body);
    }
  }
  return raus;
}

/** Der Name der Variablen, in die dieser Knoten deklariert oder zugewiesen wird — oder null. */
function zielVariable(knoten: ts.Node): string | null {
  let lauf: ts.Node | undefined = knoten;
  while (lauf) {
    if (ts.isVariableDeclaration(lauf) && ts.isIdentifier(lauf.name)) {
      return lauf.name.text;
    }
    if (
      ts.isBinaryExpression(lauf) &&
      lauf.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isIdentifier(lauf.left)
    ) {
      return lauf.left.text;
    }
    lauf = lauf.parent;
  }
  return null;
}

/** Steht dieser Ausdruck für die Variable `name` — direkt oder als deren Eigenschaftszugriff? */
function istVariable(ausdruck: ts.Node, name: string): boolean {
  if (ts.isIdentifier(ausdruck)) {
    return ausdruck.text === name;
  }
  if (ts.isPropertyAccessExpression(ausdruck) || ts.isElementAccessExpression(ausdruck)) {
    return istVariable(ausdruck.expression, name);
  }
  if (ts.isNonNullExpression(ausdruck) || ts.isParenthesizedExpression(ausdruck)) {
    return istVariable(ausdruck.expression, name);
  }
  return false;
}

// ================================================================================================
// DIE PRÜFUNG. Sechs Glieder, alle an derselben Variablen, alle in EINEM Testfall.
// ================================================================================================
interface Kettenbefund {
  readonly erfuellt: boolean;
  /** Welches Glied zuerst gerissen ist — für eine Fehlermeldung, die etwas sagt. */
  readonly bruchstelle: string;
}

function belegAssertionErfuellt(quelltext: string, beleg: Beleg): Kettenbefund {
  const sf = baum(quelltext);
  const ruempfe = testRuempfe(sf);
  if (ruempfe.length === 0) {
    return { erfuellt: false, bruchstelle: "kein ausgefuehrter it/test-Rumpf" };
  }

  let letzteBruchstelle = "kein Rumpf traegt die Kette";

  for (const rumpf of ruempfe) {
    const knoten = alleKnoten(rumpf);

    // (1) Markerselektion -> dialogVar
    const dialogVars = new Set<string>();
    for (const k of knoten) {
      if (!ts.isCallExpression(k)) {
        continue;
      }
      if (!k.arguments.some((a) => literalEnthaelt(a, beleg.marker))) {
        continue;
      }
      const v = zielVariable(k);
      if (v) {
        dialogVars.add(v);
      }
    }
    if (dialogVars.size === 0) {
      letzteBruchstelle = "Markerselektion ergibt keine Dialogvariable";
      continue;
    }

    for (const dialogVar of dialogVars) {
      // (2) `aria-labelledby` wird AN dialogVar gelesen
      const bindungGelesen = knoten.some(
        (k) =>
          ts.isCallExpression(k) &&
          ts.isPropertyAccessExpression(k.expression) &&
          istVariable(k.expression.expression, dialogVar) &&
          k.arguments.some((a) => literalEnthaelt(a, beleg.bindung)),
      );
      if (!bindungGelesen) {
        letzteBruchstelle = `\`${beleg.bindung}\` wird nicht an \`${dialogVar}\` gelesen`;
        continue;
      }

      // (3) Namensaufloesung MIT dialogVar als Argument -> nameVar (oder inline)
      const aufloesungen = knoten.filter(
        (k) =>
          ts.isCallExpression(k) &&
          ts.isIdentifier(k.expression) &&
          k.expression.text === beleg.namensaufloesung &&
          k.arguments.some((a) => istVariable(a, dialogVar)),
      ) as ts.CallExpression[];
      if (aufloesungen.length === 0) {
        letzteBruchstelle = `\`${beleg.namensaufloesung}(...)\` erhaelt nicht \`${dialogVar}\``;
        continue;
      }

      for (const aufloesung of aufloesungen) {
        const nameVar = zielVariable(aufloesung);

        /**
         * Steht dieser Ausdruck fuer das Ergebnis der Aufloesung AN DIESEM Dialog?
         *
         * Drei zulaessige Formen, und keine mehr:
         *   · derselbe Aufruf (direkt im `expect`),
         *   · die Variable, in die er geschrieben wurde (die echte Zwischenvariablenform),
         *   · ein WEITERER Aufruf derselben Aufloesung mit DERSELBEN Dialogvariablen.
         *
         * Die dritte Form ist noetig, weil `expect(zugaenglicherName(dialog)).toBeTruthy()`
         * und `expect(zugaenglicherName(dialog)).toBe(...)` zwei AST-Knoten sind, aber
         * denselben Wert bezeichnen. Knotenidentitaet zu verlangen waere nicht strenger,
         * sondern nur falsch — sie wuerde eine gueltige Belegform ablehnen. Die Bindung an
         * `dialogVar` bleibt dabei unangetastet: ein Aufruf mit einem fremden Element
         * erfuellt keine der drei Formen.
         */
        const istNamenswert = (a: ts.Node): boolean => {
          if (a === aufloesung || alleKnoten(a).includes(aufloesung)) {
            return true;
          }
          if (nameVar !== null && istVariable(a, nameVar)) {
            return true;
          }
          return alleKnoten(a).some(
            (k) =>
              ts.isCallExpression(k) &&
              ts.isIdentifier(k.expression) &&
              k.expression.text === beleg.namensaufloesung &&
              k.arguments.some((arg) => istVariable(arg, dialogVar)),
          );
        };

        // (4) Nichtleerheit, an DENSELBEN Namenswert gebunden
        const nichtleer = knoten.some((k) => {
          if (!ts.isCallExpression(k) || !ts.isIdentifier(k.expression)) {
            return false;
          }
          if (k.expression.text !== "expect") {
            return false;
          }
          if (!k.arguments.some((a) => istNamenswert(a))) {
            return false;
          }
          const kette = k.parent;
          if (!kette || !ts.isPropertyAccessExpression(kette)) {
            return false;
          }
          const matcher = kette.name.text;
          return (
            matcher.startsWith("toBeGreaterThan") ||
            matcher === "toBeTruthy" ||
            matcher === "toHaveLength" ||
            matcher === "not"
          );
        });
        if (!nichtleer) {
          letzteBruchstelle = "keine Nichtleerheitsaussage am selben Namenswert";
          continue;
        }

        // (5) Vergleich mit der registrierten Erwartung, am DEMSELBEN Namenswert
        const verglichen = knoten.some((k) => {
          if (!ts.isCallExpression(k) || !ts.isIdentifier(k.expression)) {
            return false;
          }
          if (k.expression.text !== "expect") {
            return false;
          }
          if (!k.arguments.some((a) => istNamenswert(a))) {
            return false;
          }
          const kette = k.parent;
          if (!kette || !ts.isPropertyAccessExpression(kette)) {
            return false;
          }
          const aufruf = kette.parent;
          if (!aufruf || !ts.isCallExpression(aufruf)) {
            return false;
          }
          return aufruf.arguments.some((a) => literalEnthaelt(a, beleg.inhaltserwartung));
        });
        if (!verglichen) {
          letzteBruchstelle = `der Namenswert wird nicht gegen \`${beleg.inhaltserwartung}\` verglichen`;
          continue;
        }

        return { erfuellt: true, bruchstelle: "" };
      }
    }
  }

  return { erfuellt: false, bruchstelle: letzteBruchstelle };
}

// ================================================================================================
// DER D10-NACHBAU. Nur zum Vergleich — und ausdrücklich ein NACHBAU, nicht der Originalstand.
// ================================================================================================
//
// Der echte D10-Wächter steckt NICHT in dieser Base (nachgemessen). Ein Red-first „gegen den
// tatsächlichen D10-Stand" ist hier deshalb nicht ausführbar; das ist in der Rückgabe als
// Blocker ausgewiesen. Was hier steht, ist die von BEN wörtlich beschriebene D10-Semantik —
// vier freie `String.includes` über die ganze Datei (BEN-D11 `:81-84`, `:171-177`) — damit der
// kausale Unterschied überhaupt messbar wird. Er belegt die Aussage über den NACHBAU,
// nicht über den Originalstand.
function wortpruefungD10(quelltext: string, beleg: Beleg): boolean {
  return (
    quelltext.includes(beleg.marker) &&
    quelltext.includes(beleg.bindung) &&
    quelltext.includes(beleg.namensaufloesung) &&
    quelltext.includes(beleg.inhaltserwartung)
  );
}

// ================================================================================================
// DIE PRÜFFORMEN. Jede ist genau eine der von BEN benannten Lagen.
// ================================================================================================
const P1_ZWISCHENVARIABLE = `
it("D-044: der Zoomdialog traegt einen lokalisierten Namen", async () => {
  const dialog = container.querySelector('[data-testid="editor-zoom"]');
  const ziel = dialog.getAttribute("aria-labelledby");
  const name = zugaenglicherName(dialog);
  expect(name.length).toBeGreaterThan(2);
  expect(name).toBe(i18n.t("editor.zoom.title"));
});
`;

const P2_DIREKT = `
it("D-044: derselbe Beleg, ohne Zwischenvariable", async () => {
  const dialog = container.querySelector('[data-testid="editor-zoom"]');
  dialog.getAttribute("aria-labelledby");
  expect(zugaenglicherName(dialog)).toBeTruthy();
  expect(zugaenglicherName(dialog)).toBe(i18n.t("editor.zoom.title"));
});
`;

const N1_ZWEI_TESTS = `
it("erster Test: Marker und Bindung", async () => {
  const dialog = container.querySelector('[data-testid="editor-zoom"]');
  expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
});
it("zweiter Test: Namensvergleich", async () => {
  const name = zugaenglicherName(irgendetwas);
  expect(name.length).toBeGreaterThan(2);
  expect(name).toBe(i18n.t("editor.zoom.title"));
});
`;

const N2_FREMDES_ELEMENT = `
it("Marker richtig, Namensvergleich am fremden Element", async () => {
  const dialog = container.querySelector('[data-testid="editor-zoom"]');
  dialog.getAttribute("aria-labelledby");
  const anderes = container.querySelector("h1");
  const name = zugaenglicherName(anderes);
  expect(name.length).toBeGreaterThan(2);
  expect(name).toBe(i18n.t("editor.zoom.title"));
});
`;

const N3_OHNE_NICHTLEERHEIT = `
it("Kette ohne Nichtleerheitsaussage", async () => {
  const dialog = container.querySelector('[data-testid="editor-zoom"]');
  dialog.getAttribute("aria-labelledby");
  const name = zugaenglicherName(dialog);
  expect(name).toBe(i18n.t("editor.zoom.title"));
});
`;

const N4_AUFGEBROCHENE_VARIABLE = `
it("Zwischenvariable aufgebrochen: verglichen wird ein anderer Wert", async () => {
  const dialog = container.querySelector('[data-testid="editor-zoom"]');
  dialog.getAttribute("aria-labelledby");
  const name = zugaenglicherName(dialog);
  const anderer = textVon(container.querySelector("h1"));
  expect(anderer.length).toBeGreaterThan(2);
  expect(anderer).toBe(i18n.t("editor.zoom.title"));
});
`;

// Diese Form isoliert GENAU die Testfallgrenze: Beide Tests benutzen dieselbe Variable `dialog`,
// die Kette ist inhaltlich lueckenlos — sie steht nur in ZWEI Ruempfen. Unter dem D11-Rueckfall auf
// den gesamten SourceFile-Knoten waere das gruen. Genau daran haengt die Gegenmutation GM-1.
const N6_GETRENNT_GLEICHE_VARIABLE = `
it("erster Test: Marker und Bindung an derselben Variablen", async () => {
  const dialog = container.querySelector('[data-testid="editor-zoom"]');
  dialog.getAttribute("aria-labelledby");
});
it("zweiter Test: Aufloesung und Vergleich an derselben Variablen", async () => {
  const name = zugaenglicherName(dialog);
  expect(name.length).toBeGreaterThan(2);
  expect(name).toBe(i18n.t("editor.zoom.title"));
});
`;

const N5_NUR_WOERTER = `
// Ein Kommentar mit [data-testid="editor-zoom"], aria-labelledby, zugaenglicherName
// und editor.zoom.title — alle vier Woerter, keine einzige Beziehung.
it("nur Woerter, keine Kette", async () => {
  expect(true).toBe(true);
});
`;

// ================================================================================================
describe("JOB 1020 D12: die Belegprüfung misst eine Beziehung, nicht eine Anwesenheit", () => {
  // ============================================================================================
  // POSITIVKONTROLLEN — beide echten Belegformen müssen durchkommen.
  // ============================================================================================
  it("P1 · die ECHTE Form mit Zwischenvariable wird als zusammenhängender Beleg erkannt", () => {
    const befund = belegAssertionErfuellt(P1_ZWISCHENVARIABLE, D044);
    expect(befund.bruchstelle).toBe("");
    expect(befund.erfuellt).toBe(true);
  });

  it("P2 · die direkte Form ohne Zwischenvariable wird ebenfalls erkannt", () => {
    expect(belegAssertionErfuellt(P2_DIREKT, D044).erfuellt).toBe(true);
  });

  // ============================================================================================
  // NEGATIVFÄLLE — genau die Formen, die D11 fälschlich freigegeben hat.
  // ============================================================================================
  it("N1 · zwei getrennte Testfälle ergeben KEINEN Beleg, auch wenn ihre Summe alles enthält", () => {
    const befund = belegAssertionErfuellt(N1_ZWEI_TESTS, D044);
    expect(befund.erfuellt).toBe(false);
  });

  it("N2 · Namensvergleich am fremden Element im selben Test ergibt KEINEN Beleg", () => {
    const befund = belegAssertionErfuellt(N2_FREMDES_ELEMENT, D044);
    expect(befund.erfuellt).toBe(false);
    expect(befund.bruchstelle).toContain("zugaenglicherName");
  });

  it("N3 · fehlende Nichtleerheitsaussage am selben Namenswert ergibt KEINEN Beleg", () => {
    const befund = belegAssertionErfuellt(N3_OHNE_NICHTLEERHEIT, D044);
    expect(befund.erfuellt).toBe(false);
    expect(befund.bruchstelle).toContain("Nichtleerheitsaussage");
  });

  it("N4 · aufgebrochene Zwischenvariable ergibt KEINEN Beleg", () => {
    expect(belegAssertionErfuellt(N4_AUFGEBROCHENE_VARIABLE, D044).erfuellt).toBe(false);
  });

  it("N5 · vier Wörter ohne jede Beziehung ergeben KEINEN Beleg", () => {
    expect(belegAssertionErfuellt(N5_NUR_WOERTER, D044).erfuellt).toBe(false);
  });

  it("N6 · dieselbe Variable, lückenlose Kette — aber auf zwei Testfälle verteilt: KEIN Beleg", () => {
    // Diese Form haengt AUSSCHLIESSLICH an der Testfallgrenze. Fiele die Pruefung wie in D11 auf
    // den gesamten SourceFile-Knoten zurueck, waere sie gruen — die Kette ist ja vollstaendig.
    const befund = belegAssertionErfuellt(N6_GETRENNT_GLEICHE_VARIABLE, D044);
    expect(befund.erfuellt).toBe(false);
  });

  // ============================================================================================
  // DER KAUSALE UNTERSCHIED — gegen den D10-NACHBAU, nicht gegen den Originalstand.
  // ============================================================================================
  it("D10-Nachbau gibt N1, N2, N4 und N5 fälschlich frei — die neue Prüfung nicht", () => {
    for (const [name, quelle] of [
      ["N1 zwei Tests", N1_ZWEI_TESTS],
      ["N2 fremdes Element", N2_FREMDES_ELEMENT],
      ["N4 aufgebrochene Variable", N4_AUFGEBROCHENE_VARIABLE],
      ["N5 nur Wörter", N5_NUR_WOERTER],
    ] as const) {
      expect(wortpruefungD10(quelle, D044), `${name}: D10-Nachbau muss freigeben`).toBe(true);
      expect(belegAssertionErfuellt(quelle, D044).erfuellt, `${name}: D12 muss ablehnen`).toBe(
        false,
      );
    }
  });

  it("und beide sind sich bei den echten Formen einig", () => {
    for (const quelle of [P1_ZWISCHENVARIABLE, P2_DIREKT]) {
      expect(wortpruefungD10(quelle, D044)).toBe(true);
      expect(belegAssertionErfuellt(quelle, D044).erfuellt).toBe(true);
    }
  });

  // ============================================================================================
  // KEIN SOURCEFILE-RÜCKFALL — die Kernpflicht 1 aus BENs D11-Urteil.
  // ============================================================================================
  it("N1 bleibt auch dann rot, wenn beide Tests in derselben Datei stehen", () => {
    // Genau das war der D11-Rückfall: `pruefeTestfall(sf)` auf die komplette Quelldatei.
    // Die Summe zweier Testfälle darf keinen Beleg erzeugen.
    const zusammen = `${N1_ZWEI_TESTS}\n${N5_NUR_WOERTER}`;
    expect(belegAssertionErfuellt(zusammen, D044).erfuellt).toBe(false);
  });

  it("eine Datei ganz ohne it/test-Rumpf ist rot und sagt auch, warum", () => {
    const befund = belegAssertionErfuellt("const x = 1;", D044);
    expect(befund.erfuellt).toBe(false);
    expect(befund.bruchstelle).toBe("kein ausgefuehrter it/test-Rumpf");
  });
});
