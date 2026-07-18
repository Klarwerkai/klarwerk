import { describe, expect, it } from "vitest";
import { ConflictService, type ConflictVerdict, InMemoryConflictRepo } from "../../conflicts";
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import { type DraftConflictJudge, checkKnowledge } from "./knowledge-check";

// SCRUM-527 (Live-Check-Kern): similar = lexikalisch (deterministisch, kein Egress). conflicts laufen NUR
// mit einem übergebenen Judge (die fail-safe Contract-Entscheidung liegt in der Route, siehe
// knowledge-check-routes.test). Ohne Judge → status "pending", KEIN Modell-/Cloud-Aufruf mit Freitext.

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

// Spy-Judge: zählt JEDEN Aufruf (der Judge ist der Cloud-Egress-Pfad). Ohne übergebenen Judge darf er nie
// entstehen; mit Judge muss er für passende Kandidaten laufen.
function spyJudge(verdict: ConflictVerdict | null): {
  judge: DraftConflictJudge;
  calls: () => number;
} {
  let n = 0;
  return {
    judge: async () => {
      n += 1;
      return verdict;
    },
    calls: () => n,
  };
}

const conflicts = () => new ConflictService({ repo: new InMemoryConflictRepo() });

describe("checkKnowledge", () => {
  it("zu kurzer Text → done, leer", async () => {
    const res = await checkKnowledge("kurz", { ko: fakeKo([]), conflicts: conflicts() });
    expect(res).toEqual({ status: "done", similar: [], conflicts: [] });
  });

  it("similar: findet lexikalisch ähnliche KOs (deterministisch, kein Judge)", async () => {
    const match = ko({
      id: "k1",
      title: "Vorwärmung bei Kaltstart",
      statement: "Bei Kaltstart die Vorwärmung aktivieren.",
    });
    const unrelated = ko({ id: "k2", title: "Kaffeeküche", statement: "Milch nachfüllen." });
    const res = await checkKnowledge("Bei Kaltstart die Vorwärmung aktivieren nicht vergessen.", {
      ko: fakeKo([match, unrelated]),
      conflicts: conflicts(),
    });
    expect(res.similar.map((s) => s.id)).toContain("k1");
    expect(res.similar.map((s) => s.id)).not.toContain("k2");
    expect(res.similar[0]?.score).toBeGreaterThan(0);
  });

  it("OHNE Judge → status 'pending', conflicts [], similar bleibt (kein Egress)", async () => {
    const match = ko({ id: "k1", title: "Kaltstart", statement: "Vorwärmung aktivieren." });
    const res = await checkKnowledge("Bei Kaltstart die Vorwärmung aktivieren.", {
      ko: fakeKo([match]),
      conflicts: conflicts(),
      judge: null,
    });
    expect(res.status).toBe("pending");
    expect(res.conflicts).toEqual([]);
    expect(res.similar.map((s) => s.id)).toContain("k1");
  });

  it("MIT Judge + G-2-gültigem Verdikt → status 'done', conflicts enthält Kandidaten (Dry-Run, kein Persist)", async () => {
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
    const spy = spyJudge(verdict);
    const cs = conflicts();
    const res = await checkKnowledge(text, { ko: fakeKo([cand]), conflicts: cs, judge: spy.judge });
    expect(spy.calls()).toBeGreaterThan(0); // Judge lief für den passenden Kandidaten
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
      judge: spyJudge(null).judge,
    });
    expect(res).toEqual({ status: "failed", similar: [], conflicts: [] });
  });
});
