import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { ConflictService, type ConflictVerdict, InMemoryConflictRepo } from "../../../conflicts";
import type { KnowledgeObject, KoService } from "../../../knowledge-object";
import type { Reasoner } from "../../../reasoner";
import type { Guards } from "../http";
import { knowledgeCheckRoutes } from "./knowledge-check-routes";

// SCRUM-527 (WP3 — voller Provenienz-Vertrag): POST /api/knowledge/check gibt dem Freitext denselben
// fail-safe Herkunftsvertrag wie /api/check-text. Hier mit INJIZIERTEM Spy-Judge (kein echter Modell-
// aufruf): der Judge (Cloud-Egress) darf NUR bei sicher nicht-vertraulichem Freitext + verfügbarem Modell
// laufen. Vertraulich/unklassifiziert/kein Modell → judgeConflict-Spy = 0, status "pending". similar
// (lexikalisch) bleibt in allen Fällen.

const fakeGuards = { requirePermission: async () => ({ id: "u1" }) } as unknown as Guards;

// Freitext + Kandidat mit hoher Tokenüberdeckung → similar trifft, und (mit Judge) assessAgainstPool
// wählt den Kandidaten und ruft den Judge.
const DRAFT = "Bei Kaltstart keine Vorwärmung aktivieren und sichern.";

function mkKo(over: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id: "kc",
    title: "Kaltstart Vorwärmung",
    statement: "Bei Kaltstart zuerst die Vorwärmung aktivieren.",
    conditions: [],
    measures: [],
    category: "Anlage",
    tags: [],
    asset: null,
    ...over,
  } as unknown as KnowledgeObject;
}

// G-2-gültiges Verdikt (wörtliche Zitate in beiden Kerntexten vorhanden).
const conflictVerdict: ConflictVerdict = {
  relation: "widerspruch",
  older: null,
  confidence: 0.9,
  begruendung: "Widersprüchliche Aussage zur Vorwärmung.",
  zitat_a: "keine Vorwärmung aktivieren",
  zitat_b: "zuerst die Vorwärmung aktivieren",
} as unknown as ConflictVerdict;

async function appWith(opts: { active: boolean; verdict?: ConflictVerdict | null }) {
  const seed = [mkKo()];
  const findCandidates = vi.fn(async () => seed);
  const get = vi.fn(async (id: string) => seed.find((k) => k.id === id));
  const ko = { findCandidates, get } as unknown as KoService;
  const judgeConflict = vi.fn(async () => opts.verdict ?? null);
  const reasoner = {
    status: () => ({ active: opts.active, provider: "cloud", mode: "model" }),
    judgeConflict,
  } as unknown as Reasoner;
  const conflicts = new ConflictService({ repo: new InMemoryConflictRepo() });
  const app = Fastify();
  await app.register(knowledgeCheckRoutes({ ko, conflicts, reasoner, guards: fakeGuards }));
  return { app, judgeConflict };
}

async function post(app: Awaited<ReturnType<typeof appWith>>["app"], body: unknown) {
  return app.inject({ method: "POST", url: "/api/knowledge/check", payload: body as object });
}

describe("POST /api/knowledge/check — Provenienz-Vertrag (WP3)", () => {
  it("vertraulicher Draft → KEIN Judge (Spy=0), status pending, similar bleibt", async () => {
    const { app, judgeConflict } = await appWith({ active: true, verdict: conflictVerdict });
    const res = await post(app, {
      text: DRAFT,
      source: "draft",
      confidentiality: "vertraulich",
    });
    expect(res.statusCode).toBe(200);
    expect(judgeConflict).not.toHaveBeenCalled(); // kein Cloud-Egress des Freitexts
    const body = res.json();
    expect(body.status).toBe("pending");
    expect(body.conflicts).toEqual([]);
    expect(body.similar.map((s: { id: string }) => s.id)).toContain("kc"); // similar unverändert
  });

  it("unklassifiziert (kein source) → fail-safe vertraulich: Spy=0, pending", async () => {
    const { app, judgeConflict } = await appWith({ active: true, verdict: conflictVerdict });
    const res = await post(app, { text: DRAFT });
    expect(res.statusCode).toBe(200);
    expect(judgeConflict).not.toHaveBeenCalled();
    expect(res.json().status).toBe("pending");
  });

  it("lose koId (source:'ko') gibt Freitext NICHT frei → Spy=0, pending (R4-Kern)", async () => {
    const { app, judgeConflict } = await appWith({ active: true, verdict: conflictVerdict });
    const res = await post(app, { text: DRAFT, source: "ko", koId: "kc" });
    expect(res.statusCode).toBe(200);
    expect(judgeConflict).not.toHaveBeenCalled();
    expect(res.json().status).toBe("pending");
  });

  it("freigegebener Draft (intern) + Modell aktiv → Judge läuft, echte conflicts, done", async () => {
    const { app, judgeConflict } = await appWith({ active: true, verdict: conflictVerdict });
    const res = await post(app, { text: DRAFT, source: "draft", confidentiality: "intern" });
    expect(res.statusCode).toBe(200);
    expect(judgeConflict).toHaveBeenCalled(); // Widerspruchs-Judge lief
    const body = res.json();
    expect(body.status).toBe("done");
    expect(body.conflicts.map((c: { id: string }) => c.id)).toContain("kc");
  });

  it("Draft intern, aber KEIN Modell verfügbar → Spy=0, pending (kein Fake-'done')", async () => {
    const { app, judgeConflict } = await appWith({ active: false, verdict: conflictVerdict });
    const res = await post(app, { text: DRAFT, source: "draft", confidentiality: "intern" });
    expect(res.statusCode).toBe(200);
    expect(judgeConflict).not.toHaveBeenCalled();
    expect(res.json().status).toBe("pending");
  });
});
