import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { gespraechsnotiz, notizauftrag } from "./notizquelle-vorrichtung";
import { type App, anmelden, draht, registrieren } from "./vorrichtung";
let container: StartedTestContainer;
let url = "";
const offen: { app: App; pool: ReturnType<typeof createPool> }[] = [];
async function start() {
  const pool = createPool(url);
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
    .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test_g_notiz" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test_g_notiz`;
  const pool = createPool(url);
  try {
    await migrate(pool);
  } finally {
    await pool.end();
  }
}, 180_000);
afterAll(async () => {
  for (const x of [...offen]) await stop(x.app);
  await container?.stop();
});
it("N-PG · echtes Notizoriginal/Teilergebnis überstehen Neustart; unveränderte Quelle setzt fort, geänderte Quelle sperrt Erinnerung", async () => {
  const app1 = await start();
  const token1 = await registrieren(app1);
  const q = await gespraechsnotiz(app1, token1);
  const v = await notizauftrag(app1, token1, q);
  const first = await v.aus(1);
  expect(first.statusCode, first.body).toBe(200);
  const taskId = first.json().schritt.ergebnis.id;
  expect(
    (await draht(app1, token1)("POST", `${v.pfad}/unterbrechen`, { auftragFassung: 1 })).statusCode,
  ).toBe(200);
  await stop(app1);
  const app2 = await start();
  const token2 = await anmelden(app2);
  const auf2 = draht(app2, token2);
  const stand = (await auf2("GET", v.basis))
    .json()
    .auftraege.find((a: { id: string }) => a.id === v.a.id);
  expect(stand.plan[0].notizQuelle).toMatchObject({
    id: q.notiz.id,
    fassung: 1,
    gespraechId: q.gid,
    nachrichtId: q.nachrichtId,
  });
  expect(stand.schritte[0].ergebnis.id).toBe(taskId);
  const task = (await auf2("GET", `/api/me/klara/aufgaben/${taskId}`)).json().aufgabe;
  expect(task).toMatchObject({
    inhalt: q.original,
    bezug: { art: "notiz", notizId: q.notiz.id },
    objektbezug: q.notiz.objektbezug,
  });
  expect((await auf2("POST", `${v.pfad}/fortsetzen`, { auftragFassung: 1 })).statusCode).toBe(200);
  const second = await auf2("POST", `${v.pfad}/schritte/g-notiz-2/ausfuehrung`, {
    nr: 2,
    auftragFassung: 1,
  });
  expect(second.statusCode, second.body).toBe(200);
  const eid = second.json().schritt.ergebnis.id;
  expect(
    (
      await auf2("POST", `${v.pfad}/schritte/g-notiz-2/ausfuehrung`, { nr: 2, auftragFassung: 1 })
    ).json().wiederholt,
  ).toBe(true);
  expect(
    (await auf2("GET", `/api/me/klara/erinnerungen/${eid}`)).json().erinnerung.bezug.aufgabeId,
  ).toBe(taskId);
  await stop(app2);
  const app3 = await start();
  const token3 = await anmelden(app3);
  const q2 = await gespraechsnotiz(app3, token3, "G-Notiz vor Quellenwechsel");
  const v2 = await notizauftrag(app3, token3, q2);
  const first2 = await v2.aus(1);
  expect(first2.statusCode).toBe(200);
  const tid2 = first2.json().schritt.ergebnis.id;
  await draht(app3, token3)("POST", `${v2.pfad}/unterbrechen`, { auftragFassung: 1 });
  await stop(app3);
  const app4 = await start();
  const token4 = await anmelden(app4);
  const auf4 = draht(app4, token4);
  const geaendert = await auf4("PUT", `/api/me/klara/notizen/${q2.notiz.id}`, {
    fassung: 1,
    titel: q2.notiz.titel,
    inhalt: "Tatsächlich geänderte Quelle nach Dienstneustart",
    offeneFragen: [],
    art: "notiz",
  });
  expect(geaendert.statusCode).toBe(200);
  expect((await auf4("POST", `${v2.pfad}/fortsetzen`, { auftragFassung: 1 })).statusCode).toBe(200);
  const gesperrt = await auf4("POST", `${v2.pfad}/schritte/g-notiz-2/ausfuehrung`, {
    nr: 2,
    auftragFassung: 1,
  });
  expect(gesperrt.statusCode).toBe(409);
  expect(gesperrt.json()).toMatchObject({ grund: "quelle_geaendert" });
  expect((await auf4("GET", `/api/me/klara/aufgaben/${tid2}`)).statusCode).toBe(200);
  const laeuft = (await auf4("GET", v2.basis))
    .json()
    .auftraege.find((a: { id: string }) => a.id === v2.a.id);
  expect(laeuft.stand).not.toBe("abgeschlossen");
  expect(laeuft.schritte[0].ergebnis.id).toBe(tid2);
  expect((await auf4("GET", "/api/me/klara/erinnerungen")).json().erinnerungen).toHaveLength(1);
  await stop(app4);
}, 120_000);
