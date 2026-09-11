// ================================================================================================
// JOB 3582 · DIE DECKELUNG DES LOGOKASTENS — GELESEN AUS DEM AUSFÜHRBAREN CODE, NICHT AUS TEXT.
// ================================================================================================
//
// WOZU ES DIESE DATEI GIBT. Die Obergrenze der Logokastenbreite hat je Bauform GENAU EINE benannte
// Stelle in `apps/web/src/shell/Logo.tsx` (Lieferung 2 des Auftrags: „keine an zwei Orten
// wiederholte Zahl"). Zwei Prüfungen müssen sie kennen, und beide dürfen sie nicht abschreiben:
//
//   · der Wächter (`deckelung-waechter.test.ts`) fragt, ob sie als CODE dasteht;
//   · die Chromium-Messung (`logokasten-chromium.test.ts`) fragt, ob der Browser GENAU diese Zahl
//     durchsetzt. Stünde die Zahl in der Messdatei noch einmal, wäre sie zweimal da — und beim
//     nächsten Verstellen würde eine der beiden nachgeführt.
//
// WARUM ÜBER DEN SYNTAXBAUM UND NICHT ÜBER ZEICHENKETTEN — die Doktrin des Hauses, wörtlich aus
// `tests/capture/aufrufer-waechter.test.ts` und `tests/tor-inventar/browser-gruppe.ts`: „Kommentare
// kommen im AST gar nicht vor, und eine Zeichenkette in einer Argumentliste ist kein
// Modulspezifizierer." Für diesen Wächter ist das die ganze Aussage. Der Auftrag verlangt
// ausdrücklich (Lieferung 6), dass er sich „weder von einem Kommentar noch von einem
// Zeichenkettenliteral befriedigen" lässt — und genau das ist über den Baum baulich erfüllt statt
// durch eine Liste verbotener Schreibweisen erkauft:
//
//   · Ein Kommentar ist kein Knoten. Er kann die Deklaration nicht liefern.
//   · Der Inhalt eines Zeichenkettenliterals ist EIN Knoten (`StringLiteral`) und enthält keine
//     Identifier. Eine Klasse wie `max-w-[44px]` in einem `className` ist deshalb für diese Prüfung
//     unsichtbar — sie könnte sie nie erfüllen.
//
// Die Prüfung arbeitet auf einem ÜBERGEBENEN Quelltext, nicht nur auf der Datei. Nur so kann der
// Wächter sich selbst kalibrieren (Gegenprobe L8: derselbe Text, in dem die Wörter ausschliesslich
// im Kommentar oder in einer Zeichenkette stehen, muss rot bleiben).
import { readFileSync } from "node:fs";
import ts from "typescript";

/** Der Name, unter dem die Obergrenze im Produkt steht — die Prüfung ist NAMENTLICH, nicht zählend. */
export const DECKELUNG_NAME = "LOGO_MAX_BREITE_PX";

/**
 * Der Name der ZWEITEN Stufe: die Obergrenze der BREITEN Zeile (Runde 2).
 *
 * Sie steht hier nicht, weil zwei Zahlen schöner wären als eine, sondern weil §5.4 des Auftrags
 * verlangt, dass die Deckelung bei 1280 px NICHT greift. Eine Stufe, die dort nicht greift, und
 * eine, die bei 390 px trägt, sind zwangsläufig zwei Zahlen — und beide gehören bewacht: fiele die
 * breite fort, käme die Deckelung in die Mockup-Bauform zurück; fiele die schmale fort, käme der
 * Befund von JOB 3571 zurück.
 */
export const DECKELUNG_BREIT_NAME = "LOGO_MAX_BREITE_BREIT_PX";

