// ================================================================================================
// JOB 4285 — WAS DER PAKETBAUER NICHT SICHER LESEN KANN, BRICHT AB, STATT STILL ZU FEHLEN.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESE DATEI STEHT. JOB 4241 hat den Paketinhalt BERECHNET statt gepflegt und
// dafür drei Fail-closed-Stellen gebaut (`paketinhalt.mjs`, Dateikopf). Der Prüfer hat im Urteil zu
// Runde 6 ausdrücklich benannt, was danach noch still verschwinden konnte
// (`archiv/4241/runde-6/ben.md`, Prüfpunkt 6): „variable Importpfade, Templates ohne relativen
// Anfang, JSX/TSX und `require` bleiben Grenzen". Eine Fail-closed-Regel mit Löchern liefert ihre
// Zusage nur zufällig — sie liefert sie genau so lange, wie niemand eine dieser Formen schreibt.
//
//   REQUIRE          `const t = require("./teil.js")` war weder Kante noch Abbruch: die Datei fiel
//                    aus dem Paket, und der Bau meldete Erfolg.
//   JSX              Eine erreichte `.tsx` wurde als reines JavaScript zerlegt. `</div>` beginnt für
//                    den Leser einen regulären Ausdruck (`<` steht in `VOR_REGEX`) — und frisst eine
//                    echte Kante, die auf derselben Zeile dahinter steht.
//   LEERER ANFANG    ``import(`${basis}/teil.js`)`` hat als festen Anfang die leere Zeichenkette.
//                    `"".startsWith(".")` ist `false`, also lief die Angabe still durch.
//
// UND DIE VIERTE, DIE ERST RUNDE 2 SCHLIESST (BEN, Urteil Runde 1, Prüfpunkte 1 und 4 — belegt mit
// drei echten Paketstarts): Runde 1 las bei `import(` und `require(` nur das Merkmal hinter der
// Klammer und übernahm dessen Konstanz für das GANZE Argument.
//
//   VARIABLER AUFRUF `require(p)` blieb still — die Datei fiel aus dem Paket.
//   VERKETTUNG       `require("../../aussen/geladen" + endung)` galt als konstanter Pfad
//                    „../../aussen/geladen". Daneben liegt zufällig `aussen/geladen.cjs`, also
//                    meldete der Bau eine VOLLSTÄNDIGE Liste mit der FALSCHEN Datei. Das ist die
//                    schlimmere Hälfte des Befunds: ein falscher fester Pfad fällt nicht einmal auf.
//
// Konstanz gilt seither für das ganze Ladeargument, nicht für sein erstes Literal. Die Fälle R1f,
// R1g, R1h und L8 legen die Ablenkdatei am festen Präfix WIRKLICH an — ohne sie bräche der Lauf
// ohnehin ab, nur aus dem falschen Grund, und bewiese nichts.
//
// UND DIE FÜNFTE UND SECHSTE, DIE RUNDE 3 SCHLIESST (BEN, Urteil Runde 2, Korrekturpflichten 1 und
// 2 — belegt mit vier echten Paketstarts). Beide Male war ein ANZEICHEN als NACHWEIS genommen:
//
//   BLOCK DAHINTER   `const t = require(p)` mit einem Block auf der nächsten Zeile galt als
//                    Methodendeklaration. Die automatische Semikoloneinfügung macht daraus aber
//                    zwei Anweisungen; der Ladevorgang verschwand still (R1k, R1l, L9).
//   LITERAL ALS      `require("fs" && p)` lieferte den festen Anfang „fs" — erkennbar ein
//   OPERAND          Paketname, also übersprungen. Geladen wird `p`, und das ist relativ.
//
// ================================================================================================
// RUNDE 4 — WARUM HIER JETZT EINE WEISSLISTE STEHT UND KEIN SIEBTER EINZELFALL
// ================================================================================================
// Runde 3 hat den Anfang an ein unmittelbar folgendes `+` gebunden. BEN hat auch das mit vier
// echten Paketstarts widerlegt: `require("fs" + "" && p)` und `require("fs" + "" ? p : "fs")`
// erfüllen die `+`-Regel und laden trotzdem `p`. Das ist dreimal dasselbe Fehlerbild — aus einem
// TEIL des Ausdrucks wurde auf das GANZE geschlossen.
//
// Die Frage ist deshalb umgedreht. Nicht mehr „welche Form ist gefährlich?", sondern: VERFOLGT
// ODER ÜBERSPRUNGEN WIRD NUR, WAS SYNTAKTISCH GENAU EIN ZEICHENKETTENLITERAL IST. Jede andere
// Ausdrucksform bricht ab. Das kehrt zwei bisherige Fälle um, und genau das ist der Punkt:
//
//   R1i   `import("fastify" + endung)`   war erlaubt, bricht jetzt AB.
//   R3b   ``import(`fastify/${x}`)``     war erlaubt, bricht jetzt AB.
//
// Beide sahen harmlos aus — und waren der Spalt, durch den `"fs" && p` passte. Was das kostet, ist
// gemessen: der echte Serverbaum kennt keine solche Form, `fremdquellen` liefert dort unverändert
// `["apps/web/src/lib/docx.ts"]` (Fall B in `fremdquellen-im-paket.test.ts`). Erlaubt bleiben das
// nackte Literal (R1i2) und die Schablone OHNE Einsetzung (R3b2); NEU ab: das absolute Literal
// (R1i3). Die ganze Kette mit echten Paketstarts steht in L10.
//
// WAS HIER ECHT IST. Jeder Fall legt einen ECHTEN kleinen Quellbaum in einem Wegwerfordner an und
// fährt den Prüfling im Kindprozess darüber — so, wie `build-current-release.mjs` ihn fährt. Keine
// Erwartung stammt aus dem Prüfling; die Bäume stehen hier im Test. Der Prüfstand selbst
// (Wegwerfordner, Kindprozess, Kopierfilter, echter Start) steht in `paketprobe.ts` und ist derselbe
// wie in `fremdquellen-im-paket.test.ts` — ein Prüfstand, nicht zwei.
//
// WAS HIER NICHT BEHAUPTET WIRD. Fall L7 startet ein WIRKLICH gebautes kleines Paket mit `node`.
// Das ist NICHT der vollständige Release-Start (Mac Studio, `npm ci`, `zip`, PostgreSQL, App-Health,
// Browser) — der bleibt Handprobe und ist hier nicht gemessen (`archiv/4241/runde-6/ben.md`,
// NICHT GEPRÜFT). Gemessen ist die Kette Quellbaum → Inhaltsliste → Paket → Start → Dateientfernung.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  EINSTIEG,
  fahreModul,
  kopiereGefiltert,
  modulJson,
  raeumeAuf,
  starte,
  wegwerfordner,
} from "./paketprobe.js";

afterAll(raeumeAuf);

/** Ein echter kleiner Quellbaum in einem Wegwerfordner: repo-relativer Pfad → Dateiinhalt. */
function legeBaumAn(dateien: Record<string, string>): string {
  const wurzel = wegwerfordner();
  for (const [pfad, inhalt] of Object.entries(dateien)) {
    const ziel = join(wurzel, pfad);
    mkdirSync(dirname(ziel), { recursive: true });
    writeFileSync(ziel, inhalt);
  }
  return wurzel;
}

/**
 * `erreichteQuellen` über einem Wegwerfbaum — der Ausgang wird vom Aufrufer gewertet, denn genau
 * darum geht es hier: manche Bäume MÜSSEN den Lauf beenden.
 */
function erreichteQuellen(
  baum: string,
  einstieg: string = EINSTIEG,
): { status: number | null; stdout: string; stderr: string } {
  return fahreModul(
    `process.stdout.write(JSON.stringify(m.erreichteQuellen(${JSON.stringify(baum)}, ["${einstieg}"])));`,
  );
}

/** Die Liste eines Laufs, der gelingen MUSSTE. */
function listeAus(lauf: { status: number | null; stdout: string; stderr: string }): string[] {
  expect(lauf.status, lauf.stderr).toBe(0);
  return JSON.parse(lauf.stdout) as string[];
}

