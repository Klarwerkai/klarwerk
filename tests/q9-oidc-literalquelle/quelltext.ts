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

/** Derselbe Quelltext, zeilen- und spaltentreu, aber ohne Zeilen- und Blockkommentare. */
export function ohneKommentare(quelle: string): string {
  let ergebnis = "";
  let i = 0;
  let davor = "";
  let wort = "";
  while (i < quelle.length) {
    const c = quelle[i] ?? "";
    if (c === '"' || c === "'" || c === "`") {
      const ende = zeichenketteEnde(quelle, i);
      ergebnis += quelle.slice(i, ende);
      davor = c;
      wort = "";
      i = ende;
      continue;
    }
    if (c === "/" && quelle[i + 1] === "/") {
      while (i < quelle.length && quelle[i] !== "\n") {
        i += 1;
      }
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
      ergebnis += quelle.slice(i, ende);
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
