// ================================================================================================
// I18N-AUFTEILUNG (Aufnahme 20260922 · zentrale-module-aufteilen) — DIE AUFTEILUNG IST VERLUSTFREI.
// ================================================================================================
//
// Die drei Grundwörterbücher standen bis zu diesem Auftrag in `apps/web/src/i18n.ts`. Jetzt stehen
// sie je Sprache in `apps/web/src/woerterbuch/{de,en,nl}.ts`. Diese Datei belegt zweierlei, und
// beides gegen einen Bezugspunkt, den der Test nicht selbst erzeugt:
//
//   W1/W2 — TEXT. Die vier Dateien ergeben, wieder zusammengefügt, Byte für Byte den früheren
//           Inhalt von `i18n.ts`. Bezugspunkt ist `i18n-vor-aufteilung.txt` daneben: eine
//           unveränderte Kopie der ungeteilten Datei. Seit der Integration mit `main` (Nacharbeit 3)
//           ist das die Datei von `main` a2ff8da8 — mit den dort neuen Schlüsseln und dem
//           R-0801-Nachladen —, nachprüfbar mit
//           `git hash-object tests/i18n-woerterbuch/i18n-vor-aufteilung.txt` gegen
//           `git rev-parse 1147c026:apps/web/src/i18n.ts` (`1dbd6f42…`, Nacharbeit 5: dazu die
//           R-0247-Schlüssel `val.doppel.bestaetigung.*`). Einziger Unterschied
//           außer den Blöcken: ein Kommentarabsatz von R-0801, den das Zusammenfügen zurücksetzt
//           (`R0801_ABSATZ_JETZT` in `tests/support/woerterbuchquelle.ts`).
//   W3    — LAUFZEIT. Das initialisierte i18next trägt jeden Schlüssel der drei Dateien mit genau
//           ihrem Wert. Der Umzugsnachweis gegen den älteren Basisstand (JOB 4367,
//           `tests/i18n-textmodule/bestand-unveraendert.test.ts` K1.1) gilt daneben unverändert.
//
// Der Duplikatwächter (Textmodul-Vertrag) wird weiterverwendet, nicht ersetzt: W4 belegt, dass
// sein Grundbestand die drei Dateien samt gespreadeter Lesevariante mitliest.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { basisSchluesselAusQuelltext } from "../../apps/web/src/texte/intern/pruefung";
import { basisQuellen } from "../../apps/web/src/texte/intern/sammeln";
import { de } from "../../apps/web/src/woerterbuch/de";
import { en } from "../../apps/web/src/woerterbuch/en";
import { nl } from "../../apps/web/src/woerterbuch/nl";
import { repoPfad } from "../support/repoPfad";
import {
  I18N_RELATIV,
  WOERTERBUCH_MARKE,
  WOERTERBUCH_SPRACHEN,
  fuegeWoerterbuchZusammen,
  woerterbuchBlock,
  woerterbuchQuelleHistorisch,
  woerterbuchRelativ,
  woerterbuchTeile,
} from "../support/woerterbuchquelle";

const VORHER = readFileSync(repoPfad("tests/i18n-woerterbuch/i18n-vor-aufteilung.txt"), "utf8");
const OBJEKTE: Record<string, Record<string, string>> = { de, en, nl };

