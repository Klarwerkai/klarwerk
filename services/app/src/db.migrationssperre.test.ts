import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { AUDIT_KETTENSPERRE } from "../../audit/src/repo-pg";
import { SPERRSCHLUESSEL_BESTANDSRESET } from "../../db-tx/src/reset-lock";
import { MIGRATIONSSPERRE, migrate, schemas } from "./db";

// ================================================================================================
// R-0800 — DIE KOORDINATION DES SCHEMAAUFBAUS, OHNE DATENBANK GEPRÜFT.
// ================================================================================================
//
// Die Wirkung gegen eine echte PostgreSQL misst Fall E2 in
// `tests/pg-erstaufbau-konkurrenz/erstaufbau-konkurrenz.integration.test.ts`: die zweite Instanz
// wartet an der Sperre und kommt durch, und ohne Sperre fällt sie aus (E2-K). Integrationsläufe
// brauchen aber Docker und laufen nicht im schnellen Tor. Diese Datei hält dort fest, WIE `migrate()`
// die Sperre benutzt — damit ein Umbau, der sie still entfernt oder auf eine zweite Sitzung legt,
// auch ohne Docker auffällt.

const SPERRE_NEHMEN = "SELECT pg_advisory_lock($1)";
const SPERRE_GEBEN = "SELECT pg_advisory_unlock($1)";

interface Aufruf {
  sitzung: number;
  sql: string;
  werte?: unknown[];
}

/** Ein Pool, der jede Anweisung samt Sitzung mitschreibt. `scheitertBei` lässt eine Stufe werfen. */
function mitschreibenderPool(scheitertBei?: string) {
  const aufrufe: Aufruf[] = [];
  const freigaben: { sitzung: number; verwerfen: boolean }[] = [];
  let naechste = 0;
  const pool = {
    // Ein direkter Aufruf am Pool hiesse: diese Anweisung läuft auf IRGENDEINER Sitzung, nicht auf
    // der, die die Sperre hält. Er wird deshalb als Sitzung -1 mitgeschrieben.
    query: async (sql: string, werte?: unknown[]) => {
      aufrufe.push({ sitzung: -1, sql, ...(werte ? { werte } : {}) });
      return { rows: [], rowCount: 0 };
    },
    connect: async () => {
      naechste += 1;
      const sitzung = naechste;
      return {
        query: async (sql: string, werte?: unknown[]) => {
          aufrufe.push({ sitzung, sql, ...(werte ? { werte } : {}) });
          if (scheitertBei !== undefined && sql === scheitertBei) {
            throw Object.assign(new Error("Stufe gescheitert"), { code: "42601" });
          }
          return { rows: [], rowCount: 0 };
        },
        release: (verwerfen?: boolean) => {
          freigaben.push({ sitzung, verwerfen: verwerfen === true });
        },
      };
    },
  } as unknown as Pool;
  return { pool, aufrufe, freigaben };
}

describe("R-0800 · migrate() läuft unter der datenbankweiten Migrationssperre", () => {
  it("M1 · Sperre zuerst, ALLE Stufen auf derselben Sitzung in der Reihenfolge der Liste, Freigabe zuletzt", async () => {
    const { pool, aufrufe, freigaben } = mitschreibenderPool();
    await migrate(pool);

    expect(aufrufe[0]).toEqual({ sitzung: 1, sql: SPERRE_NEHMEN, werte: [MIGRATIONSSPERRE] });
    expect(aufrufe.at(-1)).toEqual({ sitzung: 1, sql: SPERRE_GEBEN, werte: [MIGRATIONSSPERRE] });
    expect(aufrufe.slice(1, -1).map((a) => a.sql)).toEqual([...schemas]);
    // Keine Anweisung an der Sperre vorbei: weder am Pool noch auf einer zweiten Sitzung.
    expect(new Set(aufrufe.map((a) => a.sitzung))).toEqual(new Set([1]));
    // Die gesunde Sitzung geht zurück in den Pool — sie wird nicht verworfen.
    expect(freigaben).toEqual([{ sitzung: 1, verwerfen: false }]);
  });

  it("M2 · ein zweiter Lauf nimmt dieselbe Sperre erneut — wiederholbar, nicht einmalig", async () => {
    const { pool, aufrufe } = mitschreibenderPool();
    await migrate(pool);
    await migrate(pool);
    const sperren = aufrufe.filter((a) => a.sql === SPERRE_NEHMEN);
    expect(sperren.map((a) => a.sitzung)).toEqual([1, 2]);
    expect(aufrufe.filter((a) => a.sql === SPERRE_GEBEN)).toHaveLength(2);
  });

  it("M3 · bricht eine Stufe ab, fliegt ihr Fehler weiter und die Sitzung wird VERWORFEN — das löst die Sperre", async () => {
    const mitte = schemas[Math.floor(schemas.length / 2)] as string;
    const { pool, aufrufe, freigaben } = mitschreibenderPool(mitte);

    await expect(migrate(pool)).rejects.toMatchObject({ code: "42601" });
    // Nach der gescheiterten Stufe läuft nichts mehr — keine Folgestufe auf halbem Stand.
    expect(aufrufe.at(-1)?.sql).toBe(mitte);
    expect(aufrufe.some((a) => a.sql === SPERRE_GEBEN)).toBe(false);
    // `release(true)` schließt die Verbindung; die sitzungsgebundene Sperre endet mit ihr.
    expect(freigaben).toEqual([{ sitzung: 1, verwerfen: true }]);
  });

  it("M4 · der Schlüssel ist mit keiner anderen Sperre des Hauses gleich", () => {
    // Gleiche Schlüssel hiessen: eine Migration wartet auf einen Bestandsreset oder einen
    // Prüfprotokolleintrag — und umgekehrt. Gelesen, wo das Produkt sie exportiert. Als Wert stehen
    // hier nur die Importannahme (modulintern, `services/library-analytics/src/repo-pg.ts`) und die
    // Trigramm-Sperre der Prüfstände (`tests/office-pg-abnahme/rueckweg-erwartung.ts`).
    const andere = [SPERRSCHLUESSEL_BESTANDSRESET, AUDIT_KETTENSPERRE, 3087000001, 43_210_001];
    expect(andere).not.toContain(MIGRATIONSSPERRE);
    expect(Number.isSafeInteger(MIGRATIONSSPERRE)).toBe(true);
  });
});
