// ================================================================================================
// AUFTRAG-mega49 BLOCK C — DER SAMMLER: KEIN SMOKE-FALL HÄNGT AN EINEM LEERZUSTANDS-ANKER.
// ================================================================================================
//
// DER BEFUND, gegen den dieser Sammler steht (gemessen, nicht vermutet):
// Der volle Drei-Engine-Smoke scheiterte in ALLEN DREI Engines an genau einem Fall — „mega47:
// Filterblatt auf schmalem Gerät ist wirklich bedienbar", Schlusszeile. Diese Zeile klickte auf
// „Zu meinen Aufgaben". Das ist kein gewöhnliches Bedienelement der Validierungsseite, sondern ein
// Eintrag aus `apps/web/src/lib/emptyStateActions.ts`: `Validation.tsx:557` reicht ihn
// ausschließlich als `emptyExtra` an `QueryState` — und `QueryState` (ui.tsx:186-193) rendert
// diesen Zweig NUR, wenn die Liste leer ist. Sobald das Prüf-Board Daten trägt, existiert der Knopf
// nicht mehr.
//
// Und genau darin lag die Falle: das hermetische TOR fährt den ersten Fall der Smoke-Datei nicht
// mit (`--grep-invert @modell`), dort blieb das Board leer und der Fall war grün. Der VOLLE Lauf
// führt ihn aus — er reicht ein Wissensobjekt ein, das Board ist danach gefüllt, und derselbe Fall
// läuft in den Timeout. Ein Fall, dessen Grün von der Datenlage des Laufs abhängt, ist kein Beleg,
// sondern ein Zufall. Weil der Smoke seriell läuft, riss er außerdem sechs weitere Fälle mit —
// darunter den Browser-Beleg für mega48, der dadurch NIE im Drei-Engine-Lauf ankam.
//
// DIE BAUFORM, NICHT DIE HEUTIGEN FÄLLE: geprüft wird nicht „steht irgendwo ‚Zu meinen Aufgaben‘",
// sondern die STRUKTUR — die eine Liste der Leerzustands-Aktionen
// (`emptyStateActions.ts`, `CANDIDATES`) wird gelesen und gegen die Smoke-Suite gehalten. Kommt
// morgen eine Leerzustands-Aktion dazu, ist sie ohne Zutun Teil der Prüfung; ein Smoke-Fall, der
// sie benutzt, wird automatisch rot. Es gibt hier bewusst KEINE abgeschriebene Zweitliste.
//
// WARUM DIESER SAMMLER IN VITEST LIEGT UND NICHT IN DER SMOKE-SUITE: er ist eine reine
// Quelltextfrage — kein Browser, kein Server, keine Datenlage. Er läuft in `tools/check` VOR dem
// Smoke und macht damit genau die Sorte Fall rot, die sonst erst im vollen Ship-Lauf auffällt,
// eine Stunde vor der Auslieferung.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// DIE BLINDHEIT DIESES SAMMLERS — ausdrücklich, weil eine verschwiegene Grenze zur Falle wird
// (dieselbe Ehrlichkeit wie in den Testköpfen von mega47 und mega48):
//
//  1. ER SIEHT NUR DIE BESCHRIFTUNG. Wer dasselbe Bedienelement über eine Testkennung, einen
//     CSS-Pfad, `nth()` oder seinen Zielpfad (`a[href="/aufgaben"]`) anspricht, geht ungesehen
//     vorbei. Dagegen hilft kein Textvergleich, sondern nur die Hausregel der Smoke-Suite
//     („sichtbare deutsche Texte statt Testkennungen", ui-smoke.spec.ts:3) — die dieser Sammler
//     stützt, aber nicht erzwingen kann.
//  2. ER SIEHT NUR DIE GANZE BESCHRIFTUNG. Ein Teil-Regex (`/Zu meinen/`) trifft dasselbe Element
//     und wird hier nicht gefunden.
//  3. ER SIEHT NUR DEUTSCH. Die Smoke-Suite fährt die deutsche Oberfläche; englische oder
//     niederländische Beschriftungen werden nicht gesucht. Der Grund ist keine Bequemlichkeit,
//     sondern Präzision: „Import" (en) käme in jeder zweiten Zeile Quelltext vor und machte den
//     Sammler zu einem Rauschgenerator, den man abschaltet.
//  4. ER SIEHT KEINE MEHRDEUTIGEN BESCHRIFTUNGEN. Trägt derselbe Text noch einen anderen
//     i18n-Schlüssel (heute „Wissen erfassen" und „Zur Validierung"), lässt sich aus dem Text
//     allein nicht entscheiden, welches Element gemeint ist — der Sammler schweigt dort und sagt
//     das unten laut (`MEHRDEUTIG_ERWARTET`), statt still zu raten.
//  5. ER SIEHT NUR DIESE EINE LISTE. Leerzustands-Bedienelemente, die NICHT aus
//     `emptyStateActions.ts` stammen (z. B. ein seitenlokaler „Jetzt anlegen"-Knopf im leeren
//     Zweig einer einzelnen Seite), kennt er nicht. Die Klasse ist damit nicht geschlossen,
//     sondern an ihrer größten und einzigen zentralen Quelle abgedeckt.
// ================================================================================================
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  type EmptyStateContext,
  emptyStateActions,
} from "../../apps/web/src/lib/emptyStateActions";

