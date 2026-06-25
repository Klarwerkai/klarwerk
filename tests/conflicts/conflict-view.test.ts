import { describe, expect, it } from "vitest";
import type { Conflict, KnowledgeObject } from "../../apps/web/src/api/types";
import { conflictKoPair, resolutionEffect } from "../../apps/web/src/lib/conflictView";

const ko = (id: string): KnowledgeObject =>
  ({
    id,
    title: `Titel ${id}`,
    statement: "",
    conditions: [],
    measures: [],
    type: "technik",
    category: "",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "a",
    author: "a",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01",
    history: [],
  }) as KnowledgeObject;

const conflict = (p: Partial<Conflict>): Conflict =>
  ({
    id: "c1",
    koA: "K1",
    koB: "K2",
    type: "truth",
    description: "Widerspruch",
    status: "offen",
    secondOpinion: null,
    decidedBy: null,
    decision: null,
    createdAt: "2026-01-01",
    ...p,
  }) as Conflict;

describe("SCRUM-127: KO-Gegenüberstellung", () => {
  it("löst koA/koB zu echten Wissensobjekten auf", () => {
    const pair = conflictKoPair(conflict({}), [ko("K1"), ko("K2")]);
    expect(pair.a?.title).toBe("Titel K1");
    expect(pair.b?.title).toBe("Titel K2");
  });

  it("liefert null statt Fake, wenn ein KO fehlt", () => {
    const pair = conflictKoPair(conflict({}), [ko("K1")]);
    expect(pair.a?.id).toBe("K1");
    expect(pair.b).toBeNull();
  });
});

describe("SCRUM-128: Auflösungswirkung (dokumentierend, keine KO-Mutation)", () => {
  it("ändert weder Status noch Trust am KO automatisch", () => {
    const e = resolutionEffect(conflict({ type: "truth" }));
    expect(e.koStatusChanged).toBe(false);
    expect(e.koTrustChanged).toBe(false);
    expect(e.documented).toBe(true);
  });

  it("empfiehlt Re-Validierung nur bei Wahrheitskonflikten", () => {
    expect(resolutionEffect(conflict({ type: "truth" })).revalidationRecommended).toBe(true);
    expect(resolutionEffect(conflict({ type: "context" })).revalidationRecommended).toBe(false);
  });
});
