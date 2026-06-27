import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { scoreKo, searchLibrary } from "../../apps/web/src/lib/librarySearch";

function ko(overrides: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko-1",
    title: "Titel",
    statement: "Aussage",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 50,
    trust: 50,
    status: "offen",
    version: 1,
    originalAuthor: "u-1",
    author: "u-1",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-06-26T10:00:00.000Z",
    history: [],
    ...overrides,
  };
}

describe("SCRUM-245: librarySearch", () => {
  it("Titel-Treffer wiegt stärker als Text-Treffer", () => {
    const titleHit = ko({ id: "t", title: "Ventil prüfen", statement: "Routine." });
    const textHit = ko({ id: "x", title: "Routine", statement: "Ventil kontrollieren." });
    const ranked = searchLibrary([textHit, titleHit], "ventil");
    expect(ranked[0]?.ko.id).toBe("t"); // Titel-Match vor Text-Match
    expect(scoreKo(titleHit, "ventil").score).toBeGreaterThan(scoreKo(textHit, "ventil").score);
  });

  it("liefert nachvollziehbare Match-Gründe in Prioritätsreihenfolge", () => {
    const k = ko({
      title: "Ventil X",
      tags: ["ventil", "sicherheit"],
      statement: "Ventil schließen.",
    });
    const { matches } = scoreKo(k, "ventil");
    expect(matches).toEqual(["title", "tag", "text"]); // category/type treffen hier nicht
  });

  it("Tag/Kategorie/Typ sind zusätzliche Match-Signale", () => {
    const tagOnly = scoreKo(ko({ title: "X", statement: "Y", tags: ["pumpe"] }), "pumpe");
    expect(tagOnly.matches).toContain("tag");
    const catOnly = scoreKo(ko({ title: "X", statement: "Y", category: "Pumpenhaus" }), "pumpe");
    expect(catOnly.matches).toContain("category");
    const typeOnly = scoreKo(ko({ title: "X", statement: "Y", type: "technik" }), "technik");
    expect(typeOnly.matches).toContain("type");
  });

  it("Trust/Status nur als Tie-Breaker bei gleichem Score", () => {
    // Beide nur Text-Treffer (gleicher Score) → validiert + höherer Trust zuerst.
    const low = ko({ id: "low", statement: "ventil", status: "offen", trust: 10 });
    const high = ko({ id: "high", statement: "ventil", status: "validiert", trust: 90 });
    const ranked = searchLibrary([low, high], "ventil");
    expect(ranked.map((r) => r.ko.id)).toEqual(["high", "low"]);
  });

  it("leere/whitespace Query → Score 0, stabile Default-Ordnung (validiert/Trust/Titel), keine Match-Gründe", () => {
    const a = ko({ id: "a", title: "Beta", status: "offen", trust: 20 });
    const b = ko({ id: "b", title: "Alpha", status: "validiert", trust: 80 });
    const c = ko({ id: "c", title: "Gamma", status: "offen", trust: 60 });
    const ranked = searchLibrary([a, b, c], "   ");
    expect(ranked.every((r) => r.score === 0)).toBe(true);
    expect(ranked.every((r) => r.matches.length === 0)).toBe(true);
    // validiert zuerst (b), dann Trust desc (c=60 vor a=20).
    expect(ranked.map((r) => r.ko.id)).toEqual(["b", "c", "a"]);
  });

  it("verwirft nichts — Re-Rank erhält die vollständige Menge", () => {
    const items = [ko({ id: "1" }), ko({ id: "2" }), ko({ id: "3" })];
    expect(searchLibrary(items, "treffer-nirgends")).toHaveLength(3);
  });

  it("ist deterministisch (gleiche Eingabe → gleiche Reihenfolge)", () => {
    const items = [
      ko({ id: "1", title: "Ventil A", statement: "x" }),
      ko({ id: "2", title: "Ventil B", statement: "x" }),
    ];
    const r1 = searchLibrary(items, "ventil").map((r) => r.ko.id);
    const r2 = searchLibrary(items, "ventil").map((r) => r.ko.id);
    expect(r1).toEqual(r2);
  });
});
