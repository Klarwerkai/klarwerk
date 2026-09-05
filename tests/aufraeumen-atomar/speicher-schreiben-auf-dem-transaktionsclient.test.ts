import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import type { Conflict, OverlapEntry } from "../../services/conflicts";
import {
  CONFLICTS_SCHEMA,
  OVERLAP_SCHEMA,
  PgConflictRepo,
  PgOverlapRepo,
} from "../../services/conflicts";
import { withPgTx } from "../../services/db-tx";

// ================================================================================================
// JOB 3066 · F2b — DIE ANWEISUNG GEHT AN DEN CLIENT DER TRANSAKTION, NICHT AN DEN POOL.
// ================================================================================================
//
// F3 (services/conflicts/src/purge-atomar.integration.test.ts) beweist die ECHTE Commit-/Rollback-
// Grenze, braucht dafür aber Docker oder eine lokale Postgres-Instanz und wird ohne sie sauber
// übersprungen. Was ohne Datenbank trotzdem messbar ist — und was die Weiche wirklich ausmacht —
// ist die ADRESSE der Anweisung: mit `tx` muss sie auf DEM Client laufen, den `withPgTx` per
// BEGIN geöffnet hat, ohne `tx` weiter am Pool.
//
// Die Attrappe ist bewusst nur die Fläche, die `withPgTx` und die Adapter benutzen (`connect`,
// `query`, `release`). Sie bildet KEINE Transaktionssemantik nach und behauptet auch keine — was
// sie zeigt, ist ausschliesslich, wohin die Anweisungen gehen. Alles Weitere misst F3.
describe("JOB 3066 · F2b: PgOverlapRepo/PgConflictRepo schreiben und lesen auf dem tx-Client", () => {
  interface Ruf {
    ziel: "pool" | "client";
    sql: string;
  }

  function attrappenPool() {
    const rufe: Ruf[] = [];
    const antwort = { rows: [] as unknown[], rowCount: 0 };
    const client = {
      query: (text: string) => {
        rufe.push({ ziel: "client", sql: text });
        return Promise.resolve(antwort);
      },
      release: () => undefined,
    };
    const pool = {
      query: (text: string) => {
        rufe.push({ ziel: "pool", sql: text });
        return Promise.resolve(antwort);
      },
      connect: () => Promise.resolve(client),
    };
    return { pool: pool as unknown as Pool, rufe };
  }

  const eintrag: OverlapEntry = {
    id: "o1",
    koA: "a",
    koB: "b",
    relation: "identisch",
    aspects: [],
    eigenanteilA: "",
    eigenanteilB: "",
    recommendation: "zusammenfuehren",
    status: "geschlossen",
    pairKey: "a|b",
    origin: "auto",
    createdAt: "2026-09-04T00:00:00.000Z",
  };

  const konflikt: Conflict = {
    id: "c1",
    koA: "a",
    koB: "b",
    type: "truth",
    description: "Widerspruch",
    status: "geloest",
    secondOpinion: null,
    decidedBy: null,
    decision: null,
    origin: "auto",
    createdAt: "2026-09-04T00:00:00.000Z",
  };

  it("Überschneidungen: mit tx geht KEINE Anweisung an den Pool", async () => {
    const { pool, rufe } = attrappenPool();
    const repo = new PgOverlapRepo(pool);

    await withPgTx(pool, async (tx) => {
      await repo.closeOpenForKo("a", { status: "geschlossen" }, tx);
    });

    expect(rufe.filter((r) => r.ziel === "pool")).toEqual([]);
    const aufDemClient = rufe.filter((r) => r.ziel === "client").map((r) => r.sql.trim());
    expect(aufDemClient[0]).toBe("BEGIN");
    expect(aufDemClient.some((s) => s.startsWith("UPDATE ko_overlaps"))).toBe(true);
    expect(aufDemClient[aufDemClient.length - 1]).toBe("COMMIT");
  });

  it("Konflikte: mit tx geht KEINE Anweisung an den Pool", async () => {
    const { pool, rufe } = attrappenPool();
    const repo = new PgConflictRepo(pool);

    await withPgTx(pool, async (tx) => {
      await repo.closeOpenForKo("a", { status: "geloest" }, tx);
    });

    expect(rufe.filter((r) => r.ziel === "pool")).toEqual([]);
    const aufDemClient = rufe.filter((r) => r.ziel === "client").map((r) => r.sql.trim());
    expect(aufDemClient.some((s) => s.startsWith("UPDATE conflicts"))).toBe(true);
  });

  // Die Gegenrichtung gehört dazu: ohne tx darf sich NICHTS geändert haben (Bestandsverhalten) —
  // und die Wege, die NIE zu einem fremden Vorgang gehören, laufen weiterhin am Pool.
  it("ohne tx laufen beide Speicher unverändert am Pool", async () => {
    const { pool, rufe } = attrappenPool();
    await new PgOverlapRepo(pool).all();
    await new PgOverlapRepo(pool).update(eintrag);
    await new PgOverlapRepo(pool).closeOpenForKo("a", { status: "geschlossen" });
    await new PgConflictRepo(pool).all();
    await new PgConflictRepo(pool).update(konflikt);
    await new PgConflictRepo(pool).closeOpenForKo("a", { status: "geloest" });

    expect(rufe.filter((r) => r.ziel === "client")).toEqual([]);
    expect(rufe).toHaveLength(6);
  });

  // R4 (bens Korrekturpflicht 1 zu R3): der Schliess-Schritt im Transaktionskörper trägt sein
  // Prädikat im Statement und schreibt in DEMSELBEN. Er holt weder die ganze Tabelle noch schreibt
  // er je Treffer — das waren die zwei Stellen, an denen die Arbeit im gehaltenen
  // Transaktionskörper wuchs (mit der Instanz beziehungsweise mit der Trefferzahl).
  it("das Schliessen ist EIN Statement: Prädikat, Merge und Rückgabe zusammen", async () => {
    const { pool, rufe } = attrappenPool();

    await withPgTx(pool, async (tx) => {
      await new PgOverlapRepo(pool).closeOpenForKo("ko-7", { status: "geschlossen" }, tx);
      await new PgConflictRepo(pool).closeOpenForKo("ko-7", { status: "geloest" }, tx);
    });

    const fachlich = rufe
      .filter((r) => r.ziel === "client")
      .map((r) => r.sql.trim())
      .filter((s) => s !== "BEGIN" && s !== "COMMIT");
    // Zwei Anweisungen für zwei Speicher — kein SELECT davor, kein UPDATE je Treffer danach.
    expect(fachlich).toHaveLength(2);
    for (const sql of fachlich) {
      expect(sql.startsWith("UPDATE")).toBe(true);
      expect(sql).toContain("data = data || $2::jsonb");
      expect(sql).toContain("data->>'koA' = $1");
      expect(sql).toContain("data->>'koB' = $1");
      expect(sql).toMatch(/coalesce\(data->>'status', 'offen'\) <> '(geschlossen|geloest)'/);
      // Die Rückgabe kommt aus derselben Anweisung — sonst wäre ein zweites Lesen nötig.
      expect(sql).toContain("RETURNING data");
    }
    // Und kein Statement ohne WHERE — ein „UPDATE … SET data" ohne Prädikat wäre der Rückfall,
    // und zwar der schlimmste: er schlösse die Befunde ALLER Beiträge.
    expect(fachlich.some((s) => !s.includes("WHERE"))).toBe(false);
  });

  // R4 (bens Korrekturpflicht 4 zu R3): das Prädikat oben braucht einen Index, sonst ist es im
  // gehaltenen Transaktionskörper ein Seq Scan über den GESAMTEN Bestand. Was hier geprüft wird,
  // ist die Voraussetzung — dass die Migration je Suchfeld einen Ausdrucks-Index anlegt, der
  // GENAU dem Ausdruck im WHERE entspricht. Ob der Planer ihn wählt, ist damit NICHT gemessen:
  // das braucht eine laufende Instanz (EXPLAIN ANALYZE) und steht als offene Prüflücke.
  it("die Migration legt zu beiden Suchfeldern einen Ausdrucks-Index an", () => {
    for (const [schema, tabelle] of [
      [OVERLAP_SCHEMA, "ko_overlaps"],
      [CONFLICTS_SCHEMA, "conflicts"],
    ] as const) {
      for (const feld of ["koA", "koB"]) {
        expect(schema, `${tabelle}: Index auf data->>'${feld}' fehlt`).toContain(
          `ON ${tabelle} ((data->>'${feld}'))`,
        );
      }
      // Wiederholbar wie jede Stufe der Migration — sie läuft bei jedem Start.
      expect(schema.match(/CREATE INDEX IF NOT EXISTS/g) ?? []).toHaveLength(2);
    }
  });
});
