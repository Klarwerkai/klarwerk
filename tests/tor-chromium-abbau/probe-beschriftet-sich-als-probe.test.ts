// ================================================================================================
// JOB 3579 · 11.09.2026 — DIE PROBE BESCHRIFTET SICH ALS PROBE, UND IHRE VERGLEICHE HALTEN FARBE AUS.
// ================================================================================================
//
// DER ANLASS steht nebenan in `etikett-ist-kein-laufnachweis.test.ts` (JOB 3573): 36 Jobs haben 44
// rote Torbefunde bekommen, weil die Probe von `tests/tor-bereitschaft/t1b-hooks.test.ts` ihre
// Wegwerfläufe mit den ECHTEN Pfaden zweier Produkt-Testdateien beschriftet hat. JOB 3573 hat die
// Fehldeutung als Fehldeutung festgehalten; die URSACHE blieb stehen. Dieser Wächter hält sie
// geschlossen — und zwar an der AUSGABE eines echten Probenlaufs, nicht an einer Absicht im
// Quelltext.
//
// ZWEI ZUSAGEN WERDEN HIER GEPINNT:
//   F5a · Jede Zeile, die ein Probenlauf mit „Chromium-Abbau · " schreibt, trägt danach das Präfix
//         „PROBE (t1b) · ". Keine trägt dort einen Produktpfad. GEMESSEN, indem die Probe läuft.
//   F5b · Jeder `expect(…)` in `t1b-hooks.test.ts`, dessen Argument die Ausgabe des Unterlaufs ist,
//         führt durch die Entfärbung `klartext(…)`. Ein Rohvergleich bricht, sobald die Umgebung
//         Farbe erzwingt (Cloud-Arbeitsprüfung) — im Tor fällt das nicht auf, weil dort keine Farbe
//         erzwungen wird. Genau so ist der Fehler zwei Fassungen lang unbemerkt geblieben.
//   F5c · Derselbe Blick erkennt auch die getarnten Formen und lässt sich von einem Kommentar weder
//         rot noch grün machen. Gemessen sind vier Tarnungen: Zwischenvariable, ZERLEGUNG
//         (`const { ausgabe: roh } = r`), unter neuem Namen IMPORTIERTES `expect` und im Rumpf
//         WEITERGEREICHTES `expect` (`const pruefe = expect`). Die beiden letztgenannten Formen
//         standen nicht von Anfang an hier: BEN hat sie an der Fassung von Runde 1 gemessen, sie
//         kamen durch, und erst Runde 2 hat den Blick und diese Fälle nachgezogen.
//   F5d · Das Präfix ist der Probe vorbehalten: kein echter Aufruf im Bestand beschriftet sich so.
//
// NICHT HIER, SONDERN IN DER PROBE SELBST: die dritte Ausgabelage der Messstelle („nicht gemessen:
// kein Browser aufgebaut", `chromium-abbau.ts:65-67`) misst `t1b-hooks.test.ts` mit einem eigenen
// Lauf ohne Browser — dort, wo `mitProbedateien()` die Wegwerfdateien baut. F5a hier fährt den
// Negativfall; beide Läufe zusammen decken alle drei Ausgabelagen ab.
//
// WARUM ÜBER DEN SYNTAXBAUM UND NICHT ÜBER ZEICHENKETTEN (F5b/F5c) — zwei belegte Lehren des
// Hauses: „Die Kommentarentfernung … verwechselt gültigen TypeScript-Code mit Kommentaren"
// (JOB 3565 R1, 10.09. 22:51) und „F4 lässt gelöschte Bestandserwartungen durch, weil ein Kommentar
// als Ersatz mitzählt" (JOB 3570 R1, 11.09. 00:37). Kommentare kommen im AST gar nicht vor.
// Dazu die dritte: „ein Wächter, der nur die offensichtliche Form kennt, ist kein Wächter"
// (JOB 3564 R2, 10.09. 23:00) — deshalb F5c.
//
// WARUM EINE EIGENE DATEI und keine Ergänzung von `etikett-ist-kein-laufnachweis.test.ts`: F5a
// LÄSST DIE PROBE LAUFEN und startet dabei echte Chromium-Prozesse. Diese Datei gehört damit in die
// serielle Browser-Gruppe und holt sich die Zuordnung über dieselbe transitive Kante wie
// `t1b-hooks.test.ts` selbst (`tests/tor-inventar/browser-gruppe.ts` rechnet die Gruppe aus dem
// Importgraphen). Der Wächter von JOB 3573 kommt ohne Browser aus; ihn hier hineinzuziehen hieße,
// eine billige Datei in den teuren Lauf zu heben.
//
// DIESE DATEI SCHREIBT DIE IRREFÜHRENDE ZEILE NIE SELBST INS TORPROTOKOLL: Der Unterlauf wird
// bewusst NICHT mit `console.log` weitergereicht. Was zu sehen ist, steht in den Fehlermeldungen —
// und die gibt es nur, wenn wirklich etwas kaputt ist.
import { execFile } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import ts from "typescript";
import { expect, it } from "vitest";
// Transitive Chromium-Kante: F5a startet über die Probe echte Browser. Ohne diesen Import ordnete
// der Graph diese Datei dem parallelen Rest-Lauf zu — genau die Last, die JOB 3131 beendet hat.
import "../design/h6-chromium";
import { REPO_WURZEL } from "../support/repoPfad";

