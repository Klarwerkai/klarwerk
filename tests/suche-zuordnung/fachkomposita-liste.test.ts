// ================================================================================================
// R-0461 / R-1943 (OFFEN.md S5b) — DIE DEKLARIERTE LISTE ECHTER FACHKOMPOSITA, GEMESSEN.
// ================================================================================================
//
// Der Zielzustand: „Statt einer Grammatikregel wird eine begrenzte, ausdrücklich aufgeschriebene und
// getestete Liste echter Fachkomposita gepflegt, damit die Suche ‚Firmenwagen' zur Frage nach der
// ‚Farbe' findet. Die Liste liegt in einer eigenen Quelldatei und ist ohne Programmierarbeit pflegbar."
//
// Zugleich muss R-0442 halten: „Der Widerstand am Ventil ist vorgeschrieben" trägt die Frage „Welcher
// Stand gilt am Ventil?" NICHT. Beides steht hier nebeneinander, in DERSELBEN Satzform — der einzige
// Unterschied ist, ob das Paar in der Liste steht.
import { describe, expect, it } from "vitest";
import { demoTexts } from "../../services/app/src/demo-content";
import type { KnowledgeRef } from "../../services/reasoner";
import { Reasoner, queryTokens, rankCandidates } from "../../services/reasoner";
import { FACHKOMPOSITA } from "../../services/reasoner/src/fachkomposita";
import { fachkompositaIndex } from "../../services/reasoner/src/provider";
// R-1349: der zweite Auswahlweg ist entfernt; `keywordSelect` misst die Menge am Produktweg.
import { keywordSelect } from "../support/auswahlweg";

function ref(
  id: string,
  title: string,
  statement: string,
  status: KnowledgeRef["status"] = "validiert",
  trust = 70,
): KnowledgeRef {
  return { id, title, statement, status, trust };
}

const t = demoTexts("de");
// Wörtlich aus dem Demo-Bestand, Status/Trust wie geseedet (vgl. mega59-komposita.test.ts).
const KO_CAR_BLAU = ref("koCarBlau", t.koCarBlau.title, t.koCarBlau.statement, "validiert", 100);
const KO_CAR_ROT = ref("koCarRot", t.koCarRot.title, t.koCarRot.statement, "offen", 20);
const FRAGE_FARBE = "Welche Farbe müssen Firmenwagen haben?";

describe("R-0461 · die Liste selbst: eigene Quelldatei, jeder Eintrag belegt und wirksam", () => {
  it("jeder Eintrag trägt eine Fundstelle", () => {
    expect(FACHKOMPOSITA.length).toBeGreaterThan(0);
    for (const eintrag of FACHKOMPOSITA) {
      expect(eintrag.quelle.trim().length, eintrag.kompositum).toBeGreaterThan(0);
    }
  });

  it("jeder Eintrag in normaler Schreibweise wird wirksam — kein toter Listeneintrag", () => {
    // Wer eine Zeile ergänzt, die kein echtes Kompositum ihres Grundworts ist (oder in mehrere Wörter
    // zerfällt), sieht es hier: der Index übergeht sie fail-closed, und dieser Fall wird rot.
    const index = fachkompositaIndex();
    for (const eintrag of FACHKOMPOSITA) {
      const [grundwort] = queryTokens(eintrag.grundwort);
      const [kompositum] = queryTokens(eintrag.kompositum);
      expect(index.get(grundwort ?? "")?.has(kompositum ?? ""), eintrag.kompositum).toBe(true);
    }
  });

  it("die Umrechnung ist die des Reasoners: Pflichtfarbe → pflichtfarb, Farbe → farb", () => {
    expect(
      fachkompositaIndex([{ kompositum: "Pflichtfarbe", grundwort: "Farbe", quelle: "T" }]),
    ).toEqual(new Map([["farb", new Set(["pflichtfarb"])]]));
  });

  it("FAIL-CLOSED: Einträge ohne belegbare Kompositumgrenze oder aus zwei Wörtern wirken nicht", () => {
    expect(
      fachkompositaIndex([
        // kein Kompositum des Grundworts
        { kompositum: "Lackierung", grundwort: "Farbe", quelle: "T" },
        // zwei Wörter
        { kompositum: "Pflicht Farbe", grundwort: "Farbe", quelle: "T" },
        // Rest vor dem Grundwort zu kurz — keine Kompositumgrenze („rand" in „brand")
        { kompositum: "Brand", grundwort: "Rand", quelle: "T" },
      ]).size,
    ).toBe(0);
  });
});

