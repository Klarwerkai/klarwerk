// JOB 2614 · D4 — DIE ZÄHLUNG AUS §2 IST BELEGT READ-ONLY UND STELLT DIE RICHTIGEN FRAGEN.
//
// Das Werkzeug tools/bodytext-zaehlung.ts liest die Live-Datenbank (Auftrag §2: „gelesen, nicht
// geschrieben"). Dieser Test pinnt beides OHNE Datenbank, am Modul selbst:
//   R1  Jedes abgesetzte Statement beginnt mit SELECT — kein INSERT/UPDATE/DELETE/ALTER/CREATE,
//       auch nicht versteckt. Das Werkzeug KANN nicht schreiben.
//   R2  Gegen einen aufzeichnenden Fake-Pool (Bauform wie tests/ko/g27-welle1-v1-v2-migration)
//       liefert `zaehlen` die Zahlen aus den Antworten und fragt die Projektionstabelle VOR den
//       projektionsabhängigen Statements ab.
//   R3  Fehlt die Projektionstabelle (älterer Bestand), gilt ehrlich: betroffen = alle mit
//       bodyHtml — und KEIN projektionsabhängiges Statement wird abgesetzt.
import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { BODYTEXT_ZAEHLUNG_SQL, zaehlen } from "../../tools/bodytext-zaehlung";

function fakePool(antworten: (sql: string) => { rows: unknown[] }) {
  const calls: string[] = [];
  const pool = {
    query: async (sql: string) => {
      calls.push(sql);
      return antworten(sql);
    },
    end: async () => undefined,
  } as unknown as Pool;
  return { pool, calls };
}

describe("JOB 2614 · D4 · Zählung: read-only, richtige Fragen, ehrlicher Altbestands-Zweig", () => {
  it("R1 — ausschließlich SELECT: das Werkzeug kann nicht schreiben", () => {
    for (const [name, sql] of Object.entries(BODYTEXT_ZAEHLUNG_SQL)) {
      expect(sql.trim().toUpperCase().startsWith("SELECT"), `${name} beginnt nicht mit SELECT`).toBe(
        true,
      );
      expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE)\b/i);
    }
  });

  it("R2 — mit Projektionstabelle: die Zahlen kommen aus den Antworten, die Tabellenfrage läuft zuerst", async () => {
    const { pool, calls } = fakePool((sql) => {
      if (sql === BODYTEXT_ZAEHLUNG_SQL.projektionstabelle) {
        return { rows: [{ name: "ko_search_projections" }] };
      }
      if (sql === BODYTEXT_ZAEHLUNG_SQL.gesamt) {
        return { rows: [{ n: 12 }] };
      }
      if (sql === BODYTEXT_ZAEHLUNG_SQL.mitBodyHtml) {
        return { rows: [{ n: 5 }] };
      }
      if (sql === BODYTEXT_ZAEHLUNG_SQL.betroffen) {
        return { rows: [{ n: 2 }] };
      }
      if (sql === BODYTEXT_ZAEHLUNG_SQL.betroffeneNachStatus) {
        return { rows: [{ status: "offen", n: 2 }] };
      }
      if (sql === BODYTEXT_ZAEHLUNG_SQL.betroffeneOhneStufe) {
        return { rows: [{ n: 2 }] };
      }
      if (sql === BODYTEXT_ZAEHLUNG_SQL.inventur) {
        return { rows: [{ projection_version: 1, n: 2 }, { projection_version: 2, n: 7 }] };
      }
      throw new Error(`unerwartetes Statement: ${sql}`);
    });

    const b = await zaehlen(pool);

    expect(calls[0]).toBe(BODYTEXT_ZAEHLUNG_SQL.projektionstabelle);
    expect(b).toEqual({
      projektionstabelle: true,
      gesamt: 12,
      mitBodyHtml: 5,
      betroffen: 2,
      betroffeneNachStatus: [{ status: "offen", n: 2 }],
      betroffeneOhneStufe: 2,
      inventur: [
        { projectionVersion: 1, n: 2 },
        { projectionVersion: 2, n: 7 },
      ],
    });
  });

  it("R3 — ohne Projektionstabelle: betroffen = alle mit bodyHtml, kein projektionsabhängiges Statement", async () => {
    const { pool, calls } = fakePool((sql) => {
      if (sql === BODYTEXT_ZAEHLUNG_SQL.projektionstabelle) {
        return { rows: [{ name: null }] };
      }
      if (sql === BODYTEXT_ZAEHLUNG_SQL.gesamt) {
        return { rows: [{ n: 4 }] };
      }
      if (sql === BODYTEXT_ZAEHLUNG_SQL.mitBodyHtml) {
        return { rows: [{ n: 3 }] };
      }
      throw new Error(`projektionsabhängiges Statement trotz fehlender Tabelle: ${sql}`);
    });

    const b = await zaehlen(pool);

    expect(b.projektionstabelle).toBe(false);
    expect(b.betroffen).toBe(3);
    expect(calls).toEqual([
      BODYTEXT_ZAEHLUNG_SQL.projektionstabelle,
      BODYTEXT_ZAEHLUNG_SQL.gesamt,
      BODYTEXT_ZAEHLUNG_SQL.mitBodyHtml,
    ]);
  });
});