/** Die Datei, die die Probe fährt. */
const HOOKS = "tests/tor-bereitschaft/t1b-hooks.test.ts";

/**
 * Das Präfix, das die Probe seit JOB 3579 vor jedes Etikett setzt. Bewusst hier NOCH EINMAL als
 * Literal und nicht aus `t1b-hooks.test.ts` importiert: eine `.test.ts` lässt sich nicht importieren,
 * ohne ihre sechs Fälle ein zweites Mal zu registrieren. Der Beleg ist deshalb der LAUF (F5a), nicht
 * die geteilte Konstante — wer das Präfix im Produktivpfad zurücknimmt, wird von F5a rot gestellt.
 */
const PRAEFIX = "PROBE (t1b) · ";

/** Die beiden Pfade, mit denen die Probe ihre Wegwerfläufe beschriftet. */
const DATEIEN = [
  "tests/start-karten-schmal/start-karten-schmal-chromium.test.tsx",
  "tests/rollenvorschau-sperre/rollenraster-schmal-chromium.test.ts",
] as const;

/** Der Fall in `t1b-hooks.test.ts`, aus dem die 63 Protokollzeilen stammen. */
const NEGATIVFALL = "dauerhaft fehlender Abschluss";

/**
 * Jede Abbauzeile einer Ausgabe, in der Form, in der sie im Torprotokoll steht.
 *
 * AUSGENOMMEN sind die Quelltextauszüge des Reporters: Vitest druckt zu einem Fehler die Umgebung
 * der werfenden Zeile mit, und dort steht die VORLAGE `Chromium-Abbau · ${datei} · …` aus
 * `tests/tor-bereitschaft/chromium-abbau.ts:90` — kein Etikett, sondern der Bauplan dafür. Solche
 * Zeilen tragen den Zeilenzähler des Reporters („ 90| "). Gemessen am 11.09. im Arbeitsprüflauf
 * 29105f29…: von sechs Treffern waren zwei solche Auszüge, je einer je Probedatei.
 */
function abbauzeilen(ausgabe: string): string[] {
  return ausgabe
    .split("\n")
    .filter((z) => !/^\s*\d+\s*\|/.test(z))
    .flatMap((z) => z.match(/Chromium-Abbau · [^\n]*/g) ?? []);
}

