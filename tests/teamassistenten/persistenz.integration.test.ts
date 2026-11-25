import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { poolAbschluss } from "../audit-gesamt/pool-abschluss";
import { anfrage, fachbereich } from "./aufbau";

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
    .withEnvironment({ POSTGRES_PASSWORD: "p03-synthetic", POSTGRES_DB: "team_test" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  url = `postgresql://postgres:p03-synthetic@${container.getHost()}:${container.getMappedPort(5432)}/team_test`;
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
it("liefert nach App- und Poolneustart dieselbe Freigabe, erkennt zwei konkurrierende Änderungen und hält Entwurf sowie Rückkehr zur alten Fassung getrennt", async () => {
  const erst = await starte();
  const f = await fachbereich(erst.s, erst.app);
  const autor = anfrage(erst.app, f.autor.token);
  const test = await autor("POST", `${f.pfad}/pruefen`, { revision: 1 });
  expect(test.statusCode, test.body).toBe(200);
  expect(test.json().pruefung.bestanden).toBe(true);
  const release = await autor("POST", `${f.pfad}/freigeben`, { revision: 2, version: 1 });
  expect(release.statusCode, release.body).toBe(200);
  await erst.stop();
  const [a, b] = await Promise.all([starte(), starte()]);
  const teamA = anfrage(a.app, f.autor.token);
  const teamB = anfrage(b.app, f.autor.token);
  const lesen = anfrage(b.app, f.leser.token);
  const frage = (version: number) =>
    lesen("POST", `${f.pfad}/fragen`, { version, frage: f.aussage, sprache: "en" });
  expect((await frage(1)).json()).toMatchObject({
    version: 1,
    antwort: { stand: "belegt", quellen: [{ id: f.ko.id, version: f.ko.version }] },
  });
  const aendern = (name: string) => ({ revision: 3, definition: { ...f.definition, name } });
  const parallel = await Promise.all([
    teamA("PUT", f.pfad, aendern("A")),
    teamB("PUT", f.pfad, aendern("B")),
  ]);
  expect(parallel.map((r) => r.statusCode).sort()).toEqual([200, 409]);
  const detail = await teamA("GET", f.pfad);
  expect(detail.json()).toMatchObject({ entwurf: 2, revision: 4, aktiv: 1, pruefung: null });
  expect((await lesen("GET", f.api)).json().assistenten).toMatchObject([
    { name: f.definition.name },
  ]);
  expect(
    (await teamB("POST", `${f.pfad}/pruefen`, { revision: 4 })).json().pruefung.bestanden,
  ).toBe(true);
  expect(
    (await teamA("POST", `${f.pfad}/freigeben`, { revision: 5, version: 2 })).json(),
  ).toMatchObject({ aktiv: 2, freigegebeneVersionen: [1, 2] });
  expect((await frage(1)).statusCode).toBe(409);
  expect((await frage(2)).json().antwort.stand).toBe("belegt");
  expect(
    (await teamB("POST", `${f.pfad}/freigeben`, { revision: 6, version: 1 })).json().aktiv,
  ).toBe(1);
  expect((await frage(1)).json().antwort.stand).toBe("belegt");
  expect((await teamA("POST", `${f.pfad}/zurueckziehen`, { revision: 7 })).json().aktiv).toBeNull();
  await a.stop();
  await b.stop();
  const nachher = await starte();
  expect((await anfrage(nachher.app, f.leser.token)("GET", f.api)).json().assistenten).toEqual([]);
  expect((await anfrage(nachher.app, f.autor.token)("GET", f.pfad)).json()).toMatchObject({
    aktiv: null,
    entwurf: 2,
    revision: 8,
    freigegebeneVersionen: [1, 2],
  });
});
