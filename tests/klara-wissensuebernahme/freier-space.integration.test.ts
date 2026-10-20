import { randomUUID } from "node:crypto";
import { GenericContainer, Wait } from "testcontainers";
import { expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { SPACES_SPERRE } from "../../services/app/src/spaces";
it("freier Space ohne Vorlage hält echte PG-Sperre gegen parallele Archivierung bis zum Erstinsert", async () => {
  const container = await new GenericContainer("postgres:16-alpine")
    .withName(`klara-f-space-${randomUUID()}`)
    .withLabels({ "klarwerk.owner": "klara-f-20261020" })
    .withEnvironment({ POSTGRES_PASSWORD: "synthetisch", POSTGRES_DB: "klara_f_space_test" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  const url = `postgresql://postgres:synthetisch@${container.getHost()}:${container.getMappedPort(5432)}/klara_f_space_test`;
  const pa = createPool(url);
  const pb = createPool(url);
  let frei: () => void = () => {};
  const gate = new Promise<void>((r) => {
    frei = r;
  });
  const sa = buildPgServices(pa);
  const sb = buildPgServices(pb);
  const a = buildApp(sa);
  const b = buildApp(sb);
  try {
    await migrate(pa);
    await a.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "F Space", email: "space@f.test", password: "secret123" },
    });
    const token = (
      await a.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "space@f.test", password: "secret123" },
      })
    ).json().token;
    const headers = { authorization: `Bearer ${token}` };
    const aid = (await sa.auth.listUsers())[0]?.id;
    if (!aid) throw new Error("Prüfkonto fehlt");
    const spaceR = await a.inject({
      method: "POST",
      url: "/api/spaces",
      headers,
      payload: {
        name: "F Freier Space",
        zweck: "Enger Sperrgegenfall",
        verantwortlich: aid,
        zugang: "mitglieder",
        mitglieder: [],
        ansichten: [],
      },
    });
    expect(spaceR.statusCode, spaceR.body).toBe(201);
    const space = spaceR.json();
    const nr = await a.inject({
      method: "POST",
      url: "/api/me/klara/notizen",
      headers,
      payload: {
        vorgang: "f-pg-space-notiz",
        weg: "geschrieben",
        inhalt: "F Quelltext.",
        objektbezug: { pfad: "/start", seitenName: "Start", objekt: "Quelle" },
      },
    });
    expect(nr.statusCode, nr.body).toBe(201);
    const n = nr.json().notiz;
    const ziel = {
      art: "space",
      spaceId: space.id,
      type: "technik",
      category: "Prüfung",
      confidentiality: "intern",
      conditions: [],
    };
    const v = await a.inject({
      method: "POST",
      url: `/api/me/klara/notizen/${n.id}/wissen/vorschau`,
      headers,
      payload: { fassung: n.fassung, ziel },
    });
    expect(v.statusCode, v.body).toBe(200);
    let gestartet: () => void = () => {};
    const start = new Promise<void>((r) => {
      gestartet = r;
    });
    const create = sa.ko.create.bind(sa.ko);
    sa.ko.create = async (...args) => {
      gestartet();
      await gate;
      return create(...args);
    };
    const run = a.inject({
      method: "POST",
      url: `/api/me/klara/notizen/${n.id}/wissen/uebernehmen`,
      headers,
      payload: { fassung: n.fassung, ziel, stempel: v.json().stempel, bewusst: true },
    });
    await start;
    const observer = await pb.connect();
    try {
      const lock = await observer.query<{ frei: boolean }>(
        "SELECT pg_try_advisory_lock($1::bigint) frei",
        [SPACES_SPERRE],
      );
      if (lock.rows[0]?.frei)
        await observer.query("SELECT pg_advisory_unlock($1::bigint)", [SPACES_SPERRE]);
      expect(lock.rows[0]?.frei).toBe(false);
    } finally {
      observer.release();
    }
    let geaendert = false;
    const mutation = sb.spaces.exklusiv(async () => {
      const s = (await sb.spaces.aktuelle()).find((s) => s.id === space.id);
      if (!s) throw new Error("Space fehlt");
      expect(
        await sb.spaces.lege({
          ...s,
          version: s.version + 1,
          archiviert: true,
          vorgang: "archiviert",
          geaendertVon: aid,
          geaendertAm: new Date().toISOString(),
        }),
      ).toBe(true);
      geaendert = true;
    });
    expect(geaendert).toBe(false);
    frei();
    const r = await run;
    expect(r.statusCode, r.body).toBe(200);
    await mutation;
    expect(geaendert).toBe(true);
    expect((await sa.ko.get(r.json().beitrag.id))?.spaceId).toBe(space.id);
    const danach = await a.inject({
      method: "POST",
      url: `/api/me/klara/notizen/${n.id}/wissen/vorschau`,
      headers,
      payload: { fassung: n.fassung, ziel },
    });
    expect(danach.statusCode).toBe(403);
    expect(await sa.ko.list()).toHaveLength(1);
  } finally {
    frei();
    await a.close();
    await b.close();
    await pa.end();
    await pb.end();
    await container.stop();
  }
}, 120000);
