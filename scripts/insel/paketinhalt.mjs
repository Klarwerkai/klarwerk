#!/usr/bin/env node
// ================================================================================================
// JOB 4241 — WAS EIN RELEASE MITBRINGEN MUSS, DAMIT ES IN EINER LEEREN UMGEBUNG STARTET.
// ================================================================================================
//
// DIE LÜCKE, GEGEN DIE DIESE DATEI STEHT (Befund T-015). `build-current-release.mjs` kopierte genau
// zwei Bäume in ein Release: `services` und `apps/web/dist`. Der Server lädt aber beim Start eine
// dritte Stelle — `services/app/src/routes/capture-routes.ts:12` führt den DOM-freien DOCX-Kern aus
// `apps/web/src/lib/docx.ts` ein, und zwar AUSDRÜCKLICH von dort und nicht als Kopie
// (`capture-routes.ts:7-11`). Auf der Insel liegt kein Repo daneben. Das ausgepackte Paket endete
// deshalb beim ersten `start.command` mit `ERR_MODULE_NOT_FOUND apps/web/src/lib/docx`.
//
// DIE NAHELIEGENDE HALBHEIT WÄRE EINE KOPIERLISTE. Trüge der Bauer `apps/web/src/lib/docx.ts` fest
// ein, wäre genau dieser eine Fall geschlossen — und der nächste Querimport bräche das Paket wieder,
// unbemerkt bis zum Kunden. Deshalb wird die Liste BERECHNET: aus den Einstiegen, die das Release
// wirklich fährt, den relativen Import-/Exportkanten hinterher, quer durch den Quellbaum.
//
// WARUM ES EIN EIGENES MODUL IST UND NICHT EINE FUNKTION IM BAUER — dieselbe Begründung wie bei
// `release-texte.mjs:5-12` und `schema-vertrag.mjs`: Die Baudatei räumt beim Laden Verzeichnisse ab
// und ruft `git`, `npm ci` und `zip`. Ein Test kann sie nicht einführen. Was hier steht, hat KEINE
// Nebenwirkung: es liest Dateien und gibt Pfade zurück, mehr nicht — und ist damit wirklich fahrbar
// prüfbar (`tests/insel-paketausgabe/fremdquellen-im-paket.test.ts`).
//
// WAS AUSDRÜCKLICH KEINE FREMDQUELLE IST: ein nackter Paketname (`fastify`, `mammoth`, `jszip`).
// Die kommen über `package.json` und `npm ci --omit=dev` ins Release (`build-current-release.mjs`),
// nicht über den Quellbaum. Verfolgt werden nur RELATIVE Angaben.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { startBefehlText } from "./release-texte.mjs";

/**
 * Die Endungen, mit denen eine endungslose Angabe aufgelöst wird — in dieser Reihenfolge.
 * `tsx` löst genauso auf; die Reihenfolge entscheidet nur bei Doppelbelegung.
 *
 * JOB 4285: `.tsx` und `.jsx` bleiben ausdrücklich in dieser Liste, obwohl der Zerleger JSX nicht
 * sicher liest. Der Grund ist derselbe Fail-closed-Gedanke wie überall hier: die Auflösung soll die
 * Datei FINDEN, damit `erreichteQuellen` sie benennen und mit Grund abbrechen kann. Nähme man die
 * Endungen heraus, endete derselbe Baum mit „dazu gibt es keine Datei" — richtige Farbe, falscher
 * Grund, und ein Mensch sucht an der falschen Stelle.
 */
const ENDUNGEN = [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".cjs"];

/** Eine Datei, deren Inhalt JSX sein kann — sie wird gefunden, aber nicht gelesen (JOB 4285). */
function istJsxDatei(pfad) {
  return pfad.endsWith(".tsx") || pfad.endsWith(".jsx");
}

/** Verzeichnis-Einstiege. `./lib` darf auch `./lib/index.ts` meinen. */
const INDEXNAMEN = ENDUNGEN.map((endung) => `index${endung}`);

/**
 * DIE EINSTIEGE, DIE DAS RELEASE WIRKLICH FÄHRT — abgelesen am ausgelieferten `start.command`.
 *
 * WARUM ABGELESEN UND NICHT HINGESCHRIEBEN: Eine zweite Liste neben dem Startbefehl wäre genau die
 * Sorte stiller Doppelung, die dieser Auftrag beseitigt. Zieht der Start eines Tages einen anderen
 * Einstieg an, wandert der Paketinhalt von selbst mit. Die Quelle ist `release-texte.mjs`
 * (`startBefehlText`, Zeile `exec "$NODE_BIN" … "$ROOT/services/app/src/server.ts"`).
 *
 * `$ROOT/node_modules/…` wird ausgelassen: der Lader (`tsx`) kommt aus `npm ci`, nicht aus dem
 * Quellbaum. FAIL-CLOSED: Findet die Ablesung keinen Einstieg, ist das ein Fehler und keine leere
 * Liste — eine leere Einstiegsmenge meldete pflichtschuldig „null Fremdquellen" und baute wieder
 * genau das halbe Paket, gegen das diese Datei steht.
 */
