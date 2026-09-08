// JOB 3356 (IMPORT-FREITEXT-TITEL) — DAS TITELKRITERIUM, UND WARUM ES NICHT `keywords` IST.
//
// `keywords` sucht in Titel UND Statement (select.ts, matchesKeywords). Ein zweites Kriterium mit
// derselben Reichweite wäre nur ein Name mehr. `titleContains` ist deshalb ENGER: es vergleicht
// ausschließlich gegen den kanonisierten TITEL. Genau darauf beruht die Aussage der Auswahlfläche
// („N Seiten tragen diesen Text im Titel") — sie wäre falsch, wenn auch Fundstellen im Fließtext
// mitzählten. Dieser Test hält beide Enden fest: der Titel matcht, das Statement matcht nicht.
//
// Dazu die UND-Semantik gegenüber den anderen Kriterienarten: ein Titelkriterium ERWEITERT eine
// Auswahl nie. Würde es als ODER verdrahtet, käme die Menge aus dem Themenfilter wieder hinzu.
import { describe, expect, it } from "vitest";
import type { ImportItem } from "../../services/library-analytics";
import { filterImportItems, sanitizeCriteria } from "../../services/library-analytics";

function item(overrides: Partial<ImportItem> & { title: string }): ImportItem {
  return {
    statement: "kurz",
    type: "best_practice",
    category: "K",
    provider: "Confluence",
    updatedAt: "2026-06-01T00:00:00.000Z",
    textCodec: "decoded",
    ...overrides,
  };
}

const DEMO_TITEL = "[DEMO T06] Restoring a customer file";

describe("JOB 3356: titleContains matcht NUR den Titel", () => {
  it("findet den exakten Seitentitel, unabhängig von Groß-/Kleinschreibung", () => {
    const items = [
      item({ title: DEMO_TITEL, tags: ["Demo"] }),
      item({ title: "[DEMO T07] Archiving a customer file" }),
      item({ title: "Wartung Pumpe" }),
    ];
    expect(filterImportItems(items, { titleContains: [DEMO_TITEL] }).matched).toBe(1);
    expect(
      filterImportItems(items, { titleContains: [DEMO_TITEL.toLowerCase()] }).selected.map(
        (i) => i.title,
      ),
    ).toEqual([DEMO_TITEL]);
    // Ein Teilstück des Titels reicht (Substring) — beide DEMO-Seiten tragen es.
    expect(filterImportItems(items, { titleContains: ["customer file"] }).matched).toBe(2);
  });

  it("ABGRENZUNG zu keywords: Text NUR im Statement matcht NICHT", () => {
    const items = [
      item({ title: "Wartung Pumpe", statement: "Hier geht es um Restoring a customer file." }),
    ];
    // keywords (Titel + Statement) findet es …
    expect(filterImportItems(items, { keywords: ["Restoring a customer file"] }).matched).toBe(1);
    // … titleContains (nur Titel) NICHT.
    expect(filterImportItems(items, { titleContains: ["Restoring a customer file"] }).matched).toBe(
      0,
    );
  });

  it("kanonisiert wie der übrige Vergleich: ein Entity-Altbestandstitel matcht seinen Klartext", () => {
    // Ohne textCodec-Marker gilt der Titel als Altbestand und wird kanonisiert (canonicalImportText,
    // dieselbe geteilte Funktion wie bei keywords/Themen) — „K&uuml;che" ist damit „Küche".
    const { textCodec: _ohneMarker, ...alt } = item({ title: "K&uuml;che sanieren" });
    expect(filterImportItems([alt], { titleContains: ["Küche"] }).matched).toBe(1);
  });

  it("UND-Semantik: titleContains grenzt zusätzlich ein, es fügt nie etwas hinzu", () => {
    const items = [
      item({ title: DEMO_TITEL, tags: ["Demo"] }),
      item({ title: "Wartung Pumpe", tags: ["Wartung"] }),
    ];
    // Thema Wartung UND Titel „customer file" → nichts (wäre es ODER, kämen 2 heraus).
    expect(
      filterImportItems(items, { themes: ["Wartung"], titleContains: ["customer file"] }).matched,
    ).toBe(0);
    // Passendes Thema + passender Titel → genau die eine Seite.
    expect(
      filterImportItems(items, { themes: ["Demo"], titleContains: ["customer file"] }).matched,
    ).toBe(1);
    // Mehrere Titel-Einträge wirken untereinander als „mindestens einer" (wie keywords).
    expect(filterImportItems(items, { titleContains: ["customer file", "Pumpe"] }).matched).toBe(2);
  });

  it("sanitizeCriteria nimmt Textlisten an und verwirft Unsinn, ohne zu werfen", () => {
    expect(sanitizeCriteria({ titleContains: [" Restoring ", "", 42] })).toEqual({
      titleContains: ["Restoring"],
    });
    // Prüflücke (c) des Auftrags: ein Client-Unsinn endet in einem FEHLENDEN Feld, nicht in 500.
    expect(sanitizeCriteria({ titleContains: 42 })).toEqual({});
    expect(sanitizeCriteria({ titleContains: [] })).toEqual({});
    // Ein leeres/fehlendes Kriterium filtert nichts weg (Bestandsverhalten unverändert).
    expect(filterImportItems([item({ title: DEMO_TITEL })], {}).matched).toBe(1);
  });
});
