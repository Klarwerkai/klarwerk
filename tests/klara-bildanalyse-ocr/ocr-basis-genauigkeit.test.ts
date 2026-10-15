// ================================================================================================
// Basisreparatur 58→53 · DIE ERKENNUNG LIEST ÜBERGROSSE SCHRIFT VERKLEINERT NACH
// ================================================================================================
//
// Auftrag produkt:20261015:ocr-basis-erkannter-genauigkeitsfehler, OBG-K01/K03. Belegt wird der
// Mechanismus im gemeinsamen Engineweg (`recognizeImage`, `lib/ocr.ts`) und seine Kennzeichnung in
// der Automatik (`lib/bildAutomatik.ts`) — mit injizierter Engine, ohne Browser:
//   A1  ohne Skalierer und bei normal großer Schrift: genau eine Lesung, Ergebnis wie bisher
//   A2  übergroße Schrift: dieselbe Engine liest das verkleinerte Bild; deren Lesung ist der Befund,
//       Wortrahmen im Originalmaßstab
//   A3  weichen die Lesungen ab, ist das Wort markiert — nie ungekennzeichnet; gleiche Wörter bleiben
//   A4  scheitert die Nachlesung oder findet sie nichts bzw. weniger, bleibt die erste Lesung —
//       nichts geht verloren
//   A5  die Automatik kennzeichnet abweichende Wörter als unsicher, auch in Tabellenzellen
// Die Engine-Attrappe liefert feste Lesungen je Eingabe — sie ersetzt keinen Inhalt. Ob die echte
// Engine die unveränderte OCR-04-Vorlage richtig liest, belegt allein die Browserprobe.
import { describe, expect, it, vi } from "vitest";
import { kennzeichneUnsicheres, tabelleAusWoertern } from "../../apps/web/src/lib/bildAutomatik";
import {
  OCR_GROSS_AB,
  OCR_KLEINSTER_FAKTOR,
  OCR_ZIEL_WORTHOEHE,
  type OcrWort,
  gleicheLesungenAb,
  recognizeImage,
  verkleinerungsFaktor,
} from "../../apps/web/src/lib/ocr";

const wort = (text: string, confidence: number, y0: number, hoehe: number, x0 = 0): OcrWort => ({
  text,
  confidence,
  bbox: { x0, y0, x1: x0 + 100, y1: y0 + hoehe },
});

interface Lesung {
  text: string;
  words: OcrWort[];
}

/** Eine Engine-Attrappe: je Eingabe eine feste Lesung; unbekannte Eingaben scheitern. */
function engine(lesungen: Record<string, Lesung>) {
  return {
    recognize: vi.fn(async (input: unknown) => {
      const lesung = lesungen[String(input)];
      if (!lesung) {
        throw new Error(`unbekannte Eingabe ${String(input)}`);
      }
      return { data: lesung };
    }),
  };
}

const GROSS = 70;
const ORIGINAL: Lesung = {
  text: "Druck 12\nPumpe 93",
  words: [
    wort("Druck", 92, 80, GROSS),
    wort("12", 91, 80, GROSS, 300),
    wort("Pumpe", 93, 220, GROSS),
    wort("93", 94, 220, GROSS, 300),
  ],
};
const FAKTOR = OCR_ZIEL_WORTHOEHE / GROSS;
const k = (v: number): number => v * FAKTOR;
const VERKLEINERT: Lesung = {
  text: "Druck 72\nPumpe 93",
  words: [
    wort("Druck", 95, k(80), k(GROSS)),
    wort("72", 90, k(80), k(GROSS), k(300)),
    wort("Pumpe", 96, k(220), k(GROSS)),
    wort("93", 95, k(220), k(GROSS), k(300)),
  ],
};
const skaliereZu = (ziel: string) => vi.fn(async (_input: unknown, _faktor: number) => ziel);

