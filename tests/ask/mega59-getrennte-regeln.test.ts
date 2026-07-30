// AUFTRAG-mega59 BLOCK I — DIE BEHAUPTUNG „DAS PRODUKT VERHÄLT SICH UNVERÄNDERT" WIRD BELEGT.
//
// mega59 hat aus `meetsRelevanceThreshold` den Zweig `if (bestScore < MIN_ANSWER_SUBSTANCE) return
// false;` entfernt. Das ist eine Änderung an einer Funktion, die BEIDE Auswahlwege fahren — die
// gefährlichste Sorte, wenn sie nur mit einem Kommentar begleitet wird. Ein Kommentar sagt, warum
// jemand glaubt, dass nichts passiert; ein Test sagt, dass nichts passiert.
//
// DAS ARGUMENT, das hier nachgerechnet wird, in drei Schritten:
//   1. Seit mega58 entfernt das Substanztor JEDEN Kandidaten mit `substanz < MIN_ANSWER_SUBSTANCE`,
//      und zwar VOR der Bestwertbildung (`keywordSelect` und `rankCandidates`, beide gleich).
//   2. Für jeden Kandidaten gilt `substanz <= wert` — der Substanzwert ist derselbe Schnitt ohne die
//      nicht substanztragenden Token, also nie größer.
//   3. Aus 1 und 2 folgt: jeder Kandidat, der den Bestwert überhaupt bilden darf, hat `wert >= 2`.
//      Damit ist `best >= MIN_ANSWER_SUBSTANCE`, und der entfernte Zweig konnte nie greifen. Ist die
//      Menge leer, wird die Funktion gar nicht aufgerufen.
//
// Schritt 3 ist eine Behauptung über den ZUSTAND, den die Funktion sieht — nicht über die Funktion.
// Deshalb wird er am Produkt gemessen: über eine erschöpfende Wertetafel echter Kandidatenmengen,
// beide Auswahlwege, mit einer Zusicherung auf dem Bestwert selbst.
import { describe, expect, it } from "vitest";
import type { KnowledgeRef } from "../../services/reasoner";
import { MIN_ANSWER_SUBSTANCE, keywordSelect, rankCandidates } from "../../services/reasoner";
// BLOCK I: beide Regeln sind INNERE Regeln und stehen nicht mehr in der öffentlichen Modulfläche.
import {
  meetsAnswerSubstance,
  meetsRelevanceThreshold,
  refMatchText,
} from "../../services/reasoner/src/provider";

function ref(id: string, title: string, statement: string): KnowledgeRef {
  return { id, title, statement, status: "validiert", trust: 70 };
}

// Vier Fachwörter, aus denen sich Kandidaten mit GENAU n gemeinsamen Inhaltstoken bauen lassen.
const WOERTER = ["ventil", "überdruck", "filter", "pumpe"] as const;
const FRAGE = `Was gilt für ${WOERTER.join(" und ")}?`;

// Ein Kandidat, der genau die ersten `n` Fachwörter mit der Frage teilt — und sonst nichts.
function kandidatMit(n: number, id: string): KnowledgeRef {
  return ref(id, "Hinweis", `Regel zu ${WOERTER.slice(0, n).join(" und ")}.`);
}

