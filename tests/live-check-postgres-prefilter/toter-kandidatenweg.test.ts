// ================================================================================================
// JOB 3607 — DER TOTE KANDIDATENWEG SAGT, DASS ER TOT IST.
// ================================================================================================
//
// DER BEFUND, DEN DIESE DATEI FESTHÄLT. `KoRepo.findCandidates` — die Methode, an der die letzten
// Läufe dieser Zeile gearbeitet haben — hat im Produkt KEINEN Aufrufer. Der Suchweg von Klara,
// Textprüfung und Wissensprüfung läuft seit G27 über `KoService.findCandidates` →
// `findSearchHits` → `KoSearchProjectionRepo.findActive` (Projektion der AKTIVEN KO-Version).
// Die beiden Adapter (`InMemoryKoRepo`, `PgKoRepo`) sind ein Test-/Bibliotheksweg; sie werden nur
// noch von ihren eigenen Tests erreicht.
//
// WARUM DAS EINEN WÄCHTER BRAUCHT UND KEINE ZEILE IN EINER RÜCKGABE. Der Befund stand schon einmal
// im Haus (`services/knowledge-object/src/repo-pg-wiederholbarkeit.test.ts:14-17`, JOB 544 D4) —
// und daneben behaupteten fünf Stellen im Quelltext das Gegenteil:
// („der Ask-Prefilter") und („wird über den Produktpfad gerufen") — WIDERLEGT-ZITAT, s. `WIDERLEGT`.
// Wer dort hinsah, las die Behauptung, glaubte sie und baute darauf. Ein Kommentar, der eine
// Produktwirkung behauptet, die es nicht gibt, ist dieselbe Art Unwahrheit wie eine grüne Anzeige
// ohne Datengrundlage.
//
// ZWEI SACHEN WERDEN GEMESSEN, beide AUS DEM QUELLTEXT gelesen, keine Zeichenkette nachgebaut:
//
//   (a) KEIN PRODUKTAUFRUFER. Über alle Produktdateien unter `services/**` und `apps/**` (ohne
//       Testdateien, `node_modules`, `dist`) steht kein Aufruf des Repository-`findCandidates`.
//       Erhoben wird am SYNTAXBAUM, nicht per Zeichenkettensuche: Kommentare kommen im Baum gar
//       nicht vor, Stringliterale bezeichnen keinen Aufruf. Die Zahl der gelesenen Dateien ist Teil
//       der Zusicherung — eine Suche, die nichts gelesen hat, ist keine Entwarnung.
//
//       RUNDE 2 (BEN, Korrekturpflicht 1): der Empfänger wird nicht mehr als TEXT beurteilt,
//       sondern am Baum. Zwei belegte Umgehungen der ersten Runde fallen damit weg:
//       `this. /* Repo */ repo.findCandidates(…)` (der Kommentar stand mitten im Empfängertext) und
//       `const source = this.repo; source.findCandidates(…)` (der Alias hiess nicht mehr „repo").
//       Mitgelesen werden deshalb: Aliase (`const`/`let`/Zuweisung, auch Alias eines Alias, bis der
//       Fixpunkt steht), Träger mit Repository-TYP (`(r: KoRepo) => r.findCandidates(…)`, auch als
//       Feld) und die abgelöste Methode (`const { findCandidates } = this.repo`). Jede dieser
//       Formen steht unten als Kalibrierungsfall — und daneben stehen die Formen, die grün bleiben
//       MÜSSEN, allen voran der echte Produktweg über den Dienst.
//
//       RUNDE 3 (BEN, Korrekturpflichten 1 und 2): zwei weitere gemessene Umgehungen, beide im
//       GLEICHEN Methodenrumpf — die Grenze unten erklärte sie also nicht. (i) Die ZERLEGUNG
//       `const { repo: source } = this`: gelesen wird jetzt das FELD, nicht die rechte Seite, und
//       zwar in allen drei Bauformen (Objekt-, Array-Zerlegung, Zuweisungsmuster). (ii) Der
//       GEKLAMMERTE Aufruf `(source.findCandidates)(q)`: der gerufene Ausdruck wird ausgepackt,
//       bevor er beurteilt wird — sonst fiel nicht nur die Klammerform durch, sondern mit ihr der
//       schon erkannte Alias. Dazu aus demselben Grund: die Weitergabe (`…findCandidates.call/
//       apply/bind(…)`) und der verzweigte Träger (`cond ? this.repo : other`, `a ?? this.repo`).
//
//   (b) DIE EHRLICHE MARKE STEHT. An den vier Stellen, an denen jemand als Nächstes landet, steht
//       im Kommentarblock DIREKT über der Codezeile eine Marke, die den echten Weg namentlich
//       nennt und die Methode als im Produkt nicht gerufen ausweist. Genau EIN Wegweiser trägt
//       dabei Datei und Zeile — und er wird gegen `service.ts` GEPRÜFT: zeigt er ins Leere, wird
//       diese Datei rot. Ein verrotteter Wegweiser ist schlimmer als keiner.
//
//       Dazu, aus demselben Grund: die beiden widerlegten Behauptungen dürfen nicht zurückkommen —
//       RUNDE 2 (BEN, Korrekturpflicht 2) im GANZEN Zielordner, nicht nur im Nachbarwächter. In der
//       ersten Runde konnte der Satz in `speicher-rangfolge.test.ts` unbemerkt wieder auftauchen.
//
// WAS DIESE DATEI NICHT TUT. Sie ändert kein Verhalten und belegt keines. Sie sagt nichts darüber,
// ob die Projektion die richtigen Kandidaten liefert — das ist ein anderer Auftrag. Und sie
// entfernt die Methode nicht: das ist eine Eigentümerentscheidung (öffentliche Modulschnittstelle).
//
// IHRE GRENZE, benannt statt verschwiegen: erkannt wird ein Träger, der im GLEICHEN Modul als
// Alias, als Zerlegung, als getypter Träger oder als abgelöste Methode entsteht — die Schreibweise
// des Aufrufs ist dabei gleichgültig (Klammern, `as`, `!`, `?.`, `["findCandidates"]`, `.call`).
// Was bleibt: kommt der Träger ohne Typangabe und ohne repo-ähnlichen Namen aus einem ANDEREN Modul
// herein (`const x = hol(); x.findCandidates()`), sieht diese Datei ihn nicht — dafür bräuchte es
// den Typprüfer über das ganze Programm, nicht den Syntaxbaum je Datei. Der Fall steht unten als
// Kalibrierung „bleibt ungesehen", damit die Grenze gemessen ist und nicht behauptet.
//
// SIE STEHT NEBEN `rangfolge-waechter.test.ts`, NICHT AN DESSEN STELLE: der dort prüft die GESTALT
// der Abfrage (führt das `ORDER BY` die Term-Trefferzahl?), diese hier die Frage „wer ruft, und was
// steht darüber". Zwei Fragen, zwei Dateien, ein Ordner.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { type Quelle, WURZEL, posix, quelldateien, quelleAus } from "../../tools/modalgrenze";

