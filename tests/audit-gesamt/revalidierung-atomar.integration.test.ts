// Aufnahme gesamt-auditprotokoll · §12.3 „Re-Validierung" (Runde 2) — GEGEN ECHTES POSTGRES.
//
// Die Speicherfassung (`revalidierung-ausfall.test.ts`) zeigt, dass die Revision bei einem Ausfall
// des `ko.revalidated`-Belegs zurückrollt. Was nur hier beweisbar ist: dass `ko.revised` und
// `ko.revalidated` in DERSELBEN Transaktion laufen wie die Fassung — fällt der zweite Beleg aus,
// steht danach weder die neue Fassung noch einer der beiden Belege in der Datenbank.
//
// Verdrahtung wie die Kompositionswurzel (build-app.ts): EIN Pool, EIN `withPgTx`.
// Gating wie `services/conflicts/src/purge-atomar.integration.test.ts`: lokale Instanz
// (`guardedLocalPgTestUrl`) hat Vorrang, sonst Testcontainers, sonst sauberer Skip.
import { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AUDIT_EVENT_ID_SCHEMA,
  AUDIT_HASH_VERSION_SCHEMA,
  AUDIT_SCHEMA,
  type AuditEntry,
  type AuditRepo,
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
} from "../../services/lifecycle";