/**
 * Der Name der zweiten benannten Stelle: die Breitenspanne, in der die Zeile den Logokasten in
 * KEINER Grösse trägt (die breite Bauform an ihrem engen Ende).
 *
 * Sie wird genauso gelesen wie `SCHMAL_PUNKTE_QUERY` in `kopfband-ci-chromium.test.ts` — und aus
 * demselben Grund: die Pflicht einer Messung kommt aus der ZUSAGE des Produkts, nicht aus dem
 * gemessenen Baum. Verschiebt jemand die Spanne, wandert die Messung von selbst mit; nimmt jemand
 * sie heraus, ohne das Logo tragbar zu machen, wird die Messung rot.
 */
export const SPANNE_NAME = "LOGO_OHNE_PLATZ_QUERY";

/**
 * Der Name der Breitenzusage, ab der die BREITE Stufe der Deckelung gilt.
 *
 * Sie wird genauso gelesen und genauso von Chromium ausgewertet wie `SPANNE_NAME`: eine Messung,
 * die selbst entschiede, ab welcher Breite welche Stufe gilt, prüfte ihre eigene Annahme statt der
 * Zusage des Produkts.
 */
export const BREITE_ZEILE_NAME = "LOGO_BREITE_ZEILE_QUERY";

/** Der Logokasten, an dem die Deckelung hängen muss — dieselbe Kennung, die die Messung greift. */
export const LOGO_TESTID = "kopfband-firmenlogo";

export const LOGO_QUELLE = new URL("../../apps/web/src/shell/Logo.tsx", import.meta.url);

export interface Deckelung {
  /** Der Zahlenwert aus dem ausführbaren Code — `null`, wenn es ihn dort nicht gibt. */
  wert: number | null;
  /** Dasselbe für die Stufe der breiten Zeile. */
  wertBreit: number | null;
  /** Die Breitenspanne ohne Logokasten, wörtlich aus dem Code — `null`, wenn es sie nicht gibt. */
  spanne: string | null;
  /** Die Breitenzusage, ab der die breite Stufe gilt — `null`, wenn es sie nicht gibt. */
  breiteZeile: string | null;
  /** Was fehlt. Leer heisst: alle vier Regeln stehen als Code an ihrer Stelle. */
  fehler: string[];
}

function jsxName(knoten: ts.JsxAttributeLike): string {
  return ts.isJsxAttribute(knoten) ? knoten.name.getText() : "";
}

/** Trägt dieses JSX-Element das gesuchte `data-testid`? */
function istLogoKasten(attribute: ts.JsxAttributes): boolean {
  for (const a of attribute.properties) {
    if (!ts.isJsxAttribute(a) || jsxName(a) !== "data-testid") {
      continue;
    }
    const wert = a.initializer;
    if (wert && ts.isStringLiteral(wert) && wert.text === LOGO_TESTID) {
      return true;
    }
  }
  return false;
}

/** Der nächste Vorfahr, der ein `style`-Attribut IST — oder null. */
function imStilAttribut(knoten: ts.Node): boolean {
  for (let e: ts.Node | undefined = knoten.parent; e !== undefined; e = e.parent) {
    if (ts.isJsxAttribute(e)) {
      return jsxName(e) === "style";
    }
  }
  return false;
}

/** Steht dieser Knoten im Teilbaum des Logokastens? */
function imLogoKasten(knoten: ts.Node): boolean {
  for (let e: ts.Node | undefined = knoten.parent; e !== undefined; e = e.parent) {
    if (ts.isJsxSelfClosingElement(e) && istLogoKasten(e.attributes)) {
      return true;
    }
    if (ts.isJsxElement(e) && istLogoKasten(e.openingElement.attributes)) {
      return true;
    }
  }
  return false;
}

/** Ist dieser Identifier der NAME einer Deklaration (und damit keine Verwendung)? */
function istDeklarationsname(knoten: ts.Identifier): boolean {
  const eltern = knoten.parent;
  return eltern !== undefined && ts.isVariableDeclaration(eltern) && eltern.name === knoten;
}

