import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp, buildPgServices, createPool, migrate } from "../../services/app";
import { PgAuditRepo } from "../../services/audit";
import { guardedLocalPgTestUrl } from "../../services/db-tx";
import { type KnowledgeObject, PgEvidenceRepo, PgKoRepo } from "../../services/knowledge-object";
import { poolAbschluss } from "../audit-gesamt/pool-abschluss";

const DB = `klarwerk_test_ko17_quellen_${process.pid}`;
const offen = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};
const quelle = (label: string) => ({
  label,
  url: `https://example.test/${encodeURIComponent(label)}`,
  excerpt: `Auszug ${label}`,
});
let verwaltung: Pool | undefined;
let poolA: Pool | undefined;
let poolB: Pool | undefined;
let endeV: ReturnType<typeof poolAbschluss> | undefined;
let endeA: ReturnType<typeof poolAbschluss> | undefined;
let endeB: ReturnType<typeof poolAbschluss> | undefined;
let appA: FastifyInstance;
let appB: FastifyInstance;
let servicesA: ReturnType<typeof buildPgServices>;
let headers: { authorization: string };
let eigeneDb = false;

beforeAll(async () => {
  const basis = guardedLocalPgTestUrl();
  const teile = basis ? /^([^:]+:\/\/[^/?#]*\/)([^/?#]*)(.*)$/.exec(basis) : null;
  if (
    !basis ||
    !teile ||
    !decodeURIComponent(teile[2] ?? "")
      .toLowerCase()
      .includes("test")
  ) {
    throw new Error("KO17 PG benötigt eine gültige, offiziell bereitgestellte Wegwerf-Testbasis.");
  }
  verwaltung = createPool(basis);
  endeV = poolAbschluss(verwaltung);
  await verwaltung.query(`CREATE DATABASE ${DB}`);
  eigeneDb = true;
  const url = `${teile[1]}${DB}${teile[3]}`;
  poolA = createPool(url);
  endeA = poolAbschluss(poolA);
  poolB = createPool(url);
  endeB = poolAbschluss(poolB);
  await migrate(poolA);
  servicesA = buildPgServices(poolA);
  const servicesB = buildPgServices(poolB);
  appA = buildApp(servicesA);
  appB = buildApp(servicesB);
  await appA.ready();
  await appB.ready();
  const registriert = await appA.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      name: "KO17 PG Admin",
      email: "admin@ko17-pg.test",
      password: "Fiktiv-KO17-PG-123!",
    },
  });
  expect(registriert.statusCode).toBe(201);
  const login = await appA.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@ko17-pg.test", password: "Fiktiv-KO17-PG-123!" },
  });
  expect(login.statusCode).toBe(200);
  headers = { authorization: `Bearer ${login.json().token}` };
  await servicesA.externalKnowledge.setStage("search_attach");
}, 60_000);

afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  const fehler: unknown[] = [];
  const versuche = async (aktion: () => unknown) => {
    try {
      await aktion();
    } catch (ursache) {
      fehler.push(ursache);
    }
  };
  await Promise.all([versuche(() => appA?.close()), versuche(() => appB?.close())]);
  await Promise.all([versuche(() => endeA?.()), versuche(() => endeB?.())]);
  if (eigeneDb) await versuche(() => verwaltung?.query(`DROP DATABASE ${DB}`));
  await versuche(() => endeV?.());
  if (fehler.length) throw new AggregateError(fehler, "KO17 PG-Aufräumen fehlgeschlagen.");
  if (eigeneDb)
    console.log(
      JSON.stringify({
        event: "ko17-pg-abgeschlossen",
        eigeneDbEntfernt: true,
        poolsBeendet: true,
      }),
    );
});
function put(app: FastifyInstance, id: string, payload: object) {
  return app.inject({ method: "PUT", url: `/api/kos/${id}`, headers, payload });
}
async function lesen(id: string) {
  const r = await appA.inject({ method: "GET", url: `/api/kos/${id}`, headers });
  expect(r.statusCode).toBe(200);
  return r.json<KnowledgeObject>();
}
async function anlegen() {
  const r = await appA.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "KO17 PG Quellen",
      statement: "Echter Quellen-Prüfbeitrag.",
      type: "best_practice",
      category: "Prüfstand",
      confidentiality: "intern",
    },
  });
  expect(r.statusCode).toBe(201);
  await servicesA.aiCheckWorker?.idle();
  return r.json<KnowledgeObject>().id;
}

