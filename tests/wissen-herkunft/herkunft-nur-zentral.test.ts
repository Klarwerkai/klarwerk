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

/** Ist dieses Objektliteral als `KoProposal` getypt (`const x: KoProposal = { … }`)? */
function istVorschlag(literal: ts.ObjectLiteralExpression): boolean {
  const eltern = literal.parent;
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
      const breitetAus = breitetVorhandenesAus(knoten);
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
  const funde = befundeAmBaum();
  const lesbar = (regel: Fund["regel"]): string[] =>
    funde.filter((f) => f.regel === regel).map((f) => `${f.datei}:${f.zeile} ${f.text}`);

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
