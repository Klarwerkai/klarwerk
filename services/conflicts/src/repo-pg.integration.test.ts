import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../db-tx";
import { OVERLAP_SCHEMA, PgOverlapRepo } from "./overlap-repo-pg";
import type { OverlapEntry } from "./overlap-types";
import { CONFLICTS_SCHEMA, PgConflictRepo } from "./repo-pg";
import type { Conflict } from "./types";

// D-AISTATE PAKET 4 (bens V5, aistate-fix4): echte Postgres-Belege für den ATOMAREN,
// versionsgebundenen Insert (insertIfVersionsCurrent) — das Versions-Prädikat steht als
// WHERE-Bedingung IM Insert; ein zwischenzeitlich revidiertes KO lässt den Insert scheitern,
// ohne dass je ein Datensatz committed wird. Muster/Gating wie repo-pg.integration.test.ts im
// knowledge-object-Modul: braucht Docker (Testcontainers) bzw. KLARWERK_PG_TEST_URL, läuft NUR
// unter `test:integration`, wird ohne Infrastruktur sauber übersprungen, nie gefälscht.
// Die kos-Tabelle wird hier als minimaler Stand-in angelegt (id + data->>'version' — genau die
// Fläche, die das Prädikat liest); die echte Tabelle des KO-Moduls ist strukturell identisch.
const KOS_STANDIN_SCHEMA = `
CREATE TABLE IF NOT EXISTS kos (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
`;

function conflict(id: string, over: Partial<Conflict> = {}): Conflict {
  return {
    id,
    koA: "a",
    koB: "b",
    type: "truth",
    description: "Widerspruch",
    status: "offen",
    secondOpinion: null,
    decidedBy: null,
    decision: null,
    origin: "auto",
    createdAt: "2026-07-23T00:00:00.000Z",
    ...over,
  };
}

function overlap(id: string, over: Partial<OverlapEntry> = {}): OverlapEntry {
  return {
    id,
    koA: "a",
    koB: "b",
    relation: "identisch",
    aspects: [],
    eigenanteilA: "",
    eigenanteilB: "",
    recommendation: "zusammenfuehren",
    status: "offen",
    pairKey: "a|b",
    origin: "auto",
    createdAt: "2026-07-23T00:00:00.000Z",
    ...over,
  };
}

