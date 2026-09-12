// ================================================================================================
// JOB 3562 · Q9-REST — WERKZEUG: QUELLTEXT OHNE KOMMENTARE.
// ================================================================================================
//
// Die drei Wächter dieses Ordners fragen den Quelltext, nicht die Laufzeit: „steht dieser Satz noch
// ein zweites Mal irgendwo unter services/auth/src?" Eine rohe Zeichenkettensuche beantwortet das
// falsch, denn `oidc.ts:25` und `:291` NENNEN den Satz in Prosa („der eine Fehler für ‚der
// Anmeldedienst antwortet nicht'"). Ein Kommentar ist keine zweite Quelle der Wahrheit: er wird
// nicht ausgeliefert, niemand liest ihn als Nutzertext, und ihn zu verbieten hiesse, Erklärungen zu
// verbieten. Deshalb schneidet dieses Werkzeug Kommentare heraus, BEVOR gesucht wird.
//
// Herausgeschnitten wird längentreu in Zeilen: Blockkommentare werden zu Leerzeichen, ihre
// Zeilenumbrüche bleiben stehen. Nur so stimmt die Zeilennummer, die ein roter Wächter meldet, noch
// mit der Datei überein, die der Mensch dann öffnet.
//
// Der Grund für einen eigenen Abtaster statt eines Regexes: ein Regex, der `//` sucht, verschluckt
// jede URL und jeden regulären Ausdruck. Der Abtaster kennt deshalb drei Zustände, die ein `/`
// harmlos machen — Zeichenkette, Vorlagenzeichenkette (samt `${…}`) und Regex-Literal. Die Fälle
// W0.* in `katalog-ist-die-einzige-quelle.test.ts` kalibrieren ihn an genau diesen Fallen.

/**
 * Ende einer Zeichenkette, die bei `start` mit `"`, `'` oder `` ` `` beginnt (Index HINTER dem
 * schliessenden Zeichen). Escapes zählen; in Vorlagenzeichenketten werden `${…}`-Ausdrücke samt
 * darin geschachtelter Zeichenketten übersprungen.
 */
export function zeichenketteEnde(quelle: string, start: number): number {
  const anfang = quelle[start];
  let i = start + 1;
  while (i < quelle.length) {
    const c = quelle[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === anfang) {
      return i + 1;
    }
    if (anfang === "`" && c === "$" && quelle[i + 1] === "{") {
      let tiefe = 1;
      i += 2;
      while (i < quelle.length && tiefe > 0) {
        const d = quelle[i];
        if (d === '"' || d === "'" || d === "`") {
          i = zeichenketteEnde(quelle, i);
          continue;
        }
        if (d === "{") {
          tiefe += 1;
        } else if (d === "}") {
          tiefe -= 1;
        }
        i += 1;
      }
      continue;
    }
    i += 1;
  }
  return quelle.length;
}

// Nach diesen Zeichen kann ein `/` nur ein Regex-Literal beginnen, nie eine Division: es steht kein
// Wert davor, durch den man teilen könnte. Nach einem Bezeichner, einer Zahl, `)` oder `]` ist es
// umgekehrt eine Division. `return /x/` erkennt die Liste über das `n` nicht — deshalb steht das
// Schlüsselwort-Ende zusätzlich unten.
const VOR_REGEX = new Set("(,=:[!&|?{};+-*%~^<>".split(""));
const VOR_REGEX_WORT = new Set(["return", "typeof", "case", "in", "of", "do", "else", "yield"]);

function regexMoeglich(davor: string, wort: string): boolean {
  return davor === "" || VOR_REGEX.has(davor) || VOR_REGEX_WORT.has(wort);
}

function regexEnde(quelle: string, start: number): number {
  let i = start + 1;
  let inKlasse = false;
  while (i < quelle.length) {
    const c = quelle[i];
    if (c === "\n") {
      // Ein Regex-Literal endet nie über die Zeile hinweg: dann war das `/` doch eine Division.
      return start + 1;
    }
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (c === "[") {
      inKlasse = true;
    } else if (c === "]") {
      inKlasse = false;
    } else if (c === "/" && !inKlasse) {
      return i + 1;
    }
    i += 1;
  }
  return start + 1;
}

