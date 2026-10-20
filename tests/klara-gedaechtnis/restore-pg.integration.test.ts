import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildPgServices } from "../../services/app/src/build-app";
import { createPool, migrate } from "../../services/app/src/db";
import { GedaechtnisLoeschjournal } from "../../services/app/src/gedaechtnis-loeschjournal";
import {
  GedaechtnisDienst,
  PgGedaechtnisRepo,
} from "../../services/app/src/interaktionsgedaechtnis";

let container: StartedTestContainer;
let url: string;
let ordner: string;
const pools: ReturnType<typeof createPool>[] = [];
function pool(db = "klarwerk_test") {
  const p = createPool(url.replace(/\/klarwerk_test$/, `/${db}`));
  pools.push(p);
  return p;
}
beforeAll(async () => {
  container = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klarwerk_test" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  url = `postgresql://postgres:test@${container.getHost()}:${container.getMappedPort(5432)}/klarwerk_test`;
  ordner = await mkdtemp(join(tmpdir(), "klara-e-restore-"));
  await migrate(pool());
  await migrate(pool());
}, 180000);
afterAll(async () => {
  for (const p of pools) await p.end();
  await container?.stop();
  if (ordner) await rm(ordner, { recursive: true, force: true });
});
describe("Klara09 · echter PG-Neustart, Dump/Restore und unabhängige Löschmarken", () => {
  it("verhindert Wiederkehr gelöschter und vor Korrektur gesicherter Vorlieben auch mit verlorenem Datenbankjournal", async () => {
    const pfad = join(ordner, "unabhaengig.ndjson");
    await writeFile(pfad, "");
    const journal = new GedaechtnisLoeschjournal(pfad);
    const p = pool();
    const repo = new PgGedaechtnisRepo(p, journal);
    const d = new GedaechtnisDienst({ repo });
    const loesch = await d.merken("anna", {
      art: "vorliebe",
      inhalt: "Fiktiv geheim löschen",
      darstellung: "kurz",
    });
    const korrektur = await d.merken("anna", {
      art: "vorliebe",
      inhalt: "Fiktiv alte Fassung",
      darstellung: "kurz",
    });
    const fremd = await d.merken("bert", { art: "vorliebe", inhalt: "Fiktiv Bert bleibt" });
    expect(
      (
        await container.exec([
          "pg_dump",
          "-U",
          "postgres",
          "-Fc",
          "-f",
          "/tmp/vorher.dump",
          "klarwerk_test",
        ])
      ).exitCode,
    ).toBe(0);
    expect(await d.vergessen("bert", loesch.id)).toBe(false);
    expect(await readFile(pfad, "utf8")).toBe("");
    expect(await d.vergessen("anna", loesch.id)).toBe(true);
    const neu = await d.aendere("anna", korrektur.id, {
      fassung: 1,
      inhalt: "Fiktiv neue Fassung",
      darstellung: "ausfuehrlich",
    });
    const nachNeustart = new GedaechtnisDienst({ repo: new PgGedaechtnisRepo(pool(), journal) });
    expect(await nachNeustart.eigene("anna")).toEqual([neu]);
    expect(await repo.wendeLoeschmarkenAn()).toBe(0);
    const j = await readFile(pfad, "utf8");
    for (const wort of ["anna", "bert", "Fiktiv", "geheim"]) expect(j).not.toContain(wort);
    expect(
      (await container.exec(["createdb", "-U", "postgres", "klara_restore_test"])).exitCode,
    ).toBe(0);
    expect(
      (
        await container.exec([
          "pg_restore",
          "-U",
          "postgres",
          "-d",
          "klara_restore_test",
          "/tmp/vorher.dump",
        ])
      ).exitCode,
    ).toBe(0);
    const rp = pool("klara_restore_test");
    // Der Dump ist VOR beiden Mutationen; sein eigenes Journal enthält noch keine dieser Marken.
    expect(
      Number(
        (await rp.query("SELECT count(*) FROM interaktions_gedaechtnis_loeschungen")).rows[0].count,
      ),
    ).toBe(0);
    const wieder = new PgGedaechtnisRepo(rp, journal);
    expect(await wieder.wendeLoeschmarkenAn()).toBe(2);
    expect(await wieder.eigene("anna", new Date().toISOString())).toEqual([]);
    expect((await wieder.eigene("bert", new Date().toISOString()))[0]?.id).toBe(fremd.id);
    expect(await wieder.wendeLoeschmarkenAn()).toBe(0);
  }, 120000);
  it("ein nicht schreibbares Journal bestätigt keine Löschung; fehlende/defekte konfigurierte Spur blockiert Restore", async () => {
    const repo = new PgGedaechtnisRepo(pool(), new GedaechtnisLoeschjournal(ordner));
    const d = new GedaechtnisDienst({ repo });
    const e = await d.merken("fehler", { art: "vorliebe", inhalt: "Fiktive erhaltene Eingabe" });
    await expect(d.vergessen("fehler", e.id)).rejects.toThrow();
    expect((await d.eigene("fehler"))[0]?.id).toBe(e.id);
    await expect(new GedaechtnisLoeschjournal(join(ordner, "fehlt")).lesen()).rejects.toThrow(
      "fehlt",
    );
    const kaputt = join(ordner, "kaputt");
    await writeFile(kaputt, '[{"id":"kaputt"}]');
    await expect(
      new PgGedaechtnisRepo(pool(), new GedaechtnisLoeschjournal(kaputt)).wendeLoeschmarkenAn(),
    ).rejects.toThrow();
  });
  it("der normale PG-Aufbau liest nach Neustart und neuer Anmeldung die korrigierte Fassung; onReady replayt vor Zugriff", async () => {
    const p = pool();
    const app = buildApp(buildPgServices(p));
    const email = "anna-api@restore.test";
    const password = "fiktiv-pg-restore-2026";
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/auth/register",
          payload: { name: "Anna Fiktiv", email, password },
        })
      ).statusCode,
    ).toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    expect(login.statusCode).toBe(200);
    const c = login.cookies[0];
    if (!c) throw new Error("cookie fehlt");
    const cookie = `${c.name}=${c.value}`;
    const r = await app.inject({
      method: "POST",
      url: "/api/me/gedaechtnis",
      headers: { cookie },
      payload: { art: "vorliebe", inhalt: "Fiktive API Präferenz", darstellung: "kurz" },
    });
    expect(r.statusCode).toBe(201);
    const id = r.json().eintrag.id;
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/api/me/gedaechtnis/${id}`,
          headers: { cookie },
          payload: { fassung: 1, inhalt: "API Korrektur", darstellung: "ausfuehrlich" },
        })
      ).statusCode,
    ).toBe(200);
    await app.close();
    const neuApp = buildApp(buildPgServices(pool()));
    const l = await neuApp.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    expect(l.statusCode).toBe(200);
    const nc = l.cookies[0];
    if (!nc) throw new Error("cookie fehlt");
    const neuCookie = `${nc.name}=${nc.value}`;
    const liste = await neuApp.inject({
      url: "/api/me/gedaechtnis",
      headers: { cookie: neuCookie },
    });
    expect(liste.json().eintraege[0]).toMatchObject({
      id,
      fassung: 2,
      inhalt: "API Korrektur",
      darstellung: "ausfuehrlich",
    });
    expect(
      (
        await neuApp.inject({
          method: "DELETE",
          url: `/api/me/gedaechtnis/${id}`,
          headers: { cookie: neuCookie },
        })
      ).statusCode,
    ).toBe(200);
    await neuApp.close();
    const dritt = buildApp(buildPgServices(pool()));
    const l3 = await dritt.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    const dc = l3.cookies[0];
    if (!dc) throw new Error("cookie fehlt");
    expect(
      (
        await dritt.inject({
          url: "/api/me/gedaechtnis",
          headers: { cookie: `${dc.name}=${dc.value}` },
        })
      ).json().eintraege,
    ).toEqual([]);
    await dritt.close();
  });
});
