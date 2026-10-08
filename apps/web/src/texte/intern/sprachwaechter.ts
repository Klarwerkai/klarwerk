// ================================================================================================
// R-1169 / R-0983 · DER SPRACHWÄCHTER IM BAUPROZESS — HART CODIERTE TEXTE UND UNBEKANNTE SPRACHEN.
// ================================================================================================
//
// R-1169 verlangt einen Wächter im Bau, der anschlägt, wenn ein Text nicht in allen drei Sprachen
// vorliegt, wenn eine unbekannte Sprache auftaucht, UND wenn ein Text hart im Code steht statt in
// der Übersetzungsdatei. Die erste Hälfte trägt seit JOB 4367 der Textmodul-Vertrag
// (`./pruefung.ts`, Regel 4 und „unbekannter Eintrag" in der Modulform). Diese Datei trägt die
// beiden anderen:
//
//   1. UNBEKANNTE SPRACHE IM GRUNDBESTAND. `woerterbuch/` führt je Sprache eine Datei. Eine
//      `fr.ts` dort wäre still: `i18n.ts` importiert sie nicht, niemand sähe sie. Der Wächter lässt
//      nur die Sprachen der Oberfläche zu (`SPRACHEN` aus `./pruefung.ts`).
//
//   2. HART CODIERTE ANZEIGETEXTE IN TSX — ANHAND DER JSX-STRUKTUR, nicht zeilenweise. Jede
//      `.tsx`-Datei (ohne Tests) wird mit dem TypeScript-Parser gelesen; gemeldet wird:
//        · JSX-Text zwischen Tags, auch mit Komma, Doppelpunkt und über mehrere Zeilen
//                                                     <span>Hallo, Welt</span>
//        · ein JSX-Zeichenkettenausdruck als Kind      {"Hallo"} · {`${n} Einträge`}
//          — auch als Zweig von `?:`, `&&`, `||`, `??`  {ok ? "OK" : "FAIL"}
//        · ein Textattribut mit Wortlaut               title="…" · placeholder="…" ·
//                                                     aria-label="…" · alt="…" (auch als {"…"})
//      Kommentare kommen im Syntaxbaum nicht als Text vor; Typargumente (`Map<string, X>`) und
//      Pfeilfunktionen sind dort Typen und Ausdrücke, kein JSX-Text. Ein Text zählt erst, wenn er
//      zwei aufeinanderfolgende Buchstaben trägt („v1", „×", „%" zählen nicht), und er zählt NICHT,
//      wenn er ein technischer Bezeichner ist: ein einziges Wort ohne Leerzeichen mit einem
//      Trenner wie `.`, `/`, `_`, `#` oder einem Binnen-Großbuchstaben (`klarwerk.ai`,
//      `screenshots/x.png`, `lib.facet.tag`, `iPhone`). Inhalte von `<style>`/`<script>` sind Code.
//
// WAS DER WÄCHTER NICHT SIEHT, ausdrücklich: Zeichenketten in Variablen und Datenlisten, die später
// gerendert werden, und Texte in `.ts`-Dateien. Dafür müsste er den Datenfluss kennen.
//
// AUSNAHMEN SIND AN DATEI UND WORTLAUT GEBUNDEN, nicht an eine Anzahl: `AUSNAHMEN` nennt je
// Fundstelle die Datei, den Text und den Grund. Ein anderer Text in derselben Datei übernimmt keine
// Ausnahme, und eine Ausnahme, deren Text nicht mehr gefunden wird, ist selbst ein Befund (sie
// gehört gestrichen). Beides hält `tests/sprache-begriffe/sprachwaechter.test.ts` fest.
//
// WARUM HIER UND NICHT NUR IM TEST: dieselbe Funktion ruft das Vite-Plugin `textmodul-vertrag`
// (`./sammeln.ts`) beim Produktbuild. Damit fällt ein neuer harter Text im Bau auf, nicht erst im
// Browser — und nicht nur dort, wo jemand den Test laufen lässt.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { SPRACHEN } from "./pruefung";

/** Die Attribute, deren Wert Anzeige- oder Vorlesetext ist. */
export const TEXTATTRIBUTE: ReadonlySet<string> = new Set([
  "title",
  "placeholder",
  "aria-label",
  "alt",
]);

/** Elemente, deren Kinder Code sind und kein Anzeigetext. */
const CODE_ELEMENTE: ReadonlySet<string> = new Set(["style", "script"]);

