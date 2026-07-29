// AUFTRAG-mega57 BLOCK D — DIE ZWEI FÄLLE, DIE DIE TRENNUNG TRAGEN.
//
// D1 ist bens Gegenfall aus sammel54, wörtlich: zwei Modalformen allein tragen keine Antwort mehr.
// D2 ist die Gegenprobe dazu, und sie ist genauso wichtig: „Wartung" darf dabei nicht sterben.
//
// Die beiden Fälle gehören zusammen, weil sie die ganze Scheibe dieser Runde sind. Eine Wortform
// kann SUCHBAR sein und trotzdem NICHTS TRAGEN. Bis mega56 fiel beides zusammen — was in der Liste
// stand, verschwand ganz; was nicht drinstand, zählte voll. Deshalb war jede Aufnahme ein Verlust
// und jede Auslassung ein Loch. Ab jetzt gibt es zwei Mengen und zwei Zahlen.
import { describe, expect, it } from "vitest";
import type { KnowledgeRef } from "../../services/reasoner";
import {
  DeterministicProvider,
  MIN_ANSWER_SUBSTANCE,
  keywordSelect,
  meetsAnswerSubstance,
  queryTokens,
  rankCandidates,
} from "../../services/reasoner";
import { refMatchText } from "../../services/reasoner/src/provider";

function ref(id: string, title: string, statement: string): KnowledgeRef {
  return { id, title, statement, status: "validiert", trust: 70 };
}

// Die beiden Zahlen unabhängig nachgerechnet, damit die Fixtures beweisen, was sie behaupten.
function gemeinsam(frage: string, r: KnowledgeRef): string[] {
  const ziel = new Set(queryTokens(refMatchText(r)));
  return [...new Set(queryTokens(frage).filter((w) => ziel.has(w)))];
}

