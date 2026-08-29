// ================================================================================================
// JOB 2704 D1 (Review R2-35) — DIE PG-ADAPTER: vier Schreiber, EIN Client, EIN BEGIN, EIN COMMIT.
// ================================================================================================
//
// Die Service-Ebene (job2704-vier-schritte-eine-transaktion) zeigt, dass ein Abbruch nichts
// hinterlaesst — mit einer Transaktionsattrappe. Diese Datei pinnt, dass die ECHTEN Pg-Adapter den
// `tx` auch wirklich auf den Transaktionsclient aufloesen und keine eigene Transaktion mehr oeffnen:
// PgKoRepo.update, PgKoVersionRepo.append, PgKoSearchProjectionRepo.insert (samt Steuerzeilensperre
// FOR SHARE), PgKoMetadataProjectionRepo.upsert und PgAuditRepo.append — unter dem echten `withPgTx`
// gegen eine Pool-Attrappe, die jedes Statement mitschreibt.
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { PgAuditRepo } from "../../services/audit/src/repo-pg";
import { withPgTx } from "../../services/db-tx";
import { PgKoRepo, PgKoVersionRepo } from "../../services/knowledge-object/src/repo-pg";
import { buildSearchProjection } from "../../services/knowledge-object/src/search-projection";
import { PgKoSearchProjectionRepo } from "../../services/knowledge-object/src/search-projection-repo-pg";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";

function poolAttrappe(opts: { fehlerBei?: RegExp } = {}) {
  const client: string[] = [];
  const pool: string[] = [];
  let freigegeben = 0;
  const clientObjekt = {
    query: async (sql: string) => {
      client.push(sql.replace(/\s+/g, " ").trim());
      if (opts.fehlerBei?.test(sql)) {
        throw new Error("ko_versions nicht erreichbar");
      }
      return { rows: [], rowCount: 1 };
    },
    release: () => {
      freigegeben += 1;
    },
  };
  const poolObjekt = {
    connect: async () => clientObjekt,
    query: async (sql: string) => {
      pool.push(sql.replace(/\s+/g, " ").trim());
      return { rows: [], rowCount: 1 };
    },
  } as unknown as Pool;
  return { pool: poolObjekt, client, poolProtokoll: pool, freigegeben: () => freigegeben };
}

const KO = {
  id: "ko-2704",
  type: "best_practice",
  status: "offen",
  category: "Wartung",
  title: "Spezialpresse SPX9",
  statement: "Kurzfassung.",
  author: "anna",
  version: 2,
  rowVersion: 1,
  trust: 0,
  tags: [],
  conditions: [],
  measures: [],
  history: [],
  sources: [],
  createdAt: "2026-08-29T12:00:00.000Z",
  updatedAt: "2026-08-29T12:00:00.000Z",
} as unknown as KnowledgeObject;

async function vierSchreiber(pool: Pool) {
  const kos = new PgKoRepo(pool);
  const versions = new PgKoVersionRepo(pool);
  const projections = new PgKoSearchProjectionRepo(pool);
  const audit = new PgAuditRepo(pool);
  const at = "2026-08-29T12:00:01.000Z";
  return withPgTx(pool, async (tx) => {
    await kos.update(KO, tx);
    await versions.append(
      { koId: KO.id, version: 2, snapshot: KO, at, author: "anna", note: "überarbeitet" },
      tx,
    );
    await projections.insert(buildSearchProjection(KO, at), tx);
    await projections.metadata.upsert(
      { koId: KO.id, categoryText: "wartung", tagText: "", at },
      tx,
    );
    await audit.append(
      {
        seq: 1,
        at,
        actor: "anna",
        action: "ko.revised",
        target: KO.id,
        payload: { version: 2 },
        prevHash: "GENESIS",
        hash: "h",
        hashVersion: 2,
      },
      tx,
    );
    return "durch";
  });
}

const zaehle = (protokoll: string[], muster: RegExp) =>
  protokoll.filter((s) => muster.test(s)).length;

