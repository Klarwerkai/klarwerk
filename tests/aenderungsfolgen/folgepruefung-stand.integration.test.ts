// ================================================================================================
// produkt:20261010:aenderungsfolgen-sichtbar — STAND UND ANLÄSSE GEGEN ECHTES POSTGRES.
// ================================================================================================
//
// Was nur hier beweisbar ist: dass die EINE Anweisung von `PgLifecycleRepo.markPending` unter
// gleichzeitigen Meldungen weder einen Anlass verliert noch einen doppelt anlegt, und dass die
// Bestätigung mit Stand in DERSELBEN Transaktion wie die Fassung bedingt löscht — eine zwischen
// Vorprüfung und Löschen eingegangene Änderung rollt die Fassung zurück, der Fall bleibt offen.
//
// Verdrahtung wie die Kompositionswurzel (build-app.ts): EIN Pool, EIN `withPgTx`.
// Gating wie `tests/audit-gesamt/revalidierung-atomar.integration.test.ts`: lokale Instanz
// (`guardedLocalPgTestUrl`) hat Vorrang, sonst Testcontainers, sonst sauberer Skip.
//
//   K5  zweite Änderung zwischen Anzeige und Bestätigung, auch parallel; Wiederholung.
//   K7  identische Signale parallel → ein Anlass; verschiedene → alle, Stand lückenlos.
//   K1  Altmerker (vor der Migration) liest sich als Fall ohne Anlass — die Migration ist additiv.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AUDIT_EVENT_ID_SCHEMA,
  AUDIT_HASH_VERSION_SCHEMA,
  AUDIT_SCHEMA,
  AuditService,
  PgAuditRepo,
} from "../../services/audit";
import { type TxContext, guardedLocalPgTestUrl, withPgTx } from "../../services/db-tx";
import {
  KO_CREATE_OPERATION_SCHEMA,
  KO_IMPORT_ANCHOR_SCHEMA,
  KO_SCHEMA,
  KO_SICHTBARKEIT_SCHEMA,
  KoService,
  PgKoRepo,
} from "../../services/knowledge-object";
import {
  LIFECYCLE_SCHEMA,
  type LifecycleRepo,
  LifecycleService,
  PgLifecycleRepo,
  anlassSignatur,
} from "../../services/lifecycle";

const ANLAGE = "Dosierstation DP-4";

