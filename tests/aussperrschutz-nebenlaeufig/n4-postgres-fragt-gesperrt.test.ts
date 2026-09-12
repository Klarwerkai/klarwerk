// ================================================================================================
// JOB 3784 · N4 — WAS DER POSTGRES-ADAPTER WIRKLICH AN DIE DATENBANK SCHICKT
// ================================================================================================
//
// Die zweite naheliegende Halbheit ist eine Sperre, die es NUR im Speicher gibt: alle Tests grün,
// die Produktion ungeschützt. Dieser Fall misst deshalb den SQL-Text und die Verbindung, auf der er
// läuft — nach dem Vorbild `services/knowledge-object/src/search-projection-repo-pg.test.ts`.
//
// WAS ER NICHT IST: ein echter PostgreSQL-Lauf. Er ersetzt keinen (Docker steht in dieser Sandkiste
// nicht bereit); er nagelt die vier Zusagen fest, die man einem Bericht sonst glauben müsste — dass
// eine Transaktion aufgeht, dass die Lesung `FOR UPDATE` trägt, dass das Schreiben auf DEMSELBEN
// Client läuft und nicht über den Pool, und dass eine Lesung OHNE Transaktion nicht sperrt.
import type { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { PgUserRepo } from "../../services/auth/src/repo-pg";
import type { User } from "../../services/auth/src/types";

interface Aufruf {
  /** „pool" oder „client<n>" — die Verbindung, auf der die Anweisung lief. */
  quelle: string;
  sql: string;
  params: unknown[];
}

const ADMIN_ZEILE = {
  id: "a",
  name: "A",
  email: "a@x.de",
  password_salt: "salz",
  password_hash: "hash",
  role: "admin",
  approved: true,
  created_at: "2026-09-12T12:00:00.000Z",
  notice_ack_at: null,
  notice_ack_version: null,
  oidc_issuer: null,
  oidc_subject: null,
  access_expires_at: null,
};

const KONTO: User = {
  id: "a",
  name: "A",
  email: "a@x.de",
  passwordSalt: "salz",
  passwordHash: "hash",
  role: "viewer",
  approved: true,
  createdAt: "2026-09-12T12:00:00.000Z",
};

/**
 * Ein Pool-Doppel, das jede Anweisung MIT IHRER VERBINDUNG aufzeichnet.
 *
 * Die Herkunft ist der eigentliche Beweis: `pool.query()` gibt je Anweisung eine beliebige
 * Verbindung — eine Transaktion darüber wäre keine. Nur was auf demselben `client` läuft, committet
 * gemeinsam und liegt unter derselben Zeilensperre.
 */
function poolDoppel(zeilen: Record<string, unknown>[] = [ADMIN_ZEILE]) {
  const aufrufe: Aufruf[] = [];
  let clientNummer = 0;
  const macheQuery =
    (quelle: string) =>
    async (sql: string, params: unknown[] = []) => {
      aufrufe.push({ quelle, sql, params });
      return { rows: zeilen, rowCount: zeilen.length };
    };
  const pool = {
    query: macheQuery("pool"),
    connect: async () => {
      clientNummer += 1;
      return { query: macheQuery(`client${clientNummer}`), release: () => undefined };
    },
  } as unknown as Pool;
  return { pool, aufrufe };
}

describe("JOB 3784 N4 · der Postgres-Adapter sperrt die Admin-Zeilen und schreibt auf demselben Client", () => {
  it("Prüfung und UPDATE liegen zwischen BEGIN und COMMIT, die Lesung trägt FOR UPDATE", async () => {
    const { pool, aufrufe } = poolDoppel();
    const repo = new PgUserRepo(pool);

    const gelesen = await repo.withAdminGuard(async (tx) => {
      const admins = await repo.listAdminsForGuard(tx);
      await repo.update(KONTO, tx);
      return admins;
    });

    expect(gelesen.map((u) => u.id)).toEqual(["a"]);

    const folge = aufrufe.map((a) => a.sql.trim().split("\n")[0]?.trim());
    expect(folge[0]).toBe("BEGIN");
    expect(folge[folge.length - 1]).toBe("COMMIT");

    const lesung = aufrufe.find((a) => /^\s*SELECT/i.test(a.sql)) as Aufruf;
    expect(lesung.sql).toContain("FOR UPDATE");
    // Die Sperre ist auf die Admin-Zeilen VERENGT — sie darf nicht die ganze Tabelle festhalten.
    expect(lesung.sql).toContain("role='admin'");
    expect(lesung.sql).toContain("approved = true");

    const schreiben = aufrufe.find((a) => a.sql.includes("UPDATE users SET")) as Aufruf;
    // DERSELBE Client wie BEGIN, Lesung und COMMIT — nicht der Pool.
    const verbindungen = new Set(aufrufe.map((a) => a.quelle));
    expect(verbindungen).toEqual(new Set(["client1"]));
    expect(schreiben.quelle).toBe("client1");
    expect(aufrufe.indexOf(lesung)).toBeLessThan(aufrufe.indexOf(schreiben));
  });

  it("auch das DELETE des Aussperrschutzes läuft auf dem Transaktions-Client", async () => {
    const { pool, aufrufe } = poolDoppel();
    const repo = new PgUserRepo(pool);

    await repo.withAdminGuard(async (tx) => {
      await repo.listAdminsForGuard(tx);
      await repo.delete("a", tx);
    });

    const loeschen = aufrufe.find((a) => a.sql.includes("DELETE FROM users")) as Aufruf;
    expect(loeschen.quelle).toBe("client1");
    expect(loeschen.params).toEqual(["a"]);
    expect(aufrufe.map((a) => a.sql.trim())[0]).toBe("BEGIN");
    expect(aufrufe[aufrufe.length - 1]?.sql.trim()).toBe("COMMIT");
  });

  it("OHNE Transaktion trägt die Lesung KEIN FOR UPDATE — sonst sperrte jeder Lesevorgang", async () => {
    const { pool, aufrufe } = poolDoppel();
    const repo = new PgUserRepo(pool);

    await repo.listAdminsForGuard();

    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0]?.quelle).toBe("pool");
    expect(aufrufe[0]?.sql).not.toContain("FOR UPDATE");
    expect(aufrufe[0]?.sql).toContain("role='admin'");
  });

  it("ein Fehler im Rahmen rollt zurück und wird weitergereicht — kein stiller Teilzustand", async () => {
    const { pool, aufrufe } = poolDoppel();
    const repo = new PgUserRepo(pool);

    await expect(
      repo.withAdminGuard(async (tx) => {
        await repo.listAdminsForGuard(tx);
        throw new Error("letzter Admin");
      }),
    ).rejects.toThrow("letzter Admin");

    expect(aufrufe.map((a) => a.sql.trim())).toContain("ROLLBACK");
    expect(aufrufe.map((a) => a.sql.trim())).not.toContain("COMMIT");
  });
});