const REPO = "services/knowledge-object/src/repo.ts";
const REPO_PG = "services/knowledge-object/src/repo-pg.ts";
const SERVICE = "services/knowledge-object/src/service.ts";
const ORDNER = "tests/live-check-postgres-prefilter";
const SELBST = `${ORDNER}/toter-kandidatenweg.test.ts`;
const NACHBAR = `${ORDNER}/rangfolge-waechter.test.ts`;

function lies(datei: string): string {
  return readFileSync(join(WURZEL, datei), "utf8");
}

// ------------------------------------------------------------------------------------------------
// (a) KEIN PRODUKTAUFRUFER — am Syntaxbaum erhoben.
// ------------------------------------------------------------------------------------------------

/** Woran der Träger erkannt wurde — steht in jeder Beanstandung, damit sie nachprüfbar ist. */
type Art = "name" | "alias" | "typ" | "abgeloest";

interface Aufruf {
  readonly datei: string;
  readonly zeile: number;
  /** Der Empfängertext, wie er dasteht (Leerraum zusammengezogen). */
  readonly text: string;
  /** Der Name, an dem entschieden wurde. */
  readonly name: string;
  readonly art: Art;
}

/**
 * Die Hüllen, die einen Ausdruck nicht verändern: `(x)`, `x!`, `x as T`, `x satisfies T`, `await x`.
 *
 * Sie kommen zwischen Empfänger und Zugriff vor (`(this.repo as KoRepo).findCandidates(…)`) und
 * dürfen die Beurteilung nicht abschütteln.
 */
function auspacken(ausdruck: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(ausdruck) ||
    ts.isNonNullExpression(ausdruck) ||
    ts.isAsExpression(ausdruck) ||
    ts.isSatisfiesExpression(ausdruck) ||
    ts.isAwaitExpression(ausdruck) ||
    ts.isTypeAssertionExpression(ausdruck)
  ) {
    return auspacken(ausdruck.expression);
  }
  return ausdruck;
}

/**
 * Der LETZTE Namensteil eines Ausdrucks — am Baum, nicht am Text.
 *
 * Genau hier lag die Lücke der ersten Runde: `zugriff.expression.getText()` liefert einen
 * Blockkommentar zwischen `this.` und `repo` WÖRTLICH mit, und eine Regel über diesen Text greift
 * daneben. Der Baum kennt den Kommentar nicht; `name.text` ist `repo`, egal was dazwischensteht.
 */
/**
 * Die Hüllen, die eine Methode WEITERGEBEN, statt sie zu rufen: `f.call(…)`, `f.apply(…)`,
 * `f.bind(…)`. Dasselbe Ziel, anderer Griff — deshalb werden sie abgezogen, bevor beurteilt wird.
 */
const WEITERGABE: ReadonlySet<string> = new Set(["call", "apply", "bind"]);

function entbinde(gerufen: ts.Expression): ts.Expression {
  if (ts.isPropertyAccessExpression(gerufen) && WEITERGABE.has(gerufen.name.text)) {
    return auspacken(gerufen.expression);
  }
  return gerufen;
}

/** Die Zweige, die einen Träger unverändert weiterreichen: `a ?? b`, `a || b`, `a && b`, `(0, a)`. */
const VERZWEIGT: ReadonlySet<ts.SyntaxKind> = new Set([
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.AmpersandAmpersandToken,
  ts.SyntaxKind.CommaToken,
]);

function letzterName(ausdruck: ts.Expression | undefined): string | undefined {
  if (!ausdruck) {
    return undefined;
  }
  const kern = auspacken(ausdruck);
  if (ts.isIdentifier(kern)) {
    return kern.text;
  }
  if (ts.isPropertyAccessExpression(kern)) {
    return kern.name.text;
  }
  if (ts.isElementAccessExpression(kern)) {
    const arg = kern.argumentExpression;
    return ts.isStringLiteralLike(arg) ? arg.text : undefined;
  }
  // `holRepo().findCandidates(…)` — der Name der gerufenen Funktion trägt die Auskunft.
  if (ts.isCallExpression(kern)) {
    return letzterName(kern.expression);
  }
  return undefined;
}

/**
 * Die Namen, die ein Ausdruck als Träger ANBIETET — einer bei `this.repo`, zwei bei `a ?? b`.
 *
 * RUNDE 3: `letzterName` allein gab bei einer Verzweigung auf (`cond ? this.repo : other` ist weder
 * Bezeichner noch Zugriff) und liess damit einen Träger durch, der im gleichen Modul offen
 * dasteht. Es genügt, wenn EINER der angebotenen Namen ein Repository ist: dann kann der Ausdruck
 * eines sein.
 */
function traegerNamen(ausdruck: ts.Expression | undefined): string[] {
  if (!ausdruck) {
    return [];
  }
  const kern = auspacken(ausdruck);
  if (ts.isConditionalExpression(kern)) {
    return [...traegerNamen(kern.whenTrue), ...traegerNamen(kern.whenFalse)];
  }
  if (ts.isBinaryExpression(kern) && VERZWEIGT.has(kern.operatorToken.kind)) {
    return [...traegerNamen(kern.left), ...traegerNamen(kern.right)];
  }
  const name = letzterName(kern);
  return name === undefined ? [] : [name];
}

