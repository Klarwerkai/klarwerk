// WP-BILD-1g (bens sammel14-ROT, PFLICHT: Pg-Query-Pin): der Suchpfad lädt KEIN bodyHtml aus
// PostgreSQL — die Projektion entfernt das Feld bereits im SELECT (data - 'bodyHtml'); der
// Backfill des abgeleiteten captionTexts-Suchfelds ist ein schmaler jsonb_set-Write ohne
// Versions-/Audit-Semantik. Fake-Pool zeichnet SQL + Params auf (Muster repo-pg-candidates).
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { PgKoRepo } from "./repo-pg";
import type { KnowledgeObject } from "./types";

function fakePool(rows: { data: KnowledgeObject }[]) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return { rows, rowCount: rows.length };
    },
  } as unknown as Pool;
  return { pool, calls };
}

function ko(id: string): KnowledgeObject {
  return { id } as unknown as KnowledgeObject;
}

describe("WP-BILD-1g: PgKoRepo-Suchpfad (Query-Shape, Fake-Pool)", () => {
  it("listForSearch projiziert bodyHtml WEG (data - 'bodyHtml') — gleiche Filterlogik wie list", async () => {
    const { pool, calls } = fakePool([{ data: ko("a") }]);
    const repo = new PgKoRepo(pool);
    const result = await repo.listForSearch({ category: "Wartung" });
    expect(result.map((k) => k.id)).toEqual(["a"]);
    expect(calls).toHaveLength(1);
    const { sql, params } = calls[0] as { sql: string; params: unknown[] };
    expect(sql).toContain("SELECT data - 'bodyHtml' AS data FROM kos");
    expect(sql).toContain("category=$1");
    expect(params).toEqual(["Wartung"]);
  });

  it("list (Voll-Sicht) bleibt unverändert bei SELECT data — die Projektion gilt NUR dem Suchpfad", async () => {
    const { pool, calls } = fakePool([{ data: ko("a") }]);
    const repo = new PgKoRepo(pool);
    await repo.list({});
    const { sql } = calls[0] as { sql: string };
    expect(sql).toContain("SELECT data FROM kos");
    expect(sql).not.toContain("- 'bodyHtml'");
  });

  it("setCaptionTexts ist ein ATOMAR BEDINGTER jsonb_set-Write: NUR wenn das Feld fehlt (WP-BILD-1h)", async () => {
    const { pool, calls } = fakePool([]);
    const repo = new PgKoRepo(pool);
    await repo.setCaptionTexts("k1", ["Verschraubung"]);
    const { sql, params } = calls[0] as { sql: string; params: unknown[] };
    expect(sql).toContain("jsonb_set(data, '{captionTexts}', $2::jsonb)");
    // bens sammel15-ROT 1: EIN bedingtes UPDATE … WHERE (kein Read-Modify-Write) — ein bereits
    // gesetztes Feld (nebenläufiger revise mit frischerem Scan) wird NIE überschrieben.
    expect(sql).toContain("AND NOT (data ? 'captionTexts')");
    expect(sql).not.toContain("rowVersion");
    expect(params).toEqual(["k1", JSON.stringify(["Verschraubung"])]);
  });
});
