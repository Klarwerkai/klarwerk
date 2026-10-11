import { EventEmitter } from "node:events";
import type { Pool, PoolClient } from "pg";
import { describe, expect, it } from "vitest";
import { gatedPool } from "./gated-pool";
import { pgQueryable, withPgTx } from "./tx";
import {
  LEERLAUF_IN_TRANSAKTION_MS,
  VORRAT_WARTEZEIT_MS,
  leiheAus,
  vorratsKonfiguration,
} from "./vorrat";

// ================================================================================================
// R-0776 / R-0798 — DIE RÜCKGABE AN DEN VORRAT UND SEINE ZEITGRENZEN, GEGEN EIN DOPPEL.
// ================================================================================================
//
// REICHWEITE: Das Doppel bildet nach, was pg-pool an der Rückgabe unterscheidet — `release()` legt
// zurück, `release(fehler)` verwirft — und dass eine ausgeliehene Verbindung ein `error`-Ereignis
// senden kann. Dass Postgres beim Verwerfen die offene Klammer zurückrollt und eine abgebrochene
// Sitzung den Prozess nicht beendet, belegt `tests/db-vorrat/vorrat-pg.integration.test.ts` gegen
// echtes Postgres.

interface Doppel {
  pool: Pool;
  client: EventEmitter;
  protokoll: string[];
  rueckgaben: { verworfen: boolean }[];
}

