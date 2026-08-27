// ================================================================================================
// JOB 2433 · D1 — ZWEI FLAECHEN, EINE ENTSCHEIDUNG: der Gleichlauf des Anhaengen-Tors.
// ================================================================================================
//
// DER BEFUND, aus dem dieser Waechter entstand. Die Sperre „darf ein externer Treffer angehaengt
// werden" steht an ZWEI Flaechen, und an beiden ist die Entscheidung INLINE aufgeschrieben:
//
//   apps/web/src/pages/KnowledgeDetail.tsx:1733  {extAttachAllowed ? null : (…Banner…)}
//   apps/web/src/pages/KnowledgeDetail.tsx:1799  title={extAttachAllowed ? undefined : t("ext.attachBlocked")}
//   apps/web/src/pages/Capture.tsx:5145          {canAttachExternalResult(extPolicyStage) ? null : (…Banner…)}
//   apps/web/src/pages/Capture.tsx:5224          title={canAttachExternalResult(extPolicyStage) ? undefined : t("ext.attachBlocked")}
//
// Zweimal dieselbe Zuordnung an zwei Orten. Aendert jemand die eine und die andere nicht, merkt
// es heute niemand — es gibt keinen Fall, der beide vergleicht. Genau das ist der Boden, auf dem
// Drift entsteht.
//
// ------------------------------------------------------------------------------------------------
// WARUM DIESER FALL NICHT ZWEI TEXTE VERGLEICHT
// ------------------------------------------------------------------------------------------------
//
// Ein Textvergleich waere heute schon rot, obwohl nichts kaputt ist: die eine Flaeche schreibt
// `extAttachAllowed` (eine Konstante weiter oben), die andere ruft `canAttachExternalResult(stage)`
// direkt. **Verschieden geschrieben, gleich entschieden.** Ein Waechter, der das nicht
// unterscheidet, meldet Drift, wo keine ist — und wird nach dem dritten Fehlalarm abgeschaltet.
//
// Dieser Fall misst deshalb, was der Code ENTSCHEIDET:
//
//   1. Er holt aus jeder Flaeche den Bedingungsausdruck des Banners und des Titels — ueber den
//      Syntaxbaum, an den Ankern `data-testid="ext-attach-blocked"` und dem `title`-Attribut.
//   2. Ist die Bedingung ein blosser Bezeichner (`extAttachAllowed`), loest er ihn auf seine
//      Deklaration auf — sonst verglichen er einen Namen statt einer Regel.
//   3. Er baut aus dem aufgeloesten Ausdruck eine Funktion und WERTET SIE AUS, fuer alle sechs
//      Zustaende der Stufe, mit der ECHTEN Regel aus `externalAttachGate`.
//   4. Verglichen werden die Ergebnisvektoren beider Flaechen.
//
// Damit ist der Fall gegen Umbenennungen, Zwischenkonstanten und Formatierung unempfindlich —
// und empfindlich fuer genau das, was zaehlt: eine Flaeche entscheidet anders als die andere.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import type { ExternalKnowledgeStage } from "../../apps/web/src/api/types";
import {
  canAttachExternalResult,
  canSearchExternal,
} from "../../apps/web/src/lib/externalAttachGate";

const WURZEL = join(__dirname, "..", "..");

/**
 * Die Regeln, die eine Flaeche benutzen DARF — mit ihrer echten Fassung.
 *
 * Sie werden dem ausgewerteten Ausdruck hereingereicht, statt eine davon fest zu erwarten. Das
 * ist der Unterschied zwischen „die Flaeche ruft die richtige Funktion" (Namensanwesenheit) und
 * „die Flaeche entscheidet richtig" (Verhalten): Greift sie zur falschen Regel, laeuft der
 * Ausdruck trotzdem — und der Vektor wird anders. Genau das soll der Fall melden, nicht einen
 * Aufloesungsfehler.
 */
const REGELN = { canAttachExternalResult, canSearchExternal } as const;

