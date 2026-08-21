import type { Pool } from "pg";
// ================================================================================================
// JOB 1531 · D2 (M-5, Anker S2) — DER ZWEITE ADAPTER RUFT SIE AUCH AUF.
// ================================================================================================
//
// Die Lease nennt **zwei** Adapter. `s2-adapter-aufruf.test.ts` belegt den In-Memory-Weg an einem
// echten Suchtreffer. Der Postgres-Weg braucht keine Datenbank, um dieselbe Frage zu beantworten:
// **Welche Begriffe schickt er an die Abfrage?**
//
// Gemessen wird deshalb die PARAMETERLISTE der erzeugten SQL-Anweisung — mit demselben
// aufzeichnenden Doppelgaenger, den `tests/ko/g27-welle1-pg-paritaet.test.ts:58-77` benutzt.
//
// WARUM DAS WICHTIG IST UND NICHT NUR SYMMETRIE: Liefe die Zuordnung nur im In-Memory-Adapter,
// faende „klep" das „Ventil" auf dem Entwicklerrechner und im Betrieb nicht — der Unterschied
// waere erst beim Kunden sichtbar. Dieselbe Sorte Abweichung hat JOB 537 D2 eine Runde gekostet.
import { describe, expect, it } from "vitest";
import { PgKoSearchProjectionRepo } from "../../services/knowledge-object/src/search-projection-repo-pg";

// Die Spaltennamen sind die des Adapters (`ausControlZeile`, search-projection-repo-pg.ts:227-239)
// — nicht erfunden. `projection_state` heisst dort so und nicht `state`; mit dem falschen Namen
// meldet der Adapter „Suchprojektion nicht freigegeben (Zustand undefined)" (gemessen).
// Uebernommen aus `tests/ko/g27-welle1-pg-paritaet.test.ts:42-56` — nicht erfunden. Eine Zeile im
// Normalbetrieb braucht Fassung UND Generation UND einen Marker, der fuer GENAU diese Generation
// gilt; fehlt eines, ist die Instanz fail-closed und die Suchabfrage laeuft gar nicht erst
// (gemessen: „Integritaetsmarker ungueltig (Generation 1)").
const AKTIVE_GENERATION = 5;
const STEUERZEILE_V2_ACTIVE = {
  active_projection_version: 2,
  target_projection_version: 2,
  projection_state: "V2_ACTIVE",
  last_successful_rebuild: "2026-08-01T00:00:00.000Z",
  last_reconcile: "2026-08-01T00:00:00.000Z",
  last_failure: null,
  build_started_at: "2026-08-01T00:00:00.000Z",
  build_finished_at: "2026-08-01T00:00:00.000Z",
  build_generation: AKTIVE_GENERATION,
  active_generation: AKTIVE_GENERATION,
  integrity_marker: `V2-READY:${AKTIVE_GENERATION}`,
  activated_at: "2026-08-01T00:00:00.000Z",
};

function fakePool(rows: Record<string, unknown>[] = []) {
  const calls: { sql: string; params: unknown[] }[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes("ko_projection_control")) {
      return { rows: [STEUERZEILE_V2_ACTIVE], rowCount: 1 };
    }
    return { rows, rowCount: rows.length };
  };
  const pool = {
    query,
    connect: async () => ({ query, release: () => undefined }),
  } as unknown as Pool;
  return { pool, calls };
}

/** Die Suchabfrage selbst — ohne den vorangestellten Blick auf die Steuerzeile. */
function suchAbfrage(calls: { sql: string; params: unknown[] }[]) {
  return calls.find((c) => !c.sql.includes("ko_projection_control")) as {
    sql: string;
    params: unknown[];
  };
}

/** Die Suchbegriffe unter den Parametern — sie reisen als `%begriff%` in die ILIKE-Bedingungen. */
function begriffeIn(params: unknown[]): string[] {
  return params
    .filter((p): p is string => typeof p === "string" && p.startsWith("%") && p.endsWith("%"))
    .map((p) => p.slice(1, -1));
}

describe("S2 · P — der Postgres-Adapter schickt die ergaenzten Begriffe mit", () => {
  it('P1 · KERNFALL: eine Suche nach „klep" fuehrt „ventil" in der Parameterliste', async () => {
    // Der Beleg fuer den zweiten Adapter. Ohne den Aufruf enthielte die Liste nur „klep".
    const { pool, calls } = fakePool();
    await new PgKoSearchProjectionRepo(pool).findActive({ terms: ["klep"] });
    const begriffe = begriffeIn(suchAbfrage(calls).params);
    expect(begriffe).toContain("klep");
    expect(begriffe).toContain("ventil");
  });

  it("P2 · die Begriffe bleiben Parameter, nie SQL-Text", async () => {
    // Die Zuordnung darf die Parametrisierung nicht aufweichen: mehr Begriffe heisst mehr
    // Platzhalter, nicht interpolierter Text.
    const { pool, calls } = fakePool();
    await new PgKoSearchProjectionRepo(pool).findActive({ terms: ["klep"] });
    const { sql } = suchAbfrage(calls);
    expect(sql).not.toContain("ventil");
    expect(sql).toContain("ILIKE");
  });

  it("P3 · ein Wort ohne Zuordnung bringt keine zusaetzlichen Begriffe", async () => {
    const { pool, calls } = fakePool();
    await new PgKoSearchProjectionRepo(pool).findActive({ terms: ["dichtung"] });
    expect(new Set(begriffeIn(suchAbfrage(calls).params))).toEqual(new Set(["dichtung"]));
  });

  it("P4 · die Bereinigung bleibt davor — Grossschreibung kommt klein an", async () => {
    const { pool, calls } = fakePool();
    await new PgKoSearchProjectionRepo(pool).findActive({ terms: ["  KLEP  "] });
    const begriffe = begriffeIn(suchAbfrage(calls).params);
    expect(begriffe).toContain("klep");
    expect(begriffe).toContain("ventil");
    expect(begriffe).not.toContain("  KLEP  ");
  });

  it("P5 · eine leere Anfrage erzeugt gar keine Suchabfrage", async () => {
    // Die Leermengenentscheidung steht hinter dem Aufruf und bleibt wirksam.
    const { pool, calls } = fakePool();
    expect(await new PgKoSearchProjectionRepo(pool).findActive({ terms: ["   "] })).toEqual([]);
    expect(suchAbfrage(calls)).toBeUndefined();
  });
});
