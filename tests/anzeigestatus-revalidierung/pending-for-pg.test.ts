// ================================================================================================
// JOB 3054 · R-8 — DER POSTGRES-ADAPTER DER MERKERABFRAGE, AN SEINER ANWEISUNG GEMESSEN.
// ================================================================================================
//
// WARUM EIN FAKE-POOL UND KEIN SERVER. Ein echter Postgres-Lauf steht in dieser Abnahme nicht zur
// Verfuegung (Integrationstests laufen getrennt ueber Testcontainers). Was sich OHNE Server pruefen
// laesst, ist genau das, was die zwei Zusagen dieses Auftrags tragen: WIE VIELE Anweisungen der
// Adapter absetzt, WELCHE — und dass keine davon schreibt. Eine Schleife ueber `pending()` oder ein
// `DELETE` saehe von der API-Ebene aus wie eine Mengenabfrage; hier faellt es auf.
//
// Muster: `services/knowledge-object/src/repo-pg-search.test.ts` (Fake-Pool, SQL + Parameter
// mitgeschrieben) und `tests/anzeigestatus-liste/kos-liste-anzeigestatus.test.ts` (L11).
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
// Ueber die Modulfassade, wie jeder Aufrufer — keine Kante in `services/lifecycle/src/**`.
import { PgLifecycleRepo } from "../../services/lifecycle";

/** Eine abgesetzte SQL-Anweisung, so wie der Adapter sie dem Pool gibt. */
interface Anweisung {
  readonly sql: string;
  readonly parameter: readonly unknown[];
}

/**
 * Ein Pool, der nur MITSCHREIBT. Er entscheidet nichts (er liefert die vorgegebenen Zeilen);
 * Gegenstand ist allein, welche Anweisungen der Adapter absetzt und wie viele.
 */
function beobachteterPool(zeilen: { ko_id: string }[]): {
  anweisungen: Anweisung[];
  pool: Pool;
} {
  const anweisungen: Anweisung[] = [];
  const attrappe = {
    query: (sql: string, parameter: readonly unknown[] = []) => {
      anweisungen.push({ sql, parameter });
      return Promise.resolve({ rows: zeilen });
    },
  };
  // Der Adapter nutzt von `Pool` genau `query`; die volle Schnittstelle nachzubauen brauchte einen
  // echten Server und pruefte nichts zusaetzlich. Deshalb hier die enge, benannte Umdeutung.
  return { anweisungen, pool: attrappe as unknown as Pool };
}

describe("JOB 3054 · R-8 · PgLifecycleRepo.pendingFor — eine Anweisung, `= ANY`, kein Schreibvorgang", () => {
  it("leere Kennungsliste geht GAR NICHT ans SQL", async () => {
    const { anweisungen, pool } = beobachteterPool([]);
    expect(await new PgLifecycleRepo(pool).pendingFor([])).toEqual([]);
    expect(anweisungen).toEqual([]);
  });

  it("zwei Kennungen ergeben EINE `= ANY($1)`-Anweisung mit genau diesen Kennungen", async () => {
    const { anweisungen, pool } = beobachteterPool([{ ko_id: "ko-2" }]);
    const treffer = await new PgLifecycleRepo(pool).pendingFor(["ko-1", "ko-2"]);

    expect(treffer).toEqual(["ko-2"]);
    expect(anweisungen).toHaveLength(1);
    expect(anweisungen[0]?.sql).toBe("SELECT ko_id FROM lifecycle_pending WHERE ko_id = ANY($1)");
    expect(anweisungen[0]?.parameter).toEqual([["ko-1", "ko-2"]]);
  });

  it("SCHREIBFREI: keine Anweisung enthaelt DELETE, INSERT oder UPDATE", async () => {
    const { anweisungen, pool } = beobachteterPool([{ ko_id: "ko-1" }]);
    await new PgLifecycleRepo(pool).pendingFor(["ko-1"]);
    for (const { sql } of anweisungen) {
      expect(sql).not.toMatch(/\b(DELETE|INSERT|UPDATE)\b/i);
    }
    // KALIBRIERUNG: derselbe Adapter SCHREIBT sehr wohl — nur eben auf dem anderen Weg. Ohne diese
    // Zeile bewiese die Schleife oben nichts ueber die Schaerfe des Musters.
    const schreibend = beobachteterPool([]);
    await new PgLifecycleRepo(schreibend.pool).clearPending("ko-1");
    expect(schreibend.anweisungen[0]?.sql).toMatch(/\bDELETE\b/);
  });

  it("doppelte Kennungen gehen einmal ins SQL", async () => {
    const { anweisungen, pool } = beobachteterPool([{ ko_id: "ko-1" }]);
    await new PgLifecycleRepo(pool).pendingFor(["ko-1", "ko-1"]);
    expect(anweisungen).toHaveLength(1);
    expect(anweisungen[0]?.parameter).toEqual([["ko-1"]]);
  });
});
