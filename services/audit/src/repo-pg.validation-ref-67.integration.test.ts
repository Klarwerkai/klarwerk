import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardedLocalPgTestUrl } from "../../db-tx";
import { GENESIS, hashEntry } from "./chain";
import { InMemoryAuditRepo, pruefeValidationDecisionRef } from "./repo";
import {
  AUDIT_EVENT_ID_SCHEMA,
  AUDIT_HASH_VERSION_SCHEMA,
  AUDIT_SCHEMA,
  PgAuditRepo,
} from "./repo-pg";
import { AuditService } from "./service";
import type { AuditEntry } from "./types";

// ================================================================================================
// W3-B (KW-W3-19) — findBySeq GEGEN EINEN ECHTEN SERVER, UND DIE PARITAET ZU InMemory
// ================================================================================================
//
// Die Paritaet ist hier die eigentliche Aussage: derselbe Fall, dieselbe Antwort, in beiden
// Ablagen — Erfolgs- UND Fehlervertrag. Ein Vertrag, der nur in einer Ablage gilt, ist keiner
// (Lehre aus BEN-33 Befund B).

function eintrag(over: Partial<AuditEntry> = {}): AuditEntry {
  const roh: AuditEntry = {
    seq: 1,
    at: "2026-08-02T09:00:00.000Z",
    actor: "anna",
    action: "ko.rated",
    target: "ko-1",
    payload: { verdict: "up", koVersion: 3 },
    prevHash: "GENESIS",
    hash: "",
    ...over,
  };
  return { ...roh, hash: over.hash ?? hashEntry(roh) };
}