const ZWEI_BUCHSTABEN = /\p{L}\p{L}/u;
const EIN_WORT = /^[\p{L}\p{N}_.\-/:#?=&@%+~]+$/u;
const TRENNER = /[._/#?=&@~]|\p{Ll}\p{Lu}/u;

/** Leerraum zusammenfassen, Ränder abschneiden — so, wie der Text auf der Seite steht. */
export function normalisiere(roh: string): string {
  return roh.replace(/\s+/g, " ").trim();
}

/** Ist dieser Text etwas, das ein Mensch liest — und kein technischer Bezeichner? */
export function istAnzeigetext(roh: string): boolean {
  const text = normalisiere(roh);
  if (!ZWEI_BUCHSTABEN.test(text)) {
    return false;
  }
  return !(EIN_WORT.test(text) && TRENNER.test(text));
}

export interface Ausnahme {
  /** relativ zu `apps/web/src`, mit `/` */
  readonly datei: string;
  /** der normalisierte Wortlaut, zeichengleich */
  readonly text: string;
  /** Warum genau dieser Text bleiben darf. */
  readonly grund: string;
}

const MARKE =
  "Wortmarke KLARWERK — ein Name, kein übersetzbarer Text (docs/ci/CI_KURZREFERENZ.md: Wortmarke in Versalien).";

/** Die heute gemessenen, begründeten Fundstellen. Jede ist an Datei UND Wortlaut gebunden. */
export const AUSNAHMEN: readonly Ausnahme[] = [
  { datei: "auth/BrandPanel.tsx", text: "KLARWERK", grund: MARKE },
  { datei: "auth/SsoCallback.tsx", text: "KLARWERK", grund: MARKE },
  { datei: "pages/Mobile.tsx", text: "KLARWERK", grund: MARKE },
  { datei: "shell/Logo.tsx", text: "KLARWERK", grund: MARKE },
];

export interface Fund {
  /** relativ zu `apps/web/src`, mit `/` */
  readonly datei: string;
  /** 1-basiert */
  readonly zeile: number;
  /** normalisiert */
  readonly text: string;
  readonly art: "jsx-text" | "jsx-ausdruck" | "attribut";
}

/** Die literalen Textteile eines Ausdrucks — auch in den Zweigen von `?:`, `&&`, `||`, `??`. */
function literaleTexte(ausdruck: ts.Expression): string[] {
  if (ts.isParenthesizedExpression(ausdruck)) {
    return literaleTexte(ausdruck.expression);
  }
  if (ts.isStringLiteral(ausdruck) || ts.isNoSubstitutionTemplateLiteral(ausdruck)) {
    return [ausdruck.text];
  }
  if (ts.isTemplateExpression(ausdruck)) {
    return [ausdruck.head.text, ...ausdruck.templateSpans.map((span) => span.literal.text)];
  }
  if (ts.isConditionalExpression(ausdruck)) {
    return [...literaleTexte(ausdruck.whenTrue), ...literaleTexte(ausdruck.whenFalse)];
  }
  if (ts.isBinaryExpression(ausdruck)) {
    const op = ausdruck.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
      return literaleTexte(ausdruck.right);
    }
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      return [...literaleTexte(ausdruck.left), ...literaleTexte(ausdruck.right)];
    }
  }
  return [];
}

/** Ist der Knoten Kind eines `<style>`/`<script>`-Elements? */
function inCodeElement(knoten: ts.Node, quelle: ts.SourceFile): boolean {
  const eltern = knoten.parent;
  return (
    eltern !== undefined &&
    ts.isJsxElement(eltern) &&
    CODE_ELEMENTE.has(eltern.openingElement.tagName.getText(quelle))
  );
}