/** Heisst dieser Name nach einem Repository? (`repo`, `koRepo`, `this.repo`, Typ `PgKoRepo`.) */
function istRepoName(name: string): boolean {
  return /^\w*[Rr]epo(sitory)?$/.test(name);
}

/** Der Name einer Typangabe, soweit sie eine ist: `KoRepo`, `ko.KoRepo` → `KoRepo`. */
function typName(typ: ts.TypeNode | undefined): string | undefined {
  if (!typ || !ts.isTypeReferenceNode(typ)) {
    return undefined;
  }
  const eintrag = typ.typeName;
  return ts.isIdentifier(eintrag) ? eintrag.text : eintrag.right.text;
}

interface Traeger {
  /** Name → woran er als Repository-Träger erkannt wurde. */
  readonly namen: Map<string, Art>;
  /** Namen, unter denen die Methode selbst abgelöst weiterlebt (`const { findCandidates } = repo`). */
  readonly abgeloest: Set<string>;
}

/**
 * Die Namen EINER Quelle, hinter denen ein Repository steckt.
 *
 * Gesammelt wird bis zum FIXPUNKT (der Alias eines Alias ist einer), und es zählt dreierlei:
 * die Zuweisung (`const source = this.repo`, `this.quelle = repo`), die TYPANGABE (`(r: KoRepo)`,
 * `private readonly laden: KoRepo`) und die abgelöste Methode (`const { findCandidates } = repo`).
 * Ein Kommentar oder eine Zeichenkette kommt hier nicht vor — der Baum führt sie nicht.
 */
function sammleTraeger(quelle: Quelle): Traeger {
  const namen = new Map<string, Art>();
  const abgeloest = new Set<string>();
  const traegtRepo = (name: string): boolean => istRepoName(name) || namen.has(name);
  const istRepoAusdruck = (ausdruck: ts.Expression | undefined): boolean =>
    traegerNamen(ausdruck).some(traegtRepo);

  /** Der Name eines Feldes, soweit er einer ist: `{ repo: x }` → `repo`, `{ ["repo"]: x }` → undefined. */
  const feldname = (knoten: ts.Node | undefined): string | undefined =>
    knoten !== undefined && (ts.isIdentifier(knoten) || ts.isStringLiteralLike(knoten))
      ? knoten.text
      : undefined;

  /**
   * Eine ZERLEGUNG lesen — RUNDE 3 (BEN, Korrekturpflicht 1).
   *
   * Bis hierher sah diese Datei in einer Zerlegung nur die abgelöste METHODE, und auch die nur,
   * wenn die rechte Seite selbst schon als Repository erkannt war. Der gemessene Durchschlupf
   * `const { repo: source } = this` fiel durch beides: `this` ist kein Repository-Ausdruck, und das
   * gelesene Feld heisst nicht `findCandidates`. Entscheidend ist das FELD — wer `repo` aus
   * irgendetwas herausholt, hält danach ein Repository in der Hand, ganz gleich wie er es nennt.
   *
   * `quelleTraegt` bleibt für die abgelöste Methode nötig und nur für sie: `const { findCandidates }
   * = this` in einer Dienstklasse löst die Methode DES DIENSTES ab und ist der echte Produktweg.
   */
  const liesZerlegung = (
    muster: ts.BindingPattern,
    quelleTraegt: boolean,
    wert: ts.Expression | undefined,
  ): void => {
    const kern = wert === undefined ? undefined : auspacken(wert);
    // `const [source] = [this.repo]` — bei der Array-Zerlegung steht der Träger an der Position.
    const werte =
      kern !== undefined && ts.isArrayLiteralExpression(kern) ? kern.elements : undefined;
    const teile: readonly ts.Node[] = muster.elements;
    teile.forEach((teil, i) => {
      if (!ts.isBindingElement(teil)) {
        return; // `const [, b] = …`: eine ausgelassene Stelle trägt nichts.
      }
      const feld = feldname(
        teil.propertyName ?? (ts.isObjectBindingPattern(muster) ? teil.name : undefined),
      );
      const feldTraegt = feld !== undefined ? traegtRepo(feld) : istRepoAusdruck(werte?.[i]);
      if (feld === "findCandidates" && quelleTraegt) {
        if (ts.isIdentifier(teil.name)) {
          abgeloest.add(teil.name.text);
        }
        return;
      }
      if (ts.isIdentifier(teil.name)) {
        if (feldTraegt) {
          namen.set(teil.name.text, "alias");
        }
        return;
      }
      liesZerlegung(teil.name, feldTraegt, undefined);
    });
  };

  /**
   * Dieselbe Zerlegung als ZUWEISUNG: `({ repo: source } = this)`.
   *
   * Der Parser baut hier kein Bindungsmuster, sondern ein Objektliteral auf der linken Seite — eine
   * zweite Bauform derselben Sache. Sie darf nicht durchfallen, nur weil sie anders heisst.
   */
  const liesZuweisungsmuster = (
    muster: ts.ObjectLiteralExpression,
    quelleTraegt: boolean,
  ): void => {
    for (const eigenschaft of muster.properties) {
      if (ts.isShorthandPropertyAssignment(eigenschaft)) {
        if (traegtRepo(eigenschaft.name.text)) {
          namen.set(eigenschaft.name.text, "alias");
        }
        continue;
      }
      if (!ts.isPropertyAssignment(eigenschaft)) {
        continue;
      }
      const feld = feldname(eigenschaft.name);
      const ziel = letzterName(eigenschaft.initializer);
      if (feld === undefined || ziel === undefined) {
        continue;
      }
      if (feld === "findCandidates" && quelleTraegt) {
        abgeloest.add(ziel);
      } else if (traegtRepo(feld)) {
        namen.set(ziel, "alias");
      }
    }
  };

  const besuche = (knoten: ts.Node): void => {
    if (
      ts.isVariableDeclaration(knoten) ||
      ts.isParameter(knoten) ||
      ts.isPropertyDeclaration(knoten)
    ) {
      const typ = typName(knoten.type);
      const typTraegt = typ !== undefined && istRepoName(typ);
      const wertTraegt = istRepoAusdruck(knoten.initializer);
      if (ts.isIdentifier(knoten.name)) {
        if (typTraegt) {
          namen.set(knoten.name.text, "typ");
        } else if (wertTraegt) {
          namen.set(knoten.name.text, "alias");
        }
      } else if (ts.isObjectBindingPattern(knoten.name) || ts.isArrayBindingPattern(knoten.name)) {
        liesZerlegung(knoten.name, typTraegt || wertTraegt, knoten.initializer);
      }
    }
    if (ts.isBinaryExpression(knoten) && knoten.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const links = auspacken(knoten.left);
      if (ts.isObjectLiteralExpression(links)) {
        liesZuweisungsmuster(links, istRepoAusdruck(knoten.right));
      } else {
        const ziel = letzterName(links);
        if (ziel !== undefined && !istRepoName(ziel) && istRepoAusdruck(knoten.right)) {
          namen.set(ziel, "alias");
        }
      }
    }
    ts.forEachChild(knoten, besuche);
  };
  let vorher = -1;
  while (namen.size + abgeloest.size !== vorher) {
    vorher = namen.size + abgeloest.size;
    ts.forEachChild(quelle.ast, besuche);
  }
  return { namen, abgeloest };
}

