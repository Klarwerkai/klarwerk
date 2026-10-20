import { describe, expect, it } from "vitest";
import { erkenneFristen } from "../../services/app/src/klara-fristen-erkennung";

import { AKZEPTANZGRENZEN, SOLLBESTAND } from "./sollbestand";

describe("AW19-K14 · getrennte Messung am synthetischen Sollbestand", () => {
  it("erreicht die vorher festgelegten Grenzen für Erkennung, Nicht-Erkennung, Datum, Objekt und Klärung", () => {
    const messung = {
      richtigPositiv: 0,
      positiv: 0,
      richtigNegativ: 0,
      negativ: 0,
      datumRichtig: 0,
      datumSoll: 0,
      objektRichtig: 0,
      objektSoll: 0,
      klaerungRichtig: 0,
      klaerungSoll: 0,
    };
    const fehler: string[] = [];
    const faelle: { id: string; richtig: boolean }[] = [];
    for (const fall of SOLLBESTAND) {
      const gelesen = erkenneFristen({
        art: "wissensobjekt",
        id: fall.id,
        fassung: "1",
        belegId: fall.id,
        text: fall.text,
        verantwortlich: null,
      });
      const klar = gelesen.filter((b) => b.datum !== null && b.klaerung.length === 0);
      if (fall.klasse === "positiv") {
        messung.positiv += 1;
        if (klar.length === fall.erwartet.length) messung.richtigPositiv += 1;
      }
      if (fall.klasse === "negativ") {
        messung.negativ += 1;
        if (gelesen.length === 0) messung.richtigNegativ += 1;
      }
      if (fall.klasse === "klaerung") {
        messung.klaerungSoll += 1;
        if (klar.length === 0 && gelesen.length > 0 && gelesen.every((b) => b.klaerung.length > 0))
          messung.klaerungRichtig += 1;
      }
      for (const soll of fall.erwartet) {
        if (fall.klasse === "positiv") messung.objektSoll += 1;
        const ist = gelesen.find((b) => b.objekt.kennung === soll.objekt && b.art === soll.art);
        if (ist && fall.klasse === "positiv") messung.objektRichtig += 1;
        if (soll.datum !== null) {
          messung.datumSoll += 1;
          if (ist?.datum?.datum === soll.datum) messung.datumRichtig += 1;
        }
      }
      const ist = gelesen.map((b) => ({
        objekt: b.objekt.kennung,
        art: b.art,
        datum: b.datum?.datum ?? null,
      }));
      if (JSON.stringify(ist) !== JSON.stringify(fall.erwartet)) fehler.push(fall.id);
      faelle.push({ id: fall.id, richtig: JSON.stringify(ist) === JSON.stringify(fall.erwartet) });
    }
    if (process.env.KLARWERK_FRISTEN_BELEG)
      writeFileSync(
        process.env.KLARWERK_FRISTEN_BELEG,
        `${JSON.stringify({ grenzen: AKZEPTANZGRENZEN, messung, faelle, akzeptiert: fehler.length === 0, scope: "19 synthetische deutsche Aussagen, kein allgemeiner Sprach-/Rechts-/Normnachweis" }, null, 2)}\n`,
      );
    expect(fehler, JSON.stringify(messung)).toEqual([]);
    expect(messung.richtigPositiv / messung.positiv).toBeGreaterThanOrEqual(
      AKZEPTANZGRENZEN.richtigeErkennung,
    );
    expect(messung.richtigNegativ / messung.negativ).toBeGreaterThanOrEqual(
      AKZEPTANZGRENZEN.richtigeNichtErkennung,
    );
    expect(messung.datumRichtig / messung.datumSoll).toBeGreaterThanOrEqual(
      AKZEPTANZGRENZEN.datumszuordnung,
    );
    expect(messung.objektRichtig / messung.objektSoll).toBeGreaterThanOrEqual(
      AKZEPTANZGRENZEN.objektzuordnung,
    );
    expect(messung.klaerungRichtig / messung.klaerungSoll).toBeGreaterThanOrEqual(
      AKZEPTANZGRENZEN.konfliktklaerung,
    );
  });
});
import { writeFileSync } from "node:fs";
