import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import ts from "typescript";
import { afterAll, expect, it } from "vitest";

const PFAD = "tests/live-check-verdrahtung/hook-schluessel.test.tsx";
const WURZEL = resolve(".");
const TESTWURZEL = resolve("tests");
/** Diese Datei selbst — W8 schlägt in ihr den Aufräumweg nach, den er misst. */
const SELBST = "tests/live-check-haken-wettlauf/wartebauart.test.ts";

// ==================================================================================================
// JOB 3882 · WAS „HIER WIRD NIE MIT EINER ECHTEN UHR GEWARTET" HEISST — UND WIE WEIT ES REICHT.
// ==================================================================================================
//
// Bewusst enger Vertrag für diese eine Testbühne: echte Timer gehören hier überhaupt nicht hinein.
// Die Entprellung wird virtuell ausgelöst, der Abschluss mit `vi.waitFor` beobachtet. Genau EINE
// feste Wartefrist hat JOB 3579 einen lastabhängigen roten Fremdtest und eine ganze Runde gekostet;
// JOB 3592 hat sie ersatzlos entfernt und diesen Wächter dagegen gestellt.
//
// AST statt Entfärbungsregex: Kommentar, Zeichenkette, Template und Regex sind keine Aufrufe (W3,
// W4). Bereits die ERWÄHNUNG eines Wartenamens gilt, damit Alias und Zerlegung nicht durchrutschen.
//
// ZWEI ERKENNUNGSARTEN, EIN BAUMGANG (`gehe`) — Prüfer BEN, JOB 3592 R1, Prüfpunkt 6 (b):
//
//   „Name"          setTimeout · setInterval · setImmediate · nextTick (damit `process.nextTick`)
//                   · waitForTimeout · sleep — direkt, über `globalThis`, als Elementzugriff mit
//                   Zeichenkette, als Alias, als Zerlegung oder als Einfuhr unter neuem Namen.
//   „Warteschleife" eine Schleife (`while`, `do`, `for`, `for…of`, `for…in`), deren Bedingung,
//                   Fortschaltteil oder Rumpf eine Uhr abfragt. Diese Bauart hat GAR KEINEN der
//                   Namen und ist mit einer Namensliste grundsätzlich nicht zu fassen — sie ist der
//                   Grund für die zweite Art. Die Uhr wird am Namen `now` erkannt (`Date.now`,
//                   `performance.now`, auch über `globalThis`, Elementzugriff oder Zerlegung):
//                   bewusst weit, denn ein zu weiter Uhrbegriff macht höchstens eine Messschleife
//                   rot, ein zu enger lässt das Warten durch. Der ANFANGSTEIL eines `for` zählt
//                   nicht mit — er läuft genau einmal, ist also Messung und kein Warten, und eine
//                   Schleife, die die Uhr nur dort liest, kommt nie voran (W5).
//
// Welche der beiden Arten angeschlagen hat, steht in jeder Meldung vorn.
//
// REICHWEITE: `PFAD` UND jede Datei, die von dort über einen RELATIVEN Spezifizierer erreichbar ist
// (Einfuhr, Ausfuhr, Typ-Einfuhr `typeof import(…)`, `import()`, `require()`,
// `vi.mock`/`vi.importActual`), transitiv, innerhalb von `tests/`; Zyklen sind abgefangen. Der
// Spezifizierer zählt in JEDER Zeichenkettenform — in Anführungszeichen wie in Backticks; W7 misst
// beide paarweise an echten Dateien, denn in R1 verschwand die Backtick-Form still und der Helfer
// blieb ungelesen. Wandert die Frist in einen Helfer, fliegt sie damit auf — vor JOB 3882 las W1 nur
// `PFAD` selbst. ROT statt stillem Übergehen machen W1: ein Spezifizierer, der nach `tests/` zeigt
// und dort nicht auflösbar ist; ein berechneter Pfad (`./${…}`), dessen bekannter Anfang nach
// `tests/` zeigt; und eine Erhebung von NULL Dateien — „nichts gelesen" ist keine Entwarnung,
// sondern ein blinder Wächter.
//
// KANONISCH, NICHT LEXIKALISCH: ein Spezifizierer ist ein Name, kein Ort. Jeder aufgelöste Baustein
// wird vor Grenzprüfung und Einreihung auf sein wirkliches Ziel zurückgeführt (`realpath`) — sonst
// holt ein symbolischer Verweis namens `./link` eine Datei von ausserhalb herein und ihr Inhalt
// zählt als Befund dieser Bühne (BEN, JOB 3882 R2). Führt das Ziel hinaus, wird es mit seinem
// wirklichen Weg als „ausserhalb" gemeldet und NICHT gelesen; führt es hinein, steht es unter seinem
// wirklichen Namen in der Erhebung, und zwei Wege auf dieselbe Datei sind eine Datei (W7).
//
// EINZIGE GRENZE: Warten ohne einen dieser Namen und ohne Uhr in einer Schleife; Bausteine, die nur nicht-relativ, über einen gänzlich berechneten Spezifizierer oder über einen aus `tests/` hinausführenden Wortlaut erreichbar sind.

/** Die Namen, deren blosse Erwähnung in dieser Bühne verboten ist. */
const WARTENAMEN = new Set([
  "setTimeout",
  "setInterval",
  "setImmediate",
  "nextTick",
  "waitForTimeout",
  "sleep",
]);

/** Woran eine Uhrabfrage erkannt wird — nur INNERHALB einer Schleife ein Befund. */
const UHRNAMEN = new Set(["now"]);

/** Aufrufe, deren erstes Zeichenkettenargument ein Modul benennt. */
const MODULRUFER = new Set(["require", "mock", "doMock", "unmock", "importActual", "importMock"]);

