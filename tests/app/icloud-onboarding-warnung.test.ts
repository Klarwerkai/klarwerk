// JOB 1114 · D-N6 — DAS ONBOARDING WARNT VOR SYNCHRONISIERTEN ARBEITSBÄUMEN.
//
// ================================================================================================
// DER BEFUND (JOB 914 D1, `RUECKGABE-PRO3-JOB-914-D1-ICLOUD-REPO-SETUP.md`, read-only gemessen)
// ================================================================================================
//
// `12_ONBOARDING_NEUER_MITARBEITER.md` ist die einzige Datei im Baum, die den Zustand HERSTELLT:
// Phase 1 lässt einen neuen Mitarbeiter `~/Documents/Klarwerk` anlegen, Phase 2 klont vier Repos
// dorthin. Jede andere Fundstelle beschreibt den Ort nur.
//
// Gemessen auf Pedis Arbeitsplatz: **611 byte-identische Duplikate** unter `~/Documents/dev_Klarwerk`
// und **1003** unter `~/Documents/Klarwerk` — und sie liegen nicht nur daneben, sondern **in `.git`
// selbst**: `gitdir 2`, `ORIG_HEAD 2`, `commondir 2` und ein duplizierter Git-Objektknoten. Die
// Synchronisation dupliziert die Buchführung des Repositories.
//
// Gegenprobe im selben Lauf: derselbe Prüfsatz auf `/private/tmp` → **0** Kandidaten. Der Satz
// schlägt also nicht überall an. Und 20 Treffer waren NICHT byte-identisch und wurden korrekt nicht
// gezählt — er ist trennscharf.
//
// Ausgangslage vor diesem Durchgang, am gebundenen Base-Stand nachgemessen (nicht übernommen):
// **0** Dateien in `PROJECT_CONTEXT/` und `SETUP.md` nennen iCloud, Dropbox, OneDrive,
// „Schreibtisch & Dokumente“ oder „synchronisiert". **0** Wächter für diese Datei. Es gab keine
// Stelle, die vor synchronisierten Arbeitsbäumen warnt.
//
// ================================================================================================
// DIE EHRLICHKEITSGRENZE, DIE DIESER WÄCHTER MIT DURCHSETZT
// ================================================================================================
//
// JOB 914 hat den naheliegenden Test AUSPROBIERT und ihn scheitern sehen:
//
//   Sonde A: liegt der Pfad unter ~/Library/Mobile Documents/com~apple~CloudDocs?
//      realpath(~/Documents):  /Users/peterkohnert/Documents  →  unter CloudDocs: NEIN
//   Sonde B: .icloud-Platzhalter im Live-Repo (Tiefe 4):  0
//
// Bei „Schreibtisch & Dokumente“ führt macOS `~/Documents` weiter unter seinem alten Pfad. Beide
// Sonden sagen **nein**, obwohl das Phänomen nachweislich vorliegt. **Aus dem Pfadnamen allein folgt
// nicht, dass Synchronisation aktiv ist** — und eine Anleitung, die das behauptet, läge stiller
// falsch als eine, die schweigt. Der Wächter unten erzwingt deshalb beides: die Warnung MUSS da
// sein, und sie DARF die Synchronisation nicht als Tatsache aus dem Pfad ableiten.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PFAD = "PROJECT_CONTEXT/12_ONBOARDING_NEUER_MITARBEITER.md";

function onboarding(): string {
  return readFileSync(resolve(process.cwd(), PFAD), "utf8");
}

/** Die Überschrift, unter der die Warnung steht — der Anker für Position und Blockgrenze. */
const WARNUNG_ANKER = "Wohin die Repos NICHT gehören";

/**
 * Der Warnblock: von seiner Überschrift bis zur ersten Anweisungszeile danach.
 *
 * Bewusst eng geschnitten: Zusicherungen gegen die GANZE Datei wären wertlos, weil das Wort
 * „iCloud“ irgendwo weiter unten sie ebenfalls erfüllen würde.
 */
function warnblock(text: string): string {
  const start = text.indexOf(WARNUNG_ANKER);
  if (start < 0) {
    throw new Error(
      `Es gibt keinen Warnblock: die Überschrift „${WARNUNG_ANKER}“ steht nicht in ${PFAD}.`,
    );
  }
  const rest = text.slice(start);
  const ende = rest.indexOf("\n- [ ]");
  return ende < 0 ? rest : rest.slice(0, ende);
}