describe("W3-B/67: findBySeq gegen echtes PostgreSQL, paritaetisch zu InMemory", () => {
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
      if (available) {
        await pool?.query(AUDIT_SCHEMA);
        await pool?.query(AUDIT_EVENT_ID_SCHEMA);
        await pool?.query(AUDIT_HASH_VERSION_SCHEMA);
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
      await pool.query(AUDIT_SCHEMA);
      await pool.query(AUDIT_EVENT_ID_SCHEMA);
      await pool.query(AUDIT_HASH_VERSION_SCHEMA);
      available = true;
    } catch {
      available = false;
    }
  });

  afterAll(async () => {
    await pool?.end();
    await container?.stop();
  });

  function requirePool(ctx: { skip: () => void }): Pool {
    if (!available || !pool) {
      ctx.skip();
      throw new Error("unreachable");
    }
    return pool;
  }

  it("derselbe Fall, dieselbe Antwort — Treffer und fehlender Eintrag in BEIDEN Ablagen", async (ctx) => {
    const p = requirePool(ctx);
    await p.query("DELETE FROM audit");
    const pg = new PgAuditRepo(p);
    const mem = new InMemoryAuditRepo();

    const e1 = eintrag({ seq: 1, target: "ko-1" });
    const e2 = eintrag({ seq: 2, target: "ko-2", prevHash: "x" });
    for (const repo of [pg, mem]) {
      await repo.append(e1);
      await repo.append(e2);
    }

    for (const [name, repo] of [
      ["pg", pg],
      ["mem", mem],
    ] as const) {
      expect((await repo.findBySeq(1))?.target, name).toBe("ko-1");
      expect((await repo.findBySeq(2))?.target, name).toBe("ko-2");
      // Ein fehlender Eintrag ist `undefined` — kein Wurf. Das Fehlen ist eine Antwort.
      expect(await repo.findBySeq(99), name).toBeUndefined();
    }
  });

  it("die gelesene Zeile traegt den Hash unveraendert — die Referenz prueft gegen echte Bytes", async (ctx) => {
    const p = requirePool(ctx);
    await p.query("DELETE FROM audit");
    const pg = new PgAuditRepo(p);
    const e = eintrag({ seq: 1 });
    await pg.append(e);

    const gelesen = await pg.findBySeq(1);
    expect(gelesen?.hash).toBe(e.hash);
    // BEN-70 ROT-1 / Auftrag 73: der volle Leseablauf aus KW-W3-19 heisst jetzt wirklich VOLL —
    // die Kette wird vorgelegt und mitgeprueft. Genau daran fehlte es in Freeze 67, und der
    // Kommentar „voller Leseablauf" war damit eine Behauptung ueber einen Schritt, der nicht lief.
    const kette = await pg.all();
    expect(
      pruefeValidationDecisionRef(
        gelesen,
        { auditSeq: 1, auditHash: e.hash },
        {
          koId: "ko-1",
          koVersion: 3,
        },
        kette,
      ),
    ).toBe("OK");
    // Und die Gegenprobe: ein fremder Hash deckt nicht.
    expect(
      pruefeValidationDecisionRef(
        gelesen,
        { auditSeq: 1, auditHash: "fremd" },
        {
          koId: "ko-1",
          koVersion: 3,
        },
        kette,
      ),
    ).toBe("HASH_MISMATCH");
  });

  it("MISSING kommt auch aus der echten Datenbank — und wird nicht ersatzweise gefunden", async (ctx) => {
    const p = requirePool(ctx);
    await p.query("DELETE FROM audit");
    const pg = new PgAuditRepo(p);
    await pg.append(eintrag({ seq: 1 }));

    const fehlend = await pg.findBySeq(42);
    expect(fehlend).toBeUndefined();
    expect(
      pruefeValidationDecisionRef(
        fehlend,
        { auditSeq: 42, auditHash: "egal" },
        {
          koId: "ko-1",
          koVersion: 3,
        },
        await pg.all(),
      ),
    ).toBe("MISSING");
    // Es liegt sehr wohl EIN Eintrag in der Tabelle — er darf nur nicht ersatzweise herhalten.
    expect((await pg.all()).length).toBe(1);
  });

  // ==============================================================================================
  // JOB 498 D8 (D6 T6) — DIE HASHVERSION IST IN BEIDEN ABLAGEN DIESELBE ZUSAGE
  // ==============================================================================================
  //
  // Die Paritaet ist auch hier die eigentliche Aussage. Eine Version, die nur InMemory ueberlebt,
  // waere kein Vertrag, sondern ein Zufall: der Wert entstuende im Dienst, ginge beim Schreiben
  // verloren und kaeme als 1 zurueck — und die Kette fiele auseinander, sobald jemand sie prueft.
  it("T6 — derselbe V2-Eintrag liest in BEIDEN Ablagen mit hashVersion 2 zurueck", async (ctx) => {
    const p = requirePool(ctx);
    await p.query("DELETE FROM audit");
    const pg = new PgAuditRepo(p);
    const mem = new InMemoryAuditRepo();

    for (const [name, repo] of [
      ["pg", pg],
      ["mem", mem],
    ] as const) {
      const dienst = new AuditService({ repo });
      const geschrieben = await dienst.record({
        actor: "anna",
        action: "ko.rated",
        target: "ko-v2",
        payload: { verdict: "up", koVersion: 3 },
      });
      expect(geschrieben.hashVersion, name).toBe(2);

      const gelesen = await repo.findBySeq(geschrieben.seq);
      expect(gelesen?.hashVersion, name).toBe(2);
      expect(gelesen?.hash, name).toBe(geschrieben.hash);
      // Und die Kette verifiziert nach dem Zuruecklesen — bei Pg also ueber den echten Roundtrip.
      expect(await dienst.verify(), name).toBe(true);
    }
  });

  it("T6 — der Altbestand liest in BEIDEN Ablagen als Version 1 zurueck", async (ctx) => {
    const p = requirePool(ctx);
    await p.query("DELETE FROM audit");
    const pg = new PgAuditRepo(p);
    const mem = new InMemoryAuditRepo();

    // `eintrag()` baut ohne `hashVersion` und hasht mit V1 — genau eine Altzeile.
    const alt = eintrag({ seq: 1, prevHash: GENESIS });
    expect(alt.hashVersion).toBeUndefined();
    for (const [name, repo] of [
      ["pg", pg],
      ["mem", mem],
    ] as const) {
      await repo.append(alt);
      const gelesen = await repo.findBySeq(1);
      // Pg fuellt die Spalte aus `entry.hashVersion ?? 1`; InMemory gibt das Objekt unveraendert
      // zurueck. Beide ergeben dieselbe PRUEFENTSCHEIDUNG: V1.
      expect(gelesen?.hashVersion ?? 1, name).toBe(1);
      expect(gelesen?.hash, name).toBe(alt.hash);
    }
  });
});