/**
 * Die Fragen, die zusammen „alle vier Regeln sind da und sie WIRKEN" ergeben:
 *
 *   1. Es gibt je genau EINE Deklaration `const LOGO_MAX_BREITE_PX = <Zahl>` und
 *      `const LOGO_MAX_BREITE_BREIT_PX = <Zahl>` — die zwei benannten Stufen der Obergrenze, beide
 *      grösser als 0. Eine Deckelung auf 0 wäre das heimliche Weglassen des Logos, nicht seine
 *      Einpassung.
 *   2. BEIDE Namen werden im Teilbaum des Logokastens VERWENDET, und zwar in einem `style`-Ausdruck.
 *      Eine Verwendung ist ein Identifier-Knoten; in einem Kommentar oder im Inhalt einer
 *      Zeichenkette gibt es keinen.
 *   3. Die breite Stufe ist nicht kleiner als die schmale. Wäre sie es, stünde die Regel auf dem
 *      Kopf: die enge Zeile trüge mehr als die weite, und §5.4 („bei 1280 px greift die Deckelung
 *      nicht") wäre mit einer grösseren Zahl an der falschen Stelle beantwortet.
 *   4. Es gibt je genau EINE Deklaration `const LOGO_OHNE_PLATZ_QUERY = "<Medienabfrage>"` und
 *      `const LOGO_BREITE_ZEILE_QUERY = "<Medienabfrage>"`, und beide Namen werden verwendet. Eine
 *      Zusage, die niemand liest, verspräche eine Regel, die es nicht gibt.
 */
