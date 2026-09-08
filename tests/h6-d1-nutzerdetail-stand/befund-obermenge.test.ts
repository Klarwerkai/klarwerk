import { describe, expect, it } from "vitest";
import {
  type Abfragelage,
  type WertBefund,
  wertBefund,
} from "../../apps/web/src/components/einstellungen/zeilenWert";

/** Unveränderter Altvertrag als Differenzprobe (JOB 3136/3139), nur im Test. */
function alt(lage: Abfragelage, wert: string | null, leer: boolean): WertBefund {
  if (!lage.hatDaten) {
    return {
      art: lage.pausiert ? "offline" : lage.fehler ? "fehler" : "laedt",
      wert: null,
      standMs: 0,
      nichtAktualisiert: false,
    };
  }
  const gestoert = lage.fehler || lage.pausiert;
  return {
    art: leer ? "leer" : "wert",
    wert: leer ? null : wert,
    standMs: gestoert || lage.laeuft ? lage.standMs : 0,
    nichtAktualisiert: gestoert,
  };
}

describe("JOB 3180 · Befund ist Obermenge des alten Vertrags", () => {
  it("alle Booleschen Lagen, Leerwerte und Zeitgrenzen: kein alter Warnzustand geht verloren", () => {
    for (const hatDaten of [false, true]) {
      for (const fehler of [false, true]) {
        for (const pausiert of [false, true]) {
          for (const laeuft of [false, true]) {
            for (const leer of [false, true]) {
              for (const standMs of [0, 99, 100, 101]) {
                const lage = { hatDaten, fehler, pausiert, laeuft, standMs };
                const vorher = alt(lage, "Wert", leer);
                // Alle bisherigen Aufrufer ohne Gedächtnis bleiben zeichengleich.
                expect(wertBefund(lage, "Wert", leer)).toEqual(vorher);
                for (const gemerkt of [null, 0, 100]) {
                  const nachher = wertBefund(lage, "Wert", leer, gemerkt);
                  expect(nachher.art).toBe(vorher.art);
                  expect(nachher.wert).toBe(vorher.wert);
                  if (vorher.nichtAktualisiert || !hatDaten) {
                    expect(nachher).toEqual(vorher);
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  it("nur ein strikt neuerer Stand löst die gemerkte Störung, auch bei gleicher Antwort", () => {
    for (const standMs of [99, 100, 101]) {
      const befund = wertBefund(
        { hatDaten: true, fehler: false, pausiert: false, laeuft: false, standMs },
        "derselbe Wert",
        false,
        100,
      );
      expect(befund.nichtAktualisiert).toBe(standMs <= 100);
      expect(befund.standMs).toBe(standMs <= 100 ? standMs : 0);
    }
  });
});
