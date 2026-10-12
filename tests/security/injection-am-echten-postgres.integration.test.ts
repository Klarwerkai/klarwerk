// ================================================================================================
// AUFTRAG gesamt-sicherheit-erzwingen (R-0643, R-2059, NFR-SEC-04) — INJECTION AM ECHTEN POSTGRES.
// ================================================================================================
//
// DER BEFUND (Ben, Nacharbeit 3): Für Injection war kein ausgeführter Postgres-Prüfbericht
// zugeordnet. Die vorhandenen Belege prüfen den erzeugten SQL-TEXT über einen Pool-Ersatz
// (`repo-pg-candidates.test.ts`, `search-projection-repo-pg.test.ts`: „vollständig
// parametrisiert"). Ob eine echte Datenbank einen eingeschleusten Wert als Wert behandelt, sagt
// das nicht.
//
// WAS HIER GEPRÜFT WIRD: der Wissensobjekt-Speicher (`PgKoRepo`) mit den Eingaben, die von außen
// kommen — die Felder eines neuen Eintrags (Schreibweg) und die Filter von `GET /api/kos`
// (`type`, `status`, `category`, `tag`) sowie die Kennung des Detailabrufs. Jede Probe trägt eine
// GEGENPROBE: dieselbe Abfrage mit dem wörtlichen Wert findet genau den passenden Eintrag — ein
// leeres Ergebnis ist also kein leerer Bestand, sondern ein nicht interpretierter Wert.
//
// GRENZE, ausdrücklich: geprüft ist dieser eine Speicher. Die Suchprojektion
// (`KoSearchProjectionRepo.findActive`) und die übrigen Pg-Ablagen sind hier nicht abgedeckt.
//
// Läuft NUR unter `test:integration` (Testcontainers oder eine per KLARWERK_PG_TEST_URL angebotene
// lokale Testinstanz, abgesichert durch `guardedLocalPgTestUrl`). Ohne beides wird übersprungen;
// ein Überspringen ist KEIN Prüfbeleg.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { KO_SCHEMA, PgKoRepo } from "../../services/knowledge-object/src/repo-pg";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";

// Klassische Formen: Zeichenkettenausbruch, Tautologie, gestapelte Anweisung, Kommentar, JSONB-Ausbruch.
const AUSBRUCH = "x'); DROP TABLE kos; --";
const TAUTOLOGIE = "' OR '1'='1";
const STAPEL = "Wartung'; DELETE FROM kos WHERE '1'='1";
const JSON_AUSBRUCH = `"]'::jsonb OR true --`;

function ko(id: string, over: Partial<KnowledgeObject> = {}): KnowledgeObject {
  return {
    id,
    title: `T-${id}`,
    statement: "s",
    conditions: [],
    measures: [],
    type: "best_practice",
    category: "K",
    tags: [],
    confidence: 0,
    trust: 0,
    status: "offen",
    version: 1,
    originalAuthor: "a",
    author: "a",
    neededValidations: 1,
    assignments: [],
    asset: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    history: [],
    comments: [],
    attachments: [],
    sources: [],
    ...over,
  };
}