/** Wie ein Spezifizierer zu einer Datei wird. Was hier nicht trifft, wird GEMELDET, nicht geraten. */
const KANDIDATEN = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

/**
 * Liegt `weg` in `grenze`? BEIDE Seiten müssen kanonisch sein, sonst geht der Vergleich daneben:
 * `./link` innerhalb der Bühne kann ein symbolischer Verweis nach draussen sein (BEN, R2).
 */
function innerhalbGrenze(weg: string, grenze: string): boolean {
  return weg === grenze || weg.startsWith(`${grenze}${sep}`);
}

type Art = "Name" | "Warteschleife";

interface Wartestelle {
  readonly art: Art;
  /** Der Wortlaut: bei „Name" die Referenz, bei „Warteschleife" der Schleifenkopf samt Uhr. */
  readonly text: string;
  readonly zeile: number;
}

interface Spezifizierer {
  /** Der Wortlaut, wie er in der Meldung stehen soll: aufgelöst, oder der Quelltext der Rechnung. */
  readonly text: string;
  /** Der statisch bekannte Anfang — nur daran entscheidet sich „relativ" und die Grenze. */
  readonly anfang: string;
  /** Konstant heisst auflösbar. Ein `${…}` im Pfad ist es nicht und wird gemeldet, nicht geraten. */
  readonly konstant: boolean;
}

interface Quellbefund {
  readonly stellen: readonly Wartestelle[];
  readonly spezifizierer: readonly Spezifizierer[];
}

/** Der Name, unter dem dieser Knoten etwas anspricht: `sleep`, `x["sleep"]`, `` x[`sleep`] ``. */
function referenzname(node: ts.Node): string | undefined {
  if (ts.isIdentifier(node)) return node.text;
  // `isStringLiteralLike` statt `isStringLiteral`: Backticks sind dieselbe Zeichenkette (BEN R1).
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
    return node.argumentExpression.text;
  }
  return undefined;
}

/** `now` allein sagt nichts — `Date.now` sagt alles. Darum die ganze Zugriffskette als Wortlaut. */
function volleReferenz(node: ts.Node, datei: ts.SourceFile): string {
  const eltern = node.parent as ts.Node | undefined;
  if (eltern !== undefined && ts.isPropertyAccessExpression(eltern) && eltern.name === node) {
    return eltern.getText(datei);
  }
  return node.getText(datei);
}

/** Die erste Zeile eines Knotens — für eine Schleife ist das ihr Kopf. */
function kopfzeile(node: ts.Node, datei: ts.SourceFile): string {
  const erste = (node.getText(datei).split("\n")[0] ?? "").trim();
  return erste.length > 80 ? `${erste.slice(0, 79)}…` : erste;
}

/** Die Stelle, an der dieser Knoten ein Modul benennt — der Knoten selbst, noch ungedeutet. */
function modulstelle(node: ts.Node): ts.Node | undefined {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return node.moduleSpecifier;
  // `typeof import("./helfer")`: eine Typ-Einfuhr ist derselbe Weg zu derselben Datei.
  if (ts.isImportTypeNode(node)) {
    return ts.isLiteralTypeNode(node.argument) ? node.argument.literal : node.argument;
  }
  if (!ts.isCallExpression(node)) return undefined;
  const erstes = node.arguments[0];
  if (erstes === undefined) return undefined;
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) return erstes;
  const gerufen = ts.isPropertyAccessExpression(node.expression)
    ? node.expression.name.text
    : ts.isIdentifier(node.expression)
      ? node.expression.text
      : undefined;
  return gerufen !== undefined && MODULRUFER.has(gerufen) ? erstes : undefined;
}

/**
 * Das Modul, das dieser Knoten hereinholt — oder nichts.
 *
 * Backticks sind hier KEINE Verzierung: `import(`./helfer`)` ist ein
 * `NoSubstitutionTemplateLiteral` und war vor JOB 3882 R2 unsichtbar, der Helfer damit ungelesen
 * (BEN, R1). Ein Template MIT Einsetzung ist nicht auflösbar — dann zählt der bekannte Anfang für
 * die Grenzfrage, und der Wortlaut geht als „berechnet" in die Meldung, statt still zu verschwinden.
 */
function modulspezifizierer(node: ts.Node, datei: ts.SourceFile): Spezifizierer | undefined {
  const stelle = modulstelle(node);
  if (stelle === undefined) return undefined;
  if (ts.isStringLiteralLike(stelle)) {
    return { text: stelle.text, anfang: stelle.text, konstant: true };
  }
  if (ts.isTemplateExpression(stelle)) {
    return { text: stelle.getText(datei), anfang: stelle.head.text, konstant: false };
  }
  return undefined;
}

/**
 * Ein Baumgang, drei Erhebungen: Wartenamen, Uhr-in-Schleife und die Modulspezifizierer.
 *
 * Die Schleifenzugehörigkeit wird MITGEFÜHRT (`schleife`), nicht in einem zweiten Lauf nachgeholt —
 * ein paralleler Prüfweg liefe irgendwann auseinander (Lehren JOB 3830 R1, 3793 R1, 3809 R1).
 */
