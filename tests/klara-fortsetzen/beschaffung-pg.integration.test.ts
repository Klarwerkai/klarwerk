import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import type { KlaraAuftrag } from "../../services/app/src/klara-auftrag";
import { beschaffung } from "./beschaffungs-vorrichtung";
import { type App, anmelden, draht, registrieren } from "./vorrichtung";
let container: StartedTestContainer;
let url = "";
const laufend: { app: App; pool: ReturnType<typeof createPool> }[] = [];
async function start() {
  const pool = createPool(url);
  const app = buildApp(buildPgServices(pool));
  laufend.push({ app, pool });
  await app.ready();
  return app;
}
async function stop(app: App) {
  const i = laufend.findIndex((s) => s.app === app);
  const s = laufend[i];
  if (s) {
    laufend.splice(i, 1);
    await s.app.close();
    await s.pool.end();
  }
}
beforeAll(async () => {
  container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test_g_bes02" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test_g_bes02`;
  const p = createPool(url);
  try {
    await migrate(p);
  } finally {
    await p.end();
  }
}, 180000);
afterAll(async () => {
  for (const s of [...laufend]) await stop(s.app);
  await container?.stop();
});
it("BES-PG1 · gespeicherte Anforderung/Pause → App/Pool beenden → Neuanmeldung → Mengenkorrektur/neue Fassung → Anfrage auf Original ohne Doppelanlage", async () => {
  const app1 = await start();
  const token1 = await registrieren(app1);
  const v = await beschaffung(app1, token1);
  const f = await v.aus(1);
  expect(f.statusCode, f.body).toBe(200);
  const id = f.json().schritt.ergebnis.id;
  const original = (await draht(app1, token1)("GET", `/api/drafts/${id}`)).json();
  expect(
    (await draht(app1, token1)("POST", `${v.pfad}/unterbrechen`, { auftragFassung: 1 })).statusCode,
  ).toBe(200);
  await stop(app1);
  const app2 = await start();
  const token2 = await anmelden(app2);
  const auf = draht(app2, token2);
  const stored = (await auf("GET", v.basis))
    .json()
    .auftraege.find((a: KlaraAuftrag) => a.id === v.a.id) as KlaraAuftrag;
  expect(stored.beschaffung?.menge).toBe("500 Stück");
  expect(stored.schritte[0]?.ergebnis?.id).toBe(id);
  expect(stored.unterbrochenAm).toBeTypeOf("string");
  const corrected = await auf("POST", `${v.pfad}/fassungen`, {
    auftragFassung: stored.fassung,
    erlaubteAktionen: stored.erlaubteAktionen,
    erlaubteZiele: stored.erlaubteZiele,
    grund: "Menge für offene Anfrage korrigiert",
    beschaffung: { ...stored.beschaffung, menge: "750 Stück" },
  });
  expect(corrected.statusCode, corrected.body).toBe(200);
  await stop(app2);
  const app3 = await start();
  const token3 = await anmelden(app3);
  const neu = draht(app3, token3);
  const reread = (await neu("GET", v.basis))
    .json()
    .auftraege.find((a: KlaraAuftrag) => a.id === v.a.id) as KlaraAuftrag;
  expect(reread.fassung).toBe(2);
  expect(reread.fassungen[0]?.beschaffung?.menge).toBe("500 Stück");
  expect(reread.beschaffung?.menge).toBe("750 Stück");
  expect((await neu("GET", `/api/drafts/${id}`)).json()).toEqual(original);
  expect((await neu("POST", `${v.pfad}/fortsetzen`, { auftragFassung: 2 })).statusCode).toBe(200);
  const r = await neu("POST", `${v.pfad}/schritte/bes-2/ausfuehrung`, { nr: 2, auftragFassung: 2 });
  expect(r.statusCode, r.body).toBe(200);
  const ask = (await neu("GET", `/api/drafts/${r.json().schritt.ergebnis.id}`)).json();
  expect(ask.payload.bodyHtml).toContain("750 Stück");
  expect(ask.payload.bodyHtml).toContain(id);
  expect((await neu("GET", `/api/drafts/${id}`)).json()).toEqual(original);
  expect((await neu("GET", "/api/drafts")).json()).toHaveLength(2);
  const repeat = await neu("POST", `${v.pfad}/schritte/bes-2/ausfuehrung`, {
    nr: 2,
    auftragFassung: 2,
  });
  expect(repeat.json().wiederholt).toBe(true);
  expect(repeat.json().schritt.ergebnis.id).toBe(ask.id);
});
