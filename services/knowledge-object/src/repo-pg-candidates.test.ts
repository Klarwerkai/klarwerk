import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { KO_CANDIDATE_SEARCH_EXPRESSIONS, KO_SCHEMA, PgKoRepo } from "./repo-pg";
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
    // WP-SAMMEL21-FIX (bens Fix 3): DATENSPARENDE Projektion wie listForSearch — bodyHtml
    // (potenziell megabyte-große base64-Bilder) verlässt die DB im Ask-Pfad nicht mehr;
    // Titel/Statement/captionTexts (die Matching-/Antwortfelder) bleiben in der Projektion.
    expect(sql.startsWith("SELECT data - 'bodyHtml' AS data FROM kos")).toBe(true);
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

  it("SCRUM-362: die Query nutzt GENAU die indexierten Such-Ausdrücke (Query↔Index-Deckung)", async () => {
    const { pool, calls } = fakePool([{ data: ko("a") }]);
    const repo = new PgKoRepo(pool);
    await repo.findCandidates({ terms: ["ventil"], limit: 10 });
    const { sql } = calls[0] as { sql: string };
    // Für jeden Such-Ausdruck (für den ein GIN-Trigramm-Index existiert) steht ein `<expr> ILIKE` im SQL.
    for (const expr of KO_CANDIDATE_SEARCH_EXPRESSIONS) {
      expect(sql).toContain(`${expr} ILIKE`);
    }
  });

  // WP-SAMMEL21-FIX (bens Fix 3, Verhaltenstest): die verengte Projektion ändert am MATCHING
  // nichts — Titel/Statement/captionTexts stehen weiter in der Projektion (die ILIKE-Ausdrücke
  // arbeiten ohnehin auf der Tabellen-Spalte, nicht auf der Projektion), und die vom Pool
  // gelieferten body-freien Zeilen reisen 1:1 als Kandidaten durch.
  it("WP-SAMMEL21 Fix 3: body-freie Kandidaten-Zeilen reisen unverändert durch; kein bodyHtml im Ergebnis", async () => {
    const bodyless = {
      id: "k1",
      title: "Ventil warten",
      statement: "Ventil quartalsweise prüfen.",
      captionTexts: ["Verschraubung der Grundplatte"],
    } as unknown as KnowledgeObject;
    const { pool } = fakePool([{ data: bodyless }]);
    const repo = new PgKoRepo(pool);
    const [hit] = await repo.findCandidates({ terms: ["ventil"], limit: 10 });
    expect(hit?.title).toBe("Ventil warten");
    expect(hit?.captionTexts).toEqual(["Verschraubung der Grundplatte"]);
    expect("bodyHtml" in (hit as unknown as Record<string, unknown>)).toBe(false);
  });
});

describe("SCRUM-362: KO_SCHEMA Index-/Schema-Readiness (AG-03-DBINDEX)", () => {
  it("aktiviert pg_trgm und legt je Such-Ausdruck einen GIN-Trigramm-Index an (idempotent)", () => {
    expect(KO_SCHEMA).toContain("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    for (const expr of KO_CANDIDATE_SEARCH_EXPRESSIONS) {
      // Index-Ausdruck deckt sich exakt mit dem Query-Ausdruck → der Planner kann den Index nutzen.
      expect(KO_SCHEMA).toContain(`USING gin ((${expr}) gin_trgm_ops)`);
    }
    // Alle vier Suchfelder sind als eigener trgm-Index benannt.
    for (const name of [
      "idx_kos_title_trgm",
      "idx_kos_statement_trgm",
      "idx_kos_category_trgm",
      "idx_kos_tags_trgm",
    ]) {
      expect(KO_SCHEMA).toContain(`CREATE INDEX IF NOT EXISTS ${name} `);
    }
  });

  it("lässt die vorhandenen type/status-Indizes unangetastet", () => {
    expect(KO_SCHEMA).toContain("CREATE INDEX IF NOT EXISTS idx_kos_type ON kos(type)");
    expect(KO_SCHEMA).toContain("CREATE INDEX IF NOT EXISTS idx_kos_status ON kos(status)");
  });

  it("ist nicht destruktiv: keine DROP/ALTER/TRUNCATE/DELETE-Statements", () => {
    expect(KO_SCHEMA).not.toMatch(/\bDROP\b/i);
    expect(KO_SCHEMA).not.toMatch(/\bALTER\b/i);
    expect(KO_SCHEMA).not.toMatch(/\bTRUNCATE\b/i);
    expect(KO_SCHEMA).not.toMatch(/\bDELETE\b/i);
  });

  it("verwendet ausschließlich idempotente CREATE-Statements (IF NOT EXISTS)", () => {
    const creates = KO_SCHEMA.match(/CREATE (TABLE|INDEX|EXTENSION)/gi) ?? [];
    const idempotent = KO_SCHEMA.match(/CREATE (TABLE|INDEX|EXTENSION) IF NOT EXISTS/gi) ?? [];
    expect(creates.length).toBeGreaterThan(0);
    expect(idempotent.length).toBe(creates.length);
  });
});
