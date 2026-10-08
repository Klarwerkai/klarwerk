import { EventEmitter } from "node:events";
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  HaengendeSitzungError,
  PRUEF_GRENZEN,
  SQL_SITZUNGSLAGE,
  begrenztePruefung,
  klammerAnweisungen,
} from "./begrenzte-pruefung";
import { ZUSTAND_HAENGT } from "./idle-in-transaction";
import { BestandsresetLaeuftError } from "./reset-lock";

// ================================================================================================
// R-1437 / I10 — DER VERTRAG FÜR ENG BEGRENZTE PRÜFUNGEN, GEGEN EIN DOPPEL.
// ================================================================================================
//
// REICHWEITE: Geprüft ist die Folge der Anweisungen auf EINER Verbindung und die Rückgabe an den
// Vorrat. Dass PostgreSQL eine READ-ONLY-Klammer gegen Schreiben verteidigt und die SET-LOCAL-Grenzen
// greifen, belegt `tests/datenintegritaet/datenintegritaet-pg.integration.test.ts` (B1/B2).

interface Lage {
  sitzungen?: { pid: number; state: string; offenSekunden: number; query: string }[];
  resetLaeuft?: boolean;
  scheitert?: (text: string) => boolean;
}

function doppel(lage: Lage = {}) {
  const protokoll: string[] = [];
  const rueckgaben: { verworfen: boolean }[] = [];
  const client = Object.assign(new EventEmitter(), {
    query: async (text: string) => {
      protokoll.push(text);
      if (lage.scheitert?.(text)) {
        throw new Error(`scheitert: ${text}`);
      }
      if (text === SQL_SITZUNGSLAGE) {
        return { rows: lage.sitzungen ?? [], rowCount: lage.sitzungen?.length ?? 0 };
      }
      if (text.includes("pg_try_advisory")) {
        return { rows: [{ erworben: !lage.resetLaeuft }], rowCount: 1 };
      }
      return { rows: [{ n: 7 }], rowCount: 1 };
    },
    release: (fehler?: unknown) => {
      rueckgaben.push({ verworfen: Boolean(fehler) });
    },
  });
  const pool = { connect: async () => client } as unknown as Pool;
  return { pool, protokoll, rueckgaben, client };
}

describe("R-1437 · begrenzte Prüfung", () => {
  it("B1 · Folge: Sitzungslage → READ ONLY → drei Zeitgrenzen → Reset-Sperre → Prüfung → ROLLBACK, nie COMMIT", async () => {
    const d = doppel();
    const { ergebnis, vorbefund } = await begrenztePruefung(d.pool, async (q) => {
      const r = await q.query<{ n: number }>("SELECT count(*) AS n FROM kos");
      return r.rows[0]?.n;
    });
    expect(ergebnis).toBe(7);
    expect(vorbefund.handeln).toBe("frei");
    expect(d.protokoll[0]).toBe(SQL_SITZUNGSLAGE);
    expect(d.protokoll.slice(1, 5)).toEqual(klammerAnweisungen(PRUEF_GRENZEN));
    expect(d.protokoll[5]).toContain("pg_try_advisory_xact_lock_shared");
    expect(d.protokoll[6]).toBe("SELECT count(*) AS n FROM kos");
    expect(d.protokoll[7]).toBe("ROLLBACK");
    expect(d.protokoll).not.toContain("COMMIT");
    expect(d.rueckgaben).toEqual([{ verworfen: false }]);
    expect(d.client.listenerCount("error")).toBe(0);
  });

  it("B2 · die Klammer ist nur lesend und trägt alle drei Grenzen", () => {
    const [begin, anweisung, sperre, leerlauf] = klammerAnweisungen({
      anweisungMs: 1500,
      sperreMs: 200,
      leerlaufMs: 900,
    });
    expect(begin).toBe("BEGIN READ ONLY");
    expect(anweisung).toBe("SET LOCAL statement_timeout = 1500");
    expect(sperre).toBe("SET LOCAL lock_timeout = 200");
    expect(leerlauf).toBe("SET LOCAL idle_in_transaction_session_timeout = 900");
  });

  it("B3 · hängt eine Sitzung, beginnt nichts: kein BEGIN, Befund mit Befehl, Verbindung sauber zurück", async () => {
    const d = doppel({
      sitzungen: [{ pid: 4711, state: ZUSTAND_HAENGT, offenSekunden: 900, query: "UPDATE kos …" }],
    });
    let gerufen = false;
    const fehler = await begrenztePruefung(d.pool, async () => {
      gerufen = true;
    }).catch((f: unknown) => f);
    expect(fehler).toBeInstanceOf(HaengendeSitzungError);
    expect((fehler as HaengendeSitzungError).befund.befehle).toEqual([
      "select pg_terminate_backend(4711);",
    ]);
    expect(gerufen).toBe(false);
    expect(d.protokoll).toEqual([SQL_SITZUNGSLAGE]);
    expect(d.rueckgaben).toEqual([{ verworfen: false }]);
  });

  it("B4 · eine arbeitende Sitzung hält die Prüfung nicht auf — sie liest nur", async () => {
    const d = doppel({
      sitzungen: [{ pid: 12, state: "active", offenSekunden: 3, query: "SELECT 1" }],
    });
    const { vorbefund } = await begrenztePruefung(d.pool, async () => 1);
    expect(vorbefund.handeln).toBe("warten");
    expect(d.protokoll).toContain("BEGIN READ ONLY");
  });

  it("B5 · scheitert die Prüfung, wird genau einmal zurückgerollt und der Fehler weitergereicht", async () => {
    const d = doppel();
    await expect(
      begrenztePruefung(d.pool, async () => {
        throw new Error("Prüfung bricht ab");
      }),
    ).rejects.toThrow("Prüfung bricht ab");
    expect(d.protokoll.filter((t) => t === "ROLLBACK")).toHaveLength(1);
    expect(d.rueckgaben).toEqual([{ verworfen: false }]);
  });

  it("B6 · scheitert auch das ROLLBACK, geht die Verbindung nicht in den Vorrat zurück", async () => {
    const d = doppel({ scheitert: (t) => t === "ROLLBACK" });
    await begrenztePruefung(d.pool, async () => 1);
    expect(d.rueckgaben).toEqual([{ verworfen: true }]);
  });

  it("B7 · scheitert schon eine Zeitgrenze, wird zurückgerollt und nicht geprüft", async () => {
    const d = doppel({ scheitert: (t) => t.startsWith("SET LOCAL lock_timeout") });
    let gerufen = false;
    await expect(
      begrenztePruefung(d.pool, async () => {
        gerufen = true;
      }),
    ).rejects.toThrow("scheitert: SET LOCAL lock_timeout");
    expect(gerufen).toBe(false);
    expect(d.protokoll.at(-1)).toBe("ROLLBACK");
  });

  it("B8 · während eines Bestandsresets wird nicht gelesen (OV-8)", async () => {
    const d = doppel({ resetLaeuft: true });
    let gerufen = false;
    await expect(
      begrenztePruefung(d.pool, async () => {
        gerufen = true;
      }),
    ).rejects.toBeInstanceOf(BestandsresetLaeuftError);
    expect(gerufen).toBe(false);
    expect(d.protokoll.at(-1)).toBe("ROLLBACK");
  });
});