/**
 * Das Füllzeichen, mit dem `nurStruktur` Inhalte ausblendet. Bewusst KEIN Leerzeichen und kein
 * Bezeichnerzeichen: so ist im Ergebnis auf einen Blick zu sehen, dass dort etwas stand, und keine
 * Suche nach einem Wort (`new`, `class`, `extends`) kann darin zufällig anschlagen.
 */
const FUELLER = "·";

function maskiere(text: string): string {
  // Zeilenumbrüche bleiben stehen — sonst stimmt die Zeilennummer nicht mehr, die ein roter
  // Wächter meldet, mit der Datei überein, die der Mensch dann öffnet.
  return text.replace(/[^\n]/g, FUELLER);
}

/**
 * Ein Abtaster für beide Schnitte — es gibt bewusst nur DIESEN einen. `ohneKommentare` und
 * `nurStruktur` unterscheiden sich allein darin, ob die INHALTE von Zeichenketten, Vorlagen und
 * Regex-Literalen erhalten bleiben; die Zustandsführung (was ist Kommentar, was ist Zeichenkette,
 * wann beginnt ein Regex) ist dieselbe und wird von W0.* kalibriert.
 *
 * Beide Schnitte sind LÄNGENTREU: jedes Zeichen der Quelle hat im Ergebnis genau ein Zeichen an
 * derselben Stelle. Nur so darf ein Aufrufer einen Index, den er im einen Schnitt gefunden hat, im
 * anderen zum Herausschneiden benutzen — genau das tut `erzeugungsstellen`.
 */
function abtasten(quelle: string, inhalteMaskieren: boolean): string {
  let ergebnis = "";
  let i = 0;
  let davor = "";
  let wort = "";
  const uebernimm = (roh: string): string => {
    if (!inhalteMaskieren || roh.length <= 2) {
      return inhalteMaskieren ? maskiere(roh) : roh;
    }
    // Die Begrenzer bleiben lesbar, damit das Ergebnis noch als Quelltext erkennbar ist.
    return roh.charAt(0) + maskiere(roh.slice(1, -1)) + roh.slice(-1);
  };
  while (i < quelle.length) {
    const c = quelle[i] ?? "";
    if (c === '"' || c === "'" || c === "`") {
      const ende = zeichenketteEnde(quelle, i);
      ergebnis += uebernimm(quelle.slice(i, ende));
      davor = c;
      wort = "";
      i = ende;
      continue;
    }
    if (c === "/" && quelle[i + 1] === "/") {
      const start = i;
      while (i < quelle.length && quelle[i] !== "\n") {
        i += 1;
      }
      // JOB 3580: Bis hierher wurde der Zeilenkommentar ERSATZLOS entfernt — das hielt die
      // Zeilennummern, aber nicht die Zeichenindizes. `erzeugungsstellen` sucht die Struktur im
      // einen Schnitt und schneidet den Text aus dem anderen aus; dafür müssen beide dieselbe
      // Länge haben. Leerzeichen statt nichts, wie beim Blockkommentar schon immer.
      ergebnis += " ".repeat(i - start);
      continue;
    }
    if (c === "/" && quelle[i + 1] === "*") {
      const schluss = quelle.indexOf("*/", i + 2);
      const bis = schluss < 0 ? quelle.length : schluss + 2;
      ergebnis += quelle.slice(i, bis).replace(/[^\n]/g, " ");
      i = bis;
      continue;
    }
    if (c === "/" && regexMoeglich(davor, wort)) {
      const ende = regexEnde(quelle, i);
      ergebnis += uebernimm(quelle.slice(i, ende));
      davor = "/";
      wort = "";
      i = ende;
      continue;
    }
    ergebnis += c;
    if (/[A-Za-z0-9_$]/.test(c)) {
      wort += c;
    } else {
      wort = "";
    }
    if (!/\s/.test(c)) {
      davor = c;
    }
    i += 1;
  }
  return ergebnis;
}

/** Derselbe Quelltext, zeilen-, spalten- und längentreu, aber ohne Zeilen- und Blockkommentare. */
export function ohneKommentare(quelle: string): string {
  return abtasten(quelle, false);
}

