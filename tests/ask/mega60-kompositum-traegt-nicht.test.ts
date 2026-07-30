// AUFTRAG-mega60 BLOCK A — DER KOMPOSITUMTREFFER ZÄHLT AUF DEN SUCHWERT, NICHT AUF DIE SUBSTANZ.
//
// DER BEFUND (ben, ROT-1 gegen sammel57; am Code nachgeprüft und ohne Fehlerinjektion reproduzierbar):
// `trifftAlsWortteil` belegt eine Kompositumgrenze allein über Zeichenposition und Länge. Für die
// Frage „Welcher Stand gilt am Ventil?“ gegen die Quelle „Der Widerstand am Ventil ist
// vorgeschrieben.“ bildet die Grundform „stand“ und „widerstand“ (am laufenden Bestand nachgemessen;
// bens Skizze nannte „stan“/„widerstan“ — die Endung fällt hier nicht, der Befund bleibt derselbe).
// Der Endzweig trifft: „stand“ hat fünf Zeichen, steht am Wortende, der Rest „wider“ hat fünf.
// Zusammen mit dem echten Treffer „ventil“ entstanden ZWEI Substanzpunkte — eine sachfremde Quelle
// trug damit eine Antwort. Genau die Eigenschaft, gegen die mega52 bis mega58 gebaut wurden.
//
// WARUM KEINE VIERTE ZEICHENBEDINGUNG: „Unterdruck“ und „Widerstand“ sind morphologisch identisch
// gebaut (Präposition + Substantiv), semantisch aber verschieden — ein Unterdruck IST ein Druck, ein
// Widerstand ist KEIN Stand. Jede rein formale Regel, die den einen trägt, trägt auch den anderen.
// Eine weitere Zeichenbedingung verschiebt die Grenze nur, sie schließt sie nicht.
//
// DIE ENTSCHEIDUNG, eng und fail-closed: ein Kompositumtreffer zählt weiter auf den
// Überschneidungswert `wert` — die Quelle wird gefunden, kommt in die Kandidatenliste und wird
// gerankt —, aber NICHT auf `substanz`, und zwar in BEIDEN Zweigen (Wortende und Fugen-s). Ein
// Kompositumtreffer kann eine Antwort damit weder allein tragen noch den zweiten Substanzpunkt
// liefern; er ist Mitläufer eines substanzstarken Treffers. Das ist die Trennung suchbar/tragend aus
// mega57, angewandt auf einen neuen Treffertyp.
import { describe, expect, it } from "vitest";
import type { KnowledgeRef } from "../../services/reasoner";
import { keywordSelect, queryTokens, rankCandidates } from "../../services/reasoner";

function ref(
  id: string,
  title: string,
  statement: string,
  status: KnowledgeRef["status"] = "validiert",
  trust = 70,
): KnowledgeRef {
  return { id, title, statement, status, trust };
}

const FRAGE_STAND = "Welcher Stand gilt am Ventil?";
const FRAGE_STAND_FILTER = "Welcher Stand gilt am Ventil und am Filter?";
const MIT_KOMPOSITUM = ref("mk", "Hinweis", "Der Widerstand am Ventil und am Filter ist geprüft.");
const OHNE_KOMPOSITUM = ref("ok", "Hinweis", "Der Ablauf am Ventil und am Filter ist geprüft.");

// Bens Gegenbeispiel wörtlich, dazu die beiden gleichartigen Kanten. `grenze` sagt, ob die Zeile den
// Befund WIRKLICH reproduziert — und diese Spalte ist am Bestand nachgemessen, nicht angenommen:
//
//  · „widerstand“ und „wohlstand“ tun es: „stand“ steht am Wortende, davor bleiben fünf bzw. vier
//    Zeichen. Die drei Bedingungen aus mega59 C sind buchstäblich erfüllt, es sind keine
//    Wortkuriositäten, sondern dieselbe Regel.
//  · „Gegenstand“ tut es NICHT, und das ist eine Korrektur an der Auftragsskizze: die Grundform ist
//    „genstand“, nicht „gegenstand“ — `abtragGe` nimmt das „ge“ weg. Übrig bleibt der Rest „gen“ mit
//    DREI Zeichen, und damit scheitert die Zeile schon an der dritten Bedingung von mega59 C. Sie
//    bleibt trotzdem in der Tafel: sie muss auch nach dem Fix leer bleiben, und sie belegt, dass die
//    Tafel gemessen und nicht behauptet ist.
const SACHFREMD: readonly {
  readonly token: string;
  readonly satz: string;
  readonly grenze: boolean;
}[] = [
  { token: "widerstand", satz: "Der Widerstand am Ventil ist vorgeschrieben.", grenze: true },
  { token: "wohlstand", satz: "Der Wohlstand am Ventil wird gemessen.", grenze: true },
  { token: "genstand", satz: "Der Gegenstand am Ventil ist erfasst.", grenze: false },
];