describe("KO17 Quellen auf echtem PostgreSQL", () => {
  it("liest im selben App-Prozess seriell frisch und erhält beide bestätigten Quellen", async () => {
    const id = await anlegen();
    const erreicht = offen();
    const weiter = offen();
    const zweiterGestartet = offen();
    const update = PgKoRepo.prototype.update;
    const finden = PgKoRepo.prototype.findById;
    const add = servicesA.ko.addSource.bind(servicesA.ko);
    let ersterWrite = true;
    let zweiteImDienst = false;
    let freigegeben = false;
    let vorzeitigGelesen = 0;
    vi.spyOn(PgKoRepo.prototype, "update").mockImplementation(async function (
      this: PgKoRepo,
      ko,
      tx,
    ) {
      if (ko.id === id && ersterWrite) {
        ersterWrite = false;
        erreicht.resolve();
        await weiter.promise;
      }
      return update.call(this, ko, tx);
    });
    vi.spyOn(PgKoRepo.prototype, "findById").mockImplementation(function (this: PgKoRepo, ...args) {
      if (args[0] === id && zweiteImDienst && !freigegeben) vorzeitigGelesen += 1;
      return finden.apply(this, args);
    });
    vi.spyOn(servicesA.ko, "addSource").mockImplementation((...args) => {
      if (args[2].label === "Zwei") zweiteImDienst = true;
      const lauf = add(...args);
      if (args[2].label === "Zwei") zweiterGestartet.resolve();
      return lauf;
    });
    const erster = put(appA, id, { action: "add-source", source: quelle("Eins") }).then((r) => r);
    let zweiter: ReturnType<typeof erster.then> | undefined;
    try {
      await erreicht.promise;
      const lauf = put(appA, id, { action: "add-source", source: quelle("Zwei") }).then((r) => r);
      zweiter = lauf;
      await zweiterGestartet.promise;
      expect(vorzeitigGelesen).toBe(0);
      freigegeben = true;
      weiter.resolve();
      expect((await Promise.all([erster, lauf])).map((r) => r.statusCode)).toEqual([200, 200]);
      const ko = await lesen(id);
      expect(ko.sources.map((q) => q.label).sort()).toEqual(["Eins", "Zwei"]);
      expect(
        (await new PgEvidenceRepo(poolA as Pool).listByKo(id))
          .filter((b) => b.kind === "source")
          .map((b) => b.sourceId)
          .sort(),
      ).toEqual(ko.sources.map((q) => q.id).sort());
    } finally {
      freigegeben = true;
      weiter.resolve();
      await Promise.allSettled([erster, ...(zweiter ? [zweiter] : [])]);
    }
  }, 60_000);

  it("lehnt den zweiten Prozess mit echtem CAS409 ab und behält fremde Quelle ohne Phantom-Evidence/Audit", async () => {
    const id = await anlegen();
    expect(
      (await put(appA, id, { action: "add-source", source: quelle("Bestand") })).statusCode,
    ).toBe(200);
    const erreicht = offen();
    const weiter = offen();
    const update = PgKoRepo.prototype.update;
    let halten = true;
    vi.spyOn(PgKoRepo.prototype, "update").mockImplementation(async function (
      this: PgKoRepo,
      ko,
      tx,
    ) {
      if (halten && ko.id === id && ko.sources.some((q) => q.label === "Verlierer")) {
        halten = false;
        erreicht.resolve();
        await weiter.promise;
      }
      return update.call(this, ko, tx);
    });
    const a = put(appA, id, { action: "add-source", source: quelle("Verlierer") }).then((r) => r);
    try {
      await erreicht.promise;
      const b = await put(appB, id, { action: "add-source", source: quelle("Bestaetigt") });
      expect(b.statusCode).toBe(200);
      const bestaetigt = await lesen(id);
      expect(bestaetigt.sources.map((q) => q.label).sort()).toEqual(["Bestaetigt", "Bestand"]);
      const evidence = new PgEvidenceRepo(poolA as Pool);
      const audit = new PgAuditRepo(poolA as Pool);
      const belege = await evidence.listByKo(id);
      const auditVor = (await audit.all()).filter(
        (e) => e.target === id && e.action.startsWith("ko.source-"),
      );
      weiter.resolve();
      const verloren = await a;
      expect(verloren.statusCode).toBe(409);
      expect(verloren.json().error).toBe("STALE_WRITE");
      const nachher = await lesen(id);
      expect(nachher.sources).toEqual(bestaetigt.sources);
      expect(nachher.rowVersion).toBe(bestaetigt.rowVersion);
      expect(await evidence.listByKo(id)).toEqual(belege);
      expect(
        (await audit.all()).filter((e) => e.target === id && e.action.startsWith("ko.source-")),
      ).toEqual(auditVor);
    } finally {
      weiter.resolve();
      await Promise.allSettled([a]);
    }
  }, 60_000);
});
