// WP-UX-WOW-1 U2/U3: ehrliche Beispiel-Chips — Antwort-Beispiele kommen aus dem ECHTEN validierten
// Bestand (Badge damit korrekt), dazu genau EINE bewusste Lücken-Frage; ohne validierten Bestand
// neutrale statische Beispiele OHNE Ergebnis-Behauptung. Zufall injizierbar (deterministische Tests).
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { ASK_CHIP_MAX_KOS, buildAskExampleChips } from "../../apps/web/src/lib/askExampleChips";
import { ASK_EXAMPLES } from "../../apps/web/src/lib/askExamples";

function ko(
  title: string,
  status: "offen" | "validiert",
  confidentiality?: string,
): KnowledgeObject {
  return {
    id: title,
    title,
    statement: `${title} — Aussage`,
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Wartung",
    tags: [],
    confidence: 50,
    trust: 10,
    status,
    version: 1,
    originalAuthor: "u1",
    author: "u1",
    neededValidations: 0,
    assignments: [],
    asset: null,
    ...(confidentiality !== undefined ? { confidentiality } : {}),
  } as unknown as KnowledgeObject;
}

describe("WP-UX-WOW-1 U2: buildAskExampleChips", () => {
  it("leitet Antwort-Chips NUR aus validierten KOs ab und hängt genau eine Lücken-Frage an", () => {
    const chips = buildAskExampleChips(
      [ko("Ventil entlasten", "validiert"), ko("Offener Beitrag", "offen")],
      () => 0,
    );
    expect(chips).toEqual([
      { kind: "ko", title: "Ventil entlasten" },
      { kind: "example", questionKey: "ask.example.dosing", expectation: "gap" },
    ]);
  });

  // WP-POLISH-CLOSE (bens Punkt 1): vertrauliche Titel erscheinen NIE als Chip (Sichtbarkeits-/
  // Egress-Kante — der Chip-Klick würde den Titel als Frage in den Ask-/Modellpfad geben).
  it("vertrauliche und streng vertrauliche validierte KOs erscheinen NIE als Chip", () => {
    const chips = buildAskExampleChips(
      [
        ko("Geheimrezeptur X", "validiert", "vertraulich"),
        ko("Kundenliste Y", "validiert", "streng_vertraulich"),
        ko("Ventil entlasten", "validiert"),
      ],
      () => 0,
    );
    expect(chips).toEqual([
      { kind: "ko", title: "Ventil entlasten" },
      { kind: "example", questionKey: "ask.example.dosing", expectation: "gap" },
    ]);
  });

  it("fail-safe: eine UNBEKANNTE Stufe gilt wie vertraulich (nie als Chip)", () => {
    const chips = buildAskExampleChips([ko("Unklare Stufe", "validiert", "geheim")], () => 0);
    // Kein Chip-tauglicher Bestand übrig → neutrale statische Beispiele.
    expect(chips.every((chip) => chip.kind === "example")).toBe(true);
  });

  it("das FEHLENDE Feld ist die dokumentierte intern-Codierung des Servers (Chip-tauglich) — nur explizit „intern“ und fehlend gelten als eindeutig nicht-vertraulich", () => {
    // Der Server materialisiert vertrauliche Stufen IMMER und „intern“ bewusst nie — fehlend ist
    // damit KEINE unklare Stufe, sondern der dokumentierte intern-Fall (s. confidentialityOf).
    const chips = buildAskExampleChips(
      [ko("Ohne Feld", "validiert"), ko("Explizit intern", "validiert", "intern")],
      () => 0,
    );
    expect(chips.filter((chip) => chip.kind === "ko").length).toBe(2);
  });

  it("wählt höchstens ASK_CHIP_MAX_KOS validierte KOs (ohne Duplikate)", () => {
    const many = ["A", "B", "C", "D", "E"].map((t) => ko(t, "validiert"));
    const chips = buildAskExampleChips(many, () => 0);
    const koChips = chips.filter((c) => c.kind === "ko");
    expect(koChips.length).toBe(ASK_CHIP_MAX_KOS);
    expect(new Set(koChips.map((c) => (c.kind === "ko" ? c.title : "")).values()).size).toBe(
      ASK_CHIP_MAX_KOS,
    );
    expect(chips[chips.length - 1]).toEqual({
      kind: "example",
      questionKey: "ask.example.dosing",
      expectation: "gap",
    });
  });

  it("ohne validierten Bestand: statische Beispiele NEUTRAL (keine Ergebnis-Behauptung)", () => {
    const chips = buildAskExampleChips([ko("Nur offen", "offen")], () => 0);
    expect(chips.length).toBe(ASK_EXAMPLES.length);
    for (const chip of chips) {
      expect(chip.kind).toBe("example");
      if (chip.kind === "example") {
        expect(chip.expectation).toBeNull();
      }
    }
  });

  it("die Zufallsquelle steuert die Auswahl (verschiedene Picks → verschiedene Titel)", () => {
    const many = ["A", "B", "C", "D"].map((t) => ko(t, "validiert"));
    const low = buildAskExampleChips(many, () => 0);
    const high = buildAskExampleChips(many, () => 0.99);
    expect(low[0]).not.toEqual(high[0]);
  });
});