function lieseQuelle(code: string, dateiname: string): Quellbefund {
  const datei = ts.createSourceFile(
    dateiname,
    code,
    ts.ScriptTarget.Latest,
    true,
    dateiname.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.TSX,
  );
  const stellen: Wartestelle[] = [];
  const spezifizierer: Spezifizierer[] = [];
  const zeile = (n: ts.Node): number =>
    datei.getLineAndCharacterOfPosition(n.getStart(datei)).line + 1;

  const gehe = (node: ts.Node, schleife: ts.Node | undefined): void => {
    const name = referenzname(node);
    if (name !== undefined && WARTENAMEN.has(name)) {
      stellen.push({ art: "Name", text: volleReferenz(node, datei), zeile: zeile(node) });
    } else if (name !== undefined && UHRNAMEN.has(name) && schleife !== undefined) {
      stellen.push({
        art: "Warteschleife",
        text: `${kopfzeile(schleife, datei)} · Uhr: ${volleReferenz(node, datei)}`,
        zeile: zeile(schleife),
      });
    }
    const spez = modulspezifizierer(node, datei);
    if (spez !== undefined) spezifizierer.push(spez);

    if (ts.isForStatement(node)) {
      // Der Anfangsteil läuft genau einmal und wartet deshalb nicht (Kopfkommentar, W5).
      if (node.initializer !== undefined) gehe(node.initializer, schleife);
      for (const teil of [node.condition, node.incrementor, node.statement]) {
        if (teil !== undefined) gehe(teil, node);
      }
      return;
    }
    const innen =
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isForInStatement(node)
        ? node
        : schleife;
    ts.forEachChild(node, (kind) => gehe(kind, innen));
  };
  gehe(datei, undefined);
  return { stellen, spezifizierer };
}

/** Der Wortlaut aller Fundstellen einer Quelle — für die Proben W2 bis W6. */
function wartestellen(code: string): readonly Wartestelle[] {
  return lieseQuelle(code, "probe.tsx").stellen;
}

/** Nur die Wortlaute, in der Form, in der W3 und W4 sie seit JOB 3592 vergleichen. */
function texte(code: string): string[] {
  return wartestellen(code).map((s) => s.text);
}

interface Erhebung {
  /** Was tatsächlich gelesen wurde, in Leserichtung. Leer heisst rot, nicht „in Ordnung". */
  readonly dateien: readonly string[];
  /** Je Fundstelle eine Zeile: Datei, Zeile, Art, Wortlaut. */
  readonly stellen: readonly string[];
  /** Zeigt nach `tests/`, ist dort aber nicht auffindbar — der Wächter wäre sonst blind. */
  readonly unaufloesbar: readonly string[];
  /** Relativ, aber ausserhalb von `tests/`: ausdrücklich nicht Teil dieses Vertrags. */
  readonly ausserhalb: readonly string[];
  /** Alle gefundenen relativen Spezifizierer, und wie viele davon nach `tests/` zeigen. */
  readonly relativ: number;
  readonly innerhalb: number;
}

/**
 * `start` und alles, was von dort relativ innerhalb `grenze` erreichbar ist — transitiv.
 *
 * `grenze` ist im Vertrag immer `tests/`; W7 setzt eine Wegwerf-Bühne an diese Stelle und misst die
 * Erhebung damit an ECHTEN Dateien statt an Quelltextstücken — ohne dafür `tests/` zu beschreiben.
 */
function erhebe(start: string, grenze: string = TESTWURZEL): Erhebung {
  const dateien: string[] = [];
  const stellen: string[] = [];
  const unaufloesbar: string[] = [];
  const ausserhalb: string[] = [];
  const gesehen = new Set<string>();
  // Kanonisch von Anfang an: Grenze, Anzeigewurzel und jeder Weg im Umlauf — nur so vergleichbar.
  const grenzeEcht = realpathSync(grenze);
  const anzeigewurzel = realpathSync(grenze === TESTWURZEL ? WURZEL : grenze);
  const offen = [realpathSync(resolve(start))];
  let relativ = 0;
  let innerhalb = 0;

  for (let absolut = offen.shift(); absolut !== undefined; absolut = offen.shift()) {
    if (gesehen.has(absolut)) continue;
    gesehen.add(absolut);
    const kurz = relative(anzeigewurzel, absolut).split(sep).join("/");
    dateien.push(kurz);
    const befund = lieseQuelle(readFileSync(absolut, "utf8"), absolut);
    for (const stelle of befund.stellen) {
      stellen.push(`${kurz}:${stelle.zeile} · ${stelle.art}: ${stelle.text}`);
    }
    for (const spez of befund.spezifizierer) {
      if (!spez.anfang.startsWith("./") && !spez.anfang.startsWith("../")) continue;
      relativ += 1;
      // 1. Der Wortlaut: beim berechneten Pfad entscheidet der bekannte Anfang — mehr ist nicht da.
      const rohziel = resolve(dirname(absolut), spez.konstant ? spez.text : spez.anfang);
      if (!innerhalbGrenze(rohziel, grenzeEcht)) {
        ausserhalb.push(`${kurz} → ${spez.text}`);
        continue;
      }
      if (!spez.konstant) {
        innerhalb += 1;
        unaufloesbar.push(`${kurz} → ${spez.text} (berechnet)`);
        continue;
      }
      const treffer = KANDIDATEN.map((endung) => `${rohziel}${endung}`).find(
        (weg) => existsSync(weg) && statSync(weg).isFile(),
      );
      if (treffer === undefined) {
        innerhalb += 1;
        unaufloesbar.push(`${kurz} → ${spez.text}`);
        continue;
      }
      // 2. Das Ziel: der zusammengesetzte Pfad sagt nur, wie der Baustein HEISST. Wohin er zeigt,
      //    sagt erst `realpath` — ein Verweis führt sonst mitten aus der Grenze heraus (BEN, R2).
      const echt = realpathSync(treffer);
      if (!innerhalbGrenze(echt, grenzeEcht)) {
        ausserhalb.push(`${kurz} → ${spez.text} → ${echt} (Verweisziel ausserhalb)`);
        continue;
      }
      innerhalb += 1;
      offen.push(echt);
    }
  }
  return { dateien, stellen, unaufloesbar, ausserhalb, relativ, innerhalb };
}

