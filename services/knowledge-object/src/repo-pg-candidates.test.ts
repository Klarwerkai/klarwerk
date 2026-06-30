import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { PgKoRepo } from "./repo-pg";
import type { KnowledgeObject } from "./types";

// SCRUM-361 / AG-03 / FR-ASK-02 / NFR-PERF-03: Query-Shape-Test des datenquellennahen Prefilters.
// Fake-Pool zeichnet SQL + Params auf und liefert kontrollierte Zeilen — kein echtes Postgres nötig.
// Belegt: ODER-Treffer über ILIKE (title/statement/category/tags), validiert-/Trust-Bias-ORDER BY,
// LIMIT, vollständig parametrisiert (keine eingebetteten Werte); leere Terme → keine DB-Abfrage.
function fakePool(rows: { data: KnowledgeObject }[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return { rows };
    },
  } as unknown as Pool;
  return { pool, calls };
}

function ko(id: string): KnowledgeObject {
  return { id } as unknown as KnowledgeObject;
}

describe("SCRUM-361: PgKoRepo.findCandidates (Query-Shape, Fake-Pool)", () => {
  it("baut eine parametrisierte ODER-ILIKE-Abfrage mit Status-/Trust-ORDER BY und LIMIT", async () => {
    const { pool, calls } = fakePool([{ data: ko("a") }, { data: ko("b") }]);
    const repo = new PgKoRepo(pool);

    const result = await repo.findCandidates({ terms: ["ventil", "überdruck"], limit: 50 });
    expect(result.map((k) => k.id)).toEqual(["a", "b"]); // Zeilen werden 1:1 als data zurückgegeben

    expect(calls).toHaveLength(1);
    const { sql, params } = calls[0] as { sql: string; params: unknown[] };
    // ODER-Treffer über die vorhandenen Felder; je Term ILIKE auf title/statement/category/tags.
    expect(sql).toContain("data->>'title' ILIKE");
    expect(sql).toContain("data->>'statement' ILIKE");
    expect(sql).toContain("data->>'category' ILIKE");
    expect(sql).toContain("(data->'tags')::text ILIKE");
    expect(sql).toContain(" OR ");
    // validierte zuerst, dann Trust absteigend; harte Begrenzung über LIMIT.
    expect(sql).toContain("ORDER BY (status='validiert') DESC");
    expect(sql).toContain("(data->>'trust')::int DESC");
    expect(sql).toContain("LIMIT");
    // Vollständig parametrisiert: zwei Term-Parameter (%...%) + Limit, keine eingebetteten Werte.
    expect(params).toEqual(["%ventil%", "%überdruck%", 50]);
  });

  it("leere/whitespace-only Terme → keine DB-Abfrage, leeres Ergebnis (kein All-Pool-Scan)", async () => {
    const { pool, calls } = fakePool([{ data: ko("x") }]);
    const repo = new PgKoRepo(pool);
    expect(await repo.findCandidates({ terms: [], limit: 10 })).toEqual([]);
    expect(await repo.findCandidates({ terms: ["", "  "], limit: 10 })).toEqual([]);
    expect(calls).toHaveLength(0);
  });
});
