import { describe, expect, it } from "vitest";
import type { DetectSubject } from "./detect";
import {
  DUP_MIN_CONFIDENCE,
  type OverlapVerdict,
  decideFromOverlapVerdict,
  deterministicOverlapDecision,
  exhaustiveOverlapCandidacy,
  lexicalOverlapScore,
  overlapPairKey,
  relationCreatesEntry,
  verifiedAspects,
} from "./duplicate-detect";

function subject(overrides: Partial<DetectSubject> = {}): DetectSubject {
  return {
    refId: "ko-a",
    title: "Pumpe entlüften",
    statement: "Nach dem Anfahren 10 Sekunden warten, dann die Pumpe entlüften.",
    conditions: [],
    measures: [],
    category: "Wartung",
    tags: [],
    asset: null,
    ...overrides,
  };
}

const a = subject({ refId: "ko-a" });
const bNearIdentical = subject({
  refId: "ko-b",
  statement: "Nach dem Anfahren 10 Sekunden warten und dann die Pumpe entlüften.",
});
const cUnrelated = subject({
  refId: "ko-c",
  title: "Kantinenpreise",
  statement: "Das Mittagessen kostet 5 Euro.",
  category: "Verpflegung",
});

function verdict(overrides: Partial<OverlapVerdict> = {}): OverlapVerdict {
  return {
    beziehung: "teilweise",
    aspects: [
      {
        beschreibung: "Beide nennen 10 Sekunden Wartezeit",
        zitatA: "10 Sekunden warten",
        zitatB: "10 Sekunden warten",
      },
    ],
    nurInA: "",
    nurInB: "",
    empfehlung: "zusammenfuehren_pruefen",
    confidence: 0.9,
    begruendung: "Gemeinsamer Kern zur Wartezeit.",
    ...overrides,
  };
}