it("W1 · keine echte Wartefrist — in der Bühne und in allem, was sie relativ erreicht", () => {
  const erhebung = erhebe(PFAD);
  console.info(
    `WARTEBAUART: ${erhebung.dateien.length} Datei(en) gelesen [${erhebung.dateien.join(", ")}]; ` +
      `relative Spezifizierer ${erhebung.relativ}, davon nach tests/ ${erhebung.innerhalb}, ` +
      `ausserhalb ${erhebung.ausserhalb.length} [${erhebung.ausserhalb.join(", ")}], ` +
      `unaufloesbar ${erhebung.unaufloesbar.length}`,
  );
  // Reihenfolge mit Absicht: erst „ich konnte lesen", dann „ich habe nichts gefunden" (§9).
  expect(erhebung.unaufloesbar).toEqual([]);
  expect(erhebung.dateien.length).toBeGreaterThan(0);
  expect(erhebung.stellen).toEqual([]);
});

it.each([
  "await new Promise(r => setTimeout(r, DEBOUNCE + 20));",
  "await new Promise(r => globalThis.setTimeout(r, 25));",
  'await new Promise(r => globalThis["setTimeout"](r, 25));',
  "await new Promise(r => globalThis[`setTimeout`](r, 25));",
  "const pause = setTimeout; await new Promise(r => pause(r, 25));",
  "const { setTimeout: pause } = globalThis; await new Promise(r => pause(r, 25));",
  'import { setTimeout as pause } from "node:timers/promises"; await pause(25);',
  "await page.waitForTimeout(25);",
  "await new Promise(r => setImmediate(r));",
  "await new Promise(r => globalThis.setImmediate(r));",
  'await new Promise(r => globalThis["setImmediate"](r));',
  "const gleich = setImmediate; await new Promise(r => gleich(r));",
  "const { setImmediate: gleich } = globalThis; await new Promise(r => gleich(r));",
  'import { setImmediate as gleich } from "node:timers/promises"; await gleich();',
  "await new Promise(r => process.nextTick(r));",
  "await new Promise(r => globalThis.process.nextTick(r));",
  'await new Promise(r => process["nextTick"](r));',
  "await new Promise(r => process[`nextTick`](r));",
  "const tick = process.nextTick; await new Promise(r => tick(r));",
  "const { nextTick } = process; await new Promise(r => nextTick(r));",
  'import { nextTick } from "node:process"; await new Promise(r => nextTick(r));',
])("W2 · Gegenprobe: ausführbare Frist wird erkannt: %s", (code) => {
  const stellen = wartestellen(code);
  expect(stellen.length).toBeGreaterThan(0);
  expect(stellen.map((s) => s.art)).toContain("Name");
});

it.each([
  "// await new Promise(r => setTimeout(r, 25));",
  "/* setTimeout(r, 25); */",
  'const beispiel = "setTimeout(r, 25)";',
  "const beispiel = `setTimeout(r, 25)`;",
  "void /setTimeout(r, 25)/;",
  "// await new Promise(r => setImmediate(r));",
  "/* process.nextTick(r); */",
  'const beispiel = "setImmediate(r)";',
  "const beispiel = `process.nextTick(r)`;",
  "void /setImmediate(r)/;",
  "void /process.nextTick(r)/;",
  "// const start = Date.now(); while (Date.now() - start < 25) {}",
  "/* while (performance.now() - start < 25) {} */",
  'const beispiel = "while (Date.now() - start < 25) {}";',
  "const beispiel = `while (performance.now() - start < 25) {}`;",
  "void /while (Date.now() - start < 25)/;",
])("W3 · Text kann den Wächter weder rot noch grün machen: %s", (text) => {
  expect(texte(text)).toEqual([]);
  expect(texte(`${text}\nawait new Promise(r => setTimeout(r, 25));`)).toEqual(["setTimeout"]);
});

it("W4 · ausführbarer Template-Ausdruck bleibt Code", () => {
  expect(texte("const text = `Text ${setTimeout(f, 25)}`;")).toEqual(["setTimeout"]);
});

it.each([
  // Die Gegenrichtung: ohne sie verbietet der Wächter genau die Bauart, die JOB 3592 gebracht hat.
  [
    "Warteweg von JOB 3592",
    "await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE); });",
  ],
  [
    "Beobachten statt Warten",
    "await vi.waitFor(() => expect(lage()).toBe('done/new'), { timeout: 5000 });",
  ],
  [
    "Testuhr benennt Timer als Text",
    'vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });',
  ],
  ["Schleife ohne Uhr", "let i = 0; while (i < 3) { i += 1; } void i;"],
  ["for…of ohne Uhr", "let s = 0; for (const x of [1, 2, 3]) { s += x; } void s;"],
  ["Uhr ausserhalb jeder Schleife", "const start = Date.now(); void (Date.now() - start);"],
  [
    "Uhr nur im Anfangsteil eines for",
    "let s = 0; for (let start = Date.now(); s < 3; s += 1) { void start; } void s;",
  ],
])("W5 · Gegenrichtung: der Wächter rötet nicht einfach alles — %s", (_titel, code) => {
  expect(texte(code)).toEqual([]);
});