export function pruefeQuelle(quelltext: string, dateiname = "Logo.tsx"): Deckelung {
  const baum = ts.createSourceFile(
    dateiname,
    quelltext,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const fehler: string[] = [];
  /** Je Name: die Deklarationen und ob der Name an seinem Wirkort verwendet wird. */
  const deklarationen = new Map<string, ts.VariableDeclaration[]>();
  const verwendet = new Map<string, boolean>();
  const zahlNamen = [DECKELUNG_NAME, DECKELUNG_BREIT_NAME];
  const textNamen = [SPANNE_NAME, BREITE_ZEILE_NAME];
  const alleNamen = [...zahlNamen, ...textNamen];
  for (const name of alleNamen) {
    deklarationen.set(name, []);
    verwendet.set(name, false);
  }

  const gehe = (knoten: ts.Node): void => {
    if (
      ts.isVariableDeclaration(knoten) &&
      ts.isIdentifier(knoten.name) &&
      deklarationen.has(knoten.name.text)
    ) {
      deklarationen.get(knoten.name.text)?.push(knoten);
    } else if (ts.isIdentifier(knoten) && !istDeklarationsname(knoten)) {
      // Die ZAHLEN müssen im `style` des Logokastens stehen — nur dort wirken sie auf die Breite.
      // Die ZUSAGEN genügen mit irgendeiner Verwendung; wo sie gelesen werden, entscheidet das
      // Produkt, und eine Vorschrift darüber wäre eine zweite Wahrheit über `Logo.tsx`.
      const amWirkort = zahlNamen.includes(knoten.text)
        ? imStilAttribut(knoten) && imLogoKasten(knoten)
        : textNamen.includes(knoten.text);
      if (amWirkort) {
        verwendet.set(knoten.text, true);
      }
    }
    ts.forEachChild(knoten, gehe);
  };
  gehe(baum);

  const werte = new Map<string, number | null>();
  for (const name of zahlNamen) {
    const gefunden = deklarationen.get(name) ?? [];
    if (gefunden.length === 0) {
      fehler.push(
        `in ${dateiname} steht keine Deklaration \`const ${name} = <Zahl>\` im ausführbaren Code — eine Obergrenze, die nur im Kommentar oder in einer Klassen-Zeichenkette steht, ist für diesen Wächter nicht vorhanden`,
      );
    }
    if (gefunden.length > 1) {
      fehler.push(
        `\`${name}\` ist in ${dateiname} ${gefunden.length}-mal deklariert — jede Stufe der Obergrenze soll EINE benannte Stelle sein`,
      );
    }
    const initialisierer = gefunden[0]?.initializer;
    const wert =
      initialisierer !== undefined && ts.isNumericLiteral(initialisierer)
        ? Number(initialisierer.text)
        : null;
    werte.set(name, wert);
    if (gefunden[0] !== undefined && wert === null) {
      fehler.push(
        `\`${name}\` in ${dateiname} ist keine Zahl — die Deckelung muss als Zahl dastehen, damit die Messung sie nachrechnen kann`,
      );
    }
    if (wert !== null && !(wert > 0)) {
      fehler.push(
        `\`${name}\` ist ${wert} — eine Obergrenze von 0 wäre das stille Weglassen des Firmenlogos, nicht seine Einpassung`,
      );
    }
    if (verwendet.get(name) !== true) {
      fehler.push(
        `\`${name}\` wird in ${dateiname} nirgends in einem \`style\`-Ausdruck INNERHALB des Logokastens (\`data-testid="${LOGO_TESTID}"\`) verwendet — die Zahl steht da, wirkt aber nicht`,
      );
    }
  }

  const wert = werte.get(DECKELUNG_NAME) ?? null;
  const wertBreit = werte.get(DECKELUNG_BREIT_NAME) ?? null;
  if (wert !== null && wertBreit !== null && wertBreit < wert) {
    fehler.push(
      `\`${DECKELUNG_BREIT_NAME}\` (${wertBreit}) ist kleiner als \`${DECKELUNG_NAME}\` (${wert}) — dann trüge die enge Zeile mehr als die breite, und bei 1280 px griffe die Deckelung stärker statt gar nicht`,
    );
  }

  const texte = new Map<string, string | null>();
  for (const name of textNamen) {
    const gefunden = deklarationen.get(name) ?? [];
    const initialisierer = gefunden[0]?.initializer;
    const text =
      initialisierer !== undefined && ts.isStringLiteral(initialisierer)
        ? initialisierer.text
        : null;
    texte.set(name, text);
    if (gefunden.length !== 1 || text === null) {
      fehler.push(
        `in ${dateiname} steht keine EINE Deklaration \`const ${name} = "<Medienabfrage>"\` im ausführbaren Code — diese Breitenzusage hat dann keine benannte Quelle`,
      );
    }
    if (verwendet.get(name) !== true) {
      fehler.push(
        `\`${name}\` wird in ${dateiname} nirgends verwendet — sie steht da, wirkt aber nicht`,
      );
    }
  }

  return {
    wert,
    wertBreit,
    spanne: texte.get(SPANNE_NAME) ?? null,
    breiteZeile: texte.get(BREITE_ZEILE_NAME) ?? null,
    fehler,
  };
}

/** Dieselbe Prüfung an der echten Datei des Produkts. */
export function liesDeckelung(): Deckelung {
  return pruefeQuelle(readFileSync(LOGO_QUELLE, "utf8"), "apps/web/src/shell/Logo.tsx");
}

/**
 * Die vier Werte, auf die sich eine Messung stützen darf — oder ein Abbruch mit Grund.
 *
 * Bewusst werfend und nicht `null`-liefernd: eine Messung, die ohne diese Regeln „weiterläuft",
 * misst eine andere Sache als die, die sie behauptet.
 */
export function regelnOderAbbruch(): {
  grenze: number;
  grenzeBreit: number;
  spanne: string;
  breiteZeile: string;
} {
  const d = liesDeckelung();
  if (
    d.wert === null ||
    d.wertBreit === null ||
    d.spanne === null ||
    d.breiteZeile === null ||
    d.fehler.length > 0
  ) {
    throw new Error(`die Regeln des Logokastens sind nicht lesbar: ${d.fehler.join(" · ")}`);
  }
  return {
    grenze: d.wert,
    grenzeBreit: d.wertBreit,
    spanne: d.spanne,
    breiteZeile: d.breiteZeile,
  };
}