/** Heisst dieser Zugriff `findCandidates` — als Eigenschaft oder über ein Zeichenkettenfeld? */
function nenntFindCandidates(ausdruck: ts.Expression): boolean {
  if (ts.isPropertyAccessExpression(ausdruck)) {
    return ausdruck.name.text === "findCandidates";
  }
  // `repo["findCandidates"]()` ist derselbe Aufruf in anderer Schreibweise — er zählt mit.
  if (ts.isElementAccessExpression(ausdruck)) {
    const arg = ausdruck.argumentExpression;
    return ts.isStringLiteralLike(arg) && arg.text === "findCandidates";
  }
  return false;
}

/**
 * Die Repository-Aufrufe von `findCandidates` EINER Quelle.
 *
 * Nur `ts.forEachChild` (nie `getChildren()`): sonst kommt die Syntax-Ebene mit `SyntaxList`-Knoten
 * dazwischen, und der Abstieg verschluckt jeden Klassenrumpf — der Fehler, der den Aufrufer-Wächter
 * in JOB 2605 einmal auf eine falsche Zahl gebracht hat.
 *
 * Was NICHT zählt und nicht zählen darf: der echte Produktweg über den DIENST
 * (`deps.ko.findCandidates`, `this.koService.findCandidates`). Er ruft nicht das Repository, und
 * genau dieser Unterschied ist der Gegenstand dieser Datei.
 */
function kandidatenaufrufe(quelle: Quelle): Aufruf[] {
  const traeger = sammleTraeger(quelle);
  const raus: Aufruf[] = [];
  const halte = (knoten: ts.Node, name: string, art: Art, text: string): void => {
    raus.push({
      datei: quelle.datei,
      zeile: quelle.ast.getLineAndCharacterOfPosition(knoten.getStart(quelle.ast)).line + 1,
      text: text.replace(/\s+/g, " "),
      name,
      art,
    });
  };
  const besuche = (knoten: ts.Node): void => {
    if (ts.isCallExpression(knoten)) {
      // RUNDE 3 (BEN, Korrekturpflicht 2): erst die Hüllen ABZIEHEN, dann beurteilen.
      // `(source.findCandidates)(q)` ist derselbe Aufruf wie `source.findCandidates(q)` — ohne das
      // Auspacken verschwand er, und mit ihm der schon erkannte Alias, aus der Zählung. `entbinde`
      // nimmt dazu `…findCandidates.call/apply/bind(…)`, denselben Aufruf über die Weitergabe.
      const gerufen = entbinde(auspacken(knoten.expression));
      if (nenntFindCandidates(gerufen)) {
        const zugriff = gerufen as ts.PropertyAccessExpression | ts.ElementAccessExpression;
        // Bei `(cond ? this.repo : other).findCandidates(…)` bietet der Empfänger zwei Namen an;
        // der erste, der ein Repository ist, trägt die Beanstandung.
        const treffer = traegerNamen(zugriff.expression)
          .map((name) => ({
            name,
            art: istRepoName(name) ? ("name" as Art) : traeger.namen.get(name),
          }))
          .find((k): k is { name: string; art: Art } => k.art !== undefined);
        if (treffer !== undefined) {
          halte(knoten, treffer.name, treffer.art, zugriff.expression.getText(quelle.ast));
        }
      } else if (ts.isIdentifier(gerufen) && traeger.abgeloest.has(gerufen.text)) {
        halte(knoten, gerufen.text, "abgeloest", gerufen.text);
      }
    }
    ts.forEachChild(knoten, besuche);
  };
  ts.forEachChild(quelle.ast, besuche);
  return raus;
}

/** Derselbe Prüfweg für einen Text, der nicht auf der Platte liegt (die Gegenproben unten). */
function aufrufeIn(datei: string, text: string): Aufruf[] {
  return kandidatenaufrufe(quelleAus(datei, text));
}

/** Die Produktfläche: `services/**` und `apps/**`, ohne Testdateien (`quelldateien`). */
function produktdateien(): string[] {
  return [...quelldateien("services"), ...quelldateien("apps")].map(posix);
}

// ------------------------------------------------------------------------------------------------
// (b) DIE EHRLICHE MARKE — im Kommentarblock DIREKT über der Codezeile.
// ------------------------------------------------------------------------------------------------

/** Das Wort, an dem die Marke erkannt wird. */
const MARKE = "KEIN PRODUKTAUFRUFER";

/** Der echte Weg, in dieser Reihenfolge — ein Name allein genügt nicht. */
const WEG = [
  "KoService.findCandidates",
  "findSearchHits",
  "KoSearchProjectionRepo.findActive",
] as const;

