import { describe, expect, it } from "vitest";
import {
  type ConflictVerdict,
  type DetectSubject,
  coreText,
  decideFromVerdict,
  quoteFound,
  quotesVerbatim,
  relationToType,
  selectCandidates,
  trigramSimilarity,
} from "./detect";

function subject(overrides: Partial<DetectSubject> = {}): DetectSubject {
  return {
    refId: "ko-a",
    title: "Dienstwagen-Farbe",
    statement: "Wir bestellen alle Dienstwagen in der Farbe blau.",
    conditions: [],
    measures: [],
    category: "Allgemein",
    tags: [],
    asset: null,
    ...overrides,
  };
}

const koBlau = subject({ refId: "ko-blau" });
const koRot = subject({
  refId: "ko-rot",
  statement: "Wir bestellen alle Dienstwagen in der Farbe rot.",
});

function verdict(overrides: Partial<ConflictVerdict> = {}): ConflictVerdict {
  return {
    relation: "widerspruch",
    older: null,
    confidence: 0.95,
    begruendung: "Beide legen eine andere verbindliche Dienstwagen-Farbe fest.",
    zitat_a: "Wir bestellen alle Dienstwagen in der Farbe blau.",
    zitat_b: "Wir bestellen alle Dienstwagen in der Farbe rot.",
    ...overrides,
  };
}

