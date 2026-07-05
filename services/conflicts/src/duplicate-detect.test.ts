import { describe, expect, it } from "vitest";
import type { DetectSubject } from "./detect";
import {
  DUP_MIN_CONFIDENCE,
  type OverlapVerdict,
  decideFromOverlapVerdict,
  deterministicOverlapDecision,
  exhaustiveOverlapCandidacy,
  lexicalOverlapScore,
  overlapCandidacy,
  overlapPairKey,
  overlapScorePercent,
  relationCreatesEntry,
  titleSimilarity,
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
  it("lexicalOverlapScore: leere Felder verwässern nicht (Renormalisierung)", () => {
    // Titel identisch, Aussage nahezu gleich, Bedingungen/Maßnahmen beidseitig leer → hoher Score.
    const score = lexicalOverlapScore(a, bNearIdentical);
    expect(score).toBeGreaterThan(0.85);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("fremdes Thema → niedriger Score", () => {
    expect(lexicalOverlapScore(a, cUnrelated)).toBeLessThan(0.45);
  });

  it("overlapCandidacy: ≥0,85 deterministisch · mittel → Modell · niedrig → keiner", () => {
    expect(overlapCandidacy(0.9, 1)).toBe("deterministic");
    expect(overlapCandidacy(0.6, 0.3)).toBe("model");
    expect(overlapCandidacy(0.2, 0.2)).toBe("none");
    // Gleicher Titel, wenig Textdeckung → trotzdem Modell-Kandidat (klassisches Duplikat-Muster).
    expect(overlapCandidacy(0.3, 0.85)).toBe("model");
  });

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

  it("overlapScorePercent + titleSimilarity liefern ehrliche Anzeigewerte", () => {
    expect(overlapScorePercent(0.723)).toBe(72);
    expect(titleSimilarity(a, bNearIdentical)).toBe(1);
  });
});
