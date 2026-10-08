// ================================================================================================
// AUFNAHME 20260922 · ANTWORT-QUELLENANZEIGE (R-0310) — DIE AUSDRÜCKLICHE ABSATZ-BELEG-ZUORDNUNG.
// ================================================================================================
//
// `absatzBelege` (services/app/src/absatz-belege.ts) bildet das Feld `absaetze` im Antwortkörper
// von `/api/ask`. Gemessen werden die beiden ausdrücklichen Zuordnungsgründe (Marke, wörtlicher
// Fund in der Aussage einer TRAGENDEN Quelle), das Unbelegte (`quellen: []`) und dass eine nur
// herangezogene Quelle nie trägt.
import { describe, expect, it } from "vitest";
import { absatzBelege } from "../../services/app/src/absatz-belege";

describe("R-0310 · absatzBelege — je Absatz die Quellen, die ihn belegen", () => {
  it("Z1 · deterministischer Weg: die Antwort IST die Aussage der einen tragenden Quelle — jeder Absatz trägt sie (wörtlich)", () => {
    const aussage = "Offene Profile sind zu bevorzugen.\n\nGeschlossene sind zu begründen.";
    expect(
      absatzBelege({
        answered: true,
        answer: aussage,
        sources: ["ka"],
        citedSources: ["ka"],
        steps: [{ sourceId: "ka", snippet: aussage }],
      }),
    ).toEqual([
      { text: "Offene Profile sind zu bevorzugen.", quellen: ["ka"] },
      { text: "Geschlossene sind zu begründen.", quellen: ["ka"] },
    ]);
  });

  it("Z2 · Marken [n] ordnen zu (n = Stelle in sources); unmarkierter, nicht wörtlicher Absatz bleibt unbelegt", () => {
    expect(
      absatzBelege({
        answered: true,
        answer: "Erstens gilt A [1].\n\nZweitens frei erfunden.\n\nDrittens B und A [2, 1].",
        sources: ["ka", "kb", "kc"],
        citedSources: ["ka", "kb"],
        steps: [
          { sourceId: "ka", snippet: "A gilt." },
          { sourceId: "kb", snippet: "B gilt." },
        ],
      }),
    ).toEqual([
      { text: "Erstens gilt A [1].", quellen: ["ka"] },
      { text: "Zweitens frei erfunden.", quellen: [] },
      { text: "Drittens B und A [2, 1].", quellen: ["kb", "ka"] },
    ]);
  });

  it("Z3 · eine nur HERANGEZOGENE Quelle trägt nie — weder über ihre Marke noch über ihren Wortlaut", () => {
    expect(
      absatzBelege({
        answered: true,
        answer: "Spritzzonen sind gesondert zu betrachten. [3]",
        sources: ["ka", "kb", "kc"],
        citedSources: ["ka"],
        steps: [{ sourceId: "kc", snippet: "Spritzzonen sind gesondert zu betrachten." }],
      }),
    ).toEqual([{ text: "Spritzzonen sind gesondert zu betrachten. [3]", quellen: [] }]);
  });

  it("Z4 · ohne beantwortete Frage gibt es kein Feld; Absätze trennen an Leerzeilen", () => {
    expect(
      absatzBelege({ answered: false, answer: null, sources: [], citedSources: [], steps: [] }),
    ).toBeUndefined();
    const aussage = "A\n \nB\n\n\n\nC\nnoch C";
    expect(
      absatzBelege({
        answered: true,
        answer: aussage,
        sources: ["ka"],
        citedSources: ["ka"],
        steps: [{ sourceId: "ka", snippet: aussage }],
      })?.map((a) => a.text),
    ).toEqual(["A", "B", "C\nnoch C"]);
  });
});