describe("JOB 2704 D1 · Pg · vier Schreiber auf EINEM Transaktionsclient", () => {
  it("P1 · alle Statements laufen auf dem Client der Klammer; genau EIN BEGIN, genau EIN COMMIT, der Pool sieht nichts", async () => {
    const a = poolAttrappe();
    await expect(vierSchreiber(a.pool)).resolves.toBe("durch");
    expect(a.poolProtokoll).toEqual([]);
    expect(a.client[0]).toBe("BEGIN");
    expect(a.client[a.client.length - 1]).toBe("COMMIT");
    expect(zaehle(a.client, /^BEGIN$/)).toBe(1);
    expect(zaehle(a.client, /^COMMIT$/)).toBe(1);
    expect(zaehle(a.client, /^ROLLBACK$/)).toBe(0);
    expect(zaehle(a.client, /^UPDATE kos SET/)).toBe(1);
    expect(zaehle(a.client, /^INSERT INTO ko_versions/)).toBe(1);
    // Die Steuerzeilensperre der Projektion bleibt — jetzt in der Klammer des Aufrufers.
    expect(zaehle(a.client, /FROM ko_projection_control WHERE key=\$1 FOR SHARE/)).toBe(1);
    expect(zaehle(a.client, /^INSERT INTO ko_search_projections/)).toBe(1);
    expect(zaehle(a.client, /^INSERT INTO ko_metadata_projections/)).toBe(1);
    expect(zaehle(a.client, /^INSERT INTO audit/)).toBe(1);
    expect(a.freigegeben()).toBe(1);
  });

  it("P2 · DER ABBRUCH ZWISCHEN SCHRITT 1 UND 2: der Snapshot-INSERT scheitert — ROLLBACK, kein COMMIT, keine Projektion, kein Beleg", async () => {
    const a = poolAttrappe({ fehlerBei: /INSERT INTO ko_versions/ });
    await expect(vierSchreiber(a.pool)).rejects.toThrow(/ko_versions nicht erreichbar/);
    expect(a.client[0]).toBe("BEGIN");
    expect(a.client[a.client.length - 1]).toBe("ROLLBACK");
    expect(zaehle(a.client, /^COMMIT$/)).toBe(0);
    expect(zaehle(a.client, /^UPDATE kos SET/)).toBe(1);
    expect(zaehle(a.client, /^INSERT INTO ko_search_projections/)).toBe(0);
    expect(zaehle(a.client, /^INSERT INTO ko_metadata_projections/)).toBe(0);
    expect(zaehle(a.client, /^INSERT INTO audit/)).toBe(0);
    expect(a.poolProtokoll).toEqual([]);
    expect(a.freigegeben()).toBe(1);
  });

  it("P3 · GEGENPROBE ohne tx: die Projektion oeffnet wie bisher ihre eigene Transaktion — und seit JOB 2706 auch der kos-UPDATE (Schreibstand in derselben Klammer), nichts geht ueber den Pool", async () => {
    const a = poolAttrappe();
    const projections = new PgKoSearchProjectionRepo(a.pool);
    await projections.insert(buildSearchProjection(KO, "2026-08-29T12:00:01.000Z"));
    expect(a.client[0]).toBe("BEGIN");
    expect(a.client[a.client.length - 1]).toBe("COMMIT");
    expect(zaehle(a.client, /FOR SHARE/)).toBe(1);
    // JOB 2706 D2 (Nachzug dieses Pins): ohne tx laeuft der bedingte UPDATE nicht mehr als lose
    // Pool-Query, sondern in einer EIGENEN Transaktion zusammen mit `UPDATE ko_schreibstand` —
    // der Schreibstand der Anhang-Traegersuche muss mit den Daten gemeinsam sichtbar werden
    // (2685 D5, Weg A). Mit tx (P1) bleibt es der Client des Aufrufers.
    const vorher = a.client.length;
    await new PgKoRepo(a.pool).update(KO);
    const eigene = a.client.slice(vorher);
    expect(eigene[0]).toBe("BEGIN");
    expect(eigene[eigene.length - 1]).toBe("COMMIT");
    expect(zaehle(eigene, /^UPDATE kos SET/)).toBe(1);
    expect(zaehle(eigene, /^UPDATE ko_schreibstand SET stand = stand \+ 1/)).toBe(1);
    expect(a.poolProtokoll).toEqual([]);
  });
});