// ------------------------------------------------------------------------------------------------
// F5a · DIE PROBE LÄUFT. Nicht ihre Quelle wird gelesen, sondern ihre Ausgabe gemessen.
// ------------------------------------------------------------------------------------------------
it("F5a · die Probe läuft, und JEDE ihrer Abbauzeilen weist sich als Probe aus", async () => {
  // Farbe wird hier AUSGESCHALTET, nicht entfärbt: `klartext` bleibt EIN Helfer an EINER Stelle
  // (in `t1b-hooks.test.ts`), und eine zweite Kopie davon wäre genau die Doppelung, die dieser
  // Auftrag beseitigt. Ein Unterlauf ohne Farbe ist deterministisch und braucht keine.
  const umgebung: NodeJS.ProcessEnv = {
    ...process.env,
    KLARWERK_SKIP_KEYCHAIN: "1",
    NO_COLOR: "1",
    FORCE_COLOR: "0",
  };
  // Die Gruppenvariable wird AUSDRÜCKLICH entfernt und nie geerbt: dieser Fall läuft im Tor als
  // Kind des Browser-Aufrufs, und ein geerbtes `KLARWERK_TESTGRUPPE=rest` schnitte `t1b-hooks`
  // aus dem `include` des Unterlaufs heraus — er fände dann gar keine Datei und sagte nichts.
  delete umgebung.KLARWERK_TESTGRUPPE;

  let code = 0;
  let ausgabe = "";
  try {
    const r = await promisify(execFile)(
      process.execPath,
      [
        "node_modules/vitest/vitest.mjs",
        "run",
        HOOKS,
        "-t",
        NEGATIVFALL,
        "--pool=forks",
        "--poolOptions.forks.maxForks=1",
        "--poolOptions.forks.minForks=1",
      ],
      { cwd: REPO_WURZEL, env: umgebung, timeout: 240_000, maxBuffer: 8_000_000 },
    );
    ausgabe = r.stdout + r.stderr;
  } catch (e) {
    const r = e as { code: number; stdout: string; stderr: string };
    code = r.code;
    ausgabe = r.stdout + r.stderr;
  }

  expect(
    code,
    `die Probe selbst muss grün sein, sonst misst dieser Fall den falschen Zustand:\n${ausgabe.slice(-4000)}`,
  ).toBe(0);

  const zeilen = abbauzeilen(ausgabe);
  expect(
    zeilen.length,
    "der Unterlauf hat keine einzige Abbauzeile geschrieben — dieser Fall misst dann nichts",
  ).toBeGreaterThanOrEqual(DATEIEN.length);
  expect(
    zeilen.filter((z) => !z.startsWith(`Chromium-Abbau · ${PRAEFIX}`)),
    "Abbauzeile eines Probenlaufs ohne Probenetikett — wer sie im Torprotokoll liest, hält sie für einen Befund",
  ).toEqual([]);
  for (const datei of DATEIEN) {
    expect(
      ausgabe.includes(`Chromium-Abbau · ${datei}`),
      `die Probe beschriftet ihren Wegwerflauf weiter mit ${datei}`,
    ).toBe(false);
  }
}, 300_000);

// ------------------------------------------------------------------------------------------------
// DER BLICK FÜR F5b/F5c — eine Verfolgung über den Syntaxbaum, keine Zeichenkettensuche.
// ------------------------------------------------------------------------------------------------
type Form = "direkt" | "alias" | "umbenannt";

interface Fund {
  readonly zeile: number;
  readonly text: string;
  readonly form: Form;
}

interface Befund {
  /** Vergleiche über die ROHE Unterlaufausgabe — muss leer sein. */
  readonly funde: Fund[];
  /** Vergleiche, die nachweislich durch die Entfärbung führen — der Beleg gegen ein Vakuum. */
  readonly gedeckt: number;
  /** Unter welchen Namen `expect` in dieser Datei erreichbar ist. */
  readonly expectNamen: string[];
}

/** Woher ein Bezeichner seinen Wert hat. `element` ist gesetzt, wenn er aus einer Zerlegung stammt. */
interface Herkunft {
  readonly deklaration: ts.VariableDeclaration;
  readonly element?: ts.BindingElement;
}

/** Der Name, unter dem ein Zerlegungsstück aus seinem Gegenstand geholt wird (`{ ausgabe: roh }`). */
function eigenschaftsname(element: ts.BindingElement): string | undefined {
  const e = element.propertyName ?? element.name;
  return ts.isIdentifier(e) || ts.isStringLiteral(e) ? e.text : undefined;
}

/** Das Zerlegungsstück, das `name` bindet — auch aus verschachtelten Mustern. */
function findeBindungselement(
  muster: ts.BindingPattern,
  name: string,
): ts.BindingElement | undefined {
  for (const e of muster.elements) {
    if (!ts.isBindingElement(e)) {
      continue; // ausgelassene Stelle in einem Reihenmuster: `const [, zweites] = …`
    }
    if (ts.isIdentifier(e.name)) {
      if (e.name.text === name) {
        return e;
      }
      continue;
    }
    const tiefer = findeBindungselement(e.name, name);
    if (tiefer !== undefined) {
      return tiefer;
    }
  }
  return undefined;
}

