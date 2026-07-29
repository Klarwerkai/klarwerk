// AUFTRAG-mega58 BLOCK A — DAS SUBSTANZTOR GREIFT JE KANDIDAT, NICHT NUR AUF DEM BESTEN.
//
// DER BEFUND (ben, sammel55, ROT-Blocker). Bis mega57 stand das absolute Tor auf dem `Math.max`
// über die Substanzwerte ALLER Kandidaten. Danach entschied die relative Regel allein auf dem
// Überschneidungswert. Folge: eine Quelle mit `substanz = 0`, aber hohem Überschneidungswert kam
// mit, sobald IRGENDEINE andere Quelle das Tor öffnete — und verdrängte den tragenden Treffer sogar,
// denn bei Wert 5 gegen Wert 2 gilt `2 · 2 > 5` nicht. Dann stand die substanzlose Quelle ALLEIN in
// der Antwort. Genau die Zusage aus dem alten Kommentar („nur als Mitläufer … nie allein") fiel
// damit — nicht am Rand, sondern im Normalfall eines gemischten Pools.
//
// DIE FIXTURE IST DER GANZE FALL. Ein Mischpool aus zwei Quellen:
//  · SUBSTANZLOS — teilt fünf mehrdeutige Funktionsformen mit der Frage (woll, würd, halt, eben,
//    laut). Überschneidungswert 5, Substanzwert 0.
//  · TRAGEND — teilt genau zwei echte Fachwörter (ventil, überdruck). Wert 2, Substanz 2.
//
// Am Stand vor diesem Auftrag lief das so: das Tor öffnete auf `max(0, 2) = 2`; der Bestwert war 5;
// die relative Regel warf den TRAGENDEN Kandidaten hinaus (`2 · 2 > 5` ist falsch) und ließ den
// SUBSTANZLOSEN durch (`5 · 2 > 5` ist wahr). Ergebnis: die substanzlose Quelle als einzige.
//
// Ab jetzt fällt jeder Kandidat unter `MIN_ANSWER_SUBSTANCE` VOR der relativen Regel. Der Bestwert
// entsteht erst auf der verbleibenden Menge — deshalb steht der tragende Treffer wieder da, und die
// substanzlose Quelle erscheint weder allein noch als Mitläufer.
import { describe, expect, it } from "vitest";
import type { KnowledgeRef } from "../../services/reasoner";
import {
  DeterministicProvider,
  MIN_ANSWER_SUBSTANCE,
  keywordSelect,
  queryTokens,
  rankCandidates,
  selectCandidates,
} from "../../services/reasoner";
import { refMatchText } from "../../services/reasoner/src/provider";

function ref(id: string, title: string, statement: string): KnowledgeRef {
  return { id, title, statement, status: "validiert", trust: 70 };
}

// Beide Zahlen unabhängig nachgerechnet, damit die Fixture beweist, was sie behauptet — und nicht
// nur zufällig grün ist, weil sich die Formen gar nicht mehr treffen.
function gemeinsam(frage: string, r: KnowledgeRef): string[] {
  const ziel = new Set(queryTokens(refMatchText(r)));
  return [...new Set(queryTokens(frage).filter((w) => ziel.has(w)))];
}

const FRAGE = "Was wollte man, was würde halt eben laut gelten für das Ventil bei Überdruck?";

const SUBSTANZLOS = ref(
  "verwaltung",
  "Hinweis der Verwaltung",
  "Sie wollten es, und es würde halt eben laut so sein.",
);

const TRAGEND = ref("ventilplan", "Ventilplan", "Das Ventil öffnet bei Überdruck.");

// Die Reihenfolge im Pool ist absichtlich „substanzlos zuerst": bei stabiler Sortierung ist das die
// ungünstigste Lage für den tragenden Treffer.
const POOL: readonly KnowledgeRef[] = [SUBSTANZLOS, TRAGEND];

describe("AUFTRAG-mega58 A — die Fixture stellt den Mischpool wirklich her", () => {
  it("der substanzlose Kandidat hat Überschneidungswert 5 und Substanz 0", () => {
    expect(gemeinsam(FRAGE, SUBSTANZLOS)).toEqual(["woll", "würd", "halt", "eben", "laut"]);
    expect(gemeinsam(FRAGE, SUBSTANZLOS)).toHaveLength(5);
  });

  it("der tragende Kandidat hat Überschneidungswert 2 und Substanz 2", () => {
    expect(gemeinsam(FRAGE, TRAGEND)).toEqual(["ventil", "überdruck"]);
    expect(gemeinsam(FRAGE, TRAGEND)).toHaveLength(MIN_ANSWER_SUBSTANCE);
  });

  it("die relative Regel allein würde den tragenden Treffer verdrängen", () => {
    // Das ist die Rechnung, aus der der Befund entsteht — hier explizit, damit sichtbar bleibt,
    // WARUM das Tor vor die relative Regel gehört und nicht dahinter.
    expect(2 * 2 > 5).toBe(false);
    expect(5 * 2 > 5).toBe(true);
  });
});