/** Jeder hart codierte Anzeigetext in einem TSX-Quelltext, mit Zeile. */
export function hartkodierteTexte(
  inhalt: string,
  datei = "probe.tsx",
): { zeile: number; text: string; art: Fund["art"] }[] {
  const quelle = ts.createSourceFile(
    datei,
    inhalt,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const funde: { zeile: number; text: string; art: Fund["art"] }[] = [];
  const melde = (position: number, roh: string, art: Fund["art"]): void => {
    if (istAnzeigetext(roh)) {
      const zeile = quelle.getLineAndCharacterOfPosition(position).line + 1;
      funde.push({ zeile, text: normalisiere(roh), art });
    }
  };
  const besuche = (knoten: ts.Node): void => {
    if (ts.isJsxText(knoten) && !inCodeElement(knoten, quelle)) {
      // Die Zeile des ersten sichtbaren Zeichens, nicht die des führenden Zeilenumbruchs.
      const vorlauf = knoten.text.length - knoten.text.trimStart().length;
      melde(knoten.getStart(quelle) + vorlauf, knoten.text, "jsx-text");
    } else if (
      ts.isJsxExpression(knoten) &&
      knoten.expression !== undefined &&
      (ts.isJsxElement(knoten.parent) || ts.isJsxFragment(knoten.parent)) &&
      !inCodeElement(knoten, quelle)
    ) {
      for (const text of literaleTexte(knoten.expression)) {
        melde(knoten.getStart(quelle), text, "jsx-ausdruck");
      }
    } else if (ts.isJsxAttribute(knoten) && TEXTATTRIBUTE.has(knoten.name.getText(quelle))) {
      const wert = knoten.initializer;
      if (wert !== undefined && ts.isStringLiteral(wert)) {
        melde(knoten.getStart(quelle), wert.text, "attribut");
      } else if (wert !== undefined && ts.isJsxExpression(wert) && wert.expression !== undefined) {
        for (const text of literaleTexte(wert.expression)) {
          melde(knoten.getStart(quelle), text, "attribut");
        }
      }
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(quelle);
  return funde;
}

/** Alle `.tsx`-Dateien unter `srcOrdner`, ohne Testdateien und ohne versteckte Ordner. */
function tsxDateien(srcOrdner: string, unterordner = ""): string[] {
  const ordner = unterordner === "" ? srcOrdner : join(srcOrdner, unterordner);
  let eintraege: { name: string; isDirectory(): boolean; isFile(): boolean }[] = [];
  try {
    eintraege = readdirSync(ordner, { withFileTypes: true });
  } catch {
    return []; // kein Ordner ist ein gültiger Zustand (Bühnen der Vertragstests)
  }
  const gefunden: string[] = [];
  for (const eintrag of eintraege) {
    if (eintrag.name.startsWith(".")) {
      continue;
    }
    const relativ = unterordner === "" ? eintrag.name : `${unterordner}/${eintrag.name}`;
    if (eintrag.isDirectory()) {
      gefunden.push(...tsxDateien(srcOrdner, relativ));
    } else if (
      eintrag.isFile() &&
      eintrag.name.endsWith(".tsx") &&
      !eintrag.name.endsWith(".test.tsx")
    ) {
      gefunden.push(relativ);
    }
  }
  return gefunden.sort();
}

/** Jeder Fund im Baum — für die Meldung und für den Test. */
export function hartkodierteFunde(srcOrdner: string): Fund[] {
  const funde: Fund[] = [];
  for (const datei of tsxDateien(srcOrdner)) {
    const inhalt = readFileSync(join(srcOrdner, datei), "utf8");
    for (const fund of hartkodierteTexte(inhalt, datei)) {
      funde.push({ datei, ...fund });
    }
  }
  return funde;
}

const passt = (fund: Fund, ausnahme: Ausnahme): boolean =>
  fund.datei === ausnahme.datei && fund.text === ausnahme.text;

/**
 * Befunde als Liste, leer heißt grün:
 *   · jeder Fund, den keine Ausnahme mit DERSELBEN Datei und DEMSELBEN Wortlaut deckt;
 *   · jede Ausnahme, deren Datei im Baum liegt, deren Text dort aber nicht mehr gefunden wird
 *     (sie gehört gestrichen). Ausnahmen zu Dateien, die der geprüfte Baum gar nicht trägt — die
 *     Bühnen der Vertragstests —, sind keine Aussage über diesen Baum.
 */
export function pruefeHartkodierteTexte(
  srcOrdner: string,
  ausnahmen: readonly Ausnahme[] = AUSNAHMEN,
): string[] {
  const dateien = new Set(tsxDateien(srcOrdner));
  const funde = hartkodierteFunde(srcOrdner);
  const fehler: string[] = [];
  for (const fund of funde) {
    if (!ausnahmen.some((ausnahme) => passt(fund, ausnahme))) {
      fehler.push(
        `${fund.datei}:${fund.zeile}: hart codierter Anzeigetext (${fund.art}) „${fund.text}“ — über t("…") aus einem Textmodul holen (apps/web/src/texte/).`,
      );
    }
  }
  for (const ausnahme of ausnahmen) {
    if (dateien.has(ausnahme.datei) && !funde.some((fund) => passt(fund, ausnahme))) {
      fehler.push(
        `${ausnahme.datei}: Ausnahme „${ausnahme.text}“ hat keinen Fund mehr — in apps/web/src/texte/intern/sprachwaechter.ts streichen.`,
      );
    }
  }
  return fehler;
}

/** Unbekannte Sprachen im Grundbestand: jede Datei in `woerterbuch/` ausser de/en/nl. */
export function pruefeSprachdateien(srcOrdner: string): string[] {
  let dateien: string[] = [];
  try {
    dateien = readdirSync(join(srcOrdner, "woerterbuch"));
  } catch {
    return []; // kein Grundbestand-Ordner (Bühnen der Vertragstests) — nichts zu prüfen
  }
  const erlaubt = new Set<string>(SPRACHEN.map((sprache) => `${sprache}.ts`));
  const fehler: string[] = [];
  for (const datei of [...dateien].sort()) {
    if (datei.startsWith(".") || erlaubt.has(datei)) {
      continue;
    }
    fehler.push(
      `woerterbuch/${datei}: unbekannte Sprache — die Oberfläche kennt nur ${SPRACHEN.join(", ")}. Eine weitere Sprache wäre hier still ignoriert worden.`,
    );
  }
  return fehler;
}