describe("I18N-AUFTEILUNG · W — die Wörterbücher sind verschoben, nicht verändert", () => {
  it("W1 · Byte für Byte: die vier Dateien ergeben genau die frühere i18n.ts", () => {
    // Kalibrierung: ein leerer oder halber Bezugspunkt machte den Vergleich wertlos.
    expect(VORHER.split("\n").length).toBeGreaterThan(18_000);
    expect(VORHER).toContain("const nl: typeof de = {");
    // Aufnahme 20260922 · antwort-quellenanzeige (Ben zu e6eb2409): der Nachweis in seinem
    // HISTORISCHEN Umfang — ohne die nach der Aufteilung benannt ergänzten Produkttexte
    // (`ERGAENZTE_SCHLUESSEL` in tests/support/woerterbuchquelle.ts). Jede andere Abweichung bleibt rot.
    expect(woerterbuchQuelleHistorisch()).toBe(VORHER);
  });

  it("W2 · Gegenproben: ein Zeichen, ein fehlender Anker oder ein fremder Vorspann wird ROT", () => {
    const teile = woerterbuchTeile();
    // (a) ein Zeichen in einem Wert → der zusammengefügte Text weicht ab
    const verfaelscht = { ...teile, en: teile.en.replace('"Why only sourced answers?"', '"Why?"') };
    expect(verfaelscht.en).not.toBe(teile.en);
    expect(fuegeWoerterbuchZusammen(verfaelscht)).not.toBe(VORHER);
    // (b) fehlt der Hinweis an der Stelle der Blöcke, bricht das Zusammenfügen ab
    expect(() =>
      fuegeWoerterbuchZusammen({ ...teile, i18n: teile.i18n.replace(WOERTERBUCH_MARKE, "") }),
    ).toThrow(/genau einmal/);
    // (c) trägt eine Sprachdatei mehr als den verschobenen Block, bricht es ebenfalls ab
    expect(() => woerterbuchBlock("nl", `// fremd\n${teile.nl}`)).toThrow(/Vorspann/);
  });

  it("W3 · Laufzeit: i18next trägt jeden Schlüssel der drei Dateien mit genau ihrem Wert", () => {
    const deSchluessel = Object.keys(de).sort();
    expect(deSchluessel.length).toBeGreaterThan(4000);
    for (const sprache of WOERTERBUCH_SPRACHEN) {
      const objekt = OBJEKTE[sprache] as Record<string, string>;
      // Dieselbe Schlüsselmenge in allen drei Sprachen — wie vorher über `typeof de` gebunden.
      expect(Object.keys(objekt).sort(), sprache).toEqual(deSchluessel);
      const bestand = i18n.getResourceBundle(sprache, "translation") as Record<string, string>;
      const abweichend = Object.keys(objekt).filter((k) => bestand[k] !== objekt[k]);
      expect(abweichend, `${sprache}: Laufzeitwert weicht vom Wörterbuch ab`).toEqual([]);
    }
  });

  it("W4 · der vorhandene Duplikatwächter liest die drei Dateien samt Lesevariante mit", () => {
    const quellen = basisQuellen(repoPfad(I18N_RELATIV));
    for (const sprache of WOERTERBUCH_SPRACHEN) {
      expect(
        quellen.some((datei) => datei.endsWith(woerterbuchRelativ(sprache))),
        `${woerterbuchRelativ(sprache)} fehlt im Grundbestand des Textmodul-Vertrags`,
      ).toBe(true);
    }
    expect(quellen.some((datei) => datei.endsWith("lib/lesevariante.ts"))).toBe(true);
    const statisch = basisSchluesselAusQuelltext(quellen.map((d) => readFileSync(d, "utf8")));
    const fehlend = Object.keys(de).filter((k) => !statisch.has(k));
    expect(fehlend, "diese Schlüssel sieht der Wächter nicht — er wäre für sie blind").toEqual([]);
  });

  it("W5 · i18n.ts trägt keinen Wörterbucheintrag mehr — die Texte stehen nur noch je Sprache", () => {
    const teile = woerterbuchTeile();
    const eintraege = teile.i18n.split("\n").filter((zeile) => /^ {2}"[^"]+":/.test(zeile));
    expect(eintraege).toEqual([]);
    for (const sprache of WOERTERBUCH_SPRACHEN) {
      const datei = teile[sprache];
      expect(datei.split(`\nconst ${sprache}`).length - 1, sprache).toBe(1);
    }
    console.log(
      [
        "",
        "I18N-AUFTEILUNG · Zeilen je Datei",
        `  ${I18N_RELATIV}: ${teile.i18n.split("\n").length - 1} (vorher ${VORHER.split("\n").length - 1})`,
        ...WOERTERBUCH_SPRACHEN.map(
          (s) => `  ${woerterbuchRelativ(s)}: ${teile[s].split("\n").length - 1}`,
        ),
        "",
      ].join("\n"),
    );
  });
});
