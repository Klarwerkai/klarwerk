import { describe, expect, it } from "vitest";
import type { Integritaetsbefund } from "../../services/app/src/datenintegritaet";
import { berichtZeilen, hatBefund } from "../../tools/datenintegritaet";

// R-0846 / R-1437: der Betreiberweg `tools/datenintegritaet.ts`. Dieser Import holt das Werkzeug
// zugleich in den Typprüflauf (`tools` steht nicht in tsconfig.json; es zählt, was Tests importieren).
// Die Datenbankseite belegt `datenintegritaet-pg.integration.test.ts`.

const SAUBER: Integritaetsbefund = {
  fremdschluessel: [
    { name: "ko_versions_ko_fk", zustand: "gueltig" },
    { name: "ko_evidence_ko_fk", zustand: "gueltig" },
  ],
  fassungenOhneObjekt: 0,
  belegeOhneObjekt: 0,
  luecken: { geschlossenOhneBezug: 0, bezugOhneObjekt: [] },
  pruefspur: { endgeloeschtBelegt: 2, ohneLoeschbeleg: [] },
  waisen: [],
};

describe("tools/datenintegritaet · Bericht und Exit-Entscheidung", () => {
  it("W1 · ein sauberer Bestand hat keinen Befund — belegte Endlöschungen sind Auskunft, kein Fehler", () => {
    expect(hatBefund(SAUBER)).toBe(false);
  });

  it("W1b · geschlossene Lücken ohne Objektbezug sind ein Befund — einzeln wie mehrfach (Nacharbeit 4)", () => {
    for (const anzahl of [1, 3]) {
      const befund = {
        ...SAUBER,
        luecken: { geschlossenOhneBezug: anzahl, bezugOhneObjekt: [] },
      };
      expect(hatBefund(befund), `${anzahl} ohne Bezug`).toBe(true);
      // Der Befund bleibt im Bericht sichtbar.
      expect(berichtZeilen(befund)).toContain(`Geschlossene Lücken ohne Objektbezug: ${anzahl}`);
    }
  });

  it("W2 · ein ungeprüfter Schlüssel, eine Waise oder ein Widerspruch in der Prüfspur ist ein Befund", () => {
    expect(
      hatBefund({
        ...SAUBER,
        fremdschluessel: [{ name: "ko_versions_ko_fk", zustand: "ungeprueft" }],
      }),
    ).toBe(true);
    expect(
      hatBefund({ ...SAUBER, waisen: [{ id: "o1", zweck: "attachment", transient: false }] }),
    ).toBe(true);
    expect(
      hatBefund({
        ...SAUBER,
        pruefspur: { endgeloeschtBelegt: 0, ohneLoeschbeleg: [{ ziel: "k1", eintraege: 2 }] },
      }),
    ).toBe(true);
  });

  it("W3 · der Bericht nennt Kennungen und Zahlen, keine Inhalte", () => {
    const zeilen = berichtZeilen({
      ...SAUBER,
      luecken: { geschlossenOhneBezug: 1, bezugOhneObjekt: [{ gapId: "g1", koId: "k9" }] },
      waisen: [{ id: "o1", zweck: "media", transient: true }],
    });
    expect(zeilen).toContain("Fremdschlüssel ko_versions_ko_fk: gueltig");
    expect(zeilen).toContain("Lücke g1: Bezug k9 ohne Objekt");
    expect(zeilen).toContain("Waise o1 (media, transient)");
  });
});