/** Alle vier Stufen aus `api/types.ts:54`, dazu die zwei Zustaende „noch nicht geladen". */
const STUFEN: (ExternalKnowledgeStage | null | undefined)[] = [
  "blocked",
  "search_on_click",
  "search_attach",
  "open",
  null,
  undefined,
];

/** Die zwei Flaechen, die dieselbe Entscheidung treffen. */
const FLAECHEN = [
  { name: "Pruefbereich", datei: "apps/web/src/pages/KnowledgeDetail.tsx" },
  { name: "Erfassen", datei: "apps/web/src/pages/Capture.tsx" },
];

/** Der Anker des sichtbaren Grundes — er steht auf beiden Flaechen. */
const BANNER_ANKER = "ext-attach-blocked";
/** Der i18n-Schluessel des Grundes — er macht das title-Attribut auffindbar. */
const GRUND_SCHLUESSEL = "ext.attachBlocked";

function baum(datei: string): ts.SourceFile {
  const pfad = join(WURZEL, datei);
  return ts.createSourceFile(pfad, readFileSync(pfad, "utf8"), ts.ScriptTarget.Latest, true);
}

function jsxAttributName(a: ts.JsxAttributeLike): string {
  return ts.isJsxAttribute(a) ? a.name.getText() : "";
}

/**
 * Die Bedingung, unter der das Banner NICHT erscheint — also der `? null :`-Zweig um das Element
 * mit dem Anker. Zurueck kommt der Ausdruck, nicht sein Text.
 */
function bannerBedingung(quelle: ts.SourceFile): ts.Expression | null {
  let treffer: ts.Expression | null = null;
  const besuche = (k: ts.Node): void => {
    if (ts.isJsxOpeningElement(k) || ts.isJsxSelfClosingElement(k)) {
      const hatAnker = k.attributes.properties.some(
        (a) =>
          jsxAttributName(a) === "data-testid" &&
          ts.isJsxAttribute(a) &&
          a.initializer !== undefined &&
          ts.isStringLiteral(a.initializer) &&
          a.initializer.text === BANNER_ANKER,
      );
      if (hatAnker) {
        // Nach oben laufen, bis der umschliessende Bedingungsausdruck kommt.
        let lauf: ts.Node | undefined = k;
        while (lauf) {
          if (ts.isConditionalExpression(lauf)) {
            treffer = lauf.condition;
            return;
          }
          lauf = lauf.parent;
        }
      }
    }
    ts.forEachChild(k, besuche);
  };
  besuche(quelle);
  return treffer;
}

/** Die Bedingung des `title`-Attributs am Anhaengen-Knopf. */
function titelBedingung(quelle: ts.SourceFile): ts.ConditionalExpression | null {
  let treffer: ts.ConditionalExpression | null = null;
  const besuche = (k: ts.Node): void => {
    if (
      ts.isJsxAttribute(k) &&
      k.name.getText() === "title" &&
      k.initializer &&
      ts.isJsxExpression(k.initializer) &&
      k.initializer.expression &&
      k.initializer.expression.getText().includes(GRUND_SCHLUESSEL) &&
      ts.isConditionalExpression(k.initializer.expression)
    ) {
      treffer = k.initializer.expression;
    }
    ts.forEachChild(k, besuche);
  };
  besuche(quelle);
  return treffer;
}

/** Ist der Ausdruck ein blosser Bezeichner, wird seine Deklaration eingesetzt. */
function aufgeloest(quelle: ts.SourceFile, ausdruck: ts.Expression): ts.Expression {
  if (!ts.isIdentifier(ausdruck)) {
    return ausdruck;
  }
  const gesucht = ausdruck.getText();
  let gefunden: ts.Expression | null = null;
  const besuche = (k: ts.Node): void => {
    if (
      ts.isVariableDeclaration(k) &&
      ts.isIdentifier(k.name) &&
      k.name.getText() === gesucht &&
      k.initializer
    ) {
      gefunden = k.initializer;
    }
    ts.forEachChild(k, besuche);
  };
  besuche(quelle);
  return gefunden ?? ausdruck;
}

