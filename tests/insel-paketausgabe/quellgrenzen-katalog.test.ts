// ================================================================================================
// AUFNAHME 20260922 „INSEL-QUELLGRENZEN" — JEDE DOKUMENTIERTE GRENZE ALS LAUFENDER QUELLBAUM.
// ================================================================================================
//
// WARUM DIESE DATEI ENTSTEHT. JOB 4241 und JOB 4285 haben die Lesegrenzen des Paketbauers
// (`scripts/insel/paketinhalt.mjs`) im Dateikopf von `erreichteQuellen` BENANNT. BEN hat im Urteil
// zu JOB 4285 Runde 5 (Prüflücke 6) festgehalten, dass einige davon nur als Text standen: Regex
// gegen Division, Deklarationserkennung bei `require`, andere Ladewege — und verlangt: „Folgeprüfungen
// sollten je Grenze ausführbare Quellbäume mit tatsächlich benötigter Fremddatei verwenden. Meine
// zusätzlichen Escape-Varianten können dauerhaft übernommen werden."
//
// Die Prüfung dieser Aufnahme hat an echten Quellbäumen gemessen, dass die Grenze „Regex gegen
// Division" NICHT nur theoretisch war: fünf gültige Formen (`if (ok) /'/…`, `while (…) /"/…`,
// `i++ / 2`, `o.return / 2`, `x! / 2`) liessen eine konstante `require`-/`import`-Kante auf derselben
// Zeile still aus dem Paket fallen — Quellbaum läuft, Bau meldet `[]`, Paket stirbt. Ebenso
// `require.resolve("./x")`. Diese Fälle sind im Prüfling geschlossen (Q-RD1–3, Q-RD5, Q-RD6, Q-RQ2);
// was die Regel nicht entscheiden kann, bricht jetzt ab (Q-RD7, Q-RD8). Q-RD4 (`a[0] / 2`) lag schon
// vorher richtig und steht als Schutz daneben. GEGENPROBE: derselbe Katalog gegen die Fassung vor
// dieser Aufnahme wird genau in diesen Fällen rot (Q-RD1–3, Q-RD5–8, Q-RQ2, Q-RQ3).
//
// ------------------------------------------------------------------------------------------------
// DIE KETTE, DIE JEDER FALL FÄHRT — keine Messung davon ist verzichtbar
// ------------------------------------------------------------------------------------------------
//   1. DER QUELLBAUM LÄUFT und lädt die Fremdquelle `aussen/…` wirklich („Ergebnis: da"). Ohne das
//      bewiese weder eine Kante noch ein Abbruch etwas.
//   2. DIE INHALTSBERECHNUNG (`fremdquellen`, im Kindprozess wie beim Bauen) liefert GENAU diese
//      Fremdquelle — oder bricht ab und nennt Datei:Zeile und Grund.
//   3. DAS PAKET wird wie vom Bauer zusammengestellt: `services/**` plus die gemeldete Menge, in einem
//      Wegwerfordner ausserhalb von Repo und Quellbaum.
//   4. DER ENTWICKLERBAUM WIRD ENTFERNT, bevor das Paket gilt. Erst dann ist ein Start ein Beleg
//      dafür, dass das Paket seine Laufzeitdateien SELBST mitbringt — kein verdeckter Rückweg.
//   5. DER ISOLIERTE PAKETSTART (Arbeitsverzeichnis = Paket): unterstützt → er läuft, und ohne die
//      Fremdquelle stirbt er; abgewiesen → das Paket, das ohne den Abbruch entstanden wäre, stirbt
//      mit dem Fehler des Betreibers (`MODULE_NOT_FOUND`/`ERR_MODULE_NOT_FOUND`).
//
// Q-EB1 misst Schritt 4 ausdrücklich: ein absoluter Pfad in den Entwicklerbaum LÄUFT im Paket,
// solange der Entwicklerbaum daneben liegt — und stirbt, sobald er fehlt.
//
// WAS HIER NICHT BEHAUPTET WIRD. Das ist kein vollständiger Release-Start (Bauer mit `npm ci`, `zip`,
// Mac Studio, PostgreSQL, App-Health, Browser) — der steht in `tests/insel-echter-start` bzw. bleibt
// Handprobe. Gemessen ist die Kette Quellbaum → Inhaltsliste → Paket → isolierter Start. Die Bäume
// sind klein und selbst geschrieben; die Erwartung stammt aus ihnen, nicht aus dem Prüfling.
//
// `.ts`/`.mts`/`.tsx`/`.jsx` starten über `tsx` — denselben Lader, den `start.command` benutzt. Er
// kommt über `npm ci` und leiht dem Paket keine Quelldatei (`paketprobe.ts`, `TSX_CLI`).
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  MODUL,
  WURZEL,
  fahreModul,
  kopiereGefiltert,
  raeumeAuf,
  starteIsoliert,
  wegwerfordner,
} from "./paketprobe.js";

afterAll(raeumeAuf);