describe("AUFTRAG-mega59 I — der entfernte Zweig war unerreichbar", () => {
  it("die Fixture stellt die Überschneidungen wirklich her — sonst misst alles darunter nichts", () => {
    // Ohne diese Vorkalibrierung wären die Fälle unten auch dann grün, wenn `kandidatMit(1, …)` in
    // Wahrheit drei Wörter teilte. Der Bau der Menge ist hier der Prüfling, nicht die Absicht.
    for (let n = 1; n <= WOERTER.length; n++) {
      const ranked = rankCandidates(FRAGE, [kandidatMit(n, `k${n}`)]);
      if (n < MIN_ANSWER_SUBSTANCE) {
        // Ein einziges geteiltes Fachwort: das Tor entfernt den Kandidaten, die Menge ist leer.
        expect(ranked, `n=${n}`).toEqual([]);
      } else {
        expect(ranked, `n=${n}`).toHaveLength(1);
        expect(ranked[0]?.keywordScore, `n=${n}`).toBe(n);
      }
    }
  });

  it("der BESTWERT erreicht in JEDER nicht-leeren Auswahl mindestens die Mindestsubstanz", () => {
    // Das ist der Kern des Beweises. Über alle Teilmengen der Stärken 0…4 (erschöpfend, 2^5
    // Kombinationen inklusive der leeren) gilt: entweder ist die Auswahl leer — dann wird
    // `meetsRelevanceThreshold` nie aufgerufen — oder ihr Bestwert liegt bei mindestens zwei. Ein
    // Bestwert unter der Schwelle kommt nicht vor, und genau darauf hat der entfernte Zweig gewartet.
    const STAERKEN = [0, 1, 2, 3, 4];
    let geprueft = 0;
    for (let maske = 0; maske < 1 << STAERKEN.length; maske++) {
      const menge = STAERKEN.filter((_, i) => (maske & (1 << i)) !== 0).map((n) =>
        kandidatMit(n, `k${n}`),
      );
      const ranked = rankCandidates(FRAGE, menge);
      const ausgewaehlt = keywordSelect(FRAGE, menge);
      // Beide Auswahlwege sind sich einig — sonst läge die Regel faktisch nur in einem von beiden.
      expect(new Set(ausgewaehlt.map((r) => r.id)), `maske=${maske}`).toEqual(
        new Set(ranked.map((x) => x.ref.id)),
      );
      if (ranked.length === 0) {
        continue;
      }
      geprueft += 1;
      const best = Math.max(...ranked.map((x) => x.keywordScore));
      expect(best, `maske=${maske}: Bestwert unter der Mindestsubstanz`).toBeGreaterThanOrEqual(
        MIN_ANSWER_SUBSTANCE,
      );
      // Und der entfernte Zweig hätte auf DIESEM Bestwert nie gegriffen.
      expect(meetsAnswerSubstance(best), `maske=${maske}`).toBe(true);
    }
    // Gegenprobe zur Vakuität: es gab wirklich nicht-leere Auswahlen (sonst wäre die Schleife hohl).
    expect(geprueft, "keine einzige nicht-leere Auswahl geprüft").toBeGreaterThan(10);
  });

  it("die beiden Regeln sind jetzt GETRENNT — jede antwortet auf genau eine Frage", () => {
    // `meetsRelevanceThreshold` kennt die Mindestsubstanz nicht mehr: bei Bestwert 1 lässt sie den
    // Ein-Wort-Treffer durch, weil `1 * 2 > 1`. Das ist RICHTIG und harmlos — dieser Zustand ist
    // unerreichbar (Fall darüber), und die absolute Regel steht davor, nicht darin.
    expect(meetsRelevanceThreshold(1, 1)).toBe(true);
    expect(meetsRelevanceThreshold(1, 0)).toBe(true);
    // …und die absolute Regel kennt die relative nicht: sie sieht EINE Zahl, nicht zwei.
    expect(meetsAnswerSubstance(1)).toBe(false);
    expect(meetsAnswerSubstance(MIN_ANSWER_SUBSTANCE)).toBe(true);
  });

  it("das PRODUKTVERHALTEN ist unverändert: ein Ein-Wort-Treffer trägt weiterhin nichts", () => {
    // Die eigentliche Zusage dieses Blocks, am Verhalten statt an der Funktion. Ein Kandidat mit
    // genau einem gemeinsamen Fachwort ist weiterhin eine Wissenslücke — jetzt aber, weil das Tor
    // ihn entfernt, und nicht, weil eine relative Regel nebenbei absolut geprüft hätte.
    const schwach = kandidatMit(1, "schwach");
    expect(rankCandidates(FRAGE, [schwach])).toEqual([]);
    expect(keywordSelect(FRAGE, [schwach])).toEqual([]);
    // Auch neben einem starken Treffer bleibt er draußen (er scheitert am Tor, nicht erst relativ).
    const stark = kandidatMit(4, "stark");
    expect(rankCandidates(FRAGE, [schwach, stark]).map((x) => x.ref.id)).toEqual(["stark"]);
    expect(keywordSelect(FRAGE, [schwach, stark]).map((r) => r.id)).toEqual(["stark"]);
  });

  it("die öffentliche Modulfläche führt die beiden Testhelfer NICHT mehr", async () => {
    // Der zweite Teil von BLOCK I, als Wächter statt als Zusage: ein Re-Export in index.ts ist ein
    // Versprechen an jeden Aufrufer. Für zwei innere Regeln ohne Aufrufer außerhalb von provider.ts
    // war das ein Versprechen, das niemand geben wollte. Wer es zurückholt, wird hier rot.
    const barrel = (await import("../../services/reasoner")) as Record<string, unknown>;
    expect(Object.keys(barrel)).not.toContain("meetsRelevanceThreshold");
    expect(Object.keys(barrel)).not.toContain("meetsAnswerSubstance");
    // Und die Gegenprobe, damit der Wächter nicht bloß einen Tippfehler misst: `refMatchText` fährt
    // dasselbe Muster und fehlt dort ebenso, während `MIN_ANSWER_SUBSTANCE` bewusst öffentlich ist.
    expect(Object.keys(barrel)).not.toContain("refMatchText");
    expect(Object.keys(barrel)).toContain("MIN_ANSWER_SUBSTANCE");
    expect(refMatchText({ id: "x", title: "T", statement: "S", status: "offen", trust: 0 })).toBe(
      "T S",
    );
  });
});