it.each([
  ["while mit Date.now", "const start = Date.now(); while (Date.now() - start < 25) {}"],
  [
    "while mit performance.now",
    "const start = performance.now(); while (performance.now() - start < 25) {}",
  ],
  ["do…while", "const start = Date.now(); do {} while (Date.now() - start < 25);"],
  [
    "for ohne Bedingung, Uhr im Rumpf",
    "for (let start = Date.now(); ; ) { if (Date.now() - start > 25) break; }",
  ],
  [
    "while (true) mit Ausstieg an der Uhr",
    "const start = Date.now(); while (true) { if (performance.now() - start > 25) break; }",
  ],
  [
    "Uhr als Elementzugriff",
    'const start = Date.now(); while (globalThis["performance"]["now"]() - start < 25) {}',
  ],
  [
    "Uhr als Elementzugriff mit Backticks",
    "const start = Date.now(); while (globalThis[`performance`][`now`]() - start < 25) {}",
  ],
  ["zerlegte Uhr", "const { now } = Date; const start = now(); while (now() - start < 25) {}"],
  [
    "for…of mit Uhr im Rumpf",
    "const start = Date.now(); for (const x of [1]) { void x; if (Date.now() - start > 25) break; }",
  ],
])("W6 · Gegenprobe: Warteschleife ohne jeden Wartenamen wird erkannt — %s", (_titel, code) => {
  const stellen = wartestellen(code);
  expect(stellen.map((s) => s.art)).toEqual(["Warteschleife"]);
  // Die Meldung nennt die SCHLEIFE, nicht einen Namen — sonst wäre der Befund nicht auffindbar.
  expect(stellen[0]?.text).toMatch(/^(while|do|for)\b/);
});

// ==================================================================================================
// W7 · DIE ERHEBUNG SELBST, AN ECHTEN DATEIEN — Prüfer BEN, JOB 3882 R1, Korrekturpflicht 2.
// ==================================================================================================
//
// W2 bis W6 messen den Baumgang an Quelltextstücken. Die REICHWEITE misst bis hierher nur W1, und W1
// kann nur finden, was die echte Bühne heute enthält: R1 fand deshalb die Backtick-Lücke nicht — eine
// dynamische Einfuhr mit Backticks verschwand still, der Helfer mit Frist blieb ungelesen, W1 grün.
// Darum liegt hier eine Wegwerf-Bühne aus ECHTEN Dateien im Temp-Verzeichnis, an der die Erhebung
// dauerhaft kalibriert ist: Kette, Zyklus, fehlendes Ziel, Grenze, Verweis — jede Schreibweise PAARWEISE
// in Anführungszeichen und in Backticks. `tests/` wird dafür nie beschrieben.

const buehnen: string[] = [];
afterAll(() => {
  for (const weg of buehnen) rmSync(weg, { recursive: true, force: true });
});

/** Eine Wegwerf-Bühne aus echten Dateien; ihre Wurzel tritt an die Stelle von `tests/`. */
function buehne(dateien: Readonly<Record<string, string>>): string {
  const wurzel = realpathSync(mkdtempSync(join(tmpdir(), "wartebauart-")));
  buehnen.push(wurzel);
  for (const [name, inhalt] of Object.entries(dateien)) {
    const ziel = join(wurzel, name);
    mkdirSync(dirname(ziel), { recursive: true });
    writeFileSync(ziel, inhalt, "utf8");
  }
  return wurzel;
}

/** Der Helfer, in den eine Frist abwandern würde — genau der Fall aus R1. */
const HELFER = "export const pause = () => new Promise((r) => setTimeout(r, 25));\n";

/**
 * Jede Schreibweise, mit der diese Bühne ein Modul hereinholt — je Ruf einmal in Anführungszeichen
 * und einmal in Backticks. Statische Einfuhr, Ausfuhr und Typ-Einfuhr kennen keine Backticks
 * (Syntaxfehler), sie stehen deshalb allein.
 */
const RUFE: readonly (readonly [string, string])[] = [
  ["statische Einfuhr", "import './ZIEL';"],
  ["Ausfuhr", "export * from './ZIEL';"],
  ["Typ-Einfuhr", "export type X = typeof import('./ZIEL');"],
  ["dynamische Einfuhr", "void import('./ZIEL');"],
  ["dynamische Einfuhr · Backticks", "void import(`./ZIEL`);"],
  ["require", "void require('./ZIEL');"],
  ["require · Backticks", "void require(`./ZIEL`);"],
  ["vi.mock", "vi.mock('./ZIEL', () => ({}));"],
  ["vi.mock · Backticks", "vi.mock(`./ZIEL`, () => ({}));"],
  ["vi.importActual", "void vi.importActual('./ZIEL');"],
  ["vi.importActual · Backticks", "void vi.importActual(`./ZIEL`);"],
];

it.each(RUFE)(
  "W7 · der Helfer mit Frist wird über jede Schreibweise gelesen — %s",
  (_titel, ruf) => {
    const wurzel = buehne({
      "start.test.ts": `${ruf.replace("ZIEL", "helfer")}\n`,
      "helfer.ts": HELFER,
    });
    const erhebung = erhebe(join(wurzel, "start.test.ts"), wurzel);
    expect(erhebung.dateien).toEqual(["start.test.ts", "helfer.ts"]);
    expect(erhebung.stellen).toEqual(["helfer.ts:1 · Name: setTimeout"]);
    expect(erhebung.unaufloesbar).toEqual([]);
  },
);

it.each(RUFE)("W7 · fehlendes Ziel wird mit Spezifizierer gemeldet — %s", (_titel, ruf) => {
  const wurzel = buehne({ "start.test.ts": `${ruf.replace("ZIEL", "fehlt")}\n` });
  const erhebung = erhebe(join(wurzel, "start.test.ts"), wurzel);
  expect(erhebung.unaufloesbar).toEqual(["start.test.ts → ./fehlt"]);
  expect(erhebung.dateien).toEqual(["start.test.ts"]);
});