/** Die Escapes werden zusammengesetzt, nicht als TypeScript-Escape geschrieben (vgl. `lesegrenzen-brechen-ab.test.ts`, R4). */
const R = String.fromCharCode(0x5c);
/** Die Zeilentrenner ausser LF — ebenso zusammengesetzt, damit sie nachweislich im Quellbaum stehen. */
const CR = String.fromCharCode(0x0d);
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

/** Die Fremdquelle, die jeder Baum WIRKLICH lädt — und der Fehler, mit dem ihr Fehlen endet. */
const FREMD = {
  cjs: {
    pfad: "aussen/geladen.cjs",
    inhalt: 'module.exports = { wert: "da" };\n',
    fehler: "MODULE_NOT_FOUND",
  },
  mjs: {
    pfad: "aussen/geladen.mjs",
    inhalt: 'export const wert = "da";\n',
    fehler: "ERR_MODULE_NOT_FOUND",
  },
  json: { pfad: "aussen/daten.json", inhalt: '{ "wert": "da" }\n', fehler: "MODULE_NOT_FOUND" },
} as const;

const CJS = "services/app/start.cjs";
const MJS = "services/app/start.mjs";
const MTS = "services/app/start.mts";
const TS = "services/app/start.ts";
const TSX = "services/app/start.tsx";
const AUSGABE_CJS = "console.log(`Ergebnis: ${geladen.wert}`);";

type Grenze =
  | "Regex/Division"
  | "Deklaration"
  | "variabler Importpfad"
  | "Template"
  | "JSX/TSX"
  | "require"
  | "Escape (BEN)"
  | "Entwicklerbaum";

interface Fall {
  readonly id: string;
  readonly grenze: Grenze;
  readonly was: string;
  readonly lader: "node" | "tsx";
  readonly einstieg: string;
  readonly fremd: keyof typeof FREMD;
  /** Die Quelldateien OHNE die Fremdquelle — als Funktion, weil Q-EB1 den eigenen Ort braucht. */
  readonly quelle: (wurzel: string) => Record<string, string>;
  readonly erwartung:
    | { readonly art: "unterstuetzt" }
    | {
        readonly art: "abgewiesen";
        /** Datei:Zeile der Ladestelle — oder die Datei, wenn der Einstieg selbst abgewiesen wird. */
        readonly wo: string;
        readonly grund: string;
        /** Nur Q-EB1: das Paket läuft, SOLANGE der Entwicklerbaum daneben liegt. */
        readonly rueckwegUeberEntwicklerbaum?: true;
      };
}

const zeilen = (...z: string[]) => `${z.join("\n")}\n`;

const REACT_ERSATZ_TS =
  'const React = { createElement: (_t: unknown, _p: unknown, ...kinder: unknown[]) => kinder.join("") };';
const REACT_ERSATZ_JS = 'const React = { createElement: (_t, _p, ...kinder) => kinder.join("") };';