const WURZEL = join(__dirname, "..", "..");
const QUELLE = join(WURZEL, "apps", "web", "src", "lib", "emptyStateActions.ts");
const SMOKE_WURZEL = join(WURZEL, "tests-smoke");

// ─── 1. Die EINE Liste lesen ────────────────────────────────────────────────────────────────────
// Gelesen wird die Quelldatei, nicht eine Kopie ihrer Einträge. `CANDIDATES` ist nicht exportiert
// (und das soll es auch nicht werden — der Sammler ist kein Grund, die Produktschnittstelle zu
// verbreitern), deshalb der Weg über den Quelltext. Dass dieser Weg WIRKLICH die Liste sieht und
// nicht ins Leere greift, prüft die Kalibrierung unten gegen die exportierte Funktion.
interface Leerzustandsliste {
  kontexte: string[];
  keysJeKontext: Record<string, string[]>;
  alleKeys: string[];
}

function leseLeerzustandsliste(): Leerzustandsliste {
  const zeilen = readFileSync(QUELLE, "utf8").split("\n");
  const keysJeKontext: Record<string, string[]> = {};
  let start = zeilen.findIndex((z) => /^const CANDIDATES\b/.test(z));
  expect(
    start,
    [
      `In ${relative(WURZEL, QUELLE)} steht kein \`const CANDIDATES\` mehr — die eine Liste der`,
      "Leerzustands-Aktionen ist umgezogen oder umbenannt. Der Sammler darf hier NICHT still leer",
      "weiterlaufen: er zieht dann keine Beschriftung mehr und wäre für immer grün.",
    ].join(" "),
  ).toBeGreaterThanOrEqual(0);
  let kontext: string | null = null;
  for (start += 1; start < zeilen.length; start += 1) {
    const zeile = zeilen[start] ?? "";
    if (/^};/.test(zeile)) {
      break;
    }
    const kopf = /^\s{2}(\w+):\s*\[/.exec(zeile);
    if (kopf) {
      kontext = kopf[1] as string;
      keysJeKontext[kontext] = [];
      continue;
    }
    const key = /labelKey:\s*"([^"]+)"/.exec(zeile);
    if (key && kontext) {
      (keysJeKontext[kontext] as string[]).push(key[1] as string);
    }
  }
  const kontexte = Object.keys(keysJeKontext);
  const alleKeys = [...new Set(Object.values(keysJeKontext).flat())];
  return { kontexte, keysJeKontext, alleKeys };
}

const LISTE = leseLeerzustandsliste();

