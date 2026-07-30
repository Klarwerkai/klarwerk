// ================================================================================================
// AUFTRAG-mega61 BLOCK A4 — DER SAMMLER ÜBER DIE NOCH OFFENEN ANGABEN.
// ================================================================================================
//
// DIE GEFAHR, GEGEN DIE ER STEHT, ist nicht hypothetisch, sondern die naheliegendste Versuchung
// dieses ganzen Auftrags: Ein Impressum mit sichtbaren Platzhaltern sieht unfertig aus. Es ist
// verlockend, „vorläufig" etwas Plausibles einzusetzen — einen Firmennamen, eine Anschrift, eine
// Registernummer. Genau das wäre der Fehler. Eine erfundene Pflichtangabe ist schlechter als eine
// fehlende: die fehlende ist erkennbar offen, die erfundene ist falsch und sieht richtig aus.
//
// Der Sammler prüft deshalb die BAUFORM, nicht die heutige Liste: JEDER Schlüssel unter
// `legal.tbd.` trägt in JEDER Sprache exakt den Platzhalterwert dieser Sprache. Ein künftiger
// `legal.tbd.hausbank` mit einem ausgedachten Namen wird rot, ohne dass jemand an diesen Test
// denken muss.
//
// Er liest die Sprachblöcke aus der Quelldatei — dasselbe Verfahren wie
// tests/i18n/nl-completeness.test.ts, und aus demselben Grund: so sieht er ALLE Schlüssel, nicht
// nur die, an die ein Aufrufer gedacht hat.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const quelle = readFileSync(join(__dirname, "..", "..", "apps", "web", "src", "i18n.ts"), "utf8");

function objekt(marker: string): Record<string, string> {
  const start = quelle.indexOf(marker);
  if (start < 0) {
    throw new Error(`Marker nicht gefunden: ${marker}`);
  }
  const auf = quelle.indexOf("{", start);
  const zu = quelle.indexOf("\n};", auf);
  // Reines Objektliteral mit erhaltenem Escaping → sicher auswertbar.
  return new Function(`return (${quelle.slice(auf, zu + 2)})`)() as Record<string, string>;
}

const SPRACHEN: Record<string, Record<string, string>> = {
  de: objekt("const de = {"),
  en: objekt("const en: typeof de = {"),
  nl: objekt("const nl: typeof de = {"),
};

describe("mega61 A4 · der Sammler über die noch offenen Angaben", () => {
  it("die Erhebung greift überhaupt", () => {
    // Ein leerer Sammler wäre ein grüner Sammler, der nichts bewacht.
    for (const [sprache, texte] of Object.entries(SPRACHEN)) {
      expect(Object.keys(texte).length, sprache).toBeGreaterThan(2000);
      expect(
        Object.keys(texte).filter((k) => k.startsWith("legal.tbd.")).length,
        sprache,
      ).toBeGreaterThan(10);
    }
  });

  it("KEIN Vorab-Schlüssel trägt einen erfundenen Wert — in keiner der drei Sprachen", () => {
    const verstoesse: string[] = [];
    for (const [sprache, texte] of Object.entries(SPRACHEN)) {
      const platzhalter = texte["legal.pending"];
      expect(platzhalter, `legal.pending fehlt in ${sprache}`).toBeTruthy();
      for (const [schluessel, wert] of Object.entries(texte)) {
        if (schluessel.startsWith("legal.tbd.") && wert !== platzhalter) {
          verstoesse.push(`${sprache}:${schluessel} = „${wert}“ statt „${platzhalter}“`);
        }
      }
    }
    expect(verstoesse).toEqual([]);
  });

  it("die drei Sprachen führen DIESELBEN Vorab-Schlüssel", () => {
    // Ein Schlüssel, den es nur in DE gibt, wäre eine Angabe, die in EN und NL still fehlt.
    const de = Object.keys(SPRACHEN.de ?? {})
      .filter((k) => k.startsWith("legal.tbd."))
      .sort();
    for (const sprache of ["en", "nl"]) {
      const andere = Object.keys(SPRACHEN[sprache] ?? {})
        .filter((k) => k.startsWith("legal.tbd."))
        .sort();
      expect(andere, sprache).toEqual(de);
    }
  });

  it("die Rechtstexte nennen keine aufgehobene Vorschrift", () => {
    // § 5 TMG ist seit dem 14.05.2024 durch § 5 DDG ersetzt und steht trotzdem noch unter sehr
    // vielen deutschen Impressen. Wer ihn hier einsetzt, zitiert ins Leere.
    for (const [sprache, texte] of Object.entries(SPRACHEN)) {
      const tmg = Object.entries(texte).filter(
        ([schluessel, wert]) => schluessel.startsWith("legal.") && wert.includes("TMG"),
      );
      expect(tmg, `${sprache} nennt das aufgehobene TMG`).toEqual([]);
    }
  });
});