/**
 * Der Block als FLIESSTEXT: Zeilenumbrüche, Blockquote-Zeichen und Mehrfachleerzeichen zu je
 * einem Leerzeichen zusammengezogen.
 *
 * Nötig für Zusicherungen über Wortfolgen: Markdown bricht Absätze um, und „beweist nichts“ stand
 * in der ersten Fassung über zwei Zeilen verteilt. Ein Wächter, der daran scheitert, prüft den
 * Zeilenumbruch statt die Aussage — gemessen an genau dieser Stelle.
 */
function fliesstext(block: string): string {
  return block
    .split("\n")
    .map((z) => z.replace(/^\s*>\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ");
}

/**
 * Die fünf benannten Teile des Warnblocks, in ihrer verbindlichen Reihenfolge.
 *
 * JOB 914 wörtlich: „Die vier Teile sind getrennt vorhanden … Ein Wächter, der nur das Wort
 * ‚iCloud‘ zählt, wäre genau die Zusage, die weiter reicht als ihr Beleg." Der Prüfweg ist hier
 * als fünfter Teil dazugekommen, weil Pflicht 2 ihn ausdrücklich verlangt.
 */
const TEILE = ["Ursache.", "Risiko", "Sicherer Zielort.", "Prüfweg", "Migration"] as const;

/**
 * Genau EIN Teil des Warnblocks, als Fließtext.
 *
 * Warum teilweise und nicht gegen den ganzen Block: eine Wendung, die irgendwo im Block steht,
 * erfüllt eine Zusicherung über den ganzen Block auch dann, wenn sie an der SACHLICH richtigen
 * Stelle fehlt. Gemessen an genau diesem Fall: „Schreibtisch & Dokumente“ aus der Ursache
 * gestrichen — der Block blieb grün, weil derselbe Wortlaut im Prüfweg steht.
 */
function teil(block: string, name: (typeof TEILE)[number]): string {
  const text = fliesstext(block);
  const i = TEILE.indexOf(name);
  const start = text.indexOf(`**${name}`);
  if (start < 0) {
    throw new Error(`Der Warnblock hat keinen Teil „${name}“.`);
  }
  const naechster = TEILE[i + 1];
  const ende = naechster === undefined ? text.length : text.indexOf(`**${naechster}`, start);
  return text.slice(start, ende < 0 ? text.length : ende);
}

/** Zeilennummer (0-basiert) der ersten Zeile, die `nadel` enthält; -1 wenn keine. */
function zeileMit(text: string, nadel: string): number {
  return text.split("\n").findIndex((z) => z.includes(nadel));
}

describe("JOB 1114 · A1 · Kalibrierung: die Vorrichtung misst wirklich das Onboarding", () => {
  it("die Datei ist da und trägt weiterhin den Klon-Schritt, um den es geht", () => {
    // Ohne diesen Fall wären alle folgenden überbestimmt: eine leere oder umbenannte Datei
    // erfüllte „kein Klonziel unter ~/Documents“ mühelos, ohne dass irgendetwas geleistet wäre.
    const text = onboarding();
    expect(text).toContain("Onboarding-Skript");
    expect(
      text,
      "Der Klon-Prompt ist verschwunden — dann misst dieser Wächter nichts mehr",
    ).toContain("Klone diese GitHub-Repos");
    expect(text).toContain("dev_Klarwerk");
    expect(text).toContain("klarwerk-local-llm");
  });
});

describe("JOB 1114 · A2 · POSITION: die Warnung steht VOR dem ersten Klon-Schritt", () => {
  it("der Warnblock steht oberhalb der Anweisung, den Ordner anzulegen", () => {
    // JOB 914 wörtlich: „ein Hinweis nach der Anweisung kommt zu spät.“ Der Ordner ist dann
    // schon angelegt, und der nächste Schritt klont hinein.
    const text = onboarding();
    const warnung = zeileMit(text, WARNUNG_ANKER);
    const ordner = zeileMit(text, "Ordner anlegen");
    expect(warnung, `Der Warnblock „${WARNUNG_ANKER}“ fehlt ganz`).toBeGreaterThanOrEqual(0);
    expect(ordner, "Die Anweisung zum Ordner-Anlegen ist verschwunden").toBeGreaterThanOrEqual(0);
    expect(
      warnung < ordner,
      `Die Warnung steht in Zeile ${warnung + 1}, die Anweisung in Zeile ${ordner + 1} — ein Hinweis NACH der Anweisung kommt zu spät.`,
    ).toBe(true);
  });

  it("der Warnblock steht auch oberhalb des Klon-Prompts", () => {
    const text = onboarding();
    const warnung = zeileMit(text, WARNUNG_ANKER);
    const klon = zeileMit(text, "Klone diese GitHub-Repos");
    // Die Existenzprüfung steht hier VOR dem Vergleich, und das ist kein Zierat: `zeileMit`
    // liefert bei Abwesenheit -1, und `-1 < klon` wäre wahr. Eine erste Fassung dieses Falls
    // war am Base-Stand grün, OBWOHL es gar keine Warnung gab — ein Fall, der ohne die Wirkung
    // grün bleibt, zählt nicht.
    expect(warnung, `Der Warnblock „${WARNUNG_ANKER}“ fehlt ganz`).toBeGreaterThanOrEqual(0);
    expect(klon, "Der Klon-Prompt ist verschwunden").toBeGreaterThanOrEqual(0);
    expect(warnung < klon, "Die Warnung steht unterhalb des Klon-Prompts").toBe(true);
  });
});

describe("JOB 1114 · A3 · URSACHE und RISIKO stehen getrennt und je an ihrer Stelle", () => {
  it("alle fünf Teile sind vorhanden und stehen in der verbindlichen Reihenfolge", () => {
    const text = fliesstext(warnblock(onboarding()));
    let letzte = -1;
    for (const name of TEILE) {
      const i = text.indexOf(`**${name}`);
      expect(i, `Der Teil „${name}“ fehlt im Warnblock`).toBeGreaterThanOrEqual(0);
      expect(i, `Der Teil „${name}“ steht an der falschen Stelle`).toBeGreaterThan(letzte);
      letzte = i;
    }
  });

  it("die URSACHE nennt die Synchronisation und ihre Betriebsart beim Namen", () => {
    const ursache = teil(warnblock(onboarding()), "Ursache.");
    expect(ursache, "Die Ursache nennt iCloud nicht").toContain("iCloud");
    expect(
      ursache,
      "Die konkrete Betriebsart „Schreibtisch & Dokumente“ fehlt in der Ursache — ohne sie weiss niemand, wonach er suchen soll",
    ).toContain("Schreibtisch & Dokumente");
  });

  it("das RISIKO sagt, dass es die Git-Buchführung selbst trifft — nicht nur Dateien daneben", () => {
    // Das ist der Unterschied zwischen Aufräumärgernis und Integritätsrisiko. Ein Text, der nur
    // „es entstehen Kopien“ sagt, verharmlost den gemessenen Befund.
    const risiko = teil(warnblock(onboarding()), "Risiko");
    expect(risiko, "Das Risiko erwähnt `.git` nicht — es wird verharmlost").toContain(".git");
  });
});

describe("JOB 1114 · A4 · SICHERE ZIELE: der Block nennt Muster, nicht nur Verbote", () => {
  it("er nennt mindestens zwei sichere Zielmuster", () => {
    const ziel = teil(warnblock(onboarding()), "Sicherer Zielort.");
    expect(
      ziel,
      "Kein sicheres Zielmuster genannt — ein Verbot ohne Alternative hilft niemandem",
    ).toContain("~/Projekte");
    expect(ziel).toContain("~/Developer");
  });

  it("er benennt die zu meidenden Orte vollständig, nicht nur iCloud", () => {
    // Dropbox und OneDrive benennen ihre Konfliktkopien anders (`conflicted copy`, `– Konflikt`).
    // Ein Text, der nur iCloud meidet, deckt den Fall nur zufällig ab.
    const ziel = teil(warnblock(onboarding()), "Sicherer Zielort.");
    for (const ort of ["~/Documents", "~/Desktop", "Dropbox", "OneDrive"]) {
      expect(ziel, `Der sichere Zielort sagt nicht, dass ${ort} zu meiden ist`).toContain(ort);
    }
  });
});

describe("JOB 1114 · A5 · PRÜFWEG: der Block sagt, wie man es nachsieht", () => {
  it("er nennt den Weg zur Systemeinstellung", () => {
    const pruefweg = teil(warnblock(onboarding()), "Prüfweg");
    expect(
      pruefweg,
      "Kein Prüfweg über die Systemeinstellung — dann bleibt die Warnung eine Behauptung",
    ).toContain("Systemeinstellungen");
  });

  it("er nennt die Wirkung, an der man es auch ohne Systemeinstellung erkennt", () => {
    // Der Erkennungssatz aus JOB 914: `X N.ext` neben `X.ext`, byteweise gleich, im selben Ordner.
    const pruefweg = teil(warnblock(onboarding()), "Prüfweg");
    expect(pruefweg, "Der Duplikat-Erkennungssatz fehlt").toMatch(/byte|Duplikat/i);
    expect(pruefweg, "Der sichtbare Namenszusatz ` 2` wird nicht genannt").toContain(" 2");
  });
});

describe("JOB 1114 · A6 · EHRLICHKEIT: aus dem Pfadnamen folgt nichts", () => {
  it("der Block sagt ausdrücklich, dass der Pfad allein kein Beleg ist", () => {
    // Die tragende Grenze aus JOB 914 §3: der Pfadtest sagt NEIN, obwohl das Phänomen vorliegt.
    const pruefweg = teil(warnblock(onboarding()), "Prüfweg");
    expect(pruefweg, "Der Prüfweg enthält keinen Vorbehalt zum Pfadnamen").toContain("Pfadname");
    expect(
      pruefweg,
      "Der Vorbehalt sagt nicht, dass der Pfadname NICHTS beweist — dann ist er keiner",
    ).toMatch(/beweist (dabei )?nichts|kein Beleg|beweist nicht/i);
  });

  it("nirgends in der Datei steht Synchronisation als Tatsache aus dem Pfad", () => {
    // Verbotene Kurzschlüsse. Sie wären bequem und stünden stiller falsch da als Schweigen.
    const text = onboarding();
    const verboten = [
      "~/Documents wird von iCloud synchronisiert",
      "~/Documents liegt in iCloud",
      "~/Documents ist synchronisiert",
      "Dein ~/Documents wird synchronisiert",
    ];
    for (const satz of verboten) {
      expect(text, `Pauschale Behauptung gefunden: „${satz}“`).not.toContain(satz);
    }
  });
});

describe("JOB 1114 · A7 · KLONZIELE: kein Repo landet mehr in einem Sync-Ordner", () => {
  it("keine Zeile des Klon-Prompts zeigt nach ~/Documents oder ~/Desktop", () => {
    // Die Warnung allein genügt nicht: solange der Prompt daneben nach `~/Documents` klont,
    // gewinnt die Anweisung gegen den Hinweis.
    const text = onboarding();
    const klonZeilen = text
      .split("\n")
      .filter((z) => /→\s*~\//.test(z))
      .map((z) => z.trim());
    expect(klonZeilen.length, "Der Klon-Prompt hat keine vier Zielzeilen mehr").toBe(4);
    for (const zeile of klonZeilen) {
      expect(zeile, `Klonziel liegt weiterhin in einem Sync-Ordner: ${zeile}`).not.toMatch(
        /~\/(Documents|Desktop)\b/,
      );
    }
  });

  it("alle vier Repos stehen unter demselben sicheren Wurzelordner", () => {
    const text = onboarding();
    const ziele = text
      .split("\n")
      .filter((z) => /→\s*~\//.test(z))
      .map((z) => (/→\s*(\S+)/.exec(z)?.[1] ?? "").trim());
    expect(ziele).toHaveLength(4);
    for (const ziel of ziele) {
      expect(ziel, `Klonziel ausserhalb des sicheren Wurzelordners: ${ziel}`).toMatch(
        /^~\/Projekte\//,
      );
    }
  });

  it("auch die übrigen Pfadangaben der Datei sind mitgezogen — keine zweite Wahrheit", () => {
    // Eine Anleitung, die nach `~/Projekte` klont und danach aus `~/Documents` liest, schickt den
    // Mitarbeiter ins Leere. Der Wächter prüft deshalb die ganze Datei, nicht nur den Prompt.
    const text = onboarding();
    const rest = text.replace(warnblock(text), "");
    expect(
      rest.match(/~\/Documents\//g) ?? [],
      "Ausserhalb des Warnblocks stehen weiterhin ~/Documents-Pfade",
    ).toEqual([]);
  });
});
