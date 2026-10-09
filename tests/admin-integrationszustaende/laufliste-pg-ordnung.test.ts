// ================================================================================================
// ADMIN-02 · NACHARBEIT 2 — DIE POSTGRES-LISTE ORDNET IN JAVASCRIPT, NICHT TEXTUELL IN SQL.
// ================================================================================================
//
// Ohne Datenbank: ein Pool-Double nimmt die Anweisungen entgegen. Gemessen wird die Zusage aus
// `import-lauf-liste.ts`: KEIN `ORDER BY`/`LIMIT` auf der JSONB-Textspalte (dieselbe Lehre wie
// JOB 924 C3), Ordnung nach dem AUGENBLICK — `11:30+02:00` liegt vor `10:00Z` — und Läufe mit
// unlesbarem Zeitpunkt hinten. Die echte PG-Ablage misst diese Datei ausdrücklich NICHT.
import { describe, expect, it } from "vitest";
import {
  PgAuflistbareImportRunRepo,
  ordneJuengsteZuerst,
} from "../../services/app/src/import-lauf-liste";

interface Aufruf {
  sql: string;
  params: unknown[] | undefined;
}

function poolMit(zeilen: { import_id: string; started_at: unknown }[]) {
  const aufrufe: Aufruf[] = [];
  const pool = {
    query: async (sql: string, params?: unknown[]) => {
      aufrufe.push({ sql, params });
      if (sql.includes("WHERE import_id = $1")) {
        const id = String(params?.[0]);
        return { rows: [{ data: { importId: id } }] };
      }
      return { rows: zeilen };
    },
  };
  return { pool, aufrufe };
}

describe("ADMIN-02 N2 · Laufliste in Postgres", () => {
  it("P1 · ordnet nach Augenblick, unlesbare hinten, Grenze nach dem Ordnen", async () => {
    const { pool, aufrufe } = poolMit([
      { import_id: "a", started_at: "2026-10-09T10:00:00.000Z" },
      { import_id: "b", started_at: "2026-10-09T11:30:00+02:00" },
      { import_id: "c", started_at: "gestern" },
      { import_id: "d", started_at: "2026-10-10T08:00:00.000Z" },
    ]);
    const repo = new PgAuflistbareImportRunRepo(pool as never);
    const laeufe = await repo.juengsteLaeufe(3);
    expect(laeufe.map((l) => l.importId)).toEqual(["d", "a", "b"]);
    const liste = (aufrufe[0]?.sql ?? "").replace(/\s+/g, " ").toUpperCase();
    expect(liste).toContain("IMPORT_RUNS");
    expect(liste).not.toContain("ORDER BY");
    expect(liste).not.toContain("LIMIT");
  });

  it("P2 · die geteilte Ordnung ist deterministisch bei Gleichstand", () => {
    const geordnet = ordneJuengsteZuerst([
      { kennung: "z", startedAt: "2026-10-09T10:00:00.000Z" },
      { kennung: "a", startedAt: "2026-10-09T12:00:00+02:00" },
      { kennung: "m", startedAt: null },
    ]);
    expect(geordnet.map((e) => e.kennung)).toEqual(["a", "z", "m"]);
  });
});