describe("R-0461 / R-1943 · die Frage nach der Farbe erreicht die Firmenwagen-Quelle", () => {
  it("die Fixture stellt den Fall her: „Farbe“ steckt in koCarBlau nur im Kompositum", () => {
    expect(queryTokens(FRAGE_FARBE)).toEqual(["farb", "firmenwag"]);
    const ziel = queryTokens(`${KO_CAR_BLAU.title} ${KO_CAR_BLAU.statement}`);
    expect(ziel).not.toContain("farb");
    expect(ziel).toContain("pflichtfarb");
  });

  it("koCarBlau trägt jetzt — auf beiden Auswahlwegen, und die validierte Quelle steht vorn", () => {
    expect(rankCandidates(FRAGE_FARBE, [KO_CAR_BLAU]).map((x) => x.ref.id)).toEqual(["koCarBlau"]);
    expect(keywordSelect(FRAGE_FARBE, [KO_CAR_BLAU]).map((x) => x.id)).toEqual(["koCarBlau"]);
    expect(rankCandidates(FRAGE_FARBE, [KO_CAR_ROT, KO_CAR_BLAU]).map((x) => x.ref.id)).toEqual([
      "koCarBlau",
      "koCarRot",
    ]);
  });

  it("am echten Reasoner zu Ende gemessen: die Antwort steht auf koCarBlau", async () => {
    const out = await new Reasoner().answerRetrievalOnly(FRAGE_FARBE, [KO_CAR_BLAU], "de");
    expect(out.answered).toBe(true);
    expect(out.sources).toEqual(["koCarBlau"]);
  });
});

describe("R-0442 / R-0461 · gleich gebaut, verschieden behandelt — allein die Liste entscheidet", () => {
  const UNTERDRUCK = ref("unterdruck", "Hinweis", "Der Unterdruck am Ventil ist vorgeschrieben.");
  const WIDERSTAND = ref("widerstand", "Hinweis", "Der Widerstand am Ventil ist vorgeschrieben.");

  it("die Fixture: beide Paare erfüllen dieselbe formale Kompositumgrenze", () => {
    expect(queryTokens("Welcher Druck gilt am Ventil?")).toContain("druck");
    expect(queryTokens("Welcher Stand gilt am Ventil?")).toContain("stand");
    expect(queryTokens(UNTERDRUCK.statement)).toContain("unterdruck");
    expect(queryTokens(WIDERSTAND.statement)).toContain("widerstand");
  });

  it("deklariert: „Druck“ trägt über „Unterdruck“", () => {
    expect(
      rankCandidates("Welcher Druck gilt am Ventil?", [UNTERDRUCK]).map((x) => x.ref.id),
    ).toEqual(["unterdruck"]);
    expect(keywordSelect("Welcher Druck gilt am Ventil?", [UNTERDRUCK]).map((x) => x.id)).toEqual([
      "unterdruck",
    ]);
  });

  it("R-0442: nicht deklariert — „Stand“ trägt über „Widerstand“ NICHT", () => {
    expect(rankCandidates("Welcher Stand gilt am Ventil?", [WIDERSTAND])).toEqual([]);
    expect(keywordSelect("Welcher Stand gilt am Ventil?", [WIDERSTAND])).toEqual([]);
  });

  it("nur in deklarierter Richtung: eine Quelle über „Druck“ trägt keine Frage nach „Unterdruck“", () => {
    const druck = ref("druck", "Hinweis", "Der Druck am Ventil ist vorgeschrieben.");
    expect(rankCandidates("Welcher Unterdruck gilt am Ventil?", [druck])).toEqual([]);
    expect(keywordSelect("Welcher Unterdruck gilt am Ventil?", [druck])).toEqual([]);
  });

  it("die Mindestsubstanz bleibt: ein deklarierter Treffer ALLEIN trägt nicht", () => {
    const nurFarbe = ref("nf", "Anstrichplan", "Die Pflichtfarbe der Halle ist grau.");
    expect(rankCandidates("Welche Farbe hat das Ventil?", [nurFarbe])).toEqual([]);
    expect(keywordSelect("Welche Farbe hat das Ventil?", [nurFarbe])).toEqual([]);
  });
});
