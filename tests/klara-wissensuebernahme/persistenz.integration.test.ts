import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
let container: StartedTestContainer;
const pools: Pool[] = [];
const apps: ReturnType<typeof buildApp>[] = [];
let url = "";
function appFuer(db = "klara_f_test") {
  const p = createPool(`${url}/${db}`);
  pools.push(p);
  const app = buildApp(buildPgServices(p));
  apps.push(app);
  return app;
}
beforeAll(async () => {
  container = await new GenericContainer("postgres:16-alpine")
    .withName(`klara-f-wissen-${randomUUID()}`)
    .withLabels({ "klarwerk.owner": "klara-f-20261020" })
    .withEnvironment({ POSTGRES_PASSWORD: "f-synthetic", POSTGRES_DB: "klara_f_test" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  url = `postgresql://postgres:f-synthetic@${container.getHost()}:${container.getMappedPort(5432)}`;
  const p = createPool(`${url}/klara_f_test`);
  await migrate(p);
  await migrate(p);
  await p.end();
}, 120000);
afterAll(async () => {
  for (const a of apps) await a.close();
  for (const p of pools) await p.end();
  await container?.stop();
});
it("F08 · echter PG-Neustart, parallele Übernahme, pg_dump/Restore und private Löschung", async () => {
  let a = appFuer();
  await a.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "F Synthetisch", email: "f@wissen.test", password: "synthetisch123" },
  });
  async function login(app: typeof a) {
    const r = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "f@wissen.test", password: "synthetisch123" },
    });
    expect(r.statusCode, r.body).toBe(200);
    return r.json().token as string;
  }
  let token = await login(a);
  const call = (
    app: typeof a,
    method: "GET" | "POST" | "DELETE",
    path: string,
    payload?: unknown,
  ) =>
    app.inject({
      method,
      url: `/api/me/klara${path}`,
      headers: { authorization: `Bearer ${token}` },
      ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }),
    });
  const x = {
    titel: "F Ölstand",
    inhalt: "Ölstand nur bei stehender Presse prüfen.",
    projekt: "F Presse 4",
    abschnitt: "F Auswahl",
    antwortFassung: "1",
    aussagen: [
      { text: "Ölstand nur bei stehender Presse prüfen.", art: "behauptung", quellen: [] },
    ],
  };
  const imp = await call(a, "POST", "/wissen/import", x);
  expect(imp.statusCode, imp.body).toBe(201);
  const n = imp.json().notiz;
  a = appFuer();
  token = await login(a);
  const gelesen = await call(a, "GET", `/notizen/${n.id}`);
  expect(gelesen.statusCode, gelesen.body).toBe(200);
  expect(gelesen.json().notiz.wissensHerkunft).toEqual(n.wissensHerkunft);
  const ziel = {
    art: "artikel",
    confidentiality: "intern",
    type: "technik",
    category: "Wartung",
    conditions: ["Stillstand", "Fachpersonal"],
  };
  const v = await call(a, "POST", `/notizen/${n.id}/wissen/vorschau`, { fassung: n.fassung, ziel });
  expect(v.statusCode, v.body).toBe(200);
  const body = { fassung: n.fassung, ziel, stempel: v.json().stempel, bewusst: true };
  const b = appFuer();
  const rs = await Promise.all([
    call(a, "POST", `/notizen/${n.id}/wissen/uebernehmen`, body),
    call(b, "POST", `/notizen/${n.id}/wissen/uebernehmen`, body),
  ]);
  for (const r of rs) expect(r.statusCode, r.body).toBe(200);
  const id = rs[0]?.json().beitrag.id;
  expect(rs[1]?.json().beitrag.id).toBe(id);
  const p = createPool(`${url}/klara_f_test`);
  expect(
    (
      await p.query(
        "SELECT count(*)::int n FROM kos WHERE data->>'createOperationId' LIKE 'klara-wissen-%' ",
      )
    ).rows[0].n,
  ).toBe(1);
  await p.end();
  for (const cmd of [
    ["pg_dump", "-U", "postgres", "-d", "klara_f_test", "-f", "/tmp/f08.sql"],
    ["createdb", "-U", "postgres", "klara_f_restore_test"],
    [
      "psql",
      "-U",
      "postgres",
      "-d",
      "klara_f_restore_test",
      "-v",
      "ON_ERROR_STOP=1",
      "-f",
      "/tmp/f08.sql",
    ],
  ]) {
    const r = await container.exec(cmd);
    expect(r.exitCode, r.output.slice(-500)).toBe(0);
  }
  const restore = appFuer("klara_f_restore_test");
  token = await login(restore);
  const wieder = await call(restore, "POST", `/notizen/${n.id}/wissen/uebernehmen`, body);
  expect(wieder.statusCode, wieder.body).toBe(200);
  expect(wieder.json()).toMatchObject({ beitrag: { id }, wiederholt: true });
  expect((await call(restore, "DELETE", `/notizen/${n.id}`)).statusCode).toBe(200);
  expect((await call(restore, "GET", `/notizen/${n.id}`)).statusCode).toBe(404);
  expect(
    (
      await restore.inject({
        method: "GET",
        url: `/api/kos/${id}`,
        headers: { authorization: `Bearer ${token}` },
      })
    ).statusCode,
  ).toBe(200);
});