/**
 * Die widerlegten Behauptungen. Sie dürfen in `repo.ts`, `repo-pg.ts` und in KEINER Datei des
 * Zielordners zurückkommen (RUNDE 2, BEN: in Runde 1 war nur der Nachbarwächter bewacht).
 *
 * DIE AUSNAHME IST ENG UND GEMESSEN: Nur DIESE Datei darf die Sätze führen — sie braucht sie als
 * Prüfdaten —, und auch sie nur auf Zeilen, die `WIDERLEGT-ZITAT` tragen. Eine Behauptung, die sich
 * hier ohne diese Marke einschleicht, wird rot wie überall sonst; die Kalibrierung unten misst
 * beide Richtungen.
 */
const WIDERLEGT = ["Ask-Prefilter", "über den Produktpfad gerufen"] as const; // WIDERLEGT-ZITAT

/** Die Marke, mit der diese Datei ihre eigenen Prüfdaten als Zitat ausweist. */
const ZITATMARKE = "WIDERLEGT-ZITAT";

interface Anker {
  readonly datei: string;
  readonly was: string;
  /** Trifft die CODEZEILE, über der die Marke stehen muss (auf dem kommentarfreien Text gesucht). */
  readonly zeile: RegExp;
}

const ANKER: readonly Anker[] = [
  {
    datei: REPO,
    was: "die Schnittstellen-Definition KoRepo.findCandidates",
    zeile: /^ {2}findCandidates\(query: KoCandidateQuery\): Promise<KnowledgeObject\[\]>;$/,
  },
  {
    datei: REPO,
    was: "der Speicher-Adapter InMemoryKoRepo.findCandidates",
    zeile: /^ {2}findCandidates\(query: KoCandidateQuery\): Promise<KnowledgeObject\[\]> \{$/,
  },
  {
    datei: REPO_PG,
    was: "der Kopf der Such-Ausdrücke (KO_CANDIDATE_SEARCH)",
    zeile: /^const KO_CANDIDATE_SEARCH:/,
  },
  {
    datei: REPO_PG,
    was: "der Postgres-Adapter PgKoRepo.findCandidates",
    zeile: /^ {2}async findCandidates\(query: KoCandidateQuery\)/,
  },
];

/**
 * Der zusammenhängende `//`-Kommentarblock DIREKT über `zeilenIndex` (0-basiert).
 *
 * „Direkt" ist die halbe Aussage: eine Marke irgendwo in der Datei erklärt die Stelle nicht, an der
 * jemand landet. Der Rücklauf endet deshalb an der ersten Zeile, die kein `//`-Kommentar ist —
 * Leerzeile eingeschlossen.
 */
function kommentarblockUeber(zeilen: readonly string[], zeilenIndex: number): string {
  const block: string[] = [];
  for (let i = zeilenIndex - 1; i >= 0; i--) {
    const zeile = (zeilen[i] ?? "").trim();
    if (!zeile.startsWith("//")) {
      break;
    }
    block.unshift(zeile);
  }
  return block.join("\n");
}

/** Kommen alle Namen vor, und zwar in dieser Reihenfolge? */
function nenntWegInReihenfolge(text: string): boolean {
  let ab = 0;
  for (const name of WEG) {
    const treffer = text.indexOf(name, ab);
    if (treffer < 0) {
      return false;
    }
    ab = treffer + name.length;
  }
  return true;
}

/**
 * Die zurückgekehrten Behauptungen EINER Datei, mit Zeilennummer.
 *
 * Zeilenweise, nicht dateiweise: so steht in der Beanstandung die Stelle, und so lässt sich die
 * eigene Ausnahme (`ZITATMARKE`) auf die Zeile begrenzen, statt die ganze Datei freizustellen.
 */
function pruefeBehauptungen(datei: string, text: string): string[] {
  const beanstandungen: string[] = [];
  text.split("\n").forEach((zeile, i) => {
    for (const satz of WIDERLEGT) {
      if (!zeile.includes(satz)) {
        continue;
      }
      if (datei === SELBST && zeile.includes(ZITATMARKE)) {
        continue;
      }
      beanstandungen.push(
        `${datei}:${i + 1} — die widerlegte Behauptung „${satz}" steht wieder da`,
      );
    }
  });
  return beanstandungen;
}

/**
 * Die Beanstandungen EINER Datei: je Anker die Marke, dazu die widerlegten Behauptungen.
 *
 * Die Ankerzeile wird auf dem KOMMENTARFREIEN Text gesucht (`Quelle.gestrippt`, zeilentreu) — eine
 * Ankerzeile, die selbst nur in einem Kommentar steht, ist keine. Die MARKE dagegen wird im Rohtext
 * gelesen, denn sie IST ein Kommentar; sie muss aber im Block direkt über der echten Codezeile
 * stehen.
 */
function pruefeMarken(datei: string, text: string): string[] {
  const quelle = quelleAus(datei, text);
  const roh = text.split("\n");
  const gestrippt = quelle.gestrippt.split("\n");
  const beanstandungen: string[] = [];
  for (const anker of ANKER.filter((a) => a.datei === datei)) {
    const treffer = gestrippt
      .map((zeile, i) => ({ zeile, i }))
      .filter(({ zeile }) => anker.zeile.test(zeile));
    if (treffer.length !== 1) {
      beanstandungen.push(
        `${datei}: ${anker.was} — Ankerzeile ${treffer.length}× gefunden, erwartet genau 1×`,
      );
      continue;
    }
    const index = treffer[0]?.i ?? 0;
    const block = kommentarblockUeber(roh, index);
    const stelle = `${datei}:${index + 1} (${anker.was})`;
    if (!block.includes(MARKE)) {
      beanstandungen.push(`${stelle} — die Marke „${MARKE}" fehlt im Kommentar darüber`);
      continue;
    }
    if (!nenntWegInReihenfolge(block)) {
      beanstandungen.push(
        `${stelle} — die Marke nennt den echten Weg nicht: ${WEG.join(" → ")} (in dieser Folge)`,
      );
    }
  }
  return [...beanstandungen, ...pruefeBehauptungen(datei, text)];
}

/** Alle `.ts`-Dateien des Zielordners — erhoben, nicht aufgezählt. */
function ordnerdateien(verzeichnis: string = ORDNER): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(join(WURZEL, verzeichnis), { withFileTypes: true })) {
    const relativ = posix(join(verzeichnis, eintrag.name));
    if (eintrag.isDirectory()) {
      gefunden.push(...ordnerdateien(relativ));
    } else if (relativ.endsWith(".ts")) {
      gefunden.push(relativ);
    }
  }
  return gefunden;
}