describe("Berater-Konzept Duplikate 04.07. (Stufe D1): Erkennungskern", () => {
  it.each(["", "Anderer Dokumentname"])(
    "gleicher nichtleerer Inhalt bleibt bei Anfragetitel '%s' deterministisch und symmetrisch",
    (title) => {
      const other = subject({ refId: "ko-b", title });
      expect(lexicalOverlapScore(a, other)).toBe(1);
      expect(lexicalOverlapScore(other, a)).toBe(1);
    },
  );

  it("gleiche befüllte Fachfelder tragen die Titelunabhängigkeit ebenfalls", () => {
    const stored = subject({ conditions: ["Anlage steht still."], measures: ["Ventil öffnen."] });
    expect(lexicalOverlapScore(stored, { ...stored, title: "" })).toBe(1);
  });

  it.each(["conditions", "measures"] as const)(
    "andere oder fehlende %s werden durch identische Aussage nicht übergangen",
    (field) => {
      const stored = subject({ [field]: ["Ventil vollständig öffnen."] });
      for (const values of [[], ["Ventil vollständig schließen."]]) {
        const other = subject({ title: "", [field]: values });
        const score = lexicalOverlapScore(stored, other);
        expect(exhaustiveOverlapCandidacy(score)).toBe("model");
        expect(lexicalOverlapScore(other, stored)).toBe(score);
      }
    },
  );

  it("leere Eingaben und bloß gleiche Schlagwörter tragen keinen neuen Treffer", () => {
    const empty = subject({ title: "", statement: "", tags: ["Pumpe", "Wartung"] });
    expect(lexicalOverlapScore(empty, empty)).toBe(0);
    expect(exhaustiveOverlapCandidacy(lexicalOverlapScore(empty, a))).toBe("model");
    expect(
      exhaustiveOverlapCandidacy(lexicalOverlapScore(a, { ...cUnrelated, tags: a.tags })),
    ).toBe("model");
  });

  it("gleicher Titel mit fremdem Inhalt bleibt Modellfall", () => {
    expect(
      exhaustiveOverlapCandidacy(lexicalOverlapScore(a, { ...cUnrelated, title: a.title })),
    ).toBe("model");
  });

  it("bloß ähnliche Aussagen behalten das Titelgewicht und benötigen ohne Titel das Modell", () => {
    const withoutTitle = { ...bNearIdentical, title: "" };
    expect(exhaustiveOverlapCandidacy(lexicalOverlapScore(a, withoutTitle))).toBe("model");
    expect(lexicalOverlapScore(a, bNearIdentical)).toBeGreaterThan(
      lexicalOverlapScore(a, withoutTitle),
    );
  });

  it("lexicalOverlapScore: leere Felder verwässern nicht (Renormalisierung)", () => {
    // Titel identisch, Aussage nahezu gleich, Bedingungen/Maßnahmen beidseitig leer → hoher Score.
    const score = lexicalOverlapScore(a, bNearIdentical);
    expect(score).toBeGreaterThan(0.85);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("fremdes Thema → niedriger Score", () => {
    expect(lexicalOverlapScore(a, cUnrelated)).toBeLessThan(0.45);
  });

  // R-1349: der Fall zur dreistufigen `overlapCandidacy` ist mit ihr entfallen — sie ist seit
  // „jeder gegen jeden" (Pedi 04.07.) durch `exhaustiveOverlapCandidacy` ersetzt (Fall darunter).
  it("exhaustiveOverlapCandidacy (jeder gegen jeden): ≥0,85 deterministisch, sonst IMMER Modell", () => {
    // Pedi 04.07.: kein „none" mehr — auch weit entfernte Paare gehen an die inhaltliche KI-Prüfung.
    expect(exhaustiveOverlapCandidacy(0.9)).toBe("deterministic");
    expect(exhaustiveOverlapCandidacy(0.6)).toBe("model");
    expect(exhaustiveOverlapCandidacy(0.2)).toBe("model");
    expect(exhaustiveOverlapCandidacy(0)).toBe("model");
  });

  it("Anzeige-Schwelle startet bei 0,5 (Pedi 04.07.): confidence 0,6 legt jetzt an", () => {
    expect(DUP_MIN_CONFIDENCE).toBe(0.5);
    const coreA = "10 Sekunden warten, dann entlüften.";
    const coreB = "10 Sekunden warten und entlüften.";
    // 0,6 lag früher unter der Schwelle (0,7) → jetzt darüber (0,5) → Eintrag entsteht.
    const d = decideFromOverlapVerdict(verdict({ confidence: 0.6 }), coreA, coreB);
    expect(d.create).toBe(true);
    expect(d.reason).toBe("created_model");
  });

  it("wortgleiches Duplikat → deterministischer Eintrag identisch/zusammenfuehren (ohne Modell)", () => {
    const d = deterministicOverlapDecision();
    expect(d.create).toBe(true);
    expect(d.relation).toBe("identisch");
    expect(d.recommendation).toBe("zusammenfuehren");
    expect(d.reason).toBe("created_deterministic");
  });

  it("Paraphrase (Modell teilweise, belegter Aspekt) → Eintrag teilweise", () => {
    const coreA = "10 Sekunden warten, dann entlüften.";
    const coreB = "10 Sekunden warten und entlüften.";
    const d = decideFromOverlapVerdict(verdict(), coreA, coreB);
    expect(d.create).toBe(true);
    expect(d.relation).toBe("teilweise");
    expect(d.aspects).toHaveLength(1);
    expect(d.reason).toBe("created_model");
  });

  it("G-2: nicht wörtlich belegter Aspekt wird gestrichen; null belegte → kein Eintrag", () => {
    const coreA = "10 Sekunden warten.";
    const coreB = "10 Sekunden warten.";
    const halluziniert = verdict({
      aspects: [{ beschreibung: "erfunden", zitatA: "gibt es nicht", zitatB: "auch nicht" }],
    });
    expect(verifiedAspects(halluziniert, coreA, coreB)).toHaveLength(0);
    const d = decideFromOverlapVerdict(halluziniert, coreA, coreB);
    expect(d.create).toBe(false);
    expect(d.reason).toBe("no_verified_aspect");
  });

  it("R-1117: geteilte Zitate gelten nur als lückenlose Tokenfolge ('.5 bar' ≠ '5 bar')", () => {
    const coreA = "Kesseldruck\nSet pressure to 5 bar.";
    const coreB = "Before start, set pressure to 5 bar and open valve V2.";
    const unecht = { beschreibung: "Solldruck", zitatA: ".5 bar", zitatB: ".5 bar" };
    const echt = { beschreibung: "Solldruck", zitatA: "5 bar", zitatB: "„5 bar“" };
    expect(verifiedAspects(verdict({ aspects: [unecht, echt] }), coreA, coreB)).toEqual([echt]);
    const nurUnecht = decideFromOverlapVerdict(verdict({ aspects: [unecht] }), coreA, coreB);
    expect(nurUnecht.create).toBe(false);
    expect(nurUnecht.reason).toBe("no_verified_aspect");
    const zahl = { beschreibung: "Wartezeit", zitatA: "Sekunden warten", zitatB: "1 Sekunden" };
    const zahlVerdict = verdict({ aspects: [zahl] });
    expect(verifiedAspects(zahlVerdict, "10 Sekunden warten.", "10 Sekunden.")).toEqual([]);
  });

  it("R-1117 BEN-1: Doppelprime 'Cut to 5″.' belegt keinen Aspekt zu 'Cut to 5′.'", () => {
    const coreA = "Zuschnitt\nCut to 5′.";
    const coreB = "Cut to 5′.";
    const beideFalsch = { beschreibung: "Maß", zitatA: "Cut to 5″.", zitatB: "Cut to 5″." };
    const nurAFalsch = { beschreibung: "Maß", zitatA: "Cut to 5″.", zitatB: "Cut to 5′." };
    const nurBFalsch = { beschreibung: "Maß", zitatA: "Cut to 5′.", zitatB: "Cut to 5″." };
    const echt = { beschreibung: "Maß", zitatA: "Cut to 5′.", zitatB: "Cut to 5′." };
    const alle = verdict({ aspects: [beideFalsch, nurAFalsch, nurBFalsch, echt] });
    expect(verifiedAspects(alle, coreA, coreB)).toEqual([echt]);
    const unbelegt = verdict({ aspects: [beideFalsch, nurAFalsch, nurBFalsch] });
    expect(verifiedAspects(unbelegt, coreA, coreB)).toEqual([]);
    const d = decideFromOverlapVerdict(unbelegt, coreA, coreB);
    expect(d.create).toBe(false);
    expect(d.reason).toBe("no_verified_aspect");
    const kontrolle = decideFromOverlapVerdict(verdict({ aspects: [echt] }), coreA, coreB);
    expect(kontrolle.create).toBe(true);
    expect(kontrolle.aspects).toEqual([echt]);
  });

  it("verwandt → kein automatischer Eintrag (related_only)", () => {
    const d = decideFromOverlapVerdict(verdict({ beziehung: "verwandt" }), "x", "y");
    expect(d.create).toBe(false);
    expect(d.reason).toBe("related_only");
  });

  it("verschieden/unsicher → kein Eintrag", () => {
    expect(decideFromOverlapVerdict(verdict({ beziehung: "verschieden" }), "x", "y").reason).toBe(
      "no_overlap",
    );
    expect(decideFromOverlapVerdict(verdict({ beziehung: "unsicher" }), "x", "y").reason).toBe(
      "no_overlap",
    );
  });

  it("unter der Sicherheitsschwelle → kein Eintrag", () => {
    const coreA = "10 Sekunden warten.";
    const d = decideFromOverlapVerdict(verdict({ confidence: 0.4 }), coreA, coreA);
    expect(d.create).toBe(false);
    expect(d.reason).toBe("below_threshold");
  });

  it("relationCreatesEntry: nur die vier belegbaren Beziehungen", () => {
    expect(relationCreatesEntry("identisch")).toBe(true);
    expect(relationCreatesEntry("teilweise")).toBe(true);
    expect(relationCreatesEntry("verwandt")).toBe(false);
    expect(relationCreatesEntry("verschieden")).toBe(false);
  });

  it("overlapPairKey reihenfolgeunabhängig, eigener dup|-Namensraum", () => {
    expect(overlapPairKey("ko-b", "ko-a")).toBe(overlapPairKey("ko-a", "ko-b"));
    expect(overlapPairKey("ko-a", "ko-b")).toContain("dup|");
  });
  // R-1349: `overlapScorePercent` (Anzeigeprozent fürs Board) rief keine Fläche; der Fall ist mit
  // der Funktion entfallen.
});