it("W7 · transitive Kette mit Zyklus: jede Datei einmal, der Fund im letzten Glied", () => {
  const wurzel = buehne({
    "start.test.ts": "import './a';\n",
    "a.ts": "void import(`./helfer`);\n",
    "helfer.ts": `import './a';\n${HELFER}`,
  });
  const erhebung = erhebe(join(wurzel, "start.test.ts"), wurzel);
  expect(erhebung.dateien).toEqual(["start.test.ts", "a.ts", "helfer.ts"]);
  expect(erhebung.stellen).toEqual(["helfer.ts:2 · Name: setTimeout"]);
  expect(erhebung.unaufloesbar).toEqual([]);
});

it("W7 · ein berechneter Spezifizierer wird gemeldet, nicht still übersprungen", () => {
  const wurzel = buehne({
    "start.test.ts": "const n = 'helfer';\nvoid import(`./${n}`);\n",
    "helfer.ts": HELFER,
  });
  const erhebung = erhebe(join(wurzel, "start.test.ts"), wurzel);
  // Der Wortlaut bleibt stehen: ein weggelassener Teil wäre ein erfundener Pfad.
  expect(erhebung.unaufloesbar).toEqual(["start.test.ts → `./${n}` (berechnet)"]);
  expect(erhebung.innerhalb).toBe(1);
});

it("W7 · ein Ordner wird über seine index-Datei gelesen", () => {
  const wurzel = buehne({ "start.test.ts": "import './unter';\n", "unter/index.ts": HELFER });
  const erhebung = erhebe(join(wurzel, "start.test.ts"), wurzel);
  expect(erhebung.dateien).toEqual(["start.test.ts", "unter/index.ts"]);
  expect(erhebung.stellen).toEqual(["unter/index.ts:1 · Name: setTimeout"]);
});

it("W7 · relativ, aber jenseits der Grenze: gemeldet als ausserhalb, nicht gelesen, nicht rot", () => {
  const wurzel = buehne({ "innen/start.test.ts": "import '../../fremd';\n" });
  const erhebung = erhebe(join(wurzel, "innen/start.test.ts"), wurzel);
  expect(erhebung.ausserhalb).toEqual(["innen/start.test.ts → ../../fremd"]);
  expect(erhebung.unaufloesbar).toEqual([]);
  expect([erhebung.relativ, erhebung.innerhalb]).toEqual([1, 0]);
});

// --------------------------------------------------------------------------------------------------
// Der Verweis-Ausbruch — Prüfer BEN, JOB 3882 R2, Korrekturpflicht 1 und 2.
//
// Ein Spezifizierer ist ein NAME, kein Ort. `./link` sieht innerhalb der Grenze aus und kann über
// einen symbolischen Verweis auf eine Datei ausserhalb zeigen; der lexikalisch zusammengesetzte Pfad
// merkt davon nichts. BEN hat den Wächter genau so dazu gebracht, eine fremde Timerdatei zu lesen.
// Darum wird jeder aufgelöste Kandidat vor Grenzprüfung und Einreihung kanonisiert.
// --------------------------------------------------------------------------------------------------

it("W7 · ein Verweis in der Bühne auf eine Datei ausserhalb wird gemeldet, nicht gelesen", () => {
  const fremd = buehne({ "timer.ts": HELFER });
  const wurzel = buehne({ "start.test.ts": "import './link';\n" });
  symlinkSync(join(fremd, "timer.ts"), join(wurzel, "link.ts"));
  const erhebung = erhebe(join(wurzel, "start.test.ts"), wurzel);
  expect(erhebung.dateien).toEqual(["start.test.ts"]);
  // Der Inhalt der fremden Datei taucht NIRGENDS auf — weder als Fund noch als gelesene Datei.
  expect(erhebung.stellen).toEqual([]);
  expect(erhebung.ausserhalb).toEqual([
    `start.test.ts → ./link → ${join(fremd, "timer.ts")} (Verweisziel ausserhalb)`,
  ]);
  expect(erhebung.unaufloesbar).toEqual([]);
  expect([erhebung.relativ, erhebung.innerhalb]).toEqual([1, 0]);
});

it("W7 · auch ein verwiesener ORDNER führt nicht über die Grenze", () => {
  const fremd = buehne({ "index.ts": HELFER });
  const wurzel = buehne({ "start.test.ts": "import './unter';\n" });
  symlinkSync(fremd, join(wurzel, "unter"));
  const erhebung = erhebe(join(wurzel, "start.test.ts"), wurzel);
  expect(erhebung.dateien).toEqual(["start.test.ts"]);
  expect(erhebung.stellen).toEqual([]);
  expect(erhebung.ausserhalb).toEqual([
    `start.test.ts → ./unter → ${join(fremd, "index.ts")} (Verweisziel ausserhalb)`,
  ]);
});

it("W7 · Gegenrichtung: ein Verweis INNERHALB der Grenze wird gelesen, unter seinem echten Namen", () => {
  const wurzel = buehne({ "start.test.ts": "import './link';\n", "echt/helfer.ts": HELFER });
  symlinkSync(join(wurzel, "echt/helfer.ts"), join(wurzel, "link.ts"));
  const erhebung = erhebe(join(wurzel, "start.test.ts"), wurzel);
  // Gemeldet wird die Datei, die WIRKLICH gelesen wurde — „link.ts" gibt es als Inhalt nicht.
  expect(erhebung.dateien).toEqual(["start.test.ts", "echt/helfer.ts"]);
  expect(erhebung.stellen).toEqual(["echt/helfer.ts:1 · Name: setTimeout"]);
  expect(erhebung.ausserhalb).toEqual([]);
  expect([erhebung.relativ, erhebung.innerhalb]).toEqual([1, 1]);
});

