// ================================================================================================
// JOB 3424 (Q2d) — DIE MESSUNG GEGEN ECHTES POSTGRES.
// ================================================================================================
//
// Der Live-Befund (Codex, 05.09. 20:43, Fassungen 1.103/1.105) hing an der DATENBANK: die Route
// antwortete beim ZWEITEN Import mit `externalId: ""` INTERNAL 500. Auf der In-Memory-Warteschlange
// ist der Fall nicht herstellbar (dort gibt es keinen UNIQUE-Index, ein `insert` kann nicht werfen)
// — die Route-Messung steht deshalb in `route-leere-kennung.test.ts`, die DB-Messung hier.
//
// WAS HIER GEMESSEN WIRD, in dieser Reihenfolge:
//   P0 — Was macht die GENERATED-Spalte `external_id` aus der leeren Zeichenkette? '' oder NULL?
//        Davon hängt alles Weitere ab: der partielle UNIQUE-Index greift bei `external_id IS NOT NULL`.
//   P1 — Zweimal `insert` mit `externalId: ""` — genau der Weg, den der Dienst für eine LEERE
//        Kennung nimmt (`item.externalId` ist falsy → plain insert, kein ON CONFLICT).
//   P2/P3 — dieselbe Messung für `null` und für eine FEHLENDE Kennung.
//   P4 — die Gegenrichtung: eine gefüllte Kennung bleibt der idempotente Anker-Strang.
//   P5 — Bestandsheilung: eine Instanz mit der ALTEN Spaltendefinition (und einer bereits
//        eingelagerten ''-Zeile) übersteht die Migration und nimmt danach den zweiten Import an.
//
// Läuft NUR unter `test:integration` (Docker/Testcontainers oder eine per KLARWERK_PG_TEST_URL
// angebotene lokale Testinstanz). Ohne beides wird EHRLICH übersprungen, nicht gefälscht — dieselbe
// Bauform wie `services/library-analytics/src/repo-pg.integration.test.ts`.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { IMPORT_CANDIDATES_SCHEMA, PgCandidateRepo } from "../../services/library-analytics";
import type { ImportCandidate, ImportItem } from "../../services/library-analytics";

/**
 * Die Spaltendefinition, mit der die Live-Instanz zum Zeitpunkt des Befunds lief: `external_id`
 * bildet die leere Zeichenkette UNVERÄNDERT ab. Sie dient P5 als Ausgangspunkt für die Heilung.
 */
const ALT_SPALTEN_DDL = `
CREATE TABLE IF NOT EXISTS import_candidates (
  id text PRIMARY KEY,
  data jsonb NOT NULL
);
ALTER TABLE import_candidates
  ADD COLUMN IF NOT EXISTS external_id text
  GENERATED ALWAYS AS (data->'item'->>'externalId') STORED;
`;

function kandidat(id: string, over: Partial<ImportItem>): ImportCandidate {
  const item: ImportItem = {
    title: "Ventil entlueften",
    statement: "Bei Ueberdruck das Ventil X langsam entlueften",
    type: "best_practice",
    category: "Wartung",
    sourceVersion: 1,
    provider: "Confluence",
    ...over,
  };
  return { id, item, status: "neu", duplicate: false, note: null, koId: null, createdAt: id };
}