/** Die freien Bezeichner eines Ausdrucks — ohne Eigenschaftsnamen und Schluesselwoerter. */
function freieBezeichner(ausdruck: ts.Expression): Set<string> {
  const menge = new Set<string>();
  const besuche = (k: ts.Node): void => {
    if (ts.isIdentifier(k)) {
      const p = k.parent;
      const istEigenschaft = ts.isPropertyAccessExpression(p) && p.name === k;
      if (!istEigenschaft) {
        menge.add(k.getText());
      }
    }
    ts.forEachChild(k, besuche);
  };
  besuche(ausdruck);
  menge.delete("undefined");
  menge.delete("null");
  return menge;
}

/**
 * Wertet den aufgeloesten Ausdruck fuer jede Stufe aus — mit der ECHTEN Regel und einem `t`,
 * das seinen Schluessel zurueckgibt. Ergebnis ist der Entscheidungsvektor der Flaeche.
 */
function entscheidungsvektor(
  ausdruck: ts.Expression,
  stufenVariable: string,
): (boolean | string | undefined)[] {
  return entscheidungsvektorAusText(ausdruck.getText(), stufenVariable);
}

/** Welche Variable traegt die Stufe? Der einzige freie Bezeichner neben Regel und `t`. */
function stufenVariable(ausdruck: ts.Expression): string {
  const frei = freieBezeichner(ausdruck);
  for (const regel of Object.keys(REGELN)) {
    frei.delete(regel);
  }
  frei.delete("t");
  const uebrig = [...frei];
  if (uebrig.length !== 1) {
    // Kein Aufloesungsfehler zum Wegschauen: Haengt die Entscheidung an etwas anderem als der
    // Stufe, ist das selbst der Befund — dann trifft die Flaeche sie nicht mehr allein aus der
    // Stufe, und der Gleichlauf mit der anderen ist nicht mehr pruefbar.
    throw new Error(
      `Die Entscheidung haengt an ${uebrig.length} Groessen statt allein an der Stufe: ` +
        `${uebrig.join(", ")}. Bekannte Regeln: ${Object.keys(REGELN).join(", ")}.`,
    );
  }
  return uebrig[0] as string;
}

interface Messung {
  banner: (boolean | string | undefined)[];
  titel: (boolean | string | undefined)[];
}

function miss(datei: string): Messung {
  const quelle = baum(datei);

  const bRoh = bannerBedingung(quelle);
  if (bRoh === null) {
    throw new Error(`${datei}: kein Banner mit data-testid="${BANNER_ANKER}" gefunden`);
  }
  const b = aufgeloest(quelle, bRoh);

  const tRoh = titelBedingung(quelle);
  if (tRoh === null) {
    throw new Error(`${datei}: kein title-Attribut mit ${GRUND_SCHLUESSEL} gefunden`);
  }
  // Im Titel steht die Bedingung im ersten Glied; aufgeloest wird nur diese.
  const tBedingung = aufgeloest(quelle, tRoh.condition);
  const tGanz = ts.factory.createConditionalExpression(
    tBedingung,
    undefined,
    tRoh.whenTrue,
    undefined,
    tRoh.whenFalse,
  );
  // Der neu gebaute Knoten hat keinen Quelltext — deshalb wird der Ausdruck von Hand gesetzt.
  const drucker = ts.createPrinter();
  const tQuelle = drucker.printNode(ts.EmitHint.Expression, tGanz, quelle);

  return {
    banner: entscheidungsvektor(b, stufenVariable(b)),
    titel: entscheidungsvektorAusText(tQuelle, stufenVariableAusText(tQuelle)),
  };
}

/** Wie `entscheidungsvektor`, aber fuer einen bereits gedruckten Ausdruck. */
function entscheidungsvektorAusText(
  quelle: string,
  stufe: string,
): (boolean | string | undefined)[] {
  const namen = Object.keys(REGELN);
  const werte = Object.values(REGELN);
  const fn = new Function(...namen, "t", stufe, `return (${quelle});`) as (
    ...args: unknown[]
  ) => boolean | string | undefined;
  return STUFEN.map((s) => fn(...werte, (k: string) => k, s));
}

