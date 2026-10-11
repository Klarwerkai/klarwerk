// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · R-1355 — DIE CODEPRÜFUNG: HERKUNFT ENTSTEHT AN EINER STELLE.
// ================================================================================================
//
// Originalpunkt: „Eine automatische Codeprüfung stellt sicher, dass Herkunftsangaben nur an einer
// zentralen Stelle erzeugt werden. So kann keine zweite, abweichende Quelle für dieselbe Angabe
// entstehen." Die zentrale Stelle ist `services/knowledge-object/src/herkunft.ts` (Begründung und
// Feldmenge dort). Diese Datei prüft am QUELLTEXT (TypeScript-Syntaxbaum, keine Textsuche):
//
//   Z1 · Im Wissensobjekt-Modul setzt außer `herkunft.ts` niemand eine Herkunftsangabe
//        (`originalAuthor`, `origin`, `importCandidateId`, `importedVia`, `dokumentHerkunft`).
//        Einzige benannte Ausnahme: `KoProposal.origin` — die Herkunft eines Änderungsvorschlags,
//        nicht die des Objekts.
//   Z2 · Dienstweit leitet niemand außer `herkunft.ts` den Wissensträger ab: kein `originalAuthor:`
//        mit einer Bedingung oder einem Rückfall (`?:`, `??`, `||`, `&&`) als Wert. Wer welchen
//        Quellautor mitbringt, entscheidet der Anlageweg (z. B. `quellautorVon` im Import); WIE daraus
//        der Wissensträger wird, entscheidet nur die zentrale Regel.
//   Z3 · Dienstweit schreibt niemand den Wissensträger eines bestehenden Objekts um: kein
//        Objektliteral, das ein vorhandenes Objekt ausbreitet (`...x`) und `originalAuthor` setzt.
//   Z4 · `KoService.create` benutzt die zentrale Stelle.
//   Z5 · die zentrale Regel verhält sich wie zuvor die Inline-Fassung.
//
// KALIBRIERUNG: jede Regel wird zusätzlich gegen einen eingeschleusten Verstoß gefahren — eine
// Prüfung, die ihren eigenen Gegenfall nicht findet, prüft nichts.
//
// GRENZE (R-0110): die `frontdoor`-Fundstellen des Entwurfswegs (`services/capture`) sind ein
// anderer Vertrag. Diese Prüfung betrifft die Herkunftsangaben des WISSENSOBJEKTS und den
// Wissensträger; den Erfassungsweg des Entwurfs fasst sie nicht an.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  herkunftsmerkmaleBeiAnlage,
  urheberschaftBeiAnlage,
} from "../../services/knowledge-object/src/herkunft";
import { repoPfad } from "../support/repoPfad";

const ZENTRALE = "services/knowledge-object/src/herkunft.ts";
const HERKUNFTSFELDER = new Set([
  "originalAuthor",
  "origin",
  "importCandidateId",
  "importedVia",
  "dokumentHerkunft",
]);

function quelldateien(wurzel: string): string[] {
  const gefunden: string[] = [];
  const gehe = (ordner: string): void => {
    for (const name of readdirSync(ordner)) {
      if (name === "node_modules" || name === "dist") {
        continue;
      }
      const pfad = join(ordner, name);
      if (statSync(pfad).isDirectory()) {
        gehe(pfad);
      } else if (name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.endsWith(".d.ts")) {
        gefunden.push(pfad);
      }
    }
  };
  gehe(wurzel);
  return gefunden;
}

interface Fund {
  datei: string;
  zeile: number;
  regel: "Z1" | "Z2" | "Z3";
  text: string;
}

function eigenschaftsname(knoten: ts.ObjectLiteralElementLike): string | undefined {
  if (
    (ts.isPropertyAssignment(knoten) || ts.isShorthandPropertyAssignment(knoten)) &&
    (ts.isIdentifier(knoten.name) || ts.isStringLiteral(knoten.name))
  ) {
    return knoten.name.text;
  }
  return undefined;
}