describe("JOB 3424 · Q2d — leere externe Kennung gegen echtes Postgres", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    if (localUrl) {
      try {
        pool = new Pool({ connectionString: localUrl });
        await pool.query("SELECT 1");
        available = true;
        return;
      } catch {
        process.stderr.write(
          "[KLARWERK] Q2d-Pg-Messung UEBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung moeglich.\n",
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
        // Der Name ist NICHT frei gewählt: `tests/app/job2354-drei-datenbanknamen.test.ts` (E7)
        // hält fest, dass ALLE Wegwerf-Container GENAU EINEN Namen tragen, und dass dieser Name
        // das Wort `test` enthält — sonst weist `services/db-tx/src/pg-test-guard.ts` die
        // destruktive Pg-Suite ab. Ein zweiter Name macht dort N0/N3/N4 rot (so geschehen in
        // Runde 1 dieses Jobs mit `klarwerk`).
        .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
        .withExposedPorts(5432)
        .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
        .start();
      pool = new Pool({
        connectionString: `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`,
      });
      available = true;
    } catch {
      available = false;
    }
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  function requirePool(ctx: { skip: () => void }): Pool {
    if (!available || !pool) {
      ctx.skip();
      throw new Error("unreachable");
    }
    return pool;
  }

  /** Frische Tabelle mit der ECHTEN Migration — jeder Fall startet auf demselben Stand. */
  async function frisch(p: Pool): Promise<PgCandidateRepo> {
    await p.query("DROP TABLE IF EXISTS import_candidates");
    await p.query(IMPORT_CANDIDATES_SCHEMA);
    return new PgCandidateRepo(p);
  }

  it("P0 · die GENERATED-Spalte macht aus der leeren Kennung NULL — sonst greift der UNIQUE-Index", async (ctx) => {
    const p = requirePool(ctx);
    const repo = await frisch(p);
    await repo.insert(kandidat("a", { externalId: "" }));
    const res = await p.query<{ external_id: string | null }>(
      "SELECT external_id FROM import_candidates WHERE id='a'",
    );
    expect(
      res.rows[0]?.external_id,
      "Eine leere Kennung ist KEIN Anker — sonst belegt sie einen Idempotenzplatz, den der Dienst nie bedient.",
    ).toBeNull();
  });

  it('P1 · zweimal derselbe Import mit externalId "" — der zweite Insert wirft NICHT', async (ctx) => {
    const p = requirePool(ctx);
    const repo = await frisch(p);
    await repo.insert(kandidat("a", { externalId: "" }));
    await expect(
      repo.insert(kandidat("b", { externalId: "" })),
      "Genau hier entstand live der INTERNAL 500 (unique violation auf dem partiellen Index).",
    ).resolves.toBeUndefined();
    const anzahl = await p.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM import_candidates",
    );
    expect(anzahl.rows[0]?.n).toBe("2");
  });

  // `externalId: null` kommt ueber den Draht, ist im Typ `ImportItem` aber nicht vorgesehen
  // (`externalId?: string`). Damit die Messung den ECHTEN Drahtfall trifft und nicht bloss die
  // TypeScript-Sicht, wird das JSONB hier bewusst von Hand gebaut — dieselbe Anweisung, die
  // `PgCandidateRepo.insert` fährt, nur mit einem Feldwert, den der Typ nicht ausdrücken kann.
  async function insertMitJsonNull(p: Pool, id: string): Promise<void> {
    const roh = { ...kandidat(id, {}), item: { ...kandidat(id, {}).item, externalId: null } };
    await p.query("INSERT INTO import_candidates(id,data) VALUES($1,$2)", [
      id,
      JSON.stringify(roh),
    ]);
  }

  it("P2 · externalId null verhaelt sich genau wie die leere Zeichenkette", async (ctx) => {
    const p = requirePool(ctx);
    await frisch(p);
    await insertMitJsonNull(p, "a");
    await expect(insertMitJsonNull(p, "b")).resolves.toBeUndefined();
    const res = await p.query<{ external_id: string | null }>(
      "SELECT external_id FROM import_candidates WHERE id='a'",
    );
    expect(res.rows[0]?.external_id).toBeNull();
  });

  it("P3 · eine FEHLENDE externalId verhaelt sich genau wie die leere Zeichenkette", async (ctx) => {
    const p = requirePool(ctx);
    const repo = await frisch(p);
    const ohne = kandidat("a", {});
    await repo.insert(ohne);
    await expect(repo.insert({ ...ohne, id: "b" })).resolves.toBeUndefined();
    const res = await p.query<{ external_id: string | null }>(
      "SELECT external_id FROM import_candidates WHERE id='a'",
    );
    expect(res.rows[0]?.external_id).toBeNull();
  });

  it("P4 · eine GEFUELLTE Kennung bleibt unveraendert der idempotente Anker-Strang", async (ctx) => {
    const p = requirePool(ctx);
    const repo = await frisch(p);
    expect(await repo.insertIfAbsent(kandidat("a", { externalId: "p1" }))).toBe(true);
    expect(
      await repo.insertIfAbsent(kandidat("b", { externalId: "p1" })),
      "Der partielle UNIQUE-Index muss fuer eine ECHTE Kennung weiterhin greifen.",
    ).toBe(false);
    const anzahl = await p.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM import_candidates",
    );
    expect(anzahl.rows[0]?.n).toBe("1");
  });

  it("P5 · Bestandsinstanz mit ALTER Spalte und bereits eingelagerter ''-Zeile wird geheilt", async (ctx) => {
    const p = requirePool(ctx);
    await p.query("DROP TABLE IF EXISTS import_candidates");
    await p.query(ALT_SPALTEN_DDL);
    // Eine Zeile aus der Zeit VOR der Heilung — sie traegt '' in der Spalte.
    await p.query("INSERT INTO import_candidates(id,data) VALUES($1,$2)", [
      "alt",
      JSON.stringify(kandidat("alt", { externalId: "" })),
    ]);
    const vorher = await p.query<{ external_id: string | null }>(
      "SELECT external_id FROM import_candidates WHERE id='alt'",
    );
    expect(
      vorher.rows[0]?.external_id,
      "Vorbedingung: die ALTE Spalte speichert wirklich ''.",
    ).toBe("");

    // Die echte Migration laeuft ueber die Bestandsinstanz — ohne Crash.
    await expect(p.query(IMPORT_CANDIDATES_SCHEMA)).resolves.toBeDefined();

    const nachher = await p.query<{ external_id: string | null }>(
      "SELECT external_id FROM import_candidates WHERE id='alt'",
    );
    expect(nachher.rows[0]?.external_id, "Nach der Heilung ist '' zu NULL geworden.").toBeNull();

    // Und der zweite Import geht durch, statt an der Altzeile zu scheitern.
    const repo = new PgCandidateRepo(p);
    await expect(repo.insert(kandidat("neu", { externalId: "" }))).resolves.toBeUndefined();

    // Idempotent: ein zweiter Migrationslauf aendert nichts und wirft nicht.
    await expect(p.query(IMPORT_CANDIDATES_SCHEMA)).resolves.toBeDefined();
    const index = await p.query<{ n: string }>(
      "SELECT count(*)::text AS n FROM pg_indexes WHERE tablename='import_candidates' AND indexname='import_candidates_open_claim_external_uq'",
    );
    expect(index.rows[0]?.n, "Der partielle UNIQUE-Index steht nach der Heilung wieder.").toBe("1");
  });
});