/** Die Stufenvariable aus einem gedruckten Ausdruck — dieselbe Regel, nur ohne Knoten. */
function stufenVariableAusText(quelle: string): string {
  const datei = ts.createSourceFile("x.ts", `(${quelle});`, ts.ScriptTarget.Latest, true);
  let ausdruck: ts.Expression | null = null;
  const besuche = (k: ts.Node): void => {
    if (ausdruck === null && ts.isParenthesizedExpression(k)) {
      ausdruck = k.expression;
    }
    ts.forEachChild(k, besuche);
  };
  besuche(datei);
  if (ausdruck === null) {
    throw new Error("der gedruckte Ausdruck liess sich nicht lesen");
  }
  return stufenVariable(ausdruck);
}

describe("JOB 2433 · zwei Flaechen, eine Entscheidung", () => {
  it("K1 · KALIBRIERUNG: beide Flaechen tragen den Anker, und die Erhebung findet beides", () => {
    // Ohne diesen Fall waere G1 auch dann gruen, wenn eine Flaeche das Banner verloren haette —
    // `miss()` wuerfe zwar, aber die Zusicherung stuende nirgends geschrieben.
    for (const f of FLAECHEN) {
      const quelle = baum(f.datei);
      expect(bannerBedingung(quelle), `${f.datei}: Banner-Anker fehlt`).not.toBeNull();
      expect(titelBedingung(quelle), `${f.datei}: title-Bedingung fehlt`).not.toBeNull();
    }
  });

  it("K2 · KALIBRIERUNG: die Auswertung misst wirklich etwas — beide Ausgaenge kommen vor", () => {
    // Ohne diesen Fall waere G1 auch dann gruen, wenn beide Vektoren konstant waeren.
    const m = miss(FLAECHEN[0]?.datei as string);
    expect(new Set(m.banner).size, "der Bannervektor ist konstant — dann misst er nichts").toBe(2);
    expect(new Set(m.titel).size, "der Titelvektor ist konstant — dann misst er nichts").toBe(2);
  });

  it("G1 · GLEICHLAUF: beide Flaechen entscheiden fuer JEDE Stufe gleich", () => {
    const [a, b] = FLAECHEN;
    const ma = miss(a?.datei as string);
    const mb = miss(b?.datei as string);

    // Der Kern: nicht der Text, sondern das Ergebnis. Schreibt eine Flaeche die Bedingung um,
    // bleibt der Vektor gleich und dieser Fall gruen. Entscheidet sie ANDERS, faellt er.
    expect(
      mb.banner,
      `Das Banner entscheidet verschieden: ${a?.name} ${JSON.stringify(ma.banner)} gegen ${b?.name} ${JSON.stringify(mb.banner)}`,
    ).toEqual(ma.banner);

    expect(
      mb.titel,
      `Der Titel entscheidet verschieden: ${a?.name} ${JSON.stringify(ma.titel)} gegen ${b?.name} ${JSON.stringify(mb.titel)}`,
    ).toEqual(ma.titel);
  });

  it("G2 · INNERER GLEICHLAUF: Banner und Titel derselben Flaeche sagen dasselbe", () => {
    // Der zweite Driftweg, und der stillere: Banner sichtbar, Titel aber nicht — oder umgekehrt.
    // Beide haengen an derselben Frage, also muessen sie zusammen umschlagen.
    for (const f of FLAECHEN) {
      const m = miss(f.datei);
      const bannerVerborgen = m.banner.map((v) => v === true);
      const titelLeer = m.titel.map((v) => v === undefined);
      expect(
        titelLeer,
        `${f.name}: Banner und Titel schlagen bei verschiedenen Stufen um — ${JSON.stringify(m.banner)} gegen ${JSON.stringify(m.titel)}`,
      ).toEqual(bannerVerborgen);
    }
  });
});