/**
 * Der EINE Wegweiser: Datei und Zeile des echten Weges, geprüft gegen `service.ts`.
 *
 * Er steht genau einmal (an der Schnittstellen-Definition in `repo.ts`); ein zweiter wäre eine
 * zweite Wahrheit, die auseinanderlaufen kann. Und er wird nachgeschlagen: der Rumpf muss dort
 * liegen, wo er behauptet zu liegen, und die genannte Einzelzeile muss der Aufruf von
 * `findSearchHits` sein. Verschiebt sich `service.ts`, wird diese Datei rot — gewollt: ein
 * Wegweiser, der ins Leere zeigt, ist genau der Fehler, gegen den dieser Auftrag steht.
 */
function pruefeWegweiser(repoText: string, repoPgText: string, serviceText: string): string[] {
  const beanstandungen: string[] = [];
  const bereich = /services\/knowledge-object\/src\/service\.ts:(\d+)-(\d+)/g;
  const alle = [...repoText.matchAll(bereich), ...repoPgText.matchAll(bereich)];
  if (alle.length !== 1) {
    return [`Der Wegweiser auf ${SERVICE} steht ${alle.length}×, erwartet genau 1×`];
  }
  const zeilen = serviceText.split("\n");
  const von = Number(alle[0]?.[1]);
  const bis = Number(alle[0]?.[2]);
  const rumpf = zeilen.slice(von - 1, bis).join("\n");
  if (!rumpf.includes("async findCandidates(query: KoCandidateQuery)")) {
    beanstandungen.push(
      `${SERVICE}:${von}-${bis} — dort steht KoService.findCandidates nicht (mehr)`,
    );
  }
  const einzeln = [...repoText.matchAll(/service\.ts:(\d+)(?!\d)(?!-)/g)];
  if (einzeln.length !== 1) {
    beanstandungen.push(
      `Die Einzelzeile des Wegweisers steht ${einzeln.length}× in ${REPO}, erwartet genau 1×`,
    );
    return beanstandungen;
  }
  const nr = Number(einzeln[0]?.[1]);
  if (!(zeilen[nr - 1] ?? "").includes("findSearchHits")) {
    beanstandungen.push(`${SERVICE}:${nr} — dort steht der Aufruf von findSearchHits nicht (mehr)`);
  }
  return beanstandungen;
}

// ------------------------------------------------------------------------------------------------
// DIE FÄLLE
// ------------------------------------------------------------------------------------------------

describe("JOB 3607 · (a) der Kandidatenweg der Adapter hat im Produkt keinen Aufrufer", () => {
  it("kein Repository-`findCandidates(` in services/** und apps/** — über alle Produktdateien", () => {
    const dateien = produktdateien();
    // Eine Erhebung, die nichts gelesen hat, ist keine Entwarnung.
    expect(dateien.length).toBeGreaterThan(0);
    expect(dateien).toContain(REPO);
    expect(dateien).toContain(REPO_PG);
    const funde = dateien.flatMap((datei) => aufrufeIn(datei, lies(datei)));
    expect(funde.map((f) => `${f.datei}:${f.zeile} — ${f.text} (${f.art})`)).toEqual([]);
    process.stdout.write(
      `\nJOB 3607 — (a) gelesen: ${dateien.length} Produktdateien, 0 Aufrufer.\n`,
    );
  });

  it("der ECHTE Weg ist da und wird nicht mitgezählt: KoService.findCandidates ruft findSearchHits", () => {
    const service = lies(SERVICE);
    expect(service).toContain("await this.findSearchHits({");
    // Der Dienst ruft das Repository nur für das Nachladen der Kennungen — nicht für die Auswahl.
    expect(aufrufeIn(SERVICE, service)).toEqual([]);
  });
});

describe("JOB 3607 · (b) die ehrliche Marke steht an allen vier Stellen", () => {
  it("Marke, echter Weg und keine widerlegte Behauptung — in repo.ts und repo-pg.ts", () => {
    expect(pruefeMarken(REPO, lies(REPO))).toEqual([]);
    expect(pruefeMarken(REPO_PG, lies(REPO_PG))).toEqual([]);
  });

  it("der EINE Wegweiser zeigt auf die Zeilen, an denen der echte Weg wirklich steht", () => {
    expect(pruefeWegweiser(lies(REPO), lies(REPO_PG), lies(SERVICE))).toEqual([]);
  });

  it("keine widerlegte Behauptung im GANZEN Zielordner — jede Datei einzeln gelesen", () => {
    const dateien = ordnerdateien();
    // Wieder: eine Erhebung, die nichts gelesen hat, ist keine Entwarnung.
    expect(dateien.length).toBeGreaterThan(0);
    expect(dateien).toContain(SELBST);
    expect(dateien).toContain(NACHBAR);
    expect(dateien).toContain(`${ORDNER}/speicher-rangfolge.test.ts`);
    expect(dateien.flatMap((datei) => pruefeBehauptungen(datei, lies(datei)))).toEqual([]);
    process.stdout.write(`\nJOB 3607 — (b) gelesen: ${dateien.length} Dateien im Zielordner.\n`);
  });

  it("der Nachbarwächter nennt die Stelle, die den Befund trägt", () => {
    // Sonst stünde er wieder allein da und niemand fände von ihm hierher.
    expect(lies(NACHBAR)).toContain("toter-kandidatenweg");
  });
});

// ------------------------------------------------------------------------------------------------
// KALIBRIERUNG — die Schärfe des Prüfwerkzeugs, an gestellten Quellen gemessen.
// ------------------------------------------------------------------------------------------------
// Beide Prüfwege bekommen hier TEXT statt Dateien und werden auf beide Richtungen gemessen: was rot
// werden muss, wird rot — und was grün bleiben muss, bleibt grün. Ein Wächter, der alles beanstandet,
// wäre so wertlos wie einer, der nichts beanstandet.

