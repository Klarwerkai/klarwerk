// ================================================================================================
// WISSENS-VERMÄCHTNIS-BUCH · DER BAUSTEIN — `services/output/src/vermaechtnis.ts`, ohne App.
// ================================================================================================
//
// Rein und synthetisch: erfundene Wissensobjekte, eine stellbare Uhr, Sichtbarkeit und Namen als
// Funktionen. Gemessen wird, was der Draht-Test (`vermaechtnis-api.test.ts`) an der echten App
// nicht gezielt herstellen kann: die Reihenfolge im Kapitel, einen nicht einsehbaren Beitrag, ein
// Thema ohne Kategorie und den Dateinamen mit Umlauten.
//
// Ordnung zu den Originalkriterien (AUFTRAG-B1.json):
//   K1 · R-1642 — alle Beiträge der Person, digital als Datei (`dateiname`, `markdown`).
//   K2 · R-2175 — das Buch aus dem Wissen EINER Person: Kapitel je Thema, Zeitleiste, Würdigung.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../services/knowledge-object";
import {
  VERMAECHTNIS_OHNE_THEMA,
  erstelleVermaechtnisBuch,
  istBeitragVon,
} from "../../services/output";

const JETZT = Date.parse("2026-10-09T08:00:00.000Z");

function ko(teil: Partial<KnowledgeObject> & { id: string; title: string }): KnowledgeObject {
  return {
    statement: `${teil.title} — so wird es gemacht.`,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Allgemein",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "u-jens",
    author: "u-jens",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...teil,
  } as KnowledgeObject;
}

const NAMEN: Record<string, string> = { "u-jens": "Jens Jäger", "u-lea": "Lea Lindner" };
const name = (id: string): string | null => NAMEN[id] ?? null;

describe("K1/K2 · erstelleVermaechtnisBuch", () => {
  it("zählt nur die Beiträge der Person — ursprünglich ODER heute Autorin/Autor", () => {
    const eigen = ko({ id: "a", title: "A" });
    const weitergegeben = ko({ id: "b", title: "B", author: "u-lea" });
    const uebernommen = ko({ id: "c", title: "C", originalAuthor: "u-lea" });
    const fremd = ko({ id: "d", title: "D", originalAuthor: "u-lea", author: "u-lea" });
    expect(istBeitragVon(eigen, "u-jens")).toBe(true);
    expect(istBeitragVon(weitergegeben, "u-jens")).toBe(true);
    expect(istBeitragVon(uebernommen, "u-jens")).toBe(true);
    expect(istBeitragVon(fremd, "u-jens")).toBe(false);
  });

  it("Kapitel je Thema (alphabetisch), darin in der Reihenfolge des Festhaltens; Zeitleiste je Jahr", () => {
    const buch = erstelleVermaechtnisBuch({
      person: { id: "u-jens", name: "Jens Jäger" },
      bestand: [
        ko({ id: "w2", title: "Spät gewartet", category: "Wartung", createdAt: "2025-06-01" }),
        ko({ id: "w1", title: "Früh gewartet", category: "Wartung", createdAt: "2019-03-01" }),
        ko({ id: "q1", title: "Qualität sichern", category: "Qualität", createdAt: "2021-01-01" }),
        ko({ id: "x1", title: "Ohne Thema", category: "  ", createdAt: "2025-07-01" }),
        ko({ id: "f1", title: "Fremd", originalAuthor: "u-lea", author: "u-lea" }),
      ],
      darfSehen: () => true,
      name,
      jetzt: JETZT,
    });
    expect(buch.aufgenommen).toBe(4);
    expect(buch.themen).toEqual([
      { thema: VERMAECHTNIS_OHNE_THEMA, anzahl: 1 },
      { thema: "Qualität", anzahl: 1 },
      { thema: "Wartung", anzahl: 2 },
    ]);
    expect(buch.zeitraum).toEqual({ von: "2019-03-01", bis: "2025-07-01" });
    const md = buch.markdown;
    expect(md.indexOf("### Früh gewartet")).toBeLessThan(md.indexOf("### Spät gewartet"));
    expect(md).toContain("## Kapitel 3: Wartung");
    expect(md).toContain("- **2019** — 1: Früh gewartet");
    expect(md).toContain("- **2025** — 2: Spät gewartet; Ohne Thema");
    expect(md).not.toContain("Fremd");
    expect(md).toContain("_Festgehalten am 2019-03-01 · Fassung v1 · Jens Jäger_");
    expect(md.startsWith("# Wissens-Vermächtnis von Jens Jäger")).toBe(true);
  });

  it("lässt Papierkorb, nicht Einsehbares, Vertrauliches und Ungeprüftes aus — je genau einmal gezählt", () => {
    const buch = erstelleVermaechtnisBuch({
      person: { id: "u-jens", name: "Jens Jäger" },
      bestand: [
        ko({ id: "ok", title: "Aufgenommen" }),
        // Papierkorb gewinnt vor allen anderen Gründen.
        ko({ id: "p", title: "Im Papierkorb", deletedAt: "2026-02-01", status: "offen" }),
        ko({ id: "s", title: "Geschlossener Space", spaceId: "zu" }),
        ko({ id: "v", title: "Vertraulich", confidentiality: "vertraulich" }),
        ko({ id: "o", title: "Offen", status: "offen" }),
      ],
      darfSehen: (k) => k.spaceId !== "zu",
      name,
      jetzt: JETZT,
    });
    expect(buch.aufgenommen).toBe(1);
    expect(buch.ausgelassen).toEqual({
      papierkorb: 1,
      nichtEinsehbar: 1,
      vertraulich: 1,
      nichtValidiert: 1,
    });
    for (const titel of ["Im Papierkorb", "Geschlossener Space", "Vertraulich", "Offen"]) {
      expect(buch.markdown, titel).not.toContain(`### ${titel}`);
      expect(buch.markdown, titel).not.toContain(`**${titel}**`);
    }
    expect(buch.markdown).toContain("- 1 Beiträge: für die erzeugende Person nicht einsehbar");
  });

  it("Datei ohne Sonderzeichen; ein gelöschtes Konto steht ehrlich als Kennung", () => {
    const mitName = erstelleVermaechtnisBuch({
      person: { id: "u-jens", name: "Jens Jäger" },
      bestand: [],
      darfSehen: () => true,
      name,
      jetzt: JETZT,
    });
    expect(mitName.dateiname).toBe("klarwerk-vermaechtnis-jens-jager-2026-10-09.md");
    expect(mitName.zeitraum).toBeNull();
    expect(mitName.markdown).toContain("## Noch keine aufgenommenen Beiträge");
    expect(mitName.markdown).not.toContain("## Herkunft & Nachweis");

    const geloescht = erstelleVermaechtnisBuch({
      person: { id: "u-weg", name: null },
      bestand: [ko({ id: "a", title: "Alt", originalAuthor: "u-weg", author: "u-lea" })],
      darfSehen: () => true,
      name,
      jetzt: JETZT,
    });
    expect(geloescht.titel).toBe("Wissens-Vermächtnis von Konto u-weg");
    expect(geloescht.markdown).toContain("Konto u-weg (heute bei Lea Lindner)");
  });
});