/**
 * Die Deklaration eines Bezeichners, von der Verwendungsstelle aus nach OBEN gesucht.
 *
 * Bewusst nicht über eine Namensliste der ganzen Datei: `ausgabe` heißt in `t1b-hooks.test.ts`
 * SOWOHL die lokale Sammelvariable in `lauf()` (dort roh) ALS AUCH die entfärbte Fassung in den
 * Fällen (dort sauber). Wer nur nach dem Namen sucht, verwechselt beide.
 *
 * JOB 3579 R2: Auch ZERLEGUNGEN werden gefunden. `const { ausgabe: roh } = r;` deklariert `roh`
 * nicht als Bezeichner, sondern als Stück eines Musters — die Fassung von Runde 1 sah dort nichts
 * und ließ `expect(roh)` durch (BEN, Prüfbericht Runde 1, „Zusätzliche Gegenprobe A").
 */
function findeDeklaration(id: ts.Identifier): Herkunft | undefined {
  for (let n: ts.Node | undefined = id.parent; n !== undefined; n = n.parent) {
    const stmts = ts.isSourceFile(n) ? n.statements : ts.isBlock(n) ? n.statements : undefined;
    if (stmts === undefined) {
      continue;
    }
    for (const s of stmts) {
      if (!ts.isVariableStatement(s)) {
        continue;
      }
      for (const d of s.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) {
          if (d.name.text === id.text) {
            return { deklaration: d };
          }
          continue;
        }
        const element = findeBindungselement(d.name, id.text);
        if (element !== undefined) {
          return { deklaration: d, element };
        }
      }
    }
  }
  return undefined;
}

/**
 * Alle Namen, unter denen einer aus `namen` in dieser Datei erreichbar ist — als Fixpunkt.
 *
 * Erfasst die Weiterreichung (`const pruefe = expect;`) und die Zerlegung
 * (`const { expect: pruefe } = await import("vitest");`), beide beliebig oft hintereinander.
 * Das ist kein vollständiger Namensauflöser (kein Gültigkeitsbereich, keine Neuzuweisung); es ist
 * genau die Menge Tarnungen, die als Gegenprobe gemessen ist — weiter reicht die Aussage nicht.
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

/**
 * Prüft, ob in `quelle` ein Vergleich über die ROHE Ausgabe des Unterlaufs steht.
 *
 * „Roh" ist jede Stelle, die auf `<etwas>.ausgabe` zurückführt, ohne unterwegs durch den Entfärber
 * zu laufen. Die Rückführung geht auch über Zwischenvariablen (`const roh = r.ausgabe`), und der
 * Einstieg wird am tatsächlich importierten Namen von `expect` festgemacht — nicht am Wort
 * „expect". Beides sind die Umgehungsformen aus Pflichtlieferung 6c.
 */