describe("aistate-fix4 (bens V5): insertIfVersionsCurrent gegen echtes Postgres", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;

  beforeAll(async () => {
    // Lokale Instanz hat Vorrang (Docker-lose Evidence-Läufe); sonst Testcontainers; sonst Skip.
    // Die lokale URL läuft durch die Sicherung in pg-test-guard — nie eine echte DB.
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
        available = true;
        return;
      } catch {
        process.stderr.write(
          "[KLARWERK] Pg-Integrationssuite ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
        );
        available = false;
        return;
      }
    }
    if (process.env.KLARWERK_PG_TEST_URL) {
      available = false;
      return;
    }
    try {
      container = await new GenericContainer("postgres:16-alpine")
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      pool = new Pool({
        connectionString: `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk`,
      });
      available = true;
    } catch {
      available = false; // kein Docker/PG → skip statt Fehlschlag
    }
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  function requirePool(ctx: { skip: () => void }): Pool {
    if (!available || !pool) {
      ctx.skip();
      throw new Error("unreachable"); // ctx.skip() bricht ab; nur fürs Typing
    }
    return pool;
  }

  async function reset(p: Pool): Promise<void> {
    await p.query("DROP TABLE IF EXISTS conflicts CASCADE");
    await p.query("DROP TABLE IF EXISTS ko_overlaps CASCADE");
    await p.query("DROP TABLE IF EXISTS kos CASCADE");
    await p.query(KOS_STANDIN_SCHEMA);
    await p.query(CONFLICTS_SCHEMA);
    await p.query(OVERLAP_SCHEMA);
    await p.query("INSERT INTO kos(id,data) VALUES('a','{\"version\":2}'),('b','{\"version\":3}')");
  }

  // Das Prädikat muss die Autorität der DB nutzen — ein (veraltetes) isCurrent-Urteil des
  // Aufrufers darf den Insert NIE tragen. Deshalb lügt der Callback hier bewusst "true".
  const luegnerischesIsCurrent = () => true;

  it("Konflikt: beide gebundenen Versionen aktuell ⇒ Insert committet genau einen offenen Datensatz", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const repo = new PgConflictRepo(p);
    const ok = await repo.insertIfVersionsCurrent(
      conflict("c1", { koAVersion: 2, koBVersion: 3 }),
      luegnerischesIsCurrent,
    );
    expect(ok).toBe(true);
    const rows = await p.query("SELECT data FROM conflicts");
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].data.status).toBe("offen");
  });

  it("Konflikt: eine Seite revidiert ⇒ rowCount 0, GAR KEIN Datensatz — auch wenn isCurrent 'true' lügt", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const repo = new PgConflictRepo(p);
    // b steht in der DB auf Version 3 — der Lauf ist an Version 2 gebunden (stale).
    const ok = await repo.insertIfVersionsCurrent(
      conflict("c2", { koAVersion: 2, koBVersion: 2 }),
      luegnerischesIsCurrent,
    );
    expect(ok).toBe(false);
    expect((await p.query("SELECT id FROM conflicts")).rowCount).toBe(0);
  });

  it("Konflikt: KO fehlt oder Versionsbindung fehlt ⇒ fail-closed kein Insert", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const repo = new PgConflictRepo(p);
    const geist = await repo.insertIfVersionsCurrent(
      conflict("c3", { koB: "geist", koAVersion: 2, koBVersion: 1 }),
      luegnerischesIsCurrent,
    );
    expect(geist).toBe(false);
    const ungebunden = await repo.insertIfVersionsCurrent(conflict("c4"), luegnerischesIsCurrent);
    expect(ungebunden).toBe(false);
    expect((await p.query("SELECT id FROM conflicts")).rowCount).toBe(0);
  });

  it("Overlap: aktuell ⇒ Insert; revidiert ⇒ rowCount 0, GAR KEIN Datensatz", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const repo = new PgOverlapRepo(p);
    expect(
      await repo.insertIfVersionsCurrent(
        overlap("o1", { koAVersion: 2, koBVersion: 3 }),
        luegnerischesIsCurrent,
      ),
    ).toBe(true);
    expect(
      await repo.insertIfVersionsCurrent(
        overlap("o2", { koAVersion: 1, koBVersion: 3 }),
        luegnerischesIsCurrent,
      ),
    ).toBe(false);
    const rows = await p.query("SELECT id FROM ko_overlaps ORDER BY id");
    expect(rows.rowCount).toBe(1);
    expect(rows.rows[0].id).toBe("o1");
  });

  // aistate-fix6 (bens fix5-Recheck §4): der Lese-GC-STATUS-CAS gegen ECHTES Postgres — das bedingte
  // UPDATE gewinnt nur, solange die Zeile offen ist; PostgreSQLs Zeilensperre liefert unter echter
  // Nebenläufigkeit genau EINEN Gewinner (kein Mehrfach-Schließen, kein Lost Update).
  const supersededConflict: Partial<Conflict> = {
    status: "geloest",
    decidedBy: null,
    resolutionReason: "superseded",
  };
  const supersededOverlap: Partial<OverlapEntry> = {
    status: "geschlossen",
    resolution: { reason: "superseded", by: null, note: null, at: "2026-07-24T00:00:00.000Z" },
    closedAt: "2026-07-24T00:00:00.000Z",
  };

  it("Konflikt-CAS: offen ⇒ genau EIN Gewinner unter Nebenläufigkeit; ein zweiter Lauf no-op", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const repo = new PgConflictRepo(p);
    await repo.insert(conflict("cas1", { koAVersion: 2, koBVersion: 3 }));
    // Zwei parallel ausgeführte CAS-Statements auf DERSELBEN offenen Zeile.
    const [a, b] = await Promise.all([
      repo.supersedeIfOpen("cas1", supersededConflict),
      repo.supersedeIfOpen("cas1", supersededConflict),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1); // exakt EIN Gewinner
    const row = (await p.query("SELECT data FROM conflicts WHERE id='cas1'")).rows[0].data;
    expect(row.status).toBe("geloest");
    expect(row.resolutionReason).toBe("superseded");
    expect(row.decidedBy).toBeNull();
    // Ein weiterer Lauf schließt nichts erneut (bereits geschlossen ⇒ false).
    expect(await repo.supersedeIfOpen("cas1", supersededConflict)).toBe(false);
  });

  it("Konflikt-CAS: eine menschliche Entscheidung (Status ≠ offen) gewinnt ⇒ GC no-op, kein Overwrite", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const repo = new PgConflictRepo(p);
    // Mensch hat bereits eskaliert — der GC darf das NICHT als superseded überschreiben.
    await repo.insert(
      conflict("cas2", { koAVersion: 2, koBVersion: 3, status: "eskaliert", decidedBy: "mensch" }),
    );
    expect(await repo.supersedeIfOpen("cas2", supersededConflict)).toBe(false);
    const row = (await p.query("SELECT data FROM conflicts WHERE id='cas2'")).rows[0].data;
    expect(row.status).toBe("eskaliert");
    expect(row.decidedBy).toBe("mensch");
  });

  it("Overlap-CAS: offen ⇒ genau EIN Gewinner unter Nebenläufigkeit; ein zweiter Lauf no-op", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const repo = new PgOverlapRepo(p);
    await repo.insert(overlap("ocas1", { koAVersion: 2, koBVersion: 3 }));
    const [a, b] = await Promise.all([
      repo.supersedeIfOpen("ocas1", supersededOverlap),
      repo.supersedeIfOpen("ocas1", supersededOverlap),
    ]);
    expect([a, b].filter(Boolean)).toHaveLength(1);
    const row = (await p.query("SELECT data FROM ko_overlaps WHERE id='ocas1'")).rows[0].data;
    expect(row.status).toBe("geschlossen");
    expect(row.resolution.reason).toBe("superseded");
    expect(row.resolution.by).toBeNull();
    expect(await repo.supersedeIfOpen("ocas1", supersededOverlap)).toBe(false);
  });
});
