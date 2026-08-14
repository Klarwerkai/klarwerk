// JOB 512 (R5): Die Entscheidung „liegt ein Bildverlust vor" hat GENAU EINE Stelle — diese
// Funktion. Sie vergleicht die Zahl der Bilder in der QUELLDATEI (beim Import erhoben, VOR jedem
// Budgetabzug) mit der Zahl der Bilder, die im erzeugten `bodyHtml` tatsächlich ankommen.
//
// Die wichtigste Zusage ist eine NICHT-Aussage: Ohne belastbare Quellzahl lautet das Ergebnis
// `unbekannt`, niemals `verlust`. Aus fehlenden Bildern auf einen Verlust zu schließen wäre eine
// Falschmeldung an JEDEM bildlosen Entwurf — „0 von 0" sähe aus wie ein Verlust.
import { describe, expect, it } from "vitest";
import { bildverlust } from "./bildverlust";

describe("JOB 512 R5 · bildverlust — die Vertragsfälle", () => {
  it("KALIBRIERUNG: die Funktion meldet überhaupt jemals einen Verlust", () => {
    // Ohne diesen Fall wären alle „kein-hinweis"-Zusicherungen trivial erfüllbar, indem die
    // Funktion einfach immer schweigt.
    expect(bildverlust(5, 3).art).toBe("verlust");
  });

  it("Quelle 5, Körper 3 → Verlust von 2", () => {
    expect(bildverlust(5, 3)).toEqual({ art: "verlust", fehlend: 2, quelle: 5, koerper: 3 });
  });

  it("DAS IST R5: Quelle 3, Körper 0 → Verlust von 3", () => {
    // Der Fall, um den es in JOB 512 geht: der Verlust passiert VOR der bodyHtml-Erzeugung
    // (Budget/Format), die Galerie sieht nur noch ein leeres Dokument.
    expect(bildverlust(3, 0)).toEqual({ art: "verlust", fehlend: 3, quelle: 3, koerper: 0 });
  });

  it("Gleichstand: Quelle 5, Körper 5 → kein Hinweis", () => {
    expect(bildverlust(5, 5)).toEqual({ art: "kein-hinweis" });
  });

  it("bildlose Quelle: Quelle 0, Körper 0 → kein Hinweis, nicht Verlust 0", () => {
    expect(bildverlust(0, 0)).toEqual({ art: "kein-hinweis" });
  });

  it("die Zahlen der Meldung stammen aus den Eingaben, nicht aus einer Vorgabe", () => {
    const ergebnis = bildverlust(9, 4);
    expect(ergebnis).toEqual({ art: "verlust", fehlend: 5, quelle: 9, koerper: 4 });
  });
});

describe("JOB 512 R5 · bildverlust — die Negativfälle (fail-closed)", () => {
  it("ohne Quellzahl (null) gibt es KEINE Verlustaussage", () => {
    expect(bildverlust(null, 0)).toEqual({ art: "unbekannt" });
  });

  it("ohne Quellzahl (undefined) gibt es KEINE Verlustaussage", () => {
    expect(bildverlust(undefined, 0)).toEqual({ art: "unbekannt" });
  });

  it("eine unbrauchbare Quellzahl wird wie unbekannt behandelt, nicht wie 0", () => {
    expect(bildverlust(Number.NaN, 2)).toEqual({ art: "unbekannt" });
    expect(bildverlust(-1, 2)).toEqual({ art: "unbekannt" });
    expect(bildverlust(2.5, 2)).toEqual({ art: "unbekannt" });
  });

  it("eine unbrauchbare Körperzahl wird wie unbekannt behandelt", () => {
    expect(bildverlust(5, Number.NaN)).toEqual({ art: "unbekannt" });
    expect(bildverlust(5, -1)).toEqual({ art: "unbekannt" });
    expect(bildverlust(5, "3")).toEqual({ art: "unbekannt" });
  });

  it("mehr Körper- als Quellbilder → kein Hinweis, keine negative Zahl", () => {
    // Kann durch die Folienkonvertierung entstehen; eine Meldung „−2 Bilder fehlen" wäre Unsinn.
    expect(bildverlust(2, 4)).toEqual({ art: "kein-hinweis" });
  });
});