function pruefeFarbfestigkeit(quelle: string, dateiname: string, entfaerber = "klartext"): Befund {
  const ast = ts.createSourceFile(
    dateiname,
    quelle,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  // ---- Unter welchem Namen ist `expect` hier erreichbar? -----------------------------------------
  // Zuerst der Import, dann die Weiterreichungen im Rumpf: `const pruefe = expect;` war die zweite
  // Tarnung, die BEN an Runde 1 gemessen hat („Zusätzliche Gegenprobe B") und die durchkam, weil
  // nur die Importliste befragt wurde.
  const importiert = new Set<string>();
  ts.forEachChild(ast, (k) => {
    if (!ts.isImportDeclaration(k)) {
      return;
    }
    const bindungen = k.importClause?.namedBindings;
    if (bindungen === undefined || !ts.isNamedImports(bindungen)) {
      return;
    }
    for (const e of bindungen.elements) {
      if ((e.propertyName ?? e.name).text === "expect") {
        importiert.add(e.name.text);
      }
    }
  });
  if (importiert.size === 0) {
    importiert.add("expect");
  }
  const expectNamen = mitAliasen(ast, importiert);

  // ---- Unter welchen Namen ist der Entfärber erreichbar? -----------------------------------------
  // Auch ein weitergereichter Entfärber (`const k = klartext;`) zählt als sauber; sonst wäre eine
  // korrekte Fassung fälschlich rot.
  const sauber = mitAliasen(ast, [entfaerber]);

  const bewerte = (
    n: ts.Node,
    gesehen: Set<ts.Node>,
  ): { roh: boolean; alias: boolean; rein: boolean } => {
    if (gesehen.has(n)) {
      return { roh: false, alias: false, rein: false };
    }
    gesehen.add(n);
    // Ein Aufruf des Entfärbers beendet die Frage: was hier herauskommt, ist entfärbt.
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && sauber.has(n.expression.text)) {
      return { roh: false, alias: false, rein: true };
    }
    // Die Ausgabe des Unterlaufs selbst.
    if (ts.isPropertyAccessExpression(n) && n.name.text === "ausgabe") {
      return { roh: true, alias: false, rein: false };
    }
    if (ts.isIdentifier(n)) {
      const h = findeDeklaration(n);
      if (h === undefined) {
        return { roh: false, alias: false, rein: false };
      }
      // Eine Zerlegung ist ein Eigenschaftszugriff unter anderem Namen: `const { ausgabe: roh } = r`
      // ist `r.ausgabe`. Holt sie etwas anderes, entscheidet der Gegenstand der Zerlegung — sonst
      // wäre `const { code } = r` ein Fehlalarm.
      if (h.element !== undefined && eigenschaftsname(h.element) === "ausgabe") {
        return { roh: true, alias: true, rein: false };
      }
      if (h.deklaration.initializer === undefined) {
        return { roh: false, alias: false, rein: false };
      }
      const u = bewerte(h.deklaration.initializer, gesehen);
      // Über eine Zwischenvariable erreicht — das ist die getarnte Form.
      return { roh: u.roh, alias: u.roh, rein: u.rein };
    }
    let roh = false;
    let alias = false;
    let rein = false;
    ts.forEachChild(n, (k) => {
      const u = bewerte(k, gesehen);
      roh = roh || u.roh;
      alias = alias || u.alias;
      rein = rein || u.rein;
    });
    return { roh, alias, rein };
  };

  const funde: Fund[] = [];
  let gedeckt = 0;
  const besuche = (n: ts.Node): void => {
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      expectNamen.has(n.expression.text)
    ) {
      const arg = n.arguments[0];
      if (arg !== undefined) {
        const u = bewerte(arg, new Set());
        if (u.roh) {
          funde.push({
            zeile: ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1,
            text: (n.getText(ast).split("\n")[0] ?? "").trim(),
            form: n.expression.text !== "expect" ? "umbenannt" : u.alias ? "alias" : "direkt",
          });
        } else if (u.rein) {
          gedeckt += 1;
        }
      }
    }
    ts.forEachChild(n, besuche);
  };
  ts.forEachChild(ast, besuche);

  return { funde, gedeckt, expectNamen: [...expectNamen].sort() };
}

/** Deklarationsorte und erster Gebrauch eines Namens — für „EIN Helfer an EINER Stelle". */
function orte(
  quelle: string,
  dateiname: string,
  name: string,
): { deklarationen: number[]; ersterGebrauch: number } {
  const ast = ts.createSourceFile(
    dateiname,
    quelle,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const deklarationen: number[] = [];
  let ersterGebrauch = Number.POSITIVE_INFINITY;
  const besuche = (n: ts.Node): void => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) {
      deklarationen.push(n.getStart(ast));
    } else if (ts.isFunctionDeclaration(n) && n.name?.text === name) {
      deklarationen.push(n.getStart(ast));
    } else if (ts.isIdentifier(n) && n.text === name) {
      const eigeneDeklaration =
        (ts.isVariableDeclaration(n.parent) || ts.isFunctionDeclaration(n.parent)) &&
        n.parent.name === n;
      if (!eigeneDeklaration) {
        ersterGebrauch = Math.min(ersterGebrauch, n.getStart(ast));
      }
    }
    ts.forEachChild(n, besuche);
  };
  ts.forEachChild(ast, besuche);
  return { deklarationen, ersterGebrauch };
}