const KATALOG: readonly Fall[] = [
  // ==============================================================================================
  // REGEX GEGEN DIVISION — Q-RD1–3, Q-RD5, Q-RD6 waren bis zu dieser Aufnahme STILLE Verluste.
  // ==============================================================================================
  {
    id: "Q-RD1",
    grenze: "Regex/Division",
    was: "`if (…) /'/…` — nach dem Kopf von `if` beginnt ein regulärer Ausdruck",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        `const s = "'";`,
        "let treffer = false;",
        `if (s) /'/.test(s) && (treffer = true); const geladen = require("../../aussen/geladen.cjs");`,
        "console.log(`Ergebnis: ${geladen.wert}`, treffer);",
      ),
    }),
    erwartung: { art: "unterstuetzt" },
  },
  {
    id: "Q-RD2",
    grenze: "Regex/Division",
    was: '`while (…) /"/…` — dasselbe für `while`',
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        "let n = 0;",
        'while (n++ < 1) /"/.test("x"); const geladen = require("../../aussen/geladen.cjs");',
        AUSGABE_CJS,
      ),
    }),
    erwartung: { art: "unterstuetzt" },
  },
  {
    id: "Q-RD3",
    grenze: "Regex/Division",
    was: "`i++ / 2` — hinter der Nachsilbe `++` teilt ein `/`",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        "let i = 4;",
        'const h = i++ / 2; const geladen = require("../../aussen/geladen.cjs"); const r = h / 2;',
        "console.log(`Ergebnis: ${geladen.wert}`, r);",
      ),
    }),
    erwartung: { art: "unterstuetzt" },
  },
  {
    id: "Q-RD4",
    grenze: "Regex/Division",
    was: "`a[0] / 2` — hinter einem Index teilt ein `/`",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        "const a = [4];",
        'const h = a[0] / 2; const geladen = require("../../aussen/geladen.cjs"); const r = h / 2;',
        "console.log(`Ergebnis: ${geladen.wert}`, r);",
      ),
    }),
    erwartung: { art: "unterstuetzt" },
  },
  {
    id: "Q-RD5",
    grenze: "Regex/Division",
    was: "`o.return / 2` — ein Schlüsselwort hinter `.` ist ein Eigenschaftsname",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        "const o = { return: 4 };",
        'const h = o.return / 2; const geladen = require("../../aussen/geladen.cjs"); const r = h / 2;',
        "console.log(`Ergebnis: ${geladen.wert}`, r);",
      ),
    }),
    erwartung: { art: "unterstuetzt" },
  },
  {
    id: "Q-RD6",
    grenze: "Regex/Division",
    was: "`karte.get(…)! / 2` — TypeScripts Nicht-null-Zusicherung ist keine Verneinung",
    lader: "tsx",
    einstieg: MTS,
    fremd: "mjs",
    quelle: () => ({
      [MTS]: zeilen(
        'const karte = new Map<string, number>([["a", 4]]);',
        'const h = karte.get("a")! / 2; const geladen = await import("../../aussen/geladen.mjs"); const r = h / 2;',
        "console.log(`Ergebnis: ${geladen.wert}`, r);",
      ),
    }),
    erwartung: { art: "unterstuetzt" },
  },
  {
    id: "Q-RD7",
    grenze: "Regex/Division",
    was: "`function () {} / 2` — hinter `}` ist die Frage ohne Parser nicht entscheidbar",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        'const f = function () {} / 2; const geladen = require("../../aussen/geladen.cjs"); const r = 1 / 2;',
        "console.log(`Ergebnis: ${geladen.wert}`, f, r);",
      ),
    }),
    erwartung: { art: "abgewiesen", wo: `${CJS}:1`, grund: "vor dem / steht ein }" },
  },
  {
    id: "Q-RD8",
    grenze: "Regex/Division",
    was: "`of / 2` — ein Kontextwort kann Schlüsselwort oder Bezeichner sein",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        "const of = 4;",
        'const h = of / 2; const geladen = require("../../aussen/geladen.cjs"); const r = h / 2;',
        "console.log(`Ergebnis: ${geladen.wert}`, r);",
      ),
    }),
    erwartung: { art: "abgewiesen", wo: `${CJS}:2`, grund: "Schluesselwort oder Bezeichner" },
  },
  {
    id: "Q-RD9",
    grenze: "Regex/Division",
    // BENs Gegenfall aus dem Urteil zu Runde 1, in derselben Form: bis dahin Quellstart Exit 0,
    // `fremdquellen` = `[]`, Paketstart ohne Entwicklerbaum Exit 1 mit `MODULE_NOT_FOUND`.
    was: "`break` + Zeilenumbruch + ``/`/`` — nach der Semikoloneinfügung ein regulärer Ausdruck (BEN, Runde 1)",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        "let geladen;",
        "for (let i=0;i<1;i++) {",
        "if (false) break",
        "/`/; geladen = require('../../aussen/geladen.cjs'); /`/;",
        "}",
        AUSGABE_CJS,
      ),
    }),
    erwartung: { art: "unterstuetzt" },
  },
  {
    id: "Q-RD10",
    grenze: "Regex/Division",
    was: "`continue <Sprungziel>` und `debugger` vor einem regulären Ausdruck auf der nächsten Zeile",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        "let geladen;",
        "ring: for (let i = 0; i < 1; i++) {",
        "  if (i > 5) continue ring",
        "  /'/; geladen = require(\"../../aussen/geladen.cjs\"); /'/;",
        "  debugger",
        '  /"/; void /"/;',
        "}",
        AUSGABE_CJS,
      ),
    }),
    erwartung: { art: "unterstuetzt" },
  },
  {
    id: "Q-RD11",
    grenze: "Regex/Division",
    was: "`extends /'/.constructor` — hinter `extends` beginnt ein Ausdruck",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        `class Muster extends /'/.constructor {} const geladen = require("../../aussen/geladen.cjs");`,
        "console.log(`Ergebnis: ${geladen.wert}`, new Muster('x').source);",
      ),
    }),
    erwartung: { art: "unterstuetzt" },
  },
  {
    id: "Q-RD12",
    grenze: "Regex/Division",
    // Das Netz für die Semikoloneinfügung kostet hier einen HARMLOSEN Abbruch: die Division ist
    // gültig, der Leser kann sie am Zeilenanfang aber nicht von Q-RD9 unterscheiden. Biome setzt den
    // Operator ans Zeilenende; im Bestand kommt die Form nicht vor (gemessen, 2373 Dateien).
    was: "eine Division am Zeilenanfang — das Netz für die Semikoloneinfügung bricht ab",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        "const h = 8",
        '  / 2; const geladen = require("../../aussen/geladen.cjs");',
        "console.log(`Ergebnis: ${geladen.wert}`, h);",
      ),
    }),
    erwartung: { art: "abgewiesen", wo: `${CJS}:2`, grund: "am Zeilenanfang" },
  },

  // ==============================================================================================
  // DEKLARATION GEGEN AUFRUF BEI `require`
  // ==============================================================================================
  {
    id: "Q-DK1",
    grenze: "Deklaration",
    was: "`async require(id) {…}` und `{ require(id) {…} }` sind Deklarationen, daneben lädt ein echter Aufruf",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        "class Werk { async require(id) { return id; } }",
        "const werkzeug = { require(id) { return id; } };",
        'const geladen = require("../../aussen/geladen.cjs");',
        'new Werk().require("x").then((x) => console.log(`Ergebnis: ${geladen.wert}`, x, werkzeug.require("y")));',
      ),
    }),
    erwartung: { art: "unterstuetzt" },
  },
  {
    id: "Q-DK2",
    grenze: "Deklaration",
    was: "`private async require(id: string): Promise<string>` — die Form des Bestands, mit `tsx` gestartet",
    lader: "tsx",
    einstieg: MTS,
    fremd: "mjs",
    quelle: () => ({
      [MTS]: zeilen(
        "class Dienst {",
        "  private async require(id: string): Promise<string> {",
        "    return id;",
        "  }",
        "  async hol(id: string): Promise<string> {",
        "    return await this.require(id);",
        "  }",
        "}",
        'const geladen = await import("../../aussen/geladen.mjs");',
        'console.log(`Ergebnis: ${geladen.wert}`, await new Dienst().hol("x"));',
      ),
    }),
    erwartung: { art: "unterstuetzt" },
  },
  {
    id: "Q-DK3",
    grenze: "Deklaration",
    was: "ein echter Aufruf vor einem Block auf der nächsten Zeile ist KEINE Deklaration (ASI)",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        'const geladen = require("../../aussen/geladen.cjs")',
        "{",
        "  const nurEinBlock = 1;",
        "  void nurEinBlock;",
        "}",
        AUSGABE_CJS,
      ),
    }),
    erwartung: { art: "unterstuetzt" },
  },
  {
    id: "Q-DK4",
    grenze: "Deklaration",
    was: "Kurzform-Methode mit Rumpf auf der NÄCHSTEN Zeile — nicht von einem Aufruf zu trennen",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        "const werkzeug = {",
        "  require(id)",
        "  { return id; },",
        "};",
        'const geladen = require("../../aussen/geladen.cjs");',
        'console.log(`Ergebnis: ${geladen.wert}`, werkzeug.require("y"));',
      ),
    }),
    erwartung: { art: "abgewiesen", wo: `${CJS}:2`, grund: "require(id)" },
  },
  {
    id: "Q-DK5",
    grenze: "Deklaration",
    was: "modifikatorlose Methode mit Rückgabetyp `require(id: string): string {` — gilt als Aufruf",
    lader: "tsx",
    einstieg: MTS,
    fremd: "mjs",
    quelle: () => ({
      [MTS]: zeilen(
        "class Zwei {",
        "  require(id: string): string {",
        "    return id;",
        "  }",
        "}",
        'const geladen = await import("../../aussen/geladen.mjs");',
        'console.log(`Ergebnis: ${geladen.wert}`, new Zwei().require("y"));',
      ),
    }),
    erwartung: { art: "abgewiesen", wo: `${MTS}:2`, grund: "keine einzelne Zeichenkette" },
  },
  // BENs Gegenfall aus dem Urteil zu Runde 1 dieses Laufs, für JEDES Deklarationswort, das in
  // CommonJS ein gewöhnlicher Bezeichner sein kann: auf der Zeile davor ist es eine eigene Anweisung
  // (Semikoloneinfügung), und der echte Aufruf dahinter verschwand bis dahin still.
  ...(
    [
      ["a", "async"],
      ["g", "get"],
      ["s", "set"],
      ["t", "static"],
      ["p", "private"],
      ["u", "public"],
      ["o", "protected"],
      ["b", "abstract"],
      ["v", "override"],
      ["d", "declare"],
      ["y", "readonly"],
    ] as const
  ).map(
    ([kurz, wort]): Fall => ({
      id: `Q-DK6${kurz}`,
      grenze: "Deklaration",
      was: `\`${wort}\` auf der Zeile davor ist ein Bezeichner — der \`require\` dahinter lädt wirklich (BEN)`,
      lader: "node",
      einstieg: CJS,
      fremd: "cjs",
      quelle: () => ({
        // Das Wort steht UNMITTELBAR vor `require` — nur so trifft der Baum die Regel. Das Ergebnis
        // wird danach aus `require.cache` gelesen, damit keine zweite Kante zur selben Datei führt.
        [CJS]: zeilen(
          `const ${wort} = 1;`,
          wort,
          'require("../../aussen/geladen.cjs")',
          "{ const x = 1; void x; }",
          'const geladen = Object.values(require.cache).find((m) => m.filename.endsWith("geladen.cjs")).exports;',
          AUSGABE_CJS,
        ),
      }),
      erwartung: { art: "unterstuetzt" },
    }),
  ),
  // BENs Gegenfall aus dem Urteil zu Runde 2: JavaScript kennt VIER Zeilentrenner (LF, CR, U+2028,
  // U+2029), und jeder davon — auch in einem trennenden Blockkommentar — macht aus `async` eine eigene
  // Anweisung. Bis dahin prüfte der Zerleger nur LF, und die Datei fiel still aus dem Paket.
  ...(
    [
      ["c", "CR", CR],
      ["l", "U+2028", LS],
      ["p", "U+2029", PS],
      ["k", "Blockkommentar mit CR", `/*${CR}*/`],
      ["m", "Blockkommentar mit U+2028", `/*${LS}*/`],
      ["n", "Blockkommentar mit U+2029", `/*${PS}*/`],
    ] as const
  ).map(
    ([kurz, name, trenner]): Fall => ({
      id: `Q-DK8${kurz}`,
      grenze: "Deklaration",
      was: `\`async\` + ${name} + \`require(…)\` — auch dieser Zeilentrenner beendet die Anweisung (BEN)`,
      lader: "node",
      einstieg: CJS,
      fremd: "cjs",
      quelle: () => ({
        [CJS]: zeilen(
          "const async = 1;",
          `async${trenner}require("../../aussen/geladen.cjs")`,
          "{ const x = 1; void x; }",
          'const geladen = Object.values(require.cache).find((m) => m.filename.endsWith("geladen.cjs")).exports;',
          AUSGABE_CJS,
        ),
      }),
      erwartung: { art: "unterstuetzt" },
    }),
  ),
  // Die Schwesterlücke am selben Ort: ein `//`-Kommentar endet an JEDEM Zeilentrenner, nicht nur an
  // LF. Endete er für den Zerleger erst am nächsten LF, verschluckte er die echte Kante dahinter.
  ...(
    [
      ["c", "CR", CR],
      ["l", "U+2028", LS],
      ["p", "U+2029", PS],
    ] as const
  ).map(
    ([kurz, name, trenner]): Fall => ({
      id: `Q-DK9${kurz}`,
      grenze: "Deklaration",
      was: `\`// …\` + ${name} + \`require(…)\` — der Kommentar endet am Zeilentrenner, die Kante dahinter lädt`,
      lader: "node",
      einstieg: CJS,
      fremd: "cjs",
      quelle: () => ({
        [CJS]: zeilen(
          `let geladen; // Hinweis${trenner}geladen = require("../../aussen/geladen.cjs");`,
          AUSGABE_CJS,
        ),
      }),
      erwartung: { art: "unterstuetzt" },
    }),
  ),
  {
    id: "Q-DK7",
    grenze: "Deklaration",
    was: "`static` + Zeilenumbruch + `require(id) {` in einer Klasse — gilt jetzt als Aufruf und bricht ab",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        "class Werk {",
        "  static",
        "  require(id) { return id; }",
        "}",
        'const geladen = require("../../aussen/geladen.cjs");',
        'console.log(`Ergebnis: ${geladen.wert}`, Werk.require("y"));',
      ),
    }),
    erwartung: { art: "abgewiesen", wo: `${CJS}:3`, grund: "require(id)" },
  },

  // ==============================================================================================
  // VARIABLE IMPORTPFADE
  // ==============================================================================================
  {
    id: "Q-VP1",
    grenze: "variabler Importpfad",
    was: "`require(pfad)`",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        'const pfad = "../../aussen/geladen.cjs";',
        "const geladen = require(pfad);",
        AUSGABE_CJS,
      ),
    }),
    erwartung: { art: "abgewiesen", wo: `${CJS}:2`, grund: "keine einzelne Zeichenkette" },
  },
  {
    id: "Q-VP2",
    grenze: "variabler Importpfad",
    was: "`await import(pfad)`",
    lader: "node",
    einstieg: MJS,
    fremd: "mjs",
    quelle: () => ({
      [MJS]: zeilen(
        'const pfad = "../../aussen/geladen.mjs";',
        "const geladen = await import(pfad);",
        AUSGABE_CJS,
      ),
    }),
    erwartung: { art: "abgewiesen", wo: `${MJS}:2`, grund: "keine einzelne Zeichenkette" },
  },
  {
    id: "Q-VP3",
    grenze: "variabler Importpfad",
    was: '`require("…" + endung)`',
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(
        'const endung = ".cjs";',
        'const geladen = require("../../aussen/geladen" + endung);',
        AUSGABE_CJS,
      ),
    }),
    erwartung: { art: "abgewiesen", wo: `${CJS}:2`, grund: "keine einzelne Zeichenkette" },
  },

  // ==============================================================================================
  // TEMPLATES
  // ==============================================================================================
  {
    id: "Q-TP1",
    grenze: "Template",
    was: "``import(`…`)`` ohne Einsetzung ist genau ein Literal",
    lader: "node",
    einstieg: MJS,
    fremd: "mjs",
    quelle: () => ({
      [MJS]: zeilen("const geladen = await import(`../../aussen/geladen.mjs`);", AUSGABE_CJS),
    }),
    erwartung: { art: "unterstuetzt" },
  },
  {
    id: "Q-TP2",
    grenze: "Template",
    was: "``import(`${basis}/…`)`` — eine Schablone mit Einsetzung ist kein Literal",
    lader: "node",
    einstieg: MJS,
    fremd: "mjs",
    quelle: () => ({
      [MJS]: zeilen(
        'const basis = "../../aussen";',
        "const geladen = await import(`${basis}/geladen.mjs`);",
        AUSGABE_CJS,
      ),
    }),
    erwartung: { art: "abgewiesen", wo: `${MJS}:2`, grund: "keine einzelne Zeichenkette" },
  },
  {
    id: "Q-TP3",
    grenze: "Template",
    was: "ein `require` IN einer Einsetzung ist eine Kante wie jede andere",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen('console.log(`Ergebnis: ${require("../../aussen/geladen.cjs").wert}`);'),
    }),
    erwartung: { art: "unterstuetzt" },
  },

  // ==============================================================================================
  // JSX/TSX — wird gefunden, aber nicht gelesen.
  // ==============================================================================================
  {
    id: "Q-JX1",
    grenze: "JSX/TSX",
    was: "eine erreichte `.tsx`, die selbst die Fremdquelle lädt",
    lader: "tsx",
    einstieg: TS,
    fremd: "cjs",
    quelle: () => ({
      [TS]: zeilen(
        'import { flaeche } from "./flaeche";',
        "console.log(`Ergebnis: ${flaeche()}`);",
      ),
      "services/app/flaeche.tsx": zeilen(
        'import { wert } from "../../aussen/geladen.cjs";',
        REACT_ERSATZ_TS,
        "export const flaeche = () => <b>{wert}</b>;",
      ),
    }),
    erwartung: { art: "abgewiesen", wo: `${TS}:1`, grund: "JSX-Datei" },
  },
  {
    id: "Q-JX2",
    grenze: "JSX/TSX",
    was: "dasselbe für `.jsx`, endungslos eingeführt",
    lader: "tsx",
    einstieg: TS,
    fremd: "cjs",
    quelle: () => ({
      [TS]: zeilen(
        'import { flaeche } from "./flaeche";',
        "console.log(`Ergebnis: ${flaeche()}`);",
      ),
      "services/app/flaeche.jsx": zeilen(
        'import { wert } from "../../aussen/geladen.cjs";',
        REACT_ERSATZ_JS,
        "export const flaeche = () => <b>{wert}</b>;",
      ),
    }),
    erwartung: { art: "abgewiesen", wo: `${TS}:1`, grund: "JSX-Datei" },
  },
  {
    id: "Q-JX3",
    grenze: "JSX/TSX",
    was: "der Einstieg selbst ist `.tsx`",
    lader: "tsx",
    einstieg: TSX,
    fremd: "cjs",
    quelle: () => ({
      [TSX]: zeilen(
        'import { wert } from "../../aussen/geladen.cjs";',
        REACT_ERSATZ_TS,
        "const flaeche = () => <b>{wert}</b>;",
        "console.log(`Ergebnis: ${flaeche()}`);",
      ),
    }),
    erwartung: { art: "abgewiesen", wo: TSX, grund: "JSX-Datei" },
  },

  // ==============================================================================================
  // REQUIRE
  // ==============================================================================================
  {
    id: "Q-RQ1",
    grenze: "require",
    was: "`require('…')` mit festem Pfad",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen("const geladen = require('../../aussen/geladen.cjs');", AUSGABE_CJS),
    }),
    erwartung: { art: "unterstuetzt" },
  },
  {
    id: "Q-RQ2",
    grenze: "require",
    was: '`require.resolve("…")` verlangt die Datei — bis zu dieser Aufnahme ein stiller Verlust',
    lader: "node",
    einstieg: CJS,
    fremd: "json",
    quelle: () => ({
      [CJS]: zeilen(
        'const { readFileSync } = require("node:fs");',
        'const pfad = require.resolve("../../aussen/daten.json");',
        'const geladen = JSON.parse(readFileSync(pfad, "utf8"));',
        AUSGABE_CJS,
      ),
    }),
    erwartung: { art: "unterstuetzt" },
  },
  {
    id: "Q-RQ3",
    grenze: "require",
    was: '`require.resolve("…" + name)` läuft durch dieselbe Weissliste',
    lader: "node",
    einstieg: CJS,
    fremd: "json",
    quelle: () => ({
      [CJS]: zeilen(
        'const { readFileSync } = require("node:fs");',
        'const name = "daten.json";',
        'const pfad = require.resolve("../../aussen/" + name);',
        'const geladen = JSON.parse(readFileSync(pfad, "utf8"));',
        AUSGABE_CJS,
      ),
    }),
    erwartung: { art: "abgewiesen", wo: `${CJS}:3`, grund: "require.resolve(" },
  },

  // ==============================================================================================
  // ESCAPE-SCHREIBWEISEN — BENs zusätzliche Varianten aus JOB 4285 Runde 5, dauerhaft übernommen,
  // plus die Oktal- und die Identitätsform. Jede ergibt denselben Wert `../../aussen/geladen.*`.
  // ==============================================================================================
  ...(
    [
      ["Q-ES1", "escaped Schrägstrich `\\/`", `..${R}/..${R}/aussen/geladen`],
      ["Q-ES2", "`\\u{2e}`", `${R}u{2e}./../aussen/geladen`],
      ["Q-ES3", "Zeilenfortsetzung", `../../aussen/gela${R}\nden`],
      ["Q-ES4", "Identitäts-Escape `\\.`", `${R}../../aussen/geladen`],
    ] as const
  ).flatMap(([id, name, rumpf]): Fall[] => [
    {
      id: `${id}r`,
      grenze: "Escape (BEN)",
      was: `${name} in \`require("…")\``,
      lader: "node",
      einstieg: CJS,
      fremd: "cjs",
      quelle: () => ({ [CJS]: zeilen(`const geladen = require("${rumpf}.cjs");`, AUSGABE_CJS) }),
      erwartung: { art: "abgewiesen", wo: `${CJS}:1`, grund: "Rueckstrich" },
    },
    {
      id: `${id}i`,
      grenze: "Escape (BEN)",
      was: `${name} in \`import("…")\``,
      lader: "node",
      einstieg: MJS,
      fremd: "mjs",
      quelle: () => ({
        [MJS]: zeilen(`const geladen = await import("${rumpf}.mjs");`, AUSGABE_CJS),
      }),
      erwartung: { art: "abgewiesen", wo: `${MJS}:1`, grund: "Rueckstrich" },
    },
  ]),
  {
    id: "Q-ES5r",
    grenze: "Escape (BEN)",
    // Oktal nur in CommonJS: im strikten Modus (ESM) ist `\56` ein Syntaxfehler, ein Baum dazu liefe nie.
    was: 'Oktal-Escape `\\56` in `require("…")`',
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: () => ({
      [CJS]: zeilen(`const geladen = require("${R}56./../aussen/geladen.cjs");`, AUSGABE_CJS),
    }),
    erwartung: { art: "abgewiesen", wo: `${CJS}:1`, grund: "Rueckstrich" },
  },

  // ==============================================================================================
  // DER ENTWICKLERBAUM ALS VERDECKTER RÜCKWEG
  // ==============================================================================================
  {
    id: "Q-EB1",
    grenze: "Entwicklerbaum",
    was: "ein absoluter Pfad läuft im Paket nur, solange der Entwicklerbaum daneben liegt",
    lader: "node",
    einstieg: CJS,
    fremd: "cjs",
    quelle: (wurzel) => ({
      [CJS]: zeilen(
        `const geladen = require(${JSON.stringify(join(wurzel, "aussen/geladen.cjs"))});`,
        AUSGABE_CJS,
      ),
    }),
    erwartung: {
      art: "abgewiesen",
      wo: `${CJS}:1`,
      grund: "absoluter Pfad",
      rueckwegUeberEntwicklerbaum: true,
    },
  },
];

