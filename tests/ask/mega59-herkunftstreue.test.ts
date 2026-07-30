// AUFTRAG-mega59 BLOCK B — „WARTUNG" TRÄGT WIEDER, UND „IHR WART" NICHT.
//
// mega57 hat suchbar und tragend getrennt und dafür einen Preis bezahlt, den es selbst gemessen und
// als Produktentscheidung gemeldet hat: `["wart", "Wartung"]` steht in den mehrdeutigen
// Funktionsformen, weil „wart“ auch Präteritum von „sein“ ist — und damit zahlte „Wartung“ nicht
// mehr auf die Mindestsubstanz ein. „Wartung“ ist das zentrale Industriewort der Testerin. Dieser
// Preis wird hier zurückgenommen, ohne die Trennung aufzugeben.
//
// DER UNTERSCHIED, den die Liste allein nicht sehen kann, ist die HERKUNFT: derselbe Term „wart“
// entsteht einmal aus einer Nominalisierung („Wartung“, über den Abtrag von `-ung`) und einmal aus
// einer Verbform („ihr wart“, ohne jeden Abtrag). Das Merkmal läuft als zweites, PARALLELES Feld
// neben dem Tokenstrom mit — niemals als zweites Token.
import { describe, expect, it } from "vitest";
import type { KnowledgeRef } from "../../services/reasoner";
import {
  DeterministicProvider,
  keywordSelect,
  queryTokens,
  rankCandidates,
} from "../../services/reasoner";

function ref(id: string, title: string, statement: string): KnowledgeRef {
  return { id, title, statement, status: "validiert", trust: 70 };
}