function hooksQuelle(): string {
  return readFileSync(join(REPO_WURZEL, HOOKS), "utf8");
}

function alsText(funde: readonly Fund[]): string[] {
  return funde.map((f) => `${HOOKS}:${f.zeile} (${f.form}) ${f.text}`);
}

// ------------------------------------------------------------------------------------------------
// F5b · JEDER Vergleich über die Unterlaufausgabe führt durch die Entfärbung.
// ------------------------------------------------------------------------------------------------
it("F5b · jeder Vergleich über die Unterlauf-Ausgabe von t1b-hooks führt durch die Entfärbung", () => {
  const quelle = hooksQuelle();
  const befund = pruefeFarbfestigkeit(quelle, HOOKS);

  expect(
    alsText(befund.funde),
    "Vergleich über die ROHE Unterlaufausgabe — er bricht, sobald die Umgebung Farbe erzwingt, und im Tor sieht man es nicht",
  ).toEqual([]);
  expect(
    befund.gedeckt,
    "kein einziger entfärbter Vergleich gefunden — dieser Fall misst dann nichts",
  ).toBeGreaterThanOrEqual(6);

  // EIN Helfer an EINER Stelle, und er steht vor seinem ersten Gebrauch (Pflichtlieferung 4).
  for (const name of ["klartext", "OHNE_FARBE"]) {
    const o = orte(quelle, HOOKS, name);
    expect(o.deklarationen.length, `${name} ist mehr als einmal (oder gar nicht) deklariert`).toBe(
      1,
    );
    expect(o.deklarationen[0], `${name} wird gebraucht, bevor es deklariert ist`).toBeLessThan(
      o.ersterGebrauch,
    );
  }
});

