import { describe, expect, it } from "vitest";
import { pruefeKontextmarke, stelleKontextmarkeAus } from "../../services/app/src/office-kontext";
import { type Datenpunkt, inFassung } from "../../services/app/src/praesentation-daten";

function korrigierterPunkt(vorher: Record<string, unknown>): Datenpunkt {
  return {
    id: "punkt-1",
    heimatKoId: "quelle-1",
    stand: 2,
    fassung: 2,
    erfasstVon: "test",
    erfasstAm: "2026-01-02",
    art: "aussage",
    erfassung: "manuell",
    fundstelle: { art: "eingabe" },
    wert: "heute",
    zeitraum: "2026",
    bindungen: [],
    pruefungen: [],
    korrekturen: [
      {
        fassung: 2,
        felder: Object.keys(vorher),
        vorher,
        grund: "Test",
        von: "test",
        am: "2026-01-03",
      },
    ],
  };
}

describe("Laufzeitgrenzen gespeicherter Nachweise", () => {
  it("stellt alten Inhalt samt entfernter Angabe wieder her und bewahrt die Identität", () => {
    const punkt = korrigierterPunkt({
      wert: "damals",
      zeitraum: null,
      id: "andere-kennung",
      heimatKoId: "fremde-quelle",
    });
    const alt = inFassung(punkt, 1);
    expect(alt).toMatchObject({
      wert: "damals",
      id: punkt.id,
      heimatKoId: punkt.heimatKoId,
      fassung: 1,
    });
    expect(alt).not.toHaveProperty("zeitraum");
    expect(punkt.zeitraum).toBe("2026");
  });

  it.each([
    { wert: null },
    { quelle: { koId: "quelle-2" } },
    { rechenweg: { art: "summe", eingaben: [] } },
    { fundstelle: { art: "tabellenzelle", zitat: "kein Zellbezug" } },
    { annahmen: [1] },
  ])("eine unvollständige historische Angabe ergibt keine belegte Fassung", (vorher) => {
    expect(inFassung(korrigierterPunkt(vorher), 1)).toBeUndefined();
  });

  it("prüft die Form einer gültig signierten Kontextmarke", () => {
    const key = Buffer.alloc(32, 7);
    const bezug = {
      sid: "s",
      act: "konto",
      inst: "i",
      doc: "d",
      host: "word" as const,
      seq: 1,
      sum: "a".repeat(64),
    };
    const zeit = Date.UTC(2026, 0, 1);
    const gut = stelleKontextmarkeAus(bezug, key, zeit);
    expect(pruefeKontextmarke(gut.marke, key, zeit).gueltig).toBe(true);
    for (const delta of [{ sum: "unlesbar" }, { seq: 0 }]) {
      const alt = stelleKontextmarkeAus({ ...bezug, ...delta }, key, zeit);
      expect(pruefeKontextmarke(alt.marke, key, zeit)).toEqual({
        gueltig: false,
        grund: "marke_ungueltig",
      });
    }
  });
});