describe("AUFTRAG-mega59 B — die Herkunft entscheidet, nicht der Term allein", () => {
  it("der ausgegebene Term ist BYTEWEISE unverändert — die Prefilter-Zusage hält", () => {
    // Das ist die harte Randbedingung dieses Blocks. Ein zweites Token hätte die Zusage aus
    // mega54 B4 gebrochen: der Repo-Prefilter (services/ask/src/service.ts) benutzt EXAKT die
    // Terme, die `queryTokens` liefert. Wer hier einen Term ändert, bricht die Vorauswahl.
    expect(queryTokens("Wartung")).toEqual(["wart"]);
    expect(queryTokens("warten")).toEqual(["wart"]);
    expect(queryTokens("Wartungen")).toEqual(["wart"]);
    expect(queryTokens("Wartungsplan")).toEqual(["wartungspla"]);
    expect(queryTokens("Die Wartung am Ventil")).toEqual(["wart", "ventil"]);
    // Und die Zerlegung ist immer noch EINE: Frage und Quelltext ergeben denselben Strom.
    expect(queryTokens("Wann ist die Wartung am Ventil fällig?")).toEqual([
      "wart",
      "ventil",
      "fällig",
    ]);
  });

  it("„Wartung“ TRÄGT — genau der Fall, den mega57 als Preis gepinnt hatte", () => {
    // Wörtlich die Fixture aus tests/ask/mega57-suchbar-und-tragend.test.ts:124-128. Dort war das
    // Ergebnis LEER und als bewusster Recall-Verlust benannt; ab mega59 trägt die Quelle.
    const FRAGE = "Wann ist die Wartung am Ventil fällig?";
    const quelle = ref("wartung", "Wartungsplan", "Die Wartung am Ventil erfolgt jährlich.");
    const ranked = rankCandidates(FRAGE, [quelle]);
    expect(ranked.map((x) => x.ref.id)).toEqual(["wartung"]);
    // Zwei gemeinsame Inhaltstoken („wart“ und „ventil“), und BEIDE zahlen jetzt ein.
    expect(ranked[0]?.keywordScore).toBe(2);
    expect(keywordSelect(FRAGE, [quelle]).map((x) => x.id)).toEqual(["wartung"]);
  });

  it("der deterministische Weg antwortet auf die Wartungsfrage", async () => {
    const FRAGE = "Wann ist die Wartung am Ventil fällig?";
    const quelle = ref("wartung", "Wartungsplan", "Die Wartung am Ventil erfolgt jährlich.");
    const ergebnis = await new DeterministicProvider().answer(FRAGE, [quelle]);
    expect(ergebnis.answered).toBe(true);
    expect(ergebnis.sources).toEqual(["wartung"]);
  });

  it("„Wartungsplan“ trägt — sein Term ist gar keine mehrdeutige Form", () => {
    // Ehrlich benannt, weil es sonst als Verdienst dieses Blocks gelesen würde: „Wartungsplan“
    // fällt auf „wartungspla“ und stand damit nie in der mehrdeutigen Menge. Der Test steht hier,
    // damit eine künftige Ausweitung des Abtrags (die „wartungspla“ auf „wart“ zusammenziehen
    // würde) nicht still die Substanz dieses Wortes mitnimmt.
    const FRAGE = "Was steht im Wartungsplan zum Ventil?";
    const quelle = ref("plan", "Wartungsplan Ventil", "Der Wartungsplan nennt das Ventil.");
    expect(rankCandidates(FRAGE, [quelle]).map((x) => x.ref.id)).toEqual(["plan"]);
    expect(keywordSelect(FRAGE, [quelle]).map((x) => x.id)).toEqual(["plan"]);
  });

  it("„ihr wart“ trägt NICHT — die Verbform bleibt eine Verbform", () => {
    // Der Grund, warum „wart“ überhaupt in der mehrdeutigen Menge steht. Er gilt unverändert:
    // zwei rein grammatische Wörter erreichen die Mindestsubstanz nicht.
    const FRAGE = "Wo wart ihr und was gilt halt?";
    const fremd = ref(
      "verwaltung",
      "Hinweis der Verwaltung",
      "Ihr wart dort, und es gilt halt so.",
    );
    expect(rankCandidates(FRAGE, [fremd])).toEqual([]);
    expect(keywordSelect(FRAGE, [fremd])).toEqual([]);
  });

  it("die Entscheidung ist FAIL-CLOSED: eine Seite Nominalisierung genügt nicht", () => {
    // Die Frage redet von Wartung, die Quelle von einem Aufenthalt. Beide teilen den Term „wart“,
    // aber keine redet von der Sache der anderen. Wäre EINE Seite genug, bekäme dieser Fall
    // Substanz gutgeschrieben — genau die fail-open Lesart, die dieser Block nicht wählt.
    const quelle = ref("dort", "Hinweis der Verwaltung", "Ihr wart dort am Ventil.");
    expect(rankCandidates("Wann ist die Wartung am Ventil fällig?", [quelle])).toEqual([]);
    // Und in der Gegenrichtung genauso — die Regel ist symmetrisch, nicht richtungsabhängig.
    const nominal = ref("plan", "Wartungsplan", "Die Wartung am Ventil erfolgt jährlich.");
    expect(rankCandidates("Wo wart ihr am Ventil?", [nominal])).toEqual([]);
  });

  it("die anderen mehrdeutigen Formen bleiben unverändert nicht tragend", () => {
    // Der Block wirkt NUR über die Nominalisierungsendung. Formen ohne sie sind unberührt —
    // sonst wäre er eine stille Rücknahme von mega57 statt einer gezielten Ausnahme.
    const KREUZUNGEN: Array<[string, string]> = [
      ["Was wollte man und was würde gelten?", "Sie wollten etwas, und dadurch würden Folgen."],
      ["Was waren die Fälle und was gilt halt?", "Die Waren, die Fälle und der Halt im Vorgang."],
      ["Gilt das laut Ebene oder mittels Zweck?", "Hinweis laut Ebene und mittels Zweck."],
    ];
    for (const [frage, aussage] of KREUZUNGEN) {
      const quelle = ref("fremd", "Hinweis der Verwaltung", aussage);
      expect(rankCandidates(frage, [quelle]), frage).toEqual([]);
      expect(keywordSelect(frage, [quelle]), frage).toEqual([]);
    }
  });

  it("„Haltung“ trägt aus demselben Grund — es ist eine Regel, kein Einzelfall für Wartung", () => {
    // „halt“ steht mit dem Beleg „Haltung“ in derselben Menge. Wäre die Ausnahme auf „Wartung“
    // zugeschnitten, bliebe „Haltung“ liegen und die Regel wäre eine Sonderbehandlung.
    const FRAGE = "Welche Haltung gilt für das Ventil?";
    const quelle = ref("halt", "Haltungsregel", "Die Haltung am Ventil ist vorgeschrieben.");
    expect(rankCandidates(FRAGE, [quelle]).map((x) => x.ref.id)).toEqual(["halt"]);
    // Die Partikel „halt“ trägt weiterhin nicht — derselbe Rahmen wie in mega57, damit genau EIN
    // echtes Fachwort („Ventil") neben der Form steht und der Fall die Form misst, nicht den Rahmen.
    const partikel = ref("p", "Hinweis der Verwaltung", "Hinweis zu halt und Ventil im Vorgang.");
    expect(rankCandidates("Gilt das Ventil oder halt?", [partikel])).toEqual([]);
    expect(keywordSelect("Gilt das Ventil oder halt?", [partikel])).toEqual([]);
  });
});