describe("JOB 3607 · Kalibrierung (a): was als Aufrufer zählt und was nicht", () => {
  const fall = (rumpf: string): string[] =>
    aufrufeIn("services/probe/src/probe.ts", rumpf).map((f) => `${f.art}:${f.name}`);

  it("ein eingespeister Produktaufrufer wird gefunden — in jeder Schreibweise", () => {
    expect(
      fall("class A { async f() { return this.repo.findCandidates({ terms: [], limit: 1 }); } }"),
    ).toEqual(["name:repo"]);
    expect(fall("const x = await koRepo.findCandidates({ terms: [], limit: 1 });")).toEqual([
      "name:koRepo",
    ]);
    expect(fall("const x = await repo.findCandidates({ terms: [], limit: 1 });")).toEqual([
      "name:repo",
    ]);
    expect(fall('const x = await repo["findCandidates"]({ terms: [], limit: 1 });')).toEqual([
      "name:repo",
    ]);
    expect(fall("const x = await this.repo?.findCandidates({ terms: [], limit: 1 });")).toEqual([
      "name:repo",
    ]);
    // Ohne `await` vor der Klammer, und das ist gemessen, nicht Geschmack: `await (…)` liest der
    // Parser hier als AUFRUF einer Funktion namens `await` — der Fall prüfte sonst den Parser
    // statt die Hüllenbehandlung (`(x)`, `x as T`).
    expect(fall("const x = (this.repo as KoRepo).findCandidates({ terms: [] });")).toEqual([
      "name:repo",
    ]);
  });

  // RUNDE 2 — die zwei Umgehungen, die BEN an der ersten Fassung gemessen hat. Beide kamen dort
  // durch; beide sind hier wörtlich nachgebaut und müssen rot sein.
  it("BEN-Umgehung 1: ein lokaler Alias zählt — auch der Alias eines Alias", () => {
    expect(
      fall("class A { async f(q) { const source = this.repo; return source.findCandidates(q); } }"),
    ).toEqual(["alias:source"]);
    expect(
      fall("const a = koRepo;\nconst b = a;\nconst x = b.findCandidates({ terms: [] });"),
    ).toEqual(["alias:b"]);
    expect(
      fall("class A { f(q) { this.quelle = this.repo; return this.quelle.findCandidates(q); } }"),
    ).toEqual(["alias:quelle"]);
  });

  it("BEN-Umgehung 2: ein Kommentar im Empfängerausdruck ändert nichts", () => {
    expect(fall("class A { f(q) { return this. /* Repo */ repo.findCandidates(q); } }")).toEqual([
      "name:repo",
    ]);
    expect(
      fall("class A { f(q) { const s = this. /* x */ repo; return s.findCandidates(q); } }"),
    ).toEqual(["alias:s"]);
  });

  // RUNDE 3 — die zwei Umgehungen, die BEN an der zweiten Fassung GEMESSEN hat. Beide standen
  // vollständig in einem Methodenrumpf und kamen durch; beide sind hier wörtlich nachgebaut.
  it("BEN-Umgehung 3: eine ZERLEGUNG trägt das Repository weiter — das Feld entscheidet", () => {
    // Wörtlich die Mutation aus `service.ts:3255`, die grün blieb.
    expect(
      fall(
        "class A { async f(query) { const { repo: source } = this; await source.findCandidates(query); } }",
      ),
    ).toEqual(["alias:source"]);
    expect(fall("const { repo } = deps;\nconst x = repo.findCandidates({});")).toEqual([
      "name:repo",
    ]);
    expect(fall("const { koRepo: q } = deps;\nconst x = q.findCandidates({});")).toEqual([
      "alias:q",
    ]);
    // Zerlegung in der Tiefe, Zerlegung als Zuweisung, Zerlegung aus einer Liste.
    expect(
      fall("const { repo: { findCandidates: fc } } = this;\nconst x = fc({ terms: [] });"),
    ).toEqual(["abgeloest:fc"]);
    expect(
      fall("class A { f(q) { ({ repo: this.s } = this); return this.s.findCandidates(q); } }"),
    ).toEqual(["alias:s"]);
    expect(fall("const [source] = [this.repo];\nconst x = source.findCandidates({});")).toEqual([
      "alias:source",
    ]);
  });

  it("BEN-Umgehung 4: Klammern, Weitergabe und Verzweigung ändern den Aufruf nicht", () => {
    // Wörtlich die zweite Mutation aus `service.ts:3255`, die grün blieb.
    expect(
      fall(
        "class A { async f(query) { const source = this.repo; await (source.findCandidates)(query); } }",
      ),
    ).toEqual(["alias:source"]);
    expect(
      fall("class A { async f(q) { return await ((this.repo).findCandidates)(q); } }"),
    ).toEqual(["name:repo"]);
    expect(fall("class A { f(q) { return this.repo.findCandidates.call(this, q); } }")).toEqual([
      "name:repo",
    ]);
    expect(
      fall("const { findCandidates } = koRepo;\nconst x = findCandidates.apply(null, [{}]);"),
    ).toEqual(["abgeloest:findCandidates"]);
    expect(
      fall("class A { f(q, andere) { return (andere ?? this.repo).findCandidates(q); } }"),
    ).toEqual(["name:repo"]);
    expect(
      fall(
        "class A { f(q, b) { const s = b ? this.repo : this.zweite; return s.findCandidates(q); } }",
      ),
    ).toEqual(["alias:s"]);
  });

  it("RUNDE 3 · Gegenrichtung: dieselben Formen über den DIENST bleiben grün", () => {
    // Dasselbe Maß in beide Richtungen — sonst wäre der Wächter nur streng, nicht scharf.
    expect(
      fall(
        "class A { async f(q) { const { ko: dienst } = this.deps; return dienst.findCandidates(q); } }",
      ),
    ).toEqual([]);
    // Die Dienstklasse löst ihre EIGENE Methode ab: der echte Produktweg, kein Repository.
    expect(
      fall("class A { async f(q) { const { findCandidates } = this; return findCandidates(q); } }"),
    ).toEqual([]);
    expect(
      fall("class A { async f(q) { return await (this.koService.findCandidates)(q); } }"),
    ).toEqual([]);
    expect(
      fall("class A { f(q) { return this.koService.findCandidates.call(this, q); } }"),
    ).toEqual([]);
    expect(
      fall("const [dienst] = [this.koService];\nconst x = dienst.findCandidates({});"),
    ).toEqual([]);
    expect(
      fall("class A { f(q, b) { return (b ? deps.ko : this.koService).findCandidates(q); } }"),
    ).toEqual([]);
  });

  it("ein getypter Träger und eine abgelöste Methode zählen ebenfalls", () => {
    expect(fall("async function f(laden: KoRepo, q) { return laden.findCandidates(q); }")).toEqual([
      "typ:laden",
    ]);
    expect(
      fall(
        "class A { private readonly laden: PgKoRepo; f(q) { return this.laden.findCandidates(q); } }",
      ),
    ).toEqual(["typ:laden"]);
    expect(
      fall("const { findCandidates } = koRepo;\nconst x = findCandidates({ terms: [] });"),
    ).toEqual(["abgeloest:findCandidates"]);
    expect(fall("const { findCandidates: fc } = this.repo;\nconst x = fc({ terms: [] });")).toEqual(
      ["abgeloest:fc"],
    );
  });

  it("Kommentar und Stringliteral sind keine Aufrufer (kein Falsch-Rot)", () => {
    expect(fall("// früher: this.repo.findCandidates({ terms, limit })\nconst x = 1;")).toEqual([]);
    expect(fall("/* this.repo.findCandidates({ terms, limit }) */\nconst x = 1;")).toEqual([]);
    expect(fall('const hinweis = "this.repo.findCandidates({ terms, limit })";')).toEqual([]);
    expect(fall("const hinweis = `this.repo.findCandidates(x)`;")).toEqual([]);
  });

  it("der ECHTE Produktweg über den Dienst bleibt grün — auch über einen Alias", () => {
    expect(fall("const x = await deps.ko.findCandidates({ terms: [], limit: 1 });")).toEqual([]);
    expect(fall("const x = await this.koService.findCandidates({ terms: [], limit: 1 });")).toEqual(
      [],
    );
    expect(
      fall("const dienst = this.koService;\nconst x = await dienst.findCandidates({});"),
    ).toEqual([]);
    expect(fall("const x = await this.repo.listByIds(['a']);")).toEqual([]);
    expect(fall("class A { findCandidates(q) { return this.findSearchHits(q); } }")).toEqual([]);
  });

  // DIE GRENZE, gemessen statt behauptet (s. Kopf): ein Träger ohne Typangabe, ohne repo-ähnlichen
  // Namen und ohne sichtbare Zuweisung im selben Modul bleibt ungesehen. Dafür bräuchte es den
  // Typprüfer über das ganze Programm. Wer die Zusicherung dieser Datei liest, liest hier ihr Ende.
  it("bleibt ungesehen: ein Träger, den erst der Typprüfer als Repository erkennen könnte", () => {
    expect(
      fall("import { hol } from './x';\nconst y = hol();\nconst z = y.findCandidates({});"),
    ).toEqual([]);
  });
});