export function laufzeitEinstiege(startbefehl = startBefehlText()) {
  const zeile = startbefehl
    .split("\n")
    .find((z) => z.trimStart().startsWith("exec ") && z.includes("$ROOT/"));
  if (zeile === undefined) {
    throw new Error("Paketinhalt: im start.command steht keine exec-Zeile mit $ROOT/ — Einstieg unbekannt.");
  }
  const einstiege = [...zeile.matchAll(/\$ROOT\/([^"'\s]+)/g)]
    .map((treffer) => treffer[1])
    .filter((pfad) => !pfad.startsWith("node_modules/"));
  if (einstiege.length === 0) {
    throw new Error(`Paketinhalt: die exec-Zeile nennt keinen Einstieg ausserhalb von node_modules: ${zeile.trim()}`);
  }
  return einstiege;
}

// ================================================================================================
// IMPORTSYNTAX GEGEN IMPORTTEXT — warum hier zerlegt und nicht gesucht wird.
// ================================================================================================
//
// RUNDE 3 SUCHTE MIT MUSTERN IM TEXT, und BEN hat beide Richtungen widerlegt, in denen das falsch
// liegt (Urteil Runde 3, Korrekturpflicht 1):
//
//   ZU VIEL   `const s = "import { x } from './gibt-es-nicht'"` ist ein DATUM. Die Mustersuche las
//             darin eine Kante, verlangte eine Datei, die niemand lädt — und hätte mit der
//             Fail-closed-Regel (Lieferung 3) einen Baulauf abgebrochen, obwohl nichts fehlt.
//   ZU WENIG  ``import(`./wirklich-geladen`)`` ist echte Syntax mit konstantem Pfad. Die Muster
//             kannten nur `'` und `"`. Die Datei wäre still aus dem Paket gefallen — also genau
//             `ERR_MODULE_NOT_FOUND` beim Betreiber, der Befund T-015, gegen den dieser Auftrag steht.
//
// Beides ist eine STELLUNGSFRAGE und keine Zeichenfrage: Eine Zeichenkette ist genau dann eine
// Modulangabe, wenn sie an der Stelle steht, an der die Sprache eine erwartet. Deshalb wird der
// Quelltext ab hier in Merkmale zerlegt (Wort, Zeichen, Text) und die Stellung geprüft. Der Inhalt
// eines Textmerkmals wird NIE wieder durchsucht — damit ist „zu viel" strukturell ausgeschlossen.
//
// GRENZE, ausdrücklich und unverändert: Das ist kein Parser. Ob ein `/` eine Division oder einen
// regulären Ausdruck beginnt, entscheidet eine Heuristik über das letzte Merkmal — dieselbe, die
// jeder Zeilenhervorheber benutzt. Ein echter Parser bräuchte `typescript` im Baupfad, den es
// bewusst nicht gibt (vgl. `schema-vertrag.mjs:45-47`).

/** Nach diesen Zeichen beginnt ein `/` einen regulären Ausdruck, nicht eine Division. */
const VOR_REGEX = new Set(["(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "~", "^", "<", ">"]);
/** Dasselbe für Schlüsselwörter: `return /x/.test(s)` ist ein regulärer Ausdruck. */
const VOR_REGEX_WORT = new Set(["return", "typeof", "case", "in", "of", "delete", "void", "instanceof", "new", "do", "else", "yield", "await"]);

/** Liest eine Zeichenkette ab `start` (dort steht das Anführungszeichen). */
function lesAnfuehrung(quelltext, start) {
  const zeichen = quelltext[start];
  let i = start + 1;
  let wert = "";
  while (i < quelltext.length && quelltext[i] !== zeichen) {
    if (quelltext[i] === "\\") {
      wert += quelltext.slice(i, i + 2);
      i += 2;
      continue;
    }
    if (quelltext[i] === "\n") break; // unabgeschlossen — nicht über die Zeile hinaus raten
    wert += quelltext[i];
    i += 1;
  }
  return [{ art: "text", wert, schablone: false, konstant: true, von: start, bis: i + 1 }, i + 1];
}



/**
 * ZERLEGT EINEN QUELLTEXT IN MERKMALE — in EINEM Durchgang, mit EINEM Leser.
 *
 * ================================================================================================
 * WARUM DAS EIN EINZIGER DURCHGANG IST (Runde 6, nach zwei Befunden von BEN am gleichen Ort)
 * ================================================================================================
 * Bis Runde 5 gab es ZWEI Leser derselben Sprache: diese Zerlegung — und daneben eine eigene
 * Grenzsuche `ueberspringEinsetzung`, die nur herausfinden sollte, wo ein `${…}` endet. Sie kannte
 * Zeichenketten, Kommentare und Klammern, aber keine regulären Ausdrücke. Zwei Leser, von denen
 * einer weniger weiß, gehen genau so oft auseinander, wie es Sprachdetails gibt:
 *
 *   RUNDE 4  Der Ausdruck in `${…}` wurde übersprungen — die Einfuhr darin fiel weg.
 *   RUNDE 5  `${ /}/.test("}") ? (await import("./x")).wert : "" }` — das `}` INNERHALB des
 *            regulären Ausdrucks beendete die Einsetzung vorzeitig, und der konstante Import
 *            dahinter fiel weg. Der Quellbaum lief, das Paket nicht (`ERR_MODULE_NOT_FOUND`).
 *
 * Zwei Pflaster in Folge sind ein Muster. Die Grenzsuche ist deshalb ERSETZT, nicht ausgebessert:
 * Ein Schablonenliteral wird hier mit einem STAPEL gelesen, im selben Durchgang wie alles andere.
 * Wo eine Einsetzung endet, ergibt sich damit von selbst — aus derselben Kenntnis, mit der auch
 * Zeichenketten, Kommentare, reguläre Ausdrücke und verschachtelte Einsetzungen gelesen werden.
 * Es gibt keine zweite Stelle mehr, die dasselbe schlechter weiß.
 *
 * ABGEDECKT beim Finden der Grenze: `'…'`, `"…"`, `` `…` `` samt Escapes · `//` und `/* … *​/` ·
 * reguläre Ausdrücke samt Zeichenklassen `[…]` und Escapes · `{ … }` in jeder Tiefe ·
 * verschachtelte Einsetzungen `${ … ${ … } … }`.
 *
 * Zurück kommt eine Folge aus:
 *   `{ art: "wort",    wert, von }`                             — Bezeichner und Schlüsselwörter
 *   `{ art: "zeichen", wert, von }`                             — ein einzelnes Satzzeichen
 *   `{ art: "text",    wert, schablone, konstant, von, bis }`   — ein Literal; sein INHALT wird nie gedeutet
 *
 * `von` ist die Stelle im Quelltext, an der das Merkmal beginnt. Sie trägt keine Entscheidung; sie
 * ist dafür da, dass eine Abbruchmeldung das Ladeargument WÖRTLICH zeigen kann statt nur seine Form
 * („`require(p)`" statt „`require(<Ausdruck>)`") — JOB 4285 Runde 2, BEN-Prüflücke 6.
 *
 * `bis` ist die Stelle unmittelbar HINTER dem Literal. Sie trägt sehr wohl eine Entscheidung, und
 * zwar seit Runde 3 (BEN, Urteil Runde 2, Korrekturpflicht 2): nur mit ihr lässt sich sagen, welches
 * Merkmal dem Literal im Quelltext FOLGT. Bei einer Schablone stehen dazwischen die Merkmale ihrer
 * Einsetzungen — nach dem Index gefragt käme das falsche heraus.
 *
 * Das Merkmal eines Schablonenliterals steht an der Stelle, an der sein Backtick begann; die
 * Merkmale seiner Einsetzungen folgen dahinter. Damit ist `import(`./x`)` an der Argumentstelle
 * auffindbar UND ein `import(…)` innerhalb einer Einsetzung eine Kante wie jede andere.
 *
 * GRENZE, ausdrücklich: Das ist kein Parser. Ob ein `/` eine Division oder einen regulären Ausdruck
 * beginnt, entscheidet eine Heuristik über das letzte Merkmal des laufenden Ausdrucks — dieselbe,
 * die jeder Zeilenhervorheber benutzt. Ein echter Parser bräuchte `typescript` im Baupfad, den es
 * bewusst nicht gibt (vgl. `schema-vertrag.mjs:45-47`).
 */
export function zerlege(quelltext) {
  const merkmale = [];
  // Der Stapel trennt Code von Literaltext. `{ art: "code", start }` — `start` ist die Zahl der
  // Merkmale beim Öffnen und beantwortet „stehen wir am Anfang eines Ausdrucks?"; das entscheidet
  // über Division gegen regulären Ausdruck direkt hinter einem `${`.
  const stapel = [{ art: "code", start: 0, tiefe: 0 }];
  let i = 0;

  const regexMoeglich = () => {
    const rahmen = stapel[stapel.length - 1];
    // Am Anfang eines Ausdrucks (Dateianfang oder unmittelbar nach `${`) kann nur ein regulärer
    // Ausdruck stehen, keine Division. Genau hier lag der Befund aus Runde 5.
    if (merkmale.length <= rahmen.start) return true;
    const letztes = merkmale[merkmale.length - 1];
    if (letztes.art === "wort") return VOR_REGEX_WORT.has(letztes.wert);
    if (letztes.art === "text") return false;
    return VOR_REGEX.has(letztes.wert);
  };

  while (i < quelltext.length) {
    const rahmen = stapel[stapel.length - 1];
    const c = quelltext[i];
    const d = quelltext[i + 1];

    // ------------------------------------------------------------------------------------------
    // Im Literaltext eines Schablonenliterals: alles ist ein Datum, bis `${` oder das Ende kommt.
    // ------------------------------------------------------------------------------------------
    if (rahmen.art === "schablone") {
      if (c === "\\") {
        if (rahmen.merkmal.konstant) rahmen.merkmal.wert += quelltext.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === "`") {
        rahmen.merkmal.bis = i + 1;
        stapel.pop();
        i += 1;
        continue;
      }
      if (c === "$" && d === "{") {
        // Ab der ersten Einsetzung steht der Pfad nicht mehr fest; `wert` bleibt der feste Anfang.
        rahmen.merkmal.konstant = false;
        stapel.push({ art: "code", start: merkmale.length, tiefe: 0 });
        i += 2;
        continue;
      }
      if (rahmen.merkmal.konstant) rahmen.merkmal.wert += c;
      i += 1;
      continue;
    }

    if (c === " " || c === "\t" || c === "\n" || c === "\r") {
      i += 1;
      continue;
    }
    if (c === "/" && d === "/") {
      while (i < quelltext.length && quelltext[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < quelltext.length && !(quelltext[i] === "*" && quelltext[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'") {
      const [merkmal, weiter] = lesAnfuehrung(quelltext, i);
      merkmale.push(merkmal);
      i = weiter;
      continue;
    }
    if (c === "`") {
      // Das Merkmal wird JETZT gesetzt — an der Stelle des Backticks — und im Literaltext weiter
      // gefüllt. So steht es an der Argumentstelle von `import(`…`)`, und die Merkmale der
      // Einsetzungen folgen in derselben Folge dahinter.
      // `bis` wird beim schliessenden Backtick nachgetragen; bleibt es aus, endete die Schablone
      // nie — dann ist alles dahinter Literaltext, und das Dateiende ist die richtige Grenze.
      const merkmal = { art: "text", wert: "", schablone: true, konstant: true, von: i, bis: quelltext.length };
      merkmale.push(merkmal);
      stapel.push({ art: "schablone", merkmal });
      i += 1;
      continue;
    }
    if (c === "/" && regexMoeglich()) {
      let j = i + 1;
      let inKlasse = false;
      while (j < quelltext.length) {
        const z = quelltext[j];
        if (z === "\\") {
          j += 2;
          continue;
        }
        if (z === "\n") break;
        if (z === "[") inKlasse = true;
        else if (z === "]") inKlasse = false;
        else if (z === "/" && !inKlasse) {
          j += 1;
          break;
        }
        j += 1;
      }
      // Ein regulärer Ausdruck ist ein Wert wie ein Text — nach ihm beginnt kein neuer.
      merkmale.push({ art: "text", wert: "", schablone: false, konstant: false, regex: true, von: i, bis: j });
      i = j;
      continue;
    }
    if (c === "{") {
      rahmen.tiefe += 1;
    } else if (c === "}") {
      // Auf Tiefe 0 innerhalb einer Einsetzung schliesst dieses `}` die Einsetzung — und NUR dann.
      // Ein `}` in einem regulären Ausdruck, einer Zeichenkette oder einem Kommentar kommt hier
      // gar nicht an: die Zweige darüber haben es längst gelesen.
      if (rahmen.tiefe === 0 && stapel.length > 1) {
        stapel.pop();
        i += 1;
        continue;
      }
      rahmen.tiefe -= 1;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < quelltext.length && /[A-Za-z0-9_$]/.test(quelltext[j])) j += 1;
      merkmale.push({ art: "wort", wert: quelltext.slice(i, j), von: i });
      i = j;
      continue;
    }
    merkmale.push({ art: "zeichen", wert: c, von: i });
    i += 1;
  }
  return merkmale;
}

/** Ein Textmerkmal, das die Sprache als Modulangabe zulässt (`from`/`import` verlangen ein StringLiteral). */
function istZeichenkette(merkmal) {
  return merkmal !== undefined && merkmal.art === "text" && merkmal.schablone === false && merkmal.regex !== true;
}

/** Für die Abbruchmeldung: eine Zeile, nie länger als eine Zeile sein muss. */
function kurz(quelltextstueck) {
  const eine = quelltextstueck.replace(/\s+/g, " ").trim();
  return eine.length > 80 ? `${eine.slice(0, 79)}…` : eine;
}

/**
 * DIE ZEICHEN, IN DENEN DER ROHTEXT EINES LITERALS WÖRTLICH SEIN EIGENER WERT IST.
 *
 * `:` steht hier, weil der erreichte Baum es braucht und aus keinem anderen Grund: 286 Dateien,
 * gemessen am 17.09.2026 über `erreichteQuellen` — das EINZIGE Zeichen ausserhalb von
 * `[A-Za-z0-9@/._-]`, das in einer Modulangabe vorkommt, ist der Doppelpunkt der Node-Builtins
 * (`node:fs`, `node:crypto`, `node:path`, …). Ein Doppelpunkt löst in der Sprache nichts aus; er ist
 * in einem Literal genau er selbst. Die Liste ist bewusst knapp: was sie nicht kennt, bricht ab.
 */
const WERT_ZEICHEN = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@/._:-";

/**
 * ZWEITE STUFE DER WEISSLISTE — STEHT DER WERT DES LITERALS ÜBERHAUPT FEST? (JOB 4285 Runde 5)
 *
 * ================================================================================================
 * DER BEFUND, GEGEN DEN DIESE FUNKTION STEHT (BEN, Urteil Runde 4, mit vier echten Paketstarts)
 * ================================================================================================
 * Seit Runde 4 wird nur übersprungen, was syntaktisch GENAU EIN Zeichenkettenliteral ist. Das ist
 * eine Aussage über die AUSDRUCKSFORM — und BEN hat belegt, dass sie allein nichts über den PFAD
 * sagt. Der Zerleger gibt den Rohtext eines Literals zurück, mit den Escape-Sequenzen darin
 * (`lesAnfuehrung`, `:116-119`, und der Schablonenzweig `:207-210`). Rohtext ist aber kein Wert:
 *
 *   `require("\x2e./../aussen/geladen.cjs")`   Rohtext `\x2e./../…` — beginnt mit `\`, also weder
 *                                              `.` noch `/`, also „Paketname", also übersprungen.
 *                                              Node liest `\x2e` als `.`; geladen wird `../../…`.
 *   dasselbe mit dem UNICODE-ESCAPE des Punktes    in einer Schablone — sie bewahrt Escapes
 *   (`import(` … `)`)                              genauso (`:207-210`), gleiches Ergebnis.
 *
 * In beiden Fällen lief der Quellbaum, der Bau meldete `[]`, und das Paket starb mit
 * `MODULE_NOT_FOUND` / `ERR_MODULE_NOT_FOUND` — wieder Befund T-015.
 *
 * ES WIRD HIER NICHT DEKODIERT. Ein eigener Escape-Dekoder wäre die fünfte Heuristik derselben
 * Bauart: er müsste `\x`, `\u`, `\u{…}`, die Oktalformen, die Zeilenfortsetzung und die
 * Einzelzeichen-Escapes alle gleich lesen wie Node, und die erste Abweichung wäre wieder eine still
 * fehlende Datei. Stattdessen gilt eine Bedingung, unter der Rohtext und Wert NACHWEISLICH dasselbe
 * sind: kein Rückstrich (nur er leitet eine Escape-Sequenz ein) und ausschliesslich Zeichen, die
 * für sich selbst stehen. Alles andere ist nicht sicher lesbar und BRICHT AB.
 *
 * Zurück kommt `undefined`, wenn der Rohtext wörtlich sein eigener Wert ist, sonst der Grund für
 * die Abbruchmeldung — ein Mensch soll sehen, WORAN es lag, nicht nur DASS es lag.
 */
function wertGrund(rohtext) {
  if (rohtext === "") return "er ist leer und benennt damit gar keine Datei";
  if (rohtext.includes("\\")) {
    return "er enthaelt einen Rueckstrich, also eine Escape-Sequenz — was sie ergibt, steht hier nicht fest";
  }
  const fremd = [...rohtext].find((zeichen) => !WERT_ZEICHEN.includes(zeichen));
  if (fremd !== undefined) {
    return `er enthaelt „${fremd}", ein Zeichen ausserhalb von [A-Za-z0-9@/._:-]`;
  }
  return undefined;
}

/**
 * DAS LADEARGUMENT — EINE WEISSLISTE, KEINE SCHWARZLISTE (JOB 4285 Runde 4).
 *
 * ================================================================================================
 * DREI RUNDEN MIT DEMSELBEN FEHLERBILD, DESHALB JETZT EINE REGEL STATT DES NÄCHSTEN FALLS
 * ================================================================================================
 * Jede Runde hat den zuletzt gemessenen Gegenfall geflickt und den nächsten offen gelassen. BEN hat
 * jedes Mal mit ECHTEN Paketstarts belegt, dass eine wirklich geladene Datei still aus dem Paket
 * fiel — Quellbaum läuft, Paket stirbt mit `MODULE_NOT_FOUND`:
 *
 *   RUNDE 1  las nur das Merkmal hinter der Klammer. `require("../../aussen/geladen" + endung)`
 *            galt als fester Pfad; der Bau meldete eine vollständige Liste mit der FALSCHEN Datei.
 *   RUNDE 2  nahm das ERSTE LITERAL eines beliebigen Ausdrucks als festen Anfang. `require("fs" && p)`
 *            ergab den Anfang „fs" — erkennbar ein Paketname, also still übersprungen. Geladen wird `p`.
 *   RUNDE 3  verlangte für den Anfang ein unmittelbar folgendes `+`. `require("fs" + "" && p)` und
 *            `require("fs" + "" ? p : "fs")` haben das erfüllt — und luden trotzdem `p`.
 *
 * Das Muster ist immer dasselbe: aus einem TEIL des Ausdrucks wurde auf das GANZE geschlossen. Jede
 * weitere Verfeinerung dieser Richtung wäre die vierte Heuristik mit demselben Ausgang. Deshalb ist
 * die Frage jetzt umgedreht — nicht „welche Form ist gefährlich?", sondern:
 *
 *   ÜBERSPRUNGEN ODER VERFOLGT WIRD NUR, WAS SYNTAKTISCH GENAU EIN ZEICHENKETTENLITERAL IST.
 *
 * Das heisst: ein Merkmal der Art „text", keine Einsetzung darin (`konstant`), und es reicht vom
 * `(` bis zum Ende des ersten Arguments. `'…'`, `"…"` und `` `…` `` ohne `${…}` erfüllen das.
 * JEDE andere Ausdrucksform ist NICHT SICHER EINZUORDNEN und bricht den Paketbau ab: Verkettung mit
 * `+`, `&&`, `||`, `??`, `?:`, Bezeichner, Aufrufe, Klammern, Schablonen mit Ausdruck. Es gibt keine
 * Teilaussage über solche Ausdrücke mehr — also auch nichts, woraus die nächste Runde falsch
 * schliessen kann. Von einer „Sprachgarantie" wird nichts mehr behauptet (BEN, Korrekturpflicht 3).
 *
 * Das Ende des ersten Arguments ist `)` oder `,` auf Klammertiefe 0. Das `,` gehört dazu, weil
 * `import("./x", { with: … })` einen zweiten Parameter kennt und sein Pfad trotzdem feststeht.
 * Klammern einer `${…}`-Einsetzung kommen hier nie an: `zerlege` gibt sie nicht als Merkmal aus.
 *
 * Zurück kommt `{ wert, literal, text, klammerZu }` — `wert` ist der Literalwert (leer, wenn es kein
 * Literal ist, und dann bedeutungslos), `literal` die Weisslistenantwort, `text` das Argument
 * wörtlich aus dem Quelltext für die Meldung, `klammerZu` die schliessende Klammer. Der EINE
 * Durchgang liefert beide Grenzen: die des ersten Arguments (`)` oder `,`) und die der Klammer
 * selbst (`)`), die `istRequireDeklaration` braucht. Zwei Durchgänge nebeneinander wären wieder
 * zwei Leser derselben Sache — der Befund der Runden 4 und 5 von JOB 4241 (`:130-150`).
 */
function ladeArgument(quelltext, merkmale, klammer) {
  let tiefe = 0;
  let ende = -1;
  let klammerZu = -1;
  for (let j = klammer + 1; j < merkmale.length; j += 1) {
    const m = merkmale[j];
    if (m.art !== "zeichen") continue;
    if (m.wert === "(" || m.wert === "[" || m.wert === "{") {
      tiefe += 1;
      continue;
    }
    if (m.wert === ")" || m.wert === "]" || m.wert === "}") {
      if (tiefe === 0) {
        if (ende === -1) ende = j;
        klammerZu = j;
        break;
      }
      tiefe -= 1;
      continue;
    }
    if (m.wert === "," && tiefe === 0 && ende === -1) ende = j;
  }
  const schluss = ende === -1 ? undefined : merkmale[ende];
  const bis = schluss === undefined ? quelltext.length : schluss.von;
  const erstes = merkmale[klammer + 1];
  // DIE WEISSLISTE, in einem Ausdruck: ein Literalmerkmal, ohne Einsetzung, das vom `(` bis zum
  // Ende des ersten Arguments reicht. Bei einer Schablone mit `${…}` stünden hinter ihrem Merkmal
  // noch die Merkmale der Einsetzungen — dann ist `nach` nicht `ende`, und `konstant` ist ohnehin
  // `false`. Beide Wege führen zum selben Ausgang: nicht sicher einzuordnen.
  const istText = erstes !== undefined && erstes.art === "text" && erstes.regex !== true;
  let nach = -1;
  if (istText) {
    nach = klammer + 2;
    while (nach < merkmale.length && merkmale[nach].von < erstes.bis) nach += 1;
  }
  const literal =
    istText &&
    erstes.konstant === true &&
    nach === ende &&
    (schluss.wert === ")" || schluss.wert === ",");
  return {
    wert: literal ? erstes.wert : "",
    literal,
    text: kurz(quelltext.slice(erstes === undefined ? bis : erstes.von, bis)),
    klammerZu,
  };
}

/**
 * WORTE, NACH DENEN EIN `require` EINE DEKLARATION EINLEITET UND KEINEN AUFRUF.
 *
 * `require` ist kein Schlüsselwort, sondern ein gewöhnlicher Bezeichner — und im heute erreichten
 * Baum ist es ein METHODENNAME. Vier Dateien deklarieren ihn, alle vier wörtlich als
 * `private async require(id: string): Promise<…>` (`services/ask`, `services/capture`,
 * `services/conflicts`, `services/knowledge-object`; gemessen am 17.09.2026 über `erreichteQuellen`).
 * Dort steht unmittelbar davor `async`. Diese Liste trennt die Deklaration vom echten Aufruf, damit
 * Lieferung 1 den gesunden Baum nicht unbaubar macht.
 */
const DEKLARATION_DAVOR = new Set([
  "function",
  "async",
  "get",
  "set",
  "static",
  "private",
  "public",
  "protected",
  "abstract",
  "override",
  "declare",
  "readonly",
]);

/**
 * ZEICHEN, NACH DENEN EIN GLIED BEGINNEN KANN — die Stellen, an denen eine Kurzform-Methode steht.
 * `{` öffnet den Klassenrumpf oder das Objektliteral, `}` schliesst das Glied davor, `,` trennt
 * zwei Glieder. An einer Ausdrucksstelle (`=`, `(`, `return`, …) kann dort keine Deklaration stehen.
 */
const GLIEDANFANG = new Set(["{", "}", ","]);

/**
 * IST DIESES `require` EINE DEKLARATION UND DAMIT KEIN LADEVORGANG?
 *
 * ================================================================================================
 * DER BEFUND, GEGEN DEN DIESE FUNKTION STEHT (BEN, Urteil Runde 2, Korrekturpflicht 1)
 * ================================================================================================
 * Runde 2 hielt jedes `require(…)` für eine Deklaration, hinter dessen Klammer ein `{` folgte —
 * „ein echter Aufruf kann das nie". Das ist falsch, und zwar wegen der automatischen
 * Semikoloneinfügung:
 *
 *   const t = require(p)        ← ein echter Ladevorgang, mit eigener Anweisung
 *   { const a = 1; }            ← ein Block, der zufällig auf der nächsten Zeile steht
 *
 * Der Zerleger überspringt Zeilenumbrüche; das `{` stand also direkt hinter der Klammer, und der
 * Ladevorgang verschwand still — genau der Ausgang, gegen den dieser Auftrag geschrieben ist. BEN
 * hat beide Formen (mit variablem und mit konstantem Pfad) mit echten Paketstarts belegt.
 *
 * SEIT RUNDE 3 IST DAS ÜBERSPRINGEN AN EINEN POSITIVEN NACHWEIS GEBUNDEN (BENs Promptverbesserung,
 * wörtlich: „Ein nachfolgender Block … reicht dafür nicht"). Zwei Deklarationsformen, beide belegt:
 *
 *   1. EIN DEKLARATIONSWORT DAVOR — `private async require(id: string): Promise<Gap> {`. Das ist
 *      die einzige Form, die im heute erreichten Baum wirklich vorkommt (vier Dateien, gemessen).
 *   2. EINE KURZFORM-METHODE — `{ require(id) { … } }`. Dafür müssen ALLE DREI Merkmale stimmen:
 *      ein Gliedanfang DAVOR (`{`, `}`, `,` — nie eine Ausdrucksstelle wie `=`), ein `{` hinter der
 *      Klammer, und dieses `{` auf DERSELBEN ZEILE wie die Signatur. Der Zeilenumbruch ist genau
 *      das, was den ASI-Fall oben erzeugt; ein Methodenrumpf steht hinter seiner Signatur.
 *
 * Im Zweifel ist es ein Aufruf — das ist die fail-closed-Richtung: laut und behebbar, statt still
 * ein Paket mit fehlender Datei.
 */
function istRequireDeklaration(quelltext, merkmale, i, klammerZu) {
  const davor = merkmale[i - 1];
  if (davor !== undefined && davor.art === "wort" && DEKLARATION_DAVOR.has(davor.wert)) return true;
  if (klammerZu === -1) return false;
  const dahinter = merkmale[klammerZu + 1];
  if (dahinter === undefined || dahinter.art !== "zeichen" || dahinter.wert !== "{") return false;
  if (davor === undefined || davor.art !== "zeichen" || !GLIEDANFANG.has(davor.wert)) return false;
  return !quelltext.slice(merkmale[klammerZu].von, dahinter.von).includes("\n");
}

/** Die Zeilennummer einer Quelltextstelle, 1-basiert — für „Datei:Zeile" in der Abbruchmeldung. */
function zeileVon(quelltext, stelle) {
  let zeile = 1;
  for (let i = 0; i < stelle && i < quelltext.length; i += 1) {
    if (quelltext[i] === "\n") zeile += 1;
  }
  return zeile;
}

/**
 * JEDE ANGABE samt der ZWEISTUFIGEN Weisslistenantwort. Grundlage von `modulangaben`.
 *
 * `literal` ist die erste Stufe: die AUSDRUCKSFORM ist genau ein Zeichenkettenliteral (Runde 4).
 * `wertLesbar` ist die zweite: der ROHTEXT dieses Literals ist nachweislich sein eigener Wert
 * (Runde 5, `wertGrund`) — `grund` sagt, woran es sonst lag. Erst beide zusammen erlauben eine
 * Aussage über den Pfad; die erste allein sagt nur, dass dort ein Literal STEHT, nicht was
 * darin steht (BEN, Urteil Runde 4: „Rohtext mit Escape-Sequenzen ist kein Pfadwert").
 *
 * `stelle` ist die Ladestelle WÖRTLICH aus dem Quelltext (`require(p)`, ``import(`${basis}/t.js`)``),
 * `zeile` ihre Zeilennummer. Beide tragen keine Entscheidung, sondern stehen in der Abbruchmeldung:
 * ein blosser Grund sagt einem Menschen nicht, wo er nachsehen soll, und eine blosse Formangabe wie
 * „import(…)" sagt ihm nicht, WELCHE der Stellen in der Datei gemeint ist (BEN, Urteil Runde 1,
 * Prüfpunkt 6; Datei:Zeile nachgeführt in Runde 4).
 *
 * DREI FORMEN LADEN EINE DATEI, und alle drei werden HIER gelesen — in EINEM Merkmalstrom. Eine
 * zweite Erkennung daneben war der Befund der Runden 4 und 5 von JOB 4241 (`:119-139`): zwei Leser
 * derselben Sprache gehen genau so oft auseinander, wie es Sprachdetails gibt.
 */
function angabenMitArt(quelltext) {
  const merkmale = zerlege(quelltext);
  const gefunden = [];
  for (let i = 0; i < merkmale.length; i += 1) {
    const m = merkmale[i];
    if (m.art !== "wort") continue;

    // `import x from "y"`, `export … from "y"`, `export * from "y"`.
    // NICHT `Array.from(…)`/`Buffer.from(…)`: dort steht ein `.` davor und eine Klammer dahinter.
    // NICHT `{ from: "./x" }`: dort steht ein `:` zwischen Wort und Text.
    // Die Sprache lässt hier NUR ein Zeichenkettenliteral zu; die Weissliste ist also erfüllt,
    // sobald `istZeichenkette` zustimmt — es gibt an dieser Stelle keine andere Ausdrucksform.
    if (m.wert === "from") {
      const davor = merkmale[i - 1];
      if (davor !== undefined && davor.art === "zeichen" && davor.wert === ".") continue;
      if (istZeichenkette(merkmale[i + 1])) {
        gefunden.push({
          wert: merkmale[i + 1].wert,
          literal: true,
          stelle: `from "${kurz(merkmale[i + 1].wert)}"`,
          zeile: zeileVon(quelltext, m.von),
        });
      }
      continue;
    }

    if (m.wert === "import") {
      const naechstes = merkmale[i + 1];
      // `import "y"` — die Einfuhr nur wegen ihrer Nebenwirkung. Auch hier lässt die Sprache nur
      // ein Literal zu.
      if (istZeichenkette(naechstes)) {
        gefunden.push({
          wert: naechstes.wert,
          literal: true,
          stelle: `import "${kurz(naechstes.wert)}"`,
          zeile: zeileVon(quelltext, m.von),
        });
        continue;
      }
      // `import("y")` — dynamisch. Hier nimmt die Sprache JEDEN Ausdruck, und genau deshalb
      // entscheidet ab Runde 4 die Weissliste aus `ladeArgument`: genau ein Zeichenkettenliteral
      // wird gelesen, jede andere Form bricht ab. `import` ist ein reserviertes Wort — hinter
      // `import(` kann nichts anderes gemeint sein als ein dynamischer Import, ein `import(pfad)`
      // lädt also wirklich etwas. Ein `import.meta.url` kommt hier nicht an: dahinter steht ein `.`.
      if (naechstes !== undefined && naechstes.art === "zeichen" && naechstes.wert === "(") {
        const argument = ladeArgument(quelltext, merkmale, i + 1);
        gefunden.push({
          wert: argument.wert,
          literal: argument.literal,
          stelle: `import(${argument.text})`,
          zeile: zeileVon(quelltext, m.von),
        });
      }
      continue;
    }

    // `require("y")` — CommonJS lädt damit genauso eine Datei wie `import "y"`.
    //
    // DREI FÄLLE, GETRENNT BEHANDELT (JOB 4285 Runde 2, BEN-Korrekturpflicht 1):
    //   PROPERTY-AUFRUF   `this.require(id)`, `foo.require("./x")` — ein `.` steht davor. Das lädt
    //                     kein Modul, sondern ruft eine Methode; dieselbe Abgrenzung, die der
    //                     `from`-Zweig oben zieht. KEINE Kante, KEIN Abbruch.
    //   DEKLARATION       `private async require(id: string)`, `{ require(id) { … } }` — hier wird
    //                     der Name vergeben, nicht geladen. KEINE Kante, KEIN Abbruch. Dass es eine
    //                     Deklaration IST, muss nachgewiesen sein (`istRequireDeklaration`); ein
    //                     Block auf der nächsten Zeile ist kein Nachweis, sondern eine automatische
    //                     Semikoloneinfügung (BEN, Urteil Runde 2).
    //   ECHTER AUFRUF     alles andere. Ist sein Argument genau ein Zeichenkettenliteral, ist es
    //                     eine Kante; jede andere Ausdrucksform (`require(p)`, `require(a + b)`,
    //                     ``require(`./t/${n}`)``, `require("fs" && p)`, `require("fs" + "" ? p : "fs")`)
    //                     lädt wirklich eine Datei, und niemand kann sagen, welche — ABBRUCH.
    //
    // NICHT `{ require: "./x" }`: dort folgt ein `:` statt einer Klammer.
    if (m.wert === "require") {
      const davor = merkmale[i - 1];
      if (davor !== undefined && davor.art === "zeichen" && davor.wert === ".") continue;
      const naechstes = merkmale[i + 1];
      if (naechstes === undefined || naechstes.art !== "zeichen" || naechstes.wert !== "(") continue;
      const argument = ladeArgument(quelltext, merkmale, i + 1);
      if (istRequireDeklaration(quelltext, merkmale, i, argument.klammerZu)) continue;
      gefunden.push({
        wert: argument.wert,
        literal: argument.literal,
        stelle: `require(${argument.text})`,
        zeile: zeileVon(quelltext, m.von),
      });
    }
  }
  // DIE ZWEITE STUFE DER WEISSLISTE, AN EINER EINZIGEN STELLE — für alle drei Lader zugleich
  // (JOB 4285 Runde 5). Sie hier zu setzen und nicht dreimal an den Fundstellen ist dieselbe
  // Entscheidung wie überall in dieser Datei: eine Regel, ein Leser. `wertLesbar` ist der
  // Nachweis, dass `wert` wirklich der Pfad ist und nicht nur so aussieht; `grund` steht in der
  // Abbruchmeldung. Für eine nicht eingeordnete Ausdrucksform (`literal === false`) ist `wert`
  // bedeutungslos — über sie wird auch hier nichts behauptet.
  for (const angabe of gefunden) {
    angabe.grund = angabe.literal ? wertGrund(angabe.wert) : undefined;
    angabe.wertLesbar = angabe.literal && angabe.grund === undefined;
  }
  return gefunden;
}

/**
 * DIE MODULANGABEN EINER QUELLDATEI — nur die, deren Pfad wirklich feststeht.
 *
 * Das sind genau die, die BEIDE Stufen der Weissliste erfüllen: genau ein Zeichenkettenliteral
 * (`literal`) UND ein Rohtext, der sein eigener Wert ist (`wertLesbar`). Jede andere Ausdrucksform
 * (``import(`./teil/${name}`)``, `require(p)`, `require("fs" && p)`) und jedes nicht sicher lesbare
 * Literal (`require("\x2e./x.cjs")`) steht hier bewusst NICHT: welche Datei sie lädt, ist nicht
 * bestimmbar. Sie verschwinden aber nicht still — `erreichteQuellen` bricht darauf ab.
 */
export function modulangaben(quelltext) {
  return angabenMitArt(quelltext)
    .filter((angabe) => angabe.literal && angabe.wertLesbar)
    .map((angabe) => angabe.wert);
}

function istDatei(pfad) {
  return existsSync(pfad) && statSync(pfad).isFile();
}

/**
 * Löst eine RELATIVE Angabe zu einer Datei auf: mit Endung, ohne Endung, über `index.*` — und die
 * TypeScript-Schreibweise `./x.js` für `./x.ts` (NodeNext-Idiom) gleich mit.
 * `undefined` heisst: nicht auflösbar. Der Aufrufer entscheidet, was das bedeutet.
 */
export function loeseAuf(vonDatei, angabe) {
  const basis = resolve(dirname(vonDatei), angabe);
  if (istDatei(basis)) return basis;
  for (const endung of ENDUNGEN) {
    if (istDatei(`${basis}${endung}`)) return `${basis}${endung}`;
  }
  const getauscht = basis.replace(/\.(m|c)?js$/, "");
  if (getauscht !== basis) {
    for (const endung of ENDUNGEN) {
      if (istDatei(`${getauscht}${endung}`)) return `${getauscht}${endung}`;
    }
  }
  for (const name of INDEXNAMEN) {
    const kandidat = resolve(basis, name);
    if (istDatei(kandidat)) return kandidat;
  }
  return undefined;
}

/** Repo-relativ und mit Schrägstrichen — so, wie der Pfad im Release wieder stehen soll. */
function repoRelativ(repo, pfad) {
  return relative(repo, pfad).split("\\").join("/");
}

/**
 * ALLE DATEIEN, DIE DAS RELEASE VON SEINEN EINSTIEGEN AUS LÄDT — der ganze erreichte Quellbaum,
 * repo-relativ und sortiert. `fremdquellen` ist davon die Teilmenge ausserhalb von `services/`.
 *
 * ================================================================================================
 * FAIL-CLOSED — ÜBERSPRINGEN IST EINE WEISSLISTE MIT ZWEI STUFEN (JOB 4285 Runden 4 und 5)
 * ================================================================================================
 * Jede dieser Stellen beendet den Paketbau mit einer Meldung, die die EINFÜHRENDE Datei mit ZEILE
 * UND die Ladestelle wörtlich nennt — das ist das, womit ein Mensch weitersucht. Sie still zu
 * überspringen hiesse, wieder ein Paket zu bauen, dem eine Datei fehlt (Befund T-015).
 *
 *   1. Kein Einstieg ablesbar oder kein Einstieg als Datei vorhanden (`laufzeitEinstiege`, oben).
 *   2. Eine relative Angabe, die sich nicht auflösen lässt.
 *   3. Ein Ziel ausserhalb des Repos.
 *   4. STUFE EINS DER WEISSLISTE — EIN LADEARGUMENT, DAS NICHT GENAU EIN ZEICHENKETTENLITERAL IST.
 *      Das ist seit Runde 4 die EINE Regel, die die früheren Einzelfälle ersetzt — sie waren vier
 *      Anläufe, aus einem TEIL des Ausdrucks auf das GANZE zu schliessen, und BEN hat jeden
 *      einzelnen mit echten Paketstarts widerlegt (``import(`./teil/${n}`)``,
 *      ``import(`${basis}/t.js`)``, `require(p)`, `require("./x" + y)`, `require("fs" && p)`,
 *      `require("fs" + "" ? p : "fs")`). Die Regel steht in `ladeArgument`: ein Literalmerkmal ohne
 *      Einsetzung, das das ganze erste Argument ist. Alles andere BRICHT AB.
 *   5. STUFE ZWEI DER WEISSLISTE — EIN LITERAL, DESSEN ROHTEXT NICHT NACHWEISLICH SEIN WERT IST.
 *      Stufe eins sagt, dass dort ein Literal STEHT; sie sagt nicht, was darin steht. Enthält der
 *      Rohtext einen Rückstrich (also eine Escape-Sequenz) oder ein Zeichen ausserhalb von
 *      `[A-Za-z0-9@/._:-]`, oder ist er leer, steht der Pfadwert nicht fest und der Bau BRICHT AB
 *      (`wertGrund`). Ohne diese Stufe sah `require("\x2e./../aussen/geladen.cjs")` aus wie ein
 *      Paketname und lud `../../aussen/geladen.cjs` — BEN, Urteil Runde 4, vier echte Paketstarts.
 *      Es wird hier NICHT dekodiert; die Regel nennt die Bedingung, unter der Rohtext und Wert
 *      dasselbe SIND, und bricht sonst ab.
 *   6. EINE ANGABE, DIE WEDER RELATIV NOCH PAKETNAME IST — ein Literal, das mit `/` beginnt. Es
 *      liegt nicht im Quellbaum und kommt auch nicht über `npm ci`; was davon im Paket landen
 *      müsste, ist nicht bestimmbar.
 *   7. Eine erreichte `.tsx`/`.jsx`-Datei. Der Zerleger liest JSX nicht sicher: `<` steht in
 *      `VOR_REGEX` (`:95`), ein schliessendes `</div>` beginnt für ihn deshalb einen regulären
 *      Ausdruck und verschluckt, was auf derselben Zeile dahinter steht — auch eine echte Kante.
 *      Ein Parser bräuchte „typescript" im Baupfad, den es bewusst nicht gibt
 *      (vgl. `schema-vertrag.mjs:45-47`); also wird die Datei benannt statt geraten.
 *
 * BEWUSST ÜBERSPRUNGEN, kein Abbruch: NUR ein Literal, das BEIDE Stufen erfüllt und weder mit `.`
 * noch mit `/` beginnt — `"fastify"`, `"node:fs"`, `"@scope/paket/hilfe.js"`. Das sind Paketnamen
 * und Node-Builtins, und die kommen über `npm ci --omit=dev`. AUSDRÜCKLICH NICHT übersprungen
 * werden berechnete Paketnamen: ``import(`fastify/${x}`)`` und `import("fastify" + x)` brechen seit
 * Runde 4 AB. Sie sahen drei Runden lang harmlos aus und waren genau der Spalt, durch den
 * `"fs" && p` passte. Wird eine solche Form im Produkt gebraucht, ist der Abbruch richtig und die
 * Stelle im Produkt zu benennen — nicht die Regel zu lockern (Steuerung, Runde 4).
 *
 * ================================================================================================
 * WAS AUCH DANACH GRENZE BLEIBT — hier aufgezählt, damit niemand sie für geschlossen hält
 * ================================================================================================
 *   a) DIVISION GEGEN REGULÄREN AUSDRUCK. Ob ein `/` das eine oder das andere beginnt, entscheidet
 *      eine Heuristik über das letzte Merkmal (`:167-176`) — dieselbe, die jeder Zeilenhervorheber
 *      benutzt. Liegt sie falsch, kann eine Kante dahinter verschwinden.
 *   b) AUFRUF GEGEN DEKLARATION BEI `require` ENTSCHEIDET EINE HEURISTIK (`istRequireDeklaration`).
 *      `require` ist kein Schlüsselwort, sondern im erreichten Baum ein METHODENNAME (vier Dateien,
 *      alle als `private async require(id: string)`, gemessen 17.09.2026). Erkannt werden zwei
 *      Deklarationsformen: ein Deklarationswort davor, und die Kurzform `{ require(id) { … } }` mit
 *      Gliedanfang davor und Rumpf auf derselben Zeile. NICHT erkannt wird eine modifikatorlose
 *      Methode mit Rückgabetyp (`require(id): X {`) und ebensowenig eine Kurzform, deren Rumpf auf
 *      der nächsten Zeile beginnt — beide gelten als Aufruf und BRECHEN AB. Das ist die
 *      fail-closed-Richtung: laut und behebbar, statt still ein Paket mit fehlender Datei. Keine
 *      dieser Formen kommt im Bestand vor. Seit Runde 3 gibt es die umgekehrte Lücke NICHT mehr:
 *      ein echter Aufruf vor einem Block auf der nächsten Zeile galt als Deklaration und
 *      verschwand (BEN, Urteil Runde 2, mit echten Paketstarts belegt).
 *   b2) BEIDE STUFEN DER WEISSLISTE SIND SYNTAKTISCH, NICHT SEMANTISCH. Stufe eins fragt „ist das
 *      genau ein Literal?", nicht „was kommt dabei heraus?". Eine Form, die zur Laufzeit denselben
 *      festen Pfad ergibt — `("./x")` in Klammern, `("a", "./x")`, `(true ? "./x" : "./x")` —,
 *      bricht deshalb AB, obwohl sie harmlos ist. Stufe zwei fragt „steht der Rohtext für sich
 *      selbst?", nicht „was ergibt die Escape-Sequenz?": ein Literal mit einem Rückstrich oder
 *      einem Zeichen ausserhalb von `[A-Za-z0-9@/._:-]` bricht AB, auch wenn sein Wert ein völlig
 *      gewöhnlicher Pfad wäre — ein Dateiname mit Leerzeichen oder Umlaut etwa. Das ist beide Male
 *      die gewollte Richtung: ein unnötiger Abbruch ist laut und in einer Zeile behoben (die
 *      Schreibweise geradeziehen), ein stilles Paket mit fehlender Datei stirbt beim Kunden. Im
 *      erreichten Baum kostet das heute nichts: 286 Dateien, kein einziges Literal ausserhalb der
 *      Zeichenliste ausser dem `:` der Node-Builtins (gemessen 17.09.2026). Umgekehrt gilt: über
 *      eine nicht eingeordnete Form und über einen nicht sicher lesbaren Rohtext wird hier KEINE
 *      Teilaussage mehr getroffen — es gibt nichts mehr, woraus ein späterer Leser falsch
 *      schliessen könnte. Genau das war der Befund der Runden 1 bis 4.
 *   c) `require.resolve("./x")` ist keine Kante — es lädt nichts, verlangt aber eine Datei.
 *   d) `from` WIRD ALS WORT GELESEN. Eine Deklarationsform, in der dieses Wort unmittelbar vor
 *      einem Zeichenkettenliteral steht, ohne eine Einfuhr zu sein, würde als Kante gezählt; im
 *      Bestand kommt keine solche Form vor, und die Sprache kennt dafür kaum eine Stelle.
 *   e) NUR IMPORT-, EXPORT- UND `require`-KANTEN. Eine Datei, die zur Laufzeit anders geladen wird
 *      (`readFileSync`, `new URL(…, import.meta.url)`, ein Arbeiterprozess), sieht diese Erhebung
 *      nicht. Verfolgt werden ausserdem nur RELATIVE Angaben — eine absolute Angabe in den
 *      Entwicklerbaum fällt hier nicht auf.
 */
export function erreichteQuellen(repo, einstiege = laufzeitEinstiege()) {
  const wurzel = resolve(repo);
  const gesehen = new Set();
  const offen = [];
  for (const einstieg of einstiege) {
    const pfad = isAbsolute(einstieg) ? einstieg : resolve(wurzel, einstieg);
    if (!istDatei(pfad)) {
      throw new Error(`Paketinhalt: Einstieg ${einstieg} liegt nicht als Datei unter ${wurzel}.`);
    }
    if (istJsxDatei(pfad)) {
      throw new Error(
        `Paketinhalt: der Einstieg ${einstieg} ist eine JSX-Datei — der Zerleger liest JSX nicht sicher, der Paketinhalt ist damit nicht bestimmbar.`,
      );
    }
    offen.push(pfad);
  }
  while (offen.length > 0) {
    const datei = offen.pop();
    if (gesehen.has(datei)) continue;
    gesehen.add(datei);
    for (const eintrag of angabenMitArt(readFileSync(datei, "utf8"))) {
      const angabe = eintrag.wert;
      const wo = `${repoRelativ(wurzel, datei)}:${eintrag.zeile}`;
      // DIE WEISSLISTE ZUERST (JOB 4285 Runde 4): Ist das Ladeargument nicht genau ein
      // Zeichenkettenliteral, wird über seinen Wert GAR NICHTS behauptet — weder dass er relativ
      // ist noch dass er es nicht ist. Drei Runden lang stand hier eine Teilaussage („fester
      // Anfang"), und drei Mal ist genau durch sie eine wirklich geladene Datei aus dem Paket
      // gefallen. Es gibt keine Teilaussage mehr.
      if (!eintrag.literal) {
        throw new Error(
          `Paketinhalt: ${wo} laedt mit „${eintrag.stelle}" — das ist keine einzelne Zeichenkette, sondern eine Ausdrucksform, die erst zur Laufzeit einen Pfad ergibt; welche Datei das Paket dafuer braucht, ist nicht bestimmbar.`,
        );
      }
      // DIE ZWEITE STUFE DER WEISSLISTE (JOB 4285 Runde 5): das Ladeargument IST ein einzelnes
      // Literal — aber sein Rohtext ist noch kein Pfad. Enthält er einen Rückstrich oder ein
      // Zeichen, das nicht für sich selbst steht, ist der Wert nicht sicher bestimmbar, und jede
      // Einordnung darunter („relativ", „Paketname") wäre wieder eine Teilaussage. `\x2e./…` sah
      // vier Runden lang aus wie ein Paketname und war `../…` (BEN, Urteil Runde 4).
      if (!eintrag.wertLesbar) {
        throw new Error(
          `Paketinhalt: ${wo} laedt mit „${eintrag.stelle}" — der Rohtext „${angabe}" ist nicht sicher lesbar: ${eintrag.grund}. Welchen Pfad die Sprache daraus macht und welche Datei das Paket dafuer braucht, ist damit nicht bestimmbar.`,
        );
      }
      // Ein Literal, das weder relativ noch Paketname ist: eine absolute Angabe liegt nicht im
      // Quellbaum und kommt auch nicht über `npm ci`.
      if (angabe.startsWith("/")) {
        throw new Error(
          `Paketinhalt: ${wo} fuehrt „${angabe}" ein — ein absoluter Pfad liegt weder im Quellbaum noch kommt er ueber npm ci; was das Paket dafuer braucht, ist nicht bestimmbar.`,
        );
      }
      if (!angabe.startsWith(".")) continue;
      const ziel = loeseAuf(datei, angabe);
      if (ziel === undefined) {
        throw new Error(`Paketinhalt: ${wo} fuehrt „${angabe}" ein — dazu gibt es keine Datei.`);
      }
      const drin = repoRelativ(wurzel, ziel);
      if (drin.startsWith("../")) {
        throw new Error(
          `Paketinhalt: ${wo} fuehrt „${angabe}" ein — das liegt ausserhalb des Repos (${ziel}).`,
        );
      }
      if (istJsxDatei(drin)) {
        throw new Error(
          `Paketinhalt: ${wo} fuehrt „${angabe}" ein — das ist ${drin}, eine JSX-Datei. Der Zerleger liest JSX nicht sicher (ein echter Parser braeuchte „typescript" im Baupfad, den es bewusst nicht gibt), der Paketinhalt ist damit nicht bestimmbar.`,
        );
      }
      offen.push(ziel);
    }
  }
  return [...gesehen].map((pfad) => repoRelativ(wurzel, pfad)).sort();
}

/**
 * DIE FREMDQUELLEN: was das Release lädt, aber ausserhalb von `services/` liegt — also alles, was
 * `build-current-release.mjs` mit seinen zwei Bäumen NICHT erwischt. Heute genau eine Datei
 * (`apps/web/src/lib/docx.ts`); die Zahl ist das Ergebnis der Messung und keine Erwartung.
 *
 * `apps/web/dist` taucht hier nie auf: dorthin führt keine Importkante, das Bündel wird als Baum
 * kopiert. Nackte Paketnamen ebenfalls nicht — die bringt `npm ci --omit=dev` mit.
 */
export function fremdquellen(repo, einstiege = laufzeitEinstiege()) {
  return erreichteQuellen(repo, einstiege).filter((pfad) => !pfad.startsWith("services/"));
}