/**
 * Gehört dieses Objektliteral zu einem als `KoProposal` getypten Literal (`const x: KoProposal = {…}`)?
 *
 * Nacharbeit 4: das Feld steht dort nicht direkt, sondern bedingt eingestreut —
 * `...(input.origin ? { origin: input.origin } : {})`. Das innere Literal hängt an einem
 * Bedingungsausdruck, nicht an der Deklaration. Gesucht wird deshalb über genau diese Hüllen nach
 * oben (Klammer, Bedingung, Ausbreitung, umschließendes Literal) — über nichts anderes: ein Aufruf
 * oder eine Zuweisung dazwischen beendet die Suche, und das Feld zählt dann als Herkunftsangabe.
 */
function istVorschlag(literal: ts.ObjectLiteralExpression): boolean {
  let knoten: ts.Node = literal;
  while (
    ts.isParenthesizedExpression(knoten.parent) ||
    ts.isConditionalExpression(knoten.parent) ||
    ts.isSpreadAssignment(knoten.parent) ||
    ts.isObjectLiteralExpression(knoten.parent)
  ) {
    knoten = knoten.parent;
  }
  const eltern = knoten.parent;
  return (
    ts.isVariableDeclaration(eltern) &&
    eltern.type !== undefined &&
    eltern.type.getText() === "KoProposal"
  );
}

/**
 * Breitet dieses Literal ein VORHANDENES Objekt aus (`...ko`, `...alt.daten`, `...liste[0]`)?
 * Ein bedingt eingestreutes frisches Literal (`...(x ? { a } : {})`) ist kein vorhandenes Objekt —
 * so baut etwa die Entwurfsanlage ihre Herabstufungssperre ein.
 */
function breitetVorhandenesAus(literal: ts.ObjectLiteralExpression): boolean {
  return literal.properties.some((p) => {
    if (!ts.isSpreadAssignment(p)) {
      return false;
    }
    let ausdruck: ts.Expression = p.expression;
    while (ts.isParenthesizedExpression(ausdruck)) {
      ausdruck = ausdruck.expression;
    }
    return (
      ts.isIdentifier(ausdruck) ||
      ts.isPropertyAccessExpression(ausdruck) ||
      ts.isElementAccessExpression(ausdruck)
    );
  });
}

/**
 * Nacharbeit 9 · die Übergabe eines ENTWURFS (`services/app/src/wissensuebergabe.ts`,
 * `entwurfUebergeben`, R-0554): am `Draft` heißt `originalAuthor` „wem der Entwurf jetzt gehört“
 * (Sichtbarkeit, „meine Entwürfe“), nicht Wissensträger. Die ursprüngliche Urheberin bleibt in
 * `urheber` stehen und reist beim Einreichen als `originalAuthor` ans Wissensobjekt
 * (`capture/src/service.ts`, `toKoInput`) — die Herkunft des späteren Objekts bleibt also erhalten.
 * Ausgenommen ist deshalb NUR ein als `Draft` getyptes Literal, das `urheber` im selben Zug setzt.
 * Ein Entwurf ohne `urheber` oder ein ungetyptes Literal bleibt ein Verstoß (Kalibrierung Z3).
 */
function istEntwurfsuebergabeMitUrheberin(literal: ts.ObjectLiteralExpression): boolean {
  const eltern = literal.parent;
  return (
    ts.isVariableDeclaration(eltern) &&
    eltern.type !== undefined &&
    eltern.type.getText() === "Draft" &&
    literal.properties.some((p) => eigenschaftsname(p) === "urheber")
  );
}

/**
 * Nacharbeit 9 · BENANNTE Ausnahmen von Z2, je Datei und wörtlichem Feld — keine Muster. Jede muss
 * im Baum genau so noch vorkommen (sonst ist sie eine Leiche und fällt in „Ausnahmen treffen zu“).
 */