function doppel(scheitert: (text: string) => boolean = () => false): Doppel {
  const protokoll: string[] = [];
  const rueckgaben: { verworfen: boolean }[] = [];
  const client = Object.assign(new EventEmitter(), {
    query: async (befehl: string | { text: string }) => {
      const text = typeof befehl === "string" ? befehl : befehl.text;
      protokoll.push(text);
      if (scheitert(text)) {
        throw new Error(`scheitert: ${text}`);
      }
      if (text.includes("pg_try_advisory")) {
        return { rows: [{ erworben: true }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    release: (fehler?: unknown) => {
      rueckgaben.push({ verworfen: Boolean(fehler) });
    },
  });
  const pool = { connect: async () => client } as unknown as Pool;
  return { pool, client, protokoll, rueckgaben };
}

describe("V1 · die Zeitgrenzen des Vorrats (R-0798)", () => {
  it("begrenzt das Warten auf eine Verbindung und das Schweigen in einer offenen Transaktion", () => {
    const konfiguration = vorratsKonfiguration("postgresql://u@h/db");
    expect(konfiguration.connectionString).toBe("postgresql://u@h/db");
    expect(konfiguration.connectionTimeoutMillis).toBe(VORRAT_WARTEZEIT_MS);
    expect(VORRAT_WARTEZEIT_MS).toBeGreaterThan(0);
    expect(konfiguration.options).toBe(
      `-c idle_in_transaction_session_timeout=${LEERLAUF_IN_TRANSAKTION_MS}`,
    );
    expect(LEERLAUF_IN_TRANSAKTION_MS).toBeGreaterThan(0);
  });

  it("schneidet arbeitende Anweisungen nicht ab: kein statement_timeout", () => {
    const konfiguration = vorratsKonfiguration();
    expect(konfiguration.connectionString).toBeUndefined();
    expect(JSON.stringify(konfiguration)).not.toContain("statement_timeout");
  });
});

describe("V2 · withPgTx gibt nur Sauberes in den Vorrat zurück (R-0776)", () => {
  it("Erfolg: COMMIT, Rückgabe in den Vorrat, kein Listener bleibt hängen", async () => {
    const d = doppel();
    await withPgTx(d.pool, async (tx) => {
      await pgQueryable(tx).query("INSERT INTO t VALUES (1)");
    });
    expect(d.protokoll).toEqual(["BEGIN", "INSERT INTO t VALUES (1)", "COMMIT"]);
    expect(d.rueckgaben).toEqual([{ verworfen: false }]);
    expect(d.client.listenerCount("error")).toBe(0);
  });

  it("Abbruch mit gelungenem ROLLBACK: der Fehler wird weitergereicht, die Verbindung ist sauber", async () => {
    const d = doppel();
    await expect(
      withPgTx(d.pool, async () => {
        throw new Error("Vorgang bricht ab");
      }),
    ).rejects.toThrow("Vorgang bricht ab");
    expect(d.protokoll).toEqual(["BEGIN", "ROLLBACK"]);
    expect(d.rueckgaben).toEqual([{ verworfen: false }]);
  });

  it("Abbruch mit gescheitertem ROLLBACK: die Verbindung wird verworfen, nicht wiederverwendet", async () => {
    const d = doppel((text) => text === "ROLLBACK");
    await expect(
      withPgTx(d.pool, async () => {
        throw new Error("Vorgang bricht ab");
      }),
    ).rejects.toThrow("Vorgang bricht ab");
    expect(d.rueckgaben).toEqual([{ verworfen: true }]);
  });

  it("Verbindungsabriss mitten in der Klammer: das Ereignis beendet den Prozess nicht, die Verbindung wird verworfen", async () => {
    const d = doppel();
    await expect(
      withPgTx(d.pool, async () => {
        // Ohne Listener würfe `emit("error")` hier synchron — genau der Prozessabbruch.
        d.client.emit("error", new Error("Connection terminated unexpectedly"));
        throw new Error("Anweisung scheiterte");
      }),
    ).rejects.toThrow("Anweisung scheiterte");
    expect(d.rueckgaben).toEqual([{ verworfen: true }]);
    expect(d.client.listenerCount("error")).toBe(0);
  });

  it("gescheitertes COMMIT: ROLLBACK wird versucht, der Fehler erreicht den Aufrufer", async () => {
    const d = doppel((text) => text === "COMMIT");
    await expect(withPgTx(d.pool, async () => 1)).rejects.toThrow("scheitert: COMMIT");
    expect(d.protokoll).toEqual(["BEGIN", "COMMIT", "ROLLBACK"]);
    expect(d.rueckgaben).toEqual([{ verworfen: false }]);
  });
});

describe("V3 · die Hülle gatedPool hält dieselbe Regel (R-0776)", () => {
  it("Einzelquery: scheitert die Anweisung UND das ROLLBACK, wird die Verbindung verworfen", async () => {
    const d = doppel((text) => text.startsWith("UPDATE") || text === "ROLLBACK");
    await expect(gatedPool(d.pool).query("UPDATE t SET a=1")).rejects.toThrow("scheitert: UPDATE");
    expect(d.rueckgaben).toEqual([{ verworfen: true }]);
  });

  it("Einzelquery: gelungenes ROLLBACK lässt die Verbindung sauber zurück", async () => {
    const d = doppel((text) => text.startsWith("UPDATE"));
    await expect(gatedPool(d.pool).query("UPDATE t SET a=1")).rejects.toThrow("scheitert: UPDATE");
    expect(d.rueckgaben).toEqual([{ verworfen: false }]);
  });

  it("Mehrquery: Rückgabe mit offener Transaktion verwirft die Verbindung — kein halber Zustand im Vorrat", async () => {
    const d = doppel();
    const client = await gatedPool(d.pool).connect();
    await client.query("BEGIN");
    await client.query("UPDATE t SET a=1");
    client.release();
    expect(d.rueckgaben).toEqual([{ verworfen: true }]);
    // Die Hülle sendet selbst nichts nach: das Sitzungsende rollt serverseitig zurück.
    expect(d.protokoll.filter((t) => t === "ROLLBACK" || t === "COMMIT")).toEqual([]);
  });

  it("Mehrquery: nach COMMIT geht die Verbindung sauber zurück", async () => {
    const d = doppel();
    const client = await gatedPool(d.pool).connect();
    await client.query("BEGIN");
    await client.query("UPDATE t SET a=1");
    await client.query("COMMIT");
    client.release();
    expect(d.rueckgaben).toEqual([{ verworfen: false }]);
    expect(d.client.listenerCount("error")).toBe(0);
  });

  it("Mehrquery: ein gescheitertes ROLLBACK des Aufrufers verwirft die Verbindung", async () => {
    const d = doppel((text) => text === "ROLLBACK");
    const client = await gatedPool(d.pool).connect();
    await client.query("BEGIN");
    await expect(client.query("ROLLBACK")).rejects.toThrow("scheitert: ROLLBACK");
    client.release();
    expect(d.rueckgaben).toEqual([{ verworfen: true }]);
  });

  it("Mehrquery: der Verwerfwunsch des Aufrufers (release(true)) bleibt erhalten", async () => {
    const d = doppel();
    const client = await gatedPool(d.pool).connect();
    client.release(true);
    expect(d.rueckgaben).toEqual([{ verworfen: true }]);
  });

  it("withPgTx über die Hülle: Abriss mitten in der Klammer verwirft genau einmal", async () => {
    const d = doppel((text) => text === "ROLLBACK");
    await expect(
      withPgTx(gatedPool(d.pool), async () => {
        d.client.emit("error", new Error("Connection terminated unexpectedly"));
        throw new Error("Anweisung scheiterte");
      }),
    ).rejects.toThrow("Anweisung scheiterte");
    expect(d.rueckgaben).toEqual([{ verworfen: true }]);
    expect(d.client.listenerCount("error")).toBe(0);
  });
});

describe("V4 · leiheAus", () => {
  it("gibt genau einmal zurück, auch bei doppeltem Aufruf", () => {
    const rueckgaben: unknown[] = [];
    const client = { release: (f?: unknown) => rueckgaben.push(f) } as unknown as PoolClient;
    const ausleihe = leiheAus(client);
    ausleihe.zurueckgeben();
    ausleihe.zurueckgeben();
    expect(rueckgaben).toEqual([undefined]);
  });

  it("verträgt Doppel ohne Ereignisschnittstelle und verwirft mit einem echten Fehler", () => {
    const rueckgaben: unknown[] = [];
    const client = { release: (f?: unknown) => rueckgaben.push(f) } as unknown as PoolClient;
    const ausleihe = leiheAus(client);
    ausleihe.verwerfen("kein Fehlerobjekt");
    expect(ausleihe.unsauber).toBe(true);
    ausleihe.zurueckgeben();
    expect(rueckgaben[0]).toBeInstanceOf(Error);
  });
});