describe("AUFTRAG-mega60 A — der Kompositumtreffer trägt keine Antwort", () => {
  it("die Fixture stellt den Fall wirklich her: der Stand steckt nur im Kompositum", () => {
    // Ohne diese Vorkalibrierung wären die Fälle darunter auch dann grün, wenn die Zerlegung „Stand“
    // und „Widerstand“ gar nicht auf eine gemeinsame Kompositumgrenze brächte — dann prüften sie
    // nichts. Der Frageterm ist „stand“, das Zieltoken „widerstand“: verschieden, aber an der Grenze
    // deckungsgleich, und „ventil“ ist der eine echte Volltreffer.
    expect(queryTokens(FRAGE_STAND)).toEqual(["stand", "gilt", "ventil"]);
    for (const { token, satz, grenze } of SACHFREMD) {
      const ziel = queryTokens(satz);
      expect(ziel).not.toContain("stand");
      expect(ziel).toContain(token);
      expect(ziel).toContain("ventil");
      // Und die Spalte `grenze` selbst ist geprüft: nur wo der Rest vor „stand“ vier Zeichen hat,
      // trägt die Zeile den Befund. Sonst wäre die Tafel eine Behauptung über sich selbst.
      expect(token.length - "stand".length >= 4).toBe(grenze);
    }
  });

  it("die sachfremde Quelle trägt KEINE Antwort — der Substanzwert bleibt bei eins", () => {
    // Der Kern von ROT-1. Ein Kompositumtreffer plus ein echter Treffer sind EIN Substanzpunkt, nicht
    // zwei; MIN_ANSWER_SUBSTANCE = 2 bleibt unerreicht, und beide Wege sind fail-closed leer.
    for (const { satz } of SACHFREMD) {
      const quelle = ref("sf", "Hinweis", satz);
      expect(rankCandidates(FRAGE_STAND, [quelle])).toEqual([]);
      expect(keywordSelect(FRAGE_STAND, [quelle])).toEqual([]);
    }
  });

  it("DIE GEGENPROBE: die Quelle wird weiterhin GEFUNDEN — der Suchwert steigt", () => {
    // Ohne diese Zeile prüfte der Fall oben versehentlich, dass der Kompositumtreffer GANZ
    // verschwunden ist. Er ist aber nur nicht mehr tragend. Ablesbar wird der Suchwert erst, wenn der
    // Kandidat das Substanztor über ZWEI echte Volltreffer passiert („ventil“, „filter“): dann trennt
    // der Kompositumtreffer den Suchwert 3 vom Suchwert 2 der sonst gleichen Quelle ohne ihn.
    expect(queryTokens(FRAGE_STAND_FILTER)).toEqual(["stand", "gilt", "ventil", "filter"]);
    const [mit] = rankCandidates(FRAGE_STAND_FILTER, [MIT_KOMPOSITUM]);
    const [ohne] = rankCandidates(FRAGE_STAND_FILTER, [OHNE_KOMPOSITUM]);
    expect(mit?.keywordScore).toBe(3);
    expect(ohne?.keywordScore).toBe(2);
  });
});

describe("AUFTRAG-mega60 A — es liegt an der Substanz, nicht am Finden", () => {
  it("zwei echte Volltreffer tragen — und der Kompositumtreffer leistet seinen Rangbeitrag", () => {
    // Der Beweis der Trennung: dieselbe Quelle, die oben nicht trug, trägt hier — allein deshalb,
    // weil die Frage ZWEI echte Volltreffer beisteuert. Der Kompositumtreffer hat sich dabei nicht
    // geändert; er zahlt weiter auf den Rang ein und sortiert die Quelle vor die sonst gleiche ohne
    // ihn. Genau das ist der Mitläufer eines substanzstarken Treffers — nie allein.
    expect(keywordSelect(FRAGE_STAND_FILTER, [MIT_KOMPOSITUM]).map((x) => x.id)).toEqual(["mk"]);
    // Eingabereihenfolge bewusst umgekehrt: die Rangfolge entscheidet, nicht die Liste.
    const ranked = rankCandidates(FRAGE_STAND_FILTER, [OHNE_KOMPOSITUM, MIT_KOMPOSITUM]);
    expect(ranked[0]?.ref.id).toBe("mk");
    expect(ranked[0]?.keywordScore).toBeGreaterThan(ranked[1]?.keywordScore ?? 0);
  });
});
