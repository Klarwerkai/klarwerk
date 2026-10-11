// ================================================================================================
// R-1643 · DIE ARGUMENTATIONSKETTE KOMMT AUS DER GEMESSENEN DECKUNG (Ben, Nacharbeit 2).
// ================================================================================================
//
// Befund: die exportierten `steps` sind die herangezogenen Kandidaten (Titel + Kernaussage), direkt
// aus `relevant` gebaut — keine Begründung. Die Begründung, die das Haus WIRKLICH hat, ist die
// Zitatdeckung: `pruefeDeckung` misst je Aussage des Antworttexts, welche markierte Quelle sie im
// Wortlaut enthält, bevor ein Modelltext hinausgeht. `argumentationAus` gibt genau diese Zuordnung
// als Kette aus; die Antwortwege liefern sie im Feld `argumentation`.
//
// Die Fälle nutzen dieselben Quellen und Wortlaute wie `tests/ask/job2659-eine-marke-ist-kein-beleg`
// (M3b, P1, P2), deren Deckungsverhalten dort belegt ist.
import { describe, expect, it } from "vitest";
import type { KnowledgeRef, ModelClient } from "../../services/reasoner";
import { DeterministicProvider } from "../../services/reasoner/src/provider";
import {
  ModelProvider,
  argumentationAus,
  pruefeDeckung,
} from "../../services/reasoner/src/provider-model";

function ref(id: string, title: string, statement: string): KnowledgeRef {
  return { id, title, statement, status: "validiert", trust: 90 };
}

function fake(text: string): ModelClient {
  return { name: "fake", complete: async () => text };
}

const QUELLE = ref(
  "ventil",
  "Ventil X bei Überdruck schließen",
  "Bei Überdruck über 6 bar Ventil X schließen",
);
const ZWEITE = ref("wartung", "Ventil X Wartung", "Ventil X bei Überdruck einmal jährlich prüfen");
const KANDIDATEN = [QUELLE, ZWEITE];

describe("R-1643 · argumentationAus — Aussage für Aussage mit ihrem Beleg", () => {
  it("zwei gedeckte Aussagen aus zwei Quellen → zwei Glieder, Marken entfernt, Beleg je Glied", () => {
    const befund = pruefeDeckung(
      "Bei Überdruck über 6 bar Ventil X schließen [1]. Ventil X bei Überdruck einmal jährlich prüfen [2].",
      KANDIDATEN,
    );
    expect(befund.gedeckt).toBe(true);
    const kette = argumentationAus(befund);
    expect(kette).toHaveLength(2);
    expect(kette[0]).toEqual({
      aussage: "Bei Überdruck über 6 bar Ventil X schließen",
      quellen: ["ventil"],
      belegtDurch: "ventil",
    });
    expect(kette[1]).toEqual({
      aussage: "Ventil X bei Überdruck einmal jährlich prüfen",
      quellen: ["wartung"],
      belegtDurch: "wartung",
    });
    // Keine Fußnotenmarke in einer Aussage.
    for (const glied of kette) {
      expect(glied.aussage).not.toMatch(/\[\d/);
    }
  });

  it("GEGENPROBE: eine nicht gedeckte Antwort hat KEINE Kette aus dem Modelltext", () => {
    const befund = pruefeDeckung("Bei Überdruck über 6 bar Ventil X tauschen [1].", KANDIDATEN);
    expect(befund.gedeckt).toBe(false);
    expect(argumentationAus(befund)).toEqual([]);
  });
});

describe("R-1643 · die Antwortwege liefern die Kette mit", () => {
  const Q = [ref("v", "Ventil", "Ventil bei Überdruck schließen.")];

  it("Modelltext gedeckt (job2659 P2): ein Glied, belegt durch die markierte Quelle", async () => {
    const ergebnis = await new ModelProvider(fake("Ventil bei Überdruck schließen [1]")).answer(
      "Was tun bei Überdruck am Ventil?",
      Q,
    );
    expect(ergebnis.answer).toBe("Ventil bei Überdruck schließen [1]");
    expect(ergebnis.argumentation).toEqual([
      { aussage: "Ventil bei Überdruck schließen", quellen: ["v"], belegtDurch: "v" },
    ]);
  });

  it("Rückfall (job2659 P1): der ausgegebene Quellenwortlaut ist das Glied — nicht der verworfene Modelltext", async () => {
    const ergebnis = await new ModelProvider(
      fake("Ventil bei Überdruck nicht schließen [1]"),
    ).answer("Was tun bei Überdruck am Ventil?", Q);
    expect(ergebnis.answer).toBe("Ventil bei Überdruck schließen.");
    expect(ergebnis.argumentation).toEqual([
      { aussage: "Ventil bei Überdruck schließen.", quellen: ["v"], belegtDurch: "v" },
    ]);
    expect(JSON.stringify(ergebnis.argumentation)).not.toContain("nicht");
  });

  it("deterministischer Weg: die Antwort IST der Wortlaut der besten Quelle — ein Glied", async () => {
    const ergebnis = await new DeterministicProvider().answer(
      "Was tun bei Überdruck am Ventil?",
      Q,
    );
    expect(ergebnis.answered).toBe(true);
    expect(ergebnis.argumentation).toEqual([
      { aussage: ergebnis.answer, quellen: ergebnis.citedSources, belegtDurch: "v" },
    ]);
  });
});
