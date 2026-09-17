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
 */
const ENDUNGEN = [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx", ".cjs"];

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
  return [{ art: "text", wert, schablone: false, konstant: true }, i + 1];
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
 *   `{ art: "wort",    wert }`                        — Bezeichner und Schlüsselwörter
 *   `{ art: "zeichen", wert }`                        — ein einzelnes Satzzeichen
 *   `{ art: "text",    wert, schablone, konstant }`   — ein Literal; sein INHALT wird nie gedeutet
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
      const merkmal = { art: "text", wert: "", schablone: true, konstant: true };
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
      merkmale.push({ art: "text", wert: "", schablone: false, konstant: false, regex: true });
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
      merkmale.push({ art: "wort", wert: quelltext.slice(i, j) });
      i = j;
      continue;
    }
    merkmale.push({ art: "zeichen", wert: c });
    i += 1;
  }
  return merkmale;
}

/** Ein Textmerkmal, das die Sprache als Modulangabe zulässt (`from`/`import` verlangen ein StringLiteral). */
function istZeichenkette(merkmal) {
  return merkmal !== undefined && merkmal.art === "text" && merkmal.schablone === false && merkmal.regex !== true;
}

/** Jede Angabe samt der Frage, ob ihr Pfad überhaupt feststeht. Grundlage von `modulangaben`. */
function angabenMitArt(quelltext) {
  const merkmale = zerlege(quelltext);
  const gefunden = [];
  for (let i = 0; i < merkmale.length; i += 1) {
    const m = merkmale[i];
    if (m.art !== "wort") continue;

    // `import x from "y"`, `export … from "y"`, `export * from "y"`.
    // NICHT `Array.from(…)`/`Buffer.from(…)`: dort steht ein `.` davor und eine Klammer dahinter.
    // NICHT `{ from: "./x" }`: dort steht ein `:` zwischen Wort und Text.
    if (m.wert === "from") {
      const davor = merkmale[i - 1];
      if (davor !== undefined && davor.art === "zeichen" && davor.wert === ".") continue;
      if (istZeichenkette(merkmale[i + 1])) {
        gefunden.push({ wert: merkmale[i + 1].wert, konstant: true });
      }
      continue;
    }

    if (m.wert === "import") {
      const naechstes = merkmale[i + 1];
      // `import "y"` — die Einfuhr nur wegen ihrer Nebenwirkung.
      if (istZeichenkette(naechstes)) {
        gefunden.push({ wert: naechstes.wert, konstant: true });
        continue;
      }
      // `import("y")` — dynamisch. HIER ist auch der konstante Backtick erlaubt: die Sprache
      // nimmt an dieser Stelle jeden Ausdruck, und ein Schablonenliteral ohne Einsetzung IST ein
      // fester Pfad.
      if (naechstes !== undefined && naechstes.art === "zeichen" && naechstes.wert === "(") {
        const argument = merkmale[i + 2];
        if (argument !== undefined && argument.art === "text" && argument.regex !== true) {
          gefunden.push({ wert: argument.wert, konstant: argument.konstant });
        }
      }
    }
  }
  return gefunden;
}

/**
 * DIE MODULANGABEN EINER QUELLDATEI — nur die, deren Pfad wirklich feststeht.
 *
 * Eine Angabe mit Einsetzung (``import(`./teil/${name}`)``) steht hier bewusst NICHT: ihr Pfad ist
 * erst zur Laufzeit bekannt. Sie verschwindet aber nicht still — `erreichteQuellen` bricht ab,
 * wenn ihr fester Anfang relativ ist, weil dann eine Datei im Paket fehlen würde, die niemand
 * benennen kann.
 */
export function modulangaben(quelltext) {
  return angabenMitArt(quelltext)
    .filter((angabe) => angabe.konstant)
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
 * FAIL-CLOSED an drei Stellen, alle bewusst: eine relative Angabe, die sich nicht auflösen lässt;
 * ein Ziel ausserhalb des Repos; und eine relative Angabe, deren Pfad erst zur Laufzeit entsteht
 * (``import(`./teil/${name}`)``). Alles drei still zu überspringen hiesse, wieder ein Paket zu
 * bauen, dem eine Datei fehlt — der Ausgang, den dieser Auftrag beseitigt.
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
    offen.push(pfad);
  }
  while (offen.length > 0) {
    const datei = offen.pop();
    if (gesehen.has(datei)) continue;
    gesehen.add(datei);
    for (const eintrag of angabenMitArt(readFileSync(datei, "utf8"))) {
      const angabe = eintrag.wert;
      if (!angabe.startsWith(".")) continue;
      if (!eintrag.konstant) {
        throw new Error(
          `Paketinhalt: ${repoRelativ(wurzel, datei)} fuehrt einen berechneten relativen Pfad ein (Anfang „${angabe}") — welche Datei das Paket dafuer braucht, ist nicht bestimmbar.`,
        );
      }
      const ziel = loeseAuf(datei, angabe);
      if (ziel === undefined) {
        throw new Error(
          `Paketinhalt: ${repoRelativ(wurzel, datei)} fuehrt „${angabe}" ein — dazu gibt es keine Datei.`,
        );
      }
      const drin = repoRelativ(wurzel, ziel);
      if (drin.startsWith("../")) {
        throw new Error(
          `Paketinhalt: ${repoRelativ(wurzel, datei)} fuehrt „${angabe}" ein — das liegt ausserhalb des Repos (${ziel}).`,
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
