// ==================================================================================================
// JOB 3078 · W1 — DER FESTE TAKT DARF IN F-0435 NICHT ZURUECKKOMMEN.
// ==================================================================================================
//
// DER ANLASS, gezaehlt und nicht behauptet: `tests/app/f0435-suchkette-mounted.test.tsx` wartete bis
// JOB 3078 ueber eine feste Zahl von Nulltakten, waehrend die Bibliothek ihre Sucheingabe um
// `LIBRARY_SEARCH_DEBOUNCE_MS` entprellt. Ergebnis war ein Wettlauf zwischen geratener Taktzahl und
// echter Frist: `protokoll.jsonl` weist am 04./05.09.2026 VIER Tor-Wiederholungen mit dem Grund
// „Tor rot in unberuehrten Tests“ und genau dieser Datei aus (JOB 3052 R7, JOB 3056 R3 und R9,
// JOB 3057 R1). Ein Tor, das ohne Sachgrund rot wird, erzieht dazu, rote Tore fuer Rauschen zu
// halten — deshalb ist der Rueckfall hier ein eigener Wachposten und nicht nur eine Kommentarbitte.
//
// WAS DIESER WAECHTER PRUEFT — vier Eigenschaften, jede einzeln belegbar:
//   (a) die Datei liest die Entprellungsdauer aus dem PRODUKTMODUL, statt eine Zahl abzuschreiben;
//   (b) in ihr steht keine gezaehlte Taktschleife (`for (let i = 0; …)`) mehr als Wartemittel;
//   (c) jede Warteschleife hat eine WIRKSAME Obergrenze, und die bleibt unter dem Vitest-Deckel;
//   (d) Kalibrierung: ein entschaerfter Zeitabbruch (`if (false)`) faellt (c) wirklich auf.
//
// WAS ER AUSDRUECKLICH NICHT TUT: er behauptet nichts ueber die uebrigen gemounteten Tests. Ob es
// dort weitere zeitabhaengige Stellen gibt, ist in JOB 3078 NICHT gemessen worden; ein Sammel-
// waechter waere eine Zusage ohne Deckung — genau die Gestalt, die dieses Haus austreibt.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest laeuft mit der Repo-Wurzel als Arbeitsverzeichnis (`vitest.config.ts`) — dieselbe Annahme
// wie `tests/structure/testverweise-aufloesbar.test.ts`.
const WURZEL = process.cwd();

const BEWACHT = "tests/app/f0435-suchkette-mounted.test.tsx";
const ENTPRELLMODUL = "apps/web/src/lib/useDebouncedValue.ts";

const quelle = readFileSync(join(WURZEL, BEWACHT), "utf8");

/**
 * Derselbe Text, aber ohne Kommentarzeilen — die Zeilennummern bleiben erhalten.
 *
 * WARUM: Die bewachte Datei BENENNT den abgeloesten Wartecode in ihrem Kopfkommentar, damit ein
 * Mensch weiss, wovon die Rede ist. Ein Waechter, der diese Erklaerung als Rueckfall meldet, zwingt
 * dazu, die Begruendung zu loeschen — und wird abgeschaltet. Dieselbe Trennlinie zwischen
 * Behauptung und Code zieht `tests/structure/testverweise-aufloesbar.test.ts` (dort umgekehrt: nur
 * Kommentarzeilen zaehlen). Beim Bau dieser Datei ist genau dieser Fehlalarm aufgetreten, gemessen
 * und nicht vermutet.
 */
function ohneKommentare(text: string): string {
  return (
    text
      .split("\n")
      // Gleiche Laenge statt leer: die Zeichenpositionen bleiben mit dem Original deckungsgleich,
      // damit Zeilennummern und Ausschnitte aus beiden Texten dieselbe Stelle meinen.
      .map((z) => (/^\s*(?:\/\/|\*|\/\*)/.test(z) ? " ".repeat(z.length) : z))
      .join("\n")
  );
}

const code = ohneKommentare(quelle);

/**
 * Der Rumpf eines Blocks ab der oeffnenden Klammer hinter `ab` — per Klammerzaehlung, damit
 * verschachtelte Bloecke mitkommen. Ein Regex ueber `while \{[^}]*\}` waere an der ersten
 * inneren `}` zerbrochen und haette den Deckel darunter uebersehen.
 */
function rumpfAb(text: string, ab: number): string {
  const start = text.indexOf("{", ab);
  if (start < 0) {
    return "";
  }
  let tiefe = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") {
      tiefe += 1;
    } else if (text[i] === "}") {
      tiefe -= 1;
      if (tiefe === 0) {
        return text.slice(start, i + 1);
      }
    }
  }
  return text.slice(start);
}

