import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../db-tx";
import { InMemoryKoVersionRepo } from "./repo";
import { KO_VERSIONS_SCHEMA, PgKoVersionRepo } from "./repo-pg";
import type { KnowledgeObject, KoVersionSnapshot } from "./types";

// R-1630 / R-2176 (BEN, Nacharbeit 4): die Nachsuche über Fassungen bis zum Stichtag gegen echtes
// Postgres — und gegen den Speicheradapter mit DENSELBEN Fassungen, damit beide Adapter dieselbe
// Regel tragen. Aufbau wie `repo-pg.integration.test.ts`: lokale Testinstanz (mit Sicherung) oder
// Testcontainers; ohne beides wird sauber übersprungen, nie gefälscht.

function fassung(koId: string, version: number, at: string, over: Partial<KnowledgeObject>) {
  const snapshot: KnowledgeObject = {
    id: koId,
    title: "Ohne Begriff",
    statement: "Ohne Begriff.",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "Anlage 1",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version,
    originalAuthor: "a",
    author: "a",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: "2025-03-01T09:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...over,
  };
  const eintrag: KoVersionSnapshot = { koId, version, snapshot, at, author: "a", note: "n" };
  return eintrag;
}

// ko-a: Fassung 1 (vor dem Stichtag) trägt „ventil" im Titel, Fassung 2 (danach) nicht mehr.
// ko-b: trägt „ventil" erst ab Fassung 2 — nach dem Stichtag, darf also NICHT kommen.
// ko-c: trägt „überdruck" nur im Dokumentkörper vor dem Stichtag.
const FASSUNGEN = [
  fassung("ko-a", 1, "2025-03-01T09:00:00.000Z", { title: "Ventil bei Überdruck schließen" }),
  fassung("ko-a", 2, "2026-02-01T09:00:00.000Z", { title: "Absperrorgan" }),
  fassung("ko-b", 1, "2025-03-01T09:00:00.000Z", {}),
  fassung("ko-b", 2, "2026-02-01T09:00:00.000Z", { title: "Ventil neu" }),
  fassung("ko-c", 1, "2025-03-01T09:00:00.000Z", { bodyHtml: "<p>bei überdruck melden.</p>" }),
];
const SUCHE = {
  terms: ["ventil", "überdruck"],
  bisAt: "2025-10-08T10:00:00.000Z",
  limit: 50,
};

describe("R-1630 / R-2176 · Nachsuche über Fassungen bis zum Stichtag", () => {
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
      } catch {
        available = false;
      }
      return;
    }
    if (process.env.KLARWERK_PG_TEST_URL) {
      available = false;
      return;
    }
    try {
      container = await new GenericContainer("postgres:16-alpine")
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

  it("Speicheradapter: nur Fassungen bis zum Stichtag, Treffer auch im Dokumenttext", async () => {
    const repo = new InMemoryKoVersionRepo();
    for (const f of FASSUNGEN) {
      await repo.append(f);
    }
    expect(await repo.findKoIdsInFassungen(SUCHE)).toEqual(["ko-a", "ko-c"]);
    expect(await repo.findKoIdsInFassungen({ ...SUCHE, limit: 1 })).toEqual(["ko-a"]);
    expect(await repo.findKoIdsInFassungen({ ...SUCHE, terms: [] })).toEqual([]);
  });

  it("PostgreSQL: dieselbe Auswahl wie der Speicheradapter", async (ctx) => {
    if (!available || !pool) {
      ctx.skip();
      return;
    }
    await pool.query("DROP TABLE IF EXISTS ko_versions CASCADE");
    await pool.query(KO_VERSIONS_SCHEMA);
    // Direkt eingefügt: `append` fortzuschreiben verlangte zusätzlich die Schreibstandtabelle,
    // die hier nichts zur Aussage beiträgt.
    for (const f of FASSUNGEN) {
      await pool.query(
        "INSERT INTO ko_versions(ko_id,version,snapshot,at,author,note) VALUES($1,$2,$3,$4,$5,$6)",
        [f.koId, f.version, JSON.stringify(f.snapshot), f.at, f.author, f.note],
      );
    }
    const repo = new PgKoVersionRepo(pool);
    expect(await repo.findKoIdsInFassungen(SUCHE)).toEqual(["ko-a", "ko-c"]);
    expect(await repo.findKoIdsInFassungen({ ...SUCHE, limit: 1 })).toEqual(["ko-a"]);
    // Ein Suchbegriff mit Musterzeichen wird nicht als Muster gelesen.
    expect(await repo.findKoIdsInFassungen({ ...SUCHE, terms: ["%"] })).toEqual([]);
  });
});
