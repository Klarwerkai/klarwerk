// ================================================================================================
// AUFNAHME 20260922 (R-1099) · DER ABGLEICH — WANN IST ES EIN WARNZEICHEN, WANN NICHT.
// ================================================================================================
//
// R-1099: „Weichen sie voneinander ab, ist das ein Warnzeichen, dem jemand nachgehen muss."
// Der Abgleich (`services/reasoner/src/zweitmeinung.ts`) urteilt an drei Merkmalen, und je Merkmal
// steht hier der Fall, der anschlägt, und der, der NICHT anschlagen darf — eine Warnung aus einer
// unbekannten Zuordnung oder einer fehlenden Zahl wäre erfunden.
import { describe, expect, it } from "vitest";
import { genannteZahlen, vergleicheAntworten } from "../../services/reasoner";

const antwort = (answer: string | null, citedSources: string[] = ["k1"]) => ({
  answered: answer !== null,
  answer,
  citedSources,
});

const OHNE = antwort(null, []);

describe("R-1099 · vergleicheAntworten", () => {
  it("A1 · nur eine Seite antwortet ⇒ Abweichung „beantwortet“", () => {
    const mit = antwort("Ventil schließen [1].");
    expect(vergleicheAntworten(mit, OHNE)).toEqual(["beantwortet"]);
    expect(vergleicheAntworten(OHNE, mit)).toEqual(["beantwortet"]);
  });

  it("A2 · beide ohne Grundlage ⇒ übereinstimmende Auskunft, kein Warnzeichen", () => {
    expect(vergleicheAntworten(OHNE, OHNE)).toEqual([]);
  });

  it("A3 · keine gemeinsame tragende Quelle ⇒ „quellen“; eine gemeinsame genügt", () => {
    const k1 = antwort("X [1].", ["k1"]);
    const k2 = antwort("X [1].", ["k2"]);
    const beide = antwort("X [1].", ["k1", "k2"]);
    expect(vergleicheAntworten(k1, k2)).toEqual(["quellen"]);
    expect(vergleicheAntworten(beide, k2)).toEqual([]);
  });

  it("A4 · unbekannte Zuordnung (leere Liste) ist KEIN Quellenunterschied", () => {
    const unbekannt = antwort("X [1].", []);
    expect(vergleicheAntworten(unbekannt, antwort("X [1].", ["k2"]))).toEqual([]);
  });

  it("A5 · verschiedene Zahlen ⇒ „zahlen“; dieselben Zahlen in anderem Wortlaut nicht", () => {
    expect(vergleicheAntworten(antwort("Ab 5 bar [1]."), antwort("Ab 7 bar [1]."))).toEqual([
      "zahlen",
    ]);
    const komma = antwort("Ab 1,5 bar schließen [1].");
    const punkt = antwort("Bei 1.5 bar zu [1].");
    expect(vergleicheAntworten(komma, punkt)).toEqual([]);
  });

  it("A6 · nennt nur eine Seite eine Zahl, ist das kein Widerspruch", () => {
    const zahl = antwort("Ab 5 bar [1].");
    const ohneZahl = antwort("Bei Überdruck [1].");
    expect(vergleicheAntworten(zahl, ohneZahl)).toEqual([]);
  });

  it("A7 · Fußnotenmarken zählen nicht als Zahlen", () => {
    expect([...genannteZahlen("Ventil schließen [1][2].")]).toEqual([]);
    expect(vergleicheAntworten(antwort("Schließen [1]."), antwort("Schließen [2]."))).toEqual([]);
  });

  it("A8 · mehrere Merkmale zugleich werden alle genannt", () => {
    const a = antwort("Ab 5 bar [1].", ["k1"]);
    const b = antwort("Ab 7 bar [1].", ["k2"]);
    expect(vergleicheAntworten(a, b)).toEqual(["quellen", "zahlen"]);
  });
});