describe("Folgeprüfung: Stand und Anlässe unter echter Transaktion und Parallelität", () => {
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
        return;
      } catch {
        process.stderr.write(
          "[KLARWERK] Pg-Integrationssuite ÜBERSPRUNGEN: KLARWERK_PG_TEST_URL gesetzt, aber keine Verbindung möglich.\n",
        );
        available = false;
        return;
      }
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

  async function reset(p: Pool, altesSchema = false): Promise<void> {
    for (const t of [
      "kos",
      "ko_schreibstand",
      "audit",
      "lifecycle_couplings",
      "lifecycle_pending",
      "lifecycle_paths",
      "lifecycle_progress",
    ]) {
      await p.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }
    await p.query(KO_SCHEMA);
    await p.query(KO_IMPORT_ANCHOR_SCHEMA);
    await p.query(KO_CREATE_OPERATION_SCHEMA);
    await p.query(KO_SICHTBARKEIT_SCHEMA);
    await p.query(AUDIT_SCHEMA);
    await p.query(AUDIT_EVENT_ID_SCHEMA);
    await p.query(AUDIT_HASH_VERSION_SCHEMA);
    if (!altesSchema) {
      await p.query(LIFECYCLE_SCHEMA);
    }
  }

  async function welt(p: Pool, repo: LifecycleRepo = new PgLifecycleRepo(p)) {
    const audit = new AuditService({ repo: new PgAuditRepo(p) });
    const koService = new KoService({
      repo: new PgKoRepo(p),
      audit,
      withTx: (fn) => withPgTx(p, fn),
    });
    const lifecycle = new LifecycleService({ koService, repo, audit });
    const ko = await koService.create({
      title: "Dosierpumpe DP-4 entlüften",
      statement: "Vor dem Entlüften die Dosierpumpe drucklos schalten.",
      type: "best_practice",
      category: "Dosierung",
      author: "anna",
    });
    await lifecycle.couple(ANLAGE, ko.id);
    return { audit, koService, lifecycle, ko };
  }

  it("Migration additiv: ein Altmerker liest sich als Fall mit Stand 1 und ohne Anlass", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p, true);
    await p.query("CREATE TABLE lifecycle_pending (ko_id text PRIMARY KEY)");
    await p.query("INSERT INTO lifecycle_pending(ko_id) VALUES('ko-alt')");
    await p.query(LIFECYCLE_SCHEMA);
    await p.query(LIFECYCLE_SCHEMA);
    const [alt] = await new PgLifecycleRepo(p).offeneFaelle(["ko-alt"]);
    expect(alt).toEqual({ koId: "ko-alt", stand: 1, seit: null, anlaesse: [] });
  });

  it("K7 · zehn gleichzeitige identische Meldungen: EIN Anlass, Stand 1, EIN Beleg", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const w = await welt(p);
    await Promise.all(
      Array.from({ length: 10 }, () =>
        w.lifecycle.meldeAnlagenaenderung(ANLAGE, "carla", "Rev. B"),
      ),
    );
    const [fall] = await w.lifecycle.offeneFaelle([w.ko.id]);
    expect(fall?.stand).toBe(1);
    expect(fall?.anlaesse).toHaveLength(1);
    expect(await w.audit.list({ action: "lifecycle.revalidation-requested" })).toHaveLength(1);
  });

  it("K7 · fünf gleichzeitige VERSCHIEDENE Meldungen: fünf Anlässe, Stand 5, kein Verlust", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const w = await welt(p);
    await Promise.all(
      ["Rev. B", "Rev. C", "Rev. D", "Rev. E", "Rev. F"].map((rev) =>
        w.lifecycle.meldeAnlagenaenderung(ANLAGE, "carla", rev),
      ),
    );
    const [fall] = await w.lifecycle.offeneFaelle([w.ko.id]);
    expect(fall?.stand).toBe(5);
    expect(fall?.anlaesse.map((a) => a.aenderung).sort()).toEqual([
      "Rev. B",
      "Rev. C",
      "Rev. D",
      "Rev. E",
      "Rev. F",
    ]);
  });

  it("K5 · Änderung GENAU zwischen Vorprüfung und Löschen: Transaktion rollt zurück, Fall bleibt", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const inner = new PgLifecycleRepo(p);
    const melder: { vorher: (() => Promise<void>) | undefined } = { vorher: undefined };
    const repo = new Proxy(inner, {
      get(ziel, name, empfaenger) {
        if (name === "clearPending") {
          return async (koId: string, tx?: TxContext, stand?: number) => {
            const meldung = melder.vorher;
            melder.vorher = undefined;
            await meldung?.();
            return ziel.clearPending(koId, tx, stand);
          };
        }
        const wert = Reflect.get(ziel, name, empfaenger);
        return typeof wert === "function" ? wert.bind(ziel) : wert;
      },
    });
    const w = await welt(p, repo);
    await w.lifecycle.meldeAnlagenaenderung(ANLAGE, "carla", "Rev. B");
    melder.vorher = async () => {
      // Auf dem POOL, nicht auf dem Transaktionsclient: eine fremde Meldung, die committet ist,
      // bevor das bedingte Löschen der Bestätigung läuft. Direkt an der Ablage (dieselbe Anweisung
      // wie im Dienst), damit die Probe nicht zusätzlich auf die Kettensperre des Audits wartet.
      const kern = { grund: "anlage" as const, assetRef: ANLAGE, aenderung: "Rev. C" };
      await inner.markPending(w.ko.id, {
        ...kern,
        am: new Date().toISOString(),
        von: "carla",
        koVersion: 1,
        signatur: anlassSignatur(kern),
      });
    };
    await expect(w.lifecycle.confirmStillValid(w.ko.id, "anna", 1)).rejects.toMatchObject({
      code: "STAND_VERALTET",
      aktuellerStand: 2,
    });
    expect((await w.koService.get(w.ko.id))?.version).toBe(1);
    const [fall] = await w.lifecycle.offeneFaelle([w.ko.id]);
    expect(fall?.stand).toBe(2);
    expect(fall?.anlaesse.map((a) => a.aenderung)).toEqual(["Rev. B", "Rev. C"]);
    expect(await w.audit.list({ action: "ko.revalidated" })).toEqual([]);
    expect((await w.audit.verifyReport()).ok).toBe(true);
  });

  it("K5 · zwei parallele Bestätigungen desselben Stands: genau eine Fassung, ein Beleg", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const w = await welt(p);
    await w.lifecycle.meldeAnlagenaenderung(ANLAGE, "carla", "Rev. B");
    const ergebnisse = await Promise.allSettled([
      w.lifecycle.confirmStillValid(w.ko.id, "anna", 1),
      w.lifecycle.confirmStillValid(w.ko.id, "bert", 1),
    ]);
    expect(ergebnisse.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await w.koService.get(w.ko.id))?.version).toBe(2);
    expect(await w.audit.list({ action: "ko.revalidated" })).toHaveLength(1);
    expect(await w.lifecycle.offeneFaelle([w.ko.id])).toEqual([]);
    expect((await w.audit.verifyReport()).ok).toBe(true);
  });

  it("K5 · Bestätigung des passenden Stands: Fassung, Beleg mit Stand, Fall geräumt", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const w = await welt(p);
    await w.lifecycle.meldeAnlagenaenderung(ANLAGE, "carla", "Rev. B");
    await w.lifecycle.meldeAnlagenaenderung(ANLAGE, "carla", "Rev. C");
    const bestaetigt = await w.lifecycle.confirmStillValid(w.ko.id, "anna", 2);
    expect(bestaetigt.version).toBe(2);
    expect(await w.lifecycle.offeneFaelle([w.ko.id])).toEqual([]);
    const reval = await w.audit.list({ action: "ko.revalidated" });
    expect(reval.map((e) => e.payload)).toEqual([
      { pendingCleared: true, geprueftStand: 2, version: 2 },
    ]);
  });
});