describe("Basisreparatur 58→53 · Nachlesung übergroßer Schrift im selben Engineweg", () => {
  it("A1 · ohne Skalierer oder bei normal großer Schrift: genau eine Lesung, wie bisher", async () => {
    const e = engine({ bild: ORIGINAL });
    const ohne = await recognizeImage("bild", e);
    expect(e.recognize).toHaveBeenCalledTimes(1);
    expect(ohne.text).toBe(ORIGINAL.text);
    expect(ohne.woerter?.some((w) => w.abweichend)).toBe(false);

    const normal: Lesung = {
      text: "Auftrag 4711",
      words: [wort("Auftrag", 90, 0, 40), wort("4711", 90, 0, 36)],
    };
    const e2 = engine({ bild: normal });
    const skaliere = skaliereZu("klein");
    const res = await recognizeImage("bild", e2, skaliere);
    expect(skaliere).not.toHaveBeenCalled();
    expect(e2.recognize).toHaveBeenCalledTimes(1);
    expect(res.text).toBe("Auftrag 4711");
    expect(verkleinerungsFaktor(normal.words)).toBeNull();
    expect(verkleinerungsFaktor([wort("x", 90, 0, OCR_GROSS_AB)])).toBeNull();
    expect(verkleinerungsFaktor([])).toBeNull();
  });

  it("A2 · übergroße Schrift: dieselbe Engine liest verkleinert, Rahmen im Originalmaßstab", async () => {
    const e = engine({ bild: ORIGINAL, klein: VERKLEINERT });
    const skaliere = skaliereZu("klein");
    const res = await recognizeImage("bild", e, skaliere);
    expect(skaliere).toHaveBeenCalledWith("bild", FAKTOR);
    expect(e.recognize).toHaveBeenCalledTimes(2);
    expect(e.recognize).toHaveBeenNthCalledWith(2, "klein");
    expect(res.status).toBe("success");
    expect(res.text).toBe(VERKLEINERT.text);
    const rahmen = res.woerter?.map((w) => w.bbox);
    expect(rahmen?.[1]?.x0).toBeCloseTo(300);
    expect(rahmen?.[2]?.y0).toBeCloseTo(220);
    expect(rahmen?.[2]?.y1).toBeCloseTo(220 + GROSS);
    // Der Faktor hat eine Untergrenze — riesige Schrift wird nicht bis zur Unkenntlichkeit klein.
    expect(verkleinerungsFaktor([wort("x", 90, 0, 10_000)])).toBe(OCR_KLEINSTER_FAKTOR);
    // Gemessen wird am unteren Viertel: kleinere Schrift im selben Bild bestimmt den Faktor mit.
    const gemischt = [wort("a", 90, 0, 50), wort("b", 90, 0, 60), wort("c", 90, 0, 200)];
    expect(verkleinerungsFaktor(gemischt)).toBeCloseTo(OCR_ZIEL_WORTHOEHE / 50);
  });

  it("A3 · abweichende Wörter sind markiert, übereinstimmende nicht", async () => {
    const e = engine({ bild: ORIGINAL, klein: VERKLEINERT });
    const res = await recognizeImage("bild", e, skaliereZu("klein"));
    expect(res.woerter?.map((w) => [w.text, w.abweichend === true])).toEqual([
      ["Druck", false],
      ["72", true],
      ["Pumpe", false],
      ["93", false],
    ]);
    // Abgleich über die längste gemeinsame Wortfolge: ein zusätzliches oder fehlendes Wort
    // verschiebt die übrigen nicht.
    const mehr = gleicheLesungenAb(
      [wort("A", 90, 0, 1), wort("neu", 90, 0, 1), wort("B", 90, 0, 1)],
      [wort("A", 90, 0, 1), wort("B", 90, 0, 1)],
    );
    expect(mehr.map((w) => w.abweichend === true)).toEqual([false, true, false]);
    // Satzzeichen ohne Buchstaben/Ziffern werden nicht markiert.
    expect(gleicheLesungenAb([wort("—", 90, 0, 1)], [])[0]?.abweichend).toBeUndefined();
  });

  it("A4 · Nachlesung gescheitert, leer oder mit weniger Wörtern: die erste Lesung bleibt", async () => {
    const nichtSkalierbar = await recognizeImage(
      "bild",
      engine({ bild: ORIGINAL }),
      vi.fn(async () => null),
    );
    expect(nichtSkalierbar.text).toBe(ORIGINAL.text);
    const skalierFehler = await recognizeImage(
      "bild",
      engine({ bild: ORIGINAL }),
      vi.fn(async () => {
        throw new Error("decode");
      }),
    );
    expect(skalierFehler.status).toBe("success");
    expect(skalierFehler.text).toBe(ORIGINAL.text);
    const engineFehler = await recognizeImage(
      "bild",
      engine({ bild: ORIGINAL }),
      skaliereZu("fehlt"),
    );
    expect(engineFehler.status).toBe("success");
    expect(engineFehler.text).toBe(ORIGINAL.text);
    const leer = await recognizeImage(
      "bild",
      engine({ bild: ORIGINAL, klein: { text: "  ", words: [] } }),
      skaliereZu("klein"),
    );
    expect(leer.text).toBe(ORIGINAL.text);

    // Weniger Wörter: die erste Lesung bleibt, die in der Nachlesung fehlenden Stellen sind markiert.
    const weniger = await recognizeImage(
      "bild",
      engine({
        bild: ORIGINAL,
        klein: { text: "Druck 12", words: [wort("Druck", 95, 0, 1), wort("12", 90, 0, 1)] },
      }),
      skaliereZu("klein"),
    );
    expect(weniger.text).toBe(ORIGINAL.text);
    expect(weniger.woerter?.map((w) => [w.text, w.abweichend === true])).toEqual([
      ["Druck", false],
      ["12", false],
      ["Pumpe", true],
      ["93", true],
    ]);
  });

  it("A5 · die Automatik kennzeichnet abweichende Wörter als unsicher — auch in Tabellen", async () => {
    const e = engine({ bild: ORIGINAL, klein: VERKLEINERT });
    const res = await recognizeImage("bild", e, skaliereZu("klein"));
    const gekennzeichnet = kennzeichneUnsicheres(res.text, res.woerter);
    expect(gekennzeichnet.textGekennzeichnet).toBe("Druck [?72]\nPumpe 93");
    expect(gekennzeichnet.unsicher).toEqual([{ wort: "72", sicherheit: 90, unleserlich: false }]);
    expect(tabelleAusWoertern(res.woerter)).toEqual([
      ["Druck", "[?72]"],
      ["Pumpe", "93"],
    ]);
  });
});