describe("Berater-Konzept 04.07. (Stufe 2): Erkennungskern", () => {
  it("coreText fasst Kernfelder zusammen (K0-2), ignoriert Leeres", () => {
    const text = coreText(
      subject({ statement: "Aussage.", conditions: ["Bedingung X"], measures: ["", "Maßnahme Y"] }),
    );
    expect(text).toContain("Aussage.");
    expect(text).toContain("Bedingung X");
    expect(text).toContain("Maßnahme Y");
  });

  it("relationToType bildet nur modell-sichere Auto-Typen ab (doppelung noch nicht)", () => {
    expect(relationToType("widerspruch")).toBe("truth");
    expect(relationToType("ueberholt")).toBe("temporal");
    expect(relationToType("doppelung")).toBeNull();
    expect(relationToType("kein_konflikt")).toBeNull();
    expect(relationToType("unsicher")).toBeNull();
  });

  it("Firmenwagen sind Kandidaten füreinander (gleiche Kategorie + hohe Textnähe)", () => {
    const candidates = selectCandidates(koRot, [
      koBlau,
      subject({
        refId: "fremd",
        title: "Kantine",
        statement: "Das Mittagessen kostet 5 Euro.",
        category: "Verpflegung",
      }),
    ]);
    expect(candidates.map((c) => c.refId)).toContain("ko-blau");
    expect(candidates.map((c) => c.refId)).not.toContain("fremd");
  });

  it("selectCandidates deckelt auf cap (O(N·k))", () => {
    const pool = Array.from({ length: 20 }, (_, i) =>
      subject({ refId: `ko-${i}`, statement: "Wir bestellen alle Dienstwagen in der Farbe grün." }),
    );
    expect(selectCandidates(koRot, pool, 8)).toHaveLength(8);
  });

  it("Firmenwagen-Fall (Abnahme 9.1): Widerspruch mit belegten Zitaten → truth-Konflikt", () => {
    const decision = decideFromVerdict(verdict(), coreText(koBlau), coreText(koRot));
    expect(decision.create).toBe(true);
    expect(decision.type).toBe("truth");
    expect(decision.reason).toBe("created");
  });

  it("Halluzinations-Wächter (G-2): nicht wörtliches Zitat → kein Konflikt", () => {
    const bad = verdict({ zitat_b: "Alle Fahrzeuge müssen grün lackiert werden." });
    expect(quotesVerbatim(bad, coreText(koBlau), coreText(koRot))).toBe(false);
    const decision = decideFromVerdict(bad, coreText(koBlau), coreText(koRot));
    expect(decision.create).toBe(false);
    expect(decision.reason).toBe("hallucination");
  });

  it("R-1117: sinnverändernde Abweichung vom Zitat → hallucination", () => {
    const core = "Druck\nSet pressure to 5 bar.";
    for (const zitat of ["1.5", "15", ".5 bar", ",5", "-5", "+5", "5%", "5.0", "to .5"]) {
      expect(quoteFound(zitat, core), zitat).toBe(false);
      const decision = decideFromVerdict(verdict({ zitat_a: zitat }), core, coreText(koRot));
      expect(decision.reason, zitat).toBe("hallucination");
    }
    expect(quoteFound("1,5 bar", "Set pressure to 1–5 bar.")).toBe(false);
    expect(quoteFound("-8 °C", "Lagern bei 8 °C.")).toBe(false);
    expect(quoteFound("8 °C", "Lagern bei -8 °C.")).toBe(false);
    expect(quoteFound("beträgt 1", "Der Druck beträgt 15 bar.")).toBe(false);
    expect(quoteFound("beträgt 1", "Der Druck beträgt 1–5 bar.")).toBe(false);
    expect(quoteFound("beträgt 1", "Der Druck beträgt 1.5 bar.")).toBe(false);
    expect(quoteFound("Cut to 5″.", "Cut to 5′.")).toBe(false);
    expect(quoteFound("bar", "Das Fass (barrel) ist leer.")).toBe(false);
    expect(quoteFound("", core)).toBe(false);
    expect(quoteFound("„ “", core)).toBe(false);
  });

  it("R-1117: echte Zitate bleiben belegt (Kontrollfall, Typografie, freistehender Rand)", () => {
    const core = "Druck\nSet pressure to 5 bar.";
    expect(quoteFound("5 bar", core)).toBe(true);
    const decision = decideFromVerdict(verdict({ zitat_a: "5 bar" }), core, coreText(koRot));
    expect(decision.create).toBe(true);
    expect(quoteFound("„Set pressure to 5 bar.“", core)).toBe(true);
    expect(quoteFound('"5 bar"', core)).toBe(true);
    expect(quoteFound("… to 5 bar", core)).toBe(true);
    expect(quoteFound('Schalter "Notaus" drücken', "Den Schalter „Notaus“ drücken.")).toBe(true);
    expect(quoteFound("Druck - nicht", "Druck – nicht Temperatur – prüfen.")).toBe(true);
    expect(quoteFound("Warten... dann", "Warten… dann 5 bar.")).toBe(true);
    expect(quoteFound("Cut to 5′.", "Cut to 5′.")).toBe(true);
  });

  it("Unter der Schwelle (confidence < 0.7) → kein Konflikt", () => {
    const decision = decideFromVerdict(
      verdict({ confidence: 0.4 }),
      coreText(koBlau),
      coreText(koRot),
    );
    expect(decision.create).toBe(false);
    expect(decision.reason).toBe("below_threshold");
  });

  it("kein_konflikt (unterschiedlicher Geltungsbereich) → kein Konflikt", () => {
    const decision = decideFromVerdict(
      verdict({ relation: "kein_konflikt" }),
      coreText(koBlau),
      coreText(koRot),
    );
    expect(decision.create).toBe(false);
    expect(decision.reason).toBe("no_conflict");
  });

  it("unsicher → kein Konflikt (still, kein Verdachts-Zwischenschritt)", () => {
    const decision = decideFromVerdict(
      verdict({ relation: "unsicher", confidence: 0.9 }),
      coreText(koBlau),
      coreText(koRot),
    );
    expect(decision.create).toBe(false);
    expect(decision.reason).toBe("no_conflict");
  });

  it("trigramSimilarity: blau vs. rot sind textnah, aber nicht identisch", () => {
    const sim = trigramSimilarity(koBlau.statement, koRot.statement);
    expect(sim).toBeGreaterThan(0.5);
    expect(sim).toBeLessThan(1);
    expect(trigramSimilarity("abc", "abc")).toBe(1);
  });
});
