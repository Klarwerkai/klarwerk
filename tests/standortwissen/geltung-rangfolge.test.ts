// ================================================================================================
// R-1633 — „GEWICHTET … HÖHER … FALLS RELEVANT": DIE STELLE DES GELTUNGSRANGS IN DER RANGFOLGE.
// ================================================================================================
//
// `rankCandidates` (services/reasoner/src/provider.ts) ist die Auswahl beider Tore. Der
// Geltungsrang steht HINTER der Relevanz und VOR dem Status-/Trust-Bonus:
//   P1  unter gleich relevanten Quellen gewinnt die eigene Schicht — auch gegen höheren Trust;
//   P2  eine Quelle, die die Frage besser trifft, bleibt vorn, egal woher sie stammt;
//   P3  ohne Geltungsrang (kein Fragekontext) ist die Ordnung die bisherige.
import { describe, expect, it } from "vitest";
import { type KnowledgeRef, rankCandidates } from "../../services/reasoner";

const FRAGE = "Wie wird das Werkzeug beim Anfahren der Presse vorgewärmt?";

function ref(id: string, statement: string, extra: Partial<KnowledgeRef> = {}): KnowledgeRef {
  return { id, title: "Presse anfahren", statement, status: "validiert", trust: 50, ...extra };
}

const VOLL = "Beim Anfahren der Presse wird das Werkzeug langsam vorgewärmt.";
const WENIGER = "Beim Anfahren der Presse wird zuerst die Schutztür geprüft, dann vorgewärmt.";

const ids = (refs: readonly KnowledgeRef[]): string[] =>
  rankCandidates(FRAGE, refs).map((c) => c.ref.id);

describe("R-1633 · Geltungsrang in der Rangfolge", () => {
  it("P1 · gleich relevant: die eigene Schicht steht vorn, auch gegen höheren Trust", () => {
    const nacht = ref("nacht", VOLL, { trust: 100, geltungsrang: 0 });
    const frueh = ref("frueh", VOLL, { trust: 40, geltungsrang: 3 });
    const werk = ref("werk", VOLL, { trust: 90, geltungsrang: 2 });
    expect(ids([nacht, werk, frueh])).toEqual(["frueh", "werk", "nacht"]);
  });

  it("P2 · „falls relevant“: wer die Frage besser trifft, bleibt vorn — die andere bleibt Kandidat", () => {
    const genau = ref("genau", VOLL, { geltungsrang: 0 });
    const eigeneSchicht = ref("eigene-schicht", WENIGER, { geltungsrang: 3 });
    const gerankt = rankCandidates(FRAGE, [eigeneSchicht, genau]);
    // Kalibrierung: die beiden treffen die Frage wirklich verschieden gut.
    const score = new Map(gerankt.map((c) => [c.ref.id, c.keywordScore]));
    expect(score.get("genau") ?? 0).toBeGreaterThan(score.get("eigene-schicht") ?? 0);
    expect(gerankt.map((c) => c.ref.id)).toEqual(["genau", "eigene-schicht"]);
  });

  it("P3 · ohne Geltungsrang entscheidet wie bisher der Trust", () => {
    const a = ref("a", VOLL, { trust: 40 });
    const b = ref("b", VOLL, { trust: 100 });
    expect(ids([a, b])).toEqual(["b", "a"]);
  });
});