// ------------------------------------------------------------------------------------------------
// D1 — DER GEMELDETE DURCHLASS, WÖRTLICH.
// ------------------------------------------------------------------------------------------------
describe("AUFTRAG-mega57 D1 — zwei Modalformen tragen keine Antwort", () => {
  const FRAGE = "Was wollte man und was würde gelten?";
  const FACHFREMD = ref(
    "verwaltung",
    "Hinweis der Verwaltung",
    "Sie wollten etwas, und dadurch würden Folgen entstehen.",
  );

  it("die Fixture stellt den Fall wirklich her: overlap = 2, Substanz = 0", () => {
    // Ohne diese Zeile wäre der Fall unten auch dann grün, wenn sich die Formen gar nicht mehr
    // träfen. Sie treffen sich — „wollte"/„wollten" auf „woll", „würde"/„würden" auf „würd" —
    // und genau das war bens Befund: zwei gemeinsame Inhaltstoken, also `overlap = 2`.
    expect(gemeinsam(FRAGE, FACHFREMD)).toEqual(["woll", "würd"]);
    expect(gemeinsam(FRAGE, FACHFREMD).length).toBe(MIN_ANSWER_SUBSTANCE);
  });

  it("rankCandidates liefert LEER — Wissenslücke statt Scheinquelle", () => {
    expect(rankCandidates(FRAGE, [FACHFREMD])).toEqual([]);
  });

  it("keywordSelect liefert LEER — dieselbe Regel im zweiten Auswahlweg", () => {
    expect(keywordSelect(FRAGE, [FACHFREMD])).toEqual([]);
  });

  it("der deterministische Weg antwortet nicht", async () => {
    const ergebnis = await new DeterministicProvider().answer(FRAGE, [FACHFREMD]);
    expect(ergebnis.answered).toBe(false);
    expect(ergebnis.sources).toEqual([]);
    expect(ergebnis.knowledgeClass).toBe("unbekannt");
  });

  it("die Kreuzungen aus demselben Befund sind mit derselben Regel zu", () => {
    // ben hat neben „woll"/„würd" auch „waren", „falls", „halt", „laut", „eben" und die
    // ausgelassenen Präpositionen genannt. Es ist EINE Regel, nicht sechs Einzelfälle.
    const KREUZUNGEN: Array<[string, string]> = [
      ["Was waren die Fälle und was gilt halt?", "Die Waren, die Fälle und der Halt im Vorgang."],
      ["Gilt das laut Ebene oder mittels Zweck?", "Hinweis laut Ebene und mittels Zweck."],
      ["Was war seit wann und wegen wem?", "Seitens der Stelle und wegen der Sache."],
      ["Was wollte man und was war halt so?", "Sie wollten es, und es war halt so."],
    ];
    for (const [frage, aussage] of KREUZUNGEN) {
      const quelle = ref("fremd", "Hinweis der Verwaltung", aussage);
      expect(rankCandidates(frage, [quelle]), frage).toEqual([]);
      expect(keywordSelect(frage, [quelle]), frage).toEqual([]);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// D2 — DIE GEGENPROBE: „Wartung" STIRBT NICHT.
// ------------------------------------------------------------------------------------------------
describe("AUFTRAG-mega57 D2 — suchbar bleibt suchbar", () => {
  it("Wartung behält seinen Term — der Repo-Prefilter findet die Quelle weiterhin", () => {
    // Das ist der ganze Unterschied zur Stoppwortliste. Ein Eintrag „wart" in `STOPWORDS` hätte
    // diesen Term gelöscht, und keine Wartungsquelle wäre über ihr eigenes Wort mehr auffindbar.
    expect(queryTokens("Wartung")).toEqual(["wart"]);
    expect(queryTokens("warten")).toEqual(["wart"]);
    expect(queryTokens("Die Wartung am Ventil")).toEqual(["wart", "ventil"]);
  });

  it("wart zählt weiterhin auf den Überschneidungswert — nur nicht auf die Substanz", () => {
    const FRAGE = "Wann ist die Wartung am Ventil V12 fällig?";
    const richtig = ref("wartung", "Wartungsplan V12", "Wartung am Ventil V12: alle sechs Monate.");
    expect(gemeinsam(FRAGE, richtig)).toEqual(["wart", "ventil", "v12"]);
    const ranked = rankCandidates(FRAGE, [richtig]);
    expect(ranked).toHaveLength(1);
    // Drei gemeinsame Token, nicht zwei: „wart" ist im Wert enthalten und trägt die Rangfolge mit.
    expect(ranked[0]?.keywordScore).toBe(3);
  });

  it("die Wartungsquelle trägt, sobald zwei echte Fachwörter geteilt sind", () => {
    const FRAGE = "Wann ist die Wartung am Ventil V12 fällig?";
    const richtig = ref("wartung", "Wartungsplan V12", "Wartung am Ventil V12: alle sechs Monate.");
    const daneben = ref("keller", "Lagerplan", "Das Ventil steht im Keller.");
    expect(rankCandidates(FRAGE, [richtig, daneben]).map((x) => x.ref.id)).toEqual(["wartung"]);
    expect(keywordSelect(FRAGE, [richtig, daneben]).map((x) => x.id)).toEqual(["wartung"]);
  });

  it("DER GEMESSENE PREIS, benannt: wart plus EIN Fachwort reicht nicht mehr", () => {
    // Das ist die Kehrseite der Trennung, und sie steht hier, damit sie sichtbar ist statt
    // vergessen: teilen Frage und Quelle nur „Wartung" und EIN weiteres Fachwort, ist der
    // Substanzwert eins, und die Antwort ist eine Wissenslücke. Vorher trug dieser Fall.
    //
    // Das ist der EINE Punkt, an dem die Umsetzung von der wörtlichen D2-Formulierung des
    // Auftrags abweicht („ein zweites echtes Fachwort danebenstehen … trägt weiterhin"). Beides
    // zugleich ist unter A2 nicht möglich: entweder zahlt „wart" auf die Mindestsubstanz ein —
    // dann trägt auch bens Grammatikpaar wieder — oder es zahlt nicht ein, dann kostet es hier.
    // Gewählt ist A1 wörtlich („wart" gehört in die mehrdeutige Menge); der Preis ist gemessen
    // und im Bericht als Produktentscheidung gemeldet, nicht stillschweigend eingebaut.
    const FRAGE = "Wann ist die Wartung am Ventil fällig?";
    const quelle = ref("wartung", "Wartungsplan", "Die Wartung am Ventil erfolgt jährlich.");
    expect(gemeinsam(FRAGE, quelle)).toEqual(["wart", "ventil"]);
    expect(rankCandidates(FRAGE, [quelle])).toEqual([]);
    expect(keywordSelect(FRAGE, [quelle])).toEqual([]);
  });

  it("dasselbe gilt für die anderen Belege — sie behalten alle ihren Term", () => {
    for (const [wort, token] of [
      ["Ware", "ware"],
      ["Wolle", "woll"],
      ["Würde", "würd"],
      ["Mittel", "mittel"],
      ["Zweck", "zweck"],
      ["Haltung", "halt"],
      ["Ebene", "eben"],
      ["Kraft", "kraf"],
      ["Mangel", "mangel"],
      ["Rechte", "rech"],
    ] as Array<[string, string]>) {
      expect(queryTokens(wort), `${wort} hat seinen Term verloren`).toEqual([token]);
    }
  });
});

// ------------------------------------------------------------------------------------------------
// DIE SCHWELLE SELBST — sie bleibt bei zwei, nur die Zahl davor ist die richtige.
// ------------------------------------------------------------------------------------------------
describe("AUFTRAG-mega57 A2 — zwei Zahlen, eine Schwelle", () => {
  it("MIN_ANSWER_SUBSTANCE ist unverändert zwei", () => {
    expect(MIN_ANSWER_SUBSTANCE).toBe(2);
  });

  it("das absolute Tor steht auf dem Substanzwert, über die volle Wertetafel", () => {
    for (let substanz = 0; substanz <= 6; substanz++) {
      expect(meetsAnswerSubstance(substanz), `substanz=${substanz}`).toBe(
        substanz >= MIN_ANSWER_SUBSTANCE,
      );
    }
  });

  it("EIN Fachwort plus EINE mehrdeutige Form trägt nicht, ZWEI Fachwörter tragen", () => {
    const frage = "Gilt das Ventil oder würde etwas?";
    const schwach = ref("schwach", "Hinweis", "Das Ventil, und es würde gelten.");
    expect(gemeinsam(frage, schwach)).toEqual(["ventil", "würd"]);
    expect(rankCandidates(frage, [schwach])).toEqual([]);

    const stark = ref("stark", "Hinweis", "Das Ventil bei Überdruck, und es würde gelten.");
    expect(rankCandidates("Gilt das Ventil bei Überdruck oder würde etwas?", [stark])).toHaveLength(
      1,
    );
  });
});
