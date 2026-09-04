// ================================================================================================
// JOB 3061 · H2 — DIE MARKIERUNG MARKIERT NUR, WAS WÖRTLICH DASTEHT.
// ================================================================================================
//
// Pedi 04.09. 06:50: „Sie vergleichen Duplikat und in Konflikte sind so irreführend und so
// unübersichtlich." Die Mockups beantworten das mit einer Farbfläche IM Satz. Genau dort liegt die
// Versuchung: eine Markierung, die ungefähr passt, sieht gut aus und behauptet etwas, das niemand
// gemessen hat. Diese Datei hält die Gegenregel fest — findet sich die Marke nicht WÖRTLICH,
// bleibt der Text unmarkiert.
//
// DOM-frei und ohne Browser: die zwei Funktionen sind rein. Ob die Farbe am Ende wirklich auf dem
// Schirm liegt, misst `tests/design/zielbild-h2-pruefen.test.ts` in Chromium.
import { describe, expect, it } from "vitest";
import {
  hatMarkierung,
  markiereRest,
  markiereTeile,
} from "../../apps/web/src/components/pruefen/markierung";

const text =
  "Vollverschweißte Hohlprofile sind zulässig, wenn die Dichtheit jährlich geprüft wird.";

describe("JOB 3061 · M1 · markiereTeile: der Streitwert wird gefunden — oder gar nichts", () => {
  it("markiert die wörtlich gefundene Stelle und lässt den Rest ruhig", () => {
    const teile = markiereTeile(text, ["zulässig, wenn die Dichtheit jährlich geprüft wird."]);
    expect(teile).toHaveLength(2);
    expect(teile[0]).toEqual({
      text: "Vollverschweißte Hohlprofile sind ",
      markiert: false,
    });
    expect(teile[1]?.markiert).toBe(true);
    expect(hatMarkierung(teile)).toBe(true);
    // Die Zusammensetzung ergibt WIEDER den Originaltext — nichts geht verloren, nichts kommt dazu.
    expect(teile.map((s) => s.text).join("")).toBe(text);
  });

  it("findet die Marke NICHT wörtlich → ein einziges unmarkiertes Stück, kein Raten", () => {
    // Das ist der Regelfall bei einem sinngemäss zusammenfassenden Modellfund.
    const teile = markiereTeile(text, ["Hohlprofile sind unzulässig"]);
    expect(teile).toEqual([{ text, markiert: false }]);
    expect(hatMarkierung(teile)).toBe(false);
  });

  it("leere und nur aus Leerzeichen bestehende Marken werden übersprungen", () => {
    expect(hatMarkierung(markiereTeile(text, ["", "   "]))).toBe(false);
  });

  it("mehrere Vorkommen derselben Marke werden alle markiert", () => {
    const teile = markiereTeile("A und B und C", ["und"]);
    expect(teile.filter((s) => s.markiert).map((s) => s.text)).toEqual(["und", "und"]);
    expect(teile.map((s) => s.text).join("")).toBe("A und B und C");
  });

  it("überlappende Marken werden zu EINER Markierung zusammengefasst", () => {
    const teile = markiereTeile("abcdef", ["abcd", "cdef"]);
    expect(teile).toEqual([{ text: "abcdef", markiert: true }]);
  });

  it("leerer Text ergibt keine Stücke", () => {
    expect(markiereTeile("", ["x"])).toEqual([]);
  });
});

describe("JOB 3061 · M2 · markiereRest: abweichend ist, was NICHT gemeinsam ist", () => {
  it("markiert den Rest um die gemeinsamen Zitate herum", () => {
    const gemeinsam = ["Ventil vor der Wartung entlasten und den Druck prüfen."];
    const teile = markiereRest(
      "Ventil vor der Wartung entlasten und den Druck prüfen. Schutzbrille tragen.",
      gemeinsam,
    );
    expect(teile.filter((s) => s.markiert).map((s) => s.text)).toEqual([" Schutzbrille tragen."]);
    expect(teile.filter((s) => !s.markiert).map((s) => s.text)).toEqual(gemeinsam);
  });

  it("ohne wörtlich gefundene Gemeinsamkeit bleibt der Text UNMARKIERT — nicht „alles abweichend“", () => {
    // Die Falle: „nichts gemeinsam gefunden" heisst nicht „alles ist abweichend". Das wäre eine
    // Aussage über einen Fund, den es gar nicht gibt.
    const teile = markiereRest(text, ["steht so nicht im Text"]);
    expect(teile).toEqual([{ text, markiert: false }]);
    expect(hatMarkierung(teile)).toBe(false);
  });

  it("die Zusammensetzung ergibt wieder den Originaltext", () => {
    const t = "eins zwei drei";
    expect(
      markiereRest(t, ["zwei"])
        .map((s) => s.text)
        .join(""),
    ).toBe(t);
  });

  it("deckt ein Zitat den ganzen Text, bleibt nichts markiert", () => {
    expect(markiereRest(text, [text])).toEqual([{ text, markiert: false }]);
  });
});