/** Der Klammerausdruck ab dem `(` bei/nach `ab` — ohne die aeusseren Klammern. */
function bedingungAb(text: string, ab: number): string {
  const start = text.indexOf("(", ab);
  if (start < 0) {
    return "";
  }
  let tiefe = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "(") {
      tiefe += 1;
    } else if (text[i] === ")") {
      tiefe -= 1;
      if (tiefe === 0) {
        return text.slice(start + 1, i);
      }
    }
  }
  return text.slice(start + 1);
}

function zeileVon(index: number): number {
  return quelle.slice(0, index).split("\n").length;
}

/**
 * ==================================================================================================
 * DIE OBERGRENZE MUSS WIRKEN, NICHT NUR DASTEHEN (JOB 3078 R2, Korrekturpflicht 2 aus BENs Befund).
 * ==================================================================================================
 *
 * Runde 1 fragte nur, ob `WARTEDECKEL_MS` IRGENDWO im Schleifenrumpf vorkommt. BEN hat den Wächter
 * damit ausgehebelt: er ersetzte die Abbruchbedingung durch `if (false)` und liess den Fehlertext
 * (der die Konstante nennt) stehen — der Wächter blieb gruen, obwohl die Schleife nun bis zum
 * Vitest-Deckel laufen kann. Ein Waechter, der eine tote Zeichenkette fuer eine wirksame Grenze
 * haelt, ist genau die ungedeckte Zusage, die dieses Haus austreibt.
 *
 * Geprueft wird deshalb die WACHE selbst: in jedem `while`-Rumpf muss ein `if` stehen, dessen
 * BEDINGUNG sowohl eine Zeitquelle (`Date.now()`) als auch `WARTEDECKEL_MS` nennt und dessen Block
 * wirft. `if (false)` verliert beides und faellt auf. Dass diese Pruefung wirklich greift, misst der
 * Kalibrierungsfall unten an einem verstellten Quelltext — nicht behauptet, sondern ausgefuehrt.
 */