// ------------------------------------------------------------------------------------------------
// F5c · Der Blick kennt auch die getarnten Formen — und Kommentare zählen nicht.
// ------------------------------------------------------------------------------------------------
it("F5c · getarnte Rohvergleiche (Alias, umbenanntes expect) werden erkannt, Kommentare nicht", () => {
  // (1) In der echten Datei steht keine getarnte Form.
  const echt = pruefeFarbfestigkeit(hooksQuelle(), HOOKS);
  expect(
    alsText(echt.funde.filter((f) => f.form !== "direkt")),
    "getarnter Rohvergleich in t1b-hooks.test.ts",
  ).toEqual([]);
  expect(echt.expectNamen, "expect wird in t1b-hooks unter seinem eigenen Namen benutzt").toEqual([
    "expect",
  ]);

  // (2) Und der Blick sieht die Tarnungen wirklich — an synthetischen Proben gemessen, nicht
  //     behauptet. Der Rahmen ist eine vollständige, gültige Testdatei; nur der Körper wechselt.
  const rahmen = (koerper: string, einfuhr = 'import { expect, it } from "vitest";'): string => `
${einfuhr}
const OHNE_FARBE = new RegExp("x", "g");
const klartext = (s) => s.replace(OHNE_FARBE, "");
async function lauf() {
  return { code: 0, ausgabe: "" };
}
it("probe", async () => {
  const r = await lauf();
${koerper}
});
`;
  const formen = (koerper: string, einfuhr?: string): Form[] =>
    pruefeFarbfestigkeit(rahmen(koerper, einfuhr), "probe.test.ts").funde.map((f) => f.form);

  expect(formen("  expect(r.ausgabe).toMatch(/Test Files/);"), "offener Rohvergleich").toEqual([
    "direkt",
  ]);
  expect(
    formen("  const roh = r.ausgabe;\n  expect(roh).toMatch(/Test Files/);"),
    "Rohvergleich über einen lokalen Alias",
  ).toEqual(["alias"]);
  expect(
    formen(
      "  pruefe(r.ausgabe).toMatch(/Test Files/);",
      'import { expect as pruefe, it } from "vitest";',
    ),
    "Rohvergleich über ein unter neuem Namen importiertes expect",
  ).toEqual(["umbenannt"]);
  expect(
    formen("  const roh = r.ausgabe;\n  const auch = roh;\n  expect(auch).toMatch(/Test Files/);"),
    "Rohvergleich über zwei Zwischenvariablen",
  ).toEqual(["alias"]);
  // JOB 3579 R2 — DIE ZWEI FORMEN, DIE BEN AN DER FASSUNG VON RUNDE 1 GEMESSEN HAT und die sie
  // durchgelassen hat (Prüfbericht Runde 1, „Zusätzliche Gegenprobe A/B"): eine Zerlegung holt die
  // Ausgabe unter neuem Namen, und `expect` wird nicht beim Import, sondern erst im Rumpf
  // weitergereicht. Beide sind seitdem eigene Fälle hier — nicht nur ein Satz im Bericht.
  expect(
    formen("  const { ausgabe: roh } = r;\n  expect(roh).toMatch(/Test Files/);"),
    "Rohvergleich über eine Zerlegung mit neuem Namen",
  ).toEqual(["alias"]);
  expect(
    formen("  const { ausgabe } = r;\n  expect(ausgabe).toMatch(/Test Files/);"),
    "Rohvergleich über eine Zerlegung in Kurzschreibweise",
  ).toEqual(["alias"]);
  expect(
    formen("  const pruefe = expect;\n  pruefe(r.ausgabe).toMatch(/Test Files/);"),
    "Rohvergleich über ein im Rumpf weitergereichtes expect",
  ).toEqual(["umbenannt"]);
  expect(
    formen(
      '  const { expect: pruefe } = await import("vitest");\n  pruefe(r.ausgabe).toMatch(/x/);',
    ),
    "Rohvergleich über ein aus einer Zerlegung geholtes expect",
  ).toEqual(["umbenannt"]);
  expect(
    formen(
      "  const pruefe = expect;\n  const { ausgabe: roh } = r;\n  pruefe(roh).toMatch(/Test Files/);",
    ),
    "beide Tarnungen zugleich",
  ).toEqual(["umbenannt"]);

  // (3) Die saubere Fassung bleibt grün — auch über einen weitergereichten Entfärber.
  expect(formen("  expect(klartext(r.ausgabe)).toMatch(/Test Files/);"), "entfärbt").toEqual([]);
  expect(
    formen("  const rein = klartext(r.ausgabe);\n  expect(rein.match(/x/g)).toHaveLength(2);"),
    "entfärbt über eine Zwischenvariable",
  ).toEqual([]);
  expect(
    formen("  const k = klartext;\n  expect(k(r.ausgabe)).toMatch(/Test Files/);"),
    "entfärbt über einen weitergereichten Entfärber",
  ).toEqual([]);
  expect(
    formen("  const { ausgabe: roh } = r;\n  expect(klartext(roh)).toMatch(/Test Files/);"),
    "entfärbt nach einer Zerlegung",
  ).toEqual([]);
  expect(
    formen("  const pruefe = expect;\n  pruefe(klartext(r.ausgabe)).toMatch(/Test Files/);"),
    "entfärbt über ein weitergereichtes expect",
  ).toEqual([]);
  // Und eine Zerlegung, die gar nicht die Ausgabe holt, ist kein Fund — sonst wäre der schärfere
  // Blick nur eine Fehlalarmquelle. `const { code } = r` steht so in der echten Datei nebenan.
  expect(
    formen("  const { code } = r;\n  expect(code).toBe(0);"),
    "eine Zerlegung ohne die Ausgabe",
  ).toEqual([]);

  // (4) Ein Kommentar ersetzt keine Erwartung und erzeugt auch keine: weder rot noch grün.
  expect(
    formen('  // expect(r.ausgabe).toMatch(/Test Files/);\n  /* expect(r.ausgabe).toBe("x"); */'),
    "ein auskommentierter Rohvergleich ist kein Rohvergleich",
  ).toEqual([]);
  expect(
    formen('  // expect(r.ausgabe).toMatch(/Test Files/);\n  expect(r.ausgabe).toContain("x");'),
    "der Kommentar daneben verdeckt den echten Rohvergleich nicht",
  ).toEqual(["direkt"]);
  expect(
    pruefeFarbfestigkeit(
      rahmen(
        "  // expect(klartext(r.ausgabe)).toMatch(/x/);\n  expect(klartext(r.ausgabe)).toMatch(/x/);",
      ),
      "probe.test.ts",
    ).gedeckt,
    "ein auskommentierter sauberer Vergleich zählt nicht als Deckung",
  ).toBe(1);
});

