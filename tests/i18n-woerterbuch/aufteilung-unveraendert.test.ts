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
//           (`R0801_ABSATZ_JETZT` in `tests/support/woerterbuchquelle.ts`). Spätere Aufträge
//           (seit Nacharbeit 8) sind EINZELN mit Beleg zugeordnet (`SPAETERE_REGISTER`,
//           `SPAETERE_CODEAENDERUNGEN`, Nacharbeit 59); W2b belegt, dass Unbelegtes rot bleibt.
//           W2c (Nacharbeit 61): eine Wertänderung gilt nur je Sprache mit dem belegten Vorher-
//           und Nachherwert und nur, solange der Schlüssel genau einmal fortbesteht.
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
import type { SpaetereWertaenderung } from "../support/woerterbuch-geaenderte-werte";
import {
  I18N_RELATIV,
  SPAETERE_REGISTER,
  type SpaetereRegister,
  WOERTERBUCH_MARKE,
  WOERTERBUCH_SPRACHEN,
  fuegeWoerterbuchZusammen,
  ohneSpaetereCodeaenderungen,
  spaetereAenderungen,
  woerterbuchBlock,
  woerterbuchQuelleHistorisch,
  woerterbuchRelativ,
  woerterbuchTeile,
} from "../support/woerterbuchquelle";

const VORHER = readFileSync(repoPfad("tests/i18n-woerterbuch/i18n-vor-aufteilung.txt"), "utf8");
const OBJEKTE: Record<string, Record<string, string>> = { de, en, nl };
const LEER: SpaetereRegister = { ergaenzt: [], geaendert: [], umbrochen: [], kommentare: [] };
const NAV_TASKS_DE: SpaetereWertaenderung = {
  beleg: "Gegenprobe",
  sprache: "de",
  schluessel: "nav.tasks",
  vorher: "Meine Aufgaben",
  nachher: "Offene Aufgaben",
};

