import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createPool, migrate } from "../../services/app/src/db";
import { GedaechtnisLoeschjournal } from "../../services/app/src/gedaechtnis-loeschjournal";
import {
  GedaechtnisDienst,
  PgGedaechtnisRepo,
} from "../../services/app/src/interaktionsgedaechtnis";
let c: StartedTestContainer;
let url = "";
let ordner = "";
const pools: ReturnType<typeof createPool>[] = [];
const START = Date.parse("2026-10-20T12:00:00Z");
const TAG = 86400000;
function pool(db = "klara_p10_test") {
  const p = createPool(url.replace(/\/klara_p10_test$/, `/${db}`));
  pools.push(p);
  return p;
}
beforeAll(async () => {
  c = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({ POSTGRES_PASSWORD: "test", POSTGRES_DB: "klara_p10_test" })
    .withExposedPorts(5432)
    .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/, 2))
    .start();
  url = `postgresql://postgres:test@${c.getHost()}:${c.getMappedPort(5432)}/klara_p10_test`;
  ordner = await mkdtemp(join(tmpdir(), "e-p10-pg-"));
  await writeFile(join(ordner, "marken.ndjson"), "");
  await migrate(pool());
  await migrate(pool());
}, 180000);
afterAll(async () => {
  for (const p of pools) await p.end();
  await c?.stop();
  if (ordner) await rm(ordner, { recursive: true, force: true });
});
it("P10-AC08 · echte PG-Ausnahme, neuer Pool, tatsächliches Ende und Restore dürfen sie nicht wiederbeleben", async () => {
  let jetzt = START;
  const journal = new GedaechtnisLoeschjournal(join(ordner, "marken.ndjson"));
  const repo = new PgGedaechtnisRepo(pool(), journal);
  const d = new GedaechtnisDienst({ repo, jetzt: () => jetzt });
  const a = await d.merken("anna", {
    art: "vorliebe",
    inhalt: "Fiktiver persönlicher Inhalt",
    aufbewahrungTage: 30,
  });
  const b = await d.merken("bert", {
    art: "vorliebe",
    inhalt: "Fiktiver fremder Inhalt bleibt",
    aufbewahrungTage: 365,
  });
  const bis = new Date(START + 40 * TAG).toISOString();
  await d.aendere("anna", a.id, {
    fassung: 1,
    inhalt: a.inhalt,
    aufbewahrungAusnahme: { bis, begruendung: "Fiktive Ausnahmebegründung" },
  });
  jetzt = START + 31 * TAG;
  const neu = new GedaechtnisDienst({
    repo: new PgGedaechtnisRepo(pool(), journal),
    jetzt: () => jetzt,
  });
  expect((await neu.eigene("anna"))[0]?.aufbewahrungAusnahme).toMatchObject({
    bis,
    begruendung: "Fiktive Ausnahmebegründung",
    verantwortlich: "anna",
  });
  expect(await neu.raeumeAbgelaufeneAuf()).toBe(0);
  expect(
    (await c.exec(["pg_dump", "-U", "postgres", "-Fc", "-f", "/tmp/p10.dump", "klara_p10_test"]))
      .exitCode,
  ).toBe(0);
  jetzt = START + 40 * TAG;
  expect(await neu.eigene("anna")).toEqual([]);
  expect(await neu.raeumeAbgelaufeneAuf()).toBe(1);
  expect(
    Number(
      (await pool().query("SELECT count(*) FROM interaktions_gedaechtnis WHERE id=$1", [a.id]))
        .rows[0].count,
    ),
  ).toBe(0);
  expect((await neu.eigene("bert"))[0]?.id).toBe(b.id);
  expect((await c.exec(["createdb", "-U", "postgres", "klara_p10_restore_test"])).exitCode).toBe(0);
  expect(
    (
      await c.exec([
        "pg_restore",
        "-U",
        "postgres",
        "-d",
        "klara_p10_restore_test",
        "/tmp/p10.dump",
      ])
    ).exitCode,
  ).toBe(0);
  const rp = pool("klara_p10_restore_test");
  const wieder = new PgGedaechtnisRepo(rp, journal);
  expect(await wieder.wendeLoeschmarkenAn()).toBe(1);
  expect(
    Number(
      (await rp.query("SELECT count(*) FROM interaktions_gedaechtnis WHERE id=$1", [a.id])).rows[0]
        .count,
    ),
  ).toBe(0);
  expect(await wieder.wendeLoeschmarkenAn()).toBe(0);
  const marken = await readFile(join(ordner, "marken.ndjson"), "utf8");
  for (const text of ["anna", "Fiktive Ausnahmebegründung", "persönlicher Inhalt"])
    expect(marken).not.toContain(text);
}, 120000);
