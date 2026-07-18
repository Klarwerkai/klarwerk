import { describe, expect, it } from "vitest";
import { ConflictService, type ConflictVerdict } from "../../conflicts";
import { InMemoryConflictRepo } from "../../conflicts";
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import type { Reasoner } from "../../reasoner";
import { checkKnowledge } from "./knowledge-check";

// SCRUM-527 (Live-Check): der Endpoint-Kern. similar = lexikalisch (deterministisch, kein Egress).
// SOFORT-HOTFIX P0: der Modell-Judge ist deaktiviert → KEIN Reasoner-/Cloud-Call mit Freitext; conflicts
// bleibt [] mit status "pending".

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

// Spy-Reasoner: zählt JEDEN Modell-Aufruf (judgeConflict = Cloud-Egress-Pfad). Nach dem P0-Hotfix MUSS
// der Zähler 0 bleiben — der Check ruft den Judge nicht mehr.
function spyReasoner(verdict: ConflictVerdict | null): { reasoner: Reasoner; calls: () => number } {
  let n = 0;
  const reasoner = {
    // status() ist kein Egress; es wird nach dem Hotfix ohnehin nicht mehr gerufen.
    status: () => ({ active: true, provider: "cloud", mode: "model" }),
    judgeConflict: async () => {
      n += 1; // Modell-/Cloud-Aufruf mit Freitext — DARF nicht passieren.
      return verdict;
    },
  } as unknown as Reasoner;
  return { reasoner, calls: () => n };
}

const conflicts = () => new ConflictService({ repo: new InMemoryConflictRepo() });

describe("checkKnowledge", () => {
  it("zu kurzer Text → done, leer", async () => {
    const res = await checkKnowledge("kurz", {
      ko: fakeKo([]),
      conflicts: conflicts(),
      reasoner: spyReasoner(null).reasoner,
    });
    expect(res).toEqual({ status: "done", similar: [], conflicts: [] });
  });

  it("similar: findet lexikalisch ähnliche KOs (deterministisch, kein Modell)", async () => {
    const match = ko({
      id: "k1",
      title: "Vorwärmung bei Kaltstart",
      statement: "Bei Kaltstart die Vorwärmung aktivieren.",
    });
    const unrelated = ko({ id: "k2", title: "Kaffeeküche", statement: "Milch nachfüllen." });
    const res = await checkKnowledge("Bei Kaltstart die Vorwärmung aktivieren nicht vergessen.", {
      ko: fakeKo([match, unrelated]),
      conflicts: conflicts(),
      reasoner: spyReasoner(null).reasoner,
    });
    expect(res.similar.map((s) => s.id)).toContain("k1");
    expect(res.similar.map((s) => s.id)).not.toContain("k2");
    expect(res.similar[0]?.score).toBeGreaterThan(0);
  });

  // SOFORT-HOTFIX P0 (ben-Befund 1c): der Freitext-Check darf KEINEN Modell-/Cloud-Aufruf auslösen —
  // sonst könnte unklassifizierter (evtl. vertraulicher) Freitext in die Cloud egressen. Selbst mit
  // einem „scharfen" Verdikt-liefernden Reasoner bleibt der judgeConflict-Spy bei 0, conflicts=[] und
  // status="pending". Ohne den Hotfix (Judge aktiv) würde der Spy zählen und status "done" liefern →
  // dieser Test schlägt fehl.
  it("P0: KEIN Reasoner-/Cloud-Call mit Freitext; similar bleibt, status 'pending'", async () => {
    const cand = ko({
      id: "kc",
      title: "Kaltstart Vorwärmung",
      statement: "Bei Kaltstart zuerst die Vorwärmung aktivieren.",
    });
    // Ein Verdikt, das der (deaktivierte) Judge liefern WÜRDE — es darf nie abgefragt werden.
    const verdict: ConflictVerdict = {
      relation: "widerspruch",
      older: null,
      confidence: 0.9,
      begruendung: "Widersprüchliche Aussage zur Vorwärmung.",
      zitat_a: "keine Vorwärmung aktivieren",
      zitat_b: "zuerst die Vorwärmung aktivieren",
    };
    const spy = spyReasoner(verdict);
    const res = await checkKnowledge("Bei Kaltstart keine Vorwärmung aktivieren und sichern.", {
      ko: fakeKo([cand]),
      conflicts: conflicts(),
      reasoner: spy.reasoner,
    });
    expect(spy.calls()).toBe(0); // KEIN Modell-/Cloud-Aufruf mit Freitext
    expect(res.status).toBe("pending"); // Widerspruch ehrlich „nicht geprüft"
    expect(res.conflicts).toEqual([]);
    expect(res.similar.map((s) => s.id)).toContain("kc"); // similar bleibt voll funktional
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
      reasoner: spyReasoner(null).reasoner,
    });
    expect(res).toEqual({ status: "failed", similar: [], conflicts: [] });
  });
});
