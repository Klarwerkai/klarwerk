import { EventEmitter } from "node:events";
import { Pool } from "pg";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildPgServices, buildServices } from "../../services/app/src/build-app";
import { datenbankBereitschaft } from "../../services/app/src/readiness";

type Result = { rows: Record<string, unknown>[] };
type Callback = (error: Error | null, result?: Result) => void;
let mode: "ok" | "error" | "hang" = "ok";
let gate = true;
let probes = 0;
let inFlight = 0;
let peak = 0;
const pending: ((value: Result) => void)[] = [];
const pools: Pool[] = [];
const apps: ReturnType<typeof buildApp>[] = [];
class ClientWithoutSocket extends EventEmitter {
  _queryable = true;
  _ending = false;
  connect(cb?: (error: Error | null) => void): Promise<void> | undefined {
    if (cb) {
      setImmediate(() => cb(null));
      return undefined;
    }
    return Promise.resolve();
  }
  query(text: unknown, values?: unknown, callback?: Callback): Promise<Result> | undefined {
    const cb = typeof values === "function" ? (values as Callback) : callback;
    const sql = typeof text === "string" ? text : String((text as { text?: unknown }).text);
    let operation: Promise<Result>;
    if (sql.trim() === "SELECT 1") {
      probes += 1;
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      operation = (
        mode === "hang"
          ? new Promise<Result>((resolve) => pending.push(resolve))
          : mode === "error"
            ? Promise.reject(new Error("interner synthetischer Verbindungsfehler"))
            : Promise.resolve({ rows: [{ eins: 1 }] })
      ).finally(() => {
        inFlight -= 1;
      });
    } else {
      operation = Promise.resolve({
        rows: sql.includes("pg_try_advisory") ? [{ erworben: gate }] : [],
      });
    }
    if (cb) {
      void operation.then(
        (r) => cb(null, r),
        (e) => cb(e),
      );
      return undefined;
    }
    return operation;
  }
  end(cb?: () => void): Promise<void> | undefined {
    this._ending = true;
    if (cb) {
      setImmediate(cb);
      return undefined;
    }
    return Promise.resolve();
  }
}
beforeEach(() => {
  mode = "ok";
  gate = true;
  probes = 0;
  inFlight = 0;
  peak = 0;
});
afterEach(async () => {
  for (const resolve of pending.splice(0)) resolve({ rows: [{ eins: 1 }] });
  await new Promise((resolve) => setImmediate(resolve));
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await Promise.all(pools.splice(0).map((pool) => pool.end()));
  vi.restoreAllMocks();
});
function actualPgComposition() {
  const pool = new Pool({
    Client: ClientWithoutSocket as unknown as NonNullable<
      ConstructorParameters<typeof Pool>[0]
    >["Client"],
  });
  pools.push(pool);
  const pgServices = buildPgServices(pool);
  if (!pgServices.readiness) throw new Error("Produktiver Pg-Readiness-Caller fehlt");
  // Nur der Readiness-Caller stammt aus der echten Pg-Fabrik. Andere Domaenen bleiben
  // im Speicher: der Drahtport bildet keine Suchindex-/Fachdatenbank nach.
  const services = buildServices();
  services.readiness = pgServices.readiness;
  const app = buildApp(services);
  apps.push(app);
  return { pool, services, app };
}
describe("W4.7 Readiness am vorhandenen Pool, ohne Socket oder Datenbank", () => {
  it("der echte Pg-Readiness-Caller bindet SELECT 1 durch die bestehende Reset-Sperre an /ready", async () => {
    const { app, services, pool } = actualPgComposition();
    const status = vi.spyOn(services.reasoner, "publicStatus");
    const runs = vi.spyOn(services.modelRuns, "recent");
    const result = await app.inject({ method: "GET", url: "/ready" });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({ status: "ok" });
    expect(probes).toBe(1);
    expect(peak).toBe(1);
    expect(pool.totalCount).toBe(1);
    expect(status).not.toHaveBeenCalled();
    expect(runs).not.toHaveBeenCalled();
  });
  it("Datenbankfehler werden 503 ohne Details; nach Fehler ist eine neue erfolgreiche Probe moeglich", async () => {
    mode = "error";
    const { app } = actualPgComposition();
    const failed = await app.inject({ method: "GET", url: "/ready" });
    expect(failed.statusCode).toBe(503);
    expect(failed.json()).toEqual({ status: "unavailable" });
    expect(failed.body).not.toContain("synthetischer");
    mode = "ok";
    expect((await app.inject({ method: "GET", url: "/ready" })).statusCode).toBe(200);
    expect(probes).toBe(2);
    expect(peak).toBe(1);
  });
  it("wiederholte und parallele Haenger bleiben eine Abfrage, Nachbarn erhalten einen freien Poolplatz", async () => {
    mode = "hang";
    const { app, pool } = actualPgComposition();
    for (let i = 0; i < 3; i += 1) {
      const start = Date.now();
      const result = await app.inject({ method: "GET", url: "/ready" });
      expect(result.statusCode).toBe(503);
      expect(result.json()).toEqual({ status: "unavailable" });
      expect(Date.now() - start).toBeLessThan(3000);
    }
    const parallel = await Promise.all(
      Array.from({ length: 12 }, () => app.inject({ method: "GET", url: "/ready" })),
    );
    expect(parallel.every((result) => result.statusCode === 503)).toBe(true);
    expect(probes).toBe(1);
    expect(peak).toBe(1);
    expect(pool.totalCount).toBe(1);
    expect(pool.waitingCount).toBe(0);
    await pool.query("SELECT 2");
    expect(pool.waitingCount).toBe(0);
    mode = "ok";
    for (const resolve of pending.splice(0)) resolve({ rows: [{ eins: 1 }] });
    await new Promise((resolve) => setImmediate(resolve));
    expect((await app.inject({ method: "GET", url: "/ready" })).statusCode).toBe(200);
    expect(probes).toBe(2);
  });
  it("ein laufender Bestandsreset wird nicht umgangen", async () => {
    gate = false;
    const { app } = actualPgComposition();
    const result = await app.inject({ method: "GET", url: "/ready" });
    expect(result.statusCode).toBe(503);
    expect(result.json()).toEqual({ status: "unavailable" });
    expect(probes).toBe(0);
  });
  it("/health bleibt Liveness und der Speicherbetrieb benoetigt keinen Pg-Pool", async () => {
    const services = buildServices();
    services.readiness = async () => false;
    const app = buildApp(services);
    apps.push(app);
    expect((await app.inject({ method: "GET", url: "/ready" })).statusCode).toBe(503);
    const result = await app.inject({ method: "GET", url: "/health" });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({ status: "ok" });
    const memory = buildApp(buildServices());
    apps.push(memory);
    expect((await memory.inject({ method: "GET", url: "/ready" })).statusCode).toBe(200);
  });
  it("auch ein synchron werfender Query-Port wird abgefangen und gibt den Platz frei", async () => {
    let calls = 0;
    const ready = datenbankBereitschaft({
      query: () => {
        calls += 1;
        throw new Error("intern");
      },
    });
    expect(await ready()).toBe(false);
    expect(await ready()).toBe(false);
    expect(calls).toBe(2);
  });
});
