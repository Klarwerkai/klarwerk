// ================================================================================================
// JOB 995 · D1 (D-020) — DIE KAPITAL-TITEL SPRECHEN DIE SPRACHE DES LESERS
// ================================================================================================
//
// DER BEFUND: Sechs Titel der Kapital-Sichten standen in ALLEN DREI Sprachbloecken wortgleich
// englisch. Ein deutscher Leser sah „Knowledge Capital Score", ein niederlaendischer ebenso.
//
// WARUM DIESER TEST OHNE RENDERER AUSKOMMT: Die Titel werden in `Stufe2.tsx` gerendert, und diese
// Datei wird ausdruecklich nicht angefasst (Designer-Wort). Der Mangel liegt in der i18n-Tabelle,
// also wird die i18n-Tabelle geprueft — ein Renderer haette hier nichts hinzugefuegt ausser einer
// zweiten Fehlerquelle.
//
// DIE DREI FAELLE T1-T3 SIND DER MANGEL, T4 IST SEINE GEGENRICHTUNG. T4 muss auf der Base bereits
// gruen sein: er faengt nicht die englischen Werte, sondern ein versehentliches Loeschen oder
// Umbenennen beim Beheben. Ein Test, der nur in eine Richtung schaut, laesst die andere offen.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";

/** Die sechs Titel der Kapital-Sichten — Gegenstand von D-020. */
const SCHLUESSEL = [
  "mgmt.capital",
  "mgmt.valuation",
  "mgmt.statement",
  "mgmt.maturity",
  "mgmt.house",
  "mgmt.recommendations",
] as const;

/** Die zwoelf Zielwerte, zeichengenau aus der Auftragstabelle. */
const ZIEL: Record<(typeof SCHLUESSEL)[number], { de: string; nl: string }> = {
  "mgmt.capital": { de: "Wissenskapital-Wert", nl: "Kenniskapitaal-score" },
  "mgmt.valuation": { de: "Wissensbewertung", nl: "Kenniswaardering" },
  "mgmt.statement": { de: "Wissensbilanz", nl: "Kennisbalans" },
  "mgmt.maturity": { de: "Reifegrad-Pfad", nl: "Volwassenheidspad" },
  "mgmt.house": { de: "Wissenshaus", nl: "Kennishuis" },
  "mgmt.recommendations": { de: "Empfehlungen", nl: "Aanbevelingen" },
};

function wert(sprache: "de" | "en" | "nl", schluessel: string): string {
  return String(i18n.getResource(sprache, "translation", schluessel) ?? "");
}

describe("D-020 · T1 · kein deutscher Titel ist der englische", () => {
  for (const schluessel of SCHLUESSEL) {
    it(`${schluessel}: DE ist nicht der EN-Wert`, () => {
      expect(
        wert("de", schluessel),
        "Der deutsche Titel ist zeichengleich mit dem englischen. Ein deutscher Leser sieht " +
          "damit eine englische Ueberschrift — genau der Befund D-020.",
      ).not.toBe(wert("en", schluessel));
    });
  }
});

describe("D-020 · T2 · kein niederlaendischer Titel ist eine Kopie", () => {
  for (const schluessel of SCHLUESSEL) {
    it(`${schluessel}: NL ist weder der EN- noch der DE-Wert`, () => {
      const nl = wert("nl", schluessel);
      expect(nl, "NL traegt den englischen Wert.").not.toBe(wert("en", schluessel));
      expect(
        nl,
        "NL traegt den deutschen Wert. Auch das ist keine Uebersetzung, nur eine andere Kopie.",
      ).not.toBe(wert("de", schluessel));
    });
  }
});

describe("D-020 · T3 · die zwoelf Werte stehen zeichengenau", () => {
  for (const schluessel of SCHLUESSEL) {
    it(`${schluessel}: DE und NL tragen den vereinbarten Wortlaut`, () => {
      expect(wert("de", schluessel)).toBe(ZIEL[schluessel].de);
      expect(wert("nl", schluessel)).toBe(ZIEL[schluessel].nl);
    });
  }
});

describe("D-020 · T4 · Gegenrichtung: kein Schluessel geht verloren", () => {
  // Dieser Block ist auf der Base bereits GRUEN. Er sichert die Behebung gegen ihren eigenen
  // naheliegendsten Fehler: einen Schluessel beim Aendern zu loeschen, umzubenennen oder zu leeren.
  for (const sprache of ["de", "en", "nl"] as const) {
    for (const schluessel of SCHLUESSEL) {
      it(`${sprache}/${schluessel}: vorhanden und nicht leer`, () => {
        expect(wert(sprache, schluessel).trim().length).toBeGreaterThan(0);
      });
    }
  }
});
