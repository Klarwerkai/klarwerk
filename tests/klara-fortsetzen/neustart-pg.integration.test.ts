import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import type { KlaraAuftrag } from "../../services/app/src/klara-auftrag";
import { type App, anmelden, draht, registrieren, vorgang } from "./vorrichtung";

let container: StartedTestContainer;
let url = "";
const offen: { app: App; pool: ReturnType<typeof createPool> }[] = [];
async function start(db = "klarwerk_test") {
  const pool = createPool(url.replace(/\/klarwerk_test$/, `/${db}`));
  const app = buildApp(buildPgServices(pool));
  await app.ready();
  offen.push({ app, pool });
  return app;
}
async function stop(app: App) {
  const i = offen.findIndex((x) => x.app === app);
  const s = offen[i];
  if (s) {
    offen.splice(i, 1);
    await s.app.close();
    await s.pool.end();
  }
}
beforeAll(async () => {
  container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
  const p = createPool(url);
  try {
    await migrate(p);
  } finally {
    await p.end();
  }
}, 180_000);
afterAll(async () => {
  for (const s of [...offen]) await stop(s.app);
  await container?.stop();
});

it("G-PG1 · echte Speicherung → Dienstneustart/Neuanmeldung → Dump/Restore → Fortsetzen ohne doppelte Originalobjekte", async () => {
  const a1 = await start();
  const t1 = await registrieren(a1);
  const v = await vorgang(a1, t1);
  const s1 = await v.aus(1);
  expect(s1.statusCode, s1.body).toBe(200);
  const originalId = s1.json().schritt.ergebnis.id as string;
  expect(
    (await draht(a1, t1)("POST", `${v.pfad}/unterbrechen`, { auftragFassung: 1 })).statusCode,
  ).toBe(200);
  await stop(a1);
  const a2 = await start();
  const t2 = await anmelden(a2);
  const read = await draht(a2, t2)("GET", v.basis);
  const gespeichert = read.json().auftraege[0] as KlaraAuftrag;
  expect(gespeichert).toMatchObject({
    id: v.a.id,
    unterbrochenAm: expect.any(String),
    schritte: [{ ergebnis: { id: originalId }, stand: "gespeichert" }],
  });
  expect(gespeichert.plan).toEqual(v.a.plan);
  await stop(a2);
  for (const befehl of [
    ["pg_dump", "-U", "postgres", "-d", "klarwerk_test", "-Fc", "-f", "/tmp/g-mehrschritt.dump"],
    ["createdb", "-U", "postgres", "klarwerk_test_g_restore"],
    [
      "pg_restore",
      "-U",
      "postgres",
      "-d",
      "klarwerk_test_g_restore",
      "--no-owner",
      "/tmp/g-mehrschritt.dump",
    ],
  ]) {
    const r = await container.exec(befehl);
    expect(r.exitCode, r.output).toBe(0);
  }
  const a3 = await start("klarwerk_test_g_restore");
  const t3 = await anmelden(a3);
  const auf = draht(a3, t3);
  const restored = (await auf("GET", v.basis)).json().auftraege[0] as KlaraAuftrag;
  expect(restored).toEqual(gespeichert);
  expect((await auf("GET", `/api/drafts/${originalId}`)).statusCode).toBe(200);
  expect((await auf("POST", `${v.pfad}/fortsetzen`, { auftragFassung: 1 })).statusCode).toBe(200);
  const repeat = await auf("POST", `${v.pfad}/schritte/g-1/ausfuehrung`, {
    nr: 1,
    auftragFassung: 1,
  });
  expect(repeat.json()).toMatchObject({
    wiederholt: true,
    schritt: { ergebnis: { id: originalId } },
  });
  for (const nr of [2, 3]) {
    const r = await auf("POST", `${v.pfad}/schritte/g-${nr}/ausfuehrung`, {
      nr,
      auftragFassung: 1,
    });
    expect(r.statusCode, r.body).toBe(200);
  }
  const fertig = (await auf("GET", v.basis)).json().auftraege[0] as KlaraAuftrag;
  expect(fertig.stand).toBe("abgeschlossen");
  expect((await auf("GET", "/api/drafts")).json()).toHaveLength(3);
  expect(fertig.schritte[0]?.ergebnis?.id).toBe(originalId);
  const rueck = await auf("POST", `${v.pfad}/schritte/g-3/ruecknahme`, {});
  expect(rueck.statusCode, rueck.body).toBe(200);
  const rueckId = fertig.schritte[2]?.ergebnis?.id;
  expect((await auf("GET", `/api/drafts/${rueckId}`)).statusCode).toBe(404);
  await stop(a3);
  const a4 = await start("klarwerk_test_g_restore");
  const t4 = await anmelden(a4);
  const nach = (await draht(a4, t4)("GET", v.basis)).json().auftraege[0] as KlaraAuftrag;
  expect(nach.schritte[2]?.stand).toBe("zurueckgenommen");
  expect(
    (await draht(a4, t4)("POST", `${v.pfad}/fortsetzen`, { auftragFassung: 1 })).statusCode,
  ).toBe(409);
  await stop(a4);
}, 120_000);