// ------------------------------------------------------------------------------------------------
// F5d · Das Präfix ist der Probe vorbehalten — es kann in keinem ECHTEN Lauf entstehen.
// ------------------------------------------------------------------------------------------------
interface Etikett {
  readonly datei: string;
  readonly zeile: number;
  readonly etikett: string;
}

/**
 * Alle Beschriftungen, mit denen im Testbaum `schliesseChromium(…)` gerufen wird — aus dem AST.
 *
 * Erfasst werden Zeichenkettenliterale und Bezeichner, die in derselben Datei auf ein
 * Zeichenkettenliteral zurückführen. Was sich nicht auflösen lässt (Schleifenvariable, Parameter),
 * wird gezählt und in der Meldung genannt, statt stillschweigend als „in Ordnung" zu gelten.
 */
function etikettenImBestand(): { aufgeloest: Etikett[]; offen: string[] } {
  const aufgeloest: Etikett[] = [];
  const offen: string[] = [];
  const wurzel = join(REPO_WURZEL, "tests");
  const gehe = (verzeichnis: string): void => {
    for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
      const pfad = join(verzeichnis, eintrag.name);
      if (eintrag.isDirectory()) {
        if (eintrag.name !== "node_modules") {
          gehe(pfad);
        }
        continue;
      }
      if (!statSync(pfad).isFile() || !/\.(ts|tsx)$/.test(eintrag.name)) {
        continue;
      }
      const text = readFileSync(pfad, "utf8");
      if (!text.includes("schliesseChromium")) {
        continue;
      }
      const relativ = relative(REPO_WURZEL, pfad).split("\\").join("/");
      const ast = ts.createSourceFile(
        relativ,
        text,
        ts.ScriptTarget.Latest,
        true,
        eintrag.name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const konstanten = new Map<string, string>();
      const sammle = (n: ts.Node): void => {
        if (
          ts.isVariableDeclaration(n) &&
          ts.isIdentifier(n.name) &&
          n.initializer !== undefined &&
          ts.isStringLiteral(n.initializer)
        ) {
          konstanten.set(n.name.text, n.initializer.text);
        }
        ts.forEachChild(n, sammle);
      };
      ts.forEachChild(ast, sammle);
      const besuche = (n: ts.Node): void => {
        if (
          ts.isCallExpression(n) &&
          ts.isIdentifier(n.expression) &&
          n.expression.text === "schliesseChromium"
        ) {
          const arg = n.arguments[0];
          const zeile = ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1;
          const wert =
            arg !== undefined && ts.isStringLiteral(arg)
              ? arg.text
              : arg !== undefined && ts.isIdentifier(arg)
                ? konstanten.get(arg.text)
                : undefined;
          if (wert === undefined) {
            offen.push(`${relativ}:${zeile}`);
          } else {
            aufgeloest.push({ datei: relativ, zeile, etikett: wert });
          }
        }
        ts.forEachChild(n, besuche);
      };
      ts.forEachChild(ast, besuche);
    }
  };
  gehe(wurzel);
  return { aufgeloest, offen };
}

it("F5d · kein echter Abbauaufruf im Bestand beschriftet sich als Probe", () => {
  const { aufgeloest, offen } = etikettenImBestand();
  expect(
    aufgeloest.length,
    "keine einzige auflösbare Beschriftung gefunden — dieser Fall misst dann nichts",
  ).toBeGreaterThanOrEqual(6);
  // Die zwei Pfade, um die es 36 Jobs lang ging, sind darunter — sonst prüft der Fall die falsche Menge.
  for (const datei of DATEIEN) {
    expect(
      aufgeloest.map((e) => e.etikett),
      `${datei} beschriftet ihren eigenen Abbau nicht mehr selbst`,
    ).toContain(datei);
  }
  expect(
    aufgeloest
      .filter((e) => e.etikett.startsWith("PROBE"))
      .map((e) => `${e.datei}:${e.zeile} → ${e.etikett}`),
    `ein echter Aufruf beschriftet sich als Probe; nicht auflösbar waren: ${offen.join(", ") || "keine"}`,
  ).toEqual([]);
});
