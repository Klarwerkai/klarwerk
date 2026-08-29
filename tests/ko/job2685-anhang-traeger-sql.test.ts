// ================================================================================================
// JOB 2685 D1+D2 (Review R2-30) — JEDES BILD LÄDT DEN GANZEN BESTAND: die Trägersuche in SQL.
// ================================================================================================
//
// Vorher: `beurteileAnhang` bekam `ko.list()` — `SELECT data FROM kos` ohne WHERE, jedes Objekt samt
// Base64-Bildern, je Bildabruf. Seit D1 läuft die Suche in der Datenbank; seit D2 als UNION der vier
// Arme (damit der GIN auf `attachments` greifen kann) und für MEHRERE Kennungen auf einmal.
//
// Ein echtes Postgres gibt es im schnellen Tor nicht; die Mengengleichheit der SQL-Arme gegen die
// Node-Prädikate steht in tests/ko/job2685-anhang-traeger.integration.test.ts (Docker). Dieser Test
// hält fest, WAS gesendet wird — Text, Parameter, Index-DDL — und dass der alte Weg für die anderen
// Aufrufer unverändert weiter existiert.
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { klassifiziereStufe } from "../../services/app/src/migrationsbeleg";
import { InMemoryKoRepo, type KoRepo } from "../../services/knowledge-object/src/repo";
import {
  KO_ANHANG_TRAEGER_SQL,
  KO_EVIDENCE_SCHEMA,
  KO_SCHEMA,
  KO_VERSIONS_SCHEMA,
  PgKoRepo,
  anhangTraegerParameter,
} from "../../services/knowledge-object/src/repo-pg";

function fakePool(rows: unknown[] = []): { pool: Pool; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn(async () => ({ rows, rowCount: rows.length }));
  return { pool: { query } as unknown as Pool, query };
}

describe("JOB 2685 D2 · PgKoRepo.listAnhangTraegerFuer — eine Abfrage, vier Arme als UNION, nur Treffer", () => {
  it("sendet GENAU eine Abfrage mit drei Parameter-Feldern (je Kennung ein Element) und gibt die Zeilen zurück", async () => {
    const treffer = { id: "ko-1", title: "Träger", bodyHtml: "…obj-1…" };
    const { pool, query } = fakePool([{ data: treffer }]);
    const repo = new PgKoRepo(pool);

    const ergebnis = await repo.listAnhangTraegerFuer(["obj-1", "obj-2", "obj-1"]);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toBe(KO_ANHANG_TRAEGER_SQL);
    expect(params).toEqual([
      ['[{"objectId":"obj-1"}]', '[{"objectId":"obj-2"}]'],
      ["%obj-1%", "%obj-2%"],
      ["obj-1", "obj-2"],
    ]);
    expect(ergebnis).toEqual([treffer]);
  });

  it("die Einzelsuche ist die Mehrfachsuche mit einer Kennung — kein zweiter Abfragetext", async () => {
    const { pool, query } = fakePool([]);
    await new PgKoRepo(pool).listAnhangTraeger("obj-9");
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toBe(KO_ANHANG_TRAEGER_SQL);
    expect(params).toEqual([['[{"objectId":"obj-9"}]'], ["%obj-9%"], ["obj-9"]]);
  });

  it("eine leere Kennungsliste geht nicht zur Datenbank", async () => {
    const { pool, query } = fakePool([]);
    expect(await new PgKoRepo(pool).listAnhangTraegerFuer([])).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it("die vier Arme stehen als UNION im Text — aktueller Stand (Anhang, Fließtext), Belegkette, Fassungen", () => {
    expect(KO_ANHANG_TRAEGER_SQL).toContain("data->'attachments' @> ANY($1::jsonb[])");
    expect(KO_ANHANG_TRAEGER_SQL).toContain("data->>'bodyHtml' LIKE ANY($2::text[])");
    expect(KO_ANHANG_TRAEGER_SQL).toContain(
      "SELECT ko_id FROM ko_evidence WHERE data->>'objectId' = ANY($3::text[])",
    );
    expect(KO_ANHANG_TRAEGER_SQL).toContain("SELECT ko_id FROM ko_versions");
    expect(KO_ANHANG_TRAEGER_SQL).toContain("snapshot->'attachments' @> ANY($1::jsonb[])");
    expect(KO_ANHANG_TRAEGER_SQL).toContain("snapshot->>'bodyHtml' LIKE ANY($2::text[])");
    // Drei UNION, kein ODER zwischen den Armen — nur innerhalb des Fassungs-Arms.
    expect(KO_ANHANG_TRAEGER_SQL.match(/\bUNION\b/g)?.length).toBe(3);
    expect(KO_ANHANG_TRAEGER_SQL).toMatch(/^SELECT data FROM kos WHERE id IN \(/);
  });

  it("LIKE-Sonderzeichen in der Kennung werden entwertet — `%`, `_` und `\\` sind Zeichen, keine Muster", () => {
    expect(anhangTraegerParameter(["a%b_c\\d"])).toEqual([
      ['[{"objectId":"a%b_c\\\\d"}]'],
      ["%a\\%b\\_c\\\\d%"],
      ["a%b_c\\d"],
    ]);
  });

  it("DER INDEX (D2): drei additive `CREATE INDEX IF NOT EXISTS` an den bestehenden Stufen — GIN auf `attachments`, GIN auf den Schnappschüssen, Ausdruck auf der Belegkette", () => {
    expect(KO_SCHEMA).toContain(
      "CREATE INDEX IF NOT EXISTS idx_kos_anhang_traeger ON kos USING gin ((data->'attachments') jsonb_path_ops);",
    );
    expect(KO_VERSIONS_SCHEMA).toContain(
      "CREATE INDEX IF NOT EXISTS idx_ko_versions_anhang_traeger ON ko_versions USING gin ((snapshot->'attachments') jsonb_path_ops);",
    );
    expect(KO_EVIDENCE_SCHEMA).toContain(
      "CREATE INDEX IF NOT EXISTS idx_ko_evidence_object_id ON ko_evidence ((data->>'objectId'));",
    );
    // Additiv nach dem Maß des Migrationsbelegs: kein DROP, kein TRUNCATE, kein UPDATE, kein ALTER in KO_SCHEMA.
    for (const ddl of [KO_SCHEMA, KO_VERSIONS_SCHEMA, KO_EVIDENCE_SCHEMA]) {
      expect(klassifiziereStufe(ddl)).toBe("ADDITIV");
    }
    expect(KO_SCHEMA).not.toContain("ALTER TABLE");
  });

  it("KALIBRIERUNG: `list({})` sendet weiterhin den Voll-Load ohne WHERE — für die Aufrufer, die ihn brauchen", async () => {
    const { pool, query } = fakePool([]);
    await new PgKoRepo(pool).list({});
    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toBe("SELECT data FROM kos");
    expect(sql).not.toContain("WHERE");
  });

  it("der Anwendungsspeicher bietet die Trägersuche NICHT an — dort bleibt der bisherige Weg (Vertrag am Interface)", () => {
    const repo: KoRepo = new InMemoryKoRepo();
    expect(repo.listAnhangTraeger).toBeUndefined();
    expect(repo.listAnhangTraegerFuer).toBeUndefined();
  });
});
