// ================================================================================================
// AUFTRAG-mega38 BLOCK J1 + J3 — DIE ZWEI BILLIGEN, SICHTBAREN STELLEN.
// ================================================================================================
//
// ZUM DATEINAMEN: diese Datei hiess bis mega38 „zz-j1-probe" — der Rest einer Wegwerf-Sonde, die
// in jener Sitzung nicht mehr umbenannt werden konnte (Dateioperationen waren nicht freigegeben).
// Der INHALT war schon immer der eines regulären Pins. AUFTRAG-mega39 BLOCK F hat den Namen
// nachgezogen: er sagt jetzt, was gepinnt wird — die Zählzeile der Bibliothek und die erste
// Beispielfrage auf /fragen.
//
// J1 — „1 Beiträge anzeigen" in der Bibliothek.
// BEFUND: die Zeichenkette ist im QUELLSTAND bereits richtig. `lib.facet.showResults` liegt seit
// AUFTRAG-mega34 F als `_one`/`_other` vor und wird mit `count` aufgerufen
// (apps/web/src/components/FacetFilter.tsx:374 und :381). Es gab hier nichts zu reparieren —
// wohl aber etwas zu PINNEN: der Test unten hält die richtige Form in allen drei Sprachen fest.
// Warum Pedi sie live trotzdem gesehen hat, ist genau Block C: der laufende Bau kann älter sein
// als der Quellstand, und bis mega37 sagte das niemand laut.
//
// J3 — die erste Beispielfrage auf /fragen war ein roher Importtitel.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { looksLikeSentenceTitle } from "../../apps/web/src/lib/askExampleChips";

const SPRACHEN = ["de", "en", "nl"] as const;

describe("mega38 J1 · die Bibliotheks-Zählzeile trägt Einzahl und Mehrzahl", () => {
  for (const lng of SPRACHEN) {
    it(`${lng} · 1 und 3 lauten verschieden, und die Zahl steht drin`, async () => {
      await i18n.changeLanguage(lng);
      const eins = i18n.t("lib.facet.showResults", { count: 1 });
      const drei = i18n.t("lib.facet.showResults", { count: 3 });
      expect(eins).toContain("1");
      expect(drei).toContain("3");
      expect(eins.replace(/\d+/g, "#")).not.toBe(drei.replace(/\d+/g, "#"));
      // Und kein durchgereichter Rohschlüssel, keine offene Variable.
      expect(eins).not.toBe("lib.facet.showResults");
      expect(eins).not.toContain("{{");
    });
  }
});

describe("mega38 J3 · nur Titel, die wie ein Satz aussehen, werden zur Beispielfrage", () => {
  it("Pedis Live-Fall fällt durch — roher Importtitel mit Gliederungsziffer und „(partly)“", () => {
    expect(
      looksLikeSentenceTitle("2 General requirements Based on HD Handbuch Vers Q1-2025 (partly)"),
    ).toBe(false);
  });

  it("die einzelnen Regeln greifen je für sich", () => {
    // Gliederungsziffer am Anfang.
    expect(looksLikeSentenceTitle("3.2 Anforderungen an die Ventilprüfung")).toBe(false);
    // Klammer-Anmerkung des Quellsystems.
    expect(looksLikeSentenceTitle("Wartungsplan für Ventil V4 (Rev. 3)")).toBe(false);
    // Zu kurz — daraus wird keine sinnvolle Frage.
    expect(looksLikeSentenceTitle("Ventil")).toBe(false);
    // Zu viele Wörter — die Frage wird unlesbar.
    expect(
      looksLikeSentenceTitle(
        "Anforderungen an die jährliche Prüfung sämtlicher Ventile in allen Werken",
      ),
    ).toBe(false);
    // Aufzählungszeichen statt Buchstabe.
    expect(looksLikeSentenceTitle("- Wartung der Pumpe P7")).toBe(false);
  });

  it("KALIBRIERUNG: normale Titel kommen durch — sonst wäre die Regel nur ein Dauer-Nein", () => {
    expect(looksLikeSentenceTitle("Wartungsplan für Ventil V4")).toBe(true);
    expect(looksLikeSentenceTitle("Prüfintervall für Filter F3")).toBe(true);
    expect(looksLikeSentenceTitle("Umgang mit Überdruck an Linie L4")).toBe(true);
  });
});