// ─── 2. Beschriftungen (deutsch) und ihre Eindeutigkeit ─────────────────────────────────────────
const DE = i18n.getResourceBundle("de", "translation") as Record<string, string>;

/** Alle i18n-Schlüssel, die exakt diese deutsche Beschriftung tragen. */
function keysMitBeschriftung(text: string): string[] {
  return Object.entries(DE)
    .filter(([, wert]) => wert === text)
    .map(([key]) => key)
    .sort();
}

// Die heute MEHRDEUTIGEN Beschriftungen — je mit Grund. Diese Liste ist keine Ausnahme vom
// Sammler, sondern seine ehrliche Reichweitenangabe (Blindheit 4 oben). Sie ist beidseitig gepinnt:
// wird eine Beschriftung neu mehrdeutig, wird sie hier rot und jemand muss hinsehen; wird eine
// eindeutig, ist ihr Eintrag hier überflüssig und ebenfalls rot.
const MEHRDEUTIG_ERWARTET: Record<string, string> = {
  "empty.cta.capture":
    "„Wissen erfassen“ ist auch die Beschriftung des Navigationseintrags (nav.capture) und der " +
    "Startseiten-Aktion. Genau darum benutzt `support/auth.ts` diesen Text als Marker des " +
    "Arbeitsbereichs — dort ist die Navigation gemeint, nicht der Leerzustand.",
  "empty.cta.validation":
    "„Zur Validierung“ tragen auch ko.cta.validate, ask.reviewGuard.cta und lcy.revalCta.validate " +
    "— dieselbe Beschriftung an drei datenTRAGENDEN Stellen.",
};

// ─── 3. Die Smoke-Suite lesen ───────────────────────────────────────────────────────────────────
function smokeDateien(verzeichnis: string): string[] {
  const out: string[] = [];
  for (const eintrag of readdirSync(verzeichnis).sort()) {
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) {
      out.push(...smokeDateien(pfad));
    } else if (eintrag.endsWith(".ts")) {
      out.push(pfad);
    }
  }
  return out;
}

/**
 * Kommentare entfernen, Zeilenzahl erhalten. Ohne das wäre dieser Sammler unbrauchbar: die
 * Testköpfe dieser Suite ERKLÄREN Leerzustände ausführlich und nennen ihre Beschriftungen dabei
 * beim Namen — das ist gewollt und darf nicht rot machen. Gesucht wird ausschließlich Code.
 */
function ohneKommentare(inhalt: string): string[] {
  const raus: string[] = [];
  let imBlock = false;
  for (const zeile of inhalt.split("\n")) {
    let code = zeile;
    if (imBlock) {
      const ende = code.indexOf("*/");
      if (ende === -1) {
        raus.push("");
        continue;
      }
      code = code.slice(ende + 2);
      imBlock = false;
    }
    const blockStart = code.indexOf("/*");
    if (blockStart !== -1) {
      imBlock = code.indexOf("*/", blockStart) === -1;
      code = code.slice(0, blockStart);
    }
    const zeilenkommentar = code.indexOf("//");
    if (zeilenkommentar !== -1) {
      code = code.slice(0, zeilenkommentar);
    }
    raus.push(code);
  }
  return raus;
}

interface Fund {
  datei: string;
  zeile: number;
  fall: string;
  key: string;
  beschriftung: string;
}