function befundeZurObergrenze(quelltext: string): string[] {
  const c = ohneKommentare(quelltext);
  const befunde: string[] = [];
  for (const schleife of c.matchAll(/\bwhile\s*\(/g)) {
    const rumpf = rumpfAb(c, schleife.index ?? 0);
    const wirksam = [...rumpf.matchAll(/\bif\s*\(/g)].some((wache) => {
      const bedingung = bedingungAb(rumpf, wache.index ?? 0);
      const block = rumpfAb(rumpf, (wache.index ?? 0) + bedingung.length);
      return (
        bedingung.includes("WARTEDECKEL_MS") &&
        bedingung.includes("Date.now()") &&
        block.includes("throw")
      );
    });
    if (!wirksam) {
      befunde.push(`${BEWACHT}:${zeileVon(schleife.index ?? 0)}`);
    }
  }
  return befunde;
}

/** Derselbe Quelltext, aber die erste Abbruchbedingung einer Warteschleife ist entschaerft. */
function mitEntschaerftemAbbruch(quelltext: string): string {
  const c = ohneKommentare(quelltext);
  const schleife = c.match(/\bwhile\s*\(/);
  const rumpfStart = (schleife?.index ?? 0) + (schleife?.[0].length ?? 0);
  const wache = c.indexOf("if (", rumpfStart);
  const bedingung = bedingungAb(c, wache);
  return `${quelltext.slice(0, wache)}if (false)${quelltext.slice(wache + `if (${bedingung})`.length)}`;
}

describe(`JOB 3078 · W1 · ${BEWACHT} wartet auf Ereignisse, nicht auf geratene Takte`, () => {
  it("(a) die Entprellungsdauer kommt aus dem Produktmodul, nicht aus einer abgeschriebenen Zahl", () => {
    const treffer = code.match(
      /import\s*\{[^}]*\bLIBRARY_SEARCH_DEBOUNCE_MS\b[^}]*\}\s*from\s*"([^"]+useDebouncedValue)"/,
    );
    expect(
      treffer,
      `${BEWACHT} importiert LIBRARY_SEARCH_DEBOUNCE_MS nicht aus ${ENTPRELLMODUL}. Eine hier abgeschriebene Zahl laeuft von der Fläche weg, sobald jemand die Entprellung aendert.`,
    ).not.toBeNull();

    // Der Import zeigt auf eine wirklich vorhandene Quelle, und dort steht die Konstante auch.
    expect(existsSync(join(WURZEL, ENTPRELLMODUL))).toBe(true);
    expect(readFileSync(join(WURZEL, ENTPRELLMODUL), "utf8")).toContain(
      "export const LIBRARY_SEARCH_DEBOUNCE_MS",
    );

    // Und sie wird auch benutzt, nicht nur importiert.
    const benutzungen = [...code.matchAll(/\bLIBRARY_SEARCH_DEBOUNCE_MS\b/g)].length;
    expect(
      benutzungen,
      "LIBRARY_SEARCH_DEBOUNCE_MS ist importiert, aber nirgends verwendet — ein Import ist kein Warten.",
    ).toBeGreaterThan(1);
  });

  it("(b) keine gezaehlte Taktschleife mehr — der alte Weg steht nicht daneben", () => {
    // Genau die Gestalt, die vor JOB 3078 das einzige Wartemittel war:
    // `for (let i = 0; i < 40; i++) { await new Promise((r) => setTimeout(r, 0)); }`
    const gezaehlt = [...code.matchAll(/\bfor\s*\(\s*(?:let|var|const)\s+\w+\s*=\s*0\s*;/g)].map(
      (m) => `${BEWACHT}:${zeileVon(m.index ?? 0)}`,
    );
    expect(
      gezaehlt,
      "Eine gezaehlte Taktschleife ist zurueck. Wie viel echte Zeit N Takte kosten, entscheidet die Auslastung des Rechners — nicht die Kette, die dieser Test misst. Auf das Ereignis warten (Abruf beantwortet, Liste gezeichnet), nicht auf eine Zahl.",
    ).toEqual([]);
  });

  it("(c) jede Warteschleife hat eine Obergrenze, und die bleibt unter dem Vitest-Deckel", () => {
    const schleifen = [...code.matchAll(/\bwhile\s*\(/g)];
    expect(
      schleifen.length,
      "Keine einzige Warteschleife gefunden — dieser Waechter haette dann nichts zu bewachen und waere still gruen.",
    ).toBeGreaterThan(0);

    expect(
      befundeZurObergrenze(quelle),
      "Eine Warteschleife ohne WIRKSAME Obergrenze: es fehlt ein `if`, dessen Bedingung `Date.now()` UND `WARTEDECKEL_MS` nennt und das wirft. Ohne wirksame Grenze wird aus „warte auf das Ereignis“ ein „warte, bis es passt“ — ein kaputtes Produkt haengt dann bis zum Vitest-Deckel, statt zu sagen, was fehlte.",
    ).toEqual([]);

    // Die Obergrenze ist eine endliche Zahl und liegt unter dem globalen Deckel — sonst ersetzte
    // ein Haenger den sprechenden Fehler wieder durch einen nichtssagenden Zeitablauf.
    const deckel = code.match(/const\s+WARTEDECKEL_MS\s*=\s*([0-9_]+)\s*;/);
    expect(deckel, "WARTEDECKEL_MS ist kein fester Zahlenwert.").not.toBeNull();
    const wartedeckel = Number((deckel?.[1] ?? "").replace(/_/g, ""));
    expect(Number.isFinite(wartedeckel) && wartedeckel > 0).toBe(true);

    const vitestDeckel = Number(
      (
        readFileSync(join(WURZEL, "vitest.config.ts"), "utf8").match(
          /testTimeout:\s*([0-9_]+)/,
        )?.[1] ?? ""
      ).replace(/_/g, ""),
    );
    expect(Number.isFinite(vitestDeckel) && vitestDeckel > 0).toBe(true);
    expect(
      wartedeckel,
      `WARTEDECKEL_MS (${wartedeckel} ms) muss unter dem globalen Vitest-Deckel (${vitestDeckel} ms) bleiben.`,
    ).toBeLessThan(vitestDeckel);
  });

  it("(d) KALIBRIERUNG: ein entschaerfter Zeitabbruch faellt auf — der Waechter hat Zaehne", () => {
    // BENs Gegenprobe zu Runde 1, hier dauerhaft ausgefuehrt statt beschrieben: die Bedingung des
    // Abbruchs wird durch `false` ersetzt, der Fehlertext mit `WARTEDECKEL_MS` bleibt stehen. Genau
    // diese Verstellung hat der Waechter der Runde 1 nicht gesehen.
    const verstellt = mitEntschaerftemAbbruch(quelle);
    expect(
      verstellt,
      "Die Verstellung hat nichts geaendert — dann misst dieser Kalibrierungsfall nichts.",
    ).not.toBe(quelle);
    expect(
      verstellt.includes("if (false)") && verstellt.includes("WARTEDECKEL_MS"),
      "Die Verstellung muss den Abbruch entschaerfen UND den Fehlertext mit der Konstante stehen lassen — sonst faellt sie aus dem falschen Grund auf.",
    ).toBe(true);

    expect(
      befundeZurObergrenze(verstellt).length,
      "Der entschaerfte Zeitabbruch bleibt unentdeckt. Ein Waechter, der eine tote Zeichenkette fuer eine wirksame Grenze haelt, deckt nichts.",
    ).toBeGreaterThan(0);

    // Und die Gegenrichtung, damit (d) nicht einfach immer meldet: der unveraenderte Quelltext ist sauber.
    expect(befundeZurObergrenze(quelle)).toEqual([]);
  });
});