/**
 * Nur noch das Gerüst: Kommentare sind weg, und die INHALTE von Zeichenketten, Vorlagen und
 * Regex-Literalen sind ausgeblendet. Darauf — und nur darauf — darf strukturell gesucht werden:
 * ein `new AuthError("X", "y")` in einer Zeichenkette oder in einem Regex ist hier kein Aufruf
 * mehr, und eine Klammer oder ein Komma in einem Text zerlegt keine Argumentliste.
 */
function nurStruktur(quelle: string): string {
  return abtasten(quelle, true);
}

/**
 * Jede Modulangabe, die der übergebene (bereits kommentarfreie) Quelltext lädt — mit dem
 * Zeichenindex, an dem die Anweisung beginnt.
 *
 * RUNDE 2, KORREKTURPFLICHT DES PRÜFERS: Bis hierher suchte Wächter A nur nach `from "…"`,
 * `import("…")` und `require("…")`. Ein Import OHNE BINDUNG — `import "./types";` — hat kein
 * `from` und kein `(`; er blieb deshalb unsichtbar, und der Katalog konnte wieder von einem
 * Auth-Modul abhängen, während alle Wächter grün blieben (BEN, Runde 1: „`import "./types";` vor
 * den Katalog gesetzt → Exit 0, Tests 15 passed"). Genau diese Form steht jetzt als vierte
 * Alternative in der Liste, und die Fälle A.0.* halten jede Ladeform einzeln fest.
 *
 * Die Reihenfolge der Alternativen ist bedeutsam: `import (` muss vor dem blossen `import` stehen,
 * sonst verschluckt die kürzere Form den dynamischen Import. Ein `.from("…")` (etwa `Array.from`)
 * trifft die Liste nicht, weil zwischen Wort und Anführungszeichen eine Klammer steht.
 */
const IMPORT_MUSTER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|\bimport\s*)["']([^"']+)["']/g;

export function importe(ohneKommentareQuelle: string): { spezifizierer: string; index: number }[] {
  const gefunden: { spezifizierer: string; index: number }[] = [];
  for (const treffer of ohneKommentareQuelle.matchAll(IMPORT_MUSTER)) {
    const spezifizierer = treffer[1];
    if (spezifizierer) {
      gefunden.push({ spezifizierer, index: treffer.index ?? 0 });
    }
  }
  return gefunden;
}

// ================================================================================================
// JOB 3580 · WERKZEUG: WO ENTSTEHT EIN AuthError, UND WAS TRÄGT ER ALS MELDUNG?
// ================================================================================================
//
// Wächter D fragt: trägt jede Stelle, an der ein `AuthError` entsteht, eine Meldung, die der
// Katalog als SCHLÜSSEL kennt? Dafür braucht er zwei Dinge, die dieser Abschnitt liefert — die
// Menge der Klassen, die überhaupt als `AuthError` durchgereicht werden, und die Erzeugungsstellen
// samt dem Rohtext ihrer Argumente. Kalibriert wird beides einzeln durch D.0.
//
// WARUM ÜBER `nurStruktur` UND NICHT ÜBER DEN ROHTEXT: `new AuthError("X", "y")` steht in diesem
// Baum auch in Kommentaren, in Zeichenketten und in Regex-Literalen. Eine Suche im Rohtext zählt
// alle drei als Aufruf; eine Suche, die nur `new AuthError(` in genau einer Schreibweise kennt,
// findet umgekehrt KEINE der 18 echten Stellen dieses Bestands — die stehen als
// `"KEY" satisfies Meldungsschluessel`, sechs davon über mehrere Zeilen.

/** Eine Klasse, deren Objekte `routes.ts` als `AuthError` an den Menschen durchreicht. */
export interface Fehlerklasse {
  name: string;
  /** `wurzel` = `AuthError` selbst (oder ein blosser anderer Name dafür), `abgeleitet` = erbt. */
  art: "wurzel" | "abgeleitet";
}

/** Eine Stelle, an der eine dieser Klassen erzeugt wird. */
export interface Erzeugungsstelle {
  klasse: string;
  art: Fehlerklasse["art"];
  /** 1-basierte Zeile, in der das `new` steht — dort schlägt der Mensch nach. */
  zeile: number;
  /** Die Argumente als ROHTEXT, getrimmt. Leer, wenn keins dasteht (Vorgabewert der Klasse). */
  argumente: string[];
}

