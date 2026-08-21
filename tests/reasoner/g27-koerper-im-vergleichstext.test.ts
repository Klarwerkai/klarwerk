// ================================================================================================
// PRO4 · JOB 1565 · D1 · G27 — DER DOKUMENTKÖRPER IM VERGLEICHSTEXT DES REASONERS
// ================================================================================================
//
// DER BEFUND, wie OFFEN.md Z.160 ihn führt: der volle Dokumentkörper ist „gespeichert, angezeigt,
// exportierbar — und für die Suche nicht vorhanden".
//
// NACHGEMESSEN AM HEUTIGEN STAND, und die Lage ist präziser als der Satz:
//
//   · Der SUCHRAUM ist bereits repariert. `search-projection.ts:637` persistiert den sichtbaren
//     Klartext als `bodyText` über EINEN kanonischen Scanner. Ein Objekt, dessen Zielwort nur weit
//     hinten im Fließtext steht, WIRD dadurch Ask-Kandidat — das hält
//     `tests/ask/g27-klara-volltext.test.ts` bereits fest.
//   · Das RELEVANZMASS war die verbliebene Hälfte. `refMatchText` baute Titel + Aussage +
//     Bild-Fußnoten; der Körper kam nicht vor. Ein Treffer, der AUSSCHLIESSLICH im Dokumenttext
//     steht, überlebte deshalb den Kandidatenweg und fiel am Relevanztor — die Antwort blieb eine
//     Wissenslücke, obwohl das Wissen im Haus lag.
//
// DIESE DATEI IST DIE KALIBRIERUNG dieser zweiten Hälfte: ein später Absatz, den der Vergleichstext
// vorher nicht sah und jetzt sieht — und die Gegenprobe, dass ohne das Feld Zeichen für Zeichen der
// alte Text herauskommt.
//
// KEIN MODELLAUFRUF, KEINE EMBEDDINGS, KEIN NETZ: geprüft werden reine Funktionen des Reasoners
// (`refMatchText`, `queryTokens`). `KLARWERK_DUP_PREFILTER` bleibt aus und wird hier nicht berührt.
import { describe, expect, it } from "vitest";
import { queryTokens, refMatchText } from "../../services/reasoner/src/provider";
import type { KnowledgeRef } from "../../services/reasoner/src/types";

/** Ein Wissensobjekt, dessen Kurzfassung das Zielwort NICHT enthält — genau der Fall aus G27. */
const KURZFASSUNG = "Kurzfassung ohne das Zielwort.";
const ZIELWORT = "Drehmomentschluessel";

/** Ein Körper, dessen Zielwort weit hinter jeder Kurzfeldgrenze steht. */
function langerKoerper(zielwort: string): string {
  const fuellung = "Vorbereitung und Ablauf der Montage sind hier ausfuehrlich beschrieben. ";
  return `${fuellung.repeat(30)}Zum Schluss wird der ${zielwort} auf 45 Newtonmeter gestellt.`;
}

const OHNE_KOERPER: KnowledgeRef = {
  id: "ko-1",
  title: "Flanschmontage an der Presse",
  statement: KURZFASSUNG,
  status: "offen",
  trust: 0,
};

const MIT_KOERPER: KnowledgeRef = { ...OHNE_KOERPER, bodyText: langerKoerper(ZIELWORT) };

describe("G27 · die Kalibrierung: der späte Absatz war unsichtbar und ist es nicht mehr", () => {
  it("VORHER — ohne Körper enthält der Vergleichstext das Zielwort nicht", () => {
    // Das ist der Zustand, den G27 beschreibt. Er bleibt für jeden Ref ohne `bodyText` erhalten.
    expect(refMatchText(OHNE_KOERPER)).not.toContain(ZIELWORT);
    expect(queryTokens(refMatchText(OHNE_KOERPER))).not.toContain(ZIELWORT.toLowerCase());
  });

  it("NACHHER — mit Körper steht das Zielwort im Vergleichstext und wird tokenisiert", () => {
    expect(refMatchText(MIT_KOERPER)).toContain(ZIELWORT);
    expect(queryTokens(refMatchText(MIT_KOERPER))).toContain(ZIELWORT.toLowerCase());
  });

  it("das Zielwort steht wirklich SPÄT — nicht zufällig im Anfang des Textes", () => {
    // Ohne diese Probe könnte die Zusicherung von einem kurzen Körper erfüllt werden und die
    // eigentliche Aussage — „auch weit hinten wird gefunden" — bliebe ungeprüft.
    const text = refMatchText(MIT_KOERPER);
    expect(text.indexOf(ZIELWORT)).toBeGreaterThan(1_000);
  });
});

describe("G27 · was sich für den Altbestand NICHT ändert", () => {
  it("ohne das Feld ist der Vergleichstext Zeichen für Zeichen der alte", () => {
    expect(refMatchText(OHNE_KOERPER)).toBe(`${OHNE_KOERPER.title} ${OHNE_KOERPER.statement}`);
  });

  it("ein leerer oder nur aus Leerzeichen bestehender Körper ändert nichts", () => {
    const alt = refMatchText(OHNE_KOERPER);
    expect(refMatchText({ ...OHNE_KOERPER, bodyText: "" })).toBe(alt);
    expect(refMatchText({ ...OHNE_KOERPER, bodyText: "   \n\t " })).toBe(alt);
  });

  it("Bild-Fußnoten bleiben unverändert dabei — und stehen vor dem Körper", () => {
    // Die Reihenfolge ist eine Zusage an bestehende Tests, die den Text als Ganzes vergleichen.
    const ref: KnowledgeRef = {
      ...MIT_KOERPER,
      captionTexts: ["Abbildung zwei zeigt den Flansch"],
    };
    const text = refMatchText(ref);
    expect(text).toContain("Abbildung zwei zeigt den Flansch");
    expect(text.indexOf("Abbildung zwei")).toBeLessThan(text.indexOf(ZIELWORT));
  });

  it("der Körper wird weder gekürzt noch umgeformt — der Reasoner erfindet keine Grenze", () => {
    // Die 500 aus `wordAddin.ts:925` ist die Wurzel dieses Befunds. Eine neue Zahl an dieser Stelle
    // wäre derselbe Fehler mit einer größeren Ziffer; die Menge entscheidet der Aufrufer.
    const koerper = langerKoerper(ZIELWORT);
    expect(refMatchText(MIT_KOERPER).endsWith(koerper)).toBe(true);
  });
});