describe("I18N-AUFTEILUNG · W — die Wörterbücher sind verschoben, nicht verändert", () => {
  it("W1 · Byte für Byte: die vier Dateien ergeben genau die frühere i18n.ts", () => {
    // Kalibrierung: ein leerer oder halber Bezugspunkt machte den Vergleich wertlos.
    expect(VORHER.split("\n").length).toBeGreaterThan(18_000);
    expect(VORHER).toContain("const nl: typeof de = {");
    // Aufnahme 20260922 · antwort-quellenanzeige (Ben zu e6eb2409): der Nachweis in seinem
    // HISTORISCHEN Umfang — ohne die nach der Aufteilung benannt ergänzten Produkttexte
    // (`ERGAENZTE_SCHLUESSEL` in tests/support/woerterbuchquelle.ts). Jede andere Abweichung bleibt rot.
    //
    // Gesamtcheck R-1329, Nacharbeit 59: seit Nacharbeit 8 tragen spätere Aufträge weitere Schlüssel,
    // Werte und Codezeilen in den Baum. Jede davon ist EINZELN mit Beleg benannt
    // (`SPAETERE_CODEAENDERUNGEN`, `SPAETERE_REGISTER`) und wird hier Zeile für Zeile nachvollzogen.
    // Rot bleibt: jede Abweichung ohne Zuordnung, jeder Registereintrag ohne Abweichung — und am Ende
    // muss der Baum, die erklärten Abschnitte zurückgesetzt, wieder Byte für Byte VORHER ergeben.
    const befund = spaetereAenderungen(VORHER, woerterbuchQuelleHistorisch());
    expect(befund.unerklaert, "Abweichungen ohne belegte Zuordnung").toEqual([]);
    expect(befund.unbenutzt, "Registereinträge ohne zugehörige Abweichung").toEqual([]);
    expect(befund.zurueckgefuehrt).toBe(VORHER);
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

  it("W2b · Gegenproben der Zuordnung: Unbelegtes bleibt ROT, ein toter Registereintrag auch", () => {
    const anker = "const nl: typeof de = {\n";
    const neuerSchluessel = '  "w1.gegenprobe.neu": "Gegenprobe",\n';
    const mitNeuem = VORHER.replace(anker, `${anker}${neuerSchluessel}`);
    expect(mitNeuem).not.toBe(VORHER);
    // (a) ein neuer Schlüssel ohne Registereintrag
    expect(spaetereAenderungen(VORHER, mitNeuem, LEER).unerklaert).toEqual([
      expect.stringContaining('"w1.gegenprobe.neu"'),
    ]);
    // (b) Kalibrierung: derselbe Schlüssel, benannt und samt Begleitkommentar → zugeordnet
    const benannt: SpaetereRegister = {
      ...LEER,
      ergaenzt: [{ beleg: "Gegenprobe", schluessel: ["w1.gegenprobe.neu"] }],
    };
    const mitKommentar = VORHER.replace(
      anker,
      `${anker}  // Gegenprobe: Begleitkommentar\n${neuerSchluessel}`,
    );
    const zugeordnet = spaetereAenderungen(VORHER, mitKommentar, benannt);
    expect(zugeordnet.unerklaert).toEqual([]);
    expect(zugeordnet.unbenutzt).toEqual([]);
    expect(zugeordnet.zurueckgefuehrt).toBe(VORHER);
    // (c) ein geänderter Wert ohne Registereintrag — beide Fassungen werden genannt
    const wert = VORHER.replace('"Why only sourced answers?"', '"Why?"');
    expect(wert).not.toBe(VORHER);
    expect(spaetereAenderungen(VORHER, wert, benannt).unerklaert).toEqual([
      expect.stringContaining('"Why only sourced answers?"'),
      expect.stringContaining('"Why?"'),
    ]);
    // (d) ein umformulierter Kommentar und (e) ein allein hinzugefügter Kommentar
    const kommentar = VORHER.split("\n").find((z) => /^ {2}\/\/ \S/.test(z)) as string;
    const umformuliert = VORHER.replace(kommentar, `${kommentar} (umformuliert)`);
    expect(spaetereAenderungen(VORHER, umformuliert, LEER).unerklaert).toHaveLength(2);
    const fremd = VORHER.replace(anker, `${anker}  // fremder Kommentar\n`);
    expect(spaetereAenderungen(VORHER, fremd, LEER).unerklaert).toEqual([
      expect.stringContaining("fremder Kommentar"),
    ]);
    // (f) ein Registereintrag ohne Abweichung und ein „ergänzter" Schlüssel, der schon da war
    const tot: SpaetereRegister = {
      ...LEER,
      ergaenzt: [{ beleg: "Gegenprobe", schluessel: ["nav.capture"] }],
      geaendert: [NAV_TASKS_DE],
    };
    const leerlauf = spaetereAenderungen(VORHER, VORHER, tot);
    expect(leerlauf.unerklaert).toEqual([]);
    expect(leerlauf.unbenutzt).toEqual(
      expect.arrayContaining([
        expect.stringContaining("nav.capture als ergänzt benannt, steht aber im Bezugspunkt"),
        expect.stringContaining("de nav.tasks: belegter Nachherwert nicht genau einmal im Baum"),
      ]),
    );
    // (h) „nur umbrochen" gilt allein bei wörtlich gleichem Wert
    const einzeilig = '  "ask.help.sources.title": "Why only sourced answers?",';
    expect(VORHER).toContain(einzeilig);
    const umbruch: SpaetereRegister = {
      ...LEER,
      umbrochen: [{ beleg: "Gegenprobe", schluessel: ["ask.help.sources.title"] }],
    };
    const zweizeilig = '  "ask.help.sources.title":\n    "Why only sourced answers?",';
    const umbrochenerText = VORHER.replace(einzeilig, zweizeilig);
    const nurUmbrochen = spaetereAenderungen(VORHER, umbrochenerText, umbruch);
    expect(nurUmbrochen.unerklaert).toEqual([]);
    expect(nurUmbrochen.unbenutzt).toEqual([]);
    expect(nurUmbrochen.zurueckgefuehrt).toBe(VORHER);
    const umbrochenUndGeaendert = spaetereAenderungen(
      VORHER,
      VORHER.replace(einzeilig, zweizeilig.replace("Why only sourced answers?", "Why?")),
      umbruch,
    );
    expect(umbrochenUndGeaendert.unerklaert).toHaveLength(3);
    expect(umbrochenUndGeaendert.unbenutzt).toEqual([
      expect.stringContaining("ask.help.sources.title als umbrochen benannt, aber der Wert"),
    ]);
    // (g) die Codezurückführung ist fail-closed: fehlt eine benannte Stelle, bricht es ab
    const i18n = woerterbuchTeile().i18n;
    expect(() =>
      ohneSpaetereCodeaenderungen(i18n.replace('bindI18nStore: "added"', 'bindI18nStore: ""')),
    ).toThrow(/genau einmal/);
  });

  it("W2c · Wertbindung: eine geänderte Zeile gilt nur mit belegtem Wert, je Sprache, fortbestehend", () => {
    // Nacharbeit 61 (Ben zu da61b6ce, QUELLEN-HILFE-d31b3303af2c): vorher genügte der Name.
    const deVorher = '  "nav.tasks": "Meine Aufgaben",';
    const enVorher = '  "nav.tasks": "My Tasks",';
    expect(VORHER.split(deVorher)).toHaveLength(2);
    expect(VORHER.split(enVorher)).toHaveLength(2);
    const register: SpaetereRegister = { ...LEER, geaendert: [NAV_TASKS_DE] };
    const neu = '  "nav.tasks": "Offene Aufgaben",';
    const mit = (ersatz: string) => VORHER.replace(deVorher, ersatz);
    const zeileVon = (zeile: string) => VORHER.split("\n").indexOf(zeile) + 1;
    // (a) Kalibrierung: genau die belegte Änderung → zugeordnet, Rückführung ergibt VORHER
    const erlaubt = spaetereAenderungen(VORHER, mit(neu), register);
    expect(erlaubt.unerklaert).toEqual([]);
    expect(erlaubt.unbenutzt).toEqual([]);
    expect(erlaubt.zurueckgefuehrt).toBe(VORHER);
    // (b) derselbe Schlüssel mit einem anderen, unbelegten Wert
    const fremderWert = '  "nav.tasks": "Fremder Wert",';
    const unbelegt = spaetereAenderungen(VORHER, mit(fremderWert), register);
    expect(unbelegt.unerklaert).toEqual([
      `- Z.${zeileVon(deVorher)}: ${deVorher}`,
      `+ Z.${zeileVon(deVorher)}: ${fremderWert}`,
    ]);
    expect(unbelegt.unbenutzt).toEqual([
      expect.stringContaining("de nav.tasks: belegter Nachherwert nicht genau einmal im Baum"),
    ]);
    expect(unbelegt.zurueckgefuehrt).not.toBe(VORHER);
    // (c) derselbe Schlüssel entfernt
    const ohne = VORHER.replace(`${deVorher}\n`, "");
    expect(ohne).not.toBe(VORHER);
    const weg = spaetereAenderungen(VORHER, ohne, register);
    expect(weg.unerklaert).toEqual([`- Z.${zeileVon(deVorher)}: ${deVorher}`]);
    expect(weg.unbenutzt).toEqual([
      expect.stringContaining("de nav.tasks: belegter Nachherwert nicht genau einmal im Baum"),
    ]);
    expect(weg.zurueckgefuehrt).not.toBe(VORHER);
    // (d) doppelt: die belegte Änderung plus eine zweite Zeile desselben Schlüssels
    const doppelt = spaetereAenderungen(VORHER, mit(`${neu}\n${neu}`), register);
    expect(doppelt.unerklaert).toHaveLength(3);
    expect(doppelt.unbenutzt).toEqual([
      expect.stringContaining("de nav.tasks: belegter Nachherwert nicht genau einmal im Baum"),
    ]);
    // (e) andere Sprache: der belegte Wert steht in en statt in de
    const vertauscht = VORHER.replace(enVorher, neu);
    const sprache = spaetereAenderungen(VORHER, vertauscht, register);
    expect(sprache.unerklaert).toEqual([
      `- Z.${zeileVon(enVorher)}: ${enVorher}`,
      expect.stringContaining('"Offene Aufgaben"'),
    ]);
    expect(sprache.unbenutzt).toHaveLength(1);
    // (f) das echte Register bindet jede Änderung an Sprache, Vorher- und Nachherwert
    expect(SPAETERE_REGISTER.geaendert).toHaveLength(37);
    for (const e of SPAETERE_REGISTER.geaendert) {
      expect(e.vorher, `${e.sprache} ${e.schluessel}`).not.toBe(e.nachher);
    }
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