describe("AUFTRAG-mega58 A — keywordSelect: das Tor je Kandidat", () => {
  it("nur der tragende Kandidat erscheint", () => {
    expect(keywordSelect(FRAGE, POOL).map((x) => x.id)).toEqual(["ventilplan"]);
  });

  it("der substanzlose Kandidat erscheint auch nicht als Mitläufer eines starken Treffers", () => {
    // Zweite Lage desselben Falls: der tragende Treffer ist diesmal stark genug, dass die relative
    // Regel den substanzlosen Kandidaten durchließe. Er darf trotzdem nicht in die Liste.
    const frage = "Was wollte man laut Ventil, Überdruck und Ventilkennung V12 halt eben?";
    const stark = ref("stark", "Ventilplan V12", "Ventil, Überdruck und Ventilkennung V12.");
    expect(keywordSelect(frage, [SUBSTANZLOS, stark]).map((x) => x.id)).toEqual(["stark"]);
  });

  it("bleibt nach dem Tor nichts übrig, ist die Menge leer wie bisher", () => {
    expect(keywordSelect(FRAGE, [SUBSTANZLOS])).toEqual([]);
  });
});

describe("AUFTRAG-mega58 A — rankCandidates/selectCandidates: dieselbe Regel im zweiten Weg", () => {
  it("nur der tragende Kandidat erscheint", () => {
    expect(rankCandidates(FRAGE, POOL).map((x) => x.ref.id)).toEqual(["ventilplan"]);
    expect(selectCandidates(FRAGE, POOL).map((x) => x.id)).toEqual(["ventilplan"]);
  });

  it("der Bestwert entsteht auf der verbleibenden Menge, nicht auf dem ganzen Pool", () => {
    // Stünde der Bestwert weiter auf 5 (dem Wert des substanzlosen Kandidaten), fiele der tragende
    // Treffer an der relativen Regel — die Liste wäre leer statt richtig.
    const ranked = rankCandidates(FRAGE, POOL);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.keywordScore).toBe(2);
  });

  it("der substanzlose Kandidat erscheint auch nicht als Mitläufer eines starken Treffers", () => {
    const frage = "Was wollte man laut Ventil, Überdruck und Ventilkennung V12 halt eben?";
    const stark = ref("stark", "Ventilplan V12", "Ventil, Überdruck und Ventilkennung V12.");
    expect(rankCandidates(frage, [SUBSTANZLOS, stark]).map((x) => x.ref.id)).toEqual(["stark"]);
  });

  it("bleibt nach dem Tor nichts übrig, ist die Menge leer wie bisher", () => {
    expect(rankCandidates(FRAGE, [SUBSTANZLOS])).toEqual([]);
    expect(selectCandidates(FRAGE, [SUBSTANZLOS])).toEqual([]);
  });
});

describe("AUFTRAG-mega58 A — der deterministische Weg antwortet auf der tragenden Quelle", () => {
  it("die Antwort steht auf dem Ventilplan, nicht auf dem Verwaltungshinweis", async () => {
    const ergebnis = await new DeterministicProvider().answer(FRAGE, POOL);
    expect(ergebnis.answered).toBe(true);
    expect(ergebnis.sources).toEqual(["ventilplan"]);
  });

  it("ohne tragende Quelle bleibt es bei der Wissenslücke", async () => {
    const ergebnis = await new DeterministicProvider().answer(FRAGE, [SUBSTANZLOS]);
    expect(ergebnis.answered).toBe(false);
    expect(ergebnis.sources).toEqual([]);
    expect(ergebnis.knowledgeClass).toBe("unbekannt");
  });
});

describe("AUFTRAG-mega58 A — die Rangfolge der tragenden Kandidaten ändert sich nicht", () => {
  it("unter lauter tragenden Quellen bleibt alles, wie es war", () => {
    // Die Gegenprobe zum Fix: das Tor entfernt NUR Kandidaten unter der Schwelle. Wer sie erreicht,
    // steht in derselben Reihenfolge wie vorher — Wert dominiert, Status/Trust bricht Gleichstand.
    const frage = "Wann ist das Ventil bei Überdruck und Kennung V12 fällig?";
    const drei = ref("drei", "Ventilplan V12", "Ventil, Überdruck und V12.");
    const zwei = ref("zwei", "Überdruckhinweis", "Das Ventil bei Überdruck.");
    const eins = ref("eins", "Lagerplan", "Das Ventil steht im Keller.");
    const ranked = rankCandidates(frage, [eins, zwei, drei]);
    expect(ranked.map((x) => x.ref.id)).toEqual(["drei", "zwei"]);
    expect(ranked.map((x) => x.keywordScore)).toEqual([3, 2]);
  });
});