const BENANNTE_AUSNAHMEN: readonly {
  datei: string;
  regel: Fund["regel"];
  text: string;
  grund: string;
}[] = [
  {
    datei: "services/app/src/verstaendnisfragen.ts",
    regel: "Z2",
    text: "originalAuthor: f.vorgelegtVon ?? f.geaendertVon",
    grund:
      "`beitragVon` bildet für das Mehr-Augen-Urteil eines FRAGENSATZES (kein Wissensobjekt) die " +
      "Vergleichsform Autor/Erstautor; der Wert wird nur gelesen (`entscheidungsurteil`, " +
      "`unabhaengigePruefer`) und erreicht nie ein Wissensobjekt.",
  },
];

function istBenannteAusnahme(f: Fund): boolean {
  return BENANNTE_AUSNAHMEN.some(
    (a) => a.datei === f.datei && a.regel === f.regel && a.text === f.text,
  );
}

function istRueckfall(wert: ts.Expression): boolean {
  if (ts.isParenthesizedExpression(wert)) {
    return istRueckfall(wert.expression);
  }
  if (ts.isConditionalExpression(wert)) {
    return true;
  }
  return (
    ts.isBinaryExpression(wert) &&
    [
      ts.SyntaxKind.QuestionQuestionToken,
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.AmpersandAmpersandToken,
    ].includes(wert.operatorToken.kind)
  );
}

