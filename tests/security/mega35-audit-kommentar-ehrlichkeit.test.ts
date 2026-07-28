// ================================================================================================
// AUFTRAG-mega35 BLOCK D — ZWEI FALSCHE BEHAUPTUNGEN IM EIGENEN CODE.
// ================================================================================================
//
// D1. Der Kommentar an `MAX_PAYLOAD_ORDERINGS` behauptete, der Live-Bestand brauche „höchstens
//     4.320 Umordnungen (6 Schlüssel, ein verschachteltes 3-Schlüssel-Objekt)". Ein Eintrag dieser
//     Form kommt im untersuchten Bestand NICHT vor. Der reale Höchstfall sind sechs FLACHE
//     Schlüssel: seq 757, `import.cleanup`, 6! = 720. Der zweite Fehlgriff — jeder Eintrag mit mehr
//     als einem Payload-Schlüssel erzeuge eine Abweichung — ist zu absolut: von 189 solchen
//     Einträgen weichen 182 ab, sieben nicht.
//
// D2. Die Kante des Deckels ist ein MÖGLICHER FALSCHER ROTER ALARM und muss dort, wo der Deckel
//     steht, als solcher benannt sein: ab neun flachen Schlüsseln wird ein Eintrag `unchecked`
//     gemeldet, obwohl keine Wertänderung vorliegen muss.
//
// WARUM EIN TEST FÜR EINEN KOMMENTAR — dieselbe Begründung wie in mega32 L
// (tests/conflicts/detection-cap-comment-honesty.test.ts): ein Kommentar, der eine Rechnung oder
// Messung behauptet, ohne dass sie geprüft wird, ist genau die Klasse, wegen der diese Woche neun
// Runden gebraucht hat.
//
// Der Test hängt NICHT am Forensik-Export (`_relay/` ist kein Teil der Auslieferung). Geprüft wird,
// was ohne ihn prüfbar ist: die ARITHMETIK der genannten Zahlen und die Deckel-Kante gegen den
// echten `MAX_PAYLOAD_ORDERINGS` — sowie dass die widerlegten Aussagen verschwunden sind.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAX_PAYLOAD_ORDERINGS } from "../../services/audit";

const QUELLE = readFileSync(join(process.cwd(), "services/audit/src/chain.ts"), "utf8");
const FLIESSTEXT = QUELLE.replace(/\n\s*\/\/\s*/g, " ");

function fakultaet(n: number): number {
  let acc = 1;
  for (let i = 2; i <= n; i++) {
    acc *= i;
  }
  return acc;
}

describe("mega35 D1 · die widerlegten Behauptungen stehen nicht mehr da", () => {
  it("der Bestand braucht NICHT „höchstens 4.320 Umordnungen“", () => {
    expect(FLIESSTEXT).not.toMatch(/Live-Bestand braucht höchstens 4\.320 Umordnungen/);
  });

  it("die absolute Multi-Key-Aussage steht nicht mehr als Tatsache da", () => {
    // Das Wort darf vorkommen — aber nur noch in der KORREKTUR, die sie ausdrücklich einschränkt.
    expect(FLIESSTEXT).toContain("ist zu absolut");
    expect(FLIESSTEXT).toContain("SIEBEN nicht");
  });
});

describe("mega35 D1 · die genannten Zahlen rechnen auf", () => {
  it("der reale Höchstfall: sechs flache Schlüssel sind 720 Varianten", () => {
    expect(fakultaet(6)).toBe(720);
    expect(FLIESSTEXT).toContain("Maximum 720");
    expect(FLIESSTEXT).toContain("seq 757");
    expect(FLIESSTEXT).toContain("6! = 720");
  });

  it("der verschachtelte Fall: 4! * 3! = 144", () => {
    expect(fakultaet(4) * fakultaet(3)).toBe(144);
    expect(FLIESSTEXT).toContain("4! * 3! = 144");
  });

  it("die genannte Verteilung summiert sich auf die 871 Einträge des Exports", () => {
    // 1→682, 2→110, 6→36, 120→37, 144→5, 720→1
    const verteilung = [682, 110, 36, 37, 5, 1];
    expect(verteilung.reduce((a, b) => a + b, 0)).toBe(871);
    expect(FLIESSTEXT).toContain("1→682, 2→110, 6→36, 120→37, 144→5, 720→1");
    // Und die Multi-Key-Zahl ist genau der Rest: alles mit mehr als einer Variante.
    expect(871 - 682).toBe(189);
    expect(189 - 182).toBe(7);
    expect(FLIESSTEXT).toContain("189 Einträge");
    expect(FLIESSTEXT).toContain("182 davon weichen ab");
  });

  it("kein Eintrag des Bestandes reißt den Deckel — die genannte Reserve stimmt", () => {
    expect(720).toBeLessThan(MAX_PAYLOAD_ORDERINGS);
    // „rund das Siebzigfache" — 50.000 / 720 = 69,4.
    expect(Math.round(MAX_PAYLOAD_ORDERINGS / 720)).toBe(69);
  });
});

describe("mega35 D2 · die Deckel-Kante ist als möglicher Fehlalarm dokumentiert", () => {
  it("acht flache Schlüssel werden untersucht, neun nicht — gegen den ECHTEN Deckel gerechnet", () => {
    expect(fakultaet(8)).toBe(40_320);
    expect(fakultaet(8)).toBeLessThanOrEqual(MAX_PAYLOAD_ORDERINGS);
    expect(fakultaet(9)).toBe(362_880);
    expect(fakultaet(9)).toBeGreaterThan(MAX_PAYLOAD_ORDERINGS);
    expect(FLIESSTEXT).toContain("8! = 40.320");
    expect(FLIESSTEXT).toContain("9! = 362.880");
  });

  it("der Kommentar nennt die Kante beim Namen: möglicher Fehlalarm, keine Wertänderung nötig", () => {
    expect(FLIESSTEXT).toContain("OBWOHL KEINE WERTÄNDERUNG VORLIEGEN MUSS");
    expect(FLIESSTEXT).toContain("möglicher FEHLALARM");
    // Und er hält fest, dass die ANZEIGE davon unberührt korrekt bleibt.
    expect(FLIESSTEXT).toContain("nicht geprüft");
    expect(FLIESSTEXT).toContain("keine Manipulationsaussage");
  });

  it("der Deckelwert selbst ist unverändert — diese Datei ist keine Erlaubnis, ihn zu bewegen", () => {
    expect(MAX_PAYLOAD_ORDERINGS).toBe(50_000);
  });
});
