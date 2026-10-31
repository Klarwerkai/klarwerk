import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { expect, it, onTestFinished } from "vitest";
import { registerWebStatic } from "../../services/app/src/web-static";

it("liefert nach ready neue Assets dynamisch; der echte wildcard=false-Kontrollzweig enumeriert nur vorher", async () => {
  const require = createRequire(import.meta.url);
  const staticMain = require.resolve("@fastify/static");
  const staticRequire = createRequire(staticMain);
  const globManifest = staticRequire.resolve("glob/package.json");
  const globRequire = createRequire(globManifest);
  const manifests = [
    join(dirname(staticMain), "package.json"),
    globManifest,
    globRequire.resolve("minimatch/package.json"),
  ];
  const versions = manifests.map((p) => JSON.parse(readFileSync(p, "utf8")).version);
  expect(versions).toEqual(["9.1.3", "13.0.6", "10.2.5"]);
  const lock = JSON.parse(
    readFileSync(join(import.meta.dirname, "../../package-lock.json"), "utf8"),
  );
  expect([
    lock.packages["node_modules/@fastify/static"].version,
    lock.packages["node_modules/@fastify/static/node_modules/glob"].version,
    lock.packages["node_modules/@fastify/static/node_modules/minimatch"].version,
  ]).toEqual(versions);
  // Öffentliche, gelesene Pluginquelle: glob nur im anderen wildcard=false-Zweig.
  // Bei Versions- oder Quelldrift muss die Bewertung neu erfolgen.
  expect(createHash("sha256").update(readFileSync(staticMain)).digest("hex")).toBe(
    "9f1d1ea778d8eb7aff1ff2e509fc261f7244364bceddd26d061fd47fc9264101",
  );

  const basis = await mkdtemp(join(tmpdir(), "klarwerk-static-glob-20261031-"));
  const dynamisch = Fastify();
  const enumeriert = Fastify();
  const dist = join(basis, "dynamisch");
  const kontrolle = join(basis, "enumeriert");
  const vorher = "export const vorher = true;";
  const spaet = "export const nachReady = true;";
  onTestFinished(async () => {
    const beendet = await Promise.allSettled([dynamisch.close(), enumeriert.close()]);
    await rm(basis, { recursive: true, force: true });
    for (const ende of beendet) if (ende.status === "rejected") throw ende.reason;
  });
  for (const root of [dist, kontrolle]) {
    await mkdir(join(root, "assets"), { recursive: true });
    await writeFile(join(root, "index.html"), "<!doctype html><title>Fixture</title>");
    await writeFile(join(root, "assets/vorher.js"), vorher);
  }
  await registerWebStatic(dynamisch, dist);
  await dynamisch.ready();
  await enumeriert.register(fastifyStatic, { root: kontrolle, wildcard: false });
  await enumeriert.ready();

  for (const app of [dynamisch, enumeriert]) {
    const vorhanden = await app.inject({ method: "GET", url: "/assets/vorher.js" });
    expect(vorhanden.statusCode).toBe(200);
    expect(vorhanden.body).toBe(vorher);
  }
  for (const root of [dist, kontrolle]) {
    await writeFile(join(root, "assets/nach-ready.js"), spaet);
  }
  const neu = await dynamisch.inject({ method: "GET", url: "/assets/nach-ready.js" });
  expect(neu.statusCode).toBe(200);
  expect(neu.body).toBe(spaet);
  const nichtEnumeriert = await enumeriert.inject({
    method: "GET",
    url: "/assets/nach-ready.js",
  });
  expect(nichtEnumeriert.statusCode).toBe(404);
});