describe("R-0643 / NFR-SEC-04 · eingeschleustes SQL bleibt am echten Postgres ein Wert", () => {
  let container: StartedTestContainer | undefined;
  let pool: Pool | undefined;
  let available = false;

  beforeAll(async () => {
    const localUrl = guardedLocalPgTestUrl();
    let url: string | undefined = localUrl;
    if (!url) {
      if (process.env.KLARWERK_PG_TEST_URL) {
        // Gesetzt, aber von der Sicherung abgelehnt (Grund auf stderr) — kein Container-Ersatz.
        return;
      }
      try {
        container = await new GenericContainer("postgres:16-alpine")
          .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
          .withExposedPorts(5432)
          .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
          .start();
        url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
      } catch {
        return;
      }
    }
    try {
      pool = new Pool({ connectionString: url });
      await pool.query("SELECT 1");
      available = true;
    } catch {
      process.stderr.write(
        "[KLARWERK] Injection-Pg-Suite UEBERSPRUNGEN: keine Verbindung zur Testinstanz.\n",
      );
    }
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  async function frischerBestand(ctx: { skip: () => void }) {
    if (!available || !pool) {
      ctx.skip();
      throw new Error("unreachable");
    }
    await pool.query("DROP TABLE IF EXISTS kos CASCADE");
    await pool.query(KO_SCHEMA);
    const repo = new PgKoRepo(pool);
    await repo.insert(
      ko("ko-ausbruch", {
        title: AUSBRUCH,
        statement: TAUTOLOGIE,
        category: STAPEL,
        tags: [JSON_AUSBRUCH],
      }),
    );
    await repo.insert(ko("ko-normal", { title: "Filter tauschen", category: "Wartung" }));
    return { p: pool, repo };
  }

  async function tabelleSteht(p: Pool): Promise<number> {
    const da = await p.query<{ t: string | null }>("SELECT to_regclass('kos')::text AS t");
    expect(da.rows[0]?.t, "die Tabelle kos muss nach jeder Probe noch stehen").toBe("kos");
    const n = await p.query<{ n: number }>("SELECT count(*)::int AS n FROM kos");
    return n.rows[0]?.n ?? -1;
  }

  it("Schreibweg: die Nutzlast landet wörtlich im Bestand, nichts wird ausgeführt", async (ctx) => {
    const { p, repo } = await frischerBestand(ctx);

    const gelesen = await repo.findById("ko-ausbruch");
    expect(gelesen?.title).toBe(AUSBRUCH);
    expect(gelesen?.statement).toBe(TAUTOLOGIE);
    expect(gelesen?.category).toBe(STAPEL);
    expect(gelesen?.tags).toEqual([JSON_AUSBRUCH]);
    // Die Kategorie-Spalte (eigene Spalte, nicht nur JSONB) trägt den Wert ebenso wörtlich.
    const sql = "SELECT category FROM kos WHERE id=$1";
    const spalte = await p.query<{ category: string }>(sql, ["ko-ausbruch"]);
    expect(spalte.rows[0]?.category).toBe(STAPEL);
    expect(await tabelleSteht(p)).toBe(2);
  });

  it("Detailabruf: eine Tautologie als Kennung findet nichts — Gegenprobe: die echte Kennung schon", async (ctx) => {
    const { p, repo } = await frischerBestand(ctx);

    expect(await repo.findById(`ko-normal${TAUTOLOGIE}`)).toBeUndefined();
    expect(await repo.findById(TAUTOLOGIE)).toBeUndefined();
    expect((await repo.findById("ko-normal"))?.title).toBe("Filter tauschen");
    expect(await tabelleSteht(p)).toBe(2);
  });

  it("Listenfilter: Tautologie, Stapel und JSONB-Ausbruch öffnen den Bestand nicht", async (ctx) => {
    const { p, repo } = await frischerBestand(ctx);

    // Kalibrierung: ohne Filter ist der Bestand sichtbar — ein leeres Ergebnis unten ist echt.
    expect((await repo.list({})).map((k) => k.id).sort()).toEqual(["ko-ausbruch", "ko-normal"]);

    expect(await repo.list({ category: TAUTOLOGIE })).toEqual([]);
    expect(await repo.list({ category: "Wartung' OR '1'='1" })).toEqual([]);
    expect(await repo.list({ tag: JSON_AUSBRUCH.replace("]", "x]") })).toEqual([]);
    expect(await repo.list({ type: `best_practice${TAUTOLOGIE}` as never })).toEqual([]);
    expect(await repo.list({ status: `offen${TAUTOLOGIE}` as never })).toEqual([]);
    expect(await repo.listForSearch({ category: TAUTOLOGIE })).toEqual([]);

    // Der gestapelte DELETE als Filterwert: nichts gelöscht.
    expect(await repo.list({ category: "x'; DELETE FROM kos; --" })).toEqual([]);
    expect(await tabelleSteht(p)).toBe(2);
  });

  it("Gegenprobe: derselbe Wert wörtlich als Filter trifft genau den Eintrag, der ihn trägt", async (ctx) => {
    const { p, repo } = await frischerBestand(ctx);

    expect((await repo.list({ category: STAPEL })).map((k) => k.id)).toEqual(["ko-ausbruch"]);
    expect((await repo.list({ tag: JSON_AUSBRUCH })).map((k) => k.id)).toEqual(["ko-ausbruch"]);
    expect((await repo.list({ category: "Wartung" })).map((k) => k.id)).toEqual(["ko-normal"]);
    expect(await tabelleSteht(p)).toBe(2);
  });
});