// Die fünf Wege, auf denen ein neuer Name zu einer Fehlerklasse wird. Die letzten drei sind keine
// Spitzfindigkeit: Lehre JOB 3579 R1 (11.09.) — „der AST-Wächter übersieht zwei gemessene
// Aliasformen". Ein Name, der nur umbenannt wurde, ist dieselbe Klasse.
//
// RUNDE 2, KORREKTURPFLICHT 1 DES PRÜFERS: `ZUGEWIESEN` kannte bis hierher nur die UNTYPISIERTE
// Zuweisung. BEN setzte an dieselbe Stelle wie die Pflichtgegenprobe
// `const Fehler: typeof AuthError = AuthError; throw new Fehler("FORBIDDEN", "Nur Admins duerfen
// das.");` — und alle 71 Fälle blieben grün (BEN, Runde 1: „→ `Tests  71 passed (71)`"). Eine
// gewöhnliche Typannotation genügte also, damit der freie Fehlersatz unbemerkt blieb. Zwei
// Änderungen: `ZUGEWIESEN` erlaubt die Annotation, und `TYPISIERT` bindet den Namen jetzt an der
// ANNOTATION selbst — `let X: typeof AuthError;` ist ein AuthError-Konstruktor, gleichgültig,
// woher der Wert später kommt. Das trifft auch Parameter und Felder, nicht nur `const`.
const ERBT = /\bclass\s+([A-Za-z_$][\w$]*)[^{;]*?\bextends\s+([A-Za-z_$][\w$.]*)/g;
const ERBT_ALS_AUSDRUCK =
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*class\b[^{;]*?\bextends\s+([A-Za-z_$][\w$.]*)/g;
const UMBENANNT = /\b([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)/g;
const ZUGEWIESEN =
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=;{}]+)?=\s*([A-Za-z_$][\w$]*)\s*[;,\n]/g;
const TYPISIERT = /\b([A-Za-z_$][\w$]*)\s*:\s*typeof\s+([A-Za-z_$][\w$.]*)/g;

/**
 * Alle Klassen, die (auch über mehrere Stufen, auch unter einem anderen Namen) auf `wurzeln`
 * zurückgehen — über ALLE übergebenen Quellen zusammen. Getrennt zu sammeln wäre falsch: eine
 * Klasse, die in `oidc.ts` von `AuthError` erbt, wird auch in `service.ts` geworfen.
 */
export function fehlerklassen(
  quellen: readonly string[],
  wurzeln: readonly string[] = ["AuthError"],
): Fehlerklasse[] {
  const kanten: { neu: string; basis: string; erbt: boolean }[] = [];
  for (const quelle of quellen) {
    const struktur = nurStruktur(quelle);
    for (const [muster, erbt] of [
      [ERBT, true],
      [ERBT_ALS_AUSDRUCK, true],
      [UMBENANNT, false],
      [ZUGEWIESEN, false],
      [TYPISIERT, false],
    ] as const) {
      muster.lastIndex = 0;
      for (const treffer of struktur.matchAll(muster)) {
        const [, eins, zwei] = treffer;
        if (!eins || !zwei) {
          continue;
        }
        // Bei `X as Y` ist die BASIS der erste Name, bei allen anderen der zweite.
        kanten.push(
          muster === UMBENANNT
            ? { neu: zwei, basis: eins, erbt: false }
            : { neu: eins, basis: zwei, erbt },
        );
      }
    }
  }
  const gefunden = new Map<string, Fehlerklasse["art"]>(
    wurzeln.map((name) => [name, "wurzel" as const]),
  );
  let gewachsen = true;
  while (gewachsen) {
    gewachsen = false;
    for (const { neu, basis, erbt } of kanten) {
      const artDerBasis = gefunden.get(basis);
      if (artDerBasis === undefined || gefunden.has(neu)) {
        continue;
      }
      // Ein blosser zweiter Name bleibt, was die Basis war; ein `extends` macht daraus eine
      // abgeleitete Klasse — und die behandelt Wächter D strenger.
      gefunden.set(neu, erbt ? "abgeleitet" : artDerBasis);
      gewachsen = true;
    }
  }
  return [...gefunden].map(([name, art]) => ({ name, art }));
}

function leerzeichenUeberspringen(text: string, ab: number): number {
  let i = ab;
  while (i < text.length && /\s/.test(text[i] ?? "")) {
    i += 1;
  }
  return i;
}

const NAME_AB = /[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*/y;
const NAME_GANZ = /^[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*$/;
const AUF = new Set(["(", "[", "{"]);
const ZU = new Set([")", "]", "}"]);

/** Index der schliessenden Klammer zu der bei `auf`, oder -1. Erwartet Struktur-Text. */
function passendeKlammer(struktur: string, auf: number): number {
  let tiefe = 0;
  for (let i = auf; i < struktur.length; i += 1) {
    const c = struktur[i] ?? "";
    if (AUF.has(c)) {
      tiefe += 1;
    } else if (ZU.has(c)) {
      tiefe -= 1;
      if (tiefe === 0) {
        return i;
      }
    }
  }
  return -1;
}

function letztesFreiesKomma(struktur: string): number {
  let tiefe = 0;
  let letztes = -1;
  for (let i = 0; i < struktur.length; i += 1) {
    const c = struktur[i] ?? "";
    if (AUF.has(c)) {
      tiefe += 1;
    } else if (ZU.has(c)) {
      tiefe -= 1;
    } else if (c === "," && tiefe === 0) {
      letztes = i;
    }
  }
  return letztes;
}

/**
 * Der Klassenname aus dem Konstruktorausdruck zwischen `new` und der Argumentliste — oder
 * `undefined`, wenn dort kein blosser Name steht.
 *
 * RUNDE 2, KORREKTURPFLICHT 1 DES PRÜFERS: bis hierher wurde hinter `new` stur ein Bezeichner
 * gelesen. `new (AuthError)("FORBIDDEN", "text")` — gültiges TypeScript, das dieselbe Klasse
 * erzeugt — lieferte deshalb gemessen `[]`. Klammern werden jetzt abgetragen, und hinter einem
 * Kommaoperator (`new (0, AuthError)(…)`) zählt der letzte Teilausdruck. Steht dort kein blosser
 * Name (`new (bedingung ? A : B)(…)`), ist die Klasse aus dem Quelltext ehrlich nicht ablesbar;
 * dieser Fall ist in `D.0` als bewusste, gemessene Grenze festgehalten.
 */
function klassenname(struktur: string): string | undefined {
  let rest = struktur.trim();
  for (let runde = 0; runde < 8 && rest !== ""; runde += 1) {
    const vorher = rest;
    if (rest.startsWith("(") && passendeKlammer(rest, 0) === rest.length - 1) {
      rest = rest.slice(1, -1).trim();
    }
    const komma = letztesFreiesKomma(rest);
    if (komma >= 0) {
      rest = rest.slice(komma + 1).trim();
    }
    if (rest === vorher) {
      break;
    }
  }
  return NAME_GANZ.test(rest) ? rest.replace(/\s+/g, "") : undefined;
}

/**
 * Die Art einer Klasse hinter dem geschriebenen Namen — auch dann, wenn der Name QUALIFIZIERT ist.
 *
 * RUNDE 3, KORREKTURPFLICHT DES PRÜFERS: `TYPISIERT` (oben) erkannte das Feld
 * `private readonly Fehler: typeof AuthError = AuthError;` korrekt als Fehlerklasse — aber die
 * VERWENDUNG heisst `new this.Fehler(…)`, und dieser Name stand so in keiner Liste. BEN warf damit
 * in `service.ts:149` einen freien Satz, und alle 81 Faelle blieben gruen (BEN, Runde 2:
 * „→ `Tests  81 passed (81)`"). Eine erkannte Deklaration nuetzt nichts, wenn ihre Verwendung
 * nicht aufgeloest wird.
 *
 * Deshalb: zuerst der GANZE geschriebene Name (`AuthError`, `t.AuthError`), dann — und nur bei
 * einem qualifizierten Namen — sein LETZTER Teil. Das trifft `this.Fehler` ebenso wie
 * `new t.AuthError(…)` nach einem Namensraum-Import. Die Richtung ist bewusst gewaehlt: ein
 * Waechter, der beim qualifizierten Namen wegsieht, ist genau dort blind, wo er gebraucht wird;
 * meldet er dagegen einmal zu viel, steht die Stelle mit Datei und Zeile da und ein Mensch
 * entscheidet. `joseErrors.JWKSTimeout` bleibt unberuehrt — `JWKSTimeout` ist keine Fehlerklasse
 * dieses Moduls, und `D.0` haelt genau das fest.
 */
function artVon(
  name: string,
  nachArt: ReadonlyMap<string, Fehlerklasse["art"]>,
): Fehlerklasse["art"] | undefined {
  const ganz = nachArt.get(name);
  if (ganz !== undefined) {
    return ganz;
  }
  const punkt = name.lastIndexOf(".");
  return punkt < 0 ? undefined : nachArt.get(name.slice(punkt + 1));
}

/**
 * Jede Stelle in `quelle`, an der eine der `klassen` mit `new` erzeugt wird. Gesucht wird in
 * `nurStruktur(quelle)`, ausgeschnitten wird aus `ohneKommentare(quelle)` — beide sind längentreu
 * zur Quelle, die Indizes passen also aufeinander. Dadurch zerlegt weder ein Komma in einem Text
 * noch eine Klammer in einem Regex die Argumentliste, und ein Kommentar mitten in der Liste
 * verschwindet aus dem Argumenttext, statt ihn unlesbar zu machen.
 */
export function erzeugungsstellen(
  quelle: string,
  klassen: readonly Fehlerklasse[],
): Erzeugungsstelle[] {
  const struktur = nurStruktur(quelle);
  const rein = ohneKommentare(quelle);
  const nachArt = new Map(klassen.map((k) => [k.name, k.art]));
  const stellen: Erzeugungsstelle[] = [];
  for (const treffer of struktur.matchAll(/\bnew\b/g)) {
    const beginn = treffer.index ?? 0;
    const ausdruckAb = leerzeichenUeberspringen(struktur, beginn + 3);
    let ausdruckBis: number;
    if (struktur[ausdruckAb] === "(") {
      // `new (…)(args)`: die erste Klammergruppe IST der Konstruktorausdruck, die zweite die
      // Argumentliste. Ohne diese Unterscheidung hielte die Suche unten die Klasse für die Argumente.
      const zu = passendeKlammer(struktur, ausdruckAb);
      if (zu < 0) {
        continue;
      }
      ausdruckBis = zu + 1;
    } else {
      NAME_AB.lastIndex = ausdruckAb;
      if (!NAME_AB.exec(struktur)) {
        continue;
      }
      ausdruckBis = NAME_AB.lastIndex;
    }
    const klasse = klassenname(struktur.slice(ausdruckAb, ausdruckBis));
    if (klasse === undefined) {
      continue;
    }
    const art = artVon(klasse, nachArt);
    if (art === undefined) {
      continue;
    }
    let i = leerzeichenUeberspringen(struktur, ausdruckBis);
    if (struktur[i] === "<") {
      // Typargumente (`new Foo<Bar>()`) überspringen — sonst bräche die Klammersuche darunter ab.
      let tiefe = 0;
      while (i < struktur.length) {
        if (struktur[i] === "<") {
          tiefe += 1;
        } else if (struktur[i] === ">") {
          tiefe -= 1;
          if (tiefe === 0) {
            i += 1;
            break;
          }
        }
        i += 1;
      }
      i = leerzeichenUeberspringen(struktur, i);
    }
    const argumente: string[] = [];
    if (struktur[i] === "(") {
      let tiefe = 1;
      let start = i + 1;
      let j = i + 1;
      while (j < struktur.length && tiefe > 0) {
        const c = struktur[j] ?? "";
        if (AUF.has(c)) {
          tiefe += 1;
        } else if (ZU.has(c)) {
          tiefe -= 1;
          if (tiefe === 0) {
            argumente.push(rein.slice(start, j).trim());
            break;
          }
        } else if (c === "," && tiefe === 1) {
          argumente.push(rein.slice(start, j).trim());
          start = j + 1;
        }
        j += 1;
      }
      // `new X()` liefert ein leeres Argument, `new X("a",)` ein leeres letztes — beide weg.
      while (argumente.length > 0 && argumente[argumente.length - 1] === "") {
        argumente.pop();
      }
    }
    stellen.push({ klasse, art, zeile: zeileVon(rein, beginn), argumente });
  }
  return stellen;
}

const ENTKOMMEN: Record<string, string> = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v" };

/** Der Text hinter den Begrenzern — Escapes aufgelöst, für alle drei Anführungsarten gleich. */
function entkommen(inhalt: string): string {
  let ergebnis = "";
  let i = 0;
  while (i < inhalt.length) {
    const c = inhalt[i] ?? "";
    if (c !== "\\") {
      ergebnis += c;
      i += 1;
      continue;
    }
    const naechstes = inhalt[i + 1] ?? "";
    if (naechstes === "u" && inhalt[i + 2] === "{") {
      const zu = inhalt.indexOf("}", i + 3);
      if (zu > 0) {
        ergebnis += String.fromCodePoint(Number.parseInt(inhalt.slice(i + 3, zu), 16));
        i = zu + 1;
        continue;
      }
    }
    if (naechstes === "u" || naechstes === "x") {
      const stellen = naechstes === "u" ? 4 : 2;
      ergebnis += String.fromCharCode(Number.parseInt(inhalt.slice(i + 2, i + 2 + stellen), 16));
      i += 2 + stellen;
      continue;
    }
    ergebnis += ENTKOMMEN[naechstes] ?? naechstes;
    i += 2;
  }
  return ergebnis;
}

/**
 * Der Wert eines Arguments, WENN es ein Zeichenkettenliteral ist — sonst `undefined`.
 *
 * Nachgestellte Typzusagen (`satisfies Meldungsschluessel`, `as const`) werden abgetragen: sie
 * ändern den Wert nicht, und der ganze Bestand schreibt genau so. Eine Vorlage MIT Einsetzung, ein
 * Bezeichner und ein Elementzugriff sind KEIN Literal — und das ist in Wächter D ein Verstoss,
 * nicht ein „unbekannt": ein Wächter, der wegsieht, sobald es unübersichtlich wird, ist genau dort
 * blind, wo er gebraucht wird.
 */
export function alsLiteral(argument: string): string | undefined {
  let rest = argument.trim();
  for (let runde = 0; runde < 8 && rest !== ""; runde += 1) {
    const vorher = rest;
    const struktur = nurStruktur(rest);
    if (struktur.startsWith("(") && struktur.endsWith(")")) {
      let tiefe = 0;
      let paar = true;
      for (let i = 0; i < struktur.length; i += 1) {
        tiefe += struktur[i] === "(" ? 1 : struktur[i] === ")" ? -1 : 0;
        if (tiefe === 0 && i < struktur.length - 1) {
          paar = false;
          break;
        }
      }
      if (paar) {
        rest = rest.slice(1, -1).trim();
      }
    }
    // Die Typzusage wird in der STRUKTUR gesucht: ein „ satisfies X" innerhalb eines Textes ist
    // Text und darf nicht abgetragen werden.
    const zusage = /\s(?:satisfies|as)\s+[A-Za-z_$][\w$.<>[\]|\s]*$/.exec(nurStruktur(rest));
    if (zusage) {
      rest = rest.slice(0, zusage.index).trim();
    }
    if (rest === vorher) {
      break;
    }
  }
  const anfang = rest.charAt(0);
  if (anfang !== '"' && anfang !== "'" && anfang !== "`") {
    return undefined;
  }
  if (zeichenketteEnde(rest, 0) !== rest.length) {
    return undefined; // etwas steht dahinter: `"a" + b`, `"a".trim()` — kein blosses Literal.
  }
  if (anfang === "`" && rest.includes("${")) {
    return undefined; // eine Vorlage MIT Einsetzung ist zur Bauzeit kein fester Text.
  }
  return entkommen(rest.slice(1, -1));
}

/** 1-basierte Zeilennummer eines Zeichenindex. */
export function zeileVon(quelle: string, index: number): number {
  let zeile = 1;
  for (let i = 0; i < index && i < quelle.length; i += 1) {
    if (quelle[i] === "\n") {
      zeile += 1;
    }
  }
  return zeile;
}
