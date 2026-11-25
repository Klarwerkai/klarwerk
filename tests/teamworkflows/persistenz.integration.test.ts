import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { PgTeamworkflowRepo } from "../../services/app/src/teamworkflows";
import { poolAbschluss } from "../audit-gesamt/pool-abschluss";
import { anfrage } from "../teamassistenten/aufbau";
import { workflowUmfeld } from "./definition-fixture";

let container: StartedTestContainer | undefined;
let url = "";
const schliessen: (() => Promise<void>)[] = [];
async function starte() {
  const pool = createPool(url);
  const ende = poolAbschluss(pool);
  const s = buildPgServices(pool);
  const app = buildApp(s);
  let abgeschlossen = false;
  const stop = async () => {
    if (abgeschlossen) return;
    await app.close();
    await ende();
    abgeschlossen = true;
  };
  schliessen.push(stop);
  return { app, s, stop };
}
beforeAll(async () => {
  container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({ POSTGRES_PASSWORD: "workflow-synthetic", POSTGRES_DB: "team_test" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  url = `postgresql://postgres:workflow-synthetic@${container.getHost()}:${container.getMappedPort(5432)}/team_test`;
  const pool = createPool(url);
  const ende = poolAbschluss(pool);
  try {
    await migrate(pool);
    await migrate(pool);
  } finally {
    await ende();
  }
});
afterAll(async () => {
  try {
    for (const close of schliessen) await close();
  } finally {
    await container?.stop();
  }
});
it("setzt einen Vorgang nach Neustart an der Entscheidung fort und verbucht sein Ergebnis bei konkurrierender Wiederholung genau einmal", async () => {
  const a = await starte();
  const f = await workflowUmfeld(a.s, a.app);
  const autor = anfrage(a.app, f.autor.token);
  const leser = anfrage(a.app, f.leser.token);
  const r = await autor("POST", f.api, { teamId: f.team.id, definition: f.definition });
  expect(r.statusCode, r.body).toBe(201);
  const pfad = `${f.api}/${r.json().id}`;
  const p = await autor("POST", `${pfad}/pruefen`, { revision: 1, sprache: "en" });
  expect(p.statusCode, p.body).toBe(200);
  expect(p.json().pruefung.bestanden).toBe(true);
  const released = await autor("POST", `${pfad}/freigeben`, { revision: 2, version: 1 });
  expect(released.statusCode, released.body).toBe(200);
  const start = { version: 1, vorgang: "einkauf-1147", fall: f.aussage, sprache: "en" };
  const l = await leser("POST", `${pfad}/laeufe`, start);
  expect(l.statusCode, l.body).toBe(200);
  const lauf = `${pfad}/laeufe/${l.json().id}`;
  const qa = await leser("POST", `${lauf}/weiter`, {
    revision: l.json().revision,
    aktion: "weiter",
  });
  expect(qa.statusCode, qa.body).toBe(200);
  expect(qa.json()).toMatchObject({ index: 1, revision: 2, version: 1, ergebnisse: [] });
  await a.stop();
  const [b, c] = await Promise.all([starte(), starte()]);
  const autorB = anfrage(b.app, f.autor.token);
  const autorC = anfrage(c.app, f.autor.token);
  const leserC = anfrage(c.app, f.leser.token);
  const neu = await Promise.all(
    [autorB, autorC].map((wer, index) =>
      wer("PUT", pfad, { revision: 3, definition: { ...f.definition, name: `Regel ${index}` } }),
    ),
  );
  expect(neu.map((x) => x.statusCode).sort()).toEqual([200, 409]);
  const p2 = await autorB("POST", `${pfad}/pruefen`, { revision: 4, sprache: "de" });
  expect(p2.statusCode, p2.body).toBe(200);
  expect(p2.json().pruefung.bestanden).toBe(true);
  expect(
    (await autorB("POST", `${pfad}/freigeben`, { revision: 5, version: 2 })).json().aktiv,
  ).toBe(2);
  const alt = await leserC("GET", lauf);
  expect(alt.statusCode, alt.body).toBe(200);
  expect(alt.json()).toMatchObject({ index: 1, revision: 2, version: 1, ergebnisse: [] });
  const unbefugt = await leserC("POST", `${lauf}/weiter`, { revision: 2, aktion: "annehmen" });
  expect(unbefugt.statusCode).toBe(403);
  const entscheid = await autorB("POST", `${lauf}/weiter`, { revision: 2, aktion: "annehmen" });
  expect(entscheid.statusCode, entscheid.body).toBe(200);
  expect(entscheid.json()).toMatchObject({ index: 2, version: 1, ergebnisse: [] });
  const cmd = { revision: 3, aktion: "weiter" };
  const doppelt = await Promise.all([
    autorB("POST", `${lauf}/weiter`, cmd),
    autorC("POST", `${lauf}/weiter`, cmd),
  ]);
  for (const result of doppelt) expect([200, 409], result.body).toContain(result.statusCode);
  expect(doppelt.some((x) => x.statusCode === 200)).toBe(true);
  const wieder = await autorB("POST", `${lauf}/weiter`, cmd);
  expect(wieder.statusCode, wieder.body).toBe(200);
  expect(wieder.json()).toMatchObject({
    revision: 4,
    stand: "abgeschlossen",
    version: 1,
    ergebnisse: [{ workflowVersion: 1 }],
  });
  const nach = await leserC("GET", lauf);
  expect(nach.json().ergebnisse).toHaveLength(1);
  expect(nach.json().verlauf.filter((e: { typ: string }) => e.typ === "aktion")).toHaveLength(1);
  expect((await leserC("POST", `${pfad}/laeufe`, start)).json().id).toBe(l.json().id);
  // Simulate a publication checked before an assistant withdrawal, reaching its SQL update afterwards.
  const kontrollPool = createPool(url);
  try {
    const repo = new PgTeamworkflowRepo(kontrollPool);
    const gespeicherterStand = await repo.lesen(r.json().id);
    const fassung = gespeicherterStand?.freigaben.at(-1);
    if (!gespeicherterStand || !fassung) throw new Error("Gespeicherte Fassung fehlt.");
    const leserechte = { id: f.autor.id, role: "experte" } as const;
    const bestaetigeStand = () =>
      repo.speichern(
        { ...gespeicherterStand, revision: gespeicherterStand.revision + 1 },
        gespeicherterStand.revision,
        f.team.version,
        leserechte,
        fassung,
      );
    // Der Quellimport darf Leserechte auch ohne neue Inhaltsversion entziehen.
    await kontrollPool.query(
      "UPDATE kos SET data=jsonb_set(data, '{quellrechte}', $2::jsonb) WHERE id=$1",
      [f.ko.id, JSON.stringify({ leser: [f.fremd.id] })],
    );
    expect(await bestaetigeStand()).toBe(false);
    expect((await repo.lesen(gespeicherterStand.id))?.revision).toBe(gespeicherterStand.revision);
    await kontrollPool.query("UPDATE kos SET data=data-'quellrechte' WHERE id=$1", [f.ko.id]);
    await kontrollPool.query(
      "UPDATE kos SET data=jsonb_set(data, '{schutzdatenQuarantaene}', $2::jsonb) WHERE id=$1",
      [f.ko.id, JSON.stringify({ seit: "2026-01-01", arten: ["personalnummer"] })],
    );
    expect(await bestaetigeStand()).toBe(false);
    expect((await repo.lesen(gespeicherterStand.id))?.revision).toBe(gespeicherterStand.revision);
    await kontrollPool.query("UPDATE kos SET data=data-'schutzdatenQuarantaene' WHERE id=$1", [
      f.ko.id,
    ]);
    const aus = await autorB("POST", `${f.assistentPfad}/zurueckziehen`, { revision: 3 });
    expect(aus.statusCode).toBe(200);
    expect(await bestaetigeStand()).toBe(false);
    expect((await repo.lesen(gespeicherterStand.id))?.revision).toBe(gespeicherterStand.revision);
  } finally {
    await kontrollPool.end();
  }
  const widerruf = await autorC("POST", `${pfad}/zurueckziehen`, { revision: 6 });
  expect(widerruf.statusCode, widerruf.body).toBe(200);
  expect((await leserC("GET", lauf)).statusCode).toBe(404);
  await b.stop();
  await c.stop();
});
