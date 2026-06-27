import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  reviewSignals,
  sortByReviewPriority,
  trustBand,
} from "../../apps/web/src/lib/reviewSignals";

function ko(o: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "ko-1",
    title: "KO",
    statement: "S",
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
    ...o,
  };
}

describe("SCRUM-249: reviewSignals", () => {
  it("trustBand: <40 low, 40–69 mid, ≥70 high", () => {
    expect(trustBand(0)).toBe("low");
    expect(trustBand(39)).toBe("low");
    expect(trustBand(40)).toBe("mid");
    expect(trustBand(69)).toBe("mid");
    expect(trustBand(70)).toBe("high");
    expect(trustBand(100)).toBe("high");
  });

  it("leitet Status/Trust/Version/Needed aus echten Feldern ab", () => {
    const s = reviewSignals(ko({ trust: 80, version: 3, neededValidations: 2 }));
    expect(s).toMatchObject({
      status: "offen",
      trust: 80,
      trustBand: "high",
      version: 3,
      needed: 2,
      assigned: false,
      authorTransferred: false,
    });
  });

  it("erkennt Zuweisung (→ pruefung) und Autor-Transfer", () => {
    const assigned = reviewSignals(ko({ assignments: ["u-2"] }));
    expect(assigned.assigned).toBe(true);
    expect(assigned.status).toBe("pruefung");

    const transferred = reviewSignals(ko({ originalAuthor: "u-1", author: "u-2" }));
    expect(transferred.authorTransferred).toBe(true);
  });

  it("sortByReviewPriority: Autor-Transfer zuerst, dann niedrigster Trust", () => {
    const a = ko({ id: "a", title: "A", trust: 60 });
    const b = ko({ id: "b", title: "B", trust: 10 });
    const c = ko({ id: "c", title: "C", trust: 90, author: "u-2" }); // transferiert
    expect(sortByReviewPriority([a, b, c]).map((k) => k.id)).toEqual(["c", "b", "a"]);
  });

  it("ist deterministisch und verwirft nichts (leere Liste → leer)", () => {
    expect(sortByReviewPriority([])).toEqual([]);
    const items = [ko({ id: "1" }), ko({ id: "2" })];
    expect(sortByReviewPriority(items)).toHaveLength(2);
    expect(sortByReviewPriority(items).map((k) => k.id)).toEqual(
      sortByReviewPriority(items).map((k) => k.id),
    );
  });
});