describe("Re-Validierung: Fassung und beide Belege committen/rollbacken gemeinsam (echtes Postgres)", () => {
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

  function auditMitAusfall(inner: AuditRepo, scharf: { an: boolean }): AuditRepo {
    return {
      append: async (entry: AuditEntry, tx?: TxContext) => {
        if (scharf.an && entry.action === "ko.revalidated") {
          throw new Error("AUDIT_UNAVAILABLE");
        }
        return inner.append(entry, tx);
      },
      appendOnce: (entry, tx) => inner.appendOnce(entry, tx),
      all: () => inner.all(),
      last: (tx) => inner.last(tx),
    };
  }

  async function reset(p: Pool): Promise<void> {
    for (const t of [
      "kos",
      "ko_schreibstand",
      "audit",
      "lifecycle_couplings",
      "lifecycle_pending",
      "lifecycle_verlauf",
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
    await p.query(LIFECYCLE_SCHEMA);
  }

  function merkerMitAusfall(
    inner: PgLifecycleRepo,
    scharf: { an: boolean; nachher: boolean },
  ): LifecycleRepo {
    return new Proxy(inner, {
      get(ziel, name, empfaenger) {
        if (name === "clearPending") {
          return async (koId: string, tx?: TxContext) => {
            if (scharf.an) {
              throw new Error("CLEAR_UNAVAILABLE");
            }
            const entfernt = await ziel.clearPending(koId, tx);
            // Lauf 2 (Bens Gegenprobe): das DELETE ist ausgeführt, die Antwort geht verloren.
            if (scharf.nachher) {
              throw new Error("CLEAR_REPLY_LOST");
            }
            return entfernt;
          };
        }
        const wert = Reflect.get(ziel, name, empfaenger);
        return typeof wert === "function" ? wert.bind(ziel) : wert;
      },
    });
  }

  async function welt(p: Pool) {
    const scharf = { an: false };
    const merkerAus = { an: false, nachher: false };
    const audit = new AuditService({ repo: auditMitAusfall(new PgAuditRepo(p), scharf) });
    const koService = new KoService({
      repo: new PgKoRepo(p),
      audit,
      withTx: (fn) => withPgTx(p, fn),
    });
    const lifecycle = new LifecycleService({
      koService,
      repo: merkerMitAusfall(new PgLifecycleRepo(p), merkerAus),
    });
    const ko = await koService.create({
      title: "Ventil schließen",
      statement: "Bei Überdruck schließen.",
      type: "best_practice",
      category: "Anlage 1",
      author: "anna",
    });
    await lifecycle.couple("anlage-1", ko.id);
    await lifecycle.assetChanged("anlage-1");
    return { scharf, merkerAus, audit, koService, lifecycle, ko };
  }

  async function belege(p: Pool, koId: string): Promise<string[]> {
    const res = await p.query("SELECT action FROM audit WHERE target=$1 ORDER BY seq", [koId]);
    return res.rows.map((r) => (r as { action: string }).action);
  }

  it("Ausfall beim ko.revalidated-Beleg: keine neue Fassung, kein ko.revised, kein ko.revalidated, Merker bleibt", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const w = await welt(p);
    const vorher = await belege(p, w.ko.id);
    w.scharf.an = true;

    // produkt:20261010:aenderungsfolgen-sichtbar (Nacharbeit 4): Abschluss nur mit Stand.
    await expect(w.lifecycle.confirmStillValid(w.ko.id, "carla", 1)).rejects.toThrow(
      "AUDIT_UNAVAILABLE",
    );

    expect((await w.koService.get(w.ko.id))?.version).toBe(1);
    // Mit Transaktion verschwindet auch `ko.revised` — und deshalb braucht es hier KEINEN
    // Rücknahmebeleg (`ko.change-rolled-back` gibt es nur im Weg ohne Transaktion).
    expect(await belege(p, w.ko.id)).toEqual(vorher);
    expect(await w.lifecycle.pendingRevalidation()).toContain(w.ko.id);
    expect((await w.audit.verifyReport()).ok).toBe(true);
  });

  it("Runde 3 · Ausfall beim Löschen des Merkers: keine Fassung, kein Beleg, Merker bleibt", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const w = await welt(p);
    const vorher = await belege(p, w.ko.id);
    w.merkerAus.an = true;
    await expect(w.lifecycle.confirmStillValid(w.ko.id, "carla", 1)).rejects.toThrow(
      "CLEAR_UNAVAILABLE",
    );
    expect((await w.koService.get(w.ko.id))?.version).toBe(1);
    expect(await belege(p, w.ko.id)).toEqual(vorher);
    expect(await w.lifecycle.pendingRevalidation()).toContain(w.ko.id);
    expect((await w.audit.verifyReport()).ok).toBe(true);
  });

  it("Lauf 2 · DELETE ausgeführt, danach Fehler: die Transaktion nimmt das Löschen zurück", async (ctx) => {
    // Bens Gegenprobe aus Lauf 1, Runde 3: früher lief das DELETE vor und außerhalb der Revision —
    // der Merker war danach weg, ohne Fassung und ohne Beleg. Jetzt läuft es auf dem Client der
    // Revision; der Fehler rollt es mit zurück. Gemessen direkt an der Tabelle.
    const p = requirePool(ctx);
    await reset(p);
    const w = await welt(p);
    const vorher = await belege(p, w.ko.id);
    w.merkerAus.nachher = true;
    await expect(w.lifecycle.confirmStillValid(w.ko.id, "carla", 1)).rejects.toThrow(
      "CLEAR_REPLY_LOST",
    );
    const merker = await p.query("SELECT ko_id FROM lifecycle_pending WHERE ko_id=$1", [w.ko.id]);
    expect(merker.rowCount).toBe(1);
    expect((await w.koService.get(w.ko.id))?.version).toBe(1);
    expect(await belege(p, w.ko.id)).toEqual(vorher);
    expect((await w.audit.verifyReport()).ok).toBe(true);
  });

  it("Lauf 2 · Beleg-Ausfall nach dem DELETE: auch der Merker kommt zurück (eine Transaktion)", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const w = await welt(p);
    w.scharf.an = true;
    await expect(w.lifecycle.confirmStillValid(w.ko.id, "carla", 1)).rejects.toThrow(
      "AUDIT_UNAVAILABLE",
    );
    const merker = await p.query("SELECT ko_id FROM lifecycle_pending WHERE ko_id=$1", [w.ko.id]);
    expect(merker.rowCount).toBe(1);
  });

  it("Erfolgsfall: Fassung 2, ko.revised und ko.revalidated direkt hintereinander, Merker weg", async (ctx) => {
    const p = requirePool(ctx);
    await reset(p);
    const w = await welt(p);
    const bestaetigt = await w.lifecycle.confirmStillValid(w.ko.id, "carla", 1);
    expect(bestaetigt.version).toBe(2);
    const liste = await belege(p, w.ko.id);
    expect(liste.slice(-2)).toEqual(["ko.revised", "ko.revalidated"]);
    expect(await w.lifecycle.pendingRevalidation()).not.toContain(w.ko.id);
    const reval = await w.audit.list({ action: "ko.revalidated" });
    expect(reval.map((e) => e.payload)).toEqual([
      { pendingCleared: true, geprueftStand: 1, version: 2 },
    ]);
    expect((await w.audit.verifyReport()).ok).toBe(true);
  });
});