/** Der Titel des `test(...)`, in dem die Zeile steht — sonst „(außerhalb eines Falls)". */
function fallTitel(zeilen: readonly string[], index: number): string {
  for (let i = index; i >= 0; i -= 1) {
    const treffer = /^\s*test(?:\.\w+)*\s*\(\s*["'`](.+?)["'`]/.exec(zeilen[i] ?? "");
    if (treffer) {
      return treffer[1] as string;
    }
  }
  return "(außerhalb eines Falls)";
}

function sammle(): Fund[] {
  const gesucht = LISTE.alleKeys
    .filter((key) => MEHRDEUTIG_ERWARTET[key] === undefined)
    .map((key) => ({ key, beschriftung: DE[key] as string }));
  const funde: Fund[] = [];
  for (const pfad of smokeDateien(SMOKE_WURZEL)) {
    const zeilen = ohneKommentare(readFileSync(pfad, "utf8"));
    zeilen.forEach((code, index) => {
      for (const { key, beschriftung } of gesucht) {
        if (code.includes(beschriftung)) {
          funde.push({
            datei: relative(WURZEL, pfad),
            zeile: index + 1,
            fall: fallTitel(zeilen, index),
            key,
            beschriftung,
          });
        }
      }
    });
  }
  return funde;
}

describe("mega49 C · die Liste der Leerzustands-Aktionen ist die Quelle, nicht eine Kopie", () => {
  it("die Quelldatei wird wirklich gelesen — Kontexte und Beschriftungen sind da", () => {
    expect(LISTE.kontexte.length).toBeGreaterThan(0);
    expect(LISTE.alleKeys.length).toBeGreaterThan(0);
    for (const key of LISTE.alleKeys) {
      // Ein Schlüssel ohne deutsche Beschriftung wäre ein stiller Ausfall: der Sammler suchte
      // danach die leere Zeichenkette und träfe alles oder nichts.
      expect(DE[key], `Leerzustands-Schlüssel ohne deutsche Beschriftung: ${key}`).toBeTruthy();
    }
  });

  it("KALIBRIERUNG · was der Quelltext-Leser findet, gibt auch die exportierte Funktion her", () => {
    for (const kontext of LISTE.kontexte) {
      // `EmptyStateContext` ist ein reiner Typ; die Werte stehen zur Laufzeit nur als Schlüssel der
      // gelesenen Liste zur Verfügung. Genau deshalb ist diese Zusicherung die Kalibrierung: liest
      // der Parser Unsinn, kennt die Funktion den Kontext nicht und gibt nichts zurück.
      const echt = emptyStateActions(kontext as EmptyStateContext, "admin", true);
      expect(echt.length, `Kontext ohne Aktionen: ${kontext}`).toBeGreaterThan(0);
      for (const aktion of echt) {
        expect(LISTE.keysJeKontext[kontext]).toContain(aktion.labelKey);
      }
    }
  });

  it("die Reichweitenangabe stimmt — mehrdeutige Beschriftungen sind genau die genannten", () => {
    const mehrdeutig = LISTE.alleKeys
      .filter((key) => keysMitBeschriftung(DE[key] as string).length > 1)
      .sort();
    expect(mehrdeutig).toEqual(Object.keys(MEHRDEUTIG_ERWARTET).sort());
  });
});

describe("mega49 C · kein Smoke-Fall hängt an einem Bedienelement des Leerzustands", () => {
  it("keine Beschriftung aus emptyStateActions.ts steht im Code der Smoke-Suite", () => {
    const funde = sammle();
    const bericht = funde
      .map(
        (f) =>
          `  ${f.datei}:${f.zeile}\n` +
          `    Fall:          ${f.fall}\n` +
          `    Beschriftung:  „${f.beschriftung}“ (${f.key})`,
      )
      .join("\n");
    expect(
      funde,
      funde.length === 0
        ? ""
        : [
            "Ein Smoke-Fall spricht ein Bedienelement über seine Beschriftung an, das es NUR im",
            "Leerzustand gibt (emptyStateActions.ts → EmptyStateCtas → QueryState.emptyExtra).",
            "Solche Fälle sind grün, solange der Lauf zufällig keine Daten anlegt, und laufen in",
            "jedem Lauf mit Daten in den Timeout — in allen Engines gleichzeitig, weil es nicht an",
            "der Engine liegt, sondern an der Datenlage.",
            `\n${bericht}\n`,
            " Der Weg heraus ist NICHT, das Element sichtbar statt bedienbar zu prüfen, sondern",
            "ein Bedienelement zu wählen, das in BEIDEN Datenlagen existiert.",
          ].join(" "),
    ).toEqual([]);
  });
});