describe("JOB 4285 · der Paketbauer schweigt nicht über das, was er nicht lesen kann", () => {
  // ==============================================================================================
  // LIEFERUNG 1 · `require` wird eine Kante — oder ein Abbruch.
  // ==============================================================================================
  it('R1 · `require("./teil.js")` zieht die Datei wirklich in die Liste — in beiden Anführungsarten', () => {
    const baum = legeBaumAn({
      [EINSTIEG]: [
        'const teil = require("./teil.js");',
        "const zwei = require('./zwei.js');",
        "export const wert = teil.wert + zwei.wert;",
        "",
      ].join("\n"),
      "services/app/src/teil.js": 'module.exports = { wert: "da" };\n',
      "services/app/src/zwei.js": 'module.exports = { wert: "auch" };\n',
    });

    expect(listeAus(erreichteQuellen(baum))).toEqual([
      EINSTIEG,
      "services/app/src/teil.js",
      "services/app/src/zwei.js",
    ]);
  });

  it("R1b · ein berechneter `require`-Pfad mit relativem Anfang bricht ab und nennt die einführende Datei", () => {
    const baum = legeBaumAn({
      [EINSTIEG]: [
        "const teil = (n) => require(`./teil/${n}`);",
        "export const wert = teil;",
        "",
      ].join("\n"),
    });

    const lauf = erreichteQuellen(baum);
    expect(lauf.status).not.toBe(0);
    expect(lauf.stderr).toContain("keine einzelne Zeichenkette");
    // Die einführende Datei ist das, womit ein Mensch weitersucht (Lieferung 4).
    expect(lauf.stderr).toContain(EINSTIEG);
  });

  it("R1c · was nur wie `require` aussieht, ist keine Kante: `foo.require(…)` und `{ require: … }`", () => {
    // Beide genannten Dateien gibt es ABSICHTLICH nicht: wer hier eine Kante liest, verlangt eine
    // Datei, die niemand lädt, und bricht den Bau ab, obwohl nichts fehlt (BENs Richtung „zu viel").
    const baum = legeBaumAn({
      [EINSTIEG]: [
        "const foo = { require: (p) => p };",
        'const a = foo.require("./gibt-es-nicht");',
        'const b = { require: "./auch-nicht" };',
        "export const wert = [a, b];",
        "",
      ].join("\n"),
    });

    expect(listeAus(erreichteQuellen(baum))).toEqual([EINSTIEG]);
  });

  it("R1d · eine Methode NAMENS `require` ist kein Ladevorgang — Deklaration und Aufruf über `this`", () => {
    // WARUM DIESER NEGATIVFALL GEBRAUCHT WIRD: `require` ist ein gewöhnlicher Bezeichner. Im heute
    // erreichten Baum tragen VIER Dateien eine Methode dieses Namens, alle wörtlich als
    // `private async require(id: string): Promise<…>` (`services/ask`, `services/capture`,
    // `services/conflicts`, `services/knowledge-object`). Bräche Lieferung 1 hier ab, wäre der
    // gesunde Serverbaum sofort unbaubar. Der Aufruf geht über `this.` — ein Punkt davor.
    const baum = legeBaumAn({
      [EINSTIEG]: [
        "export class Dienst {",
        "  private async require(id: string): Promise<string> {",
        "    return id;",
        "  }",
        "  async hol(id: string): Promise<string> {",
        "    return await this.require(id);",
        "  }",
        "}",
        "",
      ].join("\n"),
    });

    expect(listeAus(erreichteQuellen(baum))).toEqual([EINSTIEG]);
  });

  it("R1e · die Kurzform-Methode `{ require(id) { … } }` ist ebenfalls eine Deklaration", () => {
    // Die zweite Deklarationsform. Sie verlangt seit Runde 3 DREI Merkmale: einen Gliedanfang davor
    // (hier das `{` des Objektliterals), ein `{` hinter der Klammer und den Rumpf auf DERSELBEN
    // Zeile. Nur das mittlere allein war Runde 2 — und hat echte Aufrufe verschluckt (R1k).
    const baum = legeBaumAn({
      [EINSTIEG]: [
        "const werkzeug = { require(id) { return id; } };",
        "class Werk { require(id) { return id; } }",
        'export const wert = [werkzeug.require("./gibt-es-nicht"), Werk];',
        "",
      ].join("\n"),
    });

    expect(listeAus(erreichteQuellen(baum))).toEqual([EINSTIEG]);
  });

  // ==============================================================================================
  // LIEFERUNG 1, RUNDE 2 · KONSTANZ GILT FÜR DAS GANZE LADEARGUMENT, NICHT FÜR SEIN ERSTES LITERAL.
  // ==============================================================================================
  //
  // BEN hat Runde 1 mit drei ECHTEN Paketstarts widerlegt (Urteil Runde 1, Prüfpunkte 1 und 4):
  // ein variables `require(p)` rutschte still durch, und eine Verkettung galt als konstant, weil
  // nur ihr ERSTES Literal gelesen wurde. Beide Male lief der Quellbaum und das Paket starb.
  //
  // JEDER DIESER FÄLLE LEGT DIE ABLENKDATEI AM FESTEN PRÄFIX WIRKLICH AN. Das ist der Punkt: ohne
  // sie bräche der Lauf ohnehin mit „dazu gibt es keine Datei" ab — richtige Farbe, falscher Grund.
  // MIT ihr war Runde 1 GRÜN und meldete eine vollständige Liste, in der die FALSCHE Datei stand.
  //
  // DIE TIEFE IST TEIL DER MESSUNG, nicht Schmuck (Runde 3, selbst nachgemessen): der Einstieg
  // liegt in `services/app/src/`, also trifft erst `../../../aussen/…` die Wurzel des Wegwerfbaums.
  // Bis Runde 2 stand hier `../../`; die Ablenkdatei lag damit gar nicht am festen Präfix, und die
  // Fälle bewiesen weniger, als ihr eigener Kommentar behauptete. `loeseAuf` gemessen:
  // `server.ts + ../../aussen/geladen` → nicht auflösbar, `+ ../../../aussen/geladen` → die Datei.
  it("R1f · `require(p)` mit variablem Pfad bricht ab und zeigt die Ladestelle wörtlich", () => {
    const baum = legeBaumAn({
      [EINSTIEG]: [
        'const pfad = "../../../aussen/geladen.cjs";',
        "export const geladen = require(pfad);",
        "",
      ].join("\n"),
      // Die Ablenkdatei EXISTIERT — trotzdem darf der Leser sie nicht für die richtige halten.
      "aussen/geladen.cjs": 'module.exports = { wert: "da" };\n',
    });

    const lauf = erreichteQuellen(baum);
    expect(lauf.status).not.toBe(0);
    expect(lauf.stderr).toContain("keine einzelne Zeichenkette");
    expect(lauf.stderr).toContain(EINSTIEG);
    // Die KONKRETE Stelle, nicht bloss ihre Form (BEN, Urteil Runde 1, Prüfpunkt 6).
    expect(lauf.stderr).toContain("require(pfad)");
  });

  it('R1g · `require("…" + endung)` bricht ab, obwohl die Datei am festen Präfix daneben liegt', () => {
    const baum = legeBaumAn({
      [EINSTIEG]: [
        'const endung = ".cjs";',
        'export const geladen = require("../../../aussen/geladen" + endung);',
        "",
      ].join("\n"),
      "aussen/geladen.cjs": 'module.exports = { wert: "da" };\n',
    });

    const lauf = erreichteQuellen(baum);
    expect(lauf.status).not.toBe(0);
    expect(lauf.stderr).toContain("keine einzelne Zeichenkette");
    expect(lauf.stderr).toContain(EINSTIEG);
    expect(lauf.stderr).toContain('require("../../../aussen/geladen" + endung)');
  });

  it('R1h · dasselbe für `import("…" + endung)` — eine Verkettung ist auch dort kein fester Pfad', () => {
    const baum = legeBaumAn({
      [EINSTIEG]: [
        'const endung = ".js";',
        'export const spaet = () => import("../../../aussen/geladen" + endung);',
        "",
      ].join("\n"),
      "aussen/geladen.js": 'export const wert = "da";\n',
    });

    const lauf = erreichteQuellen(baum);
    expect(lauf.status).not.toBe(0);
    expect(lauf.stderr).toContain("keine einzelne Zeichenkette");
    expect(lauf.stderr).toContain('import("../../../aussen/geladen" + endung)');
  });

  it('R1i · AUCH der berechnete PAKETNAME bricht ab — `"fastify" + endung` ist keine einzelne Zeichenkette', () => {
    // UMGEDREHT IN RUNDE 4, und das ist der Kern dieser Runde. Bis Runde 3 stand hier das Gegenteil:
    // ein Anfang, der wie ein Paketname aussieht, galt als Erlaubnis zum Überspringen. Genau dieser
    // Spalt hat BENs Gegenfälle durchgelassen — `"fs" && p` und `"fs" + "" ? p : "fs"` sahen darin
    // ebenso aus wie `"fastify" + endung`, luden aber einen relativen Pfad. Die Regel fragt seither
    // nicht mehr, wie ein Ausdruck ANFÄNGT, sondern nur, ob er genau ein Literal IST.
    //
    // Was das kostet, ist gemessen: der echte Serverbaum enthält keine solche Form, `fremdquellen`
    // liefert dort unverändert `["apps/web/src/lib/docx.ts"]`. Träte sie im Produkt auf, wäre der
    // Abbruch richtig und die Produktstelle zu benennen — nicht die Regel zu lockern.
    for (const ladung of ['import("fastify" + endung)', 'require("@scope/paket" + endung)']) {
      const baum = legeBaumAn({
        [EINSTIEG]: ['const endung = "/hilfe.js";', `export const a = () => ${ladung};`, ""].join(
          "\n",
        ),
      });

      const lauf = erreichteQuellen(baum);
      expect(lauf.status, `${ladung} musste abbrechen, lieferte aber: ${lauf.stdout}`).not.toBe(0);
      expect(lauf.stderr).toContain("keine einzelne Zeichenkette");
      expect(lauf.stderr).toContain(ladung);
    }
  });

  it('R1i2 · das NACKTE Literal bleibt übersprungen — `"fastify"`, `"node:fs"`, `"@scope/paket/hilfe.js"`', () => {
    // Die Gegenrichtung, die bleibt: fail-closed heisst nicht fail-immer. Ein Literal, das weder mit
    // `.` noch mit `/` beginnt, ist ein Paketname oder ein Node-Builtin — beides kommt über
    // `npm ci --omit=dev`. Ohne diese Grenze bräche der Bau an jedem `import "fastify"` ab.
    const baum = legeBaumAn({
      [EINSTIEG]: [
        'import "fastify";',
        'import { readFileSync } from "node:fs";',
        'export const a = () => import("@scope/paket/hilfe.js");',
        "export const b = readFileSync;",
        "",
      ].join("\n"),
    });

    expect(listeAus(erreichteQuellen(baum))).toEqual([EINSTIEG]);
  });

  it("R1i3 · ein ABSOLUTES Literal bricht ab — es liegt weder im Quellbaum noch kommt es über `npm ci`", () => {
    // Die dritte Sorte Literal, die die Weissliste unterscheidet. Bis Runde 3 fiel sie unter
    // „fängt nicht mit `.` an, also Paketname" und wurde still übersprungen; ein absoluter Pfad in
    // den Entwicklerbaum ist aber genau die Fehlerklasse von T-015, nur mit anderem Vorzeichen.
    const baum = legeBaumAn({
      [EINSTIEG]: ['export const a = () => import("/opt/klarwerk/teil.js");', ""].join("\n"),
    });

    const lauf = erreichteQuellen(baum);
    expect(lauf.status).not.toBe(0);
    expect(lauf.stderr).toContain("absoluter Pfad");
    expect(lauf.stderr).toContain("/opt/klarwerk/teil.js");
    expect(lauf.stderr).toContain(EINSTIEG);
  });

  it('R1j · ein konstanter Pfad MIT Importattributen bleibt eine Kante — `import("./x", { with: … })`', () => {
    // Das Komma beendet das erste Argument; der Pfad steht trotzdem fest. Zählte die Regel stur
    // „genau ein Merkmal bis zur schliessenden Klammer", fiele diese echte Kante aus dem Paket.
    const baum = legeBaumAn({
      [EINSTIEG]: [
        'export const spaet = () => import("./teil.js", { with: { type: "json" } });',
        "",
      ].join("\n"),
      "services/app/src/teil.ts": "export const x = 1;\n",
    });

    expect(listeAus(erreichteQuellen(baum))).toEqual([EINSTIEG, "services/app/src/teil.ts"]);
  });

  // ==============================================================================================
  // LIEFERUNG 1, RUNDE 3 · ÜBERSPRINGEN VERLANGT EINEN NACHWEIS — NICHT NUR EIN ANZEICHEN.
  // ==============================================================================================
  //
  // BEN hat Runde 2 mit VIER echten Paketstarts widerlegt (Urteil Runde 2, Korrekturpflichten 1
  // und 2). Zwei Anzeichen waren als Nachweis genommen worden, und beide tragen nicht:
  //
  //   EIN BLOCK DAHINTER  galt als Methodenrumpf. Er kann aber auch eine eigene Anweisung sein —
  //                       die automatische Semikoloneinfügung beendet `const t = require(p)` am
  //                       Zeilenende, und das `{` der nächsten Zeile ist ein Block. Der Ladevorgang
  //                       verschwand still. Nachweis ist jetzt die STELLUNG davor, nicht der Block.
  //   DAS ERSTE LITERAL   galt als fester Anfang des ganzen Ausdrucks. Bei `require("fs" && p)` ist
  //                       „fs" aber nur ein Operand: es sieht aus wie ein Paketname, also wurde die
  //                       Angabe still übersprungen — geladen wird `p`, und das ist relativ.
  it("R1k · ein echter `require(p)` vor einem Block auf der nächsten Zeile bricht ab, statt zu verschwinden", () => {
    // Die Datei am Pfad EXISTIERT; sie fiel trotzdem aus dem Paket, weil der Aufruf für eine
    // Deklaration gehalten wurde. Fail-closed heisst hier: benennen, nicht raten.
    const baum = legeBaumAn({
      [EINSTIEG]: [
        'const pfad = "../../../aussen/geladen.cjs";',
        "const teil = require(pfad)",
        "{",
        "  const nurEinBlock = 1;",
        "  void nurEinBlock;",
        "}",
        "export const wert = teil;",
        "",
      ].join("\n"),
      "aussen/geladen.cjs": 'module.exports = { wert: "da" };\n',
    });

    const lauf = erreichteQuellen(baum);
    expect(lauf.status).not.toBe(0);
    expect(lauf.stderr).toContain("keine einzelne Zeichenkette");
    expect(lauf.stderr).toContain(EINSTIEG);
    expect(lauf.stderr).toContain("require(pfad)");
  });

  it("R1l · derselbe Aufruf mit KONSTANTEM Pfad vor einem Block ist eine Kante — die Datei kommt mit", () => {
    // Die andere Hälfte von BENs Korrekturpflicht 1: „liefern die benötigte Datei ODER einen
    // begründeten Abbruch". Hier steht der Pfad fest, also gibt es nichts zu melden — nur zu holen.
    const baum = legeBaumAn({
      [EINSTIEG]: [
        'const teil = require("../../../aussen/geladen.cjs")',
        "{",
        "  const nurEinBlock = 1;",
        "  void nurEinBlock;",
        "}",
        "export const wert = teil;",
        "",
      ].join("\n"),
      "aussen/geladen.cjs": 'module.exports = { wert: "da" };\n',
    });

    expect(listeAus(erreichteQuellen(baum))).toEqual(["aussen/geladen.cjs", EINSTIEG]);
  });

  it("R1m · ALLE ACHT Gegenfälle-Ausdrucksformen von BEN brechen ab — für beide Lader", () => {
    // HIER STEHEN BENS GEGENFÄLLE AUS RUNDE 2 UND RUNDE 3 NEBENEINANDER, weil sie dasselbe zeigen:
    // jede Runde hat aus einem TEIL des Ausdrucks auf das GANZE geschlossen, und jede Runde ist an
    // der nächsten Form gescheitert.
    //
    //   RUNDE 2  `"fs" && p`            — „fs" galt als fester Anfang, geladen wird `p`.
    //   RUNDE 3  `"fs" + "" && p`       — die Verkettung erfüllte die `+`-Regel, ist aber nur der
    //            `"fs" + "" ? p : "fs"`   linke Operand von `&&` beziehungsweise `?:`.
    //
    // Seit Runde 4 wird über keine dieser Formen mehr etwas behauptet: keine ist genau ein Literal,
    // also bricht jede ab. `p` zeigt in jedem Baum auf eine WIRKLICH VORHANDENE Datei — sonst wäre
    // der Abbruch wertlos, er könnte auch nur „dazu gibt es keine Datei" bedeuten.
    const formen = [
      '"fs" && p',
      '"fs" || p',
      '"fs" + "" && p',
      '"fs" + "" ? p : "fs"',
      "p",
      '"fs" + p',
    ];

    for (const form of formen) {
      for (const lader of ["require", "import"]) {
        const ladung = `${lader}(${form})`;
        const baum = legeBaumAn({
          [EINSTIEG]: [
            'const p = "../../../aussen/geladen.cjs";',
            `export const wert = ${ladung};`,
            "",
          ].join("\n"),
          "aussen/geladen.cjs": 'module.exports = { wert: "da" };\n',
        });

        const lauf = erreichteQuellen(baum);
        expect(lauf.status, `${ladung} musste abbrechen, lieferte aber: ${lauf.stdout}`).not.toBe(
          0,
        );
        expect(lauf.stderr).toContain("keine einzelne Zeichenkette");
        expect(lauf.stderr).toContain(EINSTIEG);
        expect(lauf.stderr).toContain(ladung);
        // Datei UND Zeile — das ist die konkrete Ladestelle, mit der ein Mensch weitersucht.
        expect(lauf.stderr).toContain(`${EINSTIEG}:2`);
      }
    }
  });

  it("R1n · die Grenze, die BLEIBT: eine Kurzform-Methode mit Rumpf auf der NÄCHSTEN Zeile bricht ab", () => {
    // Hier wird eine Grenze GEMESSEN, nicht geschlossen (Dateikopf, Grenze b). Der Unterschied
    // zwischen dieser Deklaration und dem echten Aufruf aus R1k ist allein die Stellung davor — der
    // Leser kann beides nicht sicher trennen, sobald der Rumpf auf der nächsten Zeile beginnt. Er
    // entscheidet dann auf Aufruf: laut und behebbar, statt still ein Paket mit fehlender Datei.
    const baum = legeBaumAn({
      [EINSTIEG]: [
        "const werkzeug = {",
        "  require(id)",
        "  { return id; },",
        "};",
        "export const wert = werkzeug;",
        "",
      ].join("\n"),
    });

    const lauf = erreichteQuellen(baum);
    expect(lauf.status).not.toBe(0);
    expect(lauf.stderr).toContain("keine einzelne Zeichenkette");
    expect(lauf.stderr).toContain("require(id)");
  });

  // ==============================================================================================
  // LIEFERUNG 2 · eine erreichte JSX-Datei bricht ab, statt falsch gelesen zu werden.
  // ==============================================================================================
  it("R2 · eine erreichte `.tsx` bricht ab und nennt Einführer, Datei und Grund", () => {
    // `spaet.ts` EXISTIERT. Vor diesem Auftrag wurde die Kante dahin verschluckt (`</div>` begann
    // für den Leser einen regulären Ausdruck) — kein Fehler, und die Datei fehlte im Paket.
    const baum = legeBaumAn({
      [EINSTIEG]: ['import { flaeche } from "./flaeche";', "export const wert = flaeche;", ""].join(
        "\n",
      ),
      "services/app/src/flaeche.tsx": [
        "export const flaeche = async () => {",
        '  return <div>{(await import("./spaet")).x}</div>;',
        "};",
        "",
      ].join("\n"),
      "services/app/src/spaet.ts": "export const x = 1;\n",
    });

    const lauf = erreichteQuellen(baum);
    expect(lauf.status).not.toBe(0);
    expect(lauf.stderr).toContain("services/app/src/flaeche.tsx");
    expect(lauf.stderr).toContain(EINSTIEG);
    expect(lauf.stderr).toContain("JSX");
  });

  it("R2b · dasselbe für `.jsx` — und die Endungen bleiben, damit die Auflösung die Datei FINDET", () => {
    // Die Angabe ist endungslos (`./flaeche`). Stünde `.jsx` nicht mehr in `ENDUNGEN`, würde der
    // Lauf mit „dazu gibt es keine Datei" abbrechen — richtig wäre die Meldung, aber aus dem
    // falschen Grund. Geprüft wird deshalb der JSX-Grund, nicht bloss „hat geworfen".
    const baum = legeBaumAn({
      [EINSTIEG]: ['import { f } from "./flaeche";', "export const wert = f;", ""].join("\n"),
      "services/app/src/flaeche.jsx": "export const f = 1;\n",
    });

    const lauf = erreichteQuellen(baum);
    expect(lauf.status).not.toBe(0);
    expect(lauf.stderr).toContain("services/app/src/flaeche.jsx");
    expect(lauf.stderr).toContain("JSX");
  });

  // ==============================================================================================
  // LIEFERUNG 3 · jede Schablone mit `${…}` bricht ab; das Literal ohne Einsetzung bleibt eine Kante.
  // ==============================================================================================
  it("R3 · `import(`${basis}/teil.js`)` bricht ab — eine Schablone mit Einsetzung ist kein Literal", () => {
    const baum = legeBaumAn({
      [EINSTIEG]: [
        'const basis = "./teil";',
        "export const spaet = () => import(`${basis}/teil.js`);",
        "",
      ].join("\n"),
    });

    const lauf = erreichteQuellen(baum);
    expect(lauf.status).not.toBe(0);
    expect(lauf.stderr).toContain("keine einzelne Zeichenkette");
    expect(lauf.stderr).toContain(EINSTIEG);
  });

  it("R3b · AUCH `import(`fastify/${x}`)` bricht ab — der Kopf einer Schablone ist keine Erlaubnis", () => {
    // UMGEDREHT IN RUNDE 4, aus demselben Grund wie R1i: der Literalkopf `fastify/` war bis Runde 3
    // die Erlaubnis zum Überspringen, und genau daraus ist dreimal eine falsche Sicherheit
    // geworden. Eine Schablone MIT `${…}` ist keine einzelne Zeichenkette — mehr wird über sie
    // nicht gesagt, auch nichts über ihren Anfang.
    for (const ladung of ["import(`fastify/${x}`)", "import(`@scope/paket/${x}`)"]) {
      const baum = legeBaumAn({
        [EINSTIEG]: [`export const spaet = (x) => ${ladung};`, ""].join("\n"),
      });

      const lauf = erreichteQuellen(baum);
      expect(lauf.status, `${ladung} musste abbrechen, lieferte aber: ${lauf.stdout}`).not.toBe(0);
      expect(lauf.stderr).toContain("keine einzelne Zeichenkette");
      expect(lauf.stderr).toContain(ladung);
    }
  });

  it("R3b2 · die Schablone OHNE Einsetzung bleibt eine Kante — ``import(`./teil.js`)``", () => {
    // Die Gegenrichtung, die bleibt: `` `…` `` ohne `${…}` IST syntaktisch genau ein
    // Zeichenkettenliteral. Fiele sie unter den Abbruch, wäre die Weissliste zu eng und eine
    // wirklich geladene Datei verschwände — die Fehlerklasse von T-015 mit anderem Vorzeichen.
    const baum = legeBaumAn({
      [EINSTIEG]: ["export const spaet = () => import(`./teil.js`);", ""].join("\n"),
      "services/app/src/teil.ts": "export const x = 1;\n",
    });

    expect(listeAus(erreichteQuellen(baum))).toEqual([EINSTIEG, "services/app/src/teil.ts"]);
  });

  it("R3c · `import(<Ausdruck>)` bricht ab, auch wenn die Datei zufällig daneben liegt", () => {
    // Fail-closed: die Datei EXISTIERT hier, aber welcher Pfad zur Laufzeit entsteht, weiss der
    // Leser nicht — er darf sie also nicht für die richtige halten und schon gar nicht schweigen.
    const baum = legeBaumAn({
      [EINSTIEG]: [
        'const pfad = "./teil.js";',
        "export const spaet = () => import(pfad);",
        "",
      ].join("\n"),
      "services/app/src/teil.js": 'module.exports = { wert: "da" };\n',
    });

    const lauf = erreichteQuellen(baum);
    expect(lauf.status).not.toBe(0);
    expect(lauf.stderr).toContain("keine einzelne Zeichenkette");
    expect(lauf.stderr).toContain(EINSTIEG);
  });

  it("R3d · `import.meta.url` ist kein dynamischer Import und bricht nichts ab", () => {
    // Die Abgrenzung entscheidet das Zeichen hinter `import`: `(` ist ein dynamischer Import, `.`
    // ist `import.meta`. Ohne diese Grenze wäre der heutige Serverbaum sofort unbaubar.
    const baum = legeBaumAn({
      [EINSTIEG]: [
        "export const hier = import.meta.url;",
        "export const auch = new URL(import.meta.url);",
        "",
      ].join("\n"),
    });

    expect(listeAus(erreichteQuellen(baum))).toEqual([EINSTIEG]);
  });

  // ==============================================================================================
  // LIEFERUNG 7 · die neu gelesene Syntax wird WIRKLICH gestartet.
  // ==============================================================================================
  //
  // Vier Messungen, keine davon verzichtbar (Bauart aus `fremdquellen-im-paket.test.ts:238`):
  // der Quellbaum läuft · die Berechnung findet genau seine Fremdquelle · das gebaute Paket läuft ·
  // ohne die Datei endet der Start mit dem Fehler des Betreibers.
  //
  // GEMESSEN UND ABWEICHEND VOM ERWARTETEN WORTLAUT: CommonJS meldet `MODULE_NOT_FOUND`, nicht
  // `ERR_MODULE_NOT_FOUND` — diesen Code trägt nur der ESM-Lader. Dieselbe Fehlerklasse, anderer
  // Codename; hier steht der gemessene.
  it("L7 · die `require`-Kette läuft wirklich: Quellbaum, Paket — und ohne die Datei bricht der Start ab", () => {
    const EINSTIEG_CJS = "services/app/start.cjs";
    const GELADEN = "aussen/geladen.cjs";
    const baum = legeBaumAn({
      [EINSTIEG_CJS]: [
        'const geladen = require("../../aussen/geladen.cjs");',
        "console.log(`Ergebnis: ${geladen.wert}`);",
        "// Der Importtext daneben bleibt ein Datum und darf keine Datei verlangen.",
        `const beispiel = "const x = require('./gibt-es-nicht')";`,
        "module.exports = { beispiel };",
        "",
      ].join("\n"),
      [GELADEN]: 'module.exports = { wert: "da" };\n',
    });

    const original = starte(baum, EINSTIEG_CJS);
    expect(original.status, `der Quellbaum selbst muss laufen:\n${original.aus}`).toBe(0);
    expect(original.aus).toContain("Ergebnis: da");

    const gemeldet = modulJson<string[]>(
      `m.fremdquellen(${JSON.stringify(baum)}, ["${EINSTIEG_CJS}"])`,
    );
    expect(gemeldet).toEqual([GELADEN]);

    const paket = wegwerfordner();
    kopiereGefiltert(join(baum, "services"), join(paket, "services"));
    for (const pfad of gemeldet) {
      mkdirSync(dirname(join(paket, pfad)), { recursive: true });
      cpSync(join(baum, pfad), join(paket, pfad));
    }
    const imPaket = starte(paket, EINSTIEG_CJS);
    expect(imPaket.status, `das gebaute Paket muss starten:\n${imPaket.aus}`).toBe(0);
    expect(imPaket.aus).toContain("Ergebnis: da");

    rmSync(join(paket, GELADEN));
    const ohne = starte(paket, EINSTIEG_CJS);
    expect(ohne.status).not.toBe(0);
    expect(ohne.aus).toContain("Cannot find module");
    expect(ohne.aus).toContain("MODULE_NOT_FOUND");
    expect(ohne.aus).toContain("geladen.cjs");
  });

  // ==============================================================================================
  // L8 · DIE GANZE KETTE FÜR DIE VERKETTUNG — der Fall, den BEN mit echten Paketstarts widerlegte.
  // ==============================================================================================
  //
  // VIER MESSUNGEN, und die dritte ist der eigentliche Beleg:
  //   1. Der Quellbaum LÄUFT. Ohne das wäre ein Abbruch nichts wert — er könnte auch nur bedeuten,
  //      dass der Baum kaputt ist. `endung` wird zur Laufzeit zu `.cjs`, `require` findet die Datei.
  //   2. Der Paketbau BRICHT AB und nennt Einführer, Ladestelle wörtlich und Grund.
  //   3. Das Paket, das OHNE diesen Abbruch entstanden wäre, ist kaputt — und zwar UNAUFFÄLLIG.
  //      Am festen Präfix `../../aussen/geladen` liegt eine Datei (`geladen.cjs`), geladen wird zur
  //      Laufzeit aber eine andere (`geladen-echt.cjs`). Das Lesen nur des ersten Literals meldet
  //      deshalb eine VOLLSTÄNDIG aussehende Liste mit der FALSCHEN Datei — gemessen in der
  //      Kalibrierung dieser Runde: mit ausgeschalteter Lieferung liefert der Bau für genau diesen
  //      Baum `["aussen/geladen.cjs"]`. Wer danach kopiert, packt die Attrappe ein und lässt die
  //      wirklich geladene Datei liegen; der Start stirbt beim Kunden mit `MODULE_NOT_FOUND`.
  //      Ein falscher fester Pfad ist schlimmer als ein fehlender: er fällt nicht einmal auf.
  //   4. Steht dieselbe Endung FEST, ist der Pfad bekannt: derselbe Baum wird zur Kante, das daraus
  //      gebaute Paket startet, und ohne die Datei stirbt es. Fail-closed heisst nicht fail-immer.
  it("L8 · Verkettung: der Quellbaum läuft, der Bau bricht ab — und das Paket ohne Abbruch wäre kaputt", () => {
    const EINSTIEG_CJS = "services/app/start.cjs";
    const ATTRAPPE = "aussen/geladen.cjs"; // liegt am festen Präfix, wird aber NIE geladen
    const ECHT = "aussen/geladen-echt.cjs"; // das, was der Start wirklich lädt
    const rumpf = (ladung: string) =>
      [
        'const endung = "-echt.cjs";',
        `const geladen = ${ladung};`,
        "console.log(`Ergebnis: ${geladen.wert}`);",
        "",
      ].join("\n");
    const ladungen = {
      [ATTRAPPE]: 'module.exports = { wert: "ATTRAPPE" };\n',
      [ECHT]: 'module.exports = { wert: "da" };\n',
    };

    // 1 · der Quellbaum läuft wirklich — und lädt die ECHTE Datei, nicht die Attrappe.
    const baum = legeBaumAn({
      [EINSTIEG_CJS]: rumpf('require("../../aussen/geladen" + endung)'),
      ...ladungen,
    });
    const quellstart = starte(baum, EINSTIEG_CJS);
    expect(quellstart.status, `der Quellbaum selbst muss laufen:\n${quellstart.aus}`).toBe(0);
    expect(quellstart.aus).toContain("Ergebnis: da");

    // 2 · der Paketbau bricht ab — mit Einführer, Ladestelle wörtlich und Grund.
    const lauf = fahreModul(
      `process.stdout.write(JSON.stringify(m.fremdquellen(${JSON.stringify(baum)}, ["${EINSTIEG_CJS}"])));`,
    );
    expect(lauf.status, `der Bau musste abbrechen, lieferte aber: ${lauf.stdout}`).not.toBe(0);
    expect(lauf.stderr).toContain("keine einzelne Zeichenkette");
    expect(lauf.stderr).toContain(EINSTIEG_CJS);
    expect(lauf.stderr).toContain('require("../../aussen/geladen" + endung)');

    // 3 · das Paket, das ohne den Abbruch entstanden wäre: die Attrappe drin, die Ladung fehlt.
    const kaputt = wegwerfordner();
    kopiereGefiltert(join(baum, "services"), join(kaputt, "services"));
    for (const pfad of [ATTRAPPE]) {
      mkdirSync(dirname(join(kaputt, pfad)), { recursive: true });
      cpSync(join(baum, pfad), join(kaputt, pfad));
    }
    expect(existsSync(join(kaputt, ATTRAPPE)), "die Attrappe ist mitgekommen").toBe(true);
    expect(existsSync(join(kaputt, ECHT)), "die wirklich geladene Datei fehlt").toBe(false);
    const kaputterStart = starte(kaputt, EINSTIEG_CJS);
    expect(kaputterStart.status).not.toBe(0);
    expect(kaputterStart.aus).toContain("MODULE_NOT_FOUND");
    expect(kaputterStart.aus).toContain("geladen-echt.cjs");

    // 4 · dieselbe Ladung mit FESTEM Pfad: Kante, Paket startet, ohne die Datei stirbt es.
    const fest = legeBaumAn({
      [EINSTIEG_CJS]: rumpf('require("../../aussen/geladen-echt.cjs")'),
      ...ladungen,
    });
    const gemeldet = modulJson<string[]>(
      `m.fremdquellen(${JSON.stringify(fest)}, ["${EINSTIEG_CJS}"])`,
    );
    // Genau die geladene Datei — die Attrappe daneben taucht nicht auf, es führt keine Kante zu ihr.
    expect(gemeldet).toEqual([ECHT]);

    const heil = wegwerfordner();
    kopiereGefiltert(join(fest, "services"), join(heil, "services"));
    for (const pfad of gemeldet) {
      mkdirSync(dirname(join(heil, pfad)), { recursive: true });
      cpSync(join(fest, pfad), join(heil, pfad));
    }
    const heilerStart = starte(heil, EINSTIEG_CJS);
    expect(heilerStart.status, `das gebaute Paket muss starten:\n${heilerStart.aus}`).toBe(0);
    expect(heilerStart.aus).toContain("Ergebnis: da");

    rmSync(join(heil, ECHT));
    const ohne = starte(heil, EINSTIEG_CJS);
    expect(ohne.status).not.toBe(0);
    expect(ohne.aus).toContain("MODULE_NOT_FOUND");
    expect(ohne.aus).toContain("geladen-echt.cjs");
  });

  // ==============================================================================================
  // L9 · DIE GANZE KETTE FÜR DEN BLOCK-FALL — BENs Korrekturpflicht 1, mit echten Starts.
  // ==============================================================================================
  //
  // Ein Paket, das ohne Abbruch entsteht, ist erst dann widerlegt, wenn es WIRKLICH stirbt. Deshalb
  // steht hier dieselbe Vierteilung wie in L7/L8 — und beide Hälften der Korrekturpflicht:
  // der konstante Pfad LIEFERT die Datei, der variable BRICHT AB.
  it("L9 · Block auf der nächsten Zeile: die Kante kommt mit, der variable Aufruf bricht ab — beides gestartet", () => {
    const EINSTIEG_CJS = "services/app/start.cjs";
    const GELADEN = "aussen/geladen.cjs";
    const rumpf = (ladung: string) =>
      [
        'const pfad = "../../aussen/geladen.cjs";',
        "void pfad;",
        `const geladen = ${ladung}`,
        "{",
        "  const nurEinBlock = 1;",
        "  void nurEinBlock;",
        "}",
        "console.log(`Ergebnis: ${geladen.wert}`);",
        "",
      ].join("\n");
    const ladung = { [GELADEN]: 'module.exports = { wert: "da" };\n' };

    // A · KONSTANTER PFAD. Der Quellbaum läuft, die Berechnung findet die Datei, das Paket läuft —
    // und ohne die Datei stirbt es. Bis Runde 2 fehlte sie im Paket, ohne dass etwas auffiel.
    const fest = legeBaumAn({
      [EINSTIEG_CJS]: rumpf('require("../../aussen/geladen.cjs")'),
      ...ladung,
    });
    const festStart = starte(fest, EINSTIEG_CJS);
    expect(festStart.status, `der Quellbaum selbst muss laufen:\n${festStart.aus}`).toBe(0);
    expect(festStart.aus).toContain("Ergebnis: da");

    const gemeldet = modulJson<string[]>(
      `m.fremdquellen(${JSON.stringify(fest)}, ["${EINSTIEG_CJS}"])`,
    );
    expect(gemeldet).toEqual([GELADEN]);

    const paket = wegwerfordner();
    kopiereGefiltert(join(fest, "services"), join(paket, "services"));
    for (const pfad of gemeldet) {
      mkdirSync(dirname(join(paket, pfad)), { recursive: true });
      cpSync(join(fest, pfad), join(paket, pfad));
    }
    const imPaket = starte(paket, EINSTIEG_CJS);
    expect(imPaket.status, `das gebaute Paket muss starten:\n${imPaket.aus}`).toBe(0);
    expect(imPaket.aus).toContain("Ergebnis: da");

    rmSync(join(paket, GELADEN));
    const ohne = starte(paket, EINSTIEG_CJS);
    expect(ohne.status).not.toBe(0);
    expect(ohne.aus).toContain("MODULE_NOT_FOUND");
    expect(ohne.aus).toContain("geladen.cjs");

    // B · VARIABLER PFAD. Derselbe Baum lädt, der Bau bricht ab — und das Paket, das ohne den
    // Abbruch entstanden wäre (nur `services`, wie der Bauer es kopiert), stirbt beim Start.
    const variabel = legeBaumAn({ [EINSTIEG_CJS]: rumpf("require(pfad)"), ...ladung });
    const variabelStart = starte(variabel, EINSTIEG_CJS);
    expect(variabelStart.status, `der Quellbaum selbst muss laufen:\n${variabelStart.aus}`).toBe(0);
    expect(variabelStart.aus).toContain("Ergebnis: da");

    const lauf = fahreModul(
      `process.stdout.write(JSON.stringify(m.fremdquellen(${JSON.stringify(variabel)}, ["${EINSTIEG_CJS}"])));`,
    );
    expect(lauf.status, `der Bau musste abbrechen, lieferte aber: ${lauf.stdout}`).not.toBe(0);
    expect(lauf.stderr).toContain("keine einzelne Zeichenkette");
    expect(lauf.stderr).toContain(EINSTIEG_CJS);
    expect(lauf.stderr).toContain("require(pfad)");

    const kaputt = wegwerfordner();
    kopiereGefiltert(join(variabel, "services"), join(kaputt, "services"));
    expect(existsSync(join(kaputt, GELADEN)), "die geladene Datei fehlt im Paket").toBe(false);
    const kaputterStart = starte(kaputt, EINSTIEG_CJS);
    expect(kaputterStart.status).not.toBe(0);
    expect(kaputterStart.aus).toContain("MODULE_NOT_FOUND");
    expect(kaputterStart.aus).toContain("geladen.cjs");
  });

  // ==============================================================================================
  // L10 · DIE GANZE KETTE FÜR JEDE OPERANDENFORM — BENs Gegenfälle aus Runde 2 UND Runde 3.
  // ==============================================================================================
  //
  // DREI FORMEN, ZWEI LADER, SECHS ECHTE PAKETSTARTS. Alle drei Formen haben einen scheinbaren
  // Anfang, der wie ein PAKETNAME aussieht — das war die Erlaubnis zum stillen Überspringen, und
  // jede Runde hat eine davon geschlossen und die nächste offen gelassen:
  //
  //   `"fs" && p`             BEN Runde 2 — das erste Literal galt als fester Anfang.
  //   `"fs" + "" && p`        BEN Runde 3 — die Verkettung erfüllte die `+`-Regel von Runde 3.
  //   `"fs" + "" ? p : "fs"`  BEN Runde 3 — dieselbe Verkettung als Bedingung statt als Operand.
  //
  // Jede wird WIRKLICH gestartet: `require` im CommonJS-Baum (`MODULE_NOT_FOUND`), `import` im
  // ESM-Baum (`ERR_MODULE_NOT_FOUND`). Vier Messungen je Fall — der Quellbaum läuft und lädt die
  // Datei, der Bau bricht mit Datei:Zeile und Ladestelle ab, die Datei fehlt im Paket ohne Abbruch,
  // und dieses Paket stirbt beim ersten Start.
  it("L10 · jede Operandenform: der Quellbaum läuft, der Bau bricht ab, das Paket ohne Abbruch stirbt", () => {
    const lader = [
      {
        name: "require (CommonJS)",
        einstieg: "services/app/start.cjs",
        geladen: "aussen/geladen.cjs",
        ladung: 'module.exports = { wert: "da" };\n',
        ruf: (form: string) => `require(${form})`,
        fehler: "MODULE_NOT_FOUND",
      },
      {
        name: "import (ESM)",
        einstieg: "services/app/start.mjs",
        geladen: "aussen/geladen.mjs",
        ladung: 'export const wert = "da";\n',
        ruf: (form: string) => `await import(${form})`,
        fehler: "ERR_MODULE_NOT_FOUND",
      },
    ];
    const formen = ['"fs" && p', '"fs" + "" && p', '"fs" + "" ? p : "fs"'];

    for (const l of lader) {
      for (const form of formen) {
        const was = `${l.name} · ${form}`;
        const stelle = l.ruf(form).replace(/^await /, "");
        const baum = legeBaumAn({
          [l.einstieg]: [
            `const p = "../../${l.geladen}";`,
            `const geladen = ${l.ruf(form)};`,
            "console.log(`Ergebnis: ${geladen.wert}`);",
            "",
          ].join("\n"),
          [l.geladen]: l.ladung,
        });

        // 1 · der Quellbaum läuft — der Ausdruck ergibt zur Laufzeit den relativen Pfad.
        const quellstart = starte(baum, l.einstieg);
        expect(quellstart.status, `${was}: der Quellbaum muss laufen:\n${quellstart.aus}`).toBe(0);
        expect(quellstart.aus).toContain("Ergebnis: da");

        // 2 · der Bau bricht ab, mit Datei:Zeile und Ladestelle wörtlich.
        const lauf = fahreModul(
          `process.stdout.write(JSON.stringify(m.fremdquellen(${JSON.stringify(baum)}, ["${l.einstieg}"])));`,
        );
        expect(lauf.status, `${was}: musste abbrechen, lieferte aber: ${lauf.stdout}`).not.toBe(0);
        expect(lauf.stderr).toContain("keine einzelne Zeichenkette");
        expect(lauf.stderr).toContain(`${l.einstieg}:2`);
        expect(lauf.stderr).toContain(stelle);

        // 3 · das Paket, das ohne den Abbruch entstanden wäre, stirbt beim ersten Start.
        const kaputt = wegwerfordner();
        kopiereGefiltert(join(baum, "services"), join(kaputt, "services"));
        expect(existsSync(join(kaputt, l.geladen)), `${was}: die Ladung fehlt`).toBe(false);
        const kaputterStart = starte(kaputt, l.einstieg);
        expect(kaputterStart.status).not.toBe(0);
        expect(kaputterStart.aus).toContain(l.fehler);
      }
    }
  });

  // ==============================================================================================
  // RUNDE 5 · STUFE ZWEI DER WEISSLISTE — DER ROHTEXT EINES LITERALS IST NOCH KEIN PFAD.
  // ==============================================================================================
  //
  // BEN hat Runde 4 mit VIER echten Paketstarts widerlegt (Urteil Runde 4). Die Formregel stand:
  // übersprungen wurde nur, was syntaktisch GENAU EIN Zeichenkettenliteral ist. Beurteilt wurde
  // dieses Literal aber an seinem ROHTEXT — und der Zerleger gibt Escape-Sequenzen unverändert
  // zurück (`paketinhalt.mjs`, `lesAnfuehrung` und der Schablonenzweig):
  //
  //   `require("\x2e./../aussen/geladen.cjs")`   Rohtext beginnt mit `\`, also weder `.` noch `/`,
  //                                              also „Paketname", also still übersprungen.
  //                                              Node liest `\x2e` als `.` und lädt `../../…`.
  //
  // Vier Gegenfälle, zwei Schreibweisen mal zwei Lader, jedes Mal derselbe Ausgang: Quellstart
  // Exit 0 · Inhaltsberechnung Exit 0 mit `[]` · Paketstart Exit 1 mit `MODULE_NOT_FOUND` bzw.
  // `ERR_MODULE_NOT_FOUND`. Seit dieser Runde brechen sie ab.
  //
  // WAS HIER NICHT GEBAUT WURDE UND WARUM: kein Escape-Dekoder. Er müsste `\x`, `\u`, `\u{…}`, die
  // Oktalformen, die Zeilenfortsetzung und die Einzelzeichen-Escapes alle genau so lesen wie Node,
  // und die erste Abweichung wäre wieder eine still fehlende Datei — die fünfte Heuristik derselben
  // Bauart. Stattdessen gilt die Bedingung, unter der Rohtext und Wert NACHWEISLICH dasselbe sind.
  //
  // Die Escapes werden hier aus `RUECKSTRICH` zusammengesetzt und nicht als TypeScript-Escape
  // geschrieben: so steht im erzeugten Quelltext nachweislich ein Rückstrich. Dass er richtig
  // ankommt, misst jeder Fall selbst — der Quellbaum startet und lädt die Datei WIRKLICH.
  const RUECKSTRICH = String.fromCharCode(0x5c);

  it("R4a · ein Literal mit Escape-Sequenz bricht ab — der Rohtext sieht nicht relativ aus, der Wert ist es", () => {
    // Die Datei EXISTIERT und wird WIRKLICH geladen. Bis Runde 4 lieferte dieser Baum eine leere
    // Fremdquellenliste und damit ein Paket, dem sie fehlt.
    const EINSTIEG_CJS = "services/app/start.cjs";
    const baum = legeBaumAn({
      [EINSTIEG_CJS]: [
        `const geladen = require("${RUECKSTRICH}x2e./../aussen/geladen.cjs");`,
        "console.log(`Ergebnis: ${geladen.wert}`);",
        "",
      ].join("\n"),
      "aussen/geladen.cjs": 'module.exports = { wert: "da" };\n',
    });

    const quellstart = starte(baum, EINSTIEG_CJS);
    expect(quellstart.status, `der Quellbaum selbst muss laufen:\n${quellstart.aus}`).toBe(0);
    expect(quellstart.aus).toContain("Ergebnis: da");

    const lauf = erreichteQuellen(baum, EINSTIEG_CJS);
    expect(lauf.status, `musste abbrechen, lieferte aber: ${lauf.stdout}`).not.toBe(0);
    expect(lauf.stderr).toContain("nicht sicher lesbar");
    expect(lauf.stderr).toContain("Rueckstrich");
    // Datei UND Zeile — das ist die Ladestelle, mit der ein Mensch weitersucht.
    expect(lauf.stderr).toContain(`${EINSTIEG_CJS}:1`);
    expect(lauf.stderr).toContain(`${RUECKSTRICH}x2e./../aussen/geladen.cjs`);
  });

  it("R4b · dasselbe in der Schablone — sie bewahrt Escapes genauso", () => {
    const EINSTIEG_MJS = "services/app/start.mjs";
    const baum = legeBaumAn({
      [EINSTIEG_MJS]: [
        `const geladen = await import(\`${RUECKSTRICH}u002e./../aussen/geladen.mjs\`);`,
        "console.log(`Ergebnis: ${geladen.wert}`);",
        "",
      ].join("\n"),
      "aussen/geladen.mjs": 'export const wert = "da";\n',
    });

    const quellstart = starte(baum, EINSTIEG_MJS);
    expect(quellstart.status, `der Quellbaum selbst muss laufen:\n${quellstart.aus}`).toBe(0);
    expect(quellstart.aus).toContain("Ergebnis: da");

    const lauf = erreichteQuellen(baum, EINSTIEG_MJS);
    expect(lauf.status, `musste abbrechen, lieferte aber: ${lauf.stdout}`).not.toBe(0);
    expect(lauf.stderr).toContain("nicht sicher lesbar");
    expect(lauf.stderr).toContain(`${EINSTIEG_MJS}:1`);
  });

  it('R4c · auch `import "…"` und `from "…"` werden am WERT geprüft, nicht nur der dynamische Lader', () => {
    // Die Stufe steht an EINER Stelle für alle drei Lader. Ohne das wäre sie nur für `import(…)`
    // und `require(…)` gesetzt — und die statische Einfuhr bliebe der nächste stille Ausgang.
    const EINSTIEG_MJS = "services/app/start.mjs";
    for (const zeile of [
      `import { wert } from "${RUECKSTRICH}x2e./../aussen/geladen.mjs";`,
      `import "${RUECKSTRICH}x2e./../aussen/geladen.mjs";`,
      `export { wert } from "${RUECKSTRICH}x2e./../aussen/geladen.mjs";`,
    ]) {
      const baum = legeBaumAn({
        [EINSTIEG_MJS]: `${zeile}\nvoid 0;\n`,
        "aussen/geladen.mjs": 'export const wert = "da";\n',
      });
      const lauf = erreichteQuellen(baum, EINSTIEG_MJS);
      expect(lauf.status, `${zeile} musste abbrechen, lieferte aber: ${lauf.stdout}`).not.toBe(0);
      expect(lauf.stderr).toContain("nicht sicher lesbar");
      expect(lauf.stderr).toContain(`${EINSTIEG_MJS}:1`);
    }
  });

  it("R4d · eine Zeilenfortsetzung im Literal bricht ab — BENs Prüflücke 6, wörtlich", () => {
    // `"./aussen/gela\<Zeilenende>den.mjs"` ist ein einziges Literal mit dem Wert
    // `./aussen/geladen.mjs`. Der Rohtext trägt einen Rückstrich und ein Zeilenende — er ist nicht
    // der Wert, und der Zerleger bricht eine Zeichenkette am Zeilenende ohnehin ab.
    const EINSTIEG_MJS = "services/app/start.mjs";
    const baum = legeBaumAn({
      [EINSTIEG_MJS]: [
        `const geladen = await import("../../aussen/gela${RUECKSTRICH}`,
        'den.mjs");',
        "console.log(`Ergebnis: ${geladen.wert}`);",
        "",
      ].join("\n"),
      "aussen/geladen.mjs": 'export const wert = "da";\n',
    });

    const quellstart = starte(baum, EINSTIEG_MJS);
    expect(quellstart.status, `der Quellbaum selbst muss laufen:\n${quellstart.aus}`).toBe(0);
    expect(quellstart.aus).toContain("Ergebnis: da");

    const lauf = erreichteQuellen(baum, EINSTIEG_MJS);
    expect(lauf.status, `musste abbrechen, lieferte aber: ${lauf.stdout}`).not.toBe(0);
    expect(lauf.stderr).toContain("nicht sicher lesbar");
    expect(lauf.stderr).toContain(EINSTIEG_MJS);
  });

  it("R4e · ein Zeichen ausserhalb der Liste bricht ab — und die Meldung NENNT das Zeichen", () => {
    // Kein Rückstrich, trotzdem kein sicherer Wert: die Liste ist eine Weissliste. Sie nennt das
    // störende Zeichen, damit ein Mensch nicht suchen muss, welches von vielen gemeint ist.
    const baum = legeBaumAn({
      [EINSTIEG]: ['export const a = () => import("./teil datei.js");', ""].join("\n"),
    });

    const lauf = erreichteQuellen(baum);
    expect(lauf.status, `musste abbrechen, lieferte aber: ${lauf.stdout}`).not.toBe(0);
    expect(lauf.stderr).toContain("nicht sicher lesbar");
    expect(lauf.stderr).toContain("ausserhalb von [A-Za-z0-9@/._:-]");
    expect(lauf.stderr).toContain(EINSTIEG);
  });

  it("R4f · das LEERE Literal bricht ab — es benennt gar keine Datei", () => {
    const baum = legeBaumAn({
      [EINSTIEG]: ['export const a = () => import("");', ""].join("\n"),
    });

    const lauf = erreichteQuellen(baum);
    expect(lauf.status, `musste abbrechen, lieferte aber: ${lauf.stdout}`).not.toBe(0);
    expect(lauf.stderr).toContain("nicht sicher lesbar");
    expect(lauf.stderr).toContain("leer");
  });

  it("R4g · die Gegenrichtung: der Doppelpunkt der Node-Builtins bleibt erlaubt, `.`/`-`/`@` auch", () => {
    // Fail-closed heisst nicht fail-immer. Das `:` steht in der Zeichenliste, weil der erreichte
    // Baum es braucht (`node:fs` und Geschwister, 286 Dateien gemessen) — ohne es bräche der Bau
    // an jeder Node-Builtin-Einfuhr ab. Gemessen wird das am echten Repo in Fall B von
    // `fremdquellen-im-paket.test.ts`; hier steht der kleine, lesbare Beleg daneben.
    const baum = legeBaumAn({
      [EINSTIEG]: [
        'import { readFileSync } from "node:fs";',
        'import "@scope/paket-name/hilfe.js";',
        'export const a = () => import("./teil-zwei.js");',
        "export const b = readFileSync;",
        "",
      ].join("\n"),
      "services/app/src/teil-zwei.ts": "export const x = 1;\n",
    });

    expect(listeAus(erreichteQuellen(baum))).toEqual([EINSTIEG, "services/app/src/teil-zwei.ts"]);
  });

  // ==============================================================================================
  // L11 · DIE GANZE KETTE FÜR BENS VIER GEGENFÄLLE AUS RUNDE 4 — mit echten Starts.
  // ==============================================================================================
  //
  // Zwei Schreibweisen mal zwei Lader. Vier Messungen je Fall, wie in L7/L8/L9/L10:
  //   1. Der Quellbaum LÄUFT und lädt die Datei wirklich — sonst bewiese ein Abbruch nichts.
  //   2. Der Bau BRICHT AB, mit Datei:Zeile, Rohtext und Grund.
  //   3. Die Datei fehlt in dem Paket, das OHNE den Abbruch entstanden wäre (der Bauer kopiert
  //      `services` plus die gemeldeten Fremdquellen — gemeldet wurde `[]`).
  //   4. Dieses Paket STIRBT beim ersten Start, genau mit dem Fehler des Betreibers.
  it("L11 · Escape-Schreibweisen: der Quellbaum läuft, der Bau bricht ab, das Paket ohne Abbruch stirbt", () => {
    const lader = [
      {
        name: "require (CommonJS)",
        einstieg: "services/app/start.cjs",
        geladen: "aussen/geladen.cjs",
        ladung: 'module.exports = { wert: "da" };\n',
        ruf: (pfad: string) => `require("${pfad}")`,
        fehler: "MODULE_NOT_FOUND",
      },
      {
        name: "import (ESM)",
        einstieg: "services/app/start.mjs",
        geladen: "aussen/geladen.mjs",
        ladung: 'export const wert = "da";\n',
        ruf: (pfad: string) => `await import(\`${pfad}\`)`,
        fehler: "ERR_MODULE_NOT_FOUND",
      },
    ];
    // Beide Male derselbe Wert `../../aussen/geladen.<endung>`, nur anders geschrieben.
    const schreibweisen = [
      { name: "hex", anfang: `${RUECKSTRICH}x2e./../` },
      { name: "unicode", anfang: `${RUECKSTRICH}u002e./../` },
    ];

    for (const l of lader) {
      for (const s of schreibweisen) {
        const was = `${l.name} · ${s.name}`;
        const pfad = `${s.anfang}${l.geladen}`;
        const baum = legeBaumAn({
          [l.einstieg]: [
            `const geladen = ${l.ruf(pfad)};`,
            "console.log(`Ergebnis: ${geladen.wert}`);",
            "",
          ].join("\n"),
          [l.geladen]: l.ladung,
        });

        // 1 · der Quellbaum läuft — die Sprache liest das Escape als `.`, geladen wird relativ.
        const quellstart = starte(baum, l.einstieg);
        expect(quellstart.status, `${was}: der Quellbaum muss laufen:\n${quellstart.aus}`).toBe(0);
        expect(quellstart.aus).toContain("Ergebnis: da");

        // 2 · der Bau bricht ab, mit Datei:Zeile, Rohtext und Grund.
        const lauf = fahreModul(
          `process.stdout.write(JSON.stringify(m.fremdquellen(${JSON.stringify(baum)}, ["${l.einstieg}"])));`,
        );
        expect(lauf.status, `${was}: musste abbrechen, lieferte aber: ${lauf.stdout}`).not.toBe(0);
        expect(lauf.stderr).toContain("nicht sicher lesbar");
        expect(lauf.stderr).toContain("Rueckstrich");
        expect(lauf.stderr).toContain(`${l.einstieg}:1`);
        expect(lauf.stderr).toContain(pfad);

        // 3 + 4 · das Paket, das ohne den Abbruch entstanden wäre, stirbt beim ersten Start.
        const kaputt = wegwerfordner();
        kopiereGefiltert(join(baum, "services"), join(kaputt, "services"));
        expect(existsSync(join(kaputt, l.geladen)), `${was}: die Ladung fehlt`).toBe(false);
        const kaputterStart = starte(kaputt, l.einstieg);
        expect(kaputterStart.status).not.toBe(0);
        expect(kaputterStart.aus).toContain(l.fehler);
      }
    }
  });
});
