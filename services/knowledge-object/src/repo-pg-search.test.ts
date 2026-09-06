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
    // WP-D11b (patches53-GELB): rowCount 0 (Feld war schon da) → inserted false.
    expect(await repo.setCaptionTexts("k1", ["Verschraubung"])).toBe(false);
    const { sql, params } = calls[0] as { sql: string; params: unknown[] };
    expect(sql).toContain("jsonb_set(data, '{captionTexts}', $2::jsonb)");
    // bens sammel15-ROT 1: EIN bedingtes UPDATE … WHERE (kein Read-Modify-Write) — ein bereits
    // gesetztes Feld (nebenläufiger revise mit frischerem Scan) wird NIE überschrieben.
    expect(sql).toContain("AND NOT (data ? 'captionTexts')");
    expect(sql).not.toContain("rowVersion");
    expect(params).toEqual(["k1", JSON.stringify(["Verschraubung"])]);
  });

  it("setCaptionTexts meldet inserted true, wenn das bedingte UPDATE wirklich geschrieben hat", async () => {
    const { pool } = fakePool([{ data: ko("k1") }]); // rowCount 1 → der Write hat gegriffen
    const repo = new PgKoRepo(pool);
    expect(await repo.setCaptionTexts("k1", ["Verschraubung"])).toBe(true);
  });

  // JOB 3111 · B1b: DASSELBE für das Benennungs-Suchfeld. Es ist der Weg, der im Betrieb wirklich
  // läuft (Postgres), und ohne diesen Pin wäre nur der In-Memory-Zwilling gemessen.
  it("setImageNames ist derselbe ATOMAR BEDINGTE jsonb_set-Write — NUR wenn das Feld fehlt", async () => {
    const { pool, calls } = fakePool([]);
    const repo = new PgKoRepo(pool);
    expect(await repo.setImageNames("k1", ["schraubenzeichnung-v3.png"])).toBe(false);
    const { sql, params } = calls[0] as { sql: string; params: unknown[] };
    expect(sql).toContain("jsonb_set(data, '{imageNames}', $2::jsonb)");
    expect(sql).toContain("AND NOT (data ? 'imageNames')");
    // Reiner Cache-Write: kein CAS auf rowVersion, kein Versions-Bump, kein Audit.
    expect(sql).not.toContain("rowVersion");
    expect(params).toEqual(["k1", JSON.stringify(["schraubenzeichnung-v3.png"])]);
  });

  it("setImageNames meldet inserted true, wenn das bedingte UPDATE wirklich geschrieben hat", async () => {
    const { pool } = fakePool([{ data: ko("k1") }]);
    const repo = new PgKoRepo(pool);
    expect(await repo.setImageNames("k1", ["schraubenzeichnung-v3.png"])).toBe(true);
  });

  // JOB 3111 · B1b R2: die ARBEITSLISTE des Nachzugs in SQL. Zwei Zusagen, beide hier gepinnt:
  // sie reicht NUR Kennungen heraus (kein `data`, also nie ein Rumpf), und sie hält denselben
  // Papierkorbfilter wie `missingActive` ein — ein getrashtes Objekt darf nicht ewig in ihr
  // hängen, sonst käme die Differenz des Reconcile nie auf null.
  it("missingImageNames ist eine schmale Kennungsliste MIT Papierkorbfilter und Deckel", async () => {
    const { pool, calls } = fakePool([]);
    const repo = new PgKoRepo(pool);
    expect(await repo.missingImageNames(25)).toEqual([]);
    const { sql, params } = calls[0] as { sql: string; params: unknown[] };
    expect(sql).toContain("SELECT id FROM kos");
    expect(sql).toContain("NOT (data ? 'imageNames')");
    expect(sql).toContain("NOT (data ? 'deletedAt')");
    expect(sql).toContain("LIMIT $1");
    expect(sql).not.toContain("data AS");
    expect(params).toEqual([25]);
  });

  it("missingImageNames gibt die Kennungen der Zeilen zurück; Deckel 0 fragt gar nicht erst", async () => {
    const treffer = [{ id: "k9" }] as unknown as { data: KnowledgeObject }[];
    const { pool, calls } = fakePool(treffer);
    const repo = new PgKoRepo(pool);
    expect(await repo.missingImageNames(5)).toEqual(["k9"]);
    expect(await repo.missingImageNames(0)).toEqual([]);
    expect(calls).toHaveLength(1);
  });
});