describe("JOB 3607 · Kalibrierung (b): was die Marke NICHT befriedigen darf", () => {
  const ECHT = lies(REPO_PG);

  it("fehlende Marke, falscher Weg, falsche Reihenfolge und eine Marke am falschen Ort sind rot", () => {
    const ohneMarke = ECHT.replaceAll(MARKE, "Hinweis");
    expect(pruefeMarken(REPO_PG, ohneMarke)).not.toEqual([]);

    const falscherWeg = ECHT.replaceAll(
      "KoSearchProjectionRepo.findActive",
      "PgKoRepo.findCandidates",
    );
    expect(pruefeMarken(REPO_PG, falscherWeg)).not.toEqual([]);

    const verdreht = ECHT.replaceAll(
      "KoService.findCandidates",
      "KoSearchProjectionRepo.findActive",
    );
    expect(pruefeMarken(REPO_PG, verdreht)).not.toEqual([]);

    // Die Marke steht in der Datei, aber nicht über der Stelle: eine Leerzeile trennt sie ab.
    const abgetrennt = ECHT.replace(/\n(const KO_CANDIDATE_SEARCH:)/, "\n\n$1");
    expect(pruefeMarken(REPO_PG, abgetrennt)).not.toEqual([]);
  });

  it("die widerlegten Behauptungen machen rot, sobald sie zurückkommen — in JEDER Datei", () => {
    for (const satz of WIDERLEGT) {
      expect(pruefeMarken(REPO_PG, `${ECHT}\n// ${satz}\n`)).not.toEqual([]);
      // RUNDE 2 (BEN): genau diese Datei war in Runde 1 unbewacht.
      const nachbar = `${ORDNER}/speicher-rangfolge.test.ts`;
      expect(pruefeBehauptungen(nachbar, `// ${satz}\n`)).not.toEqual([]);
      expect(pruefeBehauptungen(`${ORDNER}/frei-erfunden.test.ts`, `// ${satz}\n`)).not.toEqual([]);
      // Und die eigene Ausnahme trägt nur so weit, wie sie ausgewiesen ist.
      expect(pruefeBehauptungen(SELBST, `// ${satz} — ${ZITATMARKE}\n`)).toEqual([]);
      expect(pruefeBehauptungen(SELBST, `// ${satz}\n`)).not.toEqual([]);
    }
  });

  it("ein verrotteter Wegweiser wird rot — beide Zahlen werden nachgeschlagen", () => {
    const repo = lies(REPO);
    const service = lies(SERVICE);
    expect(pruefeWegweiser(repo, lies(REPO_PG), service)).toEqual([]);
    // Zwei Zeilen mehr am Anfang: der Rumpf liegt nicht mehr, wo der Wegweiser sagt.
    expect(pruefeWegweiser(repo, lies(REPO_PG), `\n\n${service}`)).not.toEqual([]);
    // Ein zweiter Wegweiser ist eine zweite Wahrheit.
    const zweiter = `${repo}\n// services/knowledge-object/src/service.ts:1-2\n`;
    expect(pruefeWegweiser(zweiter, lies(REPO_PG), service)).not.toEqual([]);
  });
});