it("W7 · zwei Wege auf dieselbe Datei sind eine Datei, nicht zwei", () => {
  const wurzel = buehne({
    "start.test.ts": "import './helfer';\nimport './link';\n",
    "helfer.ts": HELFER,
  });
  symlinkSync(join(wurzel, "helfer.ts"), join(wurzel, "link.ts"));
  const erhebung = erhebe(join(wurzel, "start.test.ts"), wurzel);
  expect(erhebung.dateien).toEqual(["start.test.ts", "helfer.ts"]);
  expect(erhebung.stellen).toEqual(["helfer.ts:1 · Name: setTimeout"]);
});

it("W7 · nicht-relative Spezifizierer gehören nicht zu diesem Vertrag", () => {
  const wurzel = buehne({ "start.test.ts": "import 'vitest';\nvoid require('node:fs');\n" });
  const erhebung = erhebe(join(wurzel, "start.test.ts"), wurzel);
  expect(erhebung.dateien).toEqual(["start.test.ts"]);
  expect([erhebung.relativ, erhebung.unaufloesbar.length, erhebung.ausserhalb.length]).toEqual([
    0, 0, 0,
  ]);
});

// --------------------------------------------------------------------------------------------------
// Die zwei ungemessenen Ränder der Kanonisierung — Prüfer BEN, JOB 3882 R3, Prüfpunkt 6 und
// PROMPTVERBESSERUNG: „Ergänze die Grenzkalibrierung um einen gebrochenen Symlink und eine symbolisch
// verlinkte Testwurzel; prüfe Fehlermeldung beziehungsweise unveränderte Erhebung."
//
// (a) DER TOTE VERWEIS ist ein anderer Zustand als „keine Datei da" (`:518`): dort findet der
//     Kandidatenschritt (`:304-306`) überhaupt keinen Verzeichniseintrag, hier einen, dessen Ziel
//     fehlt. Entschieden wird er richtig, weil `existsSync` dem Verweis FOLGT und für ein fehlendes
//     Ziel `false` liefert — der Spezifizierer landet damit in `unaufloesbar` und macht W1 rot.
//     Zählte der tote Eintrag als Treffer, stürbe `realpathSync` (`:314`) mit `ENOENT` und nähme die
//     ganze Erhebung mit; ein geworfener Fehler ist hier ausdrücklich KEIN zulässiger Ausgang (§9).
//     Das gilt auch, wenn der Wortlaut des Verweisziels nach draussen zeigt: die Grenzprüfung `:295`
//     sieht nur den lexikalischen Namen `./link`, und `ausserhalb` erreicht nur ein EXISTIERENDES
//     Ziel. Beide Fälle waren bis hierher nur ohne Verweis gemessen.
//
// (b) DIE VERLINKTE WURZEL deckt die drei `realpathSync` in `:275-277`, die bis hierher LEERLÄUFE
//     waren: `buehne` (`:472`) kanonisiert ihre Wurzel selbst, jede Bühne kam also bereits kanonisch
//     bei `erhebe` an — wer die drei Zeilen entfernte, blieb grün. Der Fall unten ruft `erhebe`
//     deshalb ein zweites Mal über einen Verweis AUF die Wurzel, ohne vorheriges `realpath`: genau so
//     kommt ein Prüfplatz mit verlinktem Arbeitsverzeichnis an (`/tmp` → `/private/tmp`,
//     Container-Bind-Mount). Er muss zeichengleich dasselbe urteilen wie die kanonische Wurzel.
// --------------------------------------------------------------------------------------------------

it("W7 · ein toter Verweis innerhalb der Bühne wird gemeldet, nicht verschwiegen", () => {
  const wurzel = buehne({ "start.test.ts": "import './link';\n" });
  // `link.ts` gibt es als Verzeichniseintrag, `gibt-es-nicht.ts` nicht.
  symlinkSync(join(wurzel, "gibt-es-nicht.ts"), join(wurzel, "link.ts"));
  const erhebung = erhebe(join(wurzel, "start.test.ts"), wurzel);
  expect(erhebung.unaufloesbar).toEqual(["start.test.ts → ./link"]);
  expect(erhebung.dateien).toEqual(["start.test.ts"]);
  expect(erhebung.stellen).toEqual([]);
  expect(erhebung.ausserhalb).toEqual([]);
  expect([erhebung.relativ, erhebung.innerhalb]).toEqual([1, 1]);
});

it("W7 · ein toter Verweis nach draussen bleibt unaufloesbar, nicht ausserhalb", () => {
  const fremd = buehne({ "timer.ts": HELFER });
  const wurzel = buehne({ "start.test.ts": "import './link';\n" });
  // Das Ziel LÄGE ausserhalb — es existiert aber nicht, also entscheidet der Kandidatenschritt.
  symlinkSync(join(fremd, "gibt-es-nicht.ts"), join(wurzel, "link.ts"));
  const erhebung = erhebe(join(wurzel, "start.test.ts"), wurzel);
  expect(erhebung.unaufloesbar).toEqual(["start.test.ts → ./link"]);
  expect(erhebung.dateien).toEqual(["start.test.ts"]);
  expect(erhebung.stellen).toEqual([]);
  expect(erhebung.ausserhalb).toEqual([]);
  expect([erhebung.relativ, erhebung.innerhalb]).toEqual([1, 1]);
});