function legeBaumAn(wurzel: string, dateien: Record<string, string>): void {
  for (const [pfad, inhalt] of Object.entries(dateien)) {
    const ziel = join(wurzel, pfad);
    mkdirSync(dirname(ziel), { recursive: true });
    writeFileSync(ziel, inhalt);
  }
}

/** Die ganze Kette aus dem Dateikopf — Schritt für Schritt, mit dem Fall in jeder Meldung. */
function pruefeFall(fall: Fall): void {
  const fremd = FREMD[fall.fremd];
  const baum = wegwerfordner();
  legeBaumAn(baum, { ...fall.quelle(baum), [fremd.pfad]: fremd.inhalt });

  // 1 · der Quellbaum läuft und lädt die Fremdquelle wirklich.
  const quellstart = starteIsoliert(baum, fall.einstieg, fall.lader);
  expect(quellstart.status, `${fall.id}: der Quellbaum muss laufen:\n${quellstart.aus}`).toBe(0);
  expect(quellstart.aus, fall.id).toContain("Ergebnis: da");

  // 2 · die Inhaltsberechnung, im Kindprozess wie beim Bauen.
  const lauf = fahreModul(
    `process.stdout.write(JSON.stringify(m.fremdquellen(${JSON.stringify(baum)}, [${JSON.stringify(fall.einstieg)}])));`,
  );
  let gemeldet: string[] = [];
  if (fall.erwartung.art === "unterstuetzt") {
    expect(lauf.status, `${fall.id}: der Bau muss gelingen:\n${lauf.stderr}`).toBe(0);
    gemeldet = JSON.parse(lauf.stdout) as string[];
    expect(gemeldet, fall.id).toEqual([fremd.pfad]);
  } else {
    expect(
      lauf.status,
      `${fall.id}: der Bau musste abbrechen, lieferte aber: ${lauf.stdout}`,
    ).not.toBe(0);
    expect(lauf.stderr, fall.id).toContain(fall.erwartung.grund);
    expect(lauf.stderr, fall.id).toContain(fall.erwartung.wo);
  }

  // 3 · das Paket, wie der Bauer es zusammenstellt — ausserhalb von Repo und Quellbaum.
  const paket = wegwerfordner();
  kopiereGefiltert(join(baum, "services"), join(paket, "services"));
  for (const pfad of gemeldet) {
    mkdirSync(dirname(join(paket, pfad)), { recursive: true });
    cpSync(join(baum, pfad), join(paket, pfad));
  }
  expect(relative(WURZEL, paket).startsWith(".."), `${fall.id}: Paket liegt im Repo`).toBe(true);
  expect(relative(baum, paket).startsWith(".."), `${fall.id}: Paket liegt im Quellbaum`).toBe(true);

  // Q-EB1: solange der Entwicklerbaum daneben liegt, VERDECKT er die Lücke — genau das ist die Gefahr.
  if (fall.erwartung.art === "abgewiesen" && fall.erwartung.rueckwegUeberEntwicklerbaum) {
    const verdeckt = starteIsoliert(paket, fall.einstieg, fall.lader);
    expect(
      verdeckt.status,
      `${fall.id}: der Rückweg über den Entwicklerbaum:\n${verdeckt.aus}`,
    ).toBe(0);
  }

  // 4 · der Entwicklerbaum ist weg. Ab hier trägt das Paket sich selbst — oder eben nicht.
  rmSync(baum, { recursive: true, force: true });
  expect(existsSync(baum)).toBe(false);

  // 5 · der isolierte Paketstart.
  const paketstart = starteIsoliert(paket, fall.einstieg, fall.lader);
  if (fall.erwartung.art === "unterstuetzt") {
    expect(paketstart.status, `${fall.id}: das Paket muss starten:\n${paketstart.aus}`).toBe(0);
    expect(paketstart.aus, fall.id).toContain("Ergebnis: da");
    rmSync(join(paket, fremd.pfad));
    const ohne = starteIsoliert(paket, fall.einstieg, fall.lader);
    expect(ohne.status, `${fall.id}: ohne die Fremdquelle muss der Start scheitern`).not.toBe(0);
    expect(ohne.aus, fall.id).toContain(fremd.fehler);
    expect(ohne.aus, fall.id).toContain(basename(fremd.pfad));
  } else {
    expect(existsSync(join(paket, fremd.pfad)), `${fall.id}: die Fremdquelle fehlt im Paket`).toBe(
      false,
    );
    expect(
      paketstart.status,
      `${fall.id}: das Paket ohne Abbruch muss scheitern:\n${paketstart.aus}`,
    ).not.toBe(0);
    expect(paketstart.aus, fall.id).toContain(fremd.fehler);
    expect(paketstart.aus, fall.id).toContain(basename(fremd.pfad));
  }
}