/** Prüft EINE Quelle. `imModul`: liegt sie im Wissensobjekt-Modul (Regel Z1)? */
function pruefeQuelle(datei: string, inhalt: string, imModul: boolean): Fund[] {
  const funde: Fund[] = [];
  const quelle = ts.createSourceFile(datei, inhalt, ts.ScriptTarget.Latest, true);
  const melde = (knoten: ts.Node, regel: Fund["regel"]): void => {
    funde.push({
      datei,
      zeile: quelle.getLineAndCharacterOfPosition(knoten.getStart()).line + 1,
      regel,
      text: knoten.getText().slice(0, 120),
    });
  };
  const besuche = (knoten: ts.Node): void => {
    if (ts.isObjectLiteralExpression(knoten)) {
      const breitetAus = breitetVorhandenesAus(knoten) && !istEntwurfsuebergabeMitUrheberin(knoten);
      for (const element of knoten.properties) {
        const name = eigenschaftsname(element);
        if (name === undefined) {
          continue;
        }
        if (imModul && HERKUNFTSFELDER.has(name) && !(name === "origin" && istVorschlag(knoten))) {
          melde(element, "Z1");
        }
        if (name === "originalAuthor") {
          if (ts.isPropertyAssignment(element) && istRueckfall(element.initializer)) {
            melde(element, "Z2");
          }
          if (breitetAus) {
            melde(element, "Z3");
          }
        }
      }
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(quelle);
  return funde;
}

function befundeAmBaum(): Fund[] {
  const wurzel = repoPfad("services");
  const funde: Fund[] = [];
  for (const pfad of quelldateien(wurzel)) {
    const rel = relative(repoPfad("."), pfad).split("\\").join("/");
    if (rel === ZENTRALE) {
      continue;
    }
    funde.push(
      ...pruefeQuelle(
        rel,
        readFileSync(pfad, "utf8"),
        rel.startsWith("services/knowledge-object/src/"),
      ),
    );
  }
  return funde;
}

describe("R-1355 · Herkunftsangaben entstehen an genau einer Stelle", () => {
  const alleFunde = befundeAmBaum();
  const funde = alleFunde.filter((f) => !istBenannteAusnahme(f));
  const lesbar = (regel: Fund["regel"]): string[] =>
    funde.filter((f) => f.regel === regel).map((f) => `${f.datei}:${f.zeile} ${f.text}`);

  it("jede benannte Ausnahme trifft im Baum genau einmal zu (keine Leichen, keine Ausweitung)", () => {
    for (const a of BENANNTE_AUSNAHMEN) {
      const treffer = alleFunde.filter(
        (f) => f.datei === a.datei && f.regel === a.regel && f.text === a.text,
      );
      expect(treffer.length, `${a.datei} ${a.text}`).toBe(1);
    }
  });

  it("Z1 · im Wissensobjekt-Modul setzt nur herkunft.ts eine Herkunftsangabe", () => {
    expect(lesbar("Z1"), "Herkunftsangabe außerhalb von herkunft.ts gesetzt").toEqual([]);
  });

  it("Z2 · dienstweit leitet nur herkunft.ts den Wissensträger ab", () => {
    expect(lesbar("Z2"), "zweite Ableitung des Wissensträgers").toEqual([]);
  });

  it("Z3 · dienstweit schreibt niemand den Wissensträger eines bestehenden Objekts um", () => {
    expect(lesbar("Z3"), "Wissensträger an einem bestehenden Objekt überschrieben").toEqual([]);
  });

  it("Z4 · KoService.create benutzt die zentrale Stelle", () => {
    const service = readFileSync(repoPfad("services/knowledge-object/src/service.ts"), "utf8");
    expect(service).toContain("...urheberschaftBeiAnlage(input)");
    expect(service).toContain("...herkunftsmerkmaleBeiAnlage(input)");
  });

  it("die Prüfung sieht den Baum wirklich (Kalibrierung der Dateimenge)", () => {
    const dateien = quelldateien(repoPfad("services")).map((p) =>
      relative(repoPfad("."), p).split("\\").join("/"),
    );
    expect(dateien).toContain(ZENTRALE);
    expect(dateien).toContain("services/knowledge-object/src/service.ts");
    expect(dateien).toContain("services/library-analytics/src/service.ts");
    expect(dateien.some((d) => d.endsWith(".test.ts"))).toBe(false);
  });
});

describe("R-1355 · Kalibrierung — jede Regel findet ihren eingeschleusten Verstoß", () => {
  it("Z1 findet eine zweite Herkunftsangabe im Modul, lässt KoProposal.origin aber stehen", () => {
    const verstoss = "const ko = { title: 't', origin: input.origin };";
    expect(pruefeQuelle("x.ts", verstoss, true).map((f) => f.regel)).toEqual(["Z1"]);
    const vorschlag = "const p: KoProposal = { id: 'p', origin: input.origin };";
    expect(pruefeQuelle("x.ts", vorschlag, true)).toEqual([]);
    // Nacharbeit 4: dieselbe Ausnahme in der Schreibweise des Bestands (service.ts, addProposal).
    const eingestreut =
      "const p: KoProposal = { id: 'p', ...(input.origin ? { origin: input.origin } : {}) };";
    expect(pruefeQuelle("x.ts", eingestreut, true)).toEqual([]);
    // Dieselbe Schreibweise an einem NICHT als KoProposal getypten Literal bleibt ein Verstoß.
    const ungetypt = "const k = { id: 'k', ...(input.origin ? { origin: input.origin } : {}) };";
    expect(pruefeQuelle("x.ts", ungetypt, true).map((f) => f.regel)).toEqual(["Z1"]);
    // Ein Aufruf dazwischen beendet die Suche — das Feld zählt dann als Herkunftsangabe.
    const ueberAufruf = "const p: KoProposal = { id: 'p', ...baue({ origin: input.origin }) };";
    expect(pruefeQuelle("x.ts", ueberAufruf, true).map((f) => f.regel)).toEqual(["Z1"]);
    // Außerhalb des Moduls ist `origin` kein Objektfeld des Wissensobjekts (z. B. CORS, Konflikt).
    expect(pruefeQuelle("x.ts", verstoss, false)).toEqual([]);
  });

  it("Z2 findet eine zweite Ableitung des Wissensträgers — in jeder Schreibweise", () => {
    for (const wert of ["a ? a : b", "a ?? b", "a || b", "(a && a.trim()) || b"]) {
      const funde = pruefeQuelle("x.ts", `const k = { originalAuthor: ${wert} };`, false);
      expect(
        funde.map((f) => f.regel),
        wert,
      ).toEqual(["Z2"]);
    }
    expect(pruefeQuelle("x.ts", "const k = { originalAuthor: quelle };", false)).toEqual([]);
  });

  it("Z3 findet das Umschreiben eines bestehenden Objekts", () => {
    for (const quelle of ["ko", "(ko)", "alt.daten", "liste[0]"]) {
      const literal = `const neu = { ...${quelle}, originalAuthor: wer };`;
      const funde = pruefeQuelle("x.ts", literal, false);
      expect(
        funde.map((f) => f.regel),
        quelle,
      ).toEqual(["Z3"]);
    }
    // Ein bedingt eingestreutes frisches Literal ist kein bestehendes Objekt (Entwurfsanlage).
    const anlage = "const d = { originalAuthor: author, ...(w ? { sperre: true } : {}) };";
    expect(pruefeQuelle("x.ts", anlage, false)).toEqual([]);
  });

  it("Z3 · Nacharbeit 9: nur die Entwurfsübergabe MIT Urheberin ist ausgenommen", () => {
    const mitUrheberin =
      "const neu: Draft = { ...draft, originalAuthor: an, urheber: draft.urheber ?? draft.originalAuthor };";
    expect(pruefeQuelle("x.ts", mitUrheberin, false)).toEqual([]);
    // Ohne `urheber` ginge die Urheberin verloren — das bleibt ein Verstoß.
    const ohneUrheberin = "const neu: Draft = { ...draft, originalAuthor: an };";
    expect(pruefeQuelle("x.ts", ohneUrheberin, false).map((f) => f.regel)).toEqual(["Z3"]);
    // Ein nicht als Draft getyptes Literal (etwa ein Wissensobjekt) bleibt ein Verstoß.
    const ungetypt = "const neu = { ...ko, originalAuthor: an, urheber: ko.originalAuthor };";
    expect(pruefeQuelle("x.ts", ungetypt, false).map((f) => f.regel)).toEqual(["Z3"]);
    const alsKo = "const neu: KnowledgeObject = { ...ko, originalAuthor: an, urheber: x };";
    expect(pruefeQuelle("x.ts", alsKo, false).map((f) => f.regel)).toEqual(["Z3"]);
  });

  it("die benannte Z2-Ausnahme gilt nur für genau diese Datei und genau dieses Feld", () => {
    const [ausnahme] = BENANNTE_AUSNAHMEN;
    const fund = {
      datei: "services/app/src/anderes.ts",
      zeile: 1,
      regel: "Z2" as const,
      text: ausnahme?.text ?? "",
    };
    expect(istBenannteAusnahme(fund)).toBe(false);
    expect(istBenannteAusnahme({ ...fund, datei: ausnahme?.datei ?? "" })).toBe(true);
    expect(
      istBenannteAusnahme({
        ...fund,
        datei: ausnahme?.datei ?? "",
        text: "originalAuthor: f.geaendertVon ?? f.vorgelegtVon",
      }),
    ).toBe(false);
  });
});

describe("R-1355 · Z5 — die zentrale Regel verhält sich wie die frühere Inline-Fassung", () => {
  it("ohne abweichenden Wissensträger ist der Handelnde zugleich Wissensträger", () => {
    expect(urheberschaftBeiAnlage({ author: "anna" })).toEqual({
      originalAuthor: "anna",
      author: "anna",
    });
    expect(urheberschaftBeiAnlage({ author: "anna", originalAuthor: "   " })).toEqual({
      originalAuthor: "anna",
      author: "anna",
    });
  });

  it("ein ausdrücklich mitgebrachter Wissensträger bleibt — der Handelnde daneben auch", () => {
    expect(urheberschaftBeiAnlage({ author: "reviewer", originalAuthor: "quelle" })).toEqual({
      originalAuthor: "quelle",
      author: "reviewer",
    });
  });

  it("Herkunftsmerkmale nur, wenn mitgebracht — kein stiller Default, Schlüssel fehlt dann ganz", () => {
    expect(herkunftsmerkmaleBeiAnlage({})).toEqual({});
    expect(Object.keys(herkunftsmerkmaleBeiAnlage({ origin: undefined }))).toEqual([]);
    expect(
      herkunftsmerkmaleBeiAnlage({
        origin: "word_addin",
        importCandidateId: "c1",
        importedVia: "import_candidate",
      }),
    ).toEqual({ origin: "word_addin", importCandidateId: "c1", importedVia: "import_candidate" });
  });
});