it("W7 · eine symbolisch verlinkte Wurzel liefert zeichengleich dieselbe Erhebung", () => {
  const wurzel = buehne({ "start.test.ts": "import './link';\n", "echt/helfer.ts": HELFER });
  symlinkSync(join(wurzel, "echt/helfer.ts"), join(wurzel, "link.ts"));
  const ort = buehne({});
  const ueberLink = join(ort, "verlinkt");
  symlinkSync(wurzel, ueberLink);

  const kanonisch = erhebe(join(wurzel, "start.test.ts"), wurzel);
  // Der Anker: der kanonische Ausgang steht selbst fest — sonst bestünde der Vergleich unten auch
  // dann, wenn BEIDE Läufe gleich falsch würden.
  expect(kanonisch.dateien).toEqual(["start.test.ts", "echt/helfer.ts"]);
  expect(kanonisch.stellen).toEqual(["echt/helfer.ts:1 · Name: setTimeout"]);

  // Start UND Grenze über den Linkweg, ohne vorheriges `realpath`. EINE Zusicherung über das ganze
  // Objekt: ein neues Feld, das über den Linkweg auseinanderliefe, rutschte sonst durch.
  expect(erhebe(join(ueberLink, "start.test.ts"), ueberLink)).toEqual(kanonisch);
});

// --------------------------------------------------------------------------------------------------
// W8 · DIE WEGWERF-BÜHNEN SIND NACH DEM AUFRÄUMEN WIRKLICH WEG — Prüfer BEN, JOB 3920 R1,
// Prüfpunkt 6 und PROMPTVERBESSERUNG: „Belege die Temp-Bereinigung durch Abwesenheitsprüfung der
// registrierten Bühnen und Linkeinträge nach dem Aufräumen; Git-Status dient nur dem Nachweis eines
// sauberen Arbeitsbaums." Dazu sein Hinweis (`archiv/3920/runde-1/ben.md:33`): „Ein sauberer
// Git-Status allein belegt keine Temp-Bereinigung."
//
// WARUM NICHT DIE NAHELIEGENDE BAUFORM. Ein Fall, der NACH dem `afterAll` (`:467-469`) nachsieht, ist
// nicht baubar: `afterAll` läuft nach allen Fällen dieser Datei. Gemessen wird deshalb dieselbe
// Aufräumform an einer EIGENEN Bühne, und der Aufräumweg des `afterAll` wird daneben am Baum
// nachgeschlagen — nicht im Rohtext gesucht, denn dort stünde die Erwartung dieses Falls selbst und
// die Suche fände sich selbst.
//
// WARUM `lstat` UND NICHT `stat`, und warum das der ganze Punkt ist: ein GEBROCHENER Verweis ist ein
// Verzeichniseintrag, dessen Ziel fehlt. `stat` folgt ihm und scheitert — es könnte den Eintrag gar
// nicht erst sehen und hielte ihn schon vor dem Aufräumen für abwesend. `lstat` sieht den Eintrag.
// Beide Richtungen stehen unten: der Eintrag ist VORHER da (und sein Ziel nicht), NACHHER ist er fort.
// --------------------------------------------------------------------------------------------------

it("W8 · nach dem Aufräumen ist die Bühne fort — samt ihres gebrochenen Verweiseintrags", () => {
  const wurzel = buehne({ "start.test.ts": "import './link';\n" });
  const verweis = join(wurzel, "link.ts");
  symlinkSync(join(wurzel, "gibt-es-nicht.ts"), verweis);
  const wege = [wurzel, join(wurzel, "start.test.ts"), verweis];

  // VORHER — hier entscheidet sich, ob dieser Fall überhaupt etwas misst.
  for (const weg of wege) {
    expect(
      lstatSync(weg, { throwIfNoEntry: false }),
      `vor dem Aufräumen fehlt ${weg}`,
    ).toBeDefined();
  }
  expect(lstatSync(verweis).isSymbolicLink()).toBe(true);
  // Und er ist wirklich GEBROCHEN: `stat` folgt dem Verweis und findet das Ziel nicht.
  expect(statSync(verweis, { throwIfNoEntry: false })).toBeUndefined();

  // DIESELBE FORM WIE IM `afterAll`, am Baum dieser Datei nachgeschlagen statt behauptet.
  const quelle = ts.createSourceFile(
    SELBST,
    readFileSync(join(WURZEL, SELBST), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let aufraeumweg: string | undefined;
  const sucheAfterAll = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "afterAll"
    ) {
      aufraeumweg = node.arguments[0]?.getText(quelle);
    }
    ts.forEachChild(node, sucheAfterAll);
  };
  ts.forEachChild(quelle, sucheAfterAll);
  expect(aufraeumweg, "diese Datei führt kein afterAll mehr").toBeDefined();
  expect(aufraeumweg ?? "").toContain("rmSync(weg, { recursive: true, force: true })");

  rmSync(wurzel, { recursive: true, force: true });

  // NACHHER — jeder Weg ist fort, der gebrochene Eintrag eingeschlossen.
  for (const weg of wege) {
    expect(
      lstatSync(weg, { throwIfNoEntry: false }),
      `nach dem Aufräumen blieb ${weg} zurück`,
    ).toBeUndefined();
  }
});

it("W8 · das Register ist vollständig: jede von `buehne` angelegte Wurzel steht darin", () => {
  // Der Abwesenheitsnachweis darüber trägt nur so weit, wie das Register reicht: eine Wurzel, die
  // `buehnen` nicht kennt, räumt das `afterAll` nie ab und bliebe im Temp-Verzeichnis liegen.
  const vorher = buehnen.length;
  const eine = buehne({ "start.test.ts": "import './helfer';\n", "helfer.ts": HELFER });
  const zwei = buehne({});
  expect(buehnen.slice(vorher)).toEqual([eine, zwei]);
  // Und sie sind wirklich angelegt — ein Register über nichts wäre keine Zusicherung.
  expect([lstatSync(eine).isDirectory(), lstatSync(zwei).isDirectory()]).toEqual([true, true]);
});