describe("Aufnahme 20260922 · jede Quellgrenze des Paketbauers als laufender Quellbaum", () => {
  for (const fall of KATALOG) {
    const ausgang = fall.erwartung.art === "unterstuetzt" ? "unterstützt" : "abgewiesen";
    it(`${fall.id} · ${fall.grenze} · ${ausgang} · ${fall.was}`, () => pruefeFall(fall), 60_000);
  }

  it("Katalog und Dateikopf nennen dieselben Fälle — keine Grenze nur als Text, kein Fall ohne Grenze", () => {
    // Jede im Auftrag benannte Grenze hat mindestens einen laufenden Baum.
    const grenzen = new Set(KATALOG.map((fall) => fall.grenze));
    for (const grenze of [
      "Regex/Division",
      "Deklaration",
      "variabler Importpfad",
      "Template",
      "JSX/TSX",
      "require",
      "Escape (BEN)",
      "Entwicklerbaum",
    ] as const) {
      expect(grenzen.has(grenze), `keine laufende Probe für ${grenze}`).toBe(true);
    }
    // Die Fall-Kennungen sind eindeutig.
    const kennungen = KATALOG.map((fall) => fall.id);
    expect(new Set(kennungen).size).toBe(kennungen.length);

    // Der Dateikopf des Prüflings verweist auf genau diese Fälle — in beide Richtungen. So kann eine
    // Grenze weder nur als Text stehen noch ein Fall hier ohne Beschreibung dort.
    const kopf = readFileSync(MODUL, "utf8");
    const imKopf = new Set(
      [...kopf.matchAll(/Q-[A-Z]{2}\d+[a-z]?/g)].map((treffer) => treffer[0] as string),
    );
    // Ein Kleinbuchstabe am Ende trennt nur Spielarten desselben Falls (`Q-ES1r`, `Q-DK6a`).
    const basen = new Set(kennungen.map((id) => id.replace(/[a-z]$/, "")));
    for (const id of basen) {
      expect(imKopf.has(id), `${id} fehlt im Dateikopf von paketinhalt.mjs`).toBe(true);
    }
    for (const id of imKopf) {
      expect(basen.has(id), `paketinhalt.mjs nennt ${id}, der Katalog kennt ihn nicht`).toBe(true);
    }
  });
});
