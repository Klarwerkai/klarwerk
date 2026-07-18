import { describe, expect, it } from "vitest";
import { ConflictService, type ConflictVerdict } from "../../conflicts";
import { InMemoryConflictRepo } from "../../conflicts";
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import type { Reasoner } from "../../reasoner";
import { checkKnowledge } from "./knowledge-check";

// SCRUM-527 (Live-Check): der Endpoint-Kern. similar = lexikalisch (deterministisch, kein Egress);
// conflicts = Dry-Run über den Modell-Judge, NUR echte Verdachte; ohne Modell ehrlich „pending".

function ko(over: Partial<KnowledgeObject>): KnowledgeObject {
  return {
    id: "x",
    title: "",
    statement: "",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "",
    tags: [],
    confidence: 80,
    trust: 80,
    status: "validiert",
    version: 1,
    originalAuthor: "a",
    author: "a",
    neededValidations: 3,
    assignments: [],
    asset: null,
    createdAt: "2026-01-01",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...over,
  };
}

// Fake-KoService: liefert vorgegebene Kandidaten (Repo-Keyword-Prefilter hier nicht Gegenstand).
function fakeKo(candidates: KnowledgeObject[]): KoService {
  return { findCandidates: async () => candidates } as unknown as KoService;
}

// Fake-Reasoner: nur die zwei vom Check genutzten Methoden.
function fakeReasoner(active: boolean, verdict: ConflictVerdict | null): Reasoner {
  return {
    status: () => ({
      active,
      provider: active ? "cloud" : "deterministic",
      mode: active ? "model" : "deterministic",
    }),
    judgeConflict: async () => verdict,
  } as unknown as Reasoner;
}

const conflicts = () => new ConflictService({ repo: new InMemoryConflictRepo() });

describe("checkKnowledge", () => {
  it("zu kurzer Text → done, leer", async () => {
    const res = await checkKnowledge("kurz", {
      ko: fakeKo([]),
      conflicts: conflicts(),
      reasoner: fakeReasoner(false, null),
    });
    expect(res).toEqual({ status: "done", similar: [], conflicts: [] });
  });

  it("similar: findet lexikalisch ähnliche KOs (deterministisch, auch ohne Modell)", async () => {
    const match = ko({
      id: "k1",
      title: "Vorwärmung bei Kaltstart",
      statement: "Bei Kaltstart die Vorwärmung aktivieren.",
    });
    const unrelated = ko({ id: "k2", title: "Kaffeeküche", statement: "Milch nachfüllen." });
    const res = await checkKnowledge("Bei Kaltstart die Vorwärmung aktivieren nicht vergessen.", {
      ko: fakeKo([match, unrelated]),
      conflicts: conflicts(),
      reasoner: fakeReasoner(false, null), // Modell offline
    });
    // similar wird auch ohne Modell geliefert; das ähnliche KO ist dabei, das fremde nicht.
    expect(res.similar.map((s) => s.id)).toContain("k1");
    expect(res.similar.map((s) => s.id)).not.toContain("k2");
    expect(res.similar[0]?.score).toBeGreaterThan(0);
  });

  it("ohne Modell → status 'pending', conflicts leer (kein Fake-Widerspruch)", async () => {
    const match = ko({ id: "k1", title: "Kaltstart", statement: "Vorwärmung aktivieren." });
    const res = await checkKnowledge("Bei Kaltstart die Vorwärmung aktivieren.", {
      ko: fakeKo([match]),
      conflicts: conflicts(),
      reasoner: fakeReasoner(false, null),
    });
    expect(res.status).toBe("pending");
    expect(res.conflicts).toEqual([]);
  });

  it("mit Modell + echtem Judge-Verdacht → conflicts enthält den Kandidaten (Dry-Run, kein Persist)", async () => {
    const cand = ko({
      id: "kc",
      title: "Kaltstart Vorwärmung",
      statement: "Bei Kaltstart zuerst die Vorwärmung aktivieren.",
    });
    const text = "Bei Kaltstart keine Vorwärmung aktivieren.";
    // Verdikt mit wörtlichen, in den Kerntexten VORHANDENEN Zitaten (G-2-Prüfung greift).
    const verdict: ConflictVerdict = {
      relation: "widerspruch",
      older: null,
      confidence: 0.9,
      begruendung: "Widersprüchliche Aussage zur Vorwärmung.",
      zitat_a: "keine Vorwärmung aktivieren",
      zitat_b: "zuerst die Vorwärmung aktivieren",
    };
    const cs = conflicts();
    const res = await checkKnowledge(text, {
      ko: fakeKo([cand]),
      conflicts: cs,
      reasoner: fakeReasoner(true, verdict),
    });
    expect(res.status).toBe("done");
    expect(res.conflicts.map((c) => c.id)).toContain("kc");
    expect(res.conflicts[0]?.reason).toContain("Vorwärmung");
    // Dry-Run: NICHTS persistiert.
    expect(await cs.unresolved()).toHaveLength(0);
  });

  it("never block: ein Fehler in der Kandidatensuche → status 'failed', leer", async () => {
    const brokenKo = {
      findCandidates: async () => {
        throw new Error("db down");
      },
    } as unknown as KoService;
    const res = await checkKnowledge("Bei Kaltstart die Vorwärmung aktivieren.", {
      ko: brokenKo,
      conflicts: conflicts(),
      reasoner: fakeReasoner(true, null),
    });
    expect(res).toEqual({ status: "failed", similar: [], conflicts: [] });
  });
});
